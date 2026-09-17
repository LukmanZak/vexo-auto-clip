import unittest

from detect_faces import _point


class FaceTrackNormalizationTests(unittest.TestCase):
    def test_box_center_is_clamped_inside_frame(self):
        point = _point(1.4, -0.2, 0.8, 0.9)
        self.assertEqual(point["width"], 0.8)
        self.assertEqual(point["height"], 0.9)
        self.assertGreaterEqual(point["x"] - point["width"] / 2, 0)
        self.assertLessEqual(point["x"] + point["width"] / 2, 1)
        self.assertGreaterEqual(point["y"] - point["height"] / 2, 0)
        self.assertLessEqual(point["y"] + point["height"] / 2, 1)


if __name__ == "__main__":
    unittest.main()
