import { test } from "node:test";
import assert from "node:assert/strict";
import { createPitStore } from "../../src/lib/pit-store.mjs";
import { researchAdjustedClose } from "../../src/lib/prices.mjs";
import { runMarketEngine } from "../../src/engines/market.mjs";
import { runDecisionGate } from "../../src/lib/decision-gate.mjs";
import { assess } from "../../src/lib/assess.mjs";
import { selectStatementsAsOf } from "../../src/lib/pit-store.mjs";

const store = createPitStore();
const calendar = store.calendar;
const asOfYmd = store.dataset.meta.as_of_default_session;
const asOf = calendar.sessionClose(asOfYmd);

test("non-EOD as_of rejected", () => {
  assert.throws(
    () => assess({ symbol: "RELIANCE", as_of: `${asOfYmd}T18:00:00+05:30` }),
    (e) => e.code === "NON_EOD_AS_OF",
  );
});

test("unsupported CA fails loud", () => {
  assert.throws(
    () => {
      const loaded = store.loadAsOf("SYN_UNSUPPORTED_CA", asOf);
      return loaded;
    },
    (e) => e.code === "UNSUPPORTED_CORPORATE_ACTION",
  );
});

test("future announced bonus does not alter adjusted series", () => {
  const bundle = store.dataset.securities.SYN_FUTURE_BONUS;
  const midYmd = store.dataset.meta.session_dates[90];
  const midAsOf = calendar.sessionClose(midYmd);
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
    assert.equal(withCa[i].adjusted_close, withoutCa[i].adjusted_close);
  }
});

test("ex bonus removes artificial crash in adjusted 20-session return", () => {
  const loaded = store.loadAsOf("SYN_BONUS", asOf);
  const adj = loaded.marketInput.adjusted;
  const ca = store.dataset.securities.SYN_BONUS.corporate_actions[0];
  const exIdx = adj.findIndex((b) => b.trading_date === ca.ex_date);
  assert.ok(exIdx >= 20, "need pre-ex history for 20-session window");
  // Window that straddles ex_date — raw has the artificial ~50% crash; adjusted does not
  const t = exIdx + 5;
  const from = t - 20;
  const adjRet = adj[t].adjusted_close / adj[from].adjusted_close - 1;
  const rawRet = adj[t].raw_close / adj[from].raw_close - 1;
  assert.ok(
    Math.abs(rawRet) > 0.3,
    `raw return across bonus should show artificial crash, got ${rawRet}`,
  );
  assert.ok(
    Math.abs(adjRet) < 0.15,
    `adjusted 20-session return across bonus should stay continuous, got ${adjRet}`,
  );
  assert.ok(Math.abs(rawRet) > Math.abs(adjRet));
});

test("position invariance of evidence and assessment", () => {
  const a = assess({
    symbol: "RELIANCE",
    as_of: asOf,
    position: { state: "NOT_HELD" },
  });
  const b = assess({
    symbol: "RELIANCE",
    as_of: asOf,
    position: {
      state: "HELD",
      quantity: 10,
      average_entry_price: 99999,
      entry_date: "2020-01-01",
    },
  });
  assert.deepEqual(a.context, b.context);
  assert.deepEqual(a.evidence, b.evidence);
  assert.deepEqual(a.assessment, b.assessment);
  assert.equal(a.decision.state, "DISABLED");
  assert.equal(b.decision.state, "DISABLED");
  assert.notDeepEqual(a.position_display, b.position_display);
});

test("P&L unavailable after bonus after entry", () => {
  const bundle = store.dataset.securities.SYN_BONUS;
  const ca = bundle.corporate_actions[0];
  const idx = store.dataset.meta.session_dates.indexOf(ca.ex_date);
  const r = assess({
    symbol: "SYN_BONUS",
    as_of: asOf,
    position: {
      state: "HELD",
      quantity: 100,
      average_entry_price: 1000,
      entry_date: store.dataset.meta.session_dates[idx - 10],
    },
  });
  assert.equal(r.position_display.pnl_status, "UNAVAILABLE");
  assert.equal(r.position_display.reason, "CORPORATE_ACTION_AFTER_ENTRY");
  assert.equal(r.decision.state, "DISABLED");
});

test("statement revision PIT: earlier as_of sees v1 only", () => {
  const stmts = store.dataset.securities.RELIANCE.statements;
  const v1Avail = stmts.find((s) => s.source_version === 1 && s.fiscal_period_id === "FY26-Q1" && s.statement_type === "income_statement");
  const v2Avail = stmts.find((s) => s.source_version === 2);
  assert.ok(v1Avail && v2Avail);
  const before = selectStatementsAsOf(stmts, v1Avail.available_at).find(
    (s) => s.fiscal_period_id === "FY26-Q1" && s.statement_type === "income_statement",
  );
  const after = selectStatementsAsOf(stmts, v2Avail.available_at).find(
    (s) => s.fiscal_period_id === "FY26-Q1" && s.statement_type === "income_statement",
  );
  assert.equal(before.source_version, 1);
  assert.equal(after.source_version, 2);
  assert.notEqual(before.revenue, after.revenue);
});

test("decision gate ignores mutated inputs while closed", () => {
  const a = runDecisionGate({ x: 1 }, { y: 2 }, { z: 3 }, { w: 4 });
  const b = runDecisionGate(
    { tape_window: "HOSTILE" },
    { status: "CONFLICTING" },
    { state: "HELD" },
    { as_of: "changed" },
  );
  assert.deepEqual(a, b);
  assert.equal(a.decision.state, "DISABLED");
  assert.equal(a.confidence.state, "WITHHELD");
});

test("lookback: 20 closes enough for SMA20 but not 20-session return", () => {
  const mid = store.dataset.meta.session_dates[19]; // 20th session index 19
  // SYN_SHORT20 only has 20 bars — use its last session
  const short = store.dataset.securities.SYN_SHORT20;
  const last = short.bars[short.bars.length - 1].trading_date;
  const asOfShort = calendar.sessionClose(last);
  const loaded = store.loadAsOf("SYN_SHORT20", asOfShort);
  const m = runMarketEngine(loaded.marketInput, loaded.context);
  const sma = m.metrics.find((x) => x.metric === "sma_trend");
  const rs = m.metrics.find((x) => x.metric === "rs_20d");
  assert.notEqual(sma.label, "UNAVAILABLE");
  assert.equal(rs.label, "UNAVAILABLE");
});
