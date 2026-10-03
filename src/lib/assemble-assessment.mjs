import { computeSufficiency } from "./evidence-sufficiency.mjs";

const TRADE_VERBS =
  /\b(initiate|buy|sell|hold|wait|avoid|reduce|exit|do not open|do not add)\b/i;

/**
 * Assessment synthesizes factual implications only — never trading advice.
 */
export function assembleAssessment({
  context,
  security,
  quality,
  market,
  events,
}) {
  const { sufficiency, evidence_status, reasons } = computeSufficiency({
    quality,
    market,
    events,
  });

  const why = [];
  for (const m of quality.metrics || []) {
    if (m.label === "UNAVAILABLE") {
      why.push(`${m.metric}: UNAVAILABLE (${m.reason || "missing inputs"})`);
    } else {
      why.push(
        `${m.metric}: ${typeof m.value === "number" ? m.value.toFixed(4) : JSON.stringify(m.value)} classified ${m.label} per quality-label-spec`,
      );
    }
  }
  for (const m of market.metrics || []) {
    if (m.label === "UNAVAILABLE") {
      why.push(`${m.metric}: UNAVAILABLE`);
    } else {
      why.push(`${m.metric}: classified ${m.label} (tape window ${market.window})`);
    }
  }
  for (const r of events.reasons || []) {
    why.push(`Events: ${r}`);
  }

  const what_would_change_assessment = [];
  for (const m of quality.metrics || []) {
    if (m.metric === "debt_to_equity" && m.label !== "UNAVAILABLE") {
      what_would_change_assessment.push(
        "Leverage label would change if debt/equity crossed 0.5 / 1.0 / 2.0 per quality-label-spec",
      );
    }
    if ((m.metric === "revenue_yoy" || m.metric === "pat_yoy") && m.label !== "UNAVAILABLE") {
      what_would_change_assessment.push(
        `${m.metric} label would change if YoY crossed −10 / 0 / 10 percentage points`,
      );
    }
  }
  if (market.window !== "SUPPORTIVE") {
    what_would_change_assessment.push(
      "Market tape aggregate would change if required metrics' SUPPORTIVE/MIXED/HOSTILE labels changed per market-label-spec",
    );
  }
  if (events.timing === "UNFAVORABLE") {
    what_would_change_assessment.push(
      "Timing label would change if next known event moved beyond 5 trading sessions",
    );
  } else if (events.timing === "CLEAR") {
    what_would_change_assessment.push(
      "Timing becomes UNFAVORABLE if a known earnings/ex-date enters 5 trading sessions",
    );
  } else {
    what_would_change_assessment.push(
      "Timing remains UNKNOWN until an event calendar is PIT-visible",
    );
  }

  for (const line of [...why, ...what_would_change_assessment]) {
    if (TRADE_VERBS.test(line)) {
      throw new Error(`Assessment must not contain trading verbs: ${line}`);
    }
  }

  const evidence = {
    status: evidence_status,
    quality,
    market,
    events,
    sufficiency_reasons: reasons,
  };

  const assessment = {
    sufficiency,
    why,
    what_would_change_assessment,
    nifty50_price_index_comparison: market.nifty50_price_index_comparison,
    tape_window: market.window,
    event_timing: events.timing,
    red_flag_present: quality.red_flag_present,
  };

  return {
    context,
    security: {
      security_id: security.security_id,
      nse_symbol: security.nse_symbol,
      name: security.name,
    },
    evidence,
    assessment,
  };
}
