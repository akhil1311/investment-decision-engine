/**
 * Generate V1 research fixtures — synthetic, not tuned for pretty labels.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../data/fixtures");

function eod(ymd) {
  return `${ymd}T15:30:00+05:30`;
}

/** Weekday sessions from startYmd for count days (skip Sat/Sun). */
function buildSessions(startYmd, count) {
  const out = [];
  let [y, m, d] = startYmd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  while (out.length < count) {
    const day = dt.getUTCDay();
    if (day !== 0 && day !== 6) {
      const ymd = dt.toISOString().slice(0, 10);
      out.push(ymd);
    }
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
  return out;
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

// Enough sessions to cover SMA50/drawdown60 and statement available_at dates.
const SESSIONS = buildSessions("2024-01-02", 400);
const AS_OF = SESSIONS[SESSIONS.length - 1]; // last session

const UNIVERSE = [
  ["RELIANCE", "INE002A01018", "Reliance Industries Limited"],
  ["HDFCBANK", "INE040A01034", "HDFC Bank Limited"],
  ["INFY", "INE009A01021", "Infosys Limited"],
  ["ITC", "INE154A01025", "ITC Limited"],
  ["SUNPHARMA", "INE044A01036", "Sun Pharmaceutical Industries Limited"],
  ["LT", "INE018A01030", "Larsen & Toubro Limited"],
  ["TCS", "INE467B01029", "Tata Consultancy Services Limited"],
  ["ONGC", "INE213A01029", "Oil and Natural Gas Corporation Limited"],
];

function makeBars(sessions, basePrice, opts = {}) {
  const { truncate, bonusExIdx, postBonusHalf } = opts;
  const use = truncate != null ? sessions.slice(0, truncate) : sessions;
  const bars = [];
  let px = basePrice;
  for (let i = 0; i < use.length; i++) {
    const ymd = use[i];
    // mild drift + noise
    px = px * (1 + 0.0005 + ((i % 7) - 3) * 0.001);
    let close = Math.round(px * 100) / 100;
    if (bonusExIdx != null && i >= bonusExIdx && postBonusHalf) {
      close = Math.round((close / 2) * 100) / 100;
    }
    const volume = 1_000_000 + (i % 10) * 50_000;
    bars.push({
      trading_date: ymd,
      open: close,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume,
      turnover: close * volume,
      currency: "INR",
      available_at: eod(ymd),
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
    });
  }
  return bars;
}

function makeBenchmark(sessions) {
  let px = 22000;
  return sessions.map((ymd, i) => {
    px = px * (1 + 0.0003 + ((i % 5) - 2) * 0.0004);
    return {
      benchmark_id: "NIFTY50_PRICE_INDEX",
      trading_date: ymd,
      close: Math.round(px * 100) / 100,
      available_at: eod(ymd),
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
    };
  });
}

function statementsFor(id, opts = {}) {
  const {
    priorPat = 100,
    newPat = 110,
    priorRev = 1000,
    newRev = 1080,
    includeH1Trap = false,
    revision = false,
  } = opts;
  // Statement available_at must fall on/before AS_OF within the session calendar.
  const priorAvail = SESSIONS[80];
  const latestAvail = SESSIONS[200];
  const revisionAvail = SESSIONS[220];
  const h1Avail = SESSIONS[250];
  const list = [
    {
      statement_id: `${id}-inc-fy25-q1-v1`,
      period_end: priorAvail,
      reported_at: eod(priorAvail),
      available_at: eod(priorAvail),
      source_version: 1,
      fiscal_period_id: "FY25-Q1",
      fiscal_period_duration: "Q1",
      statement_type: "income_statement",
      consolidation: "consolidated",
      currency: "INR",
      unit: "INR_crore",
      revenue: priorRev,
      pat: priorPat,
      cfo: null,
      total_debt: null,
      equity: null,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
    },
    {
      statement_id: `${id}-inc-fy26-q1-v1`,
      period_end: latestAvail,
      reported_at: eod(latestAvail),
      available_at: eod(latestAvail),
      source_version: 1,
      fiscal_period_id: "FY26-Q1",
      fiscal_period_duration: "Q1",
      statement_type: "income_statement",
      consolidation: "consolidated",
      currency: "INR",
      unit: "INR_crore",
      revenue: newRev,
      pat: newPat,
      cfo: null,
      total_debt: null,
      equity: null,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
    },
    {
      statement_id: `${id}-cf-fy26-q1-v1`,
      period_end: latestAvail,
      reported_at: eod(latestAvail),
      available_at: eod(latestAvail),
      source_version: 1,
      fiscal_period_id: "FY26-Q1",
      fiscal_period_duration: "Q1",
      statement_type: "cash_flow",
      consolidation: "consolidated",
      currency: "INR",
      unit: "INR_crore",
      revenue: null,
      pat: null,
      cfo: newPat * 0.9,
      total_debt: null,
      equity: null,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
    },
    {
      statement_id: `${id}-bs-fy26-q1-v1`,
      period_end: latestAvail,
      reported_at: eod(latestAvail),
      available_at: eod(latestAvail),
      source_version: 1,
      fiscal_period_id: "FY26-Q1",
      fiscal_period_duration: "Q1",
      statement_type: "balance_sheet",
      consolidation: "consolidated",
      currency: "INR",
      unit: "INR_crore",
      revenue: null,
      pat: null,
      cfo: null,
      total_debt: 40,
      equity: 100,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
    },
  ];
  if (includeH1Trap) {
    list.push({
      statement_id: `${id}-inc-fy26-h1-v1`,
      period_end: h1Avail,
      reported_at: eod(h1Avail),
      available_at: eod(h1Avail),
      source_version: 1,
      fiscal_period_id: "FY26-H1",
      fiscal_period_duration: "H1",
      statement_type: "income_statement",
      consolidation: "consolidated",
      currency: "INR",
      unit: "INR_crore",
      revenue: 2000,
      pat: 200,
      cfo: null,
      total_debt: null,
      equity: null,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
    });
  }
  if (revision) {
    list.push({
      statement_id: `${id}-inc-fy26-q1-v2`,
      period_end: latestAvail,
      reported_at: eod(revisionAvail),
      available_at: eod(revisionAvail),
      source_version: 2,
      fiscal_period_id: "FY26-Q1",
      fiscal_period_duration: "Q1",
      statement_type: "income_statement",
      consolidation: "consolidated",
      currency: "INR",
      unit: "INR_crore",
      revenue: newRev + 50,
      pat: newPat + 5,
      cfo: null,
      total_debt: null,
      equity: null,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
    });
  }
  return list;
}

// --- write dataset ---
writeJson(join(ROOT, "dataset.json"), {
  fixture_version: "fixtures-v1.0.0",
  role: "research_fixture",
  as_of_default_session: AS_OF,
  session_dates: SESSIONS,
  security_ids: [
    ...UNIVERSE.map((u) => u[0]),
    "SYN_SHORT20",
    "SYN_SHORT59",
    "SYN_BONUS",
    "SYN_FUTURE_BONUS",
    "SYN_UNSUPPORTED_CA",
  ],
});

writeJson(join(ROOT, "benchmark/nifty50.json"), makeBenchmark(SESSIONS));

for (const [id, isin, name] of UNIVERSE) {
  const dir = join(ROOT, "securities", id);
  writeJson(join(dir, "security.json"), {
    security_id: id,
    nse_symbol: id,
    isin,
    name,
  });
  const base =
    id === "RELIANCE"
      ? 2800
      : id === "INFY"
        ? 1500
        : id === "TCS"
          ? 3600
          : 800 + id.length * 37;
  writeJson(join(dir, "bars.json"), makeBars(SESSIONS, base));
  writeJson(join(dir, "corporate_actions.json"), []);
  writeJson(
    join(dir, "statements.json"),
    statementsFor(id, {
      revision: id === "RELIANCE",
      includeH1Trap: id === "ONGC",
    }),
  );
  // Earnings: announced before last session, event a few sessions ahead
  const announce = SESSIONS[SESSIONS.length - 10];
  const earnDate = SESSIONS[SESSIONS.length - 3];
  writeJson(join(dir, "events.json"), [
    {
      event_id: `${id}-earn-1`,
      type: "earnings",
      event_date: earnDate,
      available_at: eod(announce),
      source_version: 1,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
    },
  ]);
}

// SYN_SHORT20 — 20 closes only
{
  const id = "SYN_SHORT20";
  const dir = join(ROOT, "securities", id);
  writeJson(join(dir, "security.json"), {
    security_id: id,
    nse_symbol: id,
    isin: "SYN000000020",
    name: "Synthetic Short 20",
  });
  writeJson(join(dir, "bars.json"), makeBars(SESSIONS, 100, { truncate: 20 }));
  writeJson(join(dir, "corporate_actions.json"), []);
  writeJson(join(dir, "statements.json"), []);
  writeJson(join(dir, "events.json"), []);
}

// SYN_SHORT59
{
  const id = "SYN_SHORT59";
  const dir = join(ROOT, "securities", id);
  writeJson(join(dir, "security.json"), {
    security_id: id,
    nse_symbol: id,
    isin: "SYN000000059",
    name: "Synthetic Short 59",
  });
  writeJson(join(dir, "bars.json"), makeBars(SESSIONS, 100, { truncate: 59 }));
  writeJson(join(dir, "corporate_actions.json"), []);
  writeJson(join(dir, "statements.json"), []);
  writeJson(join(dir, "events.json"), []);
}

// SYN_BONUS — bonus already ex mid-window
{
  const id = "SYN_BONUS";
  const dir = join(ROOT, "securities", id);
  const bonusIdx = SESSIONS.length - 30;
  const ex = SESSIONS[bonusIdx];
  writeJson(join(dir, "security.json"), {
    security_id: id,
    nse_symbol: id,
    isin: "SYN000000BON",
    name: "Synthetic Bonus Ex",
  });
  writeJson(
    join(dir, "bars.json"),
    makeBars(SESSIONS, 1000, { bonusExIdx: bonusIdx, postBonusHalf: true }),
  );
  writeJson(join(dir, "corporate_actions.json"), [
    {
      action_id: "syn-bonus-1",
      type: "bonus",
      ex_date: ex,
      factor: 0.5,
      available_at: eod(SESSIONS[bonusIdx - 5]),
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
      source_version: 1,
    },
  ]);
  writeJson(join(dir, "statements.json"), statementsFor(id));
  writeJson(join(dir, "events.json"), []);
}

// SYN_FUTURE_BONUS — announced, ex after as_of (use as_of mid and keep future)
{
  const id = "SYN_FUTURE_BONUS";
  const dir = join(ROOT, "securities", id);
  // We'll assess at SESSIONS[90]; bonus ex at SESSIONS[100], announced at 85
  writeJson(join(dir, "security.json"), {
    security_id: id,
    nse_symbol: id,
    isin: "SYN000000FUT",
    name: "Synthetic Future Bonus",
  });
  writeJson(join(dir, "bars.json"), makeBars(SESSIONS, 500));
  writeJson(join(dir, "corporate_actions.json"), [
    {
      action_id: "syn-future-bonus",
      type: "bonus",
      ex_date: SESSIONS[100],
      factor: 0.5,
      available_at: eod(SESSIONS[85]),
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
      source_version: 1,
    },
  ]);
  writeJson(join(dir, "statements.json"), statementsFor(id));
  writeJson(join(dir, "events.json"), [
    {
      event_id: "syn-future-bonus-event",
      type: "ex_date",
      event_date: SESSIONS[100],
      available_at: eod(SESSIONS[85]),
      source_version: 1,
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
    },
  ]);
}

// SYN_UNSUPPORTED_CA
{
  const id = "SYN_UNSUPPORTED_CA";
  const dir = join(ROOT, "securities", id);
  writeJson(join(dir, "security.json"), {
    security_id: id,
    nse_symbol: id,
    isin: "SYN000000UNS",
    name: "Synthetic Unsupported CA",
  });
  writeJson(join(dir, "bars.json"), makeBars(SESSIONS, 200));
  writeJson(join(dir, "corporate_actions.json"), [
    {
      action_id: "syn-rights-1",
      type: "rights",
      ex_date: SESSIONS[SESSIONS.length - 10],
      available_at: eod(SESSIONS[SESSIONS.length - 15]),
      source_timestamp_type: "derived",
      timestamp_quality: "date_only",
      source: "fixture-synthetic",
      source_version: 1,
    },
  ]);
  writeJson(join(dir, "statements.json"), []);
  writeJson(join(dir, "events.json"), []);
}

console.log("Fixtures written to", ROOT);
console.log("Default as_of session", AS_OF, "sessions", SESSIONS.length);
