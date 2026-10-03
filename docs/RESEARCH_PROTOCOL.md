# Research protocol

Inherit lock / seal / holdout discipline from POC-001 methodology.

**After `v0.1.0`:** complete Track A data promotion ([DATA_PROMOTION_V1.md](DATA_PROMOTION_V1.md)) before opening a separate Track B decision-research thread. Do not retune V1 thresholds on the eight names; do not enable the decision gate from data work alone.

## Rules

- Freeze specs before looking at outcomes
- Fresh holdout for any future recommendation thread — do not reuse POC E.3 holdout
- V1 does **not** run Thread F (recommendation research)
- Label specs are **unvalidated V1 conventions**, not a researched trading model
- Do not retune thresholds on the eight fixture names
- Boundary/counterexample fixtures are the classification oracle, not RELIANCE looks

## Promotion

Flip `config/decision-gate.json` `enabled` only after a new research thread earns verbs with its own spec, splits, and holdout.
