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
| 11 | Historical revisions (original + restatement) | PASS-candidate | PASS-candidate† | PARTIAL → investigate | PASS-candidate‖ | UNKNOWN | UNKNOWN |
| 12 | Filing/publication → `reported_at` / feed `available_at` | PARTIAL | PARTIAL (strong model)‡ | PARTIAL → investigate | PARTIAL (strong model)‖ | PARTIAL (strong)¶ | PARTIAL / UNKNOWN |
| 15 | Event historical `available_at` / calendar knowability | UNKNOWN | **PASS-candidate**§ | UNKNOWN / PARTIAL | UNKNOWN / PARTIAL | UNKNOWN | UNKNOWN |
| 20 | License permits intended personal research + local store | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN — contractual# | PASS-candidate** |

† Compustat marketplace: PIT changes since 1987, but “alongside change date in **North America only**” — India Snapshot depth must be confirmed; do not treat as PASS.  
‡ Capital IQ Financials publicly documents **FilingDate** and **Financial Instance Date** (first delivered) — dual-timestamp model maps well to our ladder; India sample still required.  
§ **Row 15 focused pass (2026-10-03):** Global Events — past+future events (incl. expected earnings), intraday delivery, **Point in Time = Yes**, PIT history from Aug 2018 based on **product delivery date** ([S&P Global Marketplace](https://www.marketplace.spglobal.com/en/datasets/global-events-(11))). Aligns with event_date + delivery/availability + revisions — still not PASS: need India sample proving the five Row-15 sample checks below. Do **not** claim “lossless” timestamp map until sample granularity is known; date-only delivery may normalize to EOD under frozen rules but must retain `timestamp_quality` / date-only distinction.  
‖ FactSet Fundamentals PIT: Asia-Pacific coverage from 1999; API `/point-in-time` + `/periods` (first published / superseded, UTC); NON-RESTATED vs RESTATED — India eight-name sample still required for PASS.  
¶ NSE filings UI exposes Broadcast / Exchange Received / Exchange Dissemination times (incl. revised submissions) — exchange temporal trail, not yet mapped for eight names → not PASS.  
# NSE: research/non-commercial recognized, but Market Data online-only; offline/removable media needs prior approval — do not infer local-store PASS.  
** EODHD public terms: non-professional users may store/manipulate/analyze for private non-commercial use (no redistribute) — still tie to exact subscription before PASS.

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
| 15 | **PASS-candidate** | [Global Events](https://www.marketplace.spglobal.com/en/datasets/global-events-(11)): past+future corporate events incl. expected earnings; **intraday** delivery; **Point in Time = Yes**; PIT history from **Aug 2018** based on **product delivery date** — not merely historical `event_date` | India sample must prove the **five checks** in “Next milestone” (coverage, revisions, delivery/availability, T1/T2 replay, EOD-contract mapping). Avoid “lossless” wording until granularity known. |
| 20 | UNKNOWN | Xpressfeed Loader / Web Service Downloader load into **customer** DB/local dir (technical local processing). License: order-specific; FastTrack-style terms restrict redistribution — not a substitute for research-extract clause | Explicit private-research + offline replay clause |

**S&P critical-row snapshot (after Row 15 focus):**

| Row | S&P |
|-----|-----|
| 6 | PARTIAL / UNKNOWN |
| 11 | PASS-candidate |
| 12 | PARTIAL |
| 15 | **PASS-candidate** |
| 20 | UNKNOWN |

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

**Domain observation (S&P):** Fundamentals (+ CIQ dual timestamps) remain strong; **Events are now the first existing-candidate PASS-candidate for row 15** (delivery-date PIT, not event_date proxy). Next evidence = India sample audited mechanically against frozen criteria (not vendor “PIT” marketing). Market/Nifty/turnover likely **not** the reason to pick S&P alone — domain split with NSE still plausible.

#### Bloomberg — public-doc pass (2026-10-03); **no critical row → PASS**

| Row | Cell | What public evidence establishes | What remains missing |
|-----|------|----------------------------------|----------------------|
| 11 | PARTIAL → investigate | [COFI PIT](https://professional.bloomberg.com/products/data/enterprise-catalog/cofi/): historical PIT company actuals, 100k+ active/inactive, ~17y on product page; as-reported formats; Data License delivery. Broader research catalog: long PIT history, accurate timestamps, granular metadata | Exact original→restatement chain for **Indian** issuers at `assess(T1)` vs `assess(T2)` |
| 12 | PARTIAL → investigate | “Accurate timestamps” advertised | Independent issuer `reported_at` **and** vendor `available_at` not demonstrated |
| 6 | UNKNOWN / PARTIAL | [CACS](https://professional.bloomberg.com/products/data/enterprise-catalog/event-driven-feeds/): 50 CA types, millions of instruments | Historical feed-availability / knowledge timestamp ≠ announcement/ex |
| 15 | UNKNOWN / PARTIAL | [EVTS](https://professional.bloomberg.com/products/data/enterprise-catalog/event-driven-feeds/): earnings dates, 48k+ companies, 100+ countries | `event_date` history ≠ calendar knowability at `as_of` |
| 20 | UNKNOWN | Data License: bulk/history via SFTP/REST/cloud; 20+ years bulk history claimed | Private local offline PIT reconstruct/replay clause |

#### FactSet — public-doc pass (2026-10-03); **no critical row → PASS**

| Row | Cell | What public evidence establishes | What remains missing |
|-----|------|----------------------------------|----------------------|
| 11 | PASS-candidate | [Fundamentals Point-in-Time](https://www.factset.com/marketplace/catalog/product/factset-fundamentals-point-in-time): since Feb 1999; Asia-Pacific 44k+ securities; restatements called out; [API](https://developer.factset.com/api-catalog/factset-fundamentals-api) `/point-in-time` + Report Builder NON-RESTATED vs RESTATED | Do **not** substitute Estimates PIT; India eight-name revision sample still required for PASS |
| 12 | PARTIAL (strong model) | `/periods`: first published + superseded (UTC); PIT snapshot times via `pitStart`/`pitEnd` | Map cleanly to issuer `reported_at` vs vendor `available_at` for India |
| 6 | UNKNOWN | No public proof of historical CA feed-availability independent of announcement/ex | Same row-6 bar as peers |
| 15 | UNKNOWN / PARTIAL | Separate calendar/event products exist in FactSet suite; not proven as historical knowability store | T1 UNKNOWN → T2 KNOWN reconstruct |
| 20 | UNKNOWN | DataFeed Loader can load DB / store files locally (technical); public ToS restrict copy/redistribute | Product contract for private research offline extract |

**Important:** FactSet Estimates PIT ≠ statement PIT. Only Fundamentals / As-Reported / Fundamentals PIT count toward row 11.

#### NSE Data & Analytics / NSE Indices — public-doc pass (2026-10-03); **no critical row → PASS**

| Row | Cell | What public evidence establishes | What remains missing |
|-----|------|----------------------------------|----------------------|
| 6 | PARTIAL | CA reports with ex-dates/related dates; filings UI distinguishes corporate announcements vs corporate actions | Historical feed-availability ≠ announcement/ex for as_of reconstruct |
| 11 | UNKNOWN | No public original-vs-restated PIT financial-statement store | Fundamentals domain → not NSE’s role |
| 12 | PARTIAL (strong) | Filings expose **Broadcast Date/Time**, **Exchange Received Time**, **Exchange Dissemination Time** (incl. revised submissions) — real exchange temporal trail, not a generic `date` | Exact canonical map to `reported_at` / `available_at` for eight names + history |
| 15 | UNKNOWN | Announcement timestamps ≠ historical earnings-calendar knowledge-state feed | Row-15 bottleneck remains |
| 20 | UNKNOWN — contractual | Researchers/non-commercial recognized; Market Data **online**; offline/removable media needs prior approval ([NSE data policy](https://www.nseindia.com/static/market-data/nse-data-policy)) | Explicit local historical extract rights in Relevant Agreement |

**Broader / architecture (NSE):**

| Topic | Stance |
|-------|--------|
| Market EOD / CM | Strong candidate — [EOD/historical](https://www.nseindia.com/static/market-data/eod-historical-data-subscription); securities master, CA report, settlement calendar in market-data reports |
| Nifty 50 | **Price Return** vs Total Return distinguished; Nifty 50 factsheet reports both — aligns with frozen `NIFTY50_PRICE_INDEX` (not TRI) via [Nifty Indices](https://www.niftyindices.com/) materials |
| Sessions | Settlement calendar supports India session authority (map to `SessionCalendar`) |
| Domain role | Market (+ index) + partial CA timestamps; **not** sole fundamentals/events |

#### EODHD (control) — public-doc pass (2026-10-03); **no critical row → PASS**

| Row | Cell | What public evidence establishes | What remains missing |
|-----|------|----------------------------------|----------------------|
| 6 | UNKNOWN | Split API: effective/ex-split dates + ratios; NSE supported | Historical vendor `available_at` / knowledge-state |
| 11 | UNKNOWN | Financials present; no original+restated PIT retrieval | Control failure mode for sole fundamentals |
| 12 | PARTIAL / UNKNOWN | `filing_date` on statements; `reportDate` on earnings | Dual issuer/feed revision chain |
| 15 | UNKNOWN | Historical earnings/split calendars | Calendar knowability at `as_of` |
| 20 | PASS-candidate | Terms: non-professional users may **store, manipulate, analyze** for private non-commercial use; no redistribute ([EODHD](https://eodhd.com/)) | Tie exact subscription to eight-name India extract before PASS |

**Control lesson:** historical data ✅ · historical events ✅ · filing/report dates ✅ · **PIT knowledge state ❌** — exactly what the audit must catch. Not a sole fundamentals/events source; not a Yahoo-scraper path.

---

## Domain suitability sketch (after Row 15 focused pass)

```
                    Market      CA         Fundamentals      Events                License
LSEG                  ?          ?           strong            ?                   UNKNOWN
S&P                   ?          ?           strong            PASS-candidate§     UNKNOWN
Bloomberg             ?          ?           investigate       ?                   UNKNOWN
FactSet               ?          ?           strong            ?                   UNKNOWN
NSE                 strong     partial       weak/?            ?              UNKNOWN (offline)
EODHD               control    control       weak              weak           PASS-candidate**
```

**Convergence:**
- **Fundamentals deeper validation:** LSEG · S&P · FactSet (Bloomberg still investigate)  
- **Market / India exchange:** NSE (EOD + Price Return Nifty + filing timestamps)  
- **Historical event knowledge (row 15):** no longer “does anyone have historical earnings dates?” — S&P Global Events is first existing-candidate **PASS-candidate**; specialists also exist (see below)  
- **License:** premium vendors UNKNOWN; NSE offline constraint; EODHD terms clear for private store  

**Insight:** Historical *values* ≠ historical *information-state*. Temporal ladder stays untouched. **Do not weaken Row 15.**

**Mapping rule:** A market vendor need not pass row 11; a fundamentals vendor need not supply Nifty. Domain split is first-class.

### Row 15 focused investigation — result (2026-10-03)

Bottleneck reframed: not historical earnings dates (many vendors have those), but **delivery-dated PIT calendar state**.

#### Existing candidates (Row 15)

| Vendor | Row 15 | Note |
|--------|--------|------|
| **S&P Global** | **PASS-candidate** | Global Events: future+past, intraday, PIT=Yes, history from Aug 2018 **based on product delivery date** |
| LSEG | UNKNOWN | event_date history ≠ knowability |
| Bloomberg | UNKNOWN / PARTIAL | EVTS calendar; knowability unproven |
| FactSet | UNKNOWN / PARTIAL | calendar products exist; knowability unproven |
| NSE | UNKNOWN | announcement timestamps ≠ calendar knowledge-state feed |
| EODHD | UNKNOWN | control: reportDate ≠ knowledge state |

#### Specialist / exploratory (not in main six; not PASS)

| Vendor | Role | Public fit | India / license |
|--------|------|------------|-----------------|
| **EventVestor** | Specialist candidate | 15+ y PIT corporate-event history; Event Date + Trade Date + EV Timestamp; claims backtests never see data before available; earnings-date changes / restatements / filing delays | India/NSE: **UNKNOWN** |
| **Wall Street Horizon** | Specialist candidate | DateBreaks: prior/current/forecast earnings dates; preliminary announcement dates; revision reasons; PIT history to 2006 | India + availability semantics + license: **UNKNOWN** |
| **Aiera** | Exploratory | Historical+upcoming calendar; created/modified timestamps; ISIN/RIC/local ticker; international equities | Exact Row-15 knowledge-state semantics: **not established** |

Specialist semantic fit ≠ PASS. Do not add as passing sources without India + availability + license evidence.

#### Outcomes A / B / C (updated)

| Outcome | Status |
|---------|--------|
| **A** — Existing vendor solves it | **Potentially yes: S&P Global** (strongest public match among the six) |
| **B** — Specialist event source | **Potentially yes:** EventVestor, Wall Street Horizon (India unknown) |
| **C** — Nobody can provide it | **No longer the working assumption** — requirement appears commercially available somewhere; still no usable India-proven source |

Do **not** choose C. Do **not** revise Event-domain requirements yet.

### Track 1 public research — clean stop

```
V1 engine                  🔒 frozen v0.1.0
Track A requirements       🔒 frozen
Vendor methodology         🔒 frozen
Public vendor audit        ✅ complete
Critical PASS              0

S&P Row 15                 PASS-candidate
S&P India sample           ⏳ next evidence
Adapter / schema / engine  ❌
Purchase / decision gate   ❌ / 🔒
```

**Do not** start another broad vendor-search cycle. Next meaningful artifact is the S&P sample → evidence-log update → Row 15 decision.

### Next milestone — S&P Global Events India sample

**Wording (use this, not “losslessly”):**

> Map S&P product delivery history to the frozen EOD `available_at` semantics **without introducing unsupported timing assumptions**.

**Date-only vs true timestamp (frozen distinction — keep intact):**

If the sample only has `delivery_date = 2026-09-05` (no time), V1 may deterministically normalize for EOD assessment as:

```
available_at = 2026-09-05T15:30:00+05:30
```

That is **EOD-compatible normalization**, not proof the underlying information was actually available at 15:30. Record `timestamp_quality` / date-only (or equivalent frozen policy) — do not collapse into a true timestamp claim.

**Five things the sample must prove:**

```
1. Indian security coverage
        ↓
2. Historical event/date revisions
        ↓
3. Historical product-delivery / availability information
        ↓
4. Replay gives different knowledge states at T1/T2
        ↓
5. The resulting state can be mapped to the frozen EOD contract
```

**Strongest conceptual sample:**

```
Event revision history
  T1 → expected earnings date = D1
  T2 → expected earnings date = D2

delivery / availability
  T1 record became available by T1
  T2 revision became available by T2

Engine-level replay
  assess(T1) → D1
  assess(T2) → D2
  (no later information leaking backward)
```

Audit the sample **mechanically against frozen criteria** — do not debate the vendor’s “PIT” terminology.

**Validation order if S&P sample fails India/granularity/license:**

```
1. S&P Global Global Events (Plus)   ← first
2. EventVestor
3. Wall Street Horizon
```

Also still ask (for whichever source progresses): coverage start for those Indian securities; license for local offline retention.

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

**Knowability + revision case (required for PASS, not merely first appearance):**

```
as_of = Sep 1  → UNKNOWN
as_of = Sep 5  → KNOWN

Then revision chain:
Sep 5:  expected earnings date = Sep 20
Sep 12: expected earnings date = Sep 22
Sep 15: expected earnings date = Sep 20

Verify:
assessment(Sep 10) → Sep 20
assessment(Sep 13) → Sep 22
assessment(Sep 16) → Sep 20
```

This tests **historical knowledge-state reconstruction**, not merely whether the vendor stores historical events.

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

**Earnings calendar (row 15)** for at least one date change or first appearance **and** the revision chain above:

- calendar record as of T1 (UNKNOWN vs KNOWN)  
- calendar record as of T2  
- timestamp when the date first appeared or changed (delivery / available_at)  
- expected-date revisions across Sep 5 / 12 / 15 with assessment checks at Sep 10 / 13 / 16  


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

**Do not pay** and **do not start adapters** until **vendor-to-domain mapping** is justified: for each assigned domain, that source’s critical rows for that domain have evidence (sample and/or contract where required). Track 1 public research is at a **clean stop**. **Next artifact:** S&P Global Events India sample + delivery/availability evidence → evidence-log → Row 15 decision (mechanical audit vs frozen criteria).

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
- Events: “historical earnings dates” is **not** enough for row 15 PASS — need T1/T2 knowledge-state replay (`assess(T1)→D1`, `assess(T2)→D2`, no backward leak) **plus** revision chain. Map product delivery history to frozen EOD `available_at` **without unsupported timing assumptions**; date-only delivery ≠ proven 15:30 availability.  

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
| 2026-10-03 | S&P | 15 | Global Events: history + **PIT from Aug 2018** claimed | public_doc | S&P Global Events marketplace | unknown | partial | no | no | **15 UNKNOWN → PARTIAL → investigate** (superseded same day by focused pass below) |
| 2026-10-03 | S&P | 15 | Global Events: past+future (incl. expected earnings); intraday; PIT=Yes; PIT history from Aug 2018 **based on product delivery date** | public_doc | [S&P Global Events marketplace](https://www.marketplace.spglobal.com/en/datasets/global-events-(11)) | unknown | partial → strong (delivery-date PIT; India+granularity open) | no | no | **15 PARTIAL → PASS-candidate**; next = India sample (five checks; no “lossless” claim yet) |
| 2026-10-03 | EventVestor | 15 | 15+ y PIT corporate-event history; Event/Trade/EV Timestamp; backtests never see data early; earnings-date changes | public_doc | EventVestor product materials | unknown | strong semantic; India unproven | no | no | Specialist candidate — **not** main-matrix PASS |
| 2026-10-03 | Wall Street Horizon | 15 | DateBreaks: prior/current/forecast + preliminary dates; revision reasons; PIT to 2006 | public_doc | Wall Street Horizon DateBreaks materials | unknown | strong semantic; India/license unproven | no | no | Specialist candidate — **not** main-matrix PASS |
| 2026-10-03 | Aiera | 15 | Historical+upcoming; created/modified timestamps; ISIN/RIC/local ticker; international | public_doc / dev_doc | Aiera API / calendar docs | unknown | exploratory — knowledge-state semantics not established | no | no | Exploratory only |
| 2026-10-03 | S&P | 20 | Xpressfeed loads to customer DB (technical); order license required | public_doc | Xpressfeed Loader / brochure; S&P license T&Cs | unknown | n/a | no | no | **20 stays UNKNOWN** |
| 2026-10-03 | Bloomberg | 11 | COFI PIT historical actuals / as-reported; 100k+ names; Data License | public_doc | bloomberg.com/professional COFI + investment-research catalog | unknown | partial | no | no | **11 stays PARTIAL → investigate** |
| 2026-10-03 | Bloomberg | 12 | Accurate timestamps advertised | public_doc | Bloomberg research-data product pages | unknown | partial | no | no | **12 stays PARTIAL → investigate** |
| 2026-10-03 | Bloomberg | 6 | CACS substantial CA calendar | public_doc | Bloomberg event-driven feeds (CACS) | unknown | no | no | no | **6 stays UNKNOWN/PARTIAL** |
| 2026-10-03 | Bloomberg | 15 | EVTS historical earnings/events calendar | public_doc | Bloomberg event-driven feeds (EVTS) | unknown | no | no | no | **15 stays UNKNOWN/PARTIAL** |
| 2026-10-03 | Bloomberg | 20 | Bulk/history delivery SFTP/REST/cloud | public_doc | Bloomberg Data License materials | unknown | n/a | no | no | **20 stays UNKNOWN** |
| 2026-10-03 | FactSet | 11 | Fundamentals PIT since 1999; APAC coverage; API PIT + NON-RESTATED | public_doc / dev_doc | FactSet marketplace Fundamentals PIT; developer Fundamentals API | unknown | partial | no | no | **11 PARTIAL→investigate → PASS-candidate** |
| 2026-10-03 | FactSet | 12 | /periods first-published + superseded (UTC); pitStart/pitEnd | dev_doc | FactSet Fundamentals PIT API docs | unknown | partial (strong model) | no | no | **12 → PARTIAL (strong model)** |
| 2026-10-03 | FactSet | 6 | No public CA feed-availability proof | — | — | unknown | no | no | no | **6 stays UNKNOWN** |
| 2026-10-03 | FactSet | 15 | Calendar products exist; knowability unproven | public_doc | FactSet suite (calendar/events) | unknown | no | no | no | **15 stays UNKNOWN/PARTIAL** |
| 2026-10-03 | FactSet | 20 | DataFeed can store locally (technical); ToS restrict redistribute | public_doc | DataFeed Loader guide; FactSet ToU samples | unknown | n/a | no | no | **20 stays UNKNOWN** |
| 2026-10-03 | NSE | 6 | CA reports / ex-dates; announcements vs actions distinguished | public_doc | NSE market-data / CA reports; filings UI | yes | no | no | no | **6 stays PARTIAL** |
| 2026-10-03 | NSE | 11 | No PIT statement revision store in public materials | public_doc | — | yes | no | no | no | **11 stays UNKNOWN** |
| 2026-10-03 | NSE | 12 | Broadcast / Exchange Received / Dissemination timestamps on filings (incl. revised) | public_doc | NSE corporate filings interface | yes | partial (strong exchange trail) | no | no | **12 → PARTIAL (strong)** |
| 2026-10-03 | NSE | 15 | Announcement timestamps ≠ earnings calendar knowability | public_doc | NSE filings / announcements | yes | no | no | no | **15 stays UNKNOWN** |
| 2026-10-03 | NSE | 20 | Online Market Data; offline modes need prior approval | public_doc / contract_clause | NSE Data Sharing & Usage Policy | yes | n/a | no | no | **20 stays UNKNOWN — contractual** |
| 2026-10-03 | NSE | 3 | Nifty 50 Price Return vs TRI distinguished | public_doc | Nifty Indices Nifty 50 factsheet | yes | n/a | no | n/a | Supports frozen price-index benchmark |
| 2026-10-03 | EODHD | 6 | Split dates/ratios; no feed available_at | public_doc | EODHD split / CA API docs | yes (NSE supported) | no | no | no | **6 stays UNKNOWN** |
| 2026-10-03 | EODHD | 11 | No original+restated PIT | public_doc | EODHD fundamentals docs | unknown | no | no | no | **11 stays UNKNOWN** |
| 2026-10-03 | EODHD | 12 | filing_date / reportDate exist | public_doc | EODHD fundamentals / earnings docs | unknown | partial | no | no | **12 stays PARTIAL/UNKNOWN** |
| 2026-10-03 | EODHD | 15 | Historical earnings dates ≠ knowability | public_doc | EODHD calendar docs | unknown | no | no | no | **15 stays UNKNOWN** |
| 2026-10-03 | EODHD | 20 | Non-pro ToS: store/manipulate/analyze private non-commercial | contract_clause | EODHD terms | unknown | n/a | no | partial | **20 UNKNOWN → PASS-candidate** |

Do not send credentials/API keys/confidential contracts into chat — sanitized sample + clause wording only.

### Critical-row summary (after Row 15 focused pass)

```
           LSEG              S&P                 Bloomberg           FactSet            NSE                EODHD
6          PARTIAL/UNKNOWN   PARTIAL/UNKNOWN     UNKNOWN/PARTIAL     UNKNOWN            PARTIAL            UNKNOWN
11         PASS-candidate    PASS-candidate†     PARTIAL→invest      PASS-candidate     UNKNOWN            UNKNOWN
12         PARTIAL           PARTIAL (strong)    PARTIAL→invest      PARTIAL (strong)   PARTIAL (strong)   PARTIAL/UNKNOWN
15         UNKNOWN           PASS-candidate§     UNKNOWN/PARTIAL     UNKNOWN/PARTIAL    UNKNOWN            UNKNOWN
20         UNKNOWN           UNKNOWN             UNKNOWN             UNKNOWN            UNKNOWN (offline)  PASS-candidate

PASS (any vendor, critical)     0
```

**Row 15 side board:** EventVestor (specialist) · Wall Street Horizon (specialist) · Aiera (exploratory) — none PASS.

**Next artifact:** S&P Global Events **India sample** + delivery/availability evidence → evidence-log update → Row 15 decision. Map delivery history to frozen EOD `available_at` **without unsupported timing assumptions** (not “losslessly”). Then EventVestor / WSH only if S&P fails the five checks.

---

## Decision log

| Date | Decision | Notes |
|------|----------|-------|
| 2026-10-03 | Audit set frozen; public-doc preliminary marks recorded | No vendor selected; no purchase; no adapter |
| 2026-10-03 | Evidence-log schema + temporal ladder locked | LSEG questionnaire optional (Track 2), not a project pause |
| 2026-10-03 | LSEG public-doc pass recorded; no cell → PASS | Fundamentals > events knowability for LSEG |
| 2026-10-03 | Process reframed: architecture fixed; **vendor-to-domain mapping** is the evidence gate | Parallel Track 1 + Track 2 |
| 2026-10-03 | S&P public-doc pass; row 15 → PARTIAL→investigate | Dual FilingDate/InstanceDate; India Compustat PIT caveat |
| 2026-10-03 | Bloomberg public-doc pass; no cell → PASS | Pattern: PIT fundamentals promising; CA/event knowability unresolved |
| 2026-10-03 | FactSet public-doc pass; row 11 → PASS-candidate | APAC PIT since 1999; Estimates PIT excluded |
| 2026-10-03 | NSE + EODHD public passes; six-candidate Track 1 complete | NSE 12 PARTIAL(strong); EODHD 20 PASS-candidate; **next = focused Row 15** |
| 2026-10-03 | Row 15 focused pass: S&P Global Events → **PASS-candidate** | Delivery-date PIT (Aug 2018+); C no longer working assumption; specialists noted; **next = India sample**; engines/specs unchanged |
| 2026-10-03 | Track 1 public research **clean stop** | Next milestone wording: map delivery → frozen EOD `available_at` without unsupported timing assumptions; five sample proofs; date-only ≠ true 15:30; mechanical audit vs frozen criteria |

## Next engineering gate (still future)

Only after **vendor-to-domain mapping** is justified by evidence:

```
chosen Market source  ─┐
chosen CA source      ─┼→ Adapter(s) → frozen schemas → PIT store → V1 engines
chosen Fundamentals   ─┤
chosen Events source  ─┘
```

Then: schema-valid extracts → `validate-pit-store` → historical `assess()` replay — engines unchanged from `v0.1.0`.
