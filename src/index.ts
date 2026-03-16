import type { Schema } from "mongoose";

/** @internal */
export type AnySchema = Schema<any, any, any, any, any, any, any, any, any, any, any>;

/** @internal */
interface KareemHooks {
  execPre: (name: string, ctx: unknown, args: unknown[], callbackOrOptions?: unknown) => Promise<unknown> | void;
  execPost: (name: string, ctx: unknown, args: unknown[], callbackOrOptions?: unknown, callback?: unknown) => Promise<void> | void;
}

/** @internal — true when kareem uses Promise-based exec (Mongoose 9+) */
function isPromiseBased(hooks: KareemHooks): boolean {
  return hooks.execPre.constructor.name === "AsyncFunction";
}

/** @internal — unified wrapper that works with both callback (M7/8) and Promise (M9) kareem */
function execHooks(hooks: KareemHooks, ctx: unknown): Promise<void> {
  if (isPromiseBased(hooks)) {
    return (async () => {
      await (hooks.execPre as (n: string, c: unknown, a: unknown[]) => Promise<unknown>)("construct", ctx, [ctx]);
      await (hooks.execPost as (n: string, c: unknown, a: unknown[]) => Promise<void>)("construct", ctx, [ctx]);
    })();
  }

  return new Promise<void>((resolve, reject) => {
    (hooks.execPre as (n: string, c: unknown, a: unknown[], cb: (err?: unknown) => void) => void)(
      "construct", ctx, [ctx],
      (preErr?: unknown) => {
        if (preErr) return reject(preErr);
        (hooks.execPost as (n: string, c: unknown, a: unknown[], opts: unknown, cb: (err?: unknown) => void) => void)(
          "construct", ctx, [ctx], {},
          (postErr?: unknown) => {
            if (postErr) return reject(postErr);
            resolve();
          }
        );
      }
    );
  });
}

/**
 * Options for the constructHook plugin.
 *
 * @property only - Restrict which documents trigger construct hooks.
 *   - `"new"`: only fire for documents created with `new Model()`.
 *   - `"hydrated"`: only fire for documents loaded from the database
 *     (via `find`, `findOne`, `Model.hydrate`, etc.).
 *   - Omit to fire for both (default).
 *
 * **"hydrated" explained:** Mongoose uses the term "hydrate" to describe
 * the process of turning raw database data into a full Mongoose document.
 * Any document that comes back from a query — `find()`, `findOne()`,
 * `findById()`, `Model.hydrate()` — is a hydrated document.
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

/**
 * Re-surfaces a caught error outside the Promise chain so it becomes a visible
 * uncaught exception rather than a silent unhandled rejection.
 */
function throwAsync(err: unknown): void {
  if (typeof process !== "undefined" && typeof process.nextTick === "function") {
    process.nextTick(() => { throw err; });
  } else {
    setTimeout(() => { throw err; }, 0);
  }
}

/**
 * Mongoose plugin: construct hook.
 *
 * Fires pre/post hooks when documents are instantiated. Supports both sync and async hooks.
 * Use schema.pre('construct', fn) and schema.post('construct', fn).
 *
 * @param schema - Mongoose schema to attach the plugin to
 * @param options - Optional configuration
 *
 * @example
 *   schema.plugin(constructHook);
 *   schema.post('construct', function () { console.log('Constructed:', this); });
 *
 * @example
 *   schema.plugin(constructHook, { only: 'hydrated' });
 *   schema.post('construct', function () { /* only runs when loading from DB *\/ });
 *
 * @example
 *   schema.plugin(constructHook, { only: 'new' });
 *   schema.post('construct', function () { /* only runs for new Model() *\/ });
 */
export default function constructHook(schema: AnySchema, options?: ConstructHookOptions): void {
  const { only } = options ?? {};

  // Capture the hook pipeline once at registration time rather than traversing
  // the document's private internals ($__schema.s.hooks) on every instantiation.
  // Failing here (at setup) is loud and early; failing per-document would be silent.
  const hooks: KareemHooks | undefined = (schema as any).s?.hooks;

  schema.methods.$constructHook = function $constructHook() {
    const p = (async () => {
      if (!hooks) return;

      const isNew = this.isNew === true;
      if (only === "new" && !isNew) return;
      if (only === "hydrated" && isNew) return;

      await execHooks(hooks, this);
    })();

    p.catch(throwAsync);

    return p;
  };
  schema.queue("$constructHook", []);
}
