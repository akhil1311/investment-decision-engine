import { test } from "node:test";
import assert from "node:assert/strict";
import { createPitStore, selectEventsAsOf } from "../../src/lib/pit-store.mjs";
import { researchAdjustedClose } from "../../src/lib/prices.mjs";
import { runMarketEngine, classifyRs, classifyVolatility, classifyDrawdown, classifyLiquidity } from "../../src/engines/market.mjs";
import { runQualityEngine, classifyYoy, classifyDebtEquity } from "../../src/engines/quality.mjs";
import { runEventEngine } from "../../src/engines/events.mjs";
import { rollupEvidenceStatus, computeSufficiency } from "../../src/lib/evidence-sufficiency.mjs";
import { assess } from "../../src/lib/assess.mjs";
import { createSessionCalendar } from "../../src/lib/session-calendar.mjs";

const store = createPitStore();
const calendar = store.calendar;
const asOfYmd = store.dataset.meta.as_of_default_session;
const asOf = calendar.sessionClose(asOfYmd);

const ctx = {
  as_of: asOf,
  timezone: "Asia/Kolkata",
  security_id: "SYN",
  horizon: { unit: "trading_days", min: 5, max: 20 },
  data_version: "test",
};

test("classifier exact boundaries (vol/drawdown/RS/liquidity/YoY/DE)", () => {
  assert.equal(classifyRs(2.0), "MIXED");
  assert.equal(classifyRs(-2.0), "MIXED");
  assert.equal(classifyRs(2.0001), "SUPPORTIVE");
  assert.equal(classifyRs(-2.0001), "HOSTILE");

  assert.equal(classifyVolatility(1.4999), "SUPPORTIVE");
  assert.equal(classifyVolatility(1.5), "MIXED");
  assert.equal(classifyVolatility(2.5), "MIXED");
  assert.equal(classifyVolatility(2.5001), "HOSTILE");

  assert.equal(classifyDrawdown(-4.9999), "SUPPORTIVE");
  assert.equal(classifyDrawdown(-5), "MIXED");
  assert.equal(classifyDrawdown(-10), "HOSTILE");
  assert.equal(classifyDrawdown(-9.9999), "MIXED");

  assert.equal(classifyLiquidity(5e8), "SUPPORTIVE");
  assert.equal(classifyLiquidity(1e8), "MIXED");
  assert.equal(classifyLiquidity(1e8 - 1), "HOSTILE");

  assert.equal(classifyYoy(10), "NEUTRAL");
  assert.equal(classifyYoy(10.0000000002), "NEUTRAL");
  assert.equal(classifyYoy(-10), "WARNING");
  assert.equal(classifyDebtEquity(0.5), "NEUTRAL");
  assert.equal(classifyDebtEquity(2.0), "WARNING");
});

test("evidence.status precedence CONFLICTING > STALE > INCOMPLETE > UNAVAILABLE > OK", () => {
  assert.equal(rollupEvidenceStatus(["OK", "INCOMPLETE"]), "INCOMPLETE");
  assert.equal(rollupEvidenceStatus(["UNAVAILABLE", "STALE"]), "STALE");
  assert.equal(
    rollupEvidenceStatus(["OK", "UNAVAILABLE", "CONFLICTING", "STALE"]),
    "CONFLICTING",
  );
});

test("UNAVAILABLE metrics do not vote — aggregate stays MIXED when only HOSTILE is unavailable", () => {
  const n = 61;
  const adjusted = Array.from({ length: n }, (_, i) => ({
    trading_date: `d${i}`,
    adjusted_close: 100 + i * 0.1,
    raw_close: 100 + i * 0.1,
  }));
  const benchmark_bars = Array.from({ length: n }, (_, i) => ({
    trading_date: `d${i}`,
    close: 1000,
  }));
  // Only 10 liquidity points → liquidity UNAVAILABLE
  const traded_values = Array.from({ length: 10 }, (_, i) => ({
    trading_date: `d${i}`,
    value_inr: 1e7, // would be HOSTILE if voted
  }));
  const m = runMarketEngine(
    { adjusted, benchmark_bars, traded_values, bars: [], corporate_actions: [] },
    ctx,
  );
  assert.equal(m.metrics.find((x) => x.metric === "liquidity_20d").label, "UNAVAILABLE");
  assert.notEqual(m.window, "HOSTILE");
});

test("scale invariance: ×10 prices keeps return labels; liquidity scales", () => {
  const n = 61;
  const baseAdj = Array.from({ length: n }, (_, i) => ({
    trading_date: `d${i}`,
    adjusted_close: 100 * (1 + i * 0.001),
    raw_close: 100 * (1 + i * 0.001),
  }));
  const baseBench = Array.from({ length: n }, (_, i) => ({
    trading_date: `d${i}`,
    close: 1000 * (1 + i * 0.0005),
  }));
  const baseTv = Array.from({ length: n }, (_, i) => ({
    trading_date: `d${i}`,
    value_inr: 2e8,
  }));
  const a = runMarketEngine(
    {
      adjusted: baseAdj,
      benchmark_bars: baseBench,
      traded_values: baseTv,
      bars: [],
      corporate_actions: [],
    },
    ctx,
  );
  const b = runMarketEngine(
    {
      adjusted: baseAdj.map((x) => ({
        ...x,
        adjusted_close: x.adjusted_close * 10,
        raw_close: x.raw_close * 10,
      })),
      benchmark_bars: baseBench.map((x) => ({ ...x, close: x.close * 10 })),
      traded_values: baseTv.map((x) => ({ ...x, value_inr: x.value_inr * 10 })),
      bars: [],
      corporate_actions: [],
    },
    ctx,
  );
  for (const name of ["sma_trend", "rs_20d", "volatility_20d", "drawdown_60d"]) {
    assert.equal(
      a.metrics.find((m) => m.metric === name).label,
      b.metrics.find((m) => m.metric === name).label,
      name,
    );
  }
  assert.equal(
    a.metrics.find((m) => m.metric === "liquidity_20d").value * 10,
    b.metrics.find((m) => m.metric === "liquidity_20d").value,
  );
});

test("constant adjusted close: vol SUPPORTIVE, drawdown SUPPORTIVE", () => {
  const n = 61;
  const adjusted = Array.from({ length: n }, (_, i) => ({
    trading_date: `d${i}`,
    adjusted_close: 100,
    raw_close: 100,
  }));
  const benchmark_bars = Array.from({ length: n }, (_, i) => ({
    trading_date: `d${i}`,
    close: 1000,
  }));
  const traded_values = Array.from({ length: n }, (_, i) => ({
    trading_date: `d${i}`,
    value_inr: 5e8,
  }));
  const m = runMarketEngine(
    { adjusted, benchmark_bars, traded_values, bars: [], corporate_actions: [] },
    ctx,
  );
  assert.equal(m.metrics.find((x) => x.metric === "volatility_20d").label, "SUPPORTIVE");
  assert.equal(m.metrics.find((x) => x.metric === "drawdown_60d").label, "SUPPORTIVE");
  assert.equal(m.metrics.find((x) => x.metric === "volatility_20d").value, 0);
  assert.equal(m.metrics.find((x) => x.metric === "drawdown_60d").value, 0);
});

test("event calendar PIT: available_at after as_of is invisible", () => {
  const events = [
    {
      event_id: "e1",
      type: "earnings",
      event_date: "2025-08-01",
      available_at: "2025-07-20T15:30:00+05:30",
      source_version: 1,
      source_timestamp_type: "derived",
    },
  ];
  const before = selectEventsAsOf(events, "2025-07-14T15:30:00+05:30");
  const after = selectEventsAsOf(events, "2025-07-20T15:30:00+05:30");
  assert.equal(before.length, 0);
  assert.equal(after.length, 1);

  const sessions = store.dataset.meta.session_dates.slice(-20);
  const cal = createSessionCalendar(sessions);
  const early = runEventEngine(
    { events: before },
    { ...ctx, as_of: "2025-07-14T15:30:00+05:30" },
    cal,
  );
  assert.equal(early.timing, "UNKNOWN");
});

test("incomplete corporate-action factor fails loud", () => {
  const bundle = store.dataset.securities.SYN_BONUS;
  const bad = bundle.corporate_actions.map((c) => ({ ...c, factor: null }));
  assert.throws(
    () =>
      researchAdjustedClose(
        bundle.bars,
        bad,
        asOf,
        asOfYmd,
        calendar,
      ),
    (e) => e.code === "INCOMPLETE_CORPORATE_ACTION",
  );
});

test("ex-bonus adjusted path has no artificial crash at ex boundary", () => {
  const bundle = store.dataset.securities.SYN_BONUS;
  const ca = bundle.corporate_actions[0];
  const loaded = store.loadAsOf("SYN_BONUS", asOf);
  const adj = loaded.marketInput.adjusted;
  const exIdx = adj.findIndex((b) => b.trading_date === ca.ex_date);
  assert.ok(exIdx > 0);
  const rawJump =
    adj[exIdx].raw_close / adj[exIdx - 1].raw_close - 1;
  const adjJump =
    adj[exIdx].adjusted_close / adj[exIdx - 1].adjusted_close - 1;
  assert.ok(
    Math.abs(rawJump) > 0.3,
    `expected large raw jump at bonus, got ${rawJump}`,
  );
  assert.ok(
    Math.abs(adjJump) < 0.15,
    `adjusted jump should be small, got ${adjJump}`,
  );
});

test("drawdown UNAVAILABLE with 59 closes", () => {
  const short = store.dataset.securities.SYN_SHORT59;
  const last = short.bars[short.bars.length - 1].trading_date;
  const loaded = store.loadAsOf("SYN_SHORT59", calendar.sessionClose(last));
  const m = runMarketEngine(loaded.marketInput, loaded.context);
  assert.equal(m.metrics.find((x) => x.metric === "drawdown_60d").label, "UNAVAILABLE");
  assert.equal(m.coverage_status, "INCOMPLETE");
  assert.notEqual(m.window, "SUPPORTIVE");
});

test("data_version stable for security; unrelated security change does not affect hash inputs", () => {
  const a = assess({ symbol: "RELIANCE", as_of: asOf, position: { state: "NOT_HELD" } });
  const b = assess({ symbol: "RELIANCE", as_of: asOf, position: { state: "NOT_HELD" } });
  assert.equal(a.context.data_version, b.context.data_version);
  const infy = assess({ symbol: "INFY", as_of: asOf, position: { state: "NOT_HELD" } });
  assert.notEqual(a.context.data_version, infy.context.data_version);
});

test("assessment prose has no trading verbs; engines have no decision field", () => {
  const r = assess({ symbol: "TCS", as_of: asOf, position: { state: "NOT_HELD" } });
  const prose = [
    ...r.assessment.why,
    ...r.assessment.what_would_change_assessment,
  ].join("\n");
  assert.doesNotMatch(
    prose,
    /\b(initiate|buy|sell|hold|avoid|reduce|exit|do not open|do not add)\b/i,
  );
  for (const eng of [r.evidence.quality, r.evidence.market, r.evidence.events]) {
    assert.equal(eng.decision, undefined);
    assert.equal(eng.state, undefined);
  }
  assert.equal(r.decision.state, "DISABLED");
});

test("sufficiency INSUFFICIENT when all quality metrics UNAVAILABLE", () => {
  const q = runQualityEngine({ statements: [] }, ctx);
  assert.ok(q.metrics.every((m) => m.label === "UNAVAILABLE"));
  const s = computeSufficiency({
    quality: q,
    market: { coverage_status: "OK", metrics: [] },
    events: { coverage_status: "OK", timing: "CLEAR" },
  });
  assert.equal(s.sufficiency, "INSUFFICIENT");
});

test("default as_of is latest completed EOD session close", () => {
  const r = assess({ symbol: "RELIANCE", position: { state: "NOT_HELD" } });
  const expectedYmd = calendar.latestCompletedSession();
  assert.equal(r.context.as_of, calendar.sessionClose(expectedYmd));
  assert.match(r.context.as_of, /^\d{4}-\d{2}-\d{2}T15:30:00\+05:30$/);
});
