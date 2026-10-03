# Vendor audit checklist

## Kill criteria

- As-of D silently uses later restatements
- No originally-reported versions / no reliable `available_at`
- Unsupported corporate actions silently approximated

**yfinance and nsepython fail this audit by construction.** They are not candidate vendors.

## Required test cases before production promotion

- Historical restatement
- Delayed filing
- Corporate action (split/bonus)
- Missing trading day
- Symbol change
- Duplicate record
- Revised filing
- Timestamp ambiguity

Adapter must emit normalized PIT, not vendor-specific semantics. Production ingest is out of V1 done.
