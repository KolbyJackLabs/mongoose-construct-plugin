// Compiled (not run) by `npm run test:types` against the built package, the
// way a consumer sees it. Importing the plugin must not change how Mongoose
// infers models: before 0.2.0 its Schema augmentation made model() return unknown.
import { model, Schema } from "mongoose";
import constructHook, { postConstruct, preConstruct } from "mongoose-construct-plugin";

const schema = new Schema({ name: { type: String, required: true }, count: Number });
schema.plugin(constructHook);
schema.plugin(constructHook, { only: "hydrated" });

postConstruct(schema, function (doc) {
  const name: string = doc.name;
  const self: string = this.name;
  void name;
  void self;
});

preConstruct(schema, function () {
  const count: number | null | undefined = this.count;
  void count;
});

const Thing = model("Thing", schema);
const thing = new Thing({ name: "a" });
const name: string = thing.name;
void name;

// @ts-expect-error -- model() must stay typed: unknown fields are rejected
thing.notAField;
