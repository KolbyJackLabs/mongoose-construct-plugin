# mongoose-construct-hook

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
npm install mongoose-construct-hook
```

---

## Basic Usage

```javascript
import mongoose from "mongoose";
import constructHook from "mongoose-construct-hook";

const schema = new mongoose.Schema({ name: String });
schema.plugin(constructHook);

schema.post("construct", function () {
  console.log("Document constructed:", this.name);
});

const User = mongoose.model("User", schema);

// Both of these trigger the construct hook:
new User({ name: "Alice" });                                          // new Model()
User.hydrate({ _id: new mongoose.Types.ObjectId(), name: "Bob" });  // loaded from DB
```

### With pre and post hooks

```javascript
schema.pre("construct", function () {
  // Runs first; can mutate the document before it's handed to calling code
  this.initializedAt = new Date();
});

schema.post("construct", function () {
  // Runs after pre; document is fully constructed
  Object.freeze(this.someArray);
});
```

### Async hooks

```javascript
schema.post("construct", async function () {
  await this.populate("relatedDoc");
  this.computed = await fetchExternalData(this.id);
});
```

> **Note:** Document construction is synchronous. Async hooks run in the background — the document is returned to the caller before async hooks complete. If you need to wait for them, await the document's `.$constructHook()` method or use `setImmediate`/`setTimeout` in your own code. Errors thrown in async hooks will surface as uncaught exceptions.

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
schema.post("construct", async function () {
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
schema.post("construct", function () {
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
schema.post("construct", function () {
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
schema.post("construct", function () {
  this.displayName = `${this.firstName} ${this.lastName}`.trim();
});
```

### 3. Lazy-load related data for DB-loaded documents only

```javascript
schema.plugin(constructHook, { only: "hydrated" });
schema.post("construct", async function () {
  if (this.refId) {
    this._refPromise = ExternalModel.findById(this.refId);
  }
});
```

### 4. Stamp audit metadata on creation

```javascript
schema.plugin(constructHook, { only: "new" });
schema.pre("construct", function () {
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

### `schema.pre("construct", fn)` / `schema.post("construct", fn)`

Register hooks. Both sync and async functions are supported. `this` inside the hook refers to the document being constructed.

### Exported types

```typescript
import constructHook, { type ConstructHookOptions, type AnySchema } from "mongoose-construct-hook";
```

- **`ConstructHookOptions`** — `{ only?: "new" | "hydrated" }`
- **`AnySchema`** — Schema type alias (exported for advanced augmentation use cases)

---

## Requirements

- Mongoose ^7.0.0, ^8.0.0, or ^9.0.0

## License

MIT
