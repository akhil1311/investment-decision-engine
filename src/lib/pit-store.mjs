import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSessionCalendar } from "./session-calendar.mjs";
import {
  researchAdjustedClose,
  selectCorporateActionsAsOf,
  sessionTradedValueInr,
} from "./prices.mjs";
import { assertValid } from "./schema-validate.mjs";

/** Re-export for pit-store API parity with statements/events selectors. */
export { selectCorporateActionsAsOf };

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_ROOT = join(__dirname, "../../data/fixtures");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Select statement revision: greatest available_at <= asOf, then highest source_version.
 */
export function selectStatementRevision(statements, asOfIso) {
  const visible = statements.filter((s) => s.available_at <= asOfIso);
  if (!visible.length) return null;
  visible.sort((a, b) => {
    if (a.available_at !== b.available_at) {
      return a.available_at < b.available_at ? 1 : -1;
    }
    return (b.source_version ?? 0) - (a.source_version ?? 0);
  });
  return visible[0];
}

/**
 * Group by logical key and pick revision for each group.
 */
export function selectStatementsAsOf(statements, asOfIso) {
  const groups = new Map();
  for (const s of statements) {
    if (s.available_at > asOfIso) continue;
    const key = [
      s.fiscal_period_id,
      s.fiscal_period_duration,
      s.statement_type,
      s.consolidation,
      s.currency,
      s.unit,
    ].join("|");
    const prev = groups.get(key);
    if (
      !prev ||
      s.available_at > prev.available_at ||
      (s.available_at === prev.available_at &&
        (s.source_version ?? 0) > (prev.source_version ?? 0))
    ) {
      groups.set(key, s);
    }
  }
  return [...groups.values()];
}

export function selectEventsAsOf(events, asOfIso) {
  const byId = new Map();
  for (const e of events) {
    if (e.available_at > asOfIso) continue;
    const prev = byId.get(e.event_id);
    if (
      !prev ||
      e.available_at > prev.available_at ||
      (e.available_at === prev.available_at &&
        (e.source_version ?? 0) > (prev.source_version ?? 0))
    ) {
      byId.set(e.event_id, e);
    }
  }
  return [...byId.values()];
}

export function loadFixtureDataset(root = DEFAULT_FIXTURE_ROOT) {
  const meta = readJson(join(root, "dataset.json"));
  const calendar = createSessionCalendar(meta.session_dates);
  const securities = {};
  for (const id of meta.security_ids) {
    const dir = join(root, "securities", id);
    const security = readJson(join(dir, "security.json"));
    assertValid("security.schema.json", security, id);
    const bars = readJson(join(dir, "bars.json"));
    for (const b of bars) assertValid("bar.schema.json", b, `${id}.bar`);
    const corporate_actions = existsSync(join(dir, "corporate_actions.json"))
      ? readJson(join(dir, "corporate_actions.json"))
      : [];
    for (const ca of corporate_actions) {
      assertValid("corporate_action.schema.json", ca, `${id}.ca`);
    }
    const statements = existsSync(join(dir, "statements.json"))
      ? readJson(join(dir, "statements.json"))
      : [];
    for (const st of statements) {
      assertValid("statement.schema.json", st, `${id}.st`);
    }
    const events = existsSync(join(dir, "events.json"))
      ? readJson(join(dir, "events.json"))
      : [];
    for (const ev of events) assertValid("event.schema.json", ev, `${id}.ev`);
    securities[id] = { security, bars, corporate_actions, statements, events };
  }
  const benchmark = readJson(join(root, "benchmark", "nifty50.json"));
  for (const b of benchmark) assertValid("benchmark.schema.json", b, "bench");

  return {
    meta,
    calendar,
    securities,
    benchmark,
    fixture_version: meta.fixture_version,
  };
}

export function createPitStore(dataset = loadFixtureDataset()) {
  const { calendar, securities, benchmark, fixture_version } = dataset;

  function hashInputs(parts) {
    const h = createHash("sha256");
    h.update(JSON.stringify(parts));
    return `sha256:${h.digest("hex").slice(0, 16)}`;
  }

  function getSecurityBundle(securityId) {
    const bundle = securities[securityId];
    if (!bundle) {
      const err = new Error(`No fixture data for ${securityId}`);
      err.code = "UNKNOWN_SECURITY";
      throw err;
    }
    return bundle;
  }

  /**
   * Build typed inputs for as_of (EOD ISO).
   */
  function loadAsOf(securityId, asOfIso) {
    const asOfYmd = calendar.assertEodAsOf(asOfIso);
    const bundle = getSecurityBundle(securityId);
    const bars = bundle.bars.filter(
      (b) => b.available_at <= asOfIso && b.trading_date <= asOfYmd,
    );
    const adjusted = researchAdjustedClose(
      bundle.bars,
      bundle.corporate_actions,
      asOfIso,
      asOfYmd,
      calendar,
    );
    const bench = benchmark.filter(
      (b) => b.available_at <= asOfIso && b.trading_date <= asOfYmd,
    );
    const statements = selectStatementsAsOf(bundle.statements, asOfIso);
    const events = selectEventsAsOf(bundle.events, asOfIso);
    const cas = selectCorporateActionsAsOf(bundle.corporate_actions, asOfIso);

    // Hash only records used by this assessment (not the whole fixture DB).
    // Market lookbacks need ≤61 closes; liquidity uses last 20 sessions;
    // quality/events use PIT-selected statements/events; CA list is those
    // eligible for research adjustment in the 60-session window.
    const sessionsWindow = calendar.sessionsOnOrBefore(asOfYmd).slice(-60);
    const windowSet = new Set(sessionsWindow);
    const casUsed = cas.filter(
      (c) =>
        ["split", "bonus"].includes(c.type) &&
        c.ex_date <= asOfYmd &&
        windowSet.has(c.ex_date),
    );
    const traded = bars.map((b) => ({
      trading_date: b.trading_date,
      value_inr: sessionTradedValueInr(b),
    }));
    const data_version = hashInputs({
      fixture_version,
      securityId,
      asOfIso,
      adjusted: adjusted.slice(-61),
      traded_values: traded.slice(-20),
      bench: bench.slice(-61),
      statements,
      events,
      cas: casUsed,
      calendar_slice: calendar.sessionsOnOrBefore(asOfYmd).slice(-61),
    });

    const context = Object.freeze({
      as_of: asOfIso,
      timezone: calendar.TIMEZONE,
      security_id: securityId,
      horizon: { unit: "trading_days", min: 5, max: 20 },
      data_version,
    });

    const marketInput = Object.freeze({
      bars,
      adjusted,
      benchmark_bars: bench,
      corporate_actions: cas,
      traded_values: bars.map((b) => ({
        trading_date: b.trading_date,
        value_inr: sessionTradedValueInr(b),
      })),
    });

    const fundamentalInput = Object.freeze({ statements });
    const eventInput = Object.freeze({ events });

    return {
      context,
      marketInput,
      fundamentalInput,
      eventInput,
      security: bundle.security,
      calendar,
      rawLastClose: bars.length ? bars[bars.length - 1].close : null,
      allCorporateActions: cas,
    };
  }

  return {
    calendar,
    fixture_version,
    loadAsOf,
    listSecurityIds: () => Object.keys(securities),
    dataset,
  };
}
