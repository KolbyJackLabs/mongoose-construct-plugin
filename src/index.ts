import type { Schema } from "mongoose";

/** @internal */
export type AnySchema = Schema<any, any, any, any, any, any, any, any, any, any, any>;

/**
 * Options for the constructHook plugin.
 *
 * @property skipNew - When true, construct hooks do not run for documents created with `new Model()`.
 *   Use when you only want to run logic on documents loaded from the database.
 * @property skipInit - When true, construct hooks do not run for documents initialized from the database (hydrate, find, etc.).
 *   Use when you only want to run logic on newly created documents.
 */
export interface ConstructHookOptions {
  /** Skip hooks when `new Model()` is used. Only run on DB-loaded documents. */
  skipNew?: boolean;
  /** Skip hooks when document is initialized from DB (hydrate, find, etc.). Only run on `new Model()`. */
  skipInit?: boolean;
}

interface DocumentWithSchema {
  $__schema?: {
    s?: {
      hooks?: {
        execPre: (name: string, ctx: unknown, args: unknown[]) => Promise<unknown[]>;
        execPost: (name: string, ctx: unknown, args: unknown[]) => Promise<void>;
      };
    };
  };
  isNew?: boolean;
}

/**
 * Mongoose plugin: construct hook.
 *
 * Fires pre/post hooks when documents are instantiated. Supports both sync and async hooks.
 * Use schema.pre('construct', fn) and schema.post('construct', fn).
 *
 * @param schema - Mongoose schema to attach the plugin to
 * @param options - Optional configuration (skipNew, skipInit)
 *
 * @example
 *   schema.plugin(constructHook);
 *   schema.post('construct', function () { console.log('Constructed:', this); });
 *
 * @example
 *   schema.plugin(constructHook, { skipNew: true });
 *   schema.post('construct', function () { /* only runs when loading from DB *\/ });
 *
 * @example
 *   schema.plugin(constructHook, { skipInit: true });
 *   schema.post('construct', function () { /* only runs for new Model() *\/ });
 */
export default function constructHook(schema: AnySchema, options?: ConstructHookOptions): void {
  const { skipNew = false, skipInit = false } = options ?? {};

  schema.methods.$constructHook = async function $constructHook(this: DocumentWithSchema) {
    const hooks = this.$__schema?.s?.hooks;
    if (!hooks) return;

    const doc = this;
    const isNew = doc.isNew === true;

    if (skipNew && isNew) return;
    if (skipInit && !isNew) return;

    await hooks.execPre("construct", doc, [doc]);
    await hooks.execPost("construct", doc, [doc]);
  };
  schema.queue("$constructHook", []);
}
