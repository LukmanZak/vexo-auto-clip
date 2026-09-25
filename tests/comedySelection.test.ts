import assert from "node:assert/strict";
import {
  countComedyReactionMarkers,
  countLaughMarkers,
  getComedyReactionStats,
  isStrongComedyCandidate,
  rankComedyCandidates,
  type ComedyReactionStats,
} from "../src/lib/comedySelection";

const transcript = [
  { start: 948, end: 953, text: "Lu pernah pull up di pintu enggak?" },
  { start: 953, end: 970, text: "Di rumah saudara ada. [tertawa] Di rumah dia enggak ada." },
  { start: 970, end: 990, text: "Pernah enggak punya ember dibolongin buat wudu? Pernah [tertawa] tuh?" },
  { start: 990, end: 1005, text: "Pernah enggak batu bata dikasih kertas kado? Enggak pernah. [tertawa]" },
  { start: 1005, end: 1016, text: "Pernah enggak mandi pakai gayung love? Enggak [tertawa] pernah." },
  { start: 3260, end: 3270, text: "Kalau suasananya ramai, saya tiba-tiba lost." },
  { start: 3270, end: 3290, text: "Saya suka menangkap nyamuk begini [tertawa]." },
  { start: 3290, end: 3310, text: "Masa sih? [tertawa] Terus saya dekatkan sampai mati [tertawa]." },
  { start: 3310, end: 3330, text: "Saya copot sayapnya [tertawa] sampai lepas semua [tertawa]." },
  { start: 3330, end: 3345, text: "Sudah puas saya. [tertawa]" },
  { start: 3400, end: 3420, text: "Mereka menjelaskan cara menaikkan berat badan agar tetap sehat." },
  { start: 3420, end: 3440, text: "Program pendampingan ahli gizi juga tersedia." },
  { start: 3500, end: 3510, text: "[tertawa] [tertawa]" },
];

const transcriptHasLaugh = countLaughMarkers(transcript) > 0;
assert.ok(countComedyReactionMarkers(transcript) >= 10);

const pullUpStats = getComedyReactionStats(transcript, 948, 1016);
assert.ok(isStrongComedyCandidate(pullUpStats, transcriptHasLaugh), "pull-up/gayung love comedy should survive");

const mosquitoStats = getComedyReactionStats(transcript, 3260, 3345);
assert.ok(isStrongComedyCandidate(mosquitoStats, transcriptHasLaugh), "mosquito story comedy should survive");

const informativeStats = getComedyReactionStats(transcript, 3400, 3440);
assert.equal(isStrongComedyCandidate(informativeStats, transcriptHasLaugh), false, "informative segment should be rejected");

const markerOnlyStats = getComedyReactionStats(transcript, 3500, 3510);
assert.equal(isStrongComedyCandidate(markerOnlyStats, transcriptHasLaugh), false, "marker-only segment should be rejected");

const makeStats = (markerCount: number, reactionDensity: number): ComedyReactionStats => ({
  markerCount,
  laughCount: markerCount,
  dialogueLineCount: 3,
  dialogueCharacters: 80,
  duration: 30,
  reactionDensity,
});

const ranked = rankComedyCandidates(
  Array.from({ length: 7 }, (_, index) => ({
    value: `clip-${index + 1}`,
    start: index * 40,
    end: index * 40 + 30,
    viralPotential: 50 + index,
    stats: makeStats(index + 2, (index + 2) / 30),
  })),
  6,
);
assert.equal(ranked.length, 6, "comedy candidates should be capped at six");
assert.equal(ranked[0].value, "clip-7", "highest reaction density should rank first");

console.log("comedySelection tests passed");
