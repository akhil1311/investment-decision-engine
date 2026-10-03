# Decision vocabulary (frozen; verbs disabled in V1)

Gate wiring: [ARCHITECTURE.md](ARCHITECTURE.md#decision-gate). Output fields: [OUTPUT_CONTRACT.md](OUTPUT_CONTRACT.md#decision--confidence-v1).

Recommendation verbs exist as product language but remain **disabled** until a research thread earns them. Until then `decision.state` is always `DISABLED`.

## NEW POSITION (`NOT_HELD`)

| State | Meaning |
|-------|---------|
| INITIATE | Opening a position is justified on the stated horizon — not “the stock will rise” |
| WAIT | Potential candidate; timing/conditions not favorable — not “the stock will fall” |
| AVOID | Evidence/risk makes opening unsuitable |
| NO_VERDICT | Insufficient or unreliable evidence for a responsible recommendation |

## EXISTING POSITION (`HELD`)

| State | Meaning |
|-------|---------|
| HOLD | No sufficiently strong reason to exit or reduce — not a rise prediction; not “stay because you are at a loss” |
| REDUCE | Reduce exposure (sizing policy not frozen in V1) |
| EXIT | Close the position |
| WAIT | Engines ran; do not change size yet |
| NO_VERDICT | Cannot make a responsible recommendation |

## Distinctions

- **WAIT** (held): model ran; action is do nothing for now  
- **NO_VERDICT**: cannot recommend (gap, conflict, or gate closed)  
- Purchase price / unrealized P&L are **display only** and must never drive evidence engines  
- `NO_VERDICT` is a **decision** state only — never reuse as evidence quality
