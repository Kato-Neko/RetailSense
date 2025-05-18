// Stub for SORT tracking in the browser
// Replace with a real JS SORT implementation
let nextId = 1;
let prevTracks = [];

export function runSortOnDetections(detections) {
  // detections: [{x1, y1, x2, y2, score, classId}]
  // Return format: [{id, x1, y1, x2, y2}]
  // For now, assign incremental IDs
  const tracks = detections.map((det, i) => ({
    id: (prevTracks[i]?.id || nextId++),
    ...det,
  }));
  prevTracks = tracks;
  return tracks;
} 