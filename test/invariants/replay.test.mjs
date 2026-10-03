/**
 * Vendor-neutral replay harness — fixture T1/T2 knowledge-state integrity.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getStore } from "../../src/lib/assess.mjs";
import {
  replay,
  replayAsOf,
  resolveReplayAsOfs,
  knowledgeStateChanged,
} from "../../src/lib/replay.mjs";

const store = getStore();
const calendar = store.calendar;
const sessions = store.dataset.meta.session_dates;

function relianceRevisionWindows() {
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
  const t1Ymd = sessions
    .filter((s) => {
      const iso = calendar.sessionClose(s);
      return iso >= v1.available_at && iso < v2.available_at;
    })
    .at(-1);
  const t2Ymd = v2.available_at.slice(0, 10);
  assert.ok(t1Ymd);
  assert.ok(calendar.isTradingSession(t2Ymd));
  return {
    v1,
    v2,
    t1: calendar.sessionClose(t1Ymd),
    t2: calendar.sessionClose(t2Ymd),
  };
}

test("resolveReplayAsOfs: explicit list and start/end range", () => {
  const def = store.dataset.meta.as_of_default_session;
  const prev = calendar.previousSession(def);
  const one = resolveReplayAsOfs({
    asOfs: [calendar.sessionClose(def)],
  });
  assert.equal(one.length, 1);
  assert.equal(one[0], calendar.sessionClose(def));

  const range = resolveReplayAsOfs({ start: prev, end: def });
  assert.ok(range.length >= 2);
  assert.equal(range[0], calendar.sessionClose(prev));
  assert.equal(range[range.length - 1], calendar.sessionClose(def));
});

test("replayAsOf: single fixture assessment uses existing assess pipeline", () => {
  const asOf = calendar.sessionClose(store.dataset.meta.as_of_default_session);
  const card = replayAsOf("RELIANCE", asOf);
  assert.equal(card.decision.state, "DISABLED");
  assert.equal(card.context.as_of, asOf);
  assert.ok(card.context.data_version);
  assert.ok(card.evidence);
  assert.ok(card.assessment);
});

test("replay T1/T2: different historical knowledge states for RELIANCE revision", () => {
  const { t1, t2, v1, v2 } = relianceRevisionWindows();
  const report = replay({
    symbol: "RELIANCE",
    asOfs: [t1, t2],
    position: { state: "NOT_HELD" },
  });

  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.ok, 2);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.decision_disabled, 2);
  assert.equal(report.summary.distinct_data_versions, 2);

  const [r1, r2] = report.results;
  assert.equal(r1.decision_state, "DISABLED");
  assert.equal(r2.decision_state, "DISABLED");
  assert.notEqual(r1.data_version, r2.data_version);
  assert.ok(knowledgeStateChanged(r1.card, r2.card));

  const rev1 = r1.card.evidence.quality.metrics.find(
    (m) => m.metric === "revenue_yoy",
  );
  const rev2 = r2.card.evidence.quality.metrics.find(
    (m) => m.metric === "revenue_yoy",
  );
  assert.ok(rev1 && rev2);
  assert.notEqual(rev1.value, rev2.value);
  // Sanity: underlying statement revenues differ across the PIT boundary
  assert.notEqual(v1.revenue, v2.revenue);
});

test("replay determinism: identical range → identical serialized report", () => {
  const { t1, t2 } = relianceRevisionWindows();
  const a = replay({ symbol: "RELIANCE", asOfs: [t1, t2] });
  const b = replay({ symbol: "RELIANCE", asOfs: [t1, t2] });
  // Strip nothing — full cards must be byte-stable for fixed fixtures
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("replay short session range: all cards DISABLED on research fixture", () => {
  const end = store.dataset.meta.as_of_default_session;
  let start = end;
  for (let i = 0; i < 4; i++) {
    const p = calendar.previousSession(start);
    if (!p) break;
    start = p;
  }
  const report = replay({
    symbol: "RELIANCE",
    start,
    end,
    position: { state: "NOT_HELD" },
  });
  assert.ok(report.summary.total >= 2);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.decision_disabled, report.summary.ok);
  for (const r of report.results) {
    assert.equal(r.ok, true);
    assert.equal(r.decision_state, "DISABLED");
    assert.ok(r.data_version);
  }
});

test("replay surfaces fail-loud unsupported CA (does not silently succeed)", () => {
  const asOf = calendar.sessionClose(store.dataset.meta.as_of_default_session);
  const report = replay({
    symbol: "SYN_UNSUPPORTED_CA",
    asOfs: [asOf],
    continueOnError: true,
  });
  assert.equal(report.summary.ok, 0);
  assert.equal(report.summary.failed, 1);
  assert.equal(report.results[0].error.code, "UNSUPPORTED_CORPORATE_ACTION");
});
