/**
 * Spec-critical credibility suite — composition over count.
 * These tests encode the hard-stops that make V1 trustworthy.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPitStore, loadFixtureDataset } from "../../src/lib/pit-store.mjs";
import { researchAdjustedClose } from "../../src/lib/prices.mjs";
import { runMarketEngine, classifyRs } from "../../src/engines/market.mjs";
import { runDecisionGate } from "../../src/lib/decision-gate.mjs";
import { assess } from "../../src/lib/assess.mjs";
import { createSessionCalendar } from "../../src/lib/session-calendar.mjs";

const store = createPitStore();
const calendar = store.calendar;
const sessions = store.dataset.meta.session_dates;
const asOfYmd = store.dataset.meta.as_of_default_session;
const asOf = calendar.sessionClose(asOfYmd);

const EXPECTED_DECISION = {
  decision: { state: "DISABLED", reason: "RESEARCH_GATE_CLOSED" },
  confidence: {
    state: "WITHHELD",
    reason: "Decision layer is not research-qualified.",
  },
};

// ─── 1. PIT leakage: assessment(T1) must not see revision at T2 ───────────────

test("PIT leakage: assess(T1) uses statement v1; assess(T2) sees v2 revenue", () => {
  const stmts = store.dataset.securities.RELIANCE.statements;
  const v1 = stmts.find(
    (s) =>
      s.source_version === 1 &&
      s.fiscal_period_id === "FY26-Q1" &&
      s.statement_type === "income_statement",
  );
  const v2 = stmts.find(
    (s) =>
      s.source_version === 2 &&
      s.fiscal_period_id === "FY26-Q1" &&
      s.statement_type === "income_statement",
  );
  assert.ok(v1 && v2);
  assert.ok(v1.available_at < v2.available_at);
  assert.notEqual(v1.revenue, v2.revenue);

  // T1 = last completed session where v1 is visible and v2 is not
  const t1Ymd = sessions
    .filter((s) => {
      const iso = calendar.sessionClose(s);
      return iso >= v1.available_at && iso < v2.available_at;
    })
    .at(-1);
  const t2Ymd = v2.available_at.slice(0, 10);
  assert.ok(t1Ymd, "need a session between v1 and v2 availability");
  assert.ok(calendar.isTradingSession(t2Ymd));

  const t1Iso = calendar.sessionClose(t1Ymd);
  const t2Iso = calendar.sessionClose(t2Ymd);
  const loadedT1 = store.loadAsOf("RELIANCE", t1Iso);
  const loadedT2 = store.loadAsOf("RELIANCE", t2Iso);
  const incomeT1 = loadedT1.fundamentalInput.statements.find(
    (s) => s.fiscal_period_id === "FY26-Q1" && s.statement_type === "income_statement",
  );
  const incomeT2 = loadedT2.fundamentalInput.statements.find(
    (s) => s.fiscal_period_id === "FY26-Q1" && s.statement_type === "income_statement",
  );
  assert.equal(incomeT1.source_version, 1);
  assert.equal(incomeT1.revenue, v1.revenue);
  assert.equal(incomeT2.source_version, 2);
  assert.equal(incomeT2.revenue, v2.revenue);

  const atT1 = assess({
    symbol: "RELIANCE",
    as_of: t1Iso,
    position: { state: "NOT_HELD" },
  });
  const atT2 = assess({
    symbol: "RELIANCE",
    as_of: t2Iso,
    position: { state: "NOT_HELD" },
  });
  const rev1 = atT1.evidence.quality.metrics.find((m) => m.metric === "revenue_yoy");
  const rev2 = atT2.evidence.quality.metrics.find((m) => m.metric === "revenue_yoy");
  assert.notEqual(rev1.value, rev2.value);
  assert.notDeepEqual(atT1.evidence.quality, atT2.evidence.quality);
});

// ─── 2. Future CA leakage: event visible, price adjust NOT ───────────────────

test("Future CA leakage: announcement visible as event; adjusted prices unchanged", () => {
  const midYmd = sessions[90]; // 2024-05-07; ex at sessions[100]=2024-05-21
  const midAsOf = calendar.sessionClose(midYmd);
  const bundle = store.dataset.securities.SYN_FUTURE_BONUS;
  const ca = bundle.corporate_actions[0];
  assert.ok(ca.available_at <= midAsOf);
  assert.ok(ca.ex_date > midYmd);

  const result = assess({
    symbol: "SYN_FUTURE_BONUS",
    as_of: midAsOf,
    position: { state: "NOT_HELD" },
  });

  // Event calendar sees the announced ex-date
  const known = result.evidence.events.known_events;
  assert.ok(
    known.some((e) => e.event_id === "syn-future-bonus-event"),
    "announced future ex-date must be PIT-visible as an event",
  );

  // Research prices: identical to no-CA series
  const withCa = researchAdjustedClose(
    bundle.bars,
    bundle.corporate_actions,
    midAsOf,
    midYmd,
    calendar,
  );
  const withoutCa = researchAdjustedClose(
    bundle.bars,
    [],
    midAsOf,
    midYmd,
    calendar,
  );
  assert.equal(withCa.length, withoutCa.length);
  for (let i = 0; i < withCa.length; i++) {
    assert.equal(
      withCa[i].adjusted_close,
      withoutCa[i].adjusted_close,
      withCa[i].trading_date,
    );
    assert.equal(withCa[i].adjusted_close, withCa[i].raw_close);
  }
  assert.equal(result.decision.state, "DISABLED");
});

// ─── 3. Position invariance A / B / C ─────────────────────────────────────────

test("Position invariance: A/B/C yield identical evidence and assessment", () => {
  const A = assess({
    symbol: "RELIANCE",
    as_of: asOf,
    position: { state: "NOT_HELD" },
  });
  const B = assess({
    symbol: "RELIANCE",
    as_of: asOf,
    position: {
      state: "HELD",
      quantity: 10,
      average_entry_price: 99999,
      entry_date: "2020-01-01",
    },
  });
  const C = assess({
    symbol: "RELIANCE",
    as_of: asOf,
    position: {
      state: "HELD",
      quantity: 1,
      average_entry_price: 1,
      entry_date: "2024-06-03",
    },
  });

  assert.deepEqual(A.context, B.context);
  assert.deepEqual(A.context, C.context);
  assert.deepEqual(A.evidence, B.evidence);
  assert.deepEqual(A.evidence, C.evidence);
  assert.deepEqual(A.assessment, B.assessment);
  assert.deepEqual(A.assessment, C.assessment);

  assert.notDeepEqual(A.position_display, B.position_display);
  assert.notDeepEqual(B.position_display, C.position_display);

  for (const r of [A, B, C]) {
    assert.deepEqual(
      { decision: r.decision, confidence: r.confidence },
      EXPECTED_DECISION,
    );
  }
});

// ─── 4. Boundary semantics RS ─────────────────────────────────────────────────

test("Boundary semantics: RS = ±2.0 MIXED; ±2.0001 SUPPORTIVE/HOSTILE", () => {
  assert.equal(classifyRs(2.0), "MIXED");
  assert.equal(classifyRs(-2.0), "MIXED");
  assert.equal(classifyRs(2.0001), "SUPPORTIVE");
  assert.equal(classifyRs(-2.0001), "HOSTILE");
});

// ─── 5. Lookback 20 unavailable / 21 available for 20-session return ──────────

test("Lookback semantics: 20 closes → RS UNAVAILABLE; 21 closes → RS available", () => {
  const ctx = {
    as_of: asOf,
    timezone: "Asia/Kolkata",
    security_id: "SYN",
    horizon: { unit: "trading_days", min: 5, max: 20 },
    data_version: "test",
  };

  const series = (n) => {
    const adjusted = Array.from({ length: n }, (_, i) => ({
      trading_date: `d${i}`,
      adjusted_close: 100 + i,
      raw_close: 100 + i,
    }));
    const benchmark_bars = Array.from({ length: n }, (_, i) => ({
      trading_date: `d${i}`,
      close: 1000 + i * 0.5,
    }));
    const traded_values = Array.from({ length: n }, (_, i) => ({
      trading_date: `d${i}`,
      value_inr: 5e8,
    }));
    return runMarketEngine(
      { adjusted, benchmark_bars, traded_values, bars: [], corporate_actions: [] },
      ctx,
    );
  };

  const m20 = series(20);
  const m21 = series(21);
  assert.equal(m20.metrics.find((x) => x.metric === "sma_trend").label !== "UNAVAILABLE", true);
  assert.equal(m20.metrics.find((x) => x.metric === "rs_20d").label, "UNAVAILABLE");
  assert.equal(m20.metrics.find((x) => x.metric === "volatility_20d").label, "UNAVAILABLE");
  assert.notEqual(m21.metrics.find((x) => x.metric === "rs_20d").label, "UNAVAILABLE");
  assert.notEqual(m21.metrics.find((x) => x.metric === "volatility_20d").label, "UNAVAILABLE");
});

// ─── 6. Decision mutation matrix ──────────────────────────────────────────────

test("Decision mutation: any assessment/evidence/position/context → same DISABLED", () => {
  const assessments = [
    { tape_window: "SUPPORTIVE", sufficiency: "SUFFICIENT" },
    { tape_window: "HOSTILE", sufficiency: "INSUFFICIENT", red_flag_present: true },
    { why: ["buy now"], what_would_change_assessment: ["initiate"] },
  ];
  const evidences = [
    { status: "OK" },
    { status: "CONFLICTING", market: { window: "HOSTILE" } },
    { status: "UNAVAILABLE" },
  ];
  const positions = [
    { state: "NOT_HELD" },
    { state: "HELD", quantity: 99, average_entry_price: 1, entry_date: "2010-01-01" },
    { state: "HELD", quantity: 0, average_entry_price: 0, entry_date: "2099-01-01" },
  ];
  const contexts = [
    { as_of: "2020-01-01T15:30:00+05:30" },
    { as_of: "2099-12-31T15:30:00+05:30", data_version: "tampered" },
    { security_id: "FAKE", timezone: "UTC" },
  ];

  const results = [];
  for (const a of assessments) {
    for (const e of evidences) {
      for (const p of positions) {
        for (const c of contexts) {
          results.push(runDecisionGate(a, e, p, c));
        }
      }
    }
  }
  assert.equal(results.length, 3 * 3 * 3 * 3);
  for (const r of results) {
    assert.deepEqual(r, EXPECTED_DECISION);
  }
});

// ─── 7. SYN_BONUS end-to-end architecture proof ───────────────────────────────

test("SYN_BONUS HELD: evidence/assessment unchanged; P&L UNAVAILABLE after CA", () => {
  const ca = store.dataset.securities.SYN_BONUS.corporate_actions[0];
  const exIdx = sessions.indexOf(ca.ex_date);
  const entry = sessions[exIdx - 10];

  const notHeld = assess({
    symbol: "SYN_BONUS",
    as_of: asOf,
    position: { state: "NOT_HELD" },
  });
  const held = assess({
    symbol: "SYN_BONUS",
    as_of: asOf,
    position: {
      state: "HELD",
      quantity: 100,
      average_entry_price: 1000,
      entry_date: entry,
    },
  });

  assert.deepEqual(held.context, notHeld.context);
  assert.deepEqual(held.evidence, notHeld.evidence);
  assert.deepEqual(held.assessment, notHeld.assessment);
  assert.deepEqual(
    { decision: held.decision, confidence: held.confidence },
    EXPECTED_DECISION,
  );
  assert.equal(held.position_display.pnl_status, "UNAVAILABLE");
  assert.equal(held.position_display.reason, "CORPORATE_ACTION_AFTER_ENTRY");
  assert.equal(notHeld.position_display.pnl_status, "N_A");
});

// ─── 8. data_version scoping ──────────────────────────────────────────────────

test("data_version: stable; unrelated security irrelevant; unused early bar ignored; used bar changes hash", () => {
  const h1 = assess({
    symbol: "RELIANCE",
    as_of: asOf,
    position: { state: "NOT_HELD" },
  }).context.data_version;
  const h1b = assess({
    symbol: "RELIANCE",
    as_of: asOf,
    position: { state: "NOT_HELD" },
  }).context.data_version;
  assert.equal(h1, h1b);

  const hInfy = assess({
    symbol: "INFY",
    as_of: asOf,
    position: { state: "NOT_HELD" },
  }).context.data_version;
  assert.notEqual(h1, hInfy);

  const base = loadFixtureDataset();
  const cloneDataset = (ds) => ({
    meta: JSON.parse(JSON.stringify(ds.meta)),
    securities: JSON.parse(JSON.stringify(ds.securities)),
    benchmark: JSON.parse(JSON.stringify(ds.benchmark)),
    fixture_version: ds.fixture_version,
    // Fresh calendar from session dates (functions are not cloneable)
    calendar: createSessionCalendar(ds.meta.session_dates),
  });

  // Mutate an early bar outside the last-61 window used by the hash
  const early = cloneDataset(base);
  assert.ok(early.securities.RELIANCE.bars.length > 80);
  early.securities.RELIANCE.bars[0].close = 0.01;
  early.securities.RELIANCE.bars[0].turnover = 1;
  const storeEarly = createPitStore(early);
  const hEarly = storeEarly.loadAsOf("RELIANCE", asOf).context.data_version;
  assert.equal(hEarly, store.loadAsOf("RELIANCE", asOf).context.data_version);

  // Mutate a bar inside the last 61 → hash must change
  const late = cloneDataset(base);
  const bars = late.securities.RELIANCE.bars;
  bars[bars.length - 1].close = bars[bars.length - 1].close * 1.5;
  const storeLate = createPitStore(late);
  const hLate = storeLate.loadAsOf("RELIANCE", asOf).context.data_version;
  assert.notEqual(hLate, store.loadAsOf("RELIANCE", asOf).context.data_version);
});

// ─── 9. Compound CA reconstruction ────────────────────────────────────────────

test("CA reconstruction: compound bonus then split; ex-date stays raw for that action", () => {
  // 61 sessions ending at as_of; bonus at D-40, split at D-20
  const calSessions = sessions.slice(-61);
  const cal = createSessionCalendar(calSessions);
  const asOfLocal = calSessions[calSessions.length - 1];
  const asOfIso = cal.sessionClose(asOfLocal);
  const bonusEx = calSessions[calSessions.length - 1 - 40];
  const splitEx = calSessions[calSessions.length - 1 - 20];

  const bars = calSessions.map((d) => ({
    trading_date: d,
    close: 100,
    volume: 1e6,
    turnover: 1e8,
    available_at: cal.sessionClose(d),
    currency: "INR",
  }));
  const corporate_actions = [
    {
      action_id: "bonus-a",
      type: "bonus",
      ex_date: bonusEx,
      factor: 0.5,
      available_at: cal.sessionClose(calSessions[0]),
      source_version: 1,
    },
    {
      action_id: "split-b",
      type: "split",
      ex_date: splitEx,
      factor: 0.5,
      available_at: cal.sessionClose(calSessions[0]),
      source_version: 1,
    },
  ];

  const adj = researchAdjustedClose(
    bars,
    corporate_actions,
    asOfIso,
    asOfLocal,
    cal,
  );
  assert.equal(adj.length, bars.length);

  for (const row of adj) {
    let expected = 100;
    if (row.trading_date < bonusEx) expected *= 0.5;
    if (row.trading_date < splitEx) expected *= 0.5;
    assert.equal(
      row.adjusted_close,
      expected,
      `${row.trading_date}: expected ${expected}, got ${row.adjusted_close}`,
    );
    // Ex-date session itself is unadjusted for that action
    if (row.trading_date === bonusEx) {
      assert.equal(row.adjusted_close, 50); // only split factor still pending
    }
    if (row.trading_date === splitEx) {
      assert.equal(row.adjusted_close, 100); // both actions' ex reached
    }
  }
});

// ─── 10. EOD as_of matrix ─────────────────────────────────────────────────────

test("EOD as_of matrix: only exact session-close 15:30 on a trading day accepted", () => {
  assert.doesNotThrow(() =>
    assess({ symbol: "RELIANCE", as_of: asOf, position: { state: "NOT_HELD" } }),
  );

  const rejects = [
    `${asOfYmd}T15:29:00+05:30`,
    `${asOfYmd}T15:31:00+05:30`,
    `${asOfYmd}T18:00:00+05:30`,
    `${asOfYmd}T15:30:00Z`,
    `2025-07-13T15:30:00+05:30`, // Sunday (not in session calendar)
  ];
  for (const bad of rejects) {
    assert.throws(
      () => assess({ symbol: "RELIANCE", as_of: bad, position: { state: "NOT_HELD" } }),
      (e) => e.code === "NON_EOD_AS_OF",
      bad,
    );
  }
});
