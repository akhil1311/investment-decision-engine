# Vendor audit matrix — Track A

**Companion to:** [DATA_PROMOTION_V1.md](DATA_PROMOTION_V1.md)  
**Base:** tag `v0.1.0`  
**Rule:** Do not design or code an adapter against a source until this matrix is filled and critical rows pass.

**Live filled worksheet (public-doc research, 2026-10-03):** [VENDOR_AUDIT_LIVE.md](VENDOR_AUDIT_LIVE.md) — critical rows 6/11/12/15/20 first; no PASS without India sample + contract.

## How to use

1. One table (or one column set) **per candidate source**.
2. Mark each row `PASS` / `FAIL` / `PARTIAL` / `UNKNOWN`.
3. Cite evidence (docs URL, sample file, email from vendor, manual check date).
4. Apply **kill criteria** at the bottom before any integration spike.

Ask first:

> Which data source can satisfy the **PIT contract**?

Not:

> Which API gives historical prices?

## Candidate identity

Use six columns in the live worksheet. Short labels:

| Field | LSEG | S&P | Bloomberg | FactSet | NSE | EODHD |
|-------|------|-----|-----------|---------|-----|-------|
| Role | Full-stack | Full-stack | Full-stack | Full-stack | India-native domain | Low-cost control |
| Name / product | LSEG Data & Analytics / Company Fundamentals PIT | S&P Global MI Compustat / Capital IQ | Bloomberg Data License / COFI PIT | FactSet Fundamentals PIT + As-Reported | NSE Data & Analytics / NSE Indices | EODHD API |
| Delivery | Feed / DaaS / API (confirm SKU) | Xpressfeed / API / platform | API / SFTP / cloud | API | SFTP / leased line / online | REST API |
| India cash equity | Confirm in sample | Confirm India PIT depth | Confirm | Confirm | Native NSE | Confirm NSE tickers |
| License summary | UNKNOWN — contract | UNKNOWN — contract | UNKNOWN — contract | UNKNOWN — contract | UNKNOWN — see usage policy | UNKNOWN — ToS |
| Audit date | 2026-10-03 prelim | 2026-10-03 prelim | 2026-10-03 prelim | 2026-10-03 prelim | 2026-10-03 prelim | 2026-10-03 prelim |

Detailed marks and URLs: [VENDOR_AUDIT_LIVE.md](VENDOR_AUDIT_LIVE.md).

## Requirement matrix

| # | Requirement | Candidate A | Candidate B | Candidate C | Evidence / notes |
|---|-------------|-------------|-------------|-------------|------------------|
| 1 | Historical daily OHLCV | | | | |
| 2 | Historical turnover (INR) | | | | Prefer native turnover; close×volume is fallback only |
| 3 | Nifty 50 **price index** (not TRI-only) | | | | Must map to `NIFTY50_PRICE_INDEX` |
| 4 | Split history with `ex_date` | | | | |
| 5 | Bonus history with `ex_date` | | | | |
| 6 | CA announcement / **availability** timing (`available_at`) | | | | Critical — announcement ≠ ex_date |
| 7 | Factor / ratio for split & bonus | | | | Incomplete factor = FAIL for research adjust |
| 8 | Revised / corrected CA versions | | | | |
| 9 | Unsupported CA types identifiable (rights, merger, …) | | | | Must not be silently folded into adjust |
| 10 | Historical financial statements | | | | |
| 11 | **Historical revisions** (originally reported + later restatement) | | | | **Critical** |
| 12 | Filing / publication timestamps → `reported_at` / `available_at` | | | | **Critical** |
| 13 | Period identity: duration, consolidation, currency, unit | | | | Needed for YoY same-period rules |
| 14 | Earnings calendar **history** (not only forward) | | | | |
| 15 | Event `available_at` (when calendar entry was knowable) | | | | **Critical** for pre-announcement replay |
| 16 | Symbol / ISIN mapping over time | | | | |
| 17 | Historical delisted / suspended security handling | | | | Even if eight names are active today |
| 18 | India coverage consistency (NSE cash sessions) | | | | |
| 19 | Explicit session calendar or reconstructible holidays | | | | |
| 20 | Licensing permits intended personal research + local store | | | | Kill if unclear |
| 21 | No dependence on `yfinance` / `nsepython` / live Yahoo scrape | | | | Forbidden by policy |
| 22 | Can emit or map to frozen canonical schemas without engine changes | | | | Adapter responsibility |

### Severity guide

| Mark | Meaning |
|------|---------|
| PASS | Demonstrably satisfies the row for the eight-name window |
| PARTIAL | Usable with documented gaps; cannot be sole source for that domain |
| FAIL | Cannot satisfy; blocks that domain or the whole candidate |
| UNKNOWN | Not yet verified — treat as blocker until resolved |

## Critical rows (must not be UNKNOWN/FAIL for a sole fundamentals/events vendor)

These decide PIT research suitability:

| # | Requirement | Why |
|---|-------------|-----|
| 6 | CA availability timing | Future-CA leakage tests; announcement-visible / adjust-not |
| 11 | Historical statement revisions | `assess(T1)` must not see restatement at T2 |
| 12 | Filing / publication timestamps | Without these, `available_at` is fiction |
| 15 | Event availability timing | Pre-earnings UNKNOWN vs post-announcement visibility |

A source may **PASS** rows 1–5 (prices + CA ex-dates) and still be **FAIL overall** for Track A if rows 11–12 fail. In that case: use it only for market/CA domains and find a separate fundamentals/events source — or reject promotion until a PIT-capable fundamentals feed exists.

## Kill criteria (from V1 + promotion)

Any of the following → candidate is unsuitable as canonical store (or as sole store):

- As-of D silently uses later restatements  
- No originally-reported versions / no reliable `available_at`  
- Unsupported corporate actions silently approximated  
- License forbids local historical store or intended research use  
- Runtime depends on forbidden scrapers  

## Domain split (allowed)

Track A may compose **multiple** audited sources if each domain’s critical rows pass:

| Domain | May come from |
|--------|----------------|
| Bars + Nifty | Source M |
| Corporate actions | Source C |
| Statements | Source F (must pass revision + timestamps) |
| Events | Source E (must pass historical calendar + `available_at`) |

The **adapter layer** (later) normalizes all of them into one canonical PIT store. Engines still see only canonical records.

## Pre-integration checklist

Before writing adapter code:

- [ ] Matrix filled for the chosen candidate(s)  
- [ ] Critical rows PASS (or domain split documented)  
- [ ] Kill criteria cleared  
- [ ] Sample extracts retained under a non-canonical scratch path (not `data/fixtures/` overwrite of `v0.1.0`)  
- [ ] License note recorded in this file’s candidate identity section  

## Sample extract tests (after matrix PASS — still before full backfill)

Mirror V1 vendor test cases against real extracts:

1. Historical restatement (statement v1 vs v2)  
2. Delayed filing (`reported_at` / `available_at` lag)  
3. Split and bonus with factors  
4. Missing trading day  
5. Symbol / ISIN mapping  
6. Duplicate record handling  
7. Revised filing  
8. Timestamp ambiguity (must fail loud or map with `timestamp_quality: date_only` and documented policy)

## Relationship to frozen V1 docs

| Doc | Role |
|-----|------|
| [VENDOR_AUDIT.md](VENDOR_AUDIT.md) | Short kill criteria (still valid) |
| This matrix | Operational Pass/Fail worksheet for Track A |
| [DATA_PROMOTION_V1.md](DATA_PROMOTION_V1.md) | Full “real-data compatible” definition |
| `config/data-contract/*` | Canonical field contracts — adapter target |

## Decision log

Record the go / no-go here when the matrix is complete:

| Date | Decision | Candidates | Rationale |
|------|----------|------------|-----------|
| 2026-10-03 | Preliminary public-doc audit recorded | LSEG, S&P, Bloomberg, FactSet, NSE, EODHD | Critical rows remain unresolved; questionnaire + India samples next; no purchase/adapter |
| 2026-10-03 | LSEG public-doc pass deepened | LSEG | Cells unchanged (11 PASS-candidate; 6/12/15/20 not PASS); sample+contract optional Track 2 |
| 2026-10-03 | Gate = vendor-to-domain mapping; S&P public pass | S&P | Row 15 → PARTIAL→investigate; 11/12 caveats recorded; next Bloomberg — see VENDOR_AUDIT_LIVE |
| | | | |
