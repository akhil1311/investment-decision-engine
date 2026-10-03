# PROJECT 002 — Charter

How the system is wired: [ARCHITECTURE.md](ARCHITECTURE.md). JSON shape: [OUTPUT_CONTRACT.md](OUTPUT_CONTRACT.md). Data + tests: [FIXTURES_AND_TESTS.md](FIXTURES_AND_TESTS.md).

## What this is

An **EOD point-in-time (PIT) assessment engine** for a small cash-equity research fixture. It teaches structure (quality, market tape, events) without issuing trading recommendations in V1.

## Relationship to POC-001

`nse-reliance-ingestion-poc` is tagged `POC-001` / `v0.1.0` and is **CLOSED / IMMUTABLE**. This repo may seed fixtures from POC local data snapshots only. It must not copy or reopen E.3 / F.0 research code.

## Three layers

1. **Evidence** — metric values, labels, provenance
2. **Assessment** — sufficiency, WHY, what would change assessment, Nifty price-index comparison
3. **Decision** — only `decision-gate.mjs`; V1 always `DISABLED`

## V1 constraints

- Cash delivery, days-to-weeks stated horizon (5–20 trading sessions)
- **EOD-only** assessments (`SessionCalendar.sessionClose`)
- Eight securities are a **research fixture**, not a production universe
- No extra indicators beyond the frozen set
- No F&O, day trading, broker, SIP product, arbitrary tickers
- No yfinance / nsepython

## Non-goals for V1

- Enabling INITIATE / HOLD / EXIT
- Portfolio corporate-action accounting
- Machine learning recommendation models
