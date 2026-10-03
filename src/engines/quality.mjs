import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC = JSON.parse(
  readFileSync(join(__dirname, "../../config/quality-label-spec.json"), "utf8"),
);

function priorYearPeriodId(fiscalPeriodId) {
  // Expect forms like FY26-Q1 or 2025-Q1
  const m = fiscalPeriodId.match(/^(.*?)(\d{2,4})(.*)$/);
  if (!m) return null;
  const yearNum = Number(m[2]);
  const prior =
    m[2].length === 2
      ? String(yearNum - 1).padStart(2, "0")
      : String(yearNum - 1);
  return `${m[1]}${prior}${m[3]}`;
}

export function classifyYoy(value) {
  // Stabilize float edges (e.g. 110/100 → 10.0000000002)
  const v = Math.round(value * 1e9) / 1e9;
  if (v < -10) return "RED_FLAG";
  if (v >= -10 && v < 0) return "WARNING";
  if (v >= 0 && v <= 10) return "NEUTRAL";
  if (v > 10) return "GOOD";
  return "UNAVAILABLE";
}

export function classifyDebtEquity(de) {
  if (de < 0.5) return "GOOD";
  if (de <= 1.0) return "NEUTRAL";
  if (de <= 2.0) return "WARNING";
  return "RED_FLAG";
}

export function classifyCfoPat(cfo, pat) {
  if (pat > 0) {
    if (cfo < 0) return "RED_FLAG";
    const r = cfo / pat;
    if (r >= 0.8) return "GOOD";
    if (r >= 0.5) return "NEUTRAL";
    if (r >= 0) return "WARNING";
    return "RED_FLAG";
  }
  if (cfo <= 0) return "RED_FLAG";
  return "WARNING";
}

function metricBase(metric, extra) {
  return {
    metric,
    ...extra,
    calculation: `${metric}_v1`,
  };
}

/**
 * @param {{ statements: object[] }} fundamentalInput
 * @param {object} context
 */
export function runQualityEngine(fundamentalInput, context) {
  if (fundamentalInput.position !== undefined) {
    throw new Error("Quality engine must not receive position");
  }
  const statements = fundamentalInput.statements || [];
  const metrics = [];
  const coverage_reasons = [];
  let coverage_status = "OK";

  const income = statements.filter((s) => s.statement_type === "income_statement");
  const cash = statements.filter((s) => s.statement_type === "cash_flow");
  const balance = statements.filter((s) => s.statement_type === "balance_sheet");

  // Latest income by period_end then available_at
  const sortedIncome = [...income].sort((a, b) => {
    if (a.period_end !== b.period_end) return a.period_end < b.period_end ? 1 : -1;
    return a.available_at < b.available_at ? 1 : -1;
  });
  const latestIncome = sortedIncome[0] || null;

  for (const metricName of ["revenue_yoy", "pat_yoy"]) {
    const field = metricName === "revenue_yoy" ? "revenue" : "pat";
    if (!latestIncome) {
      metrics.push(
        metricBase(metricName, {
          value: null,
          label: "UNAVAILABLE",
          reason: "No income statement visible at as_of",
        }),
      );
      coverage_status = "INCOMPLETE";
      coverage_reasons.push(`${metricName}: no income statement`);
      continue;
    }
    const priorId = priorYearPeriodId(latestIncome.fiscal_period_id);
    const prior = income.find(
      (s) =>
        s.fiscal_period_id === priorId &&
        s.fiscal_period_duration === latestIncome.fiscal_period_duration &&
        s.statement_type === latestIncome.statement_type &&
        s.consolidation === latestIncome.consolidation &&
        s.currency === latestIncome.currency &&
        s.unit === latestIncome.unit,
    );
    if (!prior) {
      // Check sequential trap: two prints different duration
      metrics.push(
        metricBase(metricName, {
          value: null,
          label: "UNAVAILABLE",
          reason: "No same-duration YoY comparator PIT-visible",
          period_end: latestIncome.period_end,
          available_at: latestIncome.available_at,
          source: latestIncome.source,
        }),
      );
      coverage_status = "INCOMPLETE";
      continue;
    }
    const oldV = prior[field];
    const newV = latestIncome[field];
    if (oldV == null || newV == null || !(oldV > 0)) {
      metrics.push(
        metricBase(metricName, {
          value: null,
          label: "UNAVAILABLE",
          reason:
            oldV != null && !(oldV > 0)
              ? "Comparator must be > 0"
              : "Missing values",
          period_end: latestIncome.period_end,
          available_at: latestIncome.available_at,
          source: latestIncome.source,
          source_timestamp_type: latestIncome.source_timestamp_type,
        }),
      );
      continue;
    }
    const yoy = ((newV / oldV) - 1) * 100;
    metrics.push(
      metricBase(metricName, {
        value: yoy,
        label: classifyYoy(yoy),
        period_end: latestIncome.period_end,
        available_at: latestIncome.available_at,
        source: latestIncome.source,
        source_timestamp_type: latestIncome.source_timestamp_type,
        source_version: latestIncome.source_version,
      }),
    );
  }

  // Debt/equity — same BS snapshot
  const sortedBs = [...balance].sort((a, b) => {
    if (a.period_end !== b.period_end) return a.period_end < b.period_end ? 1 : -1;
    return a.available_at < b.available_at ? 1 : -1;
  });
  const latestBs = sortedBs[0];
  if (!latestBs || latestBs.total_debt == null || latestBs.equity == null) {
    metrics.push(
      metricBase("debt_to_equity", {
        value: null,
        label: "UNAVAILABLE",
        reason: "Missing balance sheet debt/equity",
      }),
    );
    coverage_status = "INCOMPLETE";
  } else if (!(latestBs.equity > 0)) {
    metrics.push(
      metricBase("debt_to_equity", {
        value: null,
        label: "RED_FLAG",
        reason: "Equity <= 0",
        period_end: latestBs.period_end,
        available_at: latestBs.available_at,
        source: latestBs.source,
        source_timestamp_type: latestBs.source_timestamp_type,
        source_version: latestBs.source_version,
      }),
    );
  } else {
    const de = latestBs.total_debt / latestBs.equity;
    metrics.push(
      metricBase("debt_to_equity", {
        value: de,
        label: classifyDebtEquity(de),
        period_end: latestBs.period_end,
        available_at: latestBs.available_at,
        source: latestBs.source,
        source_timestamp_type: latestBs.source_timestamp_type,
        source_version: latestBs.source_version,
      }),
    );
  }

  // CFO/PAT same period
  if (!latestIncome || latestIncome.pat == null) {
    metrics.push(
      metricBase("cfo_to_pat", {
        value: null,
        label: "UNAVAILABLE",
        reason: "Missing PAT",
      }),
    );
    coverage_status = "INCOMPLETE";
  } else {
    const sameCf = cash.find(
      (s) =>
        s.fiscal_period_id === latestIncome.fiscal_period_id &&
        s.fiscal_period_duration === latestIncome.fiscal_period_duration &&
        s.consolidation === latestIncome.consolidation &&
        s.currency === latestIncome.currency &&
        s.unit === latestIncome.unit,
    );
    if (!sameCf || sameCf.cfo == null) {
      metrics.push(
        metricBase("cfo_to_pat", {
          value: null,
          label: "UNAVAILABLE",
          reason: "No same-period CFO",
        }),
      );
      coverage_status = "INCOMPLETE";
    } else {
      const ratio =
        latestIncome.pat > 0 ? sameCf.cfo / latestIncome.pat : null;
      metrics.push(
        metricBase("cfo_to_pat", {
          value: ratio,
          label: classifyCfoPat(sameCf.cfo, latestIncome.pat),
          period_end: latestIncome.period_end,
          available_at: latestIncome.available_at,
          source: sameCf.source,
          source_timestamp_type: sameCf.source_timestamp_type,
          source_version: sameCf.source_version,
        }),
      );
    }
  }

  const red_flag_present = metrics.some((m) => m.label === "RED_FLAG");

  return {
    engine: "quality",
    metrics,
    red_flag_present,
    coverage_status,
    coverage_reasons,
    context_as_of: context.as_of,
    context_data_version: context.data_version,
  };
}

export { SPEC as qualitySpec };
