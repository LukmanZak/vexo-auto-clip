export interface TranscriptTimeRange {
  start: number;
  end: number;
}

export interface TranscriptTimeMarker {
  start: number;
  end?: number;
}

/**
 * Align a model-selected range to transcript row boundaries. A row's timestamp
 * marks its start; its end is the next row's timestamp.
 */
export function snapClipRangeToTranscript(
  candidateStart: number,
  candidateEnd: number,
  transcript: TranscriptTimeMarker[],
  upperBound = Number.POSITIVE_INFINITY,
): TranscriptTimeRange | null {
  if (!Number.isFinite(candidateStart) || !Number.isFinite(candidateEnd) || candidateEnd <= candidateStart) {
    return null;
  }

  const markers = [...new Set(transcript
    .map((line) => Number(line.start))
    .filter((time) => Number.isFinite(time) && time >= 0))]
    .sort((left, right) => left - right);
  if (!markers.length) return null;

  const maxTranscriptEnd = Math.max(
    ...transcript.map((line) => Number(line.end)).filter((time) => Number.isFinite(time) && time >= 0),
    markers[markers.length - 1] + 10,
  );
  const limit = Number.isFinite(upperBound) ? Math.min(maxTranscriptEnd, Math.max(0, upperBound)) : maxTranscriptEnd;

  const startBoundary = [...markers].reverse().find((time) => time <= candidateStart) ?? markers[0];
  const endBoundary = markers.find((time) => time >= candidateEnd) ?? maxTranscriptEnd;
  const start = Math.min(limit, Math.max(0, startBoundary));
  const end = Math.min(limit, Math.max(0, endBoundary));

  if (end <= start) return null;
  return { start, end };
}
