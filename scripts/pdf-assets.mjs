import { cp, mkdir } from "node:fs/promises";
const target = new URL("../public/pdfjs/", import.meta.url);
await mkdir(target, { recursive: true });
for (const name of [
  "build/pdf.worker.min.mjs",
  "cmaps",
  "standard_fonts",
  "wasm",
])
  await cp(
    new URL(`../node_modules/pdfjs-dist/${name}`, import.meta.url),
    new URL(name.replace("build/", ""), target),
    { recursive: true },
  );
