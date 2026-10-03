import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC = JSON.parse(
  readFileSync(join(__dirname, "../../config/event-label-spec.json"), "utf8"),
);

/**
 * @param {{ events: object[] }} eventInput
 * @param {object} context
 * @param {ReturnType<import('../lib/session-calendar.mjs').createSessionCalendar>} calendar
 */
export function runEventEngine(eventInput, context, calendar) {
  if (eventInput.position !== undefined) {
    throw new Error("Event engine must not receive position");
  }

  const asOfYmd = context.as_of.slice(0, 10);
  const known = eventInput.events || [];
  const coverage_reasons = [];
  let coverage_status = "OK";

  if (!known.length) {
    return {
      engine: "events",
      timing: "UNKNOWN",
      known_events: [],
      upcoming: null,
      reasons: ["Event calendar missing or empty at as_of"],
      coverage_status: "INCOMPLETE",
      coverage_reasons: ["No known events at as_of"],
      context_as_of: context.as_of,
      context_data_version: context.data_version,
    };
  }

  const upcoming = [];
  for (const ev of known) {
    if (ev.event_date <= asOfYmd) continue;
    const distance = calendar.sessionDistance(asOfYmd, ev.event_date);
    if (distance > 0) {
      upcoming.push({ ...ev, distance });
    }
  }
  upcoming.sort((a, b) => a.distance - b.distance || a.event_date.localeCompare(b.event_date));

  const next = upcoming[0] || null;
  let timing = "CLEAR";
  const reasons = [];

  if (!next) {
    timing = "CLEAR";
    reasons.push("No upcoming known earnings/ex-date after as_of");
  } else {
    const n =
      next.type === "earnings"
        ? SPEC.earnings_warning_sessions
        : SPEC.ex_date_warning_sessions;
    if (next.distance > 0 && next.distance <= n) {
      timing = "UNFAVORABLE";
      const tmpl =
        next.type === "earnings"
          ? SPEC.reason_templates.earnings
          : SPEC.reason_templates.ex_date;
      reasons.push(tmpl.replace("{distance}", String(next.distance)));
    } else {
      timing = "CLEAR";
      reasons.push(
        `Next known ${next.type} is ${next.distance} trading sessions away`,
      );
    }
  }

  // Guard: no forbidden trade-advice tokens (word-boundary; not substring)
  for (const r of reasons) {
    for (const bad of SPEC.forbidden_copy) {
      const re = new RegExp(`\\b${bad.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (re.test(r)) {
        throw new Error(`Forbidden trade advice copy in event reason: ${bad}`);
      }
    }
  }

  return {
    engine: "events",
    timing,
    known_events: known,
    upcoming: next,
    reasons,
    coverage_status,
    coverage_reasons,
    context_as_of: context.as_of,
    context_data_version: context.data_version,
  };
}
