# Architecture (V1)

Read this after [CHARTER](CHARTER.md). It describes how the running system is wired so a human or AI can understand the codebase without reverse-engineering every file.

## Purpose in one sentence

Given a cash-equity symbol, an EOD `as_of`, and optional position display input, produce **evidence + assessment** JSON while the **decision layer always returns `DISABLED`**.

## Layer diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Client (web/ or CLI)                                            │
│   POST /api/assess  or  npm run assess                          │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ assess.mjs — pipeline orchestrator                              │
│   resolve security → default/validate as_of → load PIT slice    │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ PIT store (pit-store.mjs + session-calendar.mjs + prices.mjs)   │
│   available_at ≤ as_of · SessionCalendar EOD authority          │
│   researchAdjustedClose (split/bonus only)                      │
│   statement/event revision selection                            │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌────────────── Evidence engines (typed inputs only; no position) ─┐
│  quality.mjs     market.mjs      events.mjs                     │
│  labels/specs    tape aggregate  timing CLEAR/UNFAVORABLE/…     │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ assemble-assessment.mjs                                         │
│   evidence.status · assessment.sufficiency · why · what-changes │
│   forbids trading-verb prose                                    │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ decision-gate.mjs  ← sole writer of decision + confidence       │
│   V1: ignore assessment/evidence/position/context               │
│   always DISABLED / RESEARCH_GATE_CLOSED / WITHHELD             │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ position-display.mjs (after gate; never fed back into engines)  │
│   raw P&L or UNAVAILABLE if split/bonus after entry             │
└─────────────────────────────────────────────────────────────────┘
```

**Hard rule:** Evidence → Assessment → Decision. Engines never see position. Only `decision-gate.mjs` writes `decision.state`.

## End-to-end request flow

1. **Input** — `{ symbol, as_of?, position? }`
   - `as_of` omitted → latest completed session close from fixture calendar (`YYYY-MM-DDT15:30:00+05:30`).
   - Non-EOD `as_of` → throw `NON_EOD_AS_OF` (HTTP 400).
2. **Security resolve** — `universe.json` first; fixture-only `SYN_*` ids fall back to the PIT store (for adversarial tests). UI lists only the eight research names.
3. **PIT load** — `createPitStore().loadAsOf(security_id, as_of)` builds frozen:
   - `context` (`as_of`, timezone, `data_version`, horizon 5–20 trading days)
   - `marketInput` (raw bars, adjusted series, Nifty price-index bars, traded values)
   - `fundamentalInput` (statement revisions visible at `as_of`)
   - `eventInput` (events visible at `as_of`)
4. **Engines** — quality / market / events run independently on typed inputs.
5. **Assemble** — roll up `evidence.status`, compute `assessment.sufficiency`, write factual WHY / what-would-change lines (no trade advice).
6. **Gate** — while `config/decision-gate.json` `enabled: false`, always `DISABLED`.
7. **Position display** — cosmetic P&L from raw last close; engines unchanged.
8. **Output** — single JSON object (see [OUTPUT_CONTRACT](OUTPUT_CONTRACT.md)).

## Module map

| Path | Role |
|------|------|
| `src/lib/assess.mjs` | Public pipeline entry (`assess`) |
| `src/lib/pit-store.mjs` | Fixture load, PIT filters, revision selection, `data_version` hash of **records used** (last-61 adjusted, last-20 traded values, PIT statements/events, in-window CAs) — not the whole fixture DB |
| `src/lib/session-calendar.mjs` | Sole session authority; EOD close; `sessionDistance` |
| `src/lib/prices.mjs` | `researchAdjustedClose`; session traded value INR |
| `src/lib/schema-validate.mjs` | Lightweight schema checks; forbids generic `date` |
| `src/lib/security-registry.mjs` | Universe of eight research securities |
| `src/lib/evidence-sufficiency.mjs` | `evidence.status` precedence + sufficiency |
| `src/lib/assemble-assessment.mjs` | Assessment prose + evidence bundle |
| `src/lib/decision-gate.mjs` | Only decision/confidence writer |
| `src/lib/position-display.mjs` | Display-only P&L |
| `src/engines/quality.mjs` | Fundamentals labels |
| `src/engines/market.mjs` | Tape metrics + aggregate window |
| `src/engines/events.mjs` | Timing labels; forbidden copy guard |
| `src/server.mjs` | Localhost HTTP `:8787` |
| `src/cli-assess.mjs` | CLI wrapper |
| `web/*` | Consumes completed JSON; does not invent verbs |
| `scripts/generate-fixtures.mjs` | Regenerates `data/fixtures/` (not called by tests) |
| `config/*` | Gate, vocabulary, universe, label specs, schemas |
| `test/*` | Schema, boundaries, invariants, golden |

## Point-in-time rules

| Fact type | Visibility rule |
|-----------|-----------------|
| Bar / benchmark | `available_at ≤ as_of` and `trading_date ≤ as_of` date |
| Statement | Group by logical key; pick greatest `available_at ≤ as_of`, then highest `source_version` |
| Event | Same revision rule by `event_id` |
| Corporate action (adjust) | Supported `split`/`bonus` only; `available_at ≤ as_of`; `ex_date ≤ as_of` date; ex_date inside last **60** sessions; incomplete `factor` → fail loud |
| Unsupported CA | Fail loud (`UNSUPPORTED_CORPORATE_ACTION`) — never silent approximation |

Generic field name `date` is forbidden on contracts; use named temporal fields (`trading_date`, `available_at`, `period_end`, `ex_date`, `event_date`, …). See [DATA_POLICY](DATA_POLICY.md) and [PRICE_BASIS](PRICE_BASIS.md).

## Market lookbacks (exact)

From `config/market-label-spec.json`:

| Metric | Closes / sessions required |
|--------|----------------------------|
| SMA20 | 20 closes |
| SMA50 | 50 closes |
| RS / 20-session return | **21** closes (need return over 20 gaps) |
| Volatility 20d | **21** closes |
| Drawdown 60d | **60** closes |
| Liquidity 20d | **20** sessions with INR traded value |

Adjusted series is reconstructed on a **60-session** window ending at `as_of`.

## Evidence status vs assessment sufficiency

These are different fields on purpose.

### `evidence.status` (rollup precedence)

Highest severity wins, from `config/decision-vocabulary.json`:

`CONFLICTING` > `STALE` > `INCOMPLETE` > `UNAVAILABLE` > `OK`

V1 engines mainly emit `OK` / `INCOMPLETE` / `UNAVAILABLE`. Precedence is implemented even if `STALE`/`CONFLICTING` producers are not yet used.

### `assessment.sufficiency`

| Value | Typical cause |
|-------|----------------|
| `SUFFICIENT` | Engines covered; event timing not `UNKNOWN`; market not incomplete |
| `PARTIAL` | Incomplete coverage, stale/conflicting status, or event timing `UNKNOWN` |
| `INSUFFICIENT` | Market unavailable, or **all** quality metrics `UNAVAILABLE` |

**UNAVAILABLE metrics never vote** in market tape aggregation. Tape is never `SUPPORTIVE` while coverage is partial.

## Label systems (where thresholds live)

| Engine | Spec file | Labels |
|--------|-----------|--------|
| Quality | `config/quality-label-spec.json` | GOOD / NEUTRAL / WARNING / RED_FLAG (+ UNAVAILABLE) |
| Market | `config/market-label-spec.json` | SUPPORTIVE / MIXED / HOSTILE (+ UNAVAILABLE) |
| Events | `config/event-label-spec.json` | CLEAR / UNFAVORABLE / UNKNOWN |

Thresholds are **unvalidated V1 conventions**, not a researched trading model ([RESEARCH_PROTOCOL](RESEARCH_PROTOCOL.md)).

### Quality metrics

- `revenue_yoy`, `pat_yoy` — same fiscal period identity + duration; comparator must be `> 0`; no sequential substitute (Q1≠H1).
- `debt_to_equity`, `cfo_to_pat` — same snapshot fields.

### Market aggregate

1. Any available metric `HOSTILE` → window `HOSTILE`
2. Else any `MIXED` **or** partial coverage → `MIXED`
3. Else all five required `SUPPORTIVE` and not partial → `SUPPORTIVE`
4. Else `MIXED`

### Events

- Distance = trading sessions strictly after `as_of` with session date ≤ event date; weekend gap before next session → distance `1`.
- Earnings / ex-date within **5** sessions → `UNFAVORABLE`.
- Empty known calendar → `UNKNOWN` + incomplete coverage.
- Reasons must not contain trade-advice tokens.

## Decision gate

`config/decision-gate.json`:

```json
{ "enabled": false, "reason": "RESEARCH_GATE_CLOSED" }
```

While closed, gate **ignores** assessment, evidence, position, and context content. Flipping `enabled` is a research-protocol act, not a V1 feature ([RESEARCH_PROTOCOL](RESEARCH_PROTOCOL.md), [DECISION_VOCABULARY](DECISION_VOCABULARY.md)).

## Web / API surface

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/` | Assessment card UI |
| GET | `/api/universe` | Eight research securities |
| POST | `/api/assess` | Body `{ symbol, as_of?, position? }` → full JSON |

Server binds `127.0.0.1:8787` (override with `PORT`). Web renders server JSON; it does not invent decision verbs.

## What V1 deliberately excludes

- Live Yahoo/NSE scrapers (`yfinance`, `nsepython`)
- Yahoo Adj Close as research series
- F&O, day trading, broker/SIP product
- Enabling INITIATE/HOLD/EXIT
- Copying POC-001 E.3 / F.0 research runners
- Production vendor ingest (see [VENDOR_AUDIT](VENDOR_AUDIT.md))

## Reading next

1. [OUTPUT_CONTRACT](OUTPUT_CONTRACT.md) — JSON shape returned to clients  
2. [FIXTURES_AND_TESTS](FIXTURES_AND_TESTS.md) — data plane + what the suite proves  
3. Config JSON under `config/` for exact thresholds  
4. Source files in the module map above for implementation detail  
