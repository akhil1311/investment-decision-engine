/**
 * Vendor-neutral adapter contract.
 *
 * Defines what ANY future adapter must emit into the canonical PIT store.
 * Names no vendor SKUs (not S&P / LSEG / NSE / FactSet / …).
 *
 * Does NOT authorize weakening frozen temporal semantics:
 *   announcement ≠ reported_at ≠ vendor delivery/availability ≠ knowledge state at as_of
 * Shape compliance ≠ permission to invent available_at from a weaker vendor field.
 *
 * Pipeline boundary:
 *   vendor extract → adapter → AdapterEmission
 *     → assertAdapterEmission / validatePitStore
 *     → emissionToDataset → createPitStore
 *     → replay(as_of) → loadAsOf(as_of) → assess() → V1 engines
 *
 * Domain assignment: docs/VENDOR_DOMAIN_MAPPING.md (evidence first; adapters after SELECTED).
 */

import { createSessionCalendar } from "./session-calendar.mjs";
import { validatePitStore } from "./validate-pit-store.mjs";

/** Bump only when the shared emission shape changes (not per vendor). */
export const ADAPTER_CONTRACT_VERSION = "adapter-contract-v1";

export const AdapterContractCode = Object.freeze({
  EMISSION_INVALID: "EMISSION_INVALID",
  META_INVALID: "META_INVALID",
  SECURITY_BUNDLE_INVALID: "SECURITY_BUNDLE_INVALID",
  BENCHMARK_INVALID: "BENCHMARK_INVALID",
  PIT_STORE_INVALID: "PIT_STORE_INVALID",
});

const BUNDLE_KEYS = [
  "security",
  "bars",
  "corporate_actions",
  "statements",
  "events",
];

function err(code, message, details) {
  const e = { code, severity: "error", message };
  if (details != null) e.details = details;
  return e;
}

function sortErrors(errors) {
  return [...errors].sort((a, b) => {
    const c = (a.code || "").localeCompare(b.code || "");
    if (c) return c;
    return (a.message || "").localeCompare(b.message || "");
  });
}

/**
 * Structural checks on an adapter emission (before PIT store validation).
 * @param {object} emission
 * @returns {{ ok: boolean, errors: object[] }}
 */
export function assertAdapterEmissionShape(emission) {
  const errors = [];
  if (emission == null || typeof emission !== "object" || Array.isArray(emission)) {
    return {
      ok: false,
      errors: [
        err(AdapterContractCode.EMISSION_INVALID, "emission must be a non-null object"),
      ],
    };
  }

  const { meta, securities, benchmark } = emission;
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) {
    errors.push(err(AdapterContractCode.META_INVALID, "meta must be an object"));
  } else {
    if (!Array.isArray(meta.session_dates) || meta.session_dates.length === 0) {
      errors.push(
        err(
          AdapterContractCode.META_INVALID,
          "meta.session_dates must be a non-empty array",
        ),
      );
    }
    if (!Array.isArray(meta.security_ids) || meta.security_ids.length === 0) {
      errors.push(
        err(
          AdapterContractCode.META_INVALID,
          "meta.security_ids must be a non-empty array",
        ),
      );
    }
    if (typeof meta.as_of_default_session !== "string") {
      errors.push(
        err(
          AdapterContractCode.META_INVALID,
          "meta.as_of_default_session must be a string session date",
        ),
      );
    }
  }

  if (securities == null || typeof securities !== "object" || Array.isArray(securities)) {
    errors.push(
      err(
        AdapterContractCode.SECURITY_BUNDLE_INVALID,
        "securities must be an object map",
      ),
    );
  } else if (meta && Array.isArray(meta.security_ids)) {
    for (const id of meta.security_ids) {
      const bundle = securities[id];
      if (!bundle || typeof bundle !== "object") {
        errors.push(
          err(
            AdapterContractCode.SECURITY_BUNDLE_INVALID,
            `missing securities[${id}] bundle`,
            { security_id: id },
          ),
        );
        continue;
      }
      for (const key of BUNDLE_KEYS) {
        if (!(key in bundle)) {
          errors.push(
            err(
              AdapterContractCode.SECURITY_BUNDLE_INVALID,
              `securities[${id}] missing required key "${key}"`,
              { security_id: id, key },
            ),
          );
        }
      }
      if (bundle.bars != null && !Array.isArray(bundle.bars)) {
        errors.push(
          err(
            AdapterContractCode.SECURITY_BUNDLE_INVALID,
            `securities[${id}].bars must be an array`,
            { security_id: id },
          ),
        );
      }
      for (const arrKey of ["corporate_actions", "statements", "events"]) {
        if (bundle[arrKey] != null && !Array.isArray(bundle[arrKey])) {
          errors.push(
            err(
              AdapterContractCode.SECURITY_BUNDLE_INVALID,
              `securities[${id}].${arrKey} must be an array`,
              { security_id: id },
            ),
          );
        }
      }
      if (
        bundle.security &&
        bundle.security.security_id != null &&
        bundle.security.security_id !== id
      ) {
        errors.push(
          err(
            AdapterContractCode.SECURITY_BUNDLE_INVALID,
            `securities[${id}].security.security_id mismatch`,
            { security_id: id },
          ),
        );
      }
    }
    for (const id of Object.keys(securities)) {
      if (!meta.security_ids.includes(id)) {
        errors.push(
          err(
            AdapterContractCode.SECURITY_BUNDLE_INVALID,
            `securities[${id}] not listed in meta.security_ids`,
            { security_id: id },
          ),
        );
      }
    }
  }

  if (!Array.isArray(benchmark)) {
    errors.push(
      err(AdapterContractCode.BENCHMARK_INVALID, "benchmark must be an array"),
    );
  }

  const sorted = sortErrors(errors);
  return { ok: sorted.length === 0, errors: sorted };
}

/**
 * Convert a contract-valid emission into a PIT dataset (adds calendar).
 * Does not validate — call assertAdapterEmission first for the full gate.
 * @param {object} emission
 */
export function emissionToDataset(emission) {
  const meta = emission.meta;
  const calendar = createSessionCalendar(meta.session_dates);
  return {
    meta,
    calendar,
    securities: emission.securities,
    benchmark: emission.benchmark,
    fixture_version: meta.fixture_version || meta.data_version || ADAPTER_CONTRACT_VERSION,
  };
}

/**
 * Full adapter contract gate: shape + PIT store validator.
 *
 * @param {object} emission
 * @param {object} [options]
 * @param {'research_fixture'|'canonical_production'} [options.profile='canonical_production']
 *   Production-bound emissions default to the strict profile. Fixture identity
 *   adapters may pass profile: 'research_fixture' to allow adversarial SYN_* packs.
 * @returns {{ ok: boolean, contract_version: string, profile: string, errors: object[], dataset?: object }}
 */
export function assertAdapterEmission(emission, options = {}) {
  const profile = options.profile || "canonical_production";
  const shape = assertAdapterEmissionShape(emission);
  if (!shape.ok) {
    return {
      ok: false,
      contract_version: ADAPTER_CONTRACT_VERSION,
      profile,
      errors: shape.errors,
    };
  }

  const dataset = emissionToDataset(emission);
  const pit = validatePitStore(dataset, {
    profile,
    includeAsOfProbes: options.includeAsOfProbes !== false,
    asOfSamples: options.asOfSamples,
    asOfProbeLimit: options.asOfProbeLimit,
  });

  if (!pit.ok) {
    return {
      ok: false,
      contract_version: ADAPTER_CONTRACT_VERSION,
      profile,
      errors: sortErrors([
        ...pit.errors.map((e) =>
          err(
            AdapterContractCode.PIT_STORE_INVALID,
            `${e.code}: ${e.message}`,
            {
              pit_code: e.code,
              security_id: e.security_id,
              path: e.path,
            },
          ),
        ),
      ]),
    };
  }

  return {
    ok: true,
    contract_version: ADAPTER_CONTRACT_VERSION,
    profile,
    errors: [],
    dataset,
  };
}

/**
 * Identity helper: project an in-memory fixture dataset into an AdapterEmission.
 * Proves the contract against current fixtures without any vendor adapter.
 * @param {object} dataset loadFixtureDataset() / createPitStore().dataset shape
 */
export function datasetToEmission(dataset) {
  const securities = {};
  for (const id of dataset.meta.security_ids) {
    const b = dataset.securities[id];
    securities[id] = {
      security: b.security,
      bars: b.bars || [],
      corporate_actions: b.corporate_actions || [],
      statements: b.statements || [],
      events: b.events || [],
    };
  }
  return {
    meta: {
      fixture_version: dataset.meta.fixture_version,
      role: dataset.meta.role,
      as_of_default_session: dataset.meta.as_of_default_session,
      session_dates: dataset.meta.session_dates,
      security_ids: dataset.meta.security_ids,
      adapter_contract_version: ADAPTER_CONTRACT_VERSION,
    },
    securities,
    benchmark: dataset.benchmark || [],
  };
}
