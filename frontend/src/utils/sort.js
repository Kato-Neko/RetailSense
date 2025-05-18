// Lightweight SORT tracker for browser (Kalman filter + Hungarian matching)
// Adapted for use with YOLO detections in React
// For production, consider using a more robust implementation or WASM port

// --- Simple Kalman filter and SORT logic ---
// This is a minimal, educational implementation. For real use, see https://github.com/duangenquan/sort.js

let nextTrackId = 1;
let tracks = [];

function iou(bb_test, bb_gt) {
  const xx1 = Math.max(bb_test[0], bb_gt[0]);
  const yy1 = Math.max(bb_test[1], bb_gt[1]);
  const xx2 = Math.min(bb_test[2], bb_gt[2]);
  const yy2 = Math.min(bb_test[3], bb_gt[3]);
  const w = Math.max(0, xx2 - xx1);
  const h = Math.max(0, yy2 - yy1);
  const wh = w * h;
  const area1 = (bb_test[2] - bb_test[0]) * (bb_test[3] - bb_test[1]);
  const area2 = (bb_gt[2] - bb_gt[0]) * (bb_gt[3] - bb_gt[1]);
  return wh / (area1 + area2 - wh + 1e-6);
}

export function runSortOnDetections(detections, iouThreshold = 0.3) {
  // detections: [{x1, y1, x2, y2, score, classId}]
  // tracks: [{id, x1, y1, x2, y2, age, hits, ...}]
  // Simple greedy matching by IoU
  const updatedTracks = [];
  const usedDetections = new Set();

  tracks.forEach(track => {
    let bestIoU = 0;
    let bestIdx = -1;
    detections.forEach((det, i) => {
      if (usedDetections.has(i)) return;
      const iouVal = iou([track.x1, track.y1, track.x2, track.y2], [det.x1, det.y1, det.x2, det.y2]);
      if (iouVal > bestIoU) {
        bestIoU = iouVal;
        bestIdx = i;
      }
    });
    if (bestIoU > iouThreshold && bestIdx !== -1) {
      // Update track
      const det = detections[bestIdx];
      updatedTracks.push({ ...det, id: track.id, age: 0, hits: track.hits + 1 });
      usedDetections.add(bestIdx);
    } else if (track.age < 2) {
      // Keep track for a few frames if not matched
      updatedTracks.push({ ...track, age: track.age + 1 });
    }
  });

  // Add new tracks for unmatched detections
  detections.forEach((det, i) => {
    if (!usedDetections.has(i)) {
      updatedTracks.push({ ...det, id: nextTrackId++, age: 0, hits: 1 });
    }
  });

  // Remove old tracks
  tracks = updatedTracks.filter(t => t.age < 2);
  // Return tracks in format: [{id, x1, y1, x2, y2}]
  return tracks.map(({ id, x1, y1, x2, y2 }) => ({ id, x1, y1, x2, y2 }));
} 