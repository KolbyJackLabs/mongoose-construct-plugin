# mongoose-construct-hook

Mongoose plugin that adds `pre` and `post` **construct** hooks. Unlike the built-in `init` hook (which only fires when documents are loaded from the database), construct hooks fire when documents are instantiated—both `new Model(...)` and when hydrating from the database.

Supports both **sync and async** hooks.

## Installation

```bash
npm install mongoose-construct-hook
```

## Basic Usage

```javascript
import mongoose from "mongoose";
import constructHook from "mongoose-construct-hook";

const schema = new mongoose.Schema({ name: String });
schema.plugin(constructHook);

schema.post("construct", function () {
  console.log("Document constructed:", this);
});

const User = mongoose.model("User", schema);

// Both of these trigger the construct hook:
new User({ name: "Alice" });
User.hydrate({ _id: new mongoose.Types.ObjectId(), name: "Bob" });
```

### With pre and post hooks

```javascript
schema.pre("construct", function () {
  // Runs first; can mutate the document
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

**Note:** Mongoose's document construction queue does not await async hooks. The document is considered "constructed" before async hooks complete. Use `setImmediate` or similar if you need to wait for hooks before using the document.

---

## Plugin Options

### `skipNew`

When `true`, construct hooks do **not** run for documents created with `new Model()`.

```javascript
schema.plugin(constructHook, { skipNew: true });
```

**Use when:** You only want to run logic on documents loaded from the database (e.g., from `find()`, `findOne()`, or `Model.hydrate()`).

**Example use case:** Enriching documents with computed data from external services. New documents don't have an `_id` yet and may not need enrichment; only persisted documents loaded from the DB need it.

```javascript
schema.plugin(constructHook, { skipNew: true });
schema.post("construct", async function () {
  if (this.externalId) {
    this.externalData = await fetchFromAPI(this.externalId);
  }
});
```

### `skipInit`

When `true`, construct hooks do **not** run for documents initialized from the database (e.g., `Model.hydrate()`, `find()`, `findOne()`).

```javascript
schema.plugin(constructHook, { skipInit: true });
```

**Use when:** You only want to run logic when creating documents with `new Model()`, not when loading from the database.

**Example use case:** Setting up client-side-only state or UI helpers. When you create a new document in a form, you want to initialize defaults. When you load documents from a query, they're already "real" and don't need that setup.

```javascript
schema.plugin(constructHook, { skipInit: true });
schema.post("construct", function () {
  this._formDirty = false;
  this._validationErrors = {};
});
```

---

## Common Use Cases

### 1. Freeze or protect arrays from direct assignment

Prevent `doc.items[0] = x` and force `doc.items.set(0, x)` for proper Mongoose change tracking.

```javascript
schema.plugin(constructHook);
schema.post("construct", function () {
  if (!this.items) return;
  const real = this.items;
  this.$set(
    "items",
    new Proxy(real, {
      get(target, prop) {
        const val = target[prop];
        return typeof val === "function" ? val.bind(target) : val;
      },
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
schema.plugin(constructHook, { skipInit: true });
schema.post("construct", function () {
  this.displayName = `${this.firstName} ${this.lastName}`.trim();
});
```

### 3. Lazy-load related data for DB-loaded documents only

```javascript
schema.plugin(constructHook, { skipNew: true });
schema.post("construct", async function () {
  if (this.refId) {
    this._refPromise = ExternalModel.findById(this.refId);
  }
});
```

### 4. Add timestamps or audit metadata on creation

```javascript
schema.plugin(constructHook, { skipInit: true });
schema.pre("construct", function () {
  this.createdAt = new Date();
  this.createdBy = getCurrentUserId();
});
```

---

## API

### `schema.plugin(constructHook, options?)`

Attach the plugin to your schema.

**Options:**

| Option    | Type    | Default | Description                                                |
| --------- | ------- | ------- | ---------------------------------------------------------- |
| `skipNew` | boolean | `false` | Skip hooks when `new Model()` is used                       |
| `skipInit`| boolean | `false` | Skip hooks when document is initialized from DB (hydrate, find, etc.) |

### `schema.pre("construct", fn)` / `schema.post("construct", fn)`

Register hooks. Both sync and async functions are supported.

### Exported types

```typescript
import constructHook, { type ConstructHookOptions, type AnySchema } from "mongoose-construct-hook";
```

- **`ConstructHookOptions`** — Options for the plugin (`skipNew`, `skipInit`)
- **`AnySchema`** — Schema type (internal use; exported for augmentation)

---

## Requirements

- Mongoose ^7.0.0, ^8.0.0, or ^9.0.0

## License

MIT
