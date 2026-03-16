import type { Schema } from "mongoose";

/** @internal */
export type AnySchema = Schema<any, any, any, any, any, any, any, any, any, any, any>;

/** @internal */
interface KareemHooks {
  execPre: (name: string, ctx: unknown, args: unknown[]) => Promise<unknown[]>;
  execPost: (name: string, ctx: unknown, args: unknown[]) => Promise<void>;
}

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

  // Capture the hook pipeline once at registration time rather than traversing
  // the document's private internals ($__schema.s.hooks) on every instantiation.
  // Failing here (at setup) is loud and early; failing per-document would be silent.
  const hooks: KareemHooks | undefined = (schema as any).s?.hooks;

  schema.methods.$constructHook = function $constructHook() {
    const p = (async () => {
      if (!hooks) return;

      const isNew = this.isNew === true;
      if (skipNew && isNew) return;
      if (skipInit && !isNew) return;

      await hooks.execPre("construct", this, [this]);
      await hooks.execPost("construct", this, [this]);
    })();

    // Re-surface errors from async hooks so they aren't silently swallowed.
    // Throwing inside .catch() creates another rejected Promise, so we escape
    // back to synchronous exception territory via nextTick / setTimeout instead.
    p.catch((err) => {
      if (typeof process !== "undefined" && typeof process.nextTick === "function") {
        process.nextTick(() => { throw err; });
      } else {
        setTimeout(() => { throw err; }, 0);
      }
    });

    return p;
  };
  schema.queue("$constructHook", []);
}
