import test from "node:test";
import assert from "node:assert/strict";
import {
  alignNumericCitations,
  numericCitationsSupported,
} from "../lib/citations";
import type { Source } from "../lib/types";
const sources: Source[] = [
  {
    id: "a",
    file: "a.md",
    section: "Mission",
    page: null,
    citation: 1,
    text: "Atlas helps product teams with 50 to 500 employees.",
    similarity: 0.6,
    keyword: 0,
    score: 0,
  },
  {
    id: "b",
    file: "a.md",
    section: "Launch",
    page: null,
    citation: 2,
    text: "The Atlas public beta launches on November 18, 2026 with 150 invited teams.",
    similarity: 0.9,
    keyword: 0,
    score: 0,
  },
];
test("date and quantity citation is aligned only to unique matching evidence", () => {
  const claim =
    "The Atlas public beta launches on November 18, 2026 with 150 teams [1].";
  assert.equal(
    alignNumericCitations(claim, sources),
    claim.replace("[1]", "[2]"),
  );
  assert.equal(
    alignNumericCitations("Atlas has 500 employees [1].", sources),
    "Atlas has 500 employees [1].",
  );
  assert.equal(
    alignNumericCitations(claim, [
      ...sources,
      { ...sources[1], id: "c", citation: 3 },
    ]),
    claim,
  );
  assert.equal(
    alignNumericCitations("Atlas public beta launches in 2030 [1].", sources),
    "Atlas public beta launches in 2030 [1].",
  );
});
test("prefix citations repair the following claim and numeric scoring rejects wrong passages", () => {
  const claim =
    "[1] The Atlas public beta launches on November 18, 2026 with 150 teams.";
  assert.equal(
    alignNumericCitations(claim, sources),
    claim.replace("[1]", "[2]"),
  );
  assert.equal(numericCitationsSupported(claim, sources), false);
  assert.equal(
    numericCitationsSupported(claim.replace("[1]", "[2]"), sources),
    true,
  );
  assert.equal(
    alignNumericCitations(
      "[1] Atlas has 500 employees. Next, launch is in 2030.",
      sources,
    ),
    "[1] Atlas has 500 employees. Next, launch is in 2030.",
  );
});
test("numeric evidence checks table cells without treating filenames or list markers as claims", () => {
  const table =
    "| Topic | 01-Project.md | 02-Policy.md |\n|---|---|---|\n| Launch | November 18, 2026 [2] | Missing |";
  assert.equal(numericCitationsSupported(table, sources), true);
  assert.equal(
    numericCitationsSupported(table.replace("2026", "2030"), sources),
    false,
  );
  assert.equal(
    numericCitationsSupported(
      "1. The Atlas public beta launches on November 18, 2026 [2].",
      sources,
    ),
    true,
  );
});
