# Vendor audit — live worksheet (Track A)

**Status:** Parallel public-doc research + optional vendor clarification — **no purchase, no adapter code**  
**Frozen criteria:** [VENDOR_AUDIT_MATRIX.md](VENDOR_AUDIT_MATRIX.md) rows 1–22  
**Requirements:** [DATA_PROMOTION_V1.md](DATA_PROMOTION_V1.md)  
**Audit date:** 2026-10-03 (ongoing)  
**Method:** Current public product pages / developer docs; marks stay conservative until India samples + contracts

## What is already decided vs what is not

**Already clear (does not wait on any salesperson):**

```
Vendor source(s)
      ↓
Adapter(s)
      ↓
Frozen canonical PIT schemas   ← v0.1.0
      ↓
PIT store
      ↓
Existing V1 engines            ← unchanged
```

**Still unresolved — evidence-driven mapping, not architecture:**

```
                    ┌── Market      → ?
Canonical PIT  ←────┼── CA          → ?
                    ├── Fundamentals → ?
                    └── Events      → ?
```

Question is **not** “can one vendor pass everything?”  
Question is: **can we construct a combination of sources that collectively satisfies the frozen PIT contract?**

Final gate wording: **Final vendor-to-domain mapping must be justified by evidence** (before any adapter implementation).

### Parallel tracks (neither blocks the other)

```
Track 1 — Public research          Track 2 — Clarification (optional)
     ↓                                    ↓
Fill rows 1–22 from public docs      Ask vendor only to resolve UNKNOWN
     ↓                                    ↓
PASS-candidate / PARTIAL / UNKNOWN   response → evaluate; silence → stay UNKNOWN
```

Vendor email is a tool to resolve UNKNOWN — **not** a mandatory pause on Track 1.

---

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
| 11 | Historical revisions (original + restatement) | PASS-candidate | PASS-candidate† | PARTIAL → investigate | PARTIAL → investigate | UNKNOWN | UNKNOWN |
| 12 | Filing/publication → `reported_at` / feed `available_at` | PARTIAL | PARTIAL (strong model)‡ | PARTIAL → investigate | PARTIAL | PARTIAL / UNKNOWN | PARTIAL / UNKNOWN |
| 15 | Event historical `available_at` / calendar knowability | UNKNOWN | PARTIAL → investigate§ | UNKNOWN / PARTIAL | UNKNOWN | UNKNOWN | UNKNOWN |
| 20 | License permits intended personal research + local store | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN — contractual | UNKNOWN |

† Compustat marketplace: PIT changes since 1987, but “alongside change date in **North America only**” — India Snapshot depth must be confirmed; do not treat as PASS.  
‡ Capital IQ Financials publicly documents **FilingDate** and **Financial Instance Date** (first delivered) — dual-timestamp model maps well to our ladder; India sample still required.  
§ Global Events dataset claims **Point in Time history from August 2018** — better public signal than LSEG on knowability, still not India-proven PASS.

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

#### S&P Global — public-doc pass deepened (2026-10-03); **no critical row → PASS**

| Row | Cell | What public evidence establishes | What remains missing |
|-----|------|----------------------------------|----------------------|
| 11 | PASS-candidate | Compustat: PIT snapshots / original retained + subsequent changes; Capital IQ Premium Financials Snapshot = all filings + PIT observations. Sources: [Compustat Financials](https://www.marketplace.spglobal.com/en/datasets/compustat-financials-(8)), [Capital IQ Financials](https://www.marketplace.spglobal.com/en/datasets/s-p-capital-iq-financials-(10)), [Compustat brochure](https://www.spglobal.com/marketintelligence/en/documents/compustat-brochure_digital.pdf) | **India path:** marketplace PIT note “alongside change date in North America only”; WRDS Snapshot materials often NA-centric — confirm India revision/PIT SKU with sample |
| 12 | PARTIAL (strong model) | Capital IQ: **Financial Instance Date** = date/time first delivered; PIT details include filing dates + product delivery date; thought leadership distinguishes filing/press-release awareness vs DB input. [CIQ Financials](https://www.marketplace.spglobal.com/en/datasets/s-p-capital-iq-financials-(10)), [PIT vs lagged PDF](https://www.spglobal.com/content/dam/spglobal/mi/en/documents/general/sp-capitaliq-quantamental-point-in-time-vs-lagged-fundamentals.pdf) | India instance of dual fields; do not collapse FilingDate vs InstanceDate |
| 6 | PARTIAL / UNKNOWN | Corporate Tracker / entity CA history; third-party CA sourcing mentioned in Compustat materials | Historical **first feed availability** ≠ announcement/ex for India actions |
| 15 | PARTIAL → investigate | [Global Events](https://www.marketplace.spglobal.com/en/datasets/global-events-(11)): past+future events, history to ~2003; **PIT history from Aug 2018** claimed | Prove calendar knowability for NSE names (`as_of` T1 UNKNOWN → T2 KNOWN); pre-2018 gap |
| 20 | UNKNOWN | Xpressfeed Loader / Web Service Downloader load into **customer** DB/local dir (technical local processing). License: order-specific; FastTrack-style terms restrict redistribution — not a substitute for research-extract clause | Explicit private-research + offline replay clause |

**Broader rows (public, provisional — not critical-gate):**

| # | S&P mark | Note |
|---|----------|------|
| 1 | PARTIAL | Compustat includes daily/monthly market data via aggregator — not presumed India EOD authority |
| 2 | UNKNOWN | Turnover/INR not established from these pages |
| 3 | UNKNOWN | Nifty price index not established here |
| 4–5 | PARTIAL | Splits/dividends in market data; bonus/ex-date semantics need CA product confirmation |
| 7–9 | UNKNOWN / PARTIAL | Factors and unsupported CA typing not proven for our adjust rules |
| 10 | PASS-candidate | Deep standardized + statement history (global) |
| 13 | PARTIAL | Standardized periods/consolidation exist; map to our duration/unit enums with sample |
| 14 | PARTIAL | Global Events past+future earnings-related events |
| 16–17 | PARTIAL | Identifier history / inactive preservation claimed (Corporate Tracker / inactive flags) |
| 18–19 | UNKNOWN | India session calendar not proven from MI fundamentals pages |
| 21 | PASS-candidate | Official S&P products — not yfinance/nsepython |
| 22 | PARTIAL | Adapter must still emit frozen schemas; engines unchanged |

**Domain observation (S&P):** Fundamentals (+ CIQ dual timestamps) look strongest; Events have a clearer public PIT claim than LSEG (from Aug 2018) but India unproven; Market/Nifty/turnover likely **not** the reason to pick S&P alone — domain split with NSE/LSEG market still plausible.

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
S&P                weak?   partial        PASS-cand*††      PARTIAL→invest§    UNKNOWN
Bloomberg             ?       ?           investigate       ?                   UNKNOWN
FactSet               ?       ?           investigate       ?                   UNKNOWN
NSE                strong?  partial       weak/?            ?                   UNKNOWN
EODHD              control  weak          FAIL-as-sole      weak                ?
```

\*PASS-candidate on public docs only; India sample required.  
†CA: announcement/ex/factor/deltas documented; row-6 feed `available_at` still open.  
††India Compustat PIT change-date caveat.  
§Global Events PIT from Aug 2018 claimed — not PASS.

**Mapping rule:** A market vendor need not pass row 11; a fundamentals vendor need not supply Nifty. Domain split is first-class.

Allowed outcome: e.g. NSE/LSEG → market+CA, S&P/LSEG → fundamentals, S&P Global Events or other → events — **only after** each chosen domain’s critical rows are evidence-justified.

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

**Do not pay** and **do not start adapters** until **vendor-to-domain mapping** is justified: for each assigned domain, that source’s critical rows for that domain have evidence (sample and/or contract where required). Silence from LSEG does **not** pause S&P/Bloomberg/FactSet public audit.

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
| 2026-10-03 | S&P | 11 | Compustat/CIQ Snapshot retain original+changes; PIT since 1987; NA change-date caveat | public_doc | Compustat + CIQ Financials marketplace pages | unknown | partial | no | no | **11 stays PASS-candidate** |
| 2026-10-03 | S&P | 12 | FilingDate + Financial Instance Date (first delivered) documented | public_doc | CIQ Financials marketplace; PIT vs lagged fundamentals PDF | unknown | partial (strong model) | no | no | **12 stays PARTIAL (strong model)** |
| 2026-10-03 | S&P | 6 | Corporate Tracker / CA entity history; feed first-availability unproven | public_doc | Compustat materials | unknown | no | no | no | **6 stays PARTIAL/UNKNOWN** |
| 2026-10-03 | S&P | 15 | Global Events: history + **PIT from Aug 2018** claimed | public_doc | S&P Global Events marketplace | unknown | partial | no | no | **15 UNKNOWN → PARTIAL → investigate** |
| 2026-10-03 | S&P | 20 | Xpressfeed loads to customer DB (technical); order license required | public_doc | Xpressfeed Loader / brochure; S&P license T&Cs | unknown | n/a | no | no | **20 stays UNKNOWN** |

**LSEG public-doc ceiling reached** for general search; clarification/sample optional in parallel.  
**S&P public-doc pass recorded**; next Track 1 targets: Bloomberg, then FactSet. Do not send credentials/API keys/confidential contracts into chat — sanitized sample + clause wording only.

### Critical-row summary (after LSEG + S&P public passes)

```
           LSEG                 S&P
6          PARTIAL/UNKNOWN      PARTIAL/UNKNOWN
11         PASS-candidate       PASS-candidate (†India PIT caveat)
12         PARTIAL              PARTIAL (strong model)
15         UNKNOWN              PARTIAL → investigate
20         UNKNOWN              UNKNOWN

PASS (any vendor, critical)     0
```

---

## Decision log

| Date | Decision | Notes |
|------|----------|-------|
| 2026-10-03 | Audit set frozen; public-doc preliminary marks recorded | No vendor selected; no purchase; no adapter |
| 2026-10-03 | Evidence-log schema + temporal ladder locked | LSEG questionnaire optional (Track 2), not a project pause |
| 2026-10-03 | LSEG public-doc pass recorded; no cell → PASS | Fundamentals > events knowability for LSEG |
| 2026-10-03 | Process reframed: architecture fixed; **vendor-to-domain mapping** is the evidence gate | Parallel Track 1 + Track 2 |
| 2026-10-03 | S&P public-doc pass; row 15 → PARTIAL→investigate | Dual FilingDate/InstanceDate noted; India Compustat PIT caveat; next Bloomberg |

## Next engineering gate (still future)

Only after **vendor-to-domain mapping** is justified by evidence:

```
chosen Market source  ─┐
chosen CA source      ─┼→ Adapter(s) → frozen schemas → PIT store → V1 engines
chosen Fundamentals   ─┤
chosen Events source  ─┘
```

Then: schema-valid extracts → `validate-pit-store` → historical `assess()` replay — engines unchanged from `v0.1.0`.
