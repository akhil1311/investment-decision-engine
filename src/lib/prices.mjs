/**
 * Research adjusted close — split/bonus only, PIT-safe.
 */

const SUPPORTED = new Set(["split", "bonus"]);
const UNSUPPORTED = new Set([
  "rights",
  "merger",
  "demerger",
  "symbol_change",
  "isin_change",
  "suspension",
  "delisting",
]);

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
  const sessionsOnOrBefore = calendar.sessionsOnOrBefore(asOfYmd);
  const windowSessions = sessionsOnOrBefore.slice(-60);
  const windowSet = new Set(windowSessions);

  for (const ca of corporateActions) {
    if (UNSUPPORTED.has(ca.type) && ca.available_at <= asOfIso) {
      const err = new Error(
        `Unsupported corporate action ${ca.type} (${ca.action_id}) — data-quality failure`,
      );
      err.code = "UNSUPPORTED_CORPORATE_ACTION";
      throw err;
    }
  }

  const actions = corporateActions
    .filter(
      (ca) =>
        SUPPORTED.has(ca.type) &&
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
