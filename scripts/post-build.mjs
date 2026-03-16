import { readFile, writeFile, copyFile } from "fs/promises";

const REFERENCE = '/// <reference path="./mongoose-extend.d.ts" />\n';
const DTS = "dist/index.d.ts";

await copyFile("src/mongoose-extend.d.ts", "dist/mongoose-extend.d.ts");

const contents = await readFile(DTS, "utf8");
if (!contents.startsWith(REFERENCE)) {
  await writeFile(DTS, REFERENCE + contents);
}
