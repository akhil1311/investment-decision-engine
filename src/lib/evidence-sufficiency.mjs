import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PRECEDENCE = JSON.parse(
  readFileSync(
    join(__dirname, "../../config/decision-vocabulary.json"),
    "utf8",
  ),
).evidence_status_precedence;

/**
 * @param {string[]} statuses
 */
export function rollupEvidenceStatus(statuses) {
  for (const p of PRECEDENCE) {
    if (statuses.includes(p)) return p;
  }
  return "OK";
}

/**
 * @param {{ quality: object, market: object, events: object }} engines
 */
export function computeSufficiency(engines) {
  const reasons = [];
  const statuses = [];

  for (const [name, eng] of Object.entries(engines)) {
    if (!eng) {
      statuses.push("UNAVAILABLE");
      reasons.push(`${name} engine missing`);
      continue;
    }
    if (eng.coverage_status) statuses.push(eng.coverage_status);
    if (eng.coverage_reasons) reasons.push(...eng.coverage_reasons);
  }

  const evidence_status = rollupEvidenceStatus(statuses);

  let sufficiency = "SUFFICIENT";
  const market = engines.market;
  const quality = engines.quality;
  const events = engines.events;

  const qualityAllUnavailable =
    Array.isArray(quality?.metrics) &&
    quality.metrics.length > 0 &&
    quality.metrics.every((m) => m.label === "UNAVAILABLE");

  if (
    evidence_status === "UNAVAILABLE" ||
    (market && market.coverage_status === "UNAVAILABLE") ||
    qualityAllUnavailable
  ) {
    sufficiency = "INSUFFICIENT";
  } else if (
    evidence_status === "INCOMPLETE" ||
    evidence_status === "STALE" ||
    evidence_status === "CONFLICTING" ||
    (market && market.coverage_status === "INCOMPLETE") ||
    (events && events.timing === "UNKNOWN")
  ) {
    sufficiency = "PARTIAL";
  }

  if (market?.coverage_status === "INCOMPLETE") {
    sufficiency = sufficiency === "INSUFFICIENT" ? "INSUFFICIENT" : "PARTIAL";
  }

  return {
    sufficiency,
    evidence_status,
    reasons: [...new Set(reasons)],
  };
}
