/**
 * Portable action contract checks: action declarations and payloads.
 *
 * The scene document reader uses these to reject scenes whose triggers name
 * unknown actions or carry ill-typed payloads, and ViroSpecsActionRegistry
 * uses them at dispatch. The same rules live in viro
 * (`components/Specs/core/actions.ts`), so a manifest that passes
 * `viro-specs-compile` passes here.
 *
 * Dependency-free and free of Lens globals.
 */
import {
  VIRO_SPECS_ACTION_ID_PATTERN,
  type ViroSpecsActionDeclaration,
  type ViroSpecsActionPayload,
} from "./ViroSpecsProtocol";

/** One problem found in an action payload or declaration. */
export type ViroSpecsActionProblem = {
  /** JSON Pointer relative to the checked value, for example `/units`. */
  readonly path: string;
  readonly message: string;
};

const FIELD_TYPES = ["string", "number", "integer", "boolean"];

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pointer(key: string): string {
  return "/" + key.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** Problems with one declaration's shape. Empty when it is valid. */
export function checkViroSpecsActionDeclaration(value: unknown): ViroSpecsActionProblem[] {
  const problems: ViroSpecsActionProblem[] = [];
  if (!isRecord(value)) return [{ path: "", message: "Expected an action declaration object." }];
  for (const key of Object.keys(value)) {
    if (key !== "id" && key !== "payload") problems.push({ path: pointer(key), message: "Unknown field `" + key + "`." });
  }
  if (typeof value.id !== "string" || !VIRO_SPECS_ACTION_ID_PATTERN.test(value.id)) {
    problems.push({ path: "/id", message: "Expected an action ID such as exhibit.open (lowercase segments separated by dots)." });
  }
  if (value.payload === undefined) return problems;
  if (!isRecord(value.payload)) {
    problems.push({ path: "/payload", message: "Expected an object of field declarations." });
    return problems;
  }
  for (const [name, field] of Object.entries(value.payload)) {
    const at = "/payload" + pointer(name);
    if (!isRecord(field)) {
      problems.push({ path: at, message: "Expected a field declaration object." });
      continue;
    }
    for (const key of Object.keys(field)) {
      if (key !== "type" && key !== "enum" && key !== "optional") {
        problems.push({ path: at + pointer(key), message: "Unknown field `" + key + "`." });
      }
    }
    if (typeof field.type !== "string" || !FIELD_TYPES.includes(field.type)) {
      problems.push({ path: at + "/type", message: "Expected one of: " + FIELD_TYPES.join(", ") + "." });
    }
    if (field.optional !== undefined && typeof field.optional !== "boolean") {
      problems.push({ path: at + "/optional", message: "Expected a boolean." });
    }
    if (field.enum !== undefined) {
      const values = field.enum;
      if (field.type !== "string") {
        problems.push({ path: at + "/enum", message: "enum is only valid on string fields." });
      } else if (
        !Array.isArray(values) || values.length === 0 ||
        !values.every((v) => typeof v === "string") || new Set(values).size !== values.length
      ) {
        problems.push({ path: at + "/enum", message: "Expected a non-empty array of unique strings." });
      }
    }
  }
  return problems;
}

/**
 * Problems with `payload` against `declaration`: missing required fields,
 * unknown fields, wrong types, non-integers for `integer`, values outside
 * `enum`. Empty when the payload matches. `declaration` must be valid.
 */
export function checkViroSpecsActionPayload(
  declaration: ViroSpecsActionDeclaration,
  payload: unknown
): ViroSpecsActionProblem[] {
  if (payload === undefined) payload = {};
  if (!isRecord(payload)) return [{ path: "", message: "Expected a payload object." }];
  const problems: ViroSpecsActionProblem[] = [];
  const fields = declaration.payload ?? {};
  for (const key of Object.keys(payload)) {
    if (!(key in fields)) {
      problems.push({ path: pointer(key), message: "Field `" + key + "` is not declared by " + declaration.id + "." });
    }
  }
  for (const [name, field] of Object.entries(fields)) {
    const at = pointer(name);
    const value = payload[name];
    if (value === undefined) {
      if (field.optional !== true) problems.push({ path: at, message: "Missing required field `" + name + "`." });
      continue;
    }
    switch (field.type) {
      case "string":
        if (typeof value !== "string") problems.push({ path: at, message: "Expected a string." });
        else if (field.enum !== undefined && !field.enum.includes(value)) {
          problems.push({ path: at, message: "Expected one of: " + field.enum.join(", ") + "." });
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") problems.push({ path: at, message: "Expected a boolean." });
        break;
      case "number":
      case "integer":
        if (typeof value !== "number" || !Number.isFinite(value)) problems.push({ path: at, message: "Expected a finite number." });
        else if (field.type === "integer" && !Number.isInteger(value)) problems.push({ path: at, message: "Expected a whole number." });
        break;
    }
  }
  return problems;
}

/** Copy of a checked payload with only declared fields, so handlers never see extras. */
export function copyViroSpecsActionPayload(payload: unknown): ViroSpecsActionPayload {
  const out: ViroSpecsActionPayload = {};
  if (!isRecord(payload)) return out;
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") out[key] = value;
  }
  return out;
}
