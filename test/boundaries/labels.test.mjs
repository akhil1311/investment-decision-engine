import { test } from "node:test";
import assert from "node:assert/strict";
import { runQualityEngine } from "../../src/engines/quality.mjs";
import { runMarketEngine } from "../../src/engines/market.mjs";
import { runEventEngine } from "../../src/engines/events.mjs";
import { createSessionCalendar } from "../../src/lib/session-calendar.mjs";

const ctx = {
  as_of: "2025-07-14T15:30:00+05:30",
  timezone: "Asia/Kolkata",
  security_id: "SYN",
  horizon: { unit: "trading_days", min: 5, max: 20 },
  data_version: "test",
};

function incomePair(priorPat, newPat, priorRev = 1000, newRev = 1100) {
  return [
    {
      statement_id: "p",
      period_end: "2024-06-30",
      reported_at: "2024-07-20T15:30:00+05:30",
      available_at: "2024-07-20T15:30:00+05:30",
      source_version: 1,
      fiscal_period_id: "FY25-Q1",
      fiscal_period_duration: "Q1",
      statement_type: "income_statement",
      consolidation: "consolidated",
      currency: "INR",
      unit: "INR_crore",
      revenue: priorRev,
      pat: priorPat,
      source_timestamp_type: "derived",
      source: "boundary",
    },
    {
      statement_id: "n",
      period_end: "2025-06-30",
      reported_at: "2025-07-18T15:30:00+05:30",
      available_at: "2025-07-18T15:30:00+05:30",
      source_version: 1,
      fiscal_period_id: "FY26-Q1",
      fiscal_period_duration: "Q1",
      statement_type: "income_statement",
      consolidation: "consolidated",
      currency: "INR",
      unit: "INR_crore",
      revenue: newRev,
      pat: newPat,
      source_timestamp_type: "derived",
      source: "boundary",
    },
  ];
}

test("debt_to_equity boundaries", () => {
  const cases = [
    [0.4999, "GOOD"],
    [0.5, "NEUTRAL"],
    [0.5001, "NEUTRAL"],
    [0.9999, "NEUTRAL"],
    [1.0, "NEUTRAL"],
    [1.0001, "WARNING"],
    [1.9999, "WARNING"],
    [2.0, "WARNING"],
    [2.0001, "RED_FLAG"],
  ];
  for (const [de, label] of cases) {
    const q = runQualityEngine(
      {
        statements: [
          {
            statement_id: "bs",
            period_end: "2025-06-30",
            reported_at: "2025-07-18T15:30:00+05:30",
            available_at: "2025-07-18T15:30:00+05:30",
            source_version: 1,
            fiscal_period_id: "FY26-Q1",
            fiscal_period_duration: "Q1",
            statement_type: "balance_sheet",
            consolidation: "consolidated",
            currency: "INR",
            unit: "INR_crore",
            total_debt: de,
            equity: 1,
            source_timestamp_type: "derived",
            source: "boundary",
          },
        ],
      },
      ctx,
    );
    const m = q.metrics.find((x) => x.metric === "debt_to_equity");
    assert.equal(m.label, label, `D/E ${de}`);
  }
});

test("PAT/revenue YoY comparator <= 0 is UNAVAILABLE", () => {
  for (const priorPat of [0, -100]) {
    const q = runQualityEngine({ statements: incomePair(priorPat, 100) }, ctx);
    assert.equal(
      q.metrics.find((m) => m.metric === "pat_yoy").label,
      "UNAVAILABLE",
    );
  }
  const q = runQualityEngine({ statements: incomePair(100, 110, 0, 100) }, ctx);
  assert.equal(
    q.metrics.find((m) => m.metric === "revenue_yoy").label,
    "UNAVAILABLE",
  );
});

test("YoY thresholds -10 / 0 / 10", () => {
  const cases = [
    [100, 89, "RED_FLAG"], // -11%
    [100, 90, "WARNING"], // -10%
    [100, 100, "NEUTRAL"],
    [100, 110, "NEUTRAL"],
    [100, 111, "GOOD"],
  ];
  for (const [oldV, newV, label] of cases) {
    const q = runQualityEngine(
      { statements: incomePair(oldV, newV, oldV, newV) },
      ctx,
    );
    assert.equal(
      q.metrics.find((m) => m.metric === "pat_yoy").label,
      label,
      `${oldV}->${newV}`,
    );
  }
});

test("Q1 vs H1 same FY is UNAVAILABLE for YoY", () => {
  const stmts = [
    ...incomePair(100, 110),
    {
      statement_id: "h1",
      period_end: "2025-09-30",
      reported_at: "2025-10-20T15:30:00+05:30",
      available_at: "2025-10-20T15:30:00+05:30",
      source_version: 1,
      fiscal_period_id: "FY26-H1",
      fiscal_period_duration: "H1",
      statement_type: "income_statement",
      consolidation: "consolidated",
      currency: "INR",
      unit: "INR_crore",
      revenue: 2000,
      pat: 200,
      source_timestamp_type: "derived",
      source: "boundary",
    },
  ];
  const q = runQualityEngine({ statements: stmts }, ctx);
  // Latest by period_end is H1 — no prior H1
  assert.equal(q.metrics.find((m) => m.metric === "pat_yoy").label, "UNAVAILABLE");
});

test("RS and liquidity boundaries via controlled closes", () => {
  const make = (stock20RetPct, nifty20RetPct, liq) => {
    const n = 61;
    const stockStart = 100;
    const stockEnd = stockStart * (1 + stock20RetPct / 100);
    const niftyStart = 1000;
    const niftyEnd = niftyStart * (1 + nifty20RetPct / 100);
    const adjusted = [];
    const benchmark_bars = [];
    const traded_values = [];
    for (let i = 0; i < n; i++) {
      const s =
        i <= 40
          ? stockStart
          : stockStart + ((stockEnd - stockStart) * (i - 40)) / 20;
      const b =
        i <= 40
          ? niftyStart
          : niftyStart + ((niftyEnd - niftyStart) * (i - 40)) / 20;
      adjusted.push({ trading_date: `d${i}`, adjusted_close: s, raw_close: s });
      benchmark_bars.push({ trading_date: `d${i}`, close: b });
      traded_values.push({ trading_date: `d${i}`, value_inr: liq });
    }
    // Exact endpoints
    adjusted[40].adjusted_close = stockStart;
    adjusted[60].adjusted_close = stockEnd;
    benchmark_bars[40].close = niftyStart;
    benchmark_bars[60].close = niftyEnd;
    return runMarketEngine(
      { adjusted, benchmark_bars, traded_values, bars: [], corporate_actions: [] },
      ctx,
    );
  };

  assert.equal(make(4, 2, 5e8).metrics.find((m) => m.metric === "rs_20d").label, "MIXED");
  assert.equal(
    make(5.0001, 2, 5e8).metrics.find((m) => m.metric === "rs_20d").label,
    "SUPPORTIVE",
  );
  assert.equal(
    make(0, 0, 1e8).metrics.find((m) => m.metric === "liquidity_20d").label,
    "MIXED",
  );
  assert.equal(
    make(0, 0, 5e8).metrics.find((m) => m.metric === "liquidity_20d").label,
    "SUPPORTIVE",
  );
});

test("event distance Friday to Monday = 1; exactly 5 UNFAVORABLE", () => {
  // Build a tiny calendar: Fri, Mon, Tue, Wed, Thu, Fri, Mon...
  const sessions = [
    "2025-06-06", // Fri
    "2025-06-09", // Mon
    "2025-06-10",
    "2025-06-11",
    "2025-06-12",
    "2025-06-13",
    "2025-06-16",
    "2025-06-17",
  ];
  const cal = createSessionCalendar(sessions);
  assert.equal(cal.sessionDistance("2025-06-06", "2025-06-09"), 1);
  assert.equal(cal.sessionDistance("2025-06-06", "2025-06-10"), 2);

  const asOf = "2025-06-06T15:30:00+05:30";
  const context = { ...ctx, as_of: asOf };
  const e5 = runEventEngine(
    {
      events: [
        {
          event_id: "e",
          type: "earnings",
          event_date: "2025-06-13",
          available_at: "2025-06-01T15:30:00+05:30",
          source_version: 1,
          source_timestamp_type: "derived",
        },
      ],
    },
    context,
    cal,
  );
  assert.equal(e5.upcoming.distance, 5);
  assert.equal(e5.timing, "UNFAVORABLE");

  const e6 = runEventEngine(
    {
      events: [
        {
          event_id: "e",
          type: "earnings",
          event_date: "2025-06-16",
          available_at: "2025-06-01T15:30:00+05:30",
          source_version: 1,
          source_timestamp_type: "derived",
        },
      ],
    },
    context,
    cal,
  );
  assert.equal(e6.upcoming.distance, 6);
  assert.equal(e6.timing, "CLEAR");
});

test("event known only after available_at", () => {
  const sessions = ["2025-06-02", "2025-06-03", "2025-06-04", "2025-06-05", "2025-06-06"];
  const cal = createSessionCalendar(sessions);
  // PIT filter already applied: empty events before announcement
  const earlyFiltered = runEventEngine(
    { events: [] },
    { ...ctx, as_of: "2025-06-03T15:30:00+05:30" },
    cal,
  );
  assert.equal(earlyFiltered.timing, "UNKNOWN");
  assert.equal(earlyFiltered.coverage_status, "INCOMPLETE");
});
