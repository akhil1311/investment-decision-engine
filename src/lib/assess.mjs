import { createPitStore } from "./pit-store.mjs";
import { createSecurityRegistry } from "./security-registry.mjs";
import { runQualityEngine } from "../engines/quality.mjs";
import { runMarketEngine } from "../engines/market.mjs";
import { runEventEngine } from "../engines/events.mjs";
import { assembleAssessment } from "./assemble-assessment.mjs";
import { runDecisionGate } from "./decision-gate.mjs";
import { buildPositionDisplay } from "./position-display.mjs";

let _store;
let _registry;

export function getStore() {
  if (!_store) _store = createPitStore();
  return _store;
}

export function getRegistry() {
  if (!_registry) _registry = createSecurityRegistry();
  return _registry;
}

/**
 * Full assessment pipeline.
 * @param {{ symbol: string, as_of?: string, position?: object }} req
 */
function resolveSecurity(symbol) {
  const store = getStore();
  const registry = getRegistry();
  try {
    return registry.resolve(symbol);
  } catch (e) {
    const id = String(symbol).toUpperCase();
    const bundle = store.dataset.securities[id];
    if (bundle) return bundle.security;
    throw e;
  }
}

export function assess(req) {
  const store = getStore();
  const security = resolveSecurity(req.symbol);

  let asOf = req.as_of;
  if (!asOf) {
    const ymd = store.calendar.latestCompletedSession();
    if (!ymd) throw new Error("No completed session in calendar");
    asOf = store.calendar.sessionClose(ymd);
  }

  const loaded = store.loadAsOf(security.security_id, asOf);
  const { context, marketInput, fundamentalInput, eventInput, calendar } =
    loaded;

  // Engines receive typed inputs only — never position
  const quality = runQualityEngine(fundamentalInput, context);
  const market = runMarketEngine(marketInput, context);
  const events = runEventEngine(eventInput, context, calendar);

  const assembled = assembleAssessment({
    context,
    security: loaded.security,
    quality,
    market,
    events,
  });

  const { decision, confidence } = runDecisionGate(
    assembled.assessment,
    assembled.evidence,
    req.position,
    context,
  );

  const position_display = buildPositionDisplay(
    req.position || { state: "NOT_HELD" },
    loaded.rawLastClose,
    loaded.allCorporateActions,
    asOf.slice(0, 10),
  );

  return {
    ...assembled,
    decision,
    confidence,
    position_display,
    horizon: "5–20 trading days",
  };
}
