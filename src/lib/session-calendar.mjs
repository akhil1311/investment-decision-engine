/**
 * SessionCalendar — sole authority for NSE cash session timing (V1 EOD).
 * Default session close: 15:30:00+05:30 Asia/Kolkata.
 */

const TIMEZONE = "Asia/Kolkata";
const SESSION_CLOSE_HM = { hour: 15, minute: 30, second: 0 };

/** @param {string} ymd */
export function parseYmd(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

/** @param {Date} utcDate */
export function formatYmdInIst(utcDate) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(utcDate);
}

/** @param {{y:number,m:number,d:number}} parts */
function ymdToUtcNoon({ y, m, d }) {
  return new Date(Date.UTC(y, m - 1, d, 6, 30, 0));
}

/**
 * @param {string[]} sessionDates sorted ascending YYYY-MM-DD
 */
export function createSessionCalendar(sessionDates) {
  const sessions = [...new Set(sessionDates)].sort();
  const index = new Map(sessions.map((s, i) => [s, i]));

  function isTradingSession(ymd) {
    return index.has(ymd);
  }

  function sessionClose(ymd) {
    if (!isTradingSession(ymd)) {
      throw new Error(`Not a trading session: ${ymd}`);
    }
    return `${ymd}T15:30:00+05:30`;
  }

  function previousSession(ymd) {
    const i = index.get(ymd);
    if (i === undefined) throw new Error(`Not a trading session: ${ymd}`);
    if (i === 0) return null;
    return sessions[i - 1];
  }

  function nextSession(ymd) {
    const i = index.get(ymd);
    if (i === undefined) throw new Error(`Not a trading session: ${ymd}`);
    if (i >= sessions.length - 1) return null;
    return sessions[i + 1];
  }

  /**
   * Sessions from after fromYmd through toYmd inclusive on the right endpoints
   * used for event distance: count sessions strictly after asOfYmd with
   * session_date <= eventDate.
   */
  function sessionDistance(asOfYmd, eventDate) {
    const asOfIdx = index.get(asOfYmd);
    if (asOfIdx === undefined) {
      throw new Error(`as_of session not in calendar: ${asOfYmd}`);
    }
    let count = 0;
    for (let i = asOfIdx + 1; i < sessions.length; i++) {
      if (sessions[i] <= eventDate) count++;
      else break;
    }
    if (eventDate > asOfYmd && count === 0) {
      return 1;
    }
    return count;
  }

  function sessionsOnOrBefore(ymd) {
    return sessions.filter((s) => s <= ymd);
  }

  function latestSessionOnOrBefore(ymd) {
    const list = sessionsOnOrBefore(ymd);
    return list.length ? list[list.length - 1] : null;
  }

  /**
   * Default as_of: latest completed session relative to "now" in IST.
   * If today is a trading day and local time is before 15:30, use previous session.
   */
  function latestCompletedSession(now = new Date()) {
    const istParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (t) => istParts.find((p) => p.type === t)?.value;
    const ymd = `${get("year")}-${get("month")}-${get("day")}`;
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));
    const beforeClose =
      hour < SESSION_CLOSE_HM.hour ||
      (hour === SESSION_CLOSE_HM.hour && minute < SESSION_CLOSE_HM.minute);

    if (isTradingSession(ymd) && !beforeClose) {
      return ymd;
    }
    if (isTradingSession(ymd) && beforeClose) {
      return previousSession(ymd);
    }
    return latestSessionOnOrBefore(ymd);
  }

  function assertEodAsOf(asOfIso) {
    const m = /^(\d{4}-\d{2}-\d{2})T15:30:00\+05:30$/.exec(asOfIso);
    if (!m) {
      const err = new Error(
        `as_of must be EOD session close YYYY-MM-DDT15:30:00+05:30, got ${asOfIso}`,
      );
      err.code = "NON_EOD_AS_OF";
      throw err;
    }
    if (!isTradingSession(m[1])) {
      const err = new Error(`as_of date is not a trading session: ${m[1]}`);
      err.code = "NON_EOD_AS_OF";
      throw err;
    }
    return m[1];
  }

  return {
    TIMEZONE,
    sessions,
    isTradingSession,
    sessionClose,
    previousSession,
    nextSession,
    sessionDistance,
    sessionsOnOrBefore,
    latestSessionOnOrBefore,
    latestCompletedSession,
    assertEodAsOf,
  };
}

export { TIMEZONE, SESSION_CLOSE_HM, ymdToUtcNoon };
