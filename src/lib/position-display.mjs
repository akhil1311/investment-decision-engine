/**
 * Position display only — never fed into evidence engines.
 */

/**
 * @param {object} position PositionDisplayInput
 * @param {number|null} rawLastClose
 * @param {object[]} corporateActions visible at as_of
 * @param {string} asOfYmd
 */
export function buildPositionDisplay(
  position,
  rawLastClose,
  corporateActions,
  asOfYmd,
) {
  if (!position || position.state === "NOT_HELD") {
    return {
      state: "NOT_HELD",
      pnl_status: "N_A",
    };
  }

  if (position.state !== "HELD") {
    return {
      state: position.state,
      pnl_status: "UNAVAILABLE",
      reason: "Unknown position state",
    };
  }

  if (!position.entry_date || position.average_entry_price == null) {
    return {
      state: "HELD",
      quantity: position.quantity,
      average_entry_price: position.average_entry_price,
      entry_date: position.entry_date,
      pnl_status: "UNAVAILABLE",
      reason: "INCOMPLETE_POSITION_FIELDS",
    };
  }

  const supported = (corporateActions || []).filter(
    (ca) =>
      (ca.type === "split" || ca.type === "bonus") &&
      ca.ex_date > position.entry_date &&
      ca.ex_date <= asOfYmd,
  );

  if (supported.length) {
    return {
      state: "HELD",
      quantity: position.quantity,
      average_entry_price: position.average_entry_price,
      entry_date: position.entry_date,
      pnl_status: "UNAVAILABLE",
      reason: "CORPORATE_ACTION_AFTER_ENTRY",
      blocking_actions: supported.map((c) => c.action_id),
    };
  }

  if (rawLastClose == null) {
    return {
      state: "HELD",
      quantity: position.quantity,
      average_entry_price: position.average_entry_price,
      entry_date: position.entry_date,
      pnl_status: "UNAVAILABLE",
      reason: "NO_RAW_CLOSE",
    };
  }

  const unrealized_pct =
    ((rawLastClose / position.average_entry_price) - 1) * 100;

  return {
    state: "HELD",
    quantity: position.quantity,
    average_entry_price: position.average_entry_price,
    entry_date: position.entry_date,
    raw_last_close: rawLastClose,
    unrealized_pct,
    pnl_status: "OK",
    note: "P&L uses raw session close vs entry; not research-adjusted",
  };
}
