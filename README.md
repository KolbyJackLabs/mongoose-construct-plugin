# mongoose-construct-plugin

Mongoose plugin that adds `pre` and `post` **construct** hooks — hooks that fire every time a document is instantiated, whether created with `new Model()` or loaded from the database.

---

## Why does this exist? The `init` hook gap

Mongoose has a built-in `init` hook, but it only fires for documents **loaded from the database** (i.e., hydrated from a query result). It does not fire for `new Model()`.

| Event | `init` hook fires? | `construct` hook fires? |
| ----- | ------------------ | ----------------------- |
| `new User({ name: "Alice" })` | ✗ | ✓ |
| `User.find(...)` | ✓ | ✓ |
| `User.findOne(...)` | ✓ | ✓ |
| `User.findById(...)` | ✓ | ✓ |
| `User.hydrate(rawDoc)` | ✓ | ✓ |

If you want to run logic **any time a document comes into existence** — regardless of where it came from — you need the `construct` hook this plugin provides.

Supports both **sync and async** hooks.

---

## Installation

```bash
npm install mongoose-construct-plugin
```

---

## Basic Usage

```javascript
import mongoose from "mongoose";
import constructHook, { postConstruct } from "mongoose-construct-plugin";

const schema = new mongoose.Schema({ name: String });
schema.plugin(constructHook);

postConstruct(schema, function () {
  console.log("Document constructed:", this.name);
});

const User = mongoose.model("User", schema);

// Both of these trigger the construct hook:
new User({ name: "Alice" });                                          // new Model()
User.hydrate({ _id: new mongoose.Types.ObjectId(), name: "Bob" });  // loaded from DB
```

### With pre and post hooks

```javascript
import { postConstruct, preConstruct } from "mongoose-construct-plugin";

preConstruct(schema, function () {
  // Runs synchronously inside new Model() / hydration.
  this.initializedAt = new Date();
});

postConstruct(schema, function (doc) {
  // Runs after pre. `doc` is the same document as `this`.
  console.log("constructed", doc.name);
});
```

### When hooks run

| | `new Model(data)` | Loaded from the database |
| --- | --- | --- |
| `pre` | During the constructor, after `data` is applied | During the constructor, **before** the stored values are applied: fields are still empty, and anything it sets is overwritten by the stored values |
| `post` | Just after `new Model()` returns | Just after the document is returned, with stored values loaded |

`post` hooks always run after the constructor returns, on the next microtask, even when the hook itself is synchronous. To set or read field values on database-loaded documents, use `postConstruct` (or restrict a `pre` hook to new documents with `only: "new"`).

### Async hooks

```javascript
postConstruct(schema, async function () {
  await this.populate("relatedDoc");
  this.computed = await fetchExternalData(this.id);
});
```

> **Note:** Document construction is synchronous, so hooks can't delay it. The document is returned to the caller before `post` hooks run and before async hooks finish, and there is no public way to wait for them. If later code depends on an async hook's result, store a promise on the document (see [use case 3](#3-lazy-load-related-data-for-db-loaded-documents-only)) and await that. Errors thrown in any construct hook, sync or async, surface as uncaught exceptions.

---

## Plugin Options

### `only`

Restrict which document origins trigger construct hooks. Omit to fire for all documents (default).

| Value | Description |
| ----- | ----------- |
| `"new"` | Only fire for documents created with `new Model()` |
| `"hydrated"` | Only fire for documents loaded from the database |
| _(omitted)_ | Fire for both (default) |

**What does "hydrated" mean?**
Mongoose uses the term _hydrate_ to describe turning raw database data into a full Mongoose document. Every document returned from a query — `find()`, `findOne()`, `findById()`, `Model.hydrate()` — is a hydrated document. Newly created documents (`new Model()`) are _not_ hydrated; they have never touched the database.

#### `only: "hydrated"` — run logic only for DB-loaded documents

```javascript
schema.plugin(constructHook, { only: "hydrated" });
postConstruct(schema, async function () {
  // Only runs when loading from DB, not on new Model()
  if (this.externalId) {
    this.externalData = await fetchFromAPI(this.externalId);
  }
});
```

**Use when:** You want to enrich documents with external data, but only after they've been persisted and loaded back from the database.

#### `only: "new"` — run logic only for newly created documents

```javascript
schema.plugin(constructHook, { only: "new" });
postConstruct(schema, function () {
  // Only runs on new Model(), not when loading from DB
  this._formDirty = false;
  this._validationErrors = {};
});
```

**Use when:** You want to initialize client-side or in-memory state that only makes sense for brand-new documents.

---

## Common Use Cases

### 1. Protect arrays from direct index assignment

Prevent `doc.items[0] = x` and force `doc.items.set(0, x)` for proper Mongoose change tracking.

```javascript
schema.plugin(constructHook);
postConstruct(schema, function () {
  if (!this.items) return;
  const real = this.items;
  this.$set(
    "items",
    new Proxy(real, {
      set(target, prop, value) {
        if (/^\d+$/.test(String(prop))) {
          throw new TypeError("Use doc.items.set(index, value) instead of direct assignment");
        }
        target[prop] = value;
        return true;
      },
    })
  );
});
```

### 2. Initialize computed fields on new documents only

```javascript
schema.plugin(constructHook, { only: "new" });
postConstruct(schema, function () {
  this.displayName = `${this.firstName} ${this.lastName}`.trim();
});
```

### 3. Lazy-load related data for DB-loaded documents only

```javascript
schema.plugin(constructHook, { only: "hydrated" });
postConstruct(schema, async function () {
  if (this.refId) {
    this._refPromise = ExternalModel.findById(this.refId);
  }
});
```

### 4. Stamp audit metadata on creation

```javascript
schema.plugin(constructHook, { only: "new" });
preConstruct(schema, function () {
  this.createdAt = new Date();
  this.createdBy = getCurrentUserId();
});
```

---

## API

### `schema.plugin(constructHook, options?)`

Attach the plugin to your schema. Must be called before `mongoose.model()`.

**Options:**

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `only` | `"new" \| "hydrated"` | _(both)_ | Restrict which document origins trigger hooks |

### `preConstruct(schema, fn)` / `postConstruct(schema, fn)`

```typescript
import { postConstruct, preConstruct } from "mongoose-construct-plugin";
```

Register construct hooks. Both sync and async functions are supported. `this` is the document being constructed, and `postConstruct` also passes it as the first argument. Both are typed to the schema's hydrated document and return the schema. See [When hooks run](#when-hooks-run) for timing.

They register the same hooks as `schema.pre("construct", fn)` / `schema.post("construct", fn)`, which still work at runtime. Mongoose's TypeScript hook names are a closed list, so in TypeScript the raw form needs a cast (`schema.post("construct" as any, fn)`).

### Exported types

```typescript
import constructHook, { type ConstructHookOptions, type ConstructedDocument, type AnySchema } from "mongoose-construct-plugin";
```

- **`ConstructHookOptions`** — `{ only?: "new" | "hydrated" }`
- **`ConstructedDocument<S>`** — the hydrated document type construct hooks on schema `S` receive
- **`AnySchema`** — the wide Schema type the plugin accepts

---

## Upgrading from 0.1.x

0.1.x augmented Mongoose's `Schema` interface so `schema.pre/post("construct", fn)` type-checked. On Mongoose 9 that augmentation made `model()` return `unknown` for any schema in the program, so it has been removed. Replace

```typescript
schema.post("construct", function (doc) { /* ... */ });
```

with

```typescript
postConstruct(schema, function (doc) { /* ... */ });
```

Plain JavaScript users don't need to change anything.

---

## Requirements

- Mongoose ^7.0.0, ^8.0.0, or ^9.0.0
- Node.js 18 or later (CI tests Node 20, 22 and 24)

## License

MIT
