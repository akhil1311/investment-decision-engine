# Research protocol

Inherit lock / seal / holdout discipline from POC-001 methodology.

## Rules

- Freeze specs before looking at outcomes
- Fresh holdout for any future recommendation thread — do not reuse POC E.3 holdout
- V1 does **not** run Thread F (recommendation research)
- Label specs are **unvalidated V1 conventions**, not a researched trading model
- Do not retune thresholds on the eight fixture names
- Boundary/counterexample fixtures are the classification oracle, not RELIANCE looks

## Promotion

Flip `config/decision-gate.json` `enabled` only after a new research thread earns verbs with its own spec, splits, and holdout.
