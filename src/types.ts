import type { HydratedDocumentFromSchema, Schema } from "mongoose";

/**
 * Wide Schema alias accepted by the plugin.
 * Only the leading type parameters are given, so it fits Mongoose 7, 8 and 9.
 */
export type AnySchema = Schema<any, any, any, any, any, any, any>;

/**
 * Document type that construct hooks registered on `S` receive.
 */
export type ConstructedDocument<S extends Schema> = HydratedDocumentFromSchema<S>;

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
