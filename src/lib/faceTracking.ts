import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarker: FaceLandmarker | null = null;
let loading: Promise<FaceLandmarker> | null = null;

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (landmarker) return landmarker;
  if (loading) return loading;
  loading = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    // Try GPU first, fallback to CPU if fails (some devices/blacklist)
    const tryCreate = async (delegate: "GPU" | "CPU") => {
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/face_landmarker.task",
          delegate,
        },
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        runningMode: "VIDEO",
        numFaces: 3,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    };
    try {
      landmarker = await tryCreate("GPU");
    } catch (e) {
      console.warn("GPU delegate failed, fallback CPU", e);
      landmarker = await tryCreate("CPU");
    }
    return landmarker!;
  })();
  return loading;
}

export interface FaceTrack {
  time: number; // seconds
  x: number; // 0-1 normalized center x
  y: number; // 0-1 normalized center y
  width: number; // normalized
}

export async function detectFacesInVideo(
  video: HTMLVideoElement,
  sampleIntervalSec = 2,
  onProgress?: (p: number) => void
): Promise<FaceTrack[]> {
  const lm = await getFaceLandmarker();
  const tracks: FaceTrack[] = [];
  // ensure metadata loaded
  if (video.readyState < 1) {
    await new Promise<void>((resolve) => {
      const h = () => { video.removeEventListener("loadedmetadata", h); resolve(); };
      video.addEventListener("loadedmetadata", h);
      setTimeout(resolve, 2000);
    });
  }
  const duration = video.duration;
  if (!duration || isNaN(duration) || !isFinite(duration)) {
    throw new Error(`Video duration invalid: ${duration}. Pastikan video sudah load dan format mp4 valid.`);
  }
  // mute + play briefly to ensure frame available (some browsers need)
  const wasPaused = video.paused;
  video.muted = true;
  try { await video.play().catch(() => {}); } catch {}
  // small pause
  await new Promise((r) => setTimeout(r, 200));

  for (let t = 0; t < duration; t += sampleIntervalSec) {
    // clamp
    const target = Math.min(t, duration - 0.1);
    video.currentTime = target;
    await new Promise<void>((resolve) => {
      let done = false;
      const handler = () => {
        if (done) return;
        done = true;
        video.removeEventListener("seeked", handler);
        resolve();
      };
      video.addEventListener("seeked", handler);
      // fallback timeout if seeked not firing (e.g. same time)
      setTimeout(() => { if (!done) { done = true; video.removeEventListener("seeked", handler); resolve(); } }, 800);
    });
    // need frame rendered
    await new Promise((r) => setTimeout(r, 180));
    // ensure video has dimensions
    if (video.videoWidth === 0) {
      await new Promise((r) => setTimeout(r, 300));
    }
    const result: any = lm.detectForVideo(video, performance.now());
    if (result.detections && result.detections.length > 0) {
      // use detections bounding box (more stable than landmarks for box)
      let bestX = 0.5, bestY = 0.5, bestW = 0;
      let bestArea = 0;
      for (const det of result.detections) {
        const b = det.boundingBox;
        if (!b) continue;
        // b originX/Y is top-left in pixels relative to image, but mediapipe gives normalized? Actually boundingBox is {originX, originY, width, height} in pixels? normalize
        // Use normalized: convert via videoWidth
        const nx = (b.originX || 0) / (video.videoWidth || 1);
        const ny = (b.originY || 0) / (video.videoHeight || 1);
        const nw = (b.width || 0) / (video.videoWidth || 1);
        const nh = (b.height || 0) / (video.videoHeight || 1);
        const cx = nx + nw / 2;
        const cy = ny + nh / 2;
        const area = nw * nh;
        if (area > bestArea) {
          bestArea = area;
          bestX = cx;
          bestY = cy;
          bestW = nw;
        }
      }
      if (bestArea === 0 && result.faceLandmarks && result.faceLandmarks.length > 0) {
        // fallback to landmarks
        for (const landmarks of result.faceLandmarks) {
          let minX = 1, maxX = 0, minY = 1, maxY = 0;
          for (const p of landmarks) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          const w = maxX - minX;
          const h = maxY - minY;
          const area = w * h;
          if (area > bestArea) {
            bestArea = area;
            bestX = (minX + maxX) / 2;
            bestY = (minY + maxY) / 2;
            bestW = w;
          }
        }
      }
      // clamp 0-1
      bestX = Math.max(0.05, Math.min(0.95, bestX));
      tracks.push({ time: t, x: bestX, y: bestY, width: bestW || 0.18 });
    } else if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      let bestX = 0.5, bestY = 0.5, bestW = 0;
      let bestArea = 0;
      for (const landmarks of result.faceLandmarks) {
        let minX = 1, maxX = 0, minY = 1, maxY = 0;
        for (const p of landmarks) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const w = maxX - minX;
        const h = maxY - minY;
        const area = w * h;
        if (area > bestArea) {
          bestArea = area;
          bestX = (minX + maxX) / 2;
          bestY = (minY + maxY) / 2;
          bestW = w;
        }
      }
      tracks.push({ time: t, x: Math.max(0.05, Math.min(0.95, bestX)), y: bestY, width: bestW });
    } else {
      tracks.push({ time: t, x: 0.5, y: 0.5, width: 0 });
    }
    onProgress?.(Math.round(((t + sampleIntervalSec) / duration) * 100));
  }
  if (wasPaused) video.pause();
  // if all tracks are 0 width (no detection at all), warn
  const detected = tracks.filter((tr) => tr.width > 0).length;
  if (detected === 0) {
    console.warn("Face detection: 0 wajah terdeteksi di semua sample, mungkin video tanpa wajah jelas atau model gagal");
  }
  return tracks;
}

export function interpolateX(tracks: FaceTrack[], time: number): number {
  if (tracks.length === 0) return 0.5;
  if (time <= tracks[0].time) return tracks[0].x;
  if (time >= tracks[tracks.length - 1].time) return tracks[tracks.length - 1].x;
  for (let i = 0; i < tracks.length - 1; i++) {
    const a = tracks[i];
    const b = tracks[i + 1];
    if (time >= a.time && time <= b.time) {
      const ratio = (time - a.time) / (b.time - a.time);
      return a.x + (b.x - a.x) * ratio;
    }
  }
  return 0.5;
}
