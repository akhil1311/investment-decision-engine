# Output contract (assessment JSON)

Shape returned by `assess()` / `POST /api/assess` / CLI. Field names are stable for V1 consumers (web card included).

## Top-level object

| Field | Type | Meaning |
|-------|------|---------|
| `context` | object | PIT clock + provenance for this run |
| `security` | object | Resolved identity (`security_id`, `nse_symbol`, `name`) |
| `evidence` | object | Engine outputs + rolled-up status |
| `assessment` | object | Human-facing synthesis (not a trade order) |
| `decision` | object | **Only** from decision gate |
| `confidence` | object | **Only** from decision gate |
| `position_display` | object | Cosmetic position/P&L; never engine input |
| `horizon` | string | Stated research horizon (`"5–20 trading days"`) |

## `context`

| Field | Example | Notes |
|-------|---------|-------|
| `as_of` | `2025-07-14T15:30:00+05:30` | Must be session close ISO |
| `timezone` | `Asia/Kolkata` | |
| `security_id` | `RELIANCE` | |
| `horizon` | `{ unit, min, max }` | 5–20 trading days |
| `data_version` | `sha256:…` (16 hex) | Hash of PIT inputs for this security/`as_of` |

## `evidence`

| Field | Meaning |
|-------|---------|
| `status` | Rollup: CONFLICTING › STALE › INCOMPLETE › UNAVAILABLE › OK |
| `quality` | Quality engine result |
| `market` | Market engine result |
| `events` | Event engine result |
| `sufficiency_reasons` | Deduped coverage reasons from engines |

### Engine common fields

Each of `quality` / `market` / `events` includes at least:

- `engine` — `"quality"` \| `"market"` \| `"events"`
- `coverage_status` — typically `OK` / `INCOMPLETE` / `UNAVAILABLE`
- `coverage_reasons` — strings explaining gaps
- `context_as_of`, `context_data_version` — echo of context

Engines **must not** contain `decision` or recommendation `state`.

### `evidence.quality`

| Field | Meaning |
|-------|---------|
| `metrics[]` | `{ metric, value, label, calculation, reason? }` |
| `red_flag_present` | true if any metric label is `RED_FLAG` |
| Metric names | `revenue_yoy`, `pat_yoy`, `debt_to_equity`, `cfo_to_pat` |
| Labels | GOOD / NEUTRAL / WARNING / RED_FLAG / UNAVAILABLE |

### `evidence.market`

| Field | Meaning |
|-------|---------|
| `metrics[]` | sma_trend, rs_20d, volatility_20d, drawdown_60d, liquidity_20d |
| `window` | SUPPORTIVE / MIXED / HOSTILE aggregate |
| `nifty50_price_index_comparison` | 5d/10d/20d price-return excess vs Nifty **price index** |

Liquidity value is INR per session (raw); other return metrics use research adjusted close.

### `evidence.events`

| Field | Meaning |
|-------|---------|
| `timing` | CLEAR / UNFAVORABLE / UNKNOWN |
| `known_events` | PIT-visible events |
| `upcoming` | Nearest upcoming with `distance`, or null |
| `reasons` | Factual timing strings (no trade advice) |

## `assessment`

| Field | Meaning |
|-------|---------|
| `sufficiency` | SUFFICIENT / PARTIAL / INSUFFICIENT |
| `why` | Bullet facts explaining labels / gaps |
| `what_would_change_assessment` | Counterfactual threshold statements |
| `tape_window` | Copy of market `window` |
| `event_timing` | Copy of events `timing` |
| `red_flag_present` | From quality |
| `nifty50_price_index_comparison` | From market |

Prose must not contain trading verbs (`initiate`, `buy`, `sell`, `hold`, `wait`, `avoid`, `reduce`, `exit`, …).

## `decision` / `confidence` (V1)

While the gate is closed:

```json
{
  "decision": { "state": "DISABLED", "reason": "RESEARCH_GATE_CLOSED" },
  "confidence": {
    "state": "WITHHELD",
    "reason": "Decision layer is not research-qualified."
  }
}
```

Clients must treat any other decision state as a future research unlock, not a V1 expectation. Vocabulary meanings live in [DECISION_VOCABULARY](DECISION_VOCABULARY.md).

## `position_display`

| `state` | Typical fields |
|---------|----------------|
| `NOT_HELD` | `pnl_status: "N_A"` |
| `HELD` + clean | `unrealized_pct`, `raw_last_close`, `pnl_status: "OK"` |
| `HELD` + split/bonus after entry | `pnl_status: "UNAVAILABLE"`, `reason: "CORPORATE_ACTION_AFTER_ENTRY"` |
| Incomplete fields | `pnl_status: "UNAVAILABLE"`, `reason: "INCOMPLETE_POSITION_FIELDS"` |

P&L uses **raw** last session close vs average entry — never research-adjusted close.

## Position input (request, not output)

```json
{ "state": "NOT_HELD" }
```

or

```json
{
  "state": "HELD",
  "quantity": 10,
  "average_entry_price": 2500,
  "entry_date": "2024-06-03"
}
```

Position never enters quality/market/event engines. Changing position must not change `evidence` or `assessment` (invariant tested).

## Errors

| Code | When |
|------|------|
| `NON_EOD_AS_OF` | `as_of` not `…T15:30:00+05:30` on a session |
| `UNKNOWN_SECURITY` | Symbol not in universe and not in fixtures |
| `UNSUPPORTED_CORPORATE_ACTION` | Visible unsupported CA type |
| `INCOMPLETE_CORPORATE_ACTION` | Missing/invalid adjust factor |

HTTP mapping: `NON_EOD_AS_OF` → 400, `UNKNOWN_SECURITY` → 404, other assess errors → 400.

## Golden snapshot

`test/golden/reliance-not-held.json` pins a subset of fields for RELIANCE / NOT_HELD at the fixture default `as_of`. Tests **read** that file; they do not regenerate it. Update the golden deliberately when intentional fixture/engine behavior changes.
