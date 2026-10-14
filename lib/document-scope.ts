import type { Index } from "./types";

// An explicit attachment set must never silently fall back to the whole library.
export function resolveDocumentScope(
  index: Index,
  files?: string[],
  file?: string,
) {
  const selected = files === undefined ? undefined : [...new Set(files)].sort();
  if (selected && (!selected.length || selected.length > 100))
    throw new Error("Attach between one and 100 indexed documents.");
  for (const name of selected || (file ? [file] : [])) {
    if (!index.chunks.some((chunk) => chunk.file === name))
      throw new Error(
        `Document is not indexed: ${name}. Re-index or remove this attachment.`,
      );
  }
  if (file && selected && !selected.includes(file))
    throw new Error(
      "The selected document is not attached to this conversation.",
    );
  return file ? [file] : selected;
}
