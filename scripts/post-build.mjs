import { readFile, writeFile, copyFile } from "fs/promises";

const REFERENCE = '/// <reference path="./mongoose-extend.d.ts" />\n';
const DTS = "dist/index.d.ts";

// Copy mongoose-extend.d.ts and rewrite its local ./types import to point at
// the package itself, since dist/ does not contain a separate types.d.ts file
// (tsup inlines those types into index.d.ts).
let extendSrc = await readFile("src/mongoose-extend.d.ts", "utf8");
extendSrc = extendSrc.replace(/from "\.\/types"/, 'from "mongoose-construct-plugin"');
await writeFile("dist/mongoose-extend.d.ts", extendSrc);

const contents = await readFile(DTS, "utf8");
if (!contents.startsWith(REFERENCE)) {
  await writeFile(DTS, REFERENCE + contents);
}
