import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadGateConfig() {
  return JSON.parse(
    readFileSync(join(__dirname, "../../config/decision-gate.json"), "utf8"),
  );
}

/**
 * Sole writer of decision + confidence.
 * While disabled, ignores all assessment/evidence/position/context content.
 */
export function runDecisionGate(_assessment, _evidence, _position, _context) {
  const gate = loadGateConfig();
  if (!gate.enabled) {
    return {
      decision: {
        state: "DISABLED",
        reason: gate.reason || "RESEARCH_GATE_CLOSED",
      },
      confidence: {
        state: "WITHHELD",
        reason: "Decision layer is not research-qualified.",
      },
    };
  }
  // Future: research-qualified policy. Not implemented in V1.
  return {
    decision: {
      state: "NO_VERDICT",
      reason: "GATE_ENABLED_BUT_NO_POLICY",
    },
    confidence: {
      state: "WITHHELD",
      reason: "No research-qualified policy configured.",
    },
  };
}
