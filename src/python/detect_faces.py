#!/usr/bin/env python3
import sys, json, os, math, pathlib


def _clamp(value, low=0.0, high=1.0):
    return float(max(low, min(high, value)))


def _track_from_landmarks(landmarks):
    if not landmarks:
        return {"x": 0.5, "y": 0.5, "width": 0.0, "height": 0.0}
    min_x = _clamp(min(point.x for point in landmarks))
    max_x = _clamp(max(point.x for point in landmarks))
    min_y = _clamp(min(point.y for point in landmarks))
    max_y = _clamp(max(point.y for point in landmarks))
    width = _clamp(max_x - min_x)
    height = _clamp(max_y - min_y)
    return {
        "x": _clamp((min_x + max_x) / 2),
        "y": _clamp((min_y + max_y) / 2),
        "width": width,
        "height": height,
    }


def _fill_missing_tracks(tracks):
    """Interpolate gaps between real detections; leave all-missing input untouched."""
    valid = [index for index, track in enumerate(tracks) if float(track.get("width", 0)) > 0]
    if not valid:
        return tracks
    output = [dict(track) for track in tracks]
    for index, track in enumerate(output):
        if float(track.get("width", 0)) > 0:
            continue
        previous = max((candidate for candidate in valid if candidate < index), default=None)
        following = min((candidate for candidate in valid if candidate > index), default=None)
        if previous is None and following is None:
            continue
        if previous is None:
            source = output[following]
            output[index] = {**track, **{key: source.get(key, track.get(key, 0)) for key in ("x", "y", "width", "height")}}
            continue
        if following is None:
            source = output[previous]
            output[index] = {**track, **{key: source.get(key, track.get(key, 0)) for key in ("x", "y", "width", "height")}}
            continue
        left, right = output[previous], output[following]
        left_time, right_time = float(left.get("time", 0)), float(right.get("time", 0))
        ratio = 0.5 if right_time <= left_time else (float(track.get("time", 0)) - left_time) / (right_time - left_time)
        ratio = max(0.0, min(1.0, ratio))
        for key in ("x", "y", "width", "height"):
            lv = float(left.get(key, 0.0))
            rv = float(right.get(key, lv))
            output[index][key] = lv + (rv - lv) * ratio
    return output

def detect_with_mediapipe(video_path, interval=2.0):
    # try mediapipe
    try:
        import cv2
        # mediapipe 1.0.1 may not have mp.solutions, try both
        try:
            import mediapipe as mp
            mp_fd = None
            if hasattr(mp, "solutions") and hasattr(mp.solutions, "face_detection"):
                mp_fd = mp.solutions.face_detection
            else:
                # try tasks API fallback - if not available, raise to fallback haar
                raise Exception("mp.solutions not available")
        except Exception as e_imp:
            raise Exception(f"mediapipe import err: {e_imp}")
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise Exception(f"cannot open video {video_path}")
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration = frame_count / fps if fps else 0
        tracks = []
        with mp_fd.FaceDetection(model_selection=0, min_detection_confidence=0.5) as detector:
            t = 0.0
            while t < duration:
                cap.set(cv2.CAP_PROP_POS_MSEC, t*1000)
                ok, frame = cap.read()
                if not ok or frame is None:
                    tracks.append({"time": t, "x": 0.5, "y": 0.5, "width": 0, "height": 0})
                    t += interval
                    continue
                h, w = frame.shape[:2]
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                res = detector.process(rgb)
                if res.detections:
                    # pick largest
                    best = None
                    best_area = 0
                    for det in res.detections:
                        bb = det.location_data.relative_bounding_box
                        area = bb.width * bb.height
                        if area > best_area:
                            best_area = area
                            best = bb
                    if best:
                        cx = best.xmin + best.width/2
                        cy = best.ymin + best.height/2
                        tracks.append({"time": t, "x": _clamp(cx), "y": _clamp(cy), "width": _clamp(best.width), "height": _clamp(best.height)})
                    else:
                        tracks.append({"time": t, "x": 0.5, "y": 0.5, "width": 0, "height": 0})
                else:
                    tracks.append({"time": t, "x": 0.5, "y": 0.5, "width": 0, "height": 0})
                t += interval
        cap.release()
        return tracks
    except Exception as e:
        raise


def detect_with_blaze_face_model(video_path, interval=2.0):
    """Use the checked-in MediaPipe BlazeFace short-range TFLite model for stable boxes."""
    import cv2
    import mediapipe as mp
    from mediapipe.tasks.python import vision
    from mediapipe.tasks.python.core.base_options import BaseOptions

    project_root = pathlib.Path(__file__).resolve().parents[2]
    model_candidates = [
        os.getenv("BLAZE_FACE_MODEL", ""),
        str(project_root / "src" / "model" / "blaze_face_short_range.tflite"),
        str(project_root / "public" / "src" / "model" / "blaze_face_short_range.tflite"),
    ]
    model_path = next((candidate for candidate in model_candidates if candidate and os.path.isfile(candidate)), None)
    if not model_path:
        raise RuntimeError("blaze_face_short_range.tflite tidak ditemukan")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"cannot open video {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = frame_count / fps if fps else 0
    options = vision.FaceDetectorOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        running_mode=vision.RunningMode.IMAGE,
        min_detection_confidence=0.45,
    )
    tracks = []
    with vision.FaceDetector.create_from_options(options) as detector:
        t = 0.0
        while t < duration:
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ok, frame = cap.read()
            point = {"x": 0.5, "y": 0.5, "width": 0.0, "height": 0.0}
            if ok and frame is not None:
                h, w = frame.shape[:2]
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
                detections = getattr(result, "detections", []) or []
                boxes = []
                for detection in detections:
                    box = getattr(detection, "bounding_box", None)
                    if box is None:
                        continue
                    left = float(getattr(box, "origin_x", 0)) / max(1, w)
                    top = float(getattr(box, "origin_y", 0)) / max(1, h)
                    width = float(getattr(box, "width", 0)) / max(1, w)
                    height = float(getattr(box, "height", 0)) / max(1, h)
                    boxes.append((width * height, left, top, width, height))
                if boxes:
                    _, left, top, width, height = max(boxes, key=lambda item: item[0])
                    width = _clamp(width)
                    height = _clamp(height)
                    point = {"x": _clamp(left + width / 2), "y": _clamp(top + height / 2), "width": width, "height": height}
            tracks.append({"time": t, **point})
            t += interval
    cap.release()
    return tracks


def detect_with_tasks_face_landmarker(video_path, interval=2.0):
    """MediaPipe Tasks API path used by current mediapipe releases (0.10.3x+)."""
    import cv2
    import mediapipe as mp
    from mediapipe.tasks.python import vision
    from mediapipe.tasks.python.core.base_options import BaseOptions

    project_root = pathlib.Path(__file__).resolve().parents[2]
    model_candidates = [
        os.getenv("FACE_LANDMARKER_MODEL", ""),
        str(project_root / "public" / "src" / "model" / "face_landmarker.task"),
        str(project_root / "public" / "face_landmarker.task"),
    ]
    model_path = next((candidate for candidate in model_candidates if candidate and os.path.isfile(candidate)), None)
    if not model_path:
        raise RuntimeError("face_landmarker.task tidak ditemukan (set FACE_LANDMARKER_MODEL atau letakkan di public/src/model)")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"cannot open video {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = frame_count / fps if fps else 0
    tracks = []
    options = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=3,
        min_face_detection_confidence=0.4,
        min_face_presence_confidence=0.4,
        min_tracking_confidence=0.4,
    )
    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        t = 0.0
        while t < duration:
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ok, frame = cap.read()
            point = {"x": 0.5, "y": 0.5, "width": 0.0, "height": 0.0}
            if ok and frame is not None:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
                faces = getattr(result, "face_landmarks", []) or []
                if faces:
                    point = max((_track_from_landmarks(face) for face in faces), key=lambda item: item["width"])
            tracks.append({"time": t, **point})
            t += interval
    cap.release()
    return tracks

def detect_with_haar(video_path, interval=2.0):
    import cv2
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception(f"cannot open video {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = frame_count / fps if fps else 0
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)
    if face_cascade.empty():
        # try alternative path; never return dummy tracks because that hides a broken tracker.
        alt = "/usr/share/opencv4/haarcascades/haarcascade_frontalface_default.xml"
        if os.path.exists(alt):
            face_cascade = cv2.CascadeClassifier(alt)
        if face_cascade.empty():
            raise RuntimeError("Haar cascade tidak ditemukan di instalasi OpenCV")
    tracks = []
    t = 0.0
    while t < duration:
        cap.set(cv2.CAP_PROP_POS_MSEC, t*1000)
        ok, frame = cap.read()
        if not ok or frame is None:
            tracks.append({"time": t, "x": 0.5, "y": 0.5, "width": 0, "height": 0})
            t += interval
            continue
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(60,60))
        if len(faces) > 0:
            # largest
            largest = max(faces, key=lambda f: f[2]*f[3])
            x, y, fw, fh = largest
            cx = (x + fw/2) / w
            cy = (y + fh/2) / h
            nw = fw / w
            tracks.append({"time": t, "x": _clamp(cx), "y": _clamp(cy), "width": _clamp(nw), "height": _clamp(fh / h)})
        else:
            tracks.append({"time": t, "x": 0.5, "y": 0.5, "width": 0, "height": 0})
        t += interval
    cap.release()
    return tracks

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing videoPath"})); sys.exit(1)
    vp = sys.argv[1]
    try:
        interval = float(sys.argv[2]) if len(sys.argv) > 2 else 0.25
    except ValueError:
        interval = 0.25
    interval = max(0.2, min(2.0, interval)) if math.isfinite(interval) else 0.25
    # resolve relative to cwd
    if not os.path.exists(vp):
        # try temp variants
        for cand in [vp, os.path.join("temp","uploads", os.path.basename(vp)), os.path.join("temp","downloads", os.path.basename(vp))]:
            if os.path.exists(cand):
                vp = cand; break
    if not os.path.exists(vp):
        print(json.dumps({"error": f"video not found: {vp}"})); sys.exit(1)
    try:
        engine = "mediapipe"
        try:
            tracks = detect_with_blaze_face_model(vp, interval)
            engine = "blaze-face-tflite"
        except Exception as e_blaze:
            try:
                tracks = detect_with_mediapipe(vp, interval)
                engine = "mediapipe-blaze"
            except Exception as e_mediapipe:
                try:
                    tracks = detect_with_tasks_face_landmarker(vp, interval)
                    engine = "mediapipe-tasks"
                except Exception as e_tasks:
                    try:
                        tracks = detect_with_haar(vp, interval)
                        engine = "haar"
                    except Exception as e_haar:
                        raise RuntimeError(f"BlazeFace TFLite gagal: {e_blaze}; MediaPipe solutions gagal: {e_mediapipe}; MediaPipe Tasks gagal: {e_tasks}; Haar gagal: {e_haar}")
        tracks = _fill_missing_tracks(tracks)
        detected_count = sum(1 for track in tracks if float(track.get("width", 0)) > 0)
        print(json.dumps({
            "tracks": tracks,
            "count": len(tracks),
            "detectedCount": detected_count,
            "engine": engine,
        }))
    except Exception as e:
        print(json.dumps({"error": str(e)})); sys.exit(1)
