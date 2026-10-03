/**
 * Research adjusted close — split/bonus only, PIT-safe.
 */

export const SUPPORTED_CA_TYPES = new Set(["split", "bonus"]);
export const UNSUPPORTED_CA_TYPES = new Set([
  "rights",
  "merger",
  "demerger",
  "symbol_change",
  "isin_change",
  "suspension",
  "delisting",
]);

/**
 * PIT-select corporate actions: per action_id, greatest available_at <= asOf,
 * then highest source_version. Same revision rule as statements/events.
 * @param {object[]} actions
 * @param {string} asOfIso
 */
export function selectCorporateActionsAsOf(actions, asOfIso) {
  const byId = new Map();
  for (const ca of actions) {
    if (ca.available_at > asOfIso) continue;
    const prev = byId.get(ca.action_id);
    if (
      !prev ||
      ca.available_at > prev.available_at ||
      (ca.available_at === prev.available_at &&
        (ca.source_version ?? 0) > (prev.source_version ?? 0))
    ) {
      byId.set(ca.action_id, ca);
    }
  }
  return [...byId.values()];
}

/**
 * Corporate actions that enter research adjustment at as_of (after PIT select).
 * Single source of truth for adjust eligibility (validator Layer B + runtime).
 * @param {object[]} corporateActions
 * @param {string} asOfIso
 * @param {string} asOfYmd
 * @param {{ sessionsOnOrBefore: (ymd: string) => string[] }} calendar
 */
export function listAdjustingCorporateActions(
  corporateActions,
  asOfIso,
  asOfYmd,
  calendar,
) {
  const sessionsOnOrBefore = calendar.sessionsOnOrBefore(asOfYmd);
  const windowSet = new Set(sessionsOnOrBefore.slice(-60));
  const pitSelected = selectCorporateActionsAsOf(corporateActions, asOfIso);

  for (const ca of corporateActions) {
    if (UNSUPPORTED_CA_TYPES.has(ca.type) && ca.available_at <= asOfIso) {
      const err = new Error(
        `Unsupported corporate action ${ca.type} (${ca.action_id}) — data-quality failure`,
      );
      err.code = "UNSUPPORTED_CORPORATE_ACTION";
      throw err;
    }
  }

  return pitSelected
    .filter(
      (ca) =>
        SUPPORTED_CA_TYPES.has(ca.type) &&
        ca.available_at <= asOfIso &&
        ca.ex_date <= asOfYmd &&
        windowSet.has(ca.ex_date),
    )
    .map((ca) => {
      if (ca.factor == null || !(ca.factor > 0)) {
        const err = new Error(
          `Incomplete corporate-action factor for ${ca.action_id}`,
        );
        err.code = "INCOMPLETE_CORPORATE_ACTION";
        throw err;
      }
      return ca;
    })
    .sort((a, b) => a.ex_date.localeCompare(b.ex_date));
}

/**
 * @param {object[]} rawBars sorted by trading_date ascending
 * @param {object[]} corporateActions
 * @param {string} asOfIso
 * @param {string} asOfYmd
 * @param {import('./session-calendar.mjs').createSessionCalendar} calendar
 */
export function researchAdjustedClose(
  rawBars,
  corporateActions,
  asOfIso,
  asOfYmd,
  calendar,
) {
  const visibleBars = rawBars.filter((b) => b.available_at <= asOfIso);
  const actions = listAdjustingCorporateActions(
    corporateActions,
    asOfIso,
    asOfYmd,
    calendar,
  );

  // Express series in as_of price basis: for each historical bar before an
  // action's ex_date, multiply by the action's factor (e.g. 1:1 bonus → 0.5).
  return visibleBars
    .filter((b) => b.trading_date <= asOfYmd)
    .map((bar) => {
      let adj = bar.close;
      for (const ca of actions) {
        if (bar.trading_date < ca.ex_date) {
          adj = adj * ca.factor;
        }
      }
      return {
        trading_date: bar.trading_date,
        raw_close: bar.close,
        adjusted_close: adj,
        volume: bar.volume,
        turnover: bar.turnover,
        available_at: bar.available_at,
      };
    });
}

/**
 * Session traded value in INR.
 * @param {object} bar
 */
export function sessionTradedValueInr(bar) {
  if (bar.turnover != null && typeof bar.turnover === "number") {
    return bar.turnover;
  }
  if (
    typeof bar.close === "number" &&
    typeof bar.volume === "number" &&
    (bar.currency === "INR" || bar.currency == null)
  ) {
    return bar.close * bar.volume;
  }
  return null;
}
