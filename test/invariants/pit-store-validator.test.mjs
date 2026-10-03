/**
 * Vendor-neutral PIT store validator — Layer A / Layer B / profiles.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPitStore,
  loadFixtureDataset,
  selectCorporateActionsAsOf,
} from "../../src/lib/pit-store.mjs";
import { createSessionCalendar } from "../../src/lib/session-calendar.mjs";
import {
  researchAdjustedClose,
  listAdjustingCorporateActions,
} from "../../src/lib/prices.mjs";
import {
  validatePitStore,
  PitValidationCode,
  deriveAsOfProbes,
} from "../../src/lib/validate-pit-store.mjs";

function cloneDataset(ds) {
  return {
    meta: JSON.parse(JSON.stringify(ds.meta)),
    securities: JSON.parse(JSON.stringify(ds.securities)),
    benchmark: JSON.parse(JSON.stringify(ds.benchmark)),
    fixture_version: ds.fixture_version,
    calendar: createSessionCalendar(ds.meta.session_dates),
  };
}

function hasCode(result, code) {
  return result.errors.some((e) => e.code === code);
}

const base = loadFixtureDataset();

test("research_fixture: current fixtures validate OK", () => {
  const result = validatePitStore(base, { profile: "research_fixture" });
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
});

test("canonical_production: fails only for intentional unsupported CA", () => {
  const result = validatePitStore(base, { profile: "canonical_production" });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.UNSUPPORTED_CORPORATE_ACTION));
  assert.ok(
    result.errors.every(
      (e) =>
        e.code === PitValidationCode.UNSUPPORTED_CORPORATE_ACTION &&
        e.security_id === "SYN_UNSUPPORTED_CA",
    ),
    JSON.stringify(result.errors, null, 2),
  );
});

test("determinism: identical input → identical serialized output", () => {
  const a = validatePitStore(base, { profile: "research_fixture" });
  const b = validatePitStore(base, { profile: "research_fixture" });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = validatePitStore(base, { profile: "canonical_production" });
  const d = validatePitStore(base, { profile: "canonical_production" });
  assert.equal(JSON.stringify(c), JSON.stringify(d));
});

test("SCHEMA_INVALID: generic date field on bar", () => {
  const ds = cloneDataset(base);
  ds.securities.RELIANCE.bars[0].date = "2024-01-02";
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.SCHEMA_INVALID));
});

test("SCHEMA_INVALID: missing available_at on bar", () => {
  const ds = cloneDataset(base);
  delete ds.securities.RELIANCE.bars[0].available_at;
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.SCHEMA_INVALID));
});

test("AVAILABLE_AT_INVALID: bare date / no offset", () => {
  const ds = cloneDataset(base);
  ds.securities.RELIANCE.bars[0].available_at = "2024-01-02";
  ds.securities.RELIANCE.bars[0].timestamp_quality = "exact";
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.AVAILABLE_AT_INVALID));
});

test("AVAILABLE_AT_EOD_MISMATCH: date_only bar with non-EOD available_at", () => {
  const ds = cloneDataset(base);
  const bar = ds.securities.RELIANCE.bars[0];
  bar.timestamp_quality = "date_only";
  bar.available_at = `${bar.trading_date}T10:00:00+05:30`;
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.AVAILABLE_AT_EOD_MISMATCH));
});

test("DUPLICATE_BAR: same trading_date twice", () => {
  const ds = cloneDataset(base);
  const bar = { ...ds.securities.RELIANCE.bars[0] };
  ds.securities.RELIANCE.bars.push(bar);
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.DUPLICATE_BAR));
});

test("AMBIGUOUS_REVISION: statements same key + same revision fields", () => {
  const ds = cloneDataset(base);
  const stmts = ds.securities.RELIANCE.statements;
  const income = stmts.find(
    (s) =>
      s.statement_type === "income_statement" && s.fiscal_period_id === "FY26-Q1",
  );
  assert.ok(income);
  stmts.push({
    ...income,
    revenue: (income.revenue || 0) + 1,
  });
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.AMBIGUOUS_REVISION));
});

test("INCOMPLETE_CORPORATE_ACTION: split/bonus missing factor", () => {
  const ds = cloneDataset(base);
  const cas = ds.securities.SYN_BONUS.corporate_actions;
  assert.ok(cas.length);
  delete cas[0].factor;
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.INCOMPLETE_CORPORATE_ACTION));
});

test("UNKNOWN_SESSION: bar on non-session date", () => {
  const ds = cloneDataset(base);
  ds.securities.RELIANCE.bars[0].trading_date = "2099-01-01";
  ds.securities.RELIANCE.bars[0].available_at = "2099-01-01T15:30:00+05:30";
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.UNKNOWN_SESSION));
});

test("CA revision PIT two-sided: T1→factor 2.0, T2→factor 1.5", () => {
  const ds = cloneDataset(base);
  const sessions = ds.meta.session_dates;
  const t1Ymd = "2025-06-02";
  const t2Ymd = "2025-06-10";
  assert.ok(sessions.includes(t1Ymd) && sessions.includes(t2Ymd));
  const exDate = "2025-06-03";
  assert.ok(sessions.includes(exDate));

  ds.securities.RELIANCE.corporate_actions = [
    {
      action_id: "CA123",
      type: "bonus",
      ex_date: exDate,
      factor: 2.0,
      available_at: `${t1Ymd}T15:30:00+05:30`,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "test",
      source_version: 1,
    },
    {
      action_id: "CA123",
      type: "bonus",
      ex_date: exDate,
      factor: 1.5,
      available_at: `${t2Ymd}T15:30:00+05:30`,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "test",
      source_version: 2,
    },
  ];

  const layerA = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(layerA.ok, true, JSON.stringify(layerA.errors, null, 2));

  const t1 = `${t1Ymd}T15:30:00+05:30`;
  const t2 = `${t2Ymd}T15:30:00+05:30`;
  const sel1 = selectCorporateActionsAsOf(
    ds.securities.RELIANCE.corporate_actions,
    t1,
  );
  const sel2 = selectCorporateActionsAsOf(
    ds.securities.RELIANCE.corporate_actions,
    t2,
  );
  assert.equal(sel1.length, 1);
  assert.equal(sel1[0].factor, 2.0);
  assert.equal(sel2.length, 1);
  assert.equal(sel2[0].factor, 1.5);

  // At T2 (after ex), adjusting set uses selected revision factor 1.5 only
  const atT2 = listAdjustingCorporateActions(
    ds.securities.RELIANCE.corporate_actions,
    t2,
    t2Ymd,
    ds.calendar,
  );
  assert.equal(atT2.length, 1);
  assert.equal(atT2[0].factor, 1.5);

  // Adjusted series at T2 must use 1.5 once, not 2.0*1.5
  const bars = ds.securities.RELIANCE.bars;
  const series = researchAdjustedClose(
    bars,
    ds.securities.RELIANCE.corporate_actions,
    t2,
    t2Ymd,
    ds.calendar,
  );
  const preEx = series.find((b) => b.trading_date < exDate);
  assert.ok(preEx);
  const raw = bars.find((b) => b.trading_date === preEx.trading_date);
  assert.equal(preEx.adjusted_close, raw.close * 1.5);
});

test("AMBIGUOUS_REVISION: exact duplicate CA revision key", () => {
  const ds = cloneDataset(base);
  const ca = {
    action_id: "CA-DUP",
    type: "bonus",
    ex_date: "2025-06-03",
    factor: 0.5,
    available_at: "2025-05-27T15:30:00+05:30",
    source_timestamp_type: "derived",
    timestamp_quality: "date_only",
    source: "test",
    source_version: 1,
  };
  ds.securities.RELIANCE.corporate_actions = [ca, { ...ca }];
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.AMBIGUOUS_REVISION));
});

test("B2c: past ex_date + future available_at must not adjust", () => {
  const ds = cloneDataset(base);
  // as_of after ex_date, before CA available_at (sessions: …10, 11, 14…)
  const asOfYmd = "2025-07-11";
  const exDate = "2025-07-10";
  const availYmd = "2025-07-14";
  assert.ok(ds.meta.session_dates.includes(asOfYmd));
  assert.ok(ds.meta.session_dates.includes(exDate));
  assert.ok(ds.meta.session_dates.includes(availYmd));
  const asOf = `${asOfYmd}T15:30:00+05:30`;
  const cas = [
    {
      action_id: "CA-LATE-KNOW",
      type: "bonus",
      ex_date: exDate,
      factor: 0.5,
      available_at: `${availYmd}T15:30:00+05:30`,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "test",
      source_version: 1,
    },
  ];

  const bars = ds.securities.RELIANCE.bars;
  const withCa = researchAdjustedClose(bars, cas, asOf, asOfYmd, ds.calendar);
  const without = researchAdjustedClose(bars, [], asOf, asOfYmd, ds.calendar);
  assert.equal(withCa.length, without.length);
  for (let i = 0; i < withCa.length; i++) {
    assert.equal(withCa[i].adjusted_close, without[i].adjusted_close);
  }
  const adjusting = listAdjustingCorporateActions(
    cas,
    asOf,
    asOfYmd,
    ds.calendar,
  );
  assert.equal(adjusting.length, 0);
});

test("future ex_date not applied (SYN_FUTURE_BONUS pattern)", () => {
  const store = createPitStore(base);
  const asOfYmd = "2024-05-20";
  assert.ok(base.meta.session_dates.includes(asOfYmd));
  const asOf = store.calendar.sessionClose(asOfYmd);
  const bundle = base.securities.SYN_FUTURE_BONUS;
  const adjusting = listAdjustingCorporateActions(
    bundle.corporate_actions,
    asOf,
    asOfYmd,
    store.calendar,
  );
  assert.equal(adjusting.length, 0);
  const series = researchAdjustedClose(
    bundle.bars,
    bundle.corporate_actions,
    asOf,
    asOfYmd,
    store.calendar,
  );
  const last = series[series.length - 1];
  const raw = bundle.bars.find((b) => b.trading_date === last.trading_date);
  assert.equal(last.adjusted_close, raw.close);
});

test("UNSUPPORTED_CA fails loud when visible; not silent", () => {
  const store = createPitStore(base);
  const asOfYmd = base.meta.as_of_default_session;
  const asOf = store.calendar.sessionClose(asOfYmd);
  assert.throws(
    () => store.loadAsOf("SYN_UNSUPPORTED_CA", asOf),
    (e) => e.code === "UNSUPPORTED_CORPORATE_ACTION",
  );
  const result = validatePitStore(base, { profile: "research_fixture" });
  assert.equal(result.ok, true);
  assert.ok(!hasCode(result, PitValidationCode.UNSUPPORTED_CA_SILENT));
});

test("B1: loadAsOf never leaks future available_at (bars, benchmarks, stmts, events, CAs)", () => {
  const store = createPitStore(base);
  const asOfYmd = base.meta.as_of_default_session;
  const asOf = store.calendar.sessionClose(asOfYmd);
  for (const id of ["RELIANCE", "HDFCBANK", "INFY"]) {
    const loaded = store.loadAsOf(id, asOf);
    for (const b of loaded.marketInput.bars) {
      assert.ok(b.available_at <= asOf);
    }
    for (const b of loaded.marketInput.benchmark_bars) {
      assert.ok(b.available_at <= asOf);
    }
    for (const s of loaded.fundamentalInput.statements) {
      assert.ok(s.available_at <= asOf);
    }
    for (const e of loaded.eventInput.events) {
      assert.ok(e.available_at <= asOf);
    }
    for (const c of loaded.marketInput.corporate_actions) {
      assert.ok(c.available_at <= asOf);
    }
  }
});

test("deriveAsOfProbes prefers default + nearby CA boundaries (not earliest-fill)", () => {
  const probes = deriveAsOfProbes(base);
  assert.ok(probes.length <= 12);
  assert.equal(probes[0], `${base.meta.as_of_default_session}T15:30:00+05:30`);
  // SYN_BONUS ex_date 2025-06-03 must be in the capped set (was dropped by earliest-fill)
  assert.ok(
    probes.some((p) => p.startsWith("2025-06-03")),
    `expected 2025-06-03 boundary in probes, got:\n${probes.join("\n")}`,
  );
  // Must not be dominated solely by 2024-04 earliest statement boundaries
  const early2024 = probes.filter((p) => p.startsWith("2024-04")).length;
  assert.ok(early2024 < probes.length - 1);
});

test("SECURITY_ID_MISMATCH: folder key !== security.security_id", () => {
  const ds = cloneDataset(base);
  ds.securities.RELIANCE.security.security_id = "NOT_RELIANCE";
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.SECURITY_ID_MISMATCH));
});

test("AMBIGUOUS_REVISION: events same event_id + same revision key", () => {
  const ds = cloneDataset(base);
  const events = ds.securities.RELIANCE.events;
  assert.ok(events.length);
  const ev = events[0];
  events.push({
    ...ev,
    // force conflict at same revision key
    source: (ev.source || "fixture") + "-dup",
  });
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    includeAsOfProbes: false,
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.AMBIGUOUS_REVISION));
});

test("validator emits PIT_FUTURE_AVAILABLE_AT_LEAK when loadAsOf leaks", () => {
  const ds = cloneDataset(base);
  const asOf = `${ds.meta.as_of_default_session}T15:30:00+05:30`;
  const realStore = createPitStore(ds);
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    asOfSamples: [asOf],
    asOfProbeLimit: 1,
    createStore: () => ({
      listSecurityIds: () => ["RELIANCE"],
      loadAsOf: (id, a) => {
        const loaded = realStore.loadAsOf(id, a);
        return {
          ...loaded,
          marketInput: {
            ...loaded.marketInput,
            bars: [
              ...loaded.marketInput.bars,
              {
                trading_date: ds.meta.as_of_default_session,
                available_at: "2099-01-01T15:30:00+05:30",
              },
            ],
          },
        };
      },
    }),
    // avoid unsupported / adjust noise
    listAdjusting: () => [],
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.PIT_FUTURE_AVAILABLE_AT_LEAK));
});

test("validator emits FUTURE_EX_DATE_APPLIED when adjusting list is corrupt", () => {
  const ds = cloneDataset(base);
  const asOf = `${ds.meta.as_of_default_session}T15:30:00+05:30`;
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    asOfSamples: [asOf],
    asOfProbeLimit: 1,
    createStore: () => {
      const s = createPitStore(ds);
      return {
        listSecurityIds: () => ["RELIANCE"],
        loadAsOf: (id, a) => s.loadAsOf(id, a),
      };
    },
    listAdjusting: () => [
      {
        action_id: "BAD-FUTURE-EX",
        type: "bonus",
        factor: 0.5,
        ex_date: "2099-01-01",
        available_at: "2020-01-02T15:30:00+05:30",
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.FUTURE_EX_DATE_APPLIED));
});

test("validator emits FUTURE_AVAILABLE_AT_APPLIED when adjusting list is corrupt", () => {
  const ds = cloneDataset(base);
  const asOfYmd = ds.meta.as_of_default_session;
  const asOf = `${asOfYmd}T15:30:00+05:30`;
  const result = validatePitStore(ds, {
    profile: "research_fixture",
    asOfSamples: [asOf],
    asOfProbeLimit: 1,
    createStore: () => {
      const s = createPitStore(ds);
      return {
        listSecurityIds: () => ["RELIANCE"],
        loadAsOf: (id, a) => s.loadAsOf(id, a),
      };
    },
    listAdjusting: () => [
      {
        action_id: "BAD-FUTURE-AVAIL",
        type: "bonus",
        factor: 0.5,
        ex_date: asOfYmd,
        available_at: "2099-01-01T15:30:00+05:30",
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, PitValidationCode.FUTURE_AVAILABLE_AT_APPLIED));
});

test("CA revision adjusting path: after ex, T1 uses 2.0 and T2 uses 1.5", () => {
  const ds = cloneDataset(base);
  const exDate = "2025-06-03";
  const t1Ymd = "2025-06-04"; // after ex, before T2 revision
  const t2Ymd = "2025-06-10";
  assert.ok(ds.meta.session_dates.includes(t1Ymd));
  assert.ok(ds.meta.session_dates.includes(t2Ymd));
  ds.securities.RELIANCE.corporate_actions = [
    {
      action_id: "CA123",
      type: "bonus",
      ex_date: exDate,
      factor: 2.0,
      available_at: "2025-06-02T15:30:00+05:30",
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "test",
      source_version: 1,
    },
    {
      action_id: "CA123",
      type: "bonus",
      ex_date: exDate,
      factor: 1.5,
      available_at: `${t2Ymd}T15:30:00+05:30`,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "test",
      source_version: 2,
    },
  ];
  const t1 = `${t1Ymd}T15:30:00+05:30`;
  const t2 = `${t2Ymd}T15:30:00+05:30`;
  const adj1 = listAdjustingCorporateActions(
    ds.securities.RELIANCE.corporate_actions,
    t1,
    t1Ymd,
    ds.calendar,
  );
  const adj2 = listAdjustingCorporateActions(
    ds.securities.RELIANCE.corporate_actions,
    t2,
    t2Ymd,
    ds.calendar,
  );
  assert.equal(adj1.length, 1);
  assert.equal(adj1[0].factor, 2.0);
  assert.equal(adj2.length, 1);
  assert.equal(adj2[0].factor, 1.5);
});
