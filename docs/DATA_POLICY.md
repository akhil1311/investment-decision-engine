# Data policy

Fixture layout and adversarial ids: [FIXTURES_AND_TESTS.md](FIXTURES_AND_TESTS.md). Schemas: `config/data-contract/`.

## Canonical sources for V1

- Schema-valid JSON fixtures under `data/fixtures/`
- Optional one-time seed from POC local `data/` snapshots (copy data, not engines)
- Later: paid/normalized vendor adapter emitting the same PIT schema

## Forbidden

- `yfinance`, `nsepython`, or other unofficial Yahoo/NSE scrapers as runtime or canonical store
- Live fetch at assessment time from Yahoo or nseindia via unofficial wrappers
- Yahoo `Adj Close` as the research return series

## Personal use

Private research/development. Do not redistribute market data. Review NSE licensing before any bulk automation or production vendor use.

## PIT temporal fields

Every PIT fact uses distinct named fields (`trading_date`, `available_at`, `period_end`, `reported_at`, `ex_date`, `event_date`). Generic `date` is forbidden.
