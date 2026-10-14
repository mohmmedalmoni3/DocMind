import { ingest } from "../lib/ingest";
ingest((e) => console.log(JSON.stringify(e))).catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
