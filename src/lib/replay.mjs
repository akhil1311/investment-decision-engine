/**
 * Vendor-neutral historical assessment replay.
 *
 * Dependency order (conceptual):
 *   replay(as_of) → loadAsOf(as_of) → assess() → V1 engines
 *
 * Implementation calls existing assess(), which performs loadAsOf then engines.
 * Fixture-backed first. No vendor adapters. Engines unchanged.
 */

import { assess, getStore } from "./assess.mjs";

/**
 * Resolve EOD as_of ISO list for replay.
 * @param {{ asOfs?: string[], start?: string, end?: string, store?: object }} opts
 * @returns {string[]}
 */
export function resolveReplayAsOfs(opts = {}) {
  const store = opts.store || getStore();
  const calendar = store.calendar;

  if (Array.isArray(opts.asOfs) && opts.asOfs.length) {
    return opts.asOfs.map((iso) => {
      calendar.assertEodAsOf(iso);
      return iso;
    });
  }

  const start = opts.start;
  const end = opts.end;
  if (!start || !end) {
    throw new Error(
      "replay requires asOfs[] or both start and end (YYYY-MM-DD session dates)",
    );
  }
  if (!calendar.isTradingSession(start)) {
    throw new Error(`start is not a trading session: ${start}`);
  }
  if (!calendar.isTradingSession(end)) {
    throw new Error(`end is not a trading session: ${end}`);
  }
  if (start > end) {
    throw new Error(`start ${start} is after end ${end}`);
  }

  return calendar
    .sessionsOnOrBefore(end)
    .filter((s) => s >= start)
    .map((s) => calendar.sessionClose(s));
}

/**
 * Run one assessment at a fixed as_of via existing assess().
 * @param {string} symbol
 * @param {string} asOfIso
 * @param {{ position?: object, assessFn?: typeof assess }} [options]
 */
export function replayAsOf(symbol, asOfIso, options = {}) {
  const assessFn = options.assessFn || assess;
  return assessFn({
    symbol,
    as_of: asOfIso,
    position: options.position || { state: "NOT_HELD" },
  });
}

/**
 * Historical replay over multiple EOD as_of points.
 *
 * @param {object} options
 * @param {string} options.symbol
 * @param {string[]} [options.asOfs] explicit EOD ISO list
 * @param {string} [options.start] session YYYY-MM-DD inclusive
 * @param {string} [options.end] session YYYY-MM-DD inclusive
 * @param {object} [options.position]
 * @param {typeof assess} [options.assessFn]
 * @param {object} [options.store] store with calendar (default getStore())
 * @param {boolean} [options.continueOnError=true]
 * @returns {{
 *   symbol: string,
 *   as_ofs: string[],
 *   results: Array<{
 *     as_of: string,
 *     ok: boolean,
 *     card?: object,
 *     data_version?: string,
 *     decision_state?: string,
 *     error?: { code?: string, message: string }
 *   }>,
 *   summary: {
 *     total: number,
 *     ok: number,
 *     failed: number,
 *     decision_disabled: number,
 *     distinct_data_versions: number
 *   }
 * }}
 */
export function replay(options) {
  const symbol = options.symbol;
  if (!symbol) throw new Error("replay requires symbol");

  const asOfs = resolveReplayAsOfs(options);
  const continueOnError = options.continueOnError !== false;
  const results = [];
  const versions = new Set();
  let okCount = 0;
  let disabledCount = 0;

  for (const asOf of asOfs) {
    try {
      const card = replayAsOf(symbol, asOf, options);
      const data_version = card.context?.data_version;
      const decision_state = card.decision?.state;
      if (data_version) versions.add(data_version);
      if (decision_state === "DISABLED") disabledCount += 1;
      okCount += 1;
      results.push({
        as_of: asOf,
        ok: true,
        card,
        data_version,
        decision_state,
      });
    } catch (e) {
      results.push({
        as_of: asOf,
        ok: false,
        error: {
          code: e.code,
          message: e.message || String(e),
        },
      });
      if (!continueOnError) break;
    }
  }

  return {
    symbol,
    as_ofs: asOfs,
    results,
    summary: {
      total: results.length,
      ok: okCount,
      failed: results.length - okCount,
      decision_disabled: disabledCount,
      distinct_data_versions: versions.size,
    },
  };
}

/**
 * Compare two successful replay cards for knowledge-state change.
 * Used by T1/T2 integrity tests — not a vendor concern.
 */
export function knowledgeStateChanged(cardA, cardB) {
  if (!cardA || !cardB) return true;
  return (
    cardA.context?.data_version !== cardB.context?.data_version ||
    JSON.stringify(cardA.evidence) !== JSON.stringify(cardB.evidence) ||
    JSON.stringify(cardA.assessment) !== JSON.stringify(cardB.assessment)
  );
}
