# Vendor audit — live worksheet (Track A)

**Status:** Public-documentation research only — **no purchase, no adapter code**  
**Frozen criteria:** [VENDOR_AUDIT_MATRIX.md](VENDOR_AUDIT_MATRIX.md) rows 1–22  
**Requirements:** [DATA_PROMOTION_V1.md](DATA_PROMOTION_V1.md)  
**Audit date:** 2026-10-03  
**Method:** Current public product pages / developer docs; marks stay conservative until India samples + contracts

## Audit set (not a ranking)

| Candidate | Role in audit | Why it belongs |
|-----------|---------------|----------------|
| LSEG | Full-stack candidate | Public PIT fundamentals (preliminary/final/restated), as-reported, CA/events catalogues |
| S&P Global Market Intelligence | Full-stack candidate | Compustat/Capital IQ PIT / as-reported / financial instance dates |
| Bloomberg Data License | Full-stack candidate | Company Financials/Estimates/Pricing PIT; CA & event calendars |
| FactSet | Full-stack candidate | Fundamentals PIT API + as-reported / NON-RESTATED options |
| NSE Data & Analytics / NSE Indices | India-native domain source | Official EOD/historical, CA reports, corporate data; index authority |
| EODHD | Low-cost control | Conventional API baseline — expected to fail sole PIT fundamentals/events |

Three separate questions for every candidate (must not collapse):

```
Can they provide the data?
        ↓
Can we obtain it historically?
        ↓
Can it satisfy our PIT contract?   ← rows 6, 11, 12, 15, 20 first
```

## Severity used here

| Mark | Meaning in this worksheet |
|------|---------------------------|
| PASS | Demonstrated for our eight-name India window with sample or contractual proof |
| PASS-candidate | Strong public docs for the capability; **India sample / contract still required** before PASS |
| PARTIAL | Some fields exist; semantics incomplete for our contract |
| UNKNOWN | Not established from public materials |
| FAIL | Publicly contradicts our contract or policy |

**Nothing below is PASS yet.** PASS-candidate ≠ PASS. Marketing “point-in-time” ≠ our rows 6/11/12/15.

---

## Critical rows first (6, 11, 12, 15, 20)

| # | Requirement | LSEG | S&P | Bloomberg | FactSet | NSE | EODHD |
|---|-------------|------|-----|-----------|---------|-----|-------|
| 6 | CA announcement / availability timing (`available_at`) | PARTIAL / UNKNOWN | PARTIAL / UNKNOWN | UNKNOWN / PARTIAL | UNKNOWN | PARTIAL | UNKNOWN |
| 11 | Historical revisions (original + restatement) | PASS-candidate | PASS-candidate | PARTIAL → investigate | PARTIAL → investigate | UNKNOWN | UNKNOWN |
| 12 | Filing/publication → `reported_at` / feed `available_at` | PARTIAL | PARTIAL | PARTIAL → investigate | PARTIAL | PARTIAL / UNKNOWN | PARTIAL / UNKNOWN |
| 15 | Event historical `available_at` / calendar knowability | UNKNOWN | UNKNOWN | UNKNOWN / PARTIAL | UNKNOWN | UNKNOWN | UNKNOWN |
| 20 | License permits intended personal research + local store | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN — contractual | UNKNOWN |

### Evidence notes (critical rows)

#### LSEG — public-doc pass complete (2026-10-03); **no critical row → PASS**

| Row | Cell (unchanged) | What public evidence establishes | What remains missing |
|-----|------------------|----------------------------------|----------------------|
| 11 | PASS-candidate | PIT vs non-PIT: preliminary / finalized / restated retained; timestamped to when available; as-reported preserves disclosures/amendments; quant docs: point date = availability in Company Fundamentals feed; daily points since Aug 2006 | India eight-name extract path + sample proving T1 original / T2 restatement |
| 12 | PARTIAL | Exact date/time “made available” claimed; feed point-date semantics; developer fields such as `TR.ISOriginalAnnouncementDate`, `TR.ISStatementLastUpdatedDate` discussed | Dual map `reported_at` + vendor `available_at` + revision chain + India; note: some date fields inconsistently populated across reporting-state histories (dev community → content investigation) |
| 6 | PARTIAL / UNKNOWN | CA materials distinguish declaration/announcement, ex, record, effective/payment; DataScope Plus: announced-not-yet-effective events; delta insert/update/delete ~15-min | Historical **first feed availability** of action/terms independent of announcement/ex-date for as_of knowledge reconstruct |
| 15 | UNKNOWN | Earnings & Corporate Events Calendar: large history from 1999, many companies/countries/event types | `event_date` history ≠ historical knowability (`as_of` Sep 1 UNKNOWN → Sep 5 KNOWN) |
| 20 | UNKNOWN | DaaS: files can download to local infra (technical); Platform/Workspace licensing restricts use/share/redistribute; website terms ≠ enterprise dataset contract | Explicit clause: private local historical extract for offline PIT reconstruction/replay |

Sources (public): [LSEG PIT / backtest](https://www.lseg.com/en/data-analytics/asset-management-solutions/portfolio-management/backtest-your-portfolio-performance), [Fundamentals As Reported](https://www.lseg.com/en/data-catalogue/company-data/company-fundamentals/fundamentals-as-reported), [quant research brochure](https://www.lseg.com/content/dam/data-analytics/en_us/documents/brochures/data-for-quant-research.pdf), LSEG Developers (corporate actions / DataScope / DaaS / licensing), LSEG Developer Community (financial date fields).

**Domain observation (LSEG):** Fundamentals PIT/revisions/availability look more promising than Events knowability; CA has announcement/ex/factor strength with a PIT-availability gap. Strengthens **domain-split** likelihood — does not authorize purchase or adapter.

#### S&P Global
- **11 PASS-candidate:** Compustat marketed with PIT snapshots from ~1987; original values retained with subsequent changes; Snapshot/PIT products described via S&P/WRDS materials. Sources: [Compustat Financials marketplace](https://www.marketplace.spglobal.com/en/datasets/compustat-financials-(8)), [Compustat brochure](https://www.spglobal.com/marketintelligence/en/documents/compustat-brochure_digital.pdf).
- **12 PARTIAL:** Capital IQ / Compustat delivery / effective-through and “financial instance” style dates are strong for `available_at`; issuer filing-time mapping for India still needs confirmation. Note: some Compustat PIT detail is described as stronger for North America — **India depth must be confirmed**.
- **6 PARTIAL/UNKNOWN:** Announcement-date CA datasets exist in historical materials; feed `available_at` ≠ announcement date still open.
- **15 UNKNOWN**
- **20 UNKNOWN**

#### Bloomberg
- **11 PARTIAL → investigate:** [Company Financials, Estimates and Pricing Point-in-Time](https://professional.bloomberg.com/products/data/enterprise-catalog/cofi/) and related research-data pages claim historical PIT actuals for 100k+ active/inactive companies. Exact original-vs-restatement retrieval semantics for Indian issuers not verified at our contract level.
- **12 PARTIAL → investigate:** “Accurate timestamps” claimed; dual `reported_at` / feed-available mapping not proven from public pages alone.
- **6 / 15 UNKNOWN/PARTIAL:** [Corporate actions calendar (CACS)](https://professional.bloomberg.com/products/data/enterprise-catalog/event-driven-feeds/) and [corporate events calendar (EVTS)](https://professional.bloomberg.com/products/data/enterprise-catalog/event-driven-feeds/) exist; historical knowability timestamps not established publicly.
- **20 UNKNOWN** (Data License / enterprise contract).

#### FactSet
- **Important distinction:** Do not accept Estimates PIT as a substitute for **statement** PIT.
- **11 PARTIAL → investigate:** Developer docs expose [Fundamentals Point-in-Time API](https://developer.factset.com/api-catalog/factset-fundamentals-api) (`pitStart` / `pitEnd`) and Report Builder `reportStatus` NON-RESTATED vs RESTATED. Must prove India statement revision history maps to our `source_version` + `available_at` model with a sample.
- **12 PARTIAL:** Fiscal-periods batch docs mention first-published / superseded timestamps (UTC) — promising for `available_at`, not yet proven for our eight names.
- **6 / 15 UNKNOWN**
- **20 UNKNOWN**

#### NSE Data & Analytics / NSE Indices
- **Domain role:** Strong **candidate for market / CA / index**, not presumed sole fundamentals/events source.
- **1–5 / 18–19:** Potentially strong — paid [EOD/historical](https://www.nseindia.com/static/market-data/eod-historical-data-subscription), [corporate data / EOD corporate announcement](https://www.nseindia.com/static/market-data/corporate-data-subscription), index products via NSE Indices (verify Nifty **price index** series separately).
- **6 PARTIAL:** Corporate-action reports include ex-date / related fields; announcement vs feed `available_at` not established as our field.
- **11 UNKNOWN** for originally-reported vs restated PIT statement store.
- **12 PARTIAL/UNKNOWN**
- **15 UNKNOWN**
- **20 UNKNOWN — contractual:** [NSE Data Sharing & Usage Policy](https://www.nseindia.com/static/market-data/nse-data-policy) states subscribers execute a Relevant Agreement for intended use/handling; offline modes (removable media etc.) not permitted without prior MD & CEO approval; data normally online via designated servers. **Do not infer local canonical store rights.**

#### EODHD (control)
- Useful to show where ordinary APIs stop.
- Public docs: EOD prices, fundamentals with `filing_date`, earnings history with `reportDate`, calendars. Sources: [Fundamentals API](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds), [glossary](https://eodhd.com/financial-academy/financial-faq/fundamentals-glossary-common-stock), [earnings calendar](https://eodhd.com/financial-apis/calendar-upcoming-earnings-ipos-and-splits).
- **11 UNKNOWN** — no public evidence of full original+restatement PIT retrieval for our model.
- **12 PARTIAL/UNKNOWN** — `filing_date` / `reportDate` exist; not dual issuer vs feed availability with revision chain.
- **15 UNKNOWN** — historical earnings dates ≠ historical calendar knowability.
- **Not suitable as sole fundamentals/events source** unless vendor proves otherwise.
- Still forbidden as a path that depends on Yahoo scrapers; treat as its own licensed API only if later used for non-canonical experiments — **not** as V1 canonical store without matrix PASS.

---

## Domain suitability sketch (evidence so far — all provisional)

```
                    Market   CA           Fundamentals      Events              License
LSEG                  ?    promising†     PASS-cand*        knowability gap     UNKNOWN
S&P                   ?       ?           PASS-cand*        ?                   UNKNOWN
Bloomberg             ?       ?           investigate       ?                   UNKNOWN
FactSet               ?       ?           investigate       ?                   UNKNOWN
NSE                strong?  partial       weak/?            ?                   UNKNOWN
EODHD              control  weak          FAIL-as-sole      weak                ?
```

\*PASS-candidate on public docs only; India sample required.  
†CA: announcement/ex/factor/deltas documented; row-6 feed `available_at` still open.

Allowed outcome under frozen matrix: **domain split** (e.g. NSE/LSEG market+CA + S&P/LSEG/Bloomberg/FactSet fundamentals + separate events) → multiple adapters → one canonical PIT store. Prefer one source only if it truly clears all critical rows.

---

## Vendor questionnaire (use verbatim)

Do **not** ask: “Do you have point-in-time data?”

### Row 6
For historical corporate actions on Indian equities, do you retain the timestamp at which the action/terms first became available in your feed, independently of announcement date, effective/ex-date, and later revisions? Can that historical availability timestamp be retrieved for NSE cash equities (e.g. RELIANCE, HDFCBANK, INFY)?

### Row 11
For Indian listed companies, can you provide both the originally reported financial statement values and subsequent restated/revised versions, with historical PIT retrieval showing only versions available by a requested timestamp?

### Row 12
Do your financial records expose both the issuer filing/publication timestamp and the timestamp at which your normalized record became available to the customer/feed? What timezone and granularity apply?

### Row 15
For historical earnings calendars, can you reconstruct what earnings date was knowable at each historical timestamp, including date changes/revisions? Is there a historical record of when each calendar value became available?

### Practical sample request (most valuable) — sharpened gaps

Please provide a small extract for **RELIANCE, HDFCBANK, and/or INFY** (sanitized OK; no credentials) covering:

**Fundamentals (rows 11 / 12)** — one real revision case:

| | Need |
|--|------|
| T1 | Original statement values visible at timestamp T1 |
| T2 | Restated/revised values become visible at T2 |
| Fields | Underlying timestamps / version ids that map to our `reported_at`, vendor `available_at`, `source_version` |

**Corporate actions (row 6)** for at least one action:

- announcement timestamp  
- **feed-availability** timestamp (first knowable in feed — not only announcement/ex)  
- ex-date  
- adjustment factor  
- revision/update history if any  

**Earnings calendar (row 15)** for at least one date change or first appearance:

- calendar record as of T1  
- calendar record as of T2  
- timestamp when the date first appeared or changed  

### License / local store (row 20)
Does the proposed subscription permit a private researcher to retain a local historical extract for offline PIT reconstruction and assessment replay (not redistribution)? Please cite the **contract clause** (not website terms of use). Explicitly address: local retention, offline replay, private research, historical extract.

---

## Recommended contact / research order

1. LSEG  
2. S&P Global  
3. Bloomberg  
4. FactSet  
5. NSE (especially rows 1–6, 18–20; domain-split potential)  
6. EODHD (control only)

Order reflects PIT-research plausibility + India-native domain role — **not** a quality ranking.

**Do not pay** until rows **6, 11, 12, 15, 20** have evidence (sample or contractual language). Then fill remaining matrix rows.

---

## Hard rules during this phase

- Do not let a convenient API field named `date` become `available_at`.  
- Preserve frozen distinctions: `period_end`, `reported_at`, `available_at`, `source_version`, `ex_date`, `event_date`.  
- Temporal ladder (do not collapse):

```
announcement date
        ≠
issuer reported_at
        ≠
vendor available_at
        ≠
historical knowledge state at as_of
```

- CA: “includes announcement date and ex-date” is **not** enough for row 6 PASS.  
- Events: “historical earnings dates” is **not** enough for row 15 PASS — need reconstructability such as `as_of=Sep 1 → UNKNOWN` and `as_of=Sep 5 → KNOWN` because the calendar entry became available between those points.  
- Do not rewrite V1 schemas for a vendor.  
- Do not enable the decision gate.  
- Do not start adapter code until critical rows clear for the chosen architecture.  
- Do not promote PASS-candidate → PASS from marketing alone. First defensible PASS needs documentation **+** India sample **and/or** confirmed contractual right.

---

## Evidence log (required for every vendor answer)

For each claim that might move a matrix cell, record a row. Sales “yes we support PIT” without these fields stays NON-EVIDENCE.

| Field | What to capture |
|-------|-----------------|
| Claim | Exact assertion (quote or paraphrase with precision) |
| Matrix row | 6 / 11 / 12 / 15 / 20 / … |
| Evidence type | `public_doc` \| `dev_doc` \| `sales_email` \| `solutions_engineer` \| `sample_file` \| `contract_clause` |
| Exact source | URL, doc title+section, email date/subject, file name |
| Date verified | ISO date |
| India applicability | `yes` / `no` / `unknown` — eight-name or NSE cash stated? |
| PIT semantics demonstrated? | `yes` / `no` / `partial` — knowledge-state / revision / availability, not just “historical” |
| Sample received? | `yes` / `no` — RELIANCE / HDFCBANK / INFY preferred |
| Contract confirmed? | `yes` / `no` / `n/a` — especially row 20 local store |
| Cell impact | e.g. `11 stays PASS-candidate` or `6 → PARTIAL` |

### Log table (append chronologically)

| Date | Vendor | Row | Claim | Evidence type | Exact source | India? | PIT semantics? | Sample? | Contract? | Cell impact |
|------|--------|-----|-------|---------------|--------------|--------|----------------|---------|-----------|-------------|
| 2026-10-03 | (all) | 6/11/12/15/20 | Public-doc preliminary marks only | public_doc | See evidence notes above | unknown | partial/no | no | no | No PASS; PASS-candidate where noted |
| 2026-10-03 | LSEG | 11 | PIT retains preliminary/final/restated; point date = feed availability; as-reported includes amendments | public_doc | LSEG PIT/backtest page; As Reported catalogue; quant research brochure (Company Fundamentals PIT) | unknown | partial (product-level yes; India path no) | no | no | **11 stays PASS-candidate** |
| 2026-10-03 | LSEG | 12 | Exact availability timestamp claimed; fields like TR.ISOriginalAnnouncementDate / TR.ISStatementLastUpdatedDate exist; some dates inconsistently populated | public_doc / dev_doc | LSEG PIT materials; LSEG Developer Community financial date threads | unknown | partial | no | no | **12 stays PARTIAL** |
| 2026-10-03 | LSEG | 6 | Announcement/ex/record/effective dates; announced-not-effective + delta I/U/D delivery | public_doc / dev_doc | LSEG Developers corporate actions; DataScope Plus CA docs | unknown | no (first feed availability unproven) | no | no | **6 stays PARTIAL/UNKNOWN** |
| 2026-10-03 | LSEG | 15 | Historical earnings & corporate events calendar from 1999 (large coverage) | public_doc | LSEG Earnings & Corporate Events Calendar product materials | unknown | no (event_date ≠ knowability) | no | no | **15 stays UNKNOWN** |
| 2026-10-03 | LSEG | 20 | Local download technically supported (DaaS); licensing/Workspace restrict use; website ToS ≠ data contract | public_doc / dev_doc | LSEG Developers DaaS; platform licensing docs; LSEG website terms | unknown | n/a | no | no | **20 stays UNKNOWN** |

**LSEG public-doc ceiling reached.** Further general web search should not move cells. Next evidence: India-specific sample + contractual response. Do not send credentials, API keys, or confidential contracts into chat — sanitized sample + relevant clause wording only.

### LSEG cell summary (after public-doc pass)

```
Row 6   PARTIAL / UNKNOWN
Row 11  PASS-candidate
Row 12  PARTIAL
Row 15  UNKNOWN
Row 20  UNKNOWN

PASS            0
PASS-candidate  1 (row 11 only)
```

---

## Decision log

| Date | Decision | Notes |
|------|----------|-------|
| 2026-10-03 | Audit set frozen; public-doc preliminary marks recorded | No vendor selected; no purchase; no adapter |
| 2026-10-03 | Evidence-log schema + temporal ladder locked | Next: LSEG questionnaire + India sample request |
| 2026-10-03 | LSEG public-doc pass recorded; no cell → PASS | Fundamentals more promising than events knowability; domain-split still open; **hard gate: no purchase/adapter until matrix evidence** |

## Next engineering gate (still future)

Only after architecture choice from evidence:

```
ONE source passes everything  →  one adapter
OR
domain-split sources          →  N adapters → one canonical PIT store
```

Then: schema-valid extracts → `validate-pit-store` → historical `assess()` replay — engines unchanged from `v0.1.0`.
