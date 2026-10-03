# Investment Decision Engine (PROJECT 002)

Personal research tool: an **EOD point-in-time (PIT) assessment engine** with a **locked decision gate**.

**V1 is not a stock trader.** It produces evidence and assessment for a frozen research-fixture universe. Recommendation verbs stay disabled until a future research thread earns them.

## Status

| Item | Value |
|------|--------|
| Related closed POC | `nse-reliance-ingestion-poc` tagged `POC-001` / `v0.1.0` (immutable; do not copy research code) |
| Decision gate | `DISABLED` / `RESEARCH_GATE_CLOSED` |
| Stated horizon | 5–20 trading days (research framing, not a live order) |
| Scope | Cash delivery only — no F&O, day trading, yfinance, or nsepython |
| Runtime | Node.js ≥ 20, ESM, localhost only |

## Layers

```
Evidence → Assessment → Decision [DISABLED]
```

Only `src/lib/decision-gate.mjs` may write `decision` / `confidence`. Engines never receive position.

## Quick start

```bash
npm test          # full suite (offline)
npm start         # http://127.0.0.1:8787
npm run assess -- --symbol RELIANCE --position NOT_HELD
npm run fixtures:generate   # rebuild data/fixtures (manual; not used by tests)
```

Open the UI, pick one of the eight research securities, optionally set held/not-held, leave `as_of` blank for the latest completed EOD session, then Assess. The card renders server JSON; it does not invent trading verbs.

## Documentation (read in this order)

| Order | Doc | What you learn |
|------:|-----|----------------|
| 1 | [docs/CHARTER.md](docs/CHARTER.md) | What this is / is not; V1 constraints |
| 2 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | End-to-end flow, module map, PIT, lookbacks, sufficiency |
| 3 | [docs/OUTPUT_CONTRACT.md](docs/OUTPUT_CONTRACT.md) | Exact JSON returned to UI/CLI |
| 4 | [docs/FIXTURES_AND_TESTS.md](docs/FIXTURES_AND_TESTS.md) | Data plane, SYN_* adversarials, what tests prove |
| 5 | [docs/DECISION_VOCABULARY.md](docs/DECISION_VOCABULARY.md) | Frozen verb meanings (still disabled) |
| 6 | [docs/PRICE_BASIS.md](docs/PRICE_BASIS.md) | Adjusted vs raw series rules |
| 7 | [docs/DATA_POLICY.md](docs/DATA_POLICY.md) | Allowed/forbidden data sources |
| 8 | [docs/RESEARCH_PROTOCOL.md](docs/RESEARCH_PROTOCOL.md) | When (not) to unlock the gate |
| 9 | [docs/VENDOR_AUDIT.md](docs/VENDOR_AUDIT.md) | Kill criteria before production ingest |

### Track A — real-data promotion (post `v0.1.0`)

Work on branch `data-promotion-v1`. Do not rewrite engines for a vendor.

| Doc | What you learn |
|-----|----------------|
| [docs/DATA_PROMOTION_V1.md](docs/DATA_PROMOTION_V1.md) | What “real-data compatible” means; phased plan |
| [docs/VENDOR_AUDIT_MATRIX.md](docs/VENDOR_AUDIT_MATRIX.md) | Pass/Fail worksheet before any adapter code |
| [docs/VENDOR_AUDIT_LIVE.md](docs/VENDOR_AUDIT_LIVE.md) | Live audit marks + vendor questionnaire (no coding yet) |

Machine-readable thresholds and schemas live under `config/` (label specs, decision vocabulary, data-contract). Prefer those for exact numbers; prefer the docs above for intent and wiring.

## Repository map

```
config/           Gate, vocabulary, universe, label specs, JSON schemas
data/fixtures/    Canonical V1 PIT store (research + SYN_* adversarials)
docs/             Human/AI-readable system documentation
scripts/          Fixture generator
src/engines/      Quality, market, events (evidence only)
src/lib/          PIT, assemble, gate, assess pipeline
src/server.mjs    Localhost API + static web
src/cli-assess.mjs
web/              Assessment card (consumes JSON)
test/             Schema, boundaries, invariants, golden
```

## Design hard-stops (summary)

- EOD-only `as_of` via `SessionCalendar` (`…T15:30:00+05:30`)
- PIT visibility: `available_at ≤ as_of`; statement/event revision by `available_at` then `source_version`
- Research adjusted close = split/bonus only, 60-session window; unsupported CA fails loud
- Liquidity and position P&L use **raw** INR / raw close; P&L UNAVAILABLE after split/bonus after entry
- Nifty is a **price-index scoreboard**, not a SIP product or total-return series
- Assessment prose and event reasons forbid trading advice copy
- Eight names are a research fixture, not a validated production universe

## For AI agents working in this repo

1. Read **CHARTER → ARCHITECTURE → OUTPUT_CONTRACT → FIXTURES_AND_TESTS** before changing behavior.
2. Do not enable `config/decision-gate.json` without an explicit research-protocol request.
3. Do not add yfinance/nsepython or live scrape paths.
4. Do not auto-write goldens from tests; update `test/golden/*.json` only deliberately.
5. Prefer extending invariant/boundary tests when changing labels, PIT, or CA logic.
6. Keep engines position-free; position belongs only in `position_display` after the gate.
