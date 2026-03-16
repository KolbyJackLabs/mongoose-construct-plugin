/// <reference path="../src/mongoose-extend.d.ts" />
import { describe, it, expect, afterEach } from "vitest";
import mongoose from "mongoose";
import constructHook from "../src/index";

describe("constructHook", () => {
  afterEach(() => {
    [
      "TestNewModel",
      "TestHydrate",
      "TestPrePost",
      "TestIsolatedA",
      "TestIsolatedB",
      "TestNoHooks",
      "TestSkipNew",
      "TestSkipNewHydrate",
      "TestSkipInit",
      "TestSkipInitNew",
      "TestAsync",
    ].forEach((name) => mongoose.models[name] && mongoose.deleteModel(name));
  });
  it("fires post construct when creating doc with new Model()", async () => {
    const schema = new mongoose.Schema({ name: String });
    schema.plugin(constructHook);

    let postCalled = false;
    schema.post("construct", function () {
      postCalled = true;
    });

    const Model = mongoose.model("TestNewModel", schema);
    new Model({ name: "test" });
    await new Promise((r) => setImmediate(r)); // allow async hooks to complete

    expect(postCalled).toBe(true);
  });

  it("fires post construct when hydrating doc with Model.hydrate()", async () => {
    const schema = new mongoose.Schema({ name: String });
    schema.plugin(constructHook);

    let postCalled = false;
    schema.post("construct", function () {
      postCalled = true;
    });

    const Model = mongoose.model("TestHydrate", schema);
    Model.hydrate({ _id: new mongoose.Types.ObjectId(), name: "hydrated" });
    await new Promise((r) => setImmediate(r)); // allow async hooks to complete

    expect(postCalled).toBe(true);
  });

  it("runs pre construct before post construct", async () => {
    const schema = new mongoose.Schema({ name: String, flag: Boolean });
    schema.plugin(constructHook);

    const order: string[] = [];
    schema.pre("construct", function () {
      order.push("pre");
      (this as { flag?: boolean }).flag = true;
    });
    schema.post("construct", function () {
      order.push("post");
      expect((this as { flag?: boolean }).flag).toBe(true);
    });

    const Model = mongoose.model("TestPrePost", schema);
    const doc = new Model({ name: "test" });
    await new Promise((r) => setImmediate(r)); // allow async hooks to complete

    expect(order).toEqual(["pre", "post"]);
    expect(doc.flag).toBe(true);
  });

  it("keeps multiple schemas isolated", async () => {
    const schemaA = new mongoose.Schema({ value: String });
    schemaA.plugin(constructHook);
    let calledA = false;
    schemaA.post("construct", () => {
      calledA = true;
    });

    const schemaB = new mongoose.Schema({ value: String });
    schemaB.plugin(constructHook);
    let calledB = false;
    schemaB.post("construct", () => {
      calledB = true;
    });

    const ModelA = mongoose.model("TestIsolatedA", schemaA);
    const ModelB = mongoose.model("TestIsolatedB", schemaB);

    new ModelA({ value: "a" });
    await new Promise((r) => setImmediate(r));
    expect(calledA).toBe(true);
    expect(calledB).toBe(false);

    new ModelB({ value: "b" });
    await new Promise((r) => setImmediate(r));
    expect(calledB).toBe(true);
  });

  it("does not throw when no pre/post hooks registered", () => {
    const schema = new mongoose.Schema({ name: String });
    schema.plugin(constructHook);

    const Model = mongoose.model("TestNoHooks", schema);

    expect(() => new Model({ name: "test" })).not.toThrow();
  });

  it("skipNew skips hooks for new Model()", async () => {
    const schema = new mongoose.Schema({ name: String });
    schema.plugin(constructHook, { skipNew: true });

    let postCalled = false;
    schema.post("construct", () => {
      postCalled = true;
    });

    const Model = mongoose.model("TestSkipNew", schema);
    new Model({ name: "test" });
    await new Promise((r) => setImmediate(r));

    expect(postCalled).toBe(false);
  });

  it("skipNew runs hooks for hydrate()", async () => {
    const schema = new mongoose.Schema({ name: String });
    schema.plugin(constructHook, { skipNew: true });

    let postCalled = false;
    schema.post("construct", () => {
      postCalled = true;
    });

    const Model = mongoose.model("TestSkipNewHydrate", schema);
    Model.hydrate({ _id: new mongoose.Types.ObjectId(), name: "hydrated" });
    await new Promise((r) => setImmediate(r));

    expect(postCalled).toBe(true);
  });

  it("skipInit skips hooks for hydrate()", async () => {
    const schema = new mongoose.Schema({ name: String });
    schema.plugin(constructHook, { skipInit: true });

    let postCalled = false;
    schema.post("construct", () => {
      postCalled = true;
    });

    const Model = mongoose.model("TestSkipInit", schema);
    Model.hydrate({ _id: new mongoose.Types.ObjectId(), name: "hydrated" });
    await new Promise((r) => setImmediate(r));

    expect(postCalled).toBe(false);
  });

  it("supports async construct hooks", async () => {
    const schema = new mongoose.Schema({ name: String });
    schema.plugin(constructHook);

    let postCalled = false;
    schema.post("construct", async function () {
      await new Promise((r) => setImmediate(r));
      postCalled = true;
    });

    const Model = mongoose.model("TestAsync", schema);
    new Model({ name: "test" });
    await new Promise((r) => setTimeout(r, 10)); // allow async hooks to complete

    expect(postCalled).toBe(true);
  });

  it("skipInit runs hooks for new Model()", async () => {
    const schema = new mongoose.Schema({ name: String });
    schema.plugin(constructHook, { skipInit: true });

    let postCalled = false;
    schema.post("construct", () => {
      postCalled = true;
    });

    const Model = mongoose.model("TestSkipInitNew", schema);
    new Model({ name: "test" });
    await new Promise((r) => setImmediate(r));

    expect(postCalled).toBe(true);
  });
});
