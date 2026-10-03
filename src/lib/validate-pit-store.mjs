/**
 * Vendor-neutral PIT store validator (Track A firewall).
 *
 * Pure: no filesystem I/O, does not mutate dataset.
 * Errors are collect-all and sorted by code → security_id → path → message
 * so identical inputs yield byte-identical JSON.stringify(result).
 *
 * date_only + EOD `…T15:30:00+05:30` is EOD-compatible normalization,
 * not proof of true 15:30 intraday availability.
 */

import { validateAgainstSchema, loadSchema } from "./schema-validate.mjs";
import { createPitStore } from "./pit-store.mjs";
import {
  listAdjustingCorporateActions,
  UNSUPPORTED_CA_TYPES,
  SUPPORTED_CA_TYPES,
} from "./prices.mjs";

export const PitValidationCode = Object.freeze({
  SCHEMA_INVALID: "SCHEMA_INVALID",
  AVAILABLE_AT_INVALID: "AVAILABLE_AT_INVALID",
  AVAILABLE_AT_EOD_MISMATCH: "AVAILABLE_AT_EOD_MISMATCH",
  UNKNOWN_SESSION: "UNKNOWN_SESSION",
  DUPLICATE_BAR: "DUPLICATE_BAR",
  SECURITY_ID_MISMATCH: "SECURITY_ID_MISMATCH",
  INCOMPLETE_CORPORATE_ACTION: "INCOMPLETE_CORPORATE_ACTION",
  UNSUPPORTED_CORPORATE_ACTION: "UNSUPPORTED_CORPORATE_ACTION",
  AMBIGUOUS_REVISION: "AMBIGUOUS_REVISION",
  PIT_FUTURE_AVAILABLE_AT_LEAK: "PIT_FUTURE_AVAILABLE_AT_LEAK",
  FUTURE_EX_DATE_APPLIED: "FUTURE_EX_DATE_APPLIED",
  FUTURE_AVAILABLE_AT_APPLIED: "FUTURE_AVAILABLE_AT_APPLIED",
  UNSUPPORTED_CA_SILENT: "UNSUPPORTED_CA_SILENT",
  PIT_PROBE_UNEXPECTED: "PIT_PROBE_UNEXPECTED",
});

const EOD_AVAILABLE_AT = /^(\d{4}-\d{2}-\d{2})T15:30:00\+05:30$/;
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const SCHEMAS = {
  security: () => loadSchema("security.schema.json"),
  bar: () => loadSchema("bar.schema.json"),
  ca: () => loadSchema("corporate_action.schema.json"),
  statement: () => loadSchema("statement.schema.json"),
  event: () => loadSchema("event.schema.json"),
  benchmark: () => loadSchema("benchmark.schema.json"),
};

function err(code, message, { security_id, path, details } = {}) {
  const e = { code, severity: "error", message };
  if (security_id != null) e.security_id = security_id;
  if (path != null) e.path = path;
  if (details != null) e.details = details;
  return e;
}

function sortErrors(errors) {
  return [...errors].sort((a, b) => {
    const c = (a.code || "").localeCompare(b.code || "");
    if (c) return c;
    const s = (a.security_id || "").localeCompare(b.security_id || "");
    if (s) return s;
    const p = (a.path || "").localeCompare(b.path || "");
    if (p) return p;
    return (a.message || "").localeCompare(b.message || "");
  });
}

function statementGroupKey(s) {
  return [
    s.fiscal_period_id,
    s.fiscal_period_duration,
    s.statement_type,
    s.consolidation,
    s.currency,
    s.unit,
  ].join("|");
}

function revisionKey(row) {
  return `${row.available_at}|${row.source_version ?? 0}`;
}

function checkAvailableAt(value, { timestamp_quality, trading_date, kind, path, security_id }, errors) {
  // Absent/null: SCHEMA_INVALID from schema pass only (no second code).
  if (value == null) return;
  if (typeof value !== "string" || value.length === 0) {
    errors.push(
      err(PitValidationCode.AVAILABLE_AT_INVALID, "available_at is empty or non-string", {
        security_id,
        path,
      }),
    );
    return;
  }
  if (!ISO_WITH_OFFSET.test(value)) {
    errors.push(
      err(
        PitValidationCode.AVAILABLE_AT_INVALID,
        `available_at must be ISO-8601 with explicit offset, got ${value}`,
        { security_id, path },
      ),
    );
    return;
  }
  if (timestamp_quality === "date_only") {
    if (kind === "bar" || kind === "benchmark") {
      const expected = `${trading_date}T15:30:00+05:30`;
      if (value !== expected) {
        errors.push(
          err(
            PitValidationCode.AVAILABLE_AT_EOD_MISMATCH,
            `date_only ${kind} available_at must equal ${expected} (EOD normalization, not true intraday), got ${value}`,
            { security_id, path },
          ),
        );
      }
    } else if (!EOD_AVAILABLE_AT.test(value)) {
      errors.push(
        err(
          PitValidationCode.AVAILABLE_AT_EOD_MISMATCH,
          `date_only ${kind} available_at must be YYYY-MM-DDT15:30:00+05:30 (EOD normalization, not true intraday), got ${value}`,
          { security_id, path },
        ),
      );
    }
  }
}

function pushSchemaErrors(schema, obj, path, security_id, errors) {
  const msgs = validateAgainstSchema(schema, obj, path);
  for (const message of msgs) {
    errors.push(
      err(PitValidationCode.SCHEMA_INVALID, message, { security_id, path }),
    );
  }
}

function checkAmbiguousGroup(rows, keyFn, idLabel, security_id, pathPrefix, errors) {
  const groups = new Map();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const gKey = keyFn(row);
    if (!groups.has(gKey)) groups.set(gKey, []);
    groups.get(gKey).push({ row, i });
  }
  for (const [gKey, members] of groups) {
    const byRev = new Map();
    for (const { row, i } of members) {
      const rk = revisionKey(row);
      if (!byRev.has(rk)) byRev.set(rk, []);
      byRev.get(rk).push({ row, i });
    }
    for (const [rk, dups] of byRev) {
      if (dups.length < 2) continue;
      errors.push(
        err(
          PitValidationCode.AMBIGUOUS_REVISION,
          `Ambiguous ${idLabel} revision for key ${gKey} at (${rk})`,
          {
            security_id,
            path: `${pathPrefix}[${dups[0].i}]`,
            details: { group_key: gKey, revision_key: rk, count: dups.length },
          },
        ),
      );
    }
  }
}

function layerA(dataset, profile, errors) {
  const calendar = dataset.calendar;
  const securitySchema = SCHEMAS.security();
  const barSchema = SCHEMAS.bar();
  const caSchema = SCHEMAS.ca();
  const stSchema = SCHEMAS.statement();
  const evSchema = SCHEMAS.event();
  const benchSchema = SCHEMAS.benchmark();

  for (const [securityId, bundle] of Object.entries(dataset.securities || {})) {
    const secPath = `securities.${securityId}.security`;
    pushSchemaErrors(securitySchema, bundle.security, secPath, securityId, errors);
    if (bundle.security?.security_id !== securityId) {
      errors.push(
        err(
          PitValidationCode.SECURITY_ID_MISMATCH,
          `security.security_id ${bundle.security?.security_id} !== key ${securityId}`,
          { security_id: securityId, path: secPath },
        ),
      );
    }

    const barDates = new Set();
    (bundle.bars || []).forEach((bar, i) => {
      const path = `securities.${securityId}.bars[${i}]`;
      pushSchemaErrors(barSchema, bar, path, securityId, errors);
      checkAvailableAt(
        bar?.available_at,
        {
          timestamp_quality: bar?.timestamp_quality,
          trading_date: bar?.trading_date,
          kind: "bar",
          path,
          security_id: securityId,
        },
        errors,
      );
      if (bar?.trading_date && !calendar.isTradingSession(bar.trading_date)) {
        errors.push(
          err(
            PitValidationCode.UNKNOWN_SESSION,
            `bar trading_date not in session calendar: ${bar.trading_date}`,
            { security_id: securityId, path },
          ),
        );
      }
      if (bar?.trading_date) {
        if (barDates.has(bar.trading_date)) {
          errors.push(
            err(
              PitValidationCode.DUPLICATE_BAR,
              `duplicate bar trading_date ${bar.trading_date}`,
              { security_id: securityId, path },
            ),
          );
        }
        barDates.add(bar.trading_date);
      }
    });

    (bundle.corporate_actions || []).forEach((ca, i) => {
      const path = `securities.${securityId}.corporate_actions[${i}]`;
      pushSchemaErrors(caSchema, ca, path, securityId, errors);
      checkAvailableAt(
        ca?.available_at,
        {
          timestamp_quality: ca?.timestamp_quality,
          kind: "corporate_action",
          path,
          security_id: securityId,
        },
        errors,
      );
      if (SUPPORTED_CA_TYPES.has(ca?.type)) {
        if (ca.factor == null || !(ca.factor > 0) || !Number.isFinite(ca.factor)) {
          errors.push(
            err(
              PitValidationCode.INCOMPLETE_CORPORATE_ACTION,
              `split/bonus ${ca.action_id} missing valid factor`,
              { security_id: securityId, path },
            ),
          );
        }
      }
      if (
        profile === "canonical_production" &&
        UNSUPPORTED_CA_TYPES.has(ca?.type)
      ) {
        errors.push(
          err(
            PitValidationCode.UNSUPPORTED_CORPORATE_ACTION,
            `unsupported CA type ${ca.type} (${ca.action_id}) not allowed in canonical_production`,
            { security_id: securityId, path },
          ),
        );
      }
    });

    checkAmbiguousGroup(
      bundle.corporate_actions || [],
      (ca) => ca.action_id,
      "corporate_action",
      securityId,
      `securities.${securityId}.corporate_actions`,
      errors,
    );

    (bundle.statements || []).forEach((st, i) => {
      const path = `securities.${securityId}.statements[${i}]`;
      pushSchemaErrors(stSchema, st, path, securityId, errors);
      checkAvailableAt(
        st?.available_at,
        {
          timestamp_quality: st?.timestamp_quality,
          kind: "statement",
          path,
          security_id: securityId,
        },
        errors,
      );
    });
    checkAmbiguousGroup(
      bundle.statements || [],
      statementGroupKey,
      "statement",
      securityId,
      `securities.${securityId}.statements`,
      errors,
    );

    (bundle.events || []).forEach((ev, i) => {
      const path = `securities.${securityId}.events[${i}]`;
      pushSchemaErrors(evSchema, ev, path, securityId, errors);
      checkAvailableAt(
        ev?.available_at,
        {
          timestamp_quality: ev?.timestamp_quality,
          kind: "event",
          path,
          security_id: securityId,
        },
        errors,
      );
    });
    checkAmbiguousGroup(
      bundle.events || [],
      (ev) => ev.event_id,
      "event",
      securityId,
      `securities.${securityId}.events`,
      errors,
    );
  }

  const benchDates = new Set();
  (dataset.benchmark || []).forEach((bar, i) => {
    const path = `benchmark[${i}]`;
    pushSchemaErrors(benchSchema, bar, path, undefined, errors);
    checkAvailableAt(
      bar?.available_at,
      {
        timestamp_quality: bar?.timestamp_quality,
        trading_date: bar?.trading_date,
        kind: "benchmark",
        path,
      },
      errors,
    );
    if (bar?.trading_date && !calendar.isTradingSession(bar.trading_date)) {
      errors.push(
        err(
          PitValidationCode.UNKNOWN_SESSION,
          `benchmark trading_date not in session calendar: ${bar.trading_date}`,
          { path },
        ),
      );
    }
    if (bar?.trading_date) {
      if (benchDates.has(bar.trading_date)) {
        errors.push(
          err(
            PitValidationCode.DUPLICATE_BAR,
            `duplicate benchmark trading_date ${bar.trading_date}`,
            { path },
          ),
        );
      }
      benchDates.add(bar.trading_date);
    }
  });
}

function eodIso(ymd) {
  return `${ymd}T15:30:00+05:30`;
}

function datePart(iso) {
  if (typeof iso !== "string" || iso.length < 10) return null;
  return iso.slice(0, 10);
}

/**
 * Expand a calendar date into session ± neighbors; collect into `sessions` Set.
 */
function addBoundaryYmd(sessions, calendar, ymd) {
  if (!ymd) return;
  const session = calendar.isTradingSession(ymd)
    ? ymd
    : calendar.latestSessionOnOrBefore(ymd);
  if (!session) return;
  sessions.add(session);
  const prev = calendar.previousSession(session);
  if (prev) sessions.add(prev);
  const next = calendar.nextSession(session);
  if (next) sessions.add(next);
}

/**
 * Deterministic derived as_of probe set (capped). Not a full replay harness.
 *
 * Priority (plan): default EOD first, then CA/event/statement boundary sessions
 * nearest to the default (not earliest-fill), then any explicit asOfSamples.
 */
export function deriveAsOfProbes(dataset, options = {}) {
  const calendar = dataset.calendar;
  const limit = options.asOfProbeLimit ?? 12;
  const def = dataset.meta?.as_of_default_session;
  const allSessions = calendar.sessionsOnOrBefore("9999-12-31");
  const indexOf = (ymd) => {
    const i = allSessions.indexOf(ymd);
    return i >= 0 ? i : null;
  };
  const defIdx = def && calendar.isTradingSession(def) ? indexOf(def) : null;

  /** @type {Map<string, number>} ymd -> priority rank (lower = earlier in output) */
  const ranked = new Map();

  function consider(ymd, tier) {
    if (!ymd || !calendar.isTradingSession(ymd)) return;
    const dist =
      defIdx == null || indexOf(ymd) == null
        ? 1_000_000
        : Math.abs(indexOf(ymd) - defIdx);
    // tier 0 = default, 1 = explicit samples, 2 = CA boundaries, 3 = event, 4 = statement
    const rank = tier * 1_000_000 + dist;
    const prev = ranked.get(ymd);
    if (prev == null || rank < prev) ranked.set(ymd, rank);
  }

  if (def && calendar.isTradingSession(def)) consider(def, 0);

  if (Array.isArray(options.asOfSamples) && options.asOfSamples.length) {
    for (const iso of options.asOfSamples) {
      const y = datePart(iso);
      if (y) consider(y, 1);
    }
  }

  const caSessions = new Set();
  const eventSessions = new Set();
  const statementSessions = new Set();

  for (const bundle of Object.values(dataset.securities || {})) {
    for (const ca of bundle.corporate_actions || []) {
      addBoundaryYmd(caSessions, calendar, datePart(ca.available_at));
      if (SUPPORTED_CA_TYPES.has(ca.type)) {
        addBoundaryYmd(caSessions, calendar, ca.ex_date);
      }
    }
    for (const ev of bundle.events || []) {
      addBoundaryYmd(eventSessions, calendar, datePart(ev.available_at));
    }
    for (const st of bundle.statements || []) {
      addBoundaryYmd(statementSessions, calendar, datePart(st.available_at));
    }
  }

  for (const y of caSessions) consider(y, 2);
  for (const y of eventSessions) consider(y, 3);
  for (const y of statementSessions) consider(y, 4);

  const ordered = [...ranked.entries()]
    .sort((a, b) => {
      if (a[1] !== b[1]) return a[1] - b[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([ymd]) => eodIso(ymd));

  return ordered.slice(0, limit);
}

function assertNoFutureAvailableAt(records, asOf, security_id, pathPrefix, errors) {
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r?.available_at > asOf) {
      errors.push(
        err(
          PitValidationCode.PIT_FUTURE_AVAILABLE_AT_LEAK,
          `loadAsOf returned record with available_at ${r.available_at} > as_of ${asOf}`,
          { security_id, path: `${pathPrefix}[${i}]` },
        ),
      );
    }
  }
}

function layerB(dataset, profile, options, errors) {
  const probes = deriveAsOfProbes(dataset, options);
  const createStore = options.createStore || createPitStore;
  const listAdjusting = options.listAdjusting || listAdjustingCorporateActions;
  const store = createStore(dataset);
  const calendar = dataset.calendar;

  for (const asOf of probes) {
    let asOfYmd;
    try {
      asOfYmd = calendar.assertEodAsOf(asOf);
    } catch {
      continue;
    }

    for (const securityId of store.listSecurityIds()) {
      const bundle = dataset.securities[securityId];
      const hasVisibleUnsupported = (bundle.corporate_actions || []).some(
        (ca) =>
          UNSUPPORTED_CA_TYPES.has(ca.type) && ca.available_at <= asOf,
      );

      try {
        const loaded = store.loadAsOf(securityId, asOf);
        assertNoFutureAvailableAt(
          loaded.marketInput.bars,
          asOf,
          securityId,
          `loadAsOf.bars`,
          errors,
        );
        assertNoFutureAvailableAt(
          loaded.marketInput.benchmark_bars,
          asOf,
          securityId,
          `loadAsOf.benchmark_bars`,
          errors,
        );
        assertNoFutureAvailableAt(
          loaded.fundamentalInput.statements,
          asOf,
          securityId,
          `loadAsOf.statements`,
          errors,
        );
        assertNoFutureAvailableAt(
          loaded.eventInput.events,
          asOf,
          securityId,
          `loadAsOf.events`,
          errors,
        );
        assertNoFutureAvailableAt(
          loaded.marketInput.corporate_actions,
          asOf,
          securityId,
          `loadAsOf.corporate_actions`,
          errors,
        );

        if (hasVisibleUnsupported && profile === "research_fixture") {
          errors.push(
            err(
              PitValidationCode.UNSUPPORTED_CA_SILENT,
              `unsupported CA visible at ${asOf} but loadAsOf did not fail loud`,
              { security_id: securityId, path: `loadAsOf(${asOf})` },
            ),
          );
        }

        let adjusting;
        try {
          adjusting = listAdjusting(
            bundle.corporate_actions,
            asOf,
            asOfYmd,
            calendar,
          );
        } catch (e) {
          if (e.code === "UNSUPPORTED_CORPORATE_ACTION") {
            // Expected when unsupported visible — already handled above for silent case
            continue;
          }
          if (e.code === "INCOMPLETE_CORPORATE_ACTION") {
            // Incomplete factor is Layer A; skip B2 for this security/asOf
            continue;
          }
          errors.push(
            err(
              PitValidationCode.PIT_PROBE_UNEXPECTED,
              e.message || String(e),
              {
                security_id: securityId,
                path: `listAdjusting(${asOf})`,
                details: { code: e.code },
              },
            ),
          );
          continue;
        }

        for (const ca of adjusting) {
          if (ca.ex_date > asOfYmd) {
            errors.push(
              err(
                PitValidationCode.FUTURE_EX_DATE_APPLIED,
                `adjusting CA ${ca.action_id} has ex_date ${ca.ex_date} > as_of ${asOfYmd}`,
                { security_id: securityId, path: `ca.${ca.action_id}` },
              ),
            );
          }
          if (ca.available_at > asOf) {
            errors.push(
              err(
                PitValidationCode.FUTURE_AVAILABLE_AT_APPLIED,
                `adjusting CA ${ca.action_id} has available_at ${ca.available_at} > as_of ${asOf}`,
                { security_id: securityId, path: `ca.${ca.action_id}` },
              ),
            );
          }
        }
      } catch (e) {
        if (e.code === "UNSUPPORTED_CORPORATE_ACTION" && hasVisibleUnsupported) {
          // B3 success: failed loud
          continue;
        }
        if (e.code === "INCOMPLETE_CORPORATE_ACTION") {
          continue;
        }
        if (e.code === "UNKNOWN_SECURITY") {
          continue;
        }
        errors.push(
          err(
            PitValidationCode.PIT_PROBE_UNEXPECTED,
            e.message || String(e),
            {
              security_id: securityId,
              path: `loadAsOf(${asOf})`,
              details: { code: e.code },
            },
          ),
        );
      }
    }
  }

}

/**
 * @param {object} dataset same shape as loadFixtureDataset()
 * @param {object} [options]
 * @param {'research_fixture'|'canonical_production'} [options.profile='research_fixture']
 * @param {string[]} [options.asOfSamples]
 * @param {boolean} [options.includeAsOfProbes=true]
 * @param {number} [options.asOfProbeLimit]
 * @param {(dataset: object) => object} [options.createStore] test/DI hook (default createPitStore)
 * @param {typeof listAdjustingCorporateActions} [options.listAdjusting] test/DI hook
 * @returns {{ ok: boolean, profile: string, errors: object[] }}
 */
export function validatePitStore(dataset, options = {}) {
  const profile = options.profile || "research_fixture";
  const includeAsOfProbes = options.includeAsOfProbes !== false;
  const errors = [];

  layerA(dataset, profile, errors);
  if (includeAsOfProbes) {
    layerB(dataset, profile, options, errors);
  }

  const sorted = sortErrors(errors);
  return {
    ok: sorted.length === 0,
    profile,
    errors: sorted,
  };
}
