# Fixtures and tests

How the data plane and suite prove V1 hard-stops. Read after [ARCHITECTURE](ARCHITECTURE.md).

## Fixture layout

```
data/fixtures/
  dataset.json              # session calendar, default as_of, security id list
  benchmark/nifty50.json    # Nifty 50 price-index bars (not TRI)
  securities/<ID>/
    security.json
    bars.json
    corporate_actions.json  # optional
    statements.json         # optional
    events.json             # optional
```

- Canonical store for V1 assessments is these JSON files only ([DATA_POLICY](DATA_POLICY.md)).
- Regenerate with `npm run fixtures:generate` (`scripts/generate-fixtures.mjs`). Tests never write fixtures or goldens.
- `dataset.json` → `as_of_default_session` is the default EOD date when clients omit `as_of`.

## Research universe vs adversarial ids

| Kind | Ids | In UI / `/api/universe`? | Purpose |
|------|-----|---------------------------|---------|
| Research fixture | RELIANCE, HDFCBANK, INFY, ITC, SUNPHARMA, LT, TCS, ONGC | Yes | Card demos + golden |
| Adversarial | SYN_SHORT20, SYN_SHORT59, SYN_BONUS, SYN_FUTURE_BONUS, SYN_UNSUPPORTED_CA | No | Invariant counterexamples |

`SYN_*` are assessable via PIT-store fallback for tests. They are **not** a production universe expansion.

### Adversarial catalog

| Id | Intended invariant |
|----|--------------------|
| `SYN_SHORT20` | 20 closes → SMA20 available; RS/volatility UNAVAILABLE (need 21) |
| `SYN_SHORT59` | 59 closes → drawdown UNAVAILABLE; never SUPPORTIVE while incomplete |
| `SYN_BONUS` | Ex-bonus artificial raw crash removed in adjusted series; P&L UNAVAILABLE after entry before ex |
| `SYN_FUTURE_BONUS` | Announced but `ex_date` after `as_of` → does not alter adjusted series |
| `SYN_UNSUPPORTED_CA` | Unsupported CA type fails loud |

RELIANCE statements include multi-version income for PIT revision tests (earlier `as_of` sees v1 only).

## Config that governs behavior

| File | Governs |
|------|---------|
| `config/decision-gate.json` | Gate open/closed |
| `config/decision-vocabulary.json` | Decision states + evidence status precedence |
| `config/universe.json` | Eight research names |
| `config/quality-label-spec.json` | Quality thresholds |
| `config/market-label-spec.json` | Market thresholds + lookbacks |
| `config/event-label-spec.json` | Event distance + forbidden copy |
| `config/data-contract/*.schema.json` | Fixture shapes; `forbidden_fields: ["date"]` |

Label specs are the classification oracle for boundaries — not “what looks good on RELIANCE.”

## Test layout

```
test/
  schema/       # contracts + forbid generic date
  boundaries/   # exact label / distance thresholds
  invariants/   # PIT, CA, gate, position, lookbacks, hardening
  golden/       # committed snapshot + position isolation
```

Run: `npm test` (Node 20+ built-in test runner).

### PIT store validator (Track A firewall)

```bash
npm run validate:pit-store
# optional:
npm run validate:pit-store -- --profile canonical_production
```

| Profile | Behavior |
|---------|----------|
| `research_fixture` (default) | Current `data/fixtures` must pass — including adversarial `SYN_*` packs |
| `canonical_production` | Stricter: unsupported CA types are rejected at store level (intentional `SYN_UNSUPPORTED_CA` fails) |

- Library: `src/lib/validate-pit-store.mjs` (pure; collect-all; deterministic error order)
- Layer A = static integrity; Layer B = as-of PIT probes (bars **and** benchmarks included)
- `date_only` + EOD `T15:30:00+05:30` is normalization, not true intraday availability
- Not wired into `loadFixtureDataset` / engines yet (additive)
- Tests: `test/invariants/pit-store-validator.test.mjs`

### Historical replay harness (Track A)

```bash
npm run replay -- --symbol RELIANCE --start 2025-06-02 --end 2025-07-14 --summary
npm run replay -- --symbol RELIANCE --as_of 2025-07-14T15:30:00+05:30
```

- Library: `src/lib/replay.mjs` — dependency order: `replay(as_of)` → `loadAsOf(as_of)` → `assess()` → V1 engines
- Fixture-backed and vendor-neutral; engines/schemas unchanged
- Proves T1/T2 knowledge-state differences (`data_version` + evidence) before any vendor extract
- Milestone status: **PASS** (fixture replay integrity)
- Tests: `test/invariants/replay.test.mjs`

### Adapter contract (Track A, vendor-neutral)

- Library: `src/lib/adapter-contract.mjs` — shared **AdapterEmission** shape + `assertAdapterEmission`
- Any future vendor adapter must emit this shape; contract names **no** vendor SKUs
- Gate: shape checks → `validatePitStore` → `emissionToDataset` / `createPitStore`
- Identity projection from fixtures proves the contract without implementing S&P/LSEG/NSE adapters
- Tests: `test/invariants/adapter-contract.test.mjs`

Protection stack before real vendor extracts:

```
vendor data → [future adapter] → canonical PIT
  → validate-pit-store ✅ → historical replay ✅ → V1 assess ✅ → gate DISABLED ✅
```

Domain assignment is evidence-first: [VENDOR_DOMAIN_MAPPING.md](VENDOR_DOMAIN_MAPPING.md). Do not implement vendor adapters until a domain is **SELECTED**.

## What each suite proves

### Schema (`test/schema/`)

- Fixtures load and validate against data-contract schemas
- Generic `date` field rejected
- Adversarial object with `date` fails validation

### Boundaries (`test/boundaries/`)

- Debt/equity and YoY threshold edges
- YoY comparator ≤ 0 → UNAVAILABLE
- Q1 vs H1 same FY → UNAVAILABLE (no sequential substitute)
- RS / liquidity boundaries on controlled series
- Event Friday→Monday distance = 1; exactly 5 sessions → UNFAVORABLE
- Empty event calendar → UNKNOWN

### Credibility suite (`test/invariants/credibility.test.mjs`) — read these first

These encode the hard-stops that make V1 trustworthy (composition over count):

| Spec category | What is asserted |
|---------------|------------------|
| PIT leakage | `assess(T1)` loads statement v1 revenue; `assess(T2)` loads v2; quality differs |
| Future CA leakage | Announcement ≤ as_of → event visible; `ex_date` > as_of → adjusted = raw |
| Position invariance A/B/C | Three positions → identical context/evidence/assessment; display differs |
| RS boundaries | `±2.0` → MIXED; `±2.0001` → SUPPORTIVE/HOSTILE |
| Lookback 20 vs 21 | 20 closes → RS/vol UNAVAILABLE; 21 → available |
| Decision mutation | 81 combinations of mutated assessment/evidence/position/context → exact `DISABLED` / `RESEARCH_GATE_CLOSED` / `WITHHELD` |
| SYN_BONUS architecture | HELD vs NOT_HELD: research unchanged; P&L `UNAVAILABLE` / `CORPORATE_ACTION_AFTER_ENTRY` |
| `data_version` scope | Stable; INFY ≠ RELIANCE; early unused bar ignored; last-61 bar changes hash |
| Compound CA | Bonus then split: every reconstructed price checked; ex-date raw for that action |
| EOD matrix | Exact `15:30` accepted; `15:29` / `15:31` / `18:00` / weekend / wrong TZ rejected |

### Other invariants (`test/invariants/core.test.mjs`, `hardening.test.mjs`)

| Test theme | Hard-stop |
|------------|-----------|
| Non-EOD `as_of` | Rejected |
| Unsupported / incomplete CA | Fail loud |
| Future bonus / ex-bonus continuity | No adjust before ex; raw crash vs continuous adjusted |
| Position invariance (pair) | Evidence/assessment identical NOT_HELD vs HELD |
| P&L after bonus | `CORPORATE_ACTION_AFTER_ENTRY` |
| Statement revision PIT (selector) | Earlier as_of sees older `source_version` |
| Decision gate (pair) | Two mutated inputs still identical DISABLED |
| Lookbacks / classifier / precedence | SMA20 vs RS; vol/dd edges; status rollup |
| UNAVAILABLE never votes | Hostile liquidity missing does not force HOSTILE |
| Scale / constant price | Return labels scale-invariant; flat → vol/dd SUPPORTIVE |
| Event PIT / no trade verbs | `available_at` filter; assessment prose clean |
| Sufficiency / default as_of | All-quality UNAVAILABLE → INSUFFICIENT; latest EOD |

### Golden (`test/golden/`)

- Committed `reliance-not-held.json` must exist; test fails if missing (no auto-write)
- Exact snapshot of decision, confidence, sufficiency, labels, tape, timing
- Evidence JSON omits entry/P&L fields even when position is HELD

## Regenerating fixtures or goldens (manual)

1. Change generator or intentional fixture content.
2. `npm run fixtures:generate` if series need rebuild.
3. Re-run `npm test`.
4. If golden intentionally changes, update `test/golden/reliance-not-held.json` by hand from a known-good `assess()` snapshot — **never** from a test side effect.

## CI expectation

A clean V1 checkout should pass `npm test` with zero network access and no secrets. Server (`npm start`) is optional for manual UI checks.
