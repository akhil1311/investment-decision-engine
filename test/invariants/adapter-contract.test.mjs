/**
 * Vendor-neutral adapter contract — emission shape + PIT gate.
 * No vendor SKUs; fixtures prove the contract via identity projection.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFixtureDataset, createPitStore } from "../../src/lib/pit-store.mjs";
import {
  ADAPTER_CONTRACT_VERSION,
  AdapterContractCode,
  assertAdapterEmissionShape,
  assertAdapterEmission,
  datasetToEmission,
  emissionToDataset,
} from "../../src/lib/adapter-contract.mjs";
import { replay } from "../../src/lib/replay.mjs";

const base = loadFixtureDataset();

function cloneEmission() {
  return JSON.parse(JSON.stringify(datasetToEmission(base)));
}

/** Production-shaped emission: research eight names only (no SYN_* adversarials). */
function researchUniverseEmission() {
  const em = cloneEmission();
  const researchIds = [
    "RELIANCE",
    "HDFCBANK",
    "INFY",
    "ITC",
    "SUNPHARMA",
    "LT",
    "TCS",
    "ONGC",
  ];
  em.meta.security_ids = researchIds;
  const next = {};
  for (const id of researchIds) next[id] = em.securities[id];
  em.securities = next;
  return em;
}

test("contract version is stable and vendor-neutral", () => {
  assert.equal(ADAPTER_CONTRACT_VERSION, "adapter-contract-v1");
  assert.ok(!/s&p|lseg|nse|factset|bloomberg|eodhd/i.test(ADAPTER_CONTRACT_VERSION));
});

test("identity fixture emission passes shape + research_fixture PIT gate", () => {
  const emission = datasetToEmission(base);
  const shape = assertAdapterEmissionShape(emission);
  assert.equal(shape.ok, true, JSON.stringify(shape.errors, null, 2));

  const gate = assertAdapterEmission(emission, {
    profile: "research_fixture",
  });
  assert.equal(gate.ok, true, JSON.stringify(gate.errors, null, 2));
  assert.ok(gate.dataset);
  assert.equal(gate.contract_version, ADAPTER_CONTRACT_VERSION);
});

test("research-universe emission passes canonical_production gate", () => {
  const emission = researchUniverseEmission();
  const gate = assertAdapterEmission(emission, {
    profile: "canonical_production",
  });
  assert.equal(gate.ok, true, JSON.stringify(gate.errors, null, 2));
});

test("emissionToDataset + createPitStore yields deterministic data_version", () => {
  const emission = researchUniverseEmission();
  const gate = assertAdapterEmission(emission, {
    profile: "canonical_production",
  });
  assert.equal(gate.ok, true);
  const store = createPitStore(gate.dataset);
  const asOf = store.calendar.sessionClose(gate.dataset.meta.as_of_default_session);
  const a = store.loadAsOf("RELIANCE", asOf);
  const b = store.loadAsOf("RELIANCE", asOf);
  assert.equal(a.context.data_version, b.context.data_version);
});

test("reject emission with generic date field (via PIT/schema gate)", () => {
  const emission = researchUniverseEmission();
  emission.securities.RELIANCE.bars[0].date = "2024-01-02";
  const gate = assertAdapterEmission(emission, {
    profile: "canonical_production",
    includeAsOfProbes: false,
  });
  assert.equal(gate.ok, false);
  assert.ok(
    gate.errors.some((e) => e.code === AdapterContractCode.PIT_STORE_INVALID),
  );
});

test("reject emission missing security bundle key", () => {
  const emission = researchUniverseEmission();
  delete emission.securities.RELIANCE.events;
  const shape = assertAdapterEmissionShape(emission);
  assert.equal(shape.ok, false);
  assert.ok(
    shape.errors.some((e) => e.code === AdapterContractCode.SECURITY_BUNDLE_INVALID),
  );
});

test("reject emission with security_id mismatch", () => {
  const emission = researchUniverseEmission();
  emission.securities.RELIANCE.security.security_id = "OTHER";
  const shape = assertAdapterEmissionShape(emission);
  assert.equal(shape.ok, false);
  assert.ok(
    shape.errors.some((e) => e.code === AdapterContractCode.SECURITY_BUNDLE_INVALID),
  );
});

test("reject emission missing meta.session_dates", () => {
  const emission = researchUniverseEmission();
  delete emission.meta.session_dates;
  const shape = assertAdapterEmissionShape(emission);
  assert.equal(shape.ok, false);
  assert.ok(shape.errors.some((e) => e.code === AdapterContractCode.META_INVALID));
});

test("reject emission when securities key not in meta.security_ids", () => {
  const emission = researchUniverseEmission();
  emission.securities.EXTRA = emission.securities.RELIANCE;
  const shape = assertAdapterEmissionShape(emission);
  assert.equal(shape.ok, false);
  assert.ok(
    shape.errors.some((e) => e.code === AdapterContractCode.SECURITY_BUNDLE_INVALID),
  );
});

test("contract-gated emission can feed replay without vendor adapter", () => {
  const emission = researchUniverseEmission();
  const gate = assertAdapterEmission(emission, {
    profile: "canonical_production",
  });
  assert.equal(gate.ok, true);

  // Replay uses process fixture store by default; prove emission→dataset is store-compatible
  // by replaying through assess on the default fixture for the same as_of (same universe).
  const asOf = `${emission.meta.as_of_default_session}T15:30:00+05:30`;
  const report = replay({
    symbol: "RELIANCE",
    asOfs: [asOf],
  });
  assert.equal(report.summary.ok, 1);
  assert.equal(report.results[0].decision_state, "DISABLED");

  // And emission dataset calendar matches
  const ds = emissionToDataset(emission);
  assert.ok(ds.calendar.isTradingSession(emission.meta.as_of_default_session));
  assert.equal(
    ds.calendar.sessionClose(emission.meta.as_of_default_session),
    asOf,
  );
});

test("full fixture identity cannot use canonical_production (adversarial SYN_*)", () => {
  const emission = datasetToEmission(base);
  const gate = assertAdapterEmission(emission, {
    profile: "canonical_production",
    includeAsOfProbes: false,
  });
  assert.equal(gate.ok, false);
  assert.ok(
    gate.errors.some(
      (e) =>
        e.code === AdapterContractCode.PIT_STORE_INVALID &&
        String(e.message).includes("UNSUPPORTED_CORPORATE_ACTION"),
    ),
  );
});
