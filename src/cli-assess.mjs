import { assess } from "./lib/assess.mjs";

const args = process.argv.slice(2);
function get(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const symbol = get("--symbol") || "RELIANCE";
const positionState = get("--position") || "NOT_HELD";
const asOf = get("--as_of");

const result = assess({
  symbol,
  as_of: asOf,
  position: {
    state: positionState,
    quantity: get("--qty") ? Number(get("--qty")) : undefined,
    average_entry_price: get("--entry") ? Number(get("--entry")) : undefined,
    entry_date: get("--entry_date"),
  },
});

console.log(JSON.stringify(result, null, 2));
