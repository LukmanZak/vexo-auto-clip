import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyComedyCorrections,
  buildComedyCorrectionPrompt,
  buildSlicinAnalysisPrompt,
  prepareComedyTranscript,
  prepareSlicinAnalysis,
  SLICIN_MODE_OPTIONS,
} from "./slicinPrompt.ts";
import { snapClipRangeToTranscript } from "./transcriptTiming.ts";

const source = "[00:03] Dia bilang, hidup itu kayak chargre pinjeman.\r\n[00:08] Besoknya chargernya dibawa kabur.";
const validCorrection = JSON.stringify([
  { id: "line-1", text: "Dia bilang, hidup itu kayak charger pinjeman." },
  { id: "line-2", text: "Besoknya chargernya dibawa kabur." },
]);

describe("comedy transcript prompts", () => {
  it("limits transcript cleanup to clear errors and preserves spoken style", () => {
    const prompt = buildComedyCorrectionPrompt(source);

    assert.match(prompt, /typo|salah ketik|salah dikenali/i);
    assert.match(prompt, /jangan parafrase/i);
    assert.match(prompt, /slang/i);
    assert.match(prompt, /ID.*sama|ID.*persis/i);
  });

  it("applies valid corrections while preserving original timestamps and line endings", () => {
    const corrected = applyComedyCorrections(source, validCorrection);

    assert.equal(
      corrected,
      "[00:03] Dia bilang, hidup itu kayak charger pinjeman.\r\n[00:08] Besoknya chargernya dibawa kabur.",
    );
  });

  it("rejects missing, duplicated, or reordered line IDs atomically", () => {
    const invalidResponses = [
      JSON.stringify([{ id: "line-1", text: "Changed" }]),
      JSON.stringify([
        { id: "line-1", text: "Changed" },
        { id: "line-1", text: "Duplicated" },
      ]),
      JSON.stringify([
        { id: "line-2", text: "Changed" },
        { id: "line-1", text: "Changed" },
      ]),
    ];

    for (const response of invalidResponses) {
      assert.equal(applyComedyCorrections(source, response), source);
    }
  });

  it("returns the original transcript when the correction response is invalid JSON", () => {
    assert.equal(applyComedyCorrections(source, "not-json"), source);
  });

  it("uses a valid correction result and falls back to the source when generation fails", async () => {
    let calls = 0;
    const corrected = await prepareComedyTranscript(source, async (prompt) => {
      calls += 1;
      assert.match(prompt, /konteks/i);
      return validCorrection;
    });
    assert.equal(corrected, "[00:03] Dia bilang, hidup itu kayak charger pinjeman.\r\n[00:08] Besoknya chargernya dibawa kabur.");

    const fallback = await prepareComedyTranscript(source, async () => {
      calls += 1;
      throw new Error("model unavailable");
    });
    assert.equal(fallback, source);
    assert.equal(calls, 2);
  });

  it("corrects only default comedy analysis and preserves custom prompts", async () => {
    let calls = 0;
    const generateCorrection = async () => {
      calls += 1;
      return validCorrection;
    };
    const comedy = await prepareSlicinAnalysis({
      mode: "comedy",
      fileName: "clip.mp4",
      transcript: source,
      generateCorrection,
    });

    assert.equal(calls, 1);
    assert.match(comedy.transcript, /chargernya dibawa kabur/);
    assert.match(comedy.prompt, /charger pinjeman/);
    assert.doesNotMatch(comedy.prompt, /chargre pinjeman/);

    const override = await prepareSlicinAnalysis({
      mode: "comedy",
      fileName: "clip.mp4",
      transcript: source,
      customPrompt: "Use this exact custom prompt.",
      generateCorrection,
    });
    assert.equal(override.prompt, "Use this exact custom prompt.");
    assert.equal(override.transcript, source);
    assert.equal(calls, 1);

    const podcast = await prepareSlicinAnalysis({
      mode: "podcast",
      fileName: "clip.mp4",
      transcript: source,
      generateCorrection,
    });
    assert.match(podcast.prompt, /hot takes/);
    assert.equal(podcast.transcript, source);
    assert.equal(calls, 1);
  });

  it("exposes Podcast, Comedy, Gaming, and Educate as selectable modes", () => {
    assert.deepEqual(SLICIN_MODE_OPTIONS, [
      { mode: "podcast", label: "Podcast" },
      { mode: "comedy", label: "Komedi" },
      { mode: "gaming", label: "Gaming" },
      { mode: "educate", label: "Educate" },
    ]);
  });

  it("corrects the Educate transcript before selecting clips", async () => {
    const source = "[08:00] AI sekarang udah mulai kay listrik.\n[08:45] Gagasan ini dilanjutkan.";
    const correctedResponse = JSON.stringify([
      { id: "line-1", text: "AI sekarang udah mulai kayak listrik." },
      { id: "line-2", text: "Gagasan ini dilanjutkan." },
    ]);
    let calls = 0;
    const educate = await prepareSlicinAnalysis({
      mode: "educate",
      fileName: "edukasi.mp4",
      transcript: source,
      generateCorrection: async (prompt) => {
        calls += 1;
        assert.match(prompt, /kay listrik/);
        return correctedResponse;
      },
    });

    assert.equal(calls, 1);
    assert.match(educate.prompt, /AI sekarang udah mulai kayak listrik/);
    assert.doesNotMatch(educate.prompt, /AI sekarang udah mulai kay listrik/);
    assert.match(educate.prompt, /setup/i);
    assert.match(educate.prompt, /15-60/);
  });

  it("uses distinct comedy, podcast, gaming, and educate selection criteria", () => {
    const comedy = buildSlicinAnalysisPrompt("comedy", "clip.mp4", source).toLowerCase();
    const podcast = buildSlicinAnalysisPrompt("podcast", "clip.mp4", source).toLowerCase();
    const gaming = buildSlicinAnalysisPrompt("gaming", "clip.mp4", source).toLowerCase();
    const educate = buildSlicinAnalysisPrompt("educate", "clip.mp4", source).toLowerCase();

    assert.match(comedy, /hanya karena.*tertawa/);
    assert.match(comedy, /out.of.the.box/);
    assert.match(comedy, /remaja dan dewasa indonesia/);
    assert.match(comedy, /25.*25.*15.*20/s);
    assert.match(comedy, /viralpotential/);
    assert.match(podcast, /hot takes/);
    assert.match(gaming, /lord steal/);
    assert.match(educate, /edukasi berbahasa indonesia/);
    assert.match(educate, /gagasan/);
    assert.match(educate, /timestamp transkrip/);
    assert.doesNotMatch(podcast, /out.of.the.box/);
    assert.doesNotMatch(gaming, /out.of.the.box/);
    assert.doesNotMatch(educate, /hot takes/);
  });
});


describe("educate transcript boundaries", () => {
  it("snaps 08:00-08:30 to the next transcript marker at 08:45", () => {
    assert.deepEqual(
      snapClipRangeToTranscript(480, 510, [
        { start: 480, end: 525 },
        { start: 525, end: 550 },
      ]),
      { start: 480, end: 525 },
    );
  });

  it("snaps a start backward and preserves an exact transcript end boundary", () => {
    assert.deepEqual(
      snapClipRangeToTranscript(483, 525, [
        { start: 480, end: 525 },
        { start: 525, end: 550 },
      ]),
      { start: 480, end: 525 },
    );
  });

  it("allows a complete thought to extend past 60 seconds to its transcript boundary", () => {
    assert.deepEqual(
      snapClipRangeToTranscript(480, 530, [
        { start: 480, end: 550 },
        { start: 550, end: 560 },
      ]),
      { start: 480, end: 550 },
    );
  });

  it("uses the last transcript row end when there is no later timestamp", () => {
    assert.deepEqual(
      snapClipRangeToTranscript(500, 505, [{ start: 500, end: 510 }]),
      { start: 500, end: 510 },
    );
  });
});
