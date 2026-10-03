# Vendor → domain mapping (evidence-driven)

**Status:** PASS — mapping framework opened; **selection deliberately not yet made**  
**Companion:** [VENDOR_AUDIT_LIVE.md](VENDOR_AUDIT_LIVE.md) · [VENDOR_AUDIT_MATRIX.md](VENDOR_AUDIT_MATRIX.md) · [DATA_PROMOTION_V1.md](DATA_PROMOTION_V1.md) · [adapter-contract](../src/lib/adapter-contract.mjs)  
**Date:** 2026-10-03  

## Discipline (locked)

```
evidence → domain → selection → adapter
```

**Not:**

```
vendor → adapter → try to make the system fit
```

This document is a **decision ledger**, not an implicit vendor-selection document.

| Status word | Means | Does **not** mean |
|-------------|--------|-------------------|
| **PROPOSED** | Current evidence suggests this source *may* satisfy the domain | We have chosen it; we will adapt the system around it |
| **OPEN** | No credible primary yet | — |
| **BLOCKED** | Candidate exists but a named evidence gate is unmet | Silently treat as SELECTED |
| **UNKNOWN** | Requirement not established | Fill gap with marketing claims |
| **REJECTED** | Evidence shows the source cannot satisfy the domain (or kill criteria) | Temporary inconvenience |
| **SELECTED** | All critical gates cleared; adapter boundary may be crossed | “Looks good enough” / convenience |

**OPEN / BLOCKED / UNKNOWN / PROPOSED must never silently become SELECTED.**

### Temporal ladder (must not collapse)

```
announcement
        ≠
issuer reported_at
        ≠
vendor delivery / availability
        ≠
knowledge state at as_of
```

The Adapter Contract defines **emission shape**. It does **not** authorize inventing `available_at` from a weaker vendor field, or weakening Row 6 / 12 / 15 because a vendor only exposes an approximation.

Date-only delivery → EOD normalization with `timestamp_quality: date_only` ≠ true intraday availability.

### Critical PASS count

**PASS = 0** on critical audit rows. PASS-candidate ≠ PASS. Row 15 stays **PASS-candidate** until the S&P India sample proves the frozen requirement.

---

## Milestone board

| Milestone | Status |
|-----------|--------|
| V1 frozen (`v0.1.0`) | ✅ PASS |
| Vendor audit framework | ✅ PASS / ongoing evidence |
| PIT validator | ✅ PASS |
| Historical replay | ✅ PASS |
| Adapter contract (vendor-neutral) | ✅ PASS |
| **Vendor / domain mapping** | ✅ Framework PASS — selection not made |
| Resolve domain evidence | ▶ NEXT |
| S&P Row 15 | PASS-candidate until India sample |
| Vendor adapters | Deferred until domain **SELECTED** |
| Decision layer | Permanently DISABLED in V1 |

```
✅ V1 frozen
✅ PIT validator
✅ Historical replay
✅ Vendor-neutral adapter contract
✅ Evidence-driven domain mapping (framework)

        ↓
🔎 Resolve domain evidence
        ↓
SELECT sources (per-domain gate)
        ↓
implement only selected adapters
        ↓
real extracts
        ↓
historical replay against real data
```

---

## Selection gate (mandatory before any adapter)

Before **any** adapter is written for a domain, that domain must mechanically traverse:

```
PROPOSED
   ↓
Public evidence sufficient
   ↓
Sample / evidence validation
   ↓
Canonical mapping demonstrated
   ↓
License / local-store confirmed
   ↓
SELECTED
   ↓
Adapter implementation
```

### SELECTED requires

1. Status explicitly set to **SELECTED** in this ledger (not implied).  
2. **Zero UNKNOWN** on critical requirements for that domain (rows that gate the domain — see per-domain cards).  
3. India coverage + sample validation recorded.  
4. Canonical field mapping demonstrated without inventing temporal fields.  
5. License/local-store confirmed for the intended extract path.  
6. Evidence references cited (URLs, sample ids, contract clause notes — sanitized).  
7. Remaining uncertainty documented (may be non-critical only).

Justified **PARTIAL** on a non-critical residual may remain only if explicitly accepted in “Remaining uncertainty” and it does **not** break PIT knowledge-state reconstruction.

---

## Provisional domain map (candidacy only)

| Domain | Candidate(s) | Status | What still prevents SELECTED |
|--------|--------------|--------|------------------------------|
| **M — Market** | NSE + Indices PR | PROPOSED | Licensing/local-store; complete historical coverage / turnover / session validation |
| **C — Corporate actions** | — | OPEN | Row 6: historical `available_at` / knowledge-state evidence |
| **F — Fundamentals** | LSEG / S&P / FactSet shortlist | PROPOSED (multi) | India samples proving revision + PIT semantics (not reputation) |
| **E — Events** | S&P Global Events | PROPOSED / BLOCKED on sample | India sample + mechanical Row 15 T1/T2 evaluation |

| Cross-cutting | Status | Note |
|---------------|--------|------|
| License / local store (row 20) | OPEN | Premium UNKNOWN; NSE offline constraint; EODHD PASS-candidate (control only) |
| EODHD | CONTROL | Historical values ≠ knowledge state; not a domain primary |

---

## Per-domain SELECTED gate cards

Copy/fill when advancing a candidate. **Do not mark SELECTED with any critical field still UNKNOWN.**

### Template

```
Domain:
Candidate:
Status: PROPOSED | BLOCKED | SELECTED | REJECTED | OPEN

Required evidence:
- [ ] India coverage
- [ ] Historical depth
- [ ] PIT / availability semantics
- [ ] Revision behavior
- [ ] Canonical field mapping
- [ ] Coverage consistency
- [ ] License / local storage
- [ ] Sample validation
- [ ] Known unsupported cases

Critical audit rows for this domain: (list) — none may remain UNKNOWN at SELECTED

Selection decision:
Evidence references:
Remaining uncertainty:
```

### M — Market

```
Domain: M — Market (bars, turnover, Nifty price index, sessions)
Candidate: NSE Data & Analytics / NSE Indices
Status: PROPOSED

Required evidence:
- [ ] India coverage                    — public: native NSE (partially shown)
- [ ] Historical depth                  — EOD/historical product exists; eight-name window TBD
- [ ] PIT / availability semantics      — session EOD available_at policy; date_only vs exact
- [ ] Revision behavior                 — bar corrections / restates if any
- [ ] Canonical field mapping           — OHLCV, turnover, Nifty PR (not TRI), session calendar
- [ ] Coverage consistency              — missing sessions / holidays without inventing bars
- [ ] License / local storage           — UNKNOWN (offline modes need approval)  ← blocker
- [ ] Sample validation                 — eight-name extract TBD
- [ ] Known unsupported cases           — document gaps (e.g. turnover fallback)

Critical rows: 1–3, 18–20 (domain-relevant). Row 20 must not be UNKNOWN at SELECTED.

Selection decision: NOT SELECTED
Evidence references: VENDOR_AUDIT_LIVE NSE notes; Nifty Indices factsheet (PR vs TRI)
Remaining uncertainty: local-store rights; turnover path; full window backfill
```

**Note:** “NSE data exists” is **not** sufficient. Close historical coverage, session/calendar behavior, index basis (price return), and licensing/storage before SELECTED.

### C — Corporate actions

```
Domain: C — Corporate actions
Candidate: (none)
Status: OPEN

Required evidence:
- [ ] India coverage
- [ ] Historical depth
- [ ] PIT / availability semantics      — row 6: feed available_at ≠ announcement/ex  ← blocker
- [ ] Revision behavior                 — corrected factors / terms
- [ ] Canonical field mapping           — type, ex_date, factor, available_at, unsupported fail-loud
- [ ] Coverage consistency
- [ ] License / local storage
- [ ] Sample validation
- [ ] Known unsupported cases           — rights/merger/etc. must fail loud

Critical rows: 6, 7–9, 20. Row 6 must not be UNKNOWN at SELECTED.

Selection decision: NOT SELECTED — no primary candidate
Evidence references: —
Remaining uncertainty: entire knowledge-state availability problem
```

**Note:** Perfect ex-dates and ratios can still **fail** if historical knowledge-state reconstruction is unreliable. Do not SELECT on announcement/ex alone.

### F — Fundamentals

```
Domain: F — Financial statements
Candidates: LSEG | S&P | FactSet   (Bloomberg: investigate)
Status: PROPOSED (multi-candidate; no winner)

Required evidence (per candidate before that candidate can be SELECTED):
- [ ] India coverage                    — eight names
- [ ] Historical depth
- [ ] PIT / availability semantics      — row 12: reported_at vs vendor available_at
- [ ] Revision behavior                 — row 11: original + restatement T1/T2
- [ ] Canonical field mapping           — period duration/unit/consolidation/currency
- [ ] Coverage consistency
- [ ] License / local storage           — row 20
- [ ] Sample validation                 — India revision sample  ← blocker for all
- [ ] Known unsupported cases

Critical rows: 11, 12, 20 (and 10/13 as supporting). Rows 11/12 must not be UNKNOWN at SELECTED.

Selection decision: NOT SELECTED — choose from India samples, not reputation / PIT marketing
Evidence references: VENDOR_AUDIT_LIVE LSEG/S&P/FactSet fundamentals notes
Remaining uncertainty: which shortlist member clears India revision + dual timestamps + license
```

### E — Events

```
Domain: E — Events (earnings calendar knowledge state)
Candidate: S&P Global Events (Plus)
Status: PROPOSED / BLOCKED on India sample
Side board: EventVestor, Wall Street Horizon (India UNKNOWN) — not SELECTED

Required evidence:
- [ ] India coverage                    — RELIANCE / HDFCBANK / INFY  ← blocker
- [ ] Historical depth                  — PIT from Aug 2018 claimed; India start TBD
- [ ] PIT / availability semantics      — product delivery date → available_at (no unsupported assumptions)
- [ ] Revision behavior                 — expected-date changes; T1/T2 assess
- [ ] Canonical field mapping           — event_date, available_at, source_version, timestamp_quality
- [ ] Coverage consistency
- [ ] License / local storage
- [ ] Sample validation                 — mechanical Row 15 chain  ← blocker
- [ ] Known unsupported cases

Critical rows: 15, 20. Row 15 must not remain PASS-candidate/UNKNOWN at SELECTED — needs PASS
  (or documented PARTIAL that still reconstructs knowledge state — exceptional, must be explicit).

Selection decision: NOT SELECTED
Evidence references: S&P Global Events marketplace (delivery-date PIT); audit live § Row 15
Remaining uncertainty: entire India sample + mechanical eval

Mechanical test (mandatory for SELECTED):
  as_of T1 → expected D1; as_of T2 → expected D2; no backward leak
  Plus first-appearance UNKNOWN → KNOWN where applicable
```

**Do not** debate whether the vendor is “PIT.” Run the mechanical T1/T2 revision-chain test on the sample.

---

## Evidence input sequence (parallel OK)

1. **S&P Events India sample** → mechanical Row 15 evaluation → update E card / audit cell  
2. **Fundamentals India revision samples** → compare LSEG / S&P / FactSet against frozen PIT semantics  
3. **CA availability evidence** → determine whether Source C can satisfy knowledge-state (row 6)  
4. **License / local-store clauses** → prevent technically valid sources from failing operationally later  

No adapter before these gates resolve for the domain being implemented.

---

## Explicit non-actions

- No S&P / LSEG / NSE / FactSet adapter code  
- No canonical schema reshape for vendor fields  
- No Row 15 → PASS without sample  
- No premature SELECTED  
- No vendor data into engines  
- No weakening of the temporal ladder  

---

## Decision log

| Date | Decision |
|------|----------|
| 2026-10-03 | Open evidence-driven domain mapping; provisional M=NSE, F=shortlist, E=S&P Events (blocked on sample), C=OPEN |
| 2026-10-03 | Adapter contract must not weaken temporal ladder; Row 15 stays PASS-candidate; critical PASS = 0 |
| 2026-10-03 | **Mapping framework PASS**; selection not made. Explicit SELECTED gate + per-domain evidence cards. OPEN/BLOCKED/UNKNOWN/PROPOSED never silently → SELECTED |
| 2026-10-03 | **Hold for evidence** — no further architecture. Only inputs that may move toward adapters: E sample, F revision samples, C available_at, licensing. Selection OPEN; adapters prohibited |
