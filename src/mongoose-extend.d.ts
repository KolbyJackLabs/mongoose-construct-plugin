/**
 * Augments Mongoose Schema to include "construct" as a valid pre/post hook name,
 * and to accept the constructHook plugin without type errors.
 * This file is automatically applied when you import from mongoose-construct-hook.
 */
import type { PreMiddlewareFunction, PostMiddlewareFunction, Schema } from "mongoose";
import type { AnySchema, ConstructHookOptions } from "./types";

declare module "mongoose" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Schema<
    DocType = any,
    TModelType = any,
    TInstanceMethods = any,
    TQueryHelpers = any,
    TVirtuals = any,
    TStaticMethods = any,
    TSchemaOptions = any,
    RawDocType = any,
    EnforcedDocType = any,
    THydratedDocumentType = any
  > {
    pre(method: "construct", fn: PreMiddlewareFunction<THydratedDocumentType>): this;
    post(method: "construct", fn: PostMiddlewareFunction<THydratedDocumentType, THydratedDocumentType>): this;
    /** Overload for constructHook plugin compatibility */
    plugin(fn: (schema: AnySchema, opts?: ConstructHookOptions) => void, opts?: ConstructHookOptions): this;
  }
}
