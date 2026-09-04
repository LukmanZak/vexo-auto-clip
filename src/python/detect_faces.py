#!/usr/bin/env python3
import sys, json, os, math, pathlib

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
                    tracks.append({"time": t, "x": 0.5, "y": 0.5, "width": 0})
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
                        tracks.append({"time": t, "x": float(cx), "y": float(cy), "width": float(best.width)})
                    else:
                        tracks.append({"time": t, "x": 0.5, "y": 0.5, "width": 0})
                else:
                    tracks.append({"time": t, "x": 0.5, "y": 0.5, "width": 0})
                t += interval
        cap.release()
        return tracks
    except Exception as e:
        raise

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
        # try alternative path or download fallback to dummy
        alt = "/usr/share/opencv4/haarcascades/haarcascade_frontalface_default.xml"
        if os.path.exists(alt):
            face_cascade = cv2.CascadeClassifier(alt)
        if face_cascade.empty():
            # fallback: return dummy centered tracks (biar tetap bisa export)
            print(json.dumps({"warning": "haar cascade not found, fallback dummy", "tracks": []}), file=sys.stderr)
            # generate dummy
            import cv2 as cv2dummy
            cap2 = cv2dummy.VideoCapture(video_path)
            fps2 = cap2.get(cv2dummy.CAP_PROP_FPS) or 30
            cnt2 = int(cap2.get(cv2dummy.CAP_PROP_FRAME_COUNT) or 0)
            dur2 = cnt2 / fps2 if fps2 else 10
            cap2.release()
            return [{"time": t, "x": 0.5, "y": 0.5, "width": 0.18} for t in [i*interval for i in range(int(dur2/interval)+1)]]
    tracks = []
    t = 0.0
    while t < duration:
        cap.set(cv2.CAP_PROP_POS_MSEC, t*1000)
        ok, frame = cap.read()
        if not ok or frame is None:
            tracks.append({"time": t, "x": 0.5, "y": 0.5, "width": 0})
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
            tracks.append({"time": t, "x": float(cx), "y": float(cy), "width": float(nw)})
        else:
            tracks.append({"time": t, "x": 0.5, "y": 0.5, "width": 0})
        t += interval
    cap.release()
    return tracks

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing videoPath"})); sys.exit(1)
    vp = sys.argv[1]
    interval = float(sys.argv[2]) if len(sys.argv) > 2 else 2.0
    # resolve relative to cwd
    if not os.path.exists(vp):
        # try temp variants
        for cand in [vp, os.path.join("temp","uploads", os.path.basename(vp)), os.path.join("temp","downloads", os.path.basename(vp))]:
            if os.path.exists(cand):
                vp = cand; break
    if not os.path.exists(vp):
        print(json.dumps({"error": f"video not found: {vp}"})); sys.exit(1)
    try:
        try:
            tracks = detect_with_mediapipe(vp, interval)
        except Exception as e_mediapipe:
            # fallback haar
            try:
                tracks = detect_with_haar(vp, interval)
            except Exception as e2:
                # final fallback dummy centered (biar export tetap jalan)
                print(json.dumps({"warning": f"mediapipe err: {e_mediapipe} | haar err: {e2} -> fallback dummy", "tracks": []}), file=sys.stderr)
                import cv2 as cv2f
                capf = cv2f.VideoCapture(vp)
                fpsf = capf.get(cv2f.CAP_PROP_FPS) or 25
                cntf = int(capf.get(cv2f.CAP_PROP_FRAME_COUNT) or 0)
                durf = cntf / fpsf if fpsf else 20
                capf.release()
                tracks = [{"time": t, "x": 0.5, "y": 0.5, "width": 0.18} for t in [i*interval for i in range(int(durf/interval)+1)]]
        print(json.dumps({"tracks": tracks, "count": len(tracks)}))
    except Exception as e:
        print(json.dumps({"error": str(e)})); sys.exit(1)
