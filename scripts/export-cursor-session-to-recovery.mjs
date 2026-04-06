#!/usr/bin/env bun
/**
 * Reads a Cursor agent transcript JSONL and writes recovery/SESSION-<id>-part-NN.md
 * with user + assistant text and tool_use blocks (JSON).
 *
 * Usage:
 *   bun scripts/export-cursor-session-to-recovery.mjs [path/to/transcript.jsonl]
 *
 * Default transcript (MaiaOS session):
 *   ~/.cursor/projects/.../agent-transcripts/<id>/<id>.jsonl
 */
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const DEFAULT_REL =
  "agent-transcripts/081dfade-6ebd-4ac8-a89e-d1fcff03b375/081dfade-6ebd-4ac8-a89e-d1fcff03b375.jsonl";

const REPO_ROOT = join(import.meta.dir, "..");
const OUT_DIR = join(REPO_ROOT, "recovery");
const MAX_CHARS = 95_000;
const TOOL_INPUT_MAX = 12_000;

function stripUserQueryTags(s) {
  return s
    .replace(/<user_query>\s*/gi, "")
    .replace(/\s*<\/user_query>/gi, "")
    .trim();
}

function stringifyToolInput(input) {
  try {
    const j = JSON.stringify(input, null, 2);
    return j.length > TOOL_INPUT_MAX ? `${j.slice(0, TOOL_INPUT_MAX)}\n… [truncated]` : j;
  } catch {
    return String(input).slice(0, TOOL_INPUT_MAX);
  }
}

function flattenMessageContent(content) {
  if (!content) return "";
  if (typeof content === "string") return stripUserQueryTags(content);
  if (!Array.isArray(content)) return JSON.stringify(content, null, 2);
  const chunks = [];
  for (const block of content) {
    if (block.type === "text") {
      chunks.push(stripUserQueryTags(block.text || ""));
    } else if (block.type === "tool_use") {
      chunks.push(
        `\n**Tool: \`${block.name || "tool"}\`**\n\n\`\`\`json\n${stringifyToolInput(block.input)}\n\`\`\`\n`,
      );
    } else {
      chunks.push(`\n_${JSON.stringify(block).slice(0, 400)}_\n`);
    }
  }
  return chunks.join("\n");
}

function formatTurn(lineNum, obj) {
  const role = obj.role || "unknown";
  let body = "";
  if (obj.message?.content) body = flattenMessageContent(obj.message.content);
  else if (obj.content) body = flattenMessageContent(obj.content);
  else body = `\`\`\`json\n${JSON.stringify(obj, null, 2).slice(0, 15_000)}\n\`\`\``;
  return `## Turn ${lineNum} — **${role}**\n\n${body}\n\n---\n\n`;
}

function resolveTranscriptPath(arg) {
  if (arg) return arg;
  const home = process.env.HOME || "";
  return join(
    home,
    ".cursor/projects/Users-samuelandert-Documents-Development-MaiaOS",
    DEFAULT_REL,
  );
}

const transcriptPath = resolveTranscriptPath(process.argv[2]);
const raw = readFileSync(transcriptPath, "utf8");
const lines = raw.split("\n").filter((l) => l.trim());
const transcriptId =
  basename(dirname(transcriptPath)).replace(/\.jsonl$/, "") || basename(transcriptPath, ".jsonl");

mkdirSync(OUT_DIR, { recursive: true });

let part = 1;
let buffer = `# Cursor session transcript (exported)\n\n**Source:** \`${transcriptPath}\`\n\n**Lines:** ${lines.length}\n\n---\n\n`;

for (let i = 0; i < lines.length; i++) {
  let obj;
  try {
    obj = JSON.parse(lines[i]);
  } catch {
    buffer += `## Turn ${i + 1} — **parse error**\n\n---\n\n`;
    continue;
  }
  const chunk = formatTurn(i + 1, obj);
  if (buffer.length + chunk.length > MAX_CHARS && buffer.length > 500) {
    writeFileSync(
      join(OUT_DIR, `SESSION-${transcriptId}-part-${String(part).padStart(2, "0")}.md`),
      buffer,
      "utf8",
    );
    part++;
    buffer = `# Part ${part} (continued)\n\n**Session:** \`${transcriptId}\`\n\n---\n\n${chunk}`;
  } else {
    buffer += chunk;
  }
}

writeFileSync(
  join(OUT_DIR, `SESSION-${transcriptId}-part-${String(part).padStart(2, "0")}.md`),
  buffer,
  "utf8",
);

const partFiles = [];
for (let p = 1; p <= part; p++) {
  partFiles.push(`SESSION-${transcriptId}-part-${String(p).padStart(2, "0")}.md`);
}

const readme = `# recovery/

Exported Cursor agent transcript for MaiaOS planning.

| File | Description |
|------|-------------|
${partFiles.map((f) => `| \`${f}\` | User + assistant turns, tool calls (Read, Shell, …) |`).join("\n")}

**Re-export:**

\`\`\`bash
bun scripts/export-cursor-session-to-recovery.mjs
\`\`\`

Optional: pass a path to another \`.jsonl\` transcript.

**Source:** \`${transcriptPath}\`

**Session id:** \`${transcriptId}\`
`;

writeFileSync(join(OUT_DIR, "README.md"), readme, "utf8");

console.log("Wrote:", OUT_DIR, `parts ${part}, turns ${lines.length}`);
