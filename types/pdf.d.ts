declare module "pdf-parse/lib/pdf-parse.js" {
  const parse: (
    buffer: Uint8Array,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  export default parse;
}
