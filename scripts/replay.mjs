/**
 * CLI: vendor-neutral historical assessment replay (fixture store → assess).
 *
 * Usage:
 *   node scripts/replay.mjs --symbol RELIANCE --start 2025-06-01 --end 2025-07-14
 *   node scripts/replay.mjs --symbol RELIANCE --as_of 2025-07-14T15:30:00+05:30
 *   node scripts/replay.mjs --symbol RELIANCE --start … --end … --summary
 */
import { replay } from "../src/lib/replay.mjs";

function parseArgs(argv) {
  const out = {
    symbol: "RELIANCE",
    position: "NOT_HELD",
    summary: false,
    asOfs: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--symbol" && argv[i + 1]) out.symbol = argv[++i];
    else if (a === "--start" && argv[i + 1]) out.start = argv[++i];
    else if (a === "--end" && argv[i + 1]) out.end = argv[++i];
    else if (a === "--as_of" && argv[i + 1]) out.asOfs.push(argv[++i]);
    else if (a === "--position" && argv[i + 1]) out.position = argv[++i];
    else if (a === "--summary") out.summary = true;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage:
  node scripts/replay.mjs --symbol RELIANCE --start YYYY-MM-DD --end YYYY-MM-DD
  node scripts/replay.mjs --symbol RELIANCE --as_of EOD_ISO [--as_of EOD_ISO ...]
  Options: --position NOT_HELD|HELD  --summary`);
      process.exit(0);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const opts = {
  symbol: args.symbol,
  position: { state: args.position },
};
if (args.asOfs.length) opts.asOfs = args.asOfs;
else {
  opts.start = args.start;
  opts.end = args.end;
}

let report;
try {
  report = replay(opts);
} catch (e) {
  console.error(`replay: ${e.message}`);
  process.exit(2);
}

if (args.summary) {
  console.log(
    JSON.stringify(
      {
        symbol: report.symbol,
        summary: report.summary,
        as_ofs: report.as_ofs,
        outcomes: report.results.map((r) =>
          r.ok
            ? {
                as_of: r.as_of,
                ok: true,
                data_version: r.data_version,
                decision_state: r.decision_state,
              }
            : { as_of: r.as_of, ok: false, error: r.error },
        ),
      },
      null,
      2,
    ),
  );
} else {
  console.log(JSON.stringify(report, null, 2));
}

process.exit(report.summary.failed > 0 ? 1 : 0);
