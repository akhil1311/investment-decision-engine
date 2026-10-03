# Data promotion V1 — requirements freeze

**Branch:** `data-promotion-v1` (from tag `v0.1.0`)  
**Status:** Requirements freeze — **no adapter implementation in this document’s scope**  
**Immutable base:** Assessment engines, label specs, decision gate, and data contracts at `v0.1.0`

## Purpose

`v0.1.0` proved that the **engine machinery** is correct against fixture adversarials. It did **not** prove that the machinery remains correct against messy historical Indian market data.

Track A answers a **data-fidelity** question, not an indicator-design question:

> Can a historical data adapter emit the **same frozen canonical PIT schemas** so existing Quality / Market / Event engines and Assessment run unchanged?

```
v0.1.0 Frozen V1 Assessment Engine
        │  same contracts (do not rewrite engines for the vendor)
        ▼
Historical Data Adapter
        │
        ▼
Canonical PIT Store
        │
        ▼
Existing Quality / Market / Event Engines
        │
        ▼
Existing Assessment  →  decision still DISABLED
```

## Non-goals (explicit)

Do **not** in this track:

- Enable `config/decision-gate.json`
- Retune label thresholds or add RSI/MACD/ATR
- Expand the research universe beyond the eight names
- Connect a broker or build portfolio accounting
- Introduce ML or optimize returns
- Treat assessment output as buy/hold/exit
- “Fix” `v0.1.0` in place — new work lives on this branch / later tags

Track B (research-qualified decision layer) starts only after historical PIT assessments are trustworthy. See [RESEARCH_PROTOCOL](RESEARCH_PROTOCOL.md).

## What “real-data compatible” means

A source + adapter is **real-data compatible** only if, for the promotion universe and a declared historical window, it can populate a store that:

1. Validates against `config/data-contract/*.schema.json` (no generic `date` field).
2. Satisfies the PIT temporal rules already frozen in V1 ([DATA_POLICY](DATA_POLICY.md), [PRICE_BASIS](PRICE_BASIS.md), [ARCHITECTURE](ARCHITECTURE.md)).
3. Passes the vendor audit matrix ([VENDOR_AUDIT_MATRIX](VENDOR_AUDIT_MATRIX.md)) — especially **historical revisions** and **availability timestamps**.
4. Feeds `assess()` without engine code changes; engines must not know whether rows came from fixtures or the adapter.
5. Fails **loudly** on incomplete/unsupported CA and ambiguous revisions — never silent approximation.

A vendor with excellent OHLCV but only “today’s corrected fundamentals” is **not** compatible for the fundamental PIT layer.

## Promotion universe (unchanged)

Use the eight V1 research names — not as synthetic toys, but as the first real-data validation set:

| security_id | Role |
|-------------|------|
| RELIANCE, HDFCBANK, INFY, ITC, SUNPHARMA, LT, TCS, ONGC | Faithfulness / reconstructability |
| NIFTY50_PRICE_INDEX | Benchmark price index (not TRI) |

This is a **data-validation** exercise, not universe selection. Do not add names until the eight reconstruct faithfully.

Adversarial `SYN_*` fixtures remain the classification/PIT oracle for engine invariants; real-data promotion does not replace them.

## Required facts by domain

### Market bars (per security)

Canonical: `config/data-contract/bar.schema.json`

| Field | Required | Notes |
|-------|----------|-------|
| `trading_date` | yes | `YYYY-MM-DD` session date |
| `available_at` | yes | When the bar was knowable (EOD session close ISO for session bars) |
| `open`, `high`, `low`, `close` | yes | Raw session prices |
| `volume` | yes | |
| `turnover` | preferably | INR; liquidity prefers turnover, else close×volume |
| `source_timestamp_type` | yes | `exchange` / `vendor` / … |
| `currency` | if present | `INR` |

Must **not** use Yahoo `Adj Close` as the research return series. Research adjustment remains V1 `researchAdjustedClose` (split/bonus only).

### Nifty 50 price index

Canonical: `config/data-contract/benchmark.schema.json`

| Field | Required |
|-------|----------|
| `benchmark_id` | `NIFTY50_PRICE_INDEX` |
| `trading_date`, `close`, `available_at`, `source_timestamp_type` | yes |

Price index only — not total-return.

### Corporate actions

Canonical: `config/data-contract/corporate_action.schema.json`

| Field | Required | Notes |
|-------|----------|-------|
| `action_id` | yes | Stable id |
| `security_id` | store key | Bound by fixture/path or registry |
| `type` | yes | split, bonus, dividend, rights, … |
| `ex_date` | yes | |
| `available_at` | yes | Announcement / vendor visibility time |
| `factor` | required for split/bonus used in research adjust | Incomplete → fail loud |
| `source_version` | yes for revisions | Corrected CA rows |

History must be rich enough to validate:

- split  
- bonus  
- multiple compounding actions  
- future announced action (`available_at ≤ as_of`, `ex_date > as_of`)  
- revised / corrected action  
- unsupported action (must surface, not be approximated)

### Fundamentals (hardest)

Canonical: `config/data-contract/statement.schema.json`

The store must answer:

> What statement was actually knowable at `as_of`?

Today’s restated history alone is **insufficient**.

| Field | Required |
|-------|----------|
| `period_end` | yes |
| `reported_at` | yes |
| `available_at` | yes |
| `source_version` | yes |
| `statement_type` | income / balance / cash_flow |
| `fiscal_period_duration` | Q1…FY (no Q1/H1 silent substitute) |
| `consolidation` | consolidated / standalone |
| `currency`, `unit` | INR + unit enum |
| metric fields | revenue, pat, cfo, total_debt, equity as applicable |

Revision rule (already frozen): among rows with `available_at ≤ as_of`, pick greatest `available_at`, then highest `source_version`, per logical statement key.

### Events

Canonical: `config/data-contract/event.schema.json`

| Field | Required |
|-------|----------|
| `event_id`, `type`, `event_date` | yes |
| `available_at`, `source_version` | yes |

Must reproduce what was known **before** an earnings announcement (`available_at` after `as_of` ⇒ invisible).

## Session / calendar authority

- Timezone: `Asia/Kolkata`
- Assessment `as_of`: `YYYY-MM-DDT15:30:00+05:30` on a trading session only
- Session calendar must be an explicit input to the store (same role as V1 `SessionCalendar`)
- Missing sessions, holidays, and special closes must be represented without inventing bars

## Adapter contract (vendor-neutral)

```
Vendor extract (any source)
        ↓
Adapter (vendor-specific later; contract is shared)
        ↓
Canonical PIT emission  →  validate-pit-store  →  createPitStore
        ↓
replay(as_of) → loadAsOf(as_of) → assess() → V1 engines
```

Implemented by `src/lib/adapter-contract.mjs` / `test/invariants/adapter-contract.test.mjs`.

Any future adapter (S&P, LSEG, NSE, FactSet, …) must produce the **same** emission shape. The contract names no vendor SKUs.

The contract defines **shape and gate**, not permission to weaken frozen temporal semantics. Adapters must not invent `available_at` from a weaker vendor approximation, or collapse:

```
announcement ≠ reported_at ≠ vendor delivery/availability ≠ knowledge state at as_of
```

Acceptance:

1. Emits only schema-valid canonical records (no generic `date`; no reshaping frozen schemas for vendor fields).
2. Emission passes `validatePitStore` before store/engines see it.
3. For fixed `(security_id, as_of)`, `data_version` is deterministic once loaded into the PIT store.
4. Engines / `assembleAssessment` / `runDecisionGate` remain unmodified from `v0.1.0`.
5. Domain assignment comes from evidence-driven mapping ([VENDOR_DOMAIN_MAPPING.md](VENDOR_DOMAIN_MAPPING.md)) — not from which adapter is easiest to code.

## Planned engineering phases (after this freeze)

Vendor evidence (Track 1/2 audit, S&P sample) runs **in parallel** and does not block vendor-neutral infrastructure.

| Phase | Deliverable | Gate |
|-------|-------------|------|
| 1 | This doc + [VENDOR_AUDIT_MATRIX](VENDOR_AUDIT_MATRIX.md) / [VENDOR_AUDIT_LIVE.md](VENDOR_AUDIT_LIVE.md) | Audit freeze ✅ |
| 2 | **`validate-pit-store`** — vendor-neutral firewall on canonical fixtures | `npm run validate:pit-store` green (`research_fixture`); Layer A/B rejection modes covered ✅ |
| 3 | **Replay harness** (`replay(as_of)` → `loadAsOf(as_of)` → `assess()` → V1 engines) | Fixture T1/T2 knowledge-state replay; deterministic; gate `DISABLED` — **PASS** ✅ |
| 4 | **Adapter contract** (vendor-neutral; no vendor SKUs) | Contract tests green; defines emission shape before any vendor adapter ✅ |
| 5 | **Vendor-to-domain mapping** (evidence-driven; [VENDOR_DOMAIN_MAPPING.md](VENDOR_DOMAIN_MAPPING.md)) | Framework PASS; SELECTED gate explicit; adapters only after SELECTED; Row 15 PASS-candidate until sample |
| 6 | Adapter(s) emitting canonical JSON for eight names + Nifty (limited window) | Schema + `validate-pit-store` green on real extracts |
| 7 | Historical assessment replay on real extracts | Research dataset of assessments, gate still closed |

Only after phase 7 is trustworthy: open Track B with a **new** research spec (e.g. `docs/research/DECISION_RESEARCH_001.md`), new splits/holdout — do not retune V1 thresholds on the eight names.

## PIT store validator — required rejection modes

Implemented by `src/lib/validate-pit-store.mjs` / `npm run validate:pit-store` (profiles: `research_fixture` default, `canonical_production` strict). Before real data may drive assessments, the validator must reject at least:

- `available_at` after the assessment `as_of` leaking into inputs  
- Missing / wrong timezone on EOD timestamps  
- Generic `date` field  
- Duplicate bar `(security, trading_date)` or ambiguous duplicates  
- Duplicate statement version without revision ordering  
- Q1 vs H1 treated as YoY substitutes  
- Mixed `unit` or `consolidation` inside a YoY pair  
- Missing CA `factor` for split/bonus  
- Future `ex_date` applied in research adjustment  
- Unsupported CA silently accepted  
- Revision ordering ambiguity (same `available_at` + same `source_version` conflict)

Philosophy unchanged from V1: incomplete or conflicting CA data **fails loud**.

## Historical replay — success criteria

Implemented by `src/lib/replay.mjs` / `npm run replay` (fixture store → existing `assess()`; no vendor adapters).

For a security and session range:

1. For each completed session `as_of`, `assess()` returns schema-shaped JSON with `decision.state === "DISABLED"`.
2. T1/T2 PIT boundaries (e.g. statement revision) produce **different** `context.data_version` and evidence/assessment knowledge state.
3. Re-running the same range yields identical serialized replay report (deterministic).
4. Fail-loud data-quality errors (e.g. unsupported CA) surface as replay failures — never silent success.
5. Unrelated security mutations do not change another security’s `data_version` (existing store invariant; still required for vendor extracts later).

## Licensing and personal use

Private research/development. Do not redistribute vendor or exchange data. Confirm the candidate’s license covers historical bulk use and local canonical storage before backfill. Unofficial scrapers (`yfinance`, `nsepython`, live Yahoo/NSE wrappers) remain **forbidden** as runtime or canonical store ([DATA_POLICY](DATA_POLICY.md), [VENDOR_AUDIT](VENDOR_AUDIT.md)).

## Document control

| Item | Value |
|------|--------|
| Freezes | Data-promotion requirements for Track A |
| Does not freeze | Choice of vendor (matrix decides) |
| Supersedes | Nothing in `v0.1.0` engine behavior |
| Next doc action | Fill [VENDOR_AUDIT_MATRIX](VENDOR_AUDIT_MATRIX.md) for candidates |

When requirements here change, bump a Track A tag (e.g. `data-promotion-req-v1`) — do not rewrite history of `v0.1.0`.
