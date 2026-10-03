import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadUniverse(path = join(__dirname, "../../config/universe.json")) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function createSecurityRegistry(universe = loadUniverse()) {
  const byId = new Map();
  const bySymbol = new Map();
  for (const s of universe.securities) {
    byId.set(s.security_id, s);
    bySymbol.set(s.nse_symbol.toUpperCase(), s);
  }

  function resolve(symbolOrId) {
    const key = String(symbolOrId).toUpperCase();
    const sec = byId.get(key) || bySymbol.get(key);
    if (!sec) {
      const err = new Error(`Unknown security (not in research fixture): ${symbolOrId}`);
      err.code = "UNKNOWN_SECURITY";
      throw err;
    }
    return sec;
  }

  return { universe, resolve, list: () => [...universe.securities] };
}
