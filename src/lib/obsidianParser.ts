export interface TranscriptLine {
  start: number; // seconds
  end: number;
  text: string;
}

export function parseObsidianMarkdown(md: string): TranscriptLine[] {
  // Obsidian Web Clipper output varies between bold timestamps, bracketed
  // timestamps, and plain timestamp + separator. Parse line-by-line so a
  // timestamp in ordinary prose does not accidentally become a transcript row.
  const parsed: { text: string; startSec: number }[] = [];
  const timestamp = /^\s*(?:[-*]\s*)?(?:\*{0,2})\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?(?:\*{0,2})(?:\s*(?:·|[-–—|])\s*|\s+)(.+?)\s*$/;

  for (const rawLine of md.split(/\r?\n/)) {
    const match = rawLine.match(timestamp);
    if (!match) continue;
    const text = match[2].replace(/^\*{1,2}|\*{1,2}$/g, "").trim();
    if (!text) continue;
    parsed.push({ text, startSec: timeToSeconds(match[1]) });
  }

  // Keep source order but ignore duplicate timestamps commonly produced by
  // copied headings. The next timestamp is the most useful segment boundary.
  const unique = parsed.filter((item, index) => index === 0 || item.startSec !== parsed[index - 1].startSec);
  return unique.map((cur, index) => ({
    start: cur.startSec,
    end: unique[index + 1]?.startSec ?? cur.startSec + 10,
    text: cur.text,
  }));
}

export function timeToSeconds(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function secondsToTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function transcriptToPlain(lines: TranscriptLine[]): string {
  return lines.map(l => `[${secondsToTime(l.start)}] ${l.text}`).join("\n");
}
