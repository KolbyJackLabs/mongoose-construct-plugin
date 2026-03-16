import type { Schema } from "mongoose";

/**
 * Wide Schema alias used internally and in the module augmentation.
 * @internal
 */
export type AnySchema = Schema<any, any, any, any, any, any, any, any, any, any, any>;

/**
 * Options for the constructHook plugin.
 *
 * @property only - Restrict which documents trigger construct hooks.
 *   - `"new"`: only fire for documents created with `new Model()`.
 *   - `"hydrated"`: only fire for documents loaded from the database
 *     (via `find`, `findOne`, `Model.hydrate`, etc.).
 *   - Omit to fire for both (default).
 */
export interface ConstructHookOptions {
  /**
   * Restrict which document origins trigger hooks.
   * - `"new"` — only `new Model()`
   * - `"hydrated"` — only documents loaded from the database
   * - omit — both (default)
   */
  only?: "new" | "hydrated";
}
