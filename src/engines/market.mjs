import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC = JSON.parse(
  readFileSync(join(__dirname, "../../config/market-label-spec.json"), "utf8"),
);

function sampleStdev(values) {
  const n = values.length;
  if (n < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const varSum = values.reduce((a, b) => a + (b - mean) ** 2, 0);
  return Math.sqrt(varSum / (n - 1));
}

function pctReturn(series, n) {
  if (series.length < n + 1) return null;
  const t = series.length - 1;
  return (series[t] / series[t - n] - 1) * 100;
}

export function classifyRs(rsValue) {
  const v = Math.round(rsValue * 1e9) / 1e9;
  if (v > 2.0) return "SUPPORTIVE";
  if (v < -2.0) return "HOSTILE";
  return "MIXED";
}

export function classifyVolatility(volValue) {
  const v = Math.round(volValue * 1e9) / 1e9;
  if (v < 1.5) return "SUPPORTIVE";
  if (v <= 2.5) return "MIXED";
  return "HOSTILE";
}

export function classifyDrawdown(ddValue) {
  const v = Math.round(ddValue * 1e9) / 1e9;
  if (v > -5) return "SUPPORTIVE";
  if (v > -10) return "MIXED";
  return "HOSTILE";
}

export function classifyLiquidity(liqValue) {
  if (liqValue >= 5e8) return "SUPPORTIVE";
  if (liqValue >= 1e8) return "MIXED";
  return "HOSTILE";
}

/**
 * @param {object} marketInput
 * @param {object} context
 */
export function runMarketEngine(marketInput, context) {
  if (marketInput.position !== undefined) {
    throw new Error("Market engine must not receive position");
  }

  const adj = marketInput.adjusted || [];
  const closes = adj.map((a) => a.adjusted_close);
  const bench = marketInput.benchmark_bars || [];
  const benchCloses = bench.map((b) => b.close);
  const metrics = [];
  const coverage_reasons = [];
  let coverage_status = "OK";

  // SMA trend
  let smaLabel = "UNAVAILABLE";
  let sma20 = null;
  let sma50 = null;
  const closeT = closes.length ? closes[closes.length - 1] : null;
  if (closes.length >= 20) {
    sma20 =
      closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  }
  if (closes.length >= 50) {
    sma50 =
      closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
  }
  if (closes.length < 20) {
    smaLabel = "UNAVAILABLE";
    coverage_status = "INCOMPLETE";
    coverage_reasons.push("SMA20 unavailable: fewer than 20 closes");
  } else if (closes.length < 50) {
    coverage_status = "INCOMPLETE";
    coverage_reasons.push("SMA50 unavailable: fewer than 50 closes");
    // SMA20 only — does not vote as HOSTILE; treat as MIXED partial signal
    if (closeT > sma20) smaLabel = "MIXED";
    else if (closeT < sma20) smaLabel = "MIXED";
    else smaLabel = "MIXED";
  } else {
    if (closeT > sma20 && closeT > sma50) smaLabel = "SUPPORTIVE";
    else if (closeT < sma20 && closeT < sma50) smaLabel = "HOSTILE";
    else smaLabel = "MIXED";
  }
  metrics.push({
    metric: "sma_trend",
    value: { close: closeT, sma20, sma50 },
    label: smaLabel,
    calculation: "sma_trend_v1",
  });

  // RS 20d
  let rsLabel = "UNAVAILABLE";
  let rsValue = null;
  if (closes.length >= 21 && benchCloses.length >= 21) {
    // Align by taking last 21 of each (fixtures share calendar)
    const stockRet = pctReturn(closes, 20);
    const niftyRet = pctReturn(benchCloses, 20);
    if (stockRet != null && niftyRet != null) {
      rsValue = Math.round((stockRet - niftyRet) * 1e9) / 1e9;
      rsLabel = classifyRs(rsValue);
    }
  } else {
    coverage_status = "INCOMPLETE";
    coverage_reasons.push("RS20 unavailable: need 21 aligned closes");
  }
  metrics.push({
    metric: "rs_20d",
    value: rsValue,
    label: rsLabel,
    calculation: "rs_20d_v1",
    units: "percentage_points",
  });

  // Volatility
  let volLabel = "UNAVAILABLE";
  let volValue = null;
  if (closes.length >= 21) {
    const rets = [];
    for (let i = closes.length - 20; i < closes.length; i++) {
      rets.push((closes[i] / closes[i - 1] - 1) * 100);
    }
    volValue = Math.round(sampleStdev(rets) * 1e9) / 1e9;
    volLabel = classifyVolatility(volValue);
  } else {
    coverage_status = "INCOMPLETE";
    coverage_reasons.push("volatility unavailable: need 21 closes");
  }
  metrics.push({
    metric: "volatility_20d",
    value: volValue,
    label: volLabel,
    calculation: "volatility_20d_v1",
    units: "percentage_points",
  });

  // Drawdown
  let ddLabel = "UNAVAILABLE";
  let ddValue = null;
  if (closes.length >= 60) {
    const window = closes.slice(-60);
    const hi = Math.max(...window);
    ddValue = Math.round((closeT / hi - 1) * 100 * 1e9) / 1e9;
    ddLabel = classifyDrawdown(ddValue);
  } else {
    coverage_status = "INCOMPLETE";
    coverage_reasons.push("drawdown unavailable: need 60 closes");
  }
  metrics.push({
    metric: "drawdown_60d",
    value: ddValue,
    label: ddLabel,
    calculation: "drawdown_60d_v1",
    units: "percentage_points",
  });

  // Liquidity raw INR
  let liqLabel = "UNAVAILABLE";
  let liqValue = null;
  const tvs = (marketInput.traded_values || []).filter((t) => t.value_inr != null);
  if (tvs.length >= 20) {
    const last20 = tvs.slice(-20);
    liqValue =
      last20.reduce((a, b) => a + b.value_inr, 0) / last20.length;
    liqLabel = classifyLiquidity(liqValue);
  } else {
    coverage_status = "INCOMPLETE";
    coverage_reasons.push("liquidity unavailable: need 20 sessions");
  }
  metrics.push({
    metric: "liquidity_20d",
    value: liqValue,
    label: liqLabel,
    calculation: "liquidity_20d_v1",
    units: "INR_per_session",
  });

  // Aggregate tape
  const required = SPEC.required_metrics;
  const byName = Object.fromEntries(metrics.map((m) => [m.metric, m]));
  const available = required
    .map((n) => byName[n])
    .filter((m) => m && m.label !== "UNAVAILABLE");

  let window = "MIXED";
  const partial = coverage_status === "INCOMPLETE";
  if (available.some((m) => m.label === "HOSTILE")) window = "HOSTILE";
  else if (available.some((m) => m.label === "MIXED") || partial) window = "MIXED";
  else if (
    required.every((n) => byName[n]?.label === "SUPPORTIVE") &&
    !partial
  ) {
    window = "SUPPORTIVE";
  } else {
    window = "MIXED";
  }

  const nifty50_price_index_comparison = {};
  for (const n of [5, 10, 20]) {
    const s = pctReturn(closes, n);
    const b = pctReturn(benchCloses, n);
    nifty50_price_index_comparison[`${n}d`] = {
      stock_return_pct: s,
      nifty_price_index_return_pct: b,
      excess_pct_points: s != null && b != null ? s - b : null,
      note: "price-return comparison; not total-return attribution",
    };
  }

  return {
    engine: "market",
    metrics,
    window,
    nifty50_price_index_comparison,
    coverage_status,
    coverage_reasons,
    context_as_of: context.as_of,
    context_data_version: context.data_version,
  };
}
