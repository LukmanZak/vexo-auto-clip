import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from transcribe_clip import group_words_into_captions


class CaptionGroupingTests(unittest.TestCase):
    def test_splits_words_into_short_readable_sections(self):
        words = [
            {"start": 0.0, "end": 0.2, "word": "Kali"},
            {"start": 0.21, "end": 0.4, "word": "ini"},
            {"start": 0.41, "end": 0.7, "word": "gue"},
            {"start": 0.71, "end": 1.0, "word": "mau"},
            {"start": 1.01, "end": 1.3, "word": "bilang"},
            {"start": 1.31, "end": 1.6, "word": "sesuatu."},
            {"start": 1.8, "end": 2.1, "word": "Jangan"},
            {"start": 2.11, "end": 2.4, "word": "merasa"},
            {"start": 2.41, "end": 2.7, "word": "sendirian."},
        ]

        captions = group_words_into_captions(words)

        self.assertEqual([caption["text"] for caption in captions], [
            "Kali ini gue mau bilang sesuatu.",
            "Jangan merasa sendirian.",
        ])
        self.assertTrue(all(len(caption["text"].split()) <= 8 for caption in captions))
        self.assertEqual(captions[0]["start"], 0.0)
        self.assertEqual(captions[-1]["end"], 2.7)

    def test_splits_long_speech_without_punctuation(self):
        words = [
            {"start": index * 0.2, "end": index * 0.2 + 0.18, "word": f"kata{index}"}
            for index in range(10)
        ]

        captions = group_words_into_captions(words)

        self.assertEqual([len(caption["text"].split()) for caption in captions], [8, 2])


if __name__ == "__main__":
    unittest.main()
