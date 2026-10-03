import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT_DIR = join(__dirname, "../../config/data-contract");

/** Always reject generic `date`; also honor schema.forbidden_fields. */
const ALWAYS_FORBIDDEN = ["date"];

/**
 * Lightweight structural validation (no external JSON Schema dependency).
 * @param {object} schema
 * @param {object} obj
 * @param {string} label
 */
export function validateAgainstSchema(schema, obj, label = "object") {
  const errors = [];
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) {
    return [`${label}: expected object`];
  }
  const forbidden = new Set([
    ...ALWAYS_FORBIDDEN,
    ...(schema.forbidden_fields || []),
  ]);
  for (const field of forbidden) {
    if (Object.prototype.hasOwnProperty.call(obj, field)) {
      errors.push(`${label}: forbidden field "${field}"`);
    }
  }
  for (const key of schema.required || []) {
    if (!(key in obj)) errors.push(`${label}: missing required "${key}"`);
  }
  for (const key of Object.keys(obj)) {
    if (schema.additionalProperties === false) {
      if (!schema.properties || !(key in schema.properties)) {
        errors.push(`${label}: unexpected field "${key}"`);
      }
    }
    const prop = schema.properties?.[key];
    if (!prop) continue;
    const v = obj[key];
    if (prop.const !== undefined && v !== prop.const) {
      errors.push(`${label}.${key}: expected const ${prop.const}`);
    }
    if (prop.enum && v != null && !prop.enum.includes(v)) {
      errors.push(`${label}.${key}: value not in enum`);
    }
    if (prop.type) {
      const types = Array.isArray(prop.type) ? prop.type : [prop.type];
      const ok = types.some((t) => {
        if (t === "null") return v === null;
        if (t === "number") return typeof v === "number" && !Number.isNaN(v);
        if (t === "string") return typeof v === "string";
        if (t === "object") return v !== null && typeof v === "object";
        return true;
      });
      if (!ok) errors.push(`${label}.${key}: bad type`);
    }
    if (prop.pattern && typeof v === "string") {
      if (!new RegExp(prop.pattern).test(v)) {
        errors.push(`${label}.${key}: pattern mismatch`);
      }
    }
  }
  return errors;
}

export function loadSchema(name) {
  return JSON.parse(readFileSync(join(CONTRACT_DIR, name), "utf8"));
}

export function assertValid(schemaName, obj, label) {
  const schema = loadSchema(schemaName);
  const errors = validateAgainstSchema(schema, obj, label);
  if (errors.length) {
    throw new Error(`Schema ${schemaName}:\n${errors.join("\n")}`);
  }
}
