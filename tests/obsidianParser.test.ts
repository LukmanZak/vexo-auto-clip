import assert from "node:assert/strict";
import { parseObsidianMarkdown } from "../src/lib/obsidianParser";

const lines = parseObsidianMarkdown([
  "**0:10** · Setup sebelum punchline",
  "**0:10** · \\[tertawa\\] reaksi penonton",
  "**0:14** · Jawaban setelah reaksi",
  "**0:10** · marker tambahan pada detik yang sama",
].join("\n"));

assert.equal(lines.length, 2, "duplicate timestamps should be merged");
assert.equal(lines[0].start, 10);
assert.match(lines[0].text, /Setup sebelum punchline/);
assert.match(lines[0].text, /\[tertawa\]/, "escaped reaction marker must survive parsing");
assert.match(lines[0].text, /marker tambahan/, "non-consecutive duplicate timestamp must also merge");
assert.equal(lines[0].end, 14, "merged row should use the next timestamp as boundary");
assert.equal(lines[1].start, 14);

console.log("obsidianParser tests passed");
