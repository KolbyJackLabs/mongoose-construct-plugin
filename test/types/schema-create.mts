// Mongoose 9 only (Schema.create). This is the shape that broke in 0.1.0: with the
// plugin's Schema augmentation loaded, model("X", Schema.create(...)) returned unknown.
import { model, Schema } from "mongoose";
import constructHook, { postConstruct } from "mongoose-construct-plugin";

const schema = Schema.create({ name: { type: String, required: true } });
schema.plugin(constructHook);
postConstruct(schema, function (doc) {
  const name: string = doc.name;
  void name;
});

const Created = model("Created", schema);
const name: string = new Created({ name: "a" }).name;
void name;
