export interface ComedyTranscriptLine {
  start: number;
  end: number;
  text: string;
}

export interface ComedyReactionStats {
  markerCount: number;
  laughCount: number;
  dialogueLineCount: number;
  dialogueCharacters: number;
  duration: number;
  reactionDensity: number;
}

export interface RankedComedyCandidate<T> {
  value: T;
  start: number;
  end: number;
  viralPotential: number;
  stats: ComedyReactionStats;
}

// Keep this narrower than the general transcript reaction marker. A cough or
// throat-clear can help boundary detection, but it is not evidence that a
// segment is comedy.
const COMEDY_REACTION_MARKER = /\[(?:tertawa|berteriak|bersorak|laugh(?:ter)?|riuh|tepuk tangan|bersiul)[^\]]*\]/gi;
const LAUGH_MARKER = /\[(?:tertawa|laugh(?:ter)?)[^\]]*\]/gi;

function stripReactionMarkers(text: string): string {
  return text
    .replace(COMEDY_REACTION_MARKER, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) || []).length;
}

export function countComedyReactionMarkers(lines: ComedyTranscriptLine[]): number {
  return lines.reduce((total, line) => total + countMatches(line.text, COMEDY_REACTION_MARKER), 0);
}

export function countLaughMarkers(lines: ComedyTranscriptLine[]): number {
  return lines.reduce((total, line) => total + countMatches(line.text, LAUGH_MARKER), 0);
}

export function getComedyReactionStats(
  lines: ComedyTranscriptLine[],
  start: number,
  end: number,
): ComedyReactionStats {
  const duration = Math.max(0.1, end - start);
  const matching = lines.filter((line) => line.start < end && line.end > start);
  const text = matching.map((line) => line.text).join(" ");
  const markerCount = countMatches(text, COMEDY_REACTION_MARKER);
  const laughCount = countMatches(text, LAUGH_MARKER);
  const dialogueCharacters = stripReactionMarkers(text).length;
  return {
    markerCount,
    laughCount,
    dialogueLineCount: matching.filter((line) => stripReactionMarkers(line.text).length > 0).length,
    dialogueCharacters,
    duration,
    reactionDensity: markerCount / duration,
  };
}

/**
 * Strict Comedy mode deliberately rejects otherwise interesting but
 * informative podcast passages. Two reactions plus real dialogue keeps a
 * marker-only transcript row from becoming a clip by itself.
 */
export function isStrongComedyCandidate(stats: ComedyReactionStats, transcriptHasLaugh: boolean): boolean {
  if (stats.markerCount < 2) return false;
  if (transcriptHasLaugh && stats.laughCount < 1) return false;
  if (stats.dialogueLineCount < 2 || stats.dialogueCharacters < 40) return false;
  return true;
}

export function rankComedyCandidates<T>(candidates: RankedComedyCandidate<T>[], limit = 6): RankedComedyCandidate<T>[] {
  const ranked = [...candidates].sort((left, right) => {
    const densityDelta = right.stats.reactionDensity - left.stats.reactionDensity;
    if (Math.abs(densityDelta) > 0.0001) return densityDelta;
    const markerDelta = right.stats.markerCount - left.stats.markerCount;
    if (markerDelta !== 0) return markerDelta;
    return right.viralPotential - left.viralPotential;
  });
  const selected: RankedComedyCandidate<T>[] = [];
  for (const candidate of ranked) {
    const overlapsTooMuch = selected.some((other) => {
      const intersection = Math.max(0, Math.min(candidate.end, other.end) - Math.max(candidate.start, other.start));
      const shorterDuration = Math.max(0.1, Math.min(candidate.end - candidate.start, other.end - other.start));
      return intersection / shorterDuration >= 0.8;
    });
    if (overlapsTooMuch) continue;
    selected.push(candidate);
    if (selected.length >= limit) break;
  }
  return selected;
}
