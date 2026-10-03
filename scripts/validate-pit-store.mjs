/**
 * CLI: validate canonical PIT fixture/store (vendor-neutral firewall).
 *
 * Usage:
 *   node scripts/validate-pit-store.mjs [--root data/fixtures] [--profile research_fixture|canonical_production]
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFixtureDataset } from "../src/lib/pit-store.mjs";
import { validatePitStore } from "../src/lib/validate-pit-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(__dirname, "../data/fixtures");

function parseArgs(argv) {
  let root = DEFAULT_ROOT;
  let profile = "research_fixture";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root" && argv[i + 1]) {
      root = resolve(argv[++i]);
    } else if (a === "--profile" && argv[i + 1]) {
      profile = argv[++i];
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/validate-pit-store.mjs [--root path] [--profile research_fixture|canonical_production]",
      );
      process.exit(0);
    }
  }
  if (
    profile !== "research_fixture" &&
    profile !== "canonical_production"
  ) {
    console.error(`Invalid profile: ${profile}`);
    process.exit(2);
  }
  return { root, profile };
}

const { root, profile } = parseArgs(process.argv.slice(2));
const dataset = loadFixtureDataset(root);
const result = validatePitStore(dataset, { profile });

if (result.ok) {
  console.log(`validate-pit-store: OK (profile=${result.profile})`);
  process.exit(0);
}

console.error(
  `validate-pit-store: FAIL (profile=${result.profile}, errors=${result.errors.length})`,
);
for (const e of result.errors) {
  const sid = e.security_id || "-";
  const path = e.path || "-";
  console.error(`${e.code} ${sid} ${path} — ${e.message}`);
}
process.exit(1);
