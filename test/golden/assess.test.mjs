import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assess } from "../../src/lib/assess.mjs";
import { createPitStore } from "../../src/lib/pit-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(__dirname, "reliance-not-held.json");

test("golden RELIANCE NOT_HELD is exact and decision DISABLED", () => {
  assert.ok(
    existsSync(GOLDEN),
    `Missing committed golden ${GOLDEN} — do not auto-generate in tests`,
  );

  const store = createPitStore();
  const asOfYmd = store.dataset.meta.as_of_default_session;
  const asOf = store.calendar.sessionClose(asOfYmd);
  const result = assess({
    symbol: "RELIANCE",
    as_of: asOf,
    position: { state: "NOT_HELD" },
  });

  assert.equal(result.decision.state, "DISABLED");
  assert.equal(result.decision.reason, "RESEARCH_GATE_CLOSED");
  assert.equal(result.confidence.state, "WITHHELD");
  assert.equal(result.confidence.reason, "Decision layer is not research-qualified.");
  assert.equal(result.context.as_of, asOf);
  assert.match(result.context.data_version, /^sha256:[0-9a-f]{16}$/);
  assert.equal(result.position_display.state, "NOT_HELD");
  assert.ok(!("decision" in result.evidence.quality));
  assert.ok(!("decision" in result.evidence.market));
  assert.ok(!("decision" in result.evidence.events));

  const snapshot = {
    decision: result.decision,
    confidence: result.confidence,
    evidence_status: result.evidence.status,
    sufficiency: result.assessment.sufficiency,
    tape_window: result.assessment.tape_window,
    event_timing: result.assessment.event_timing,
    quality_labels: Object.fromEntries(
      result.evidence.quality.metrics.map((m) => [m.metric, m.label]),
    ),
    market_labels: Object.fromEntries(
      result.evidence.market.metrics.map((m) => [m.metric, m.label]),
    ),
  };

  const expected = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.deepEqual(snapshot, expected);
});

test("engines never receive position — evidence omits entry fields", () => {
  const store = createPitStore();
  const asOf = store.calendar.sessionClose(store.dataset.meta.as_of_default_session);
  const r = assess({
    symbol: "INFY",
    as_of: asOf,
    position: {
      state: "HELD",
      quantity: 5,
      average_entry_price: 100,
      entry_date: "2024-01-02",
    },
  });
  assert.equal(r.decision.state, "DISABLED");
  const evidenceJson = JSON.stringify(r.evidence);
  assert.ok(!evidenceJson.includes("average_entry_price"));
  assert.ok(!evidenceJson.includes("unrealized"));
  assert.equal(r.position_display.state, "HELD");
});
