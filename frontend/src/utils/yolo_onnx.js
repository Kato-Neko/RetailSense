import * as ort from 'onnxruntime-web';

let session = null;

export async function loadYoloModel() {
  if (!session) {
    session = await ort.InferenceSession.create('/models/yolov8n.onnx');
  }
  return session;
}

function preprocess(imageData, inputShape = [1, 3, 640, 640]) {
  // Resize to 640x640, normalize to 0-1, transpose to CHW
  const [N, C, H, W] = inputShape;
  // Create a canvas to resize
  const resizeCanvas = document.createElement('canvas');
  resizeCanvas.width = W;
  resizeCanvas.height = H;
  const rctx = resizeCanvas.getContext('2d');
  rctx.drawImage(imageDataToCanvas(imageData), 0, 0, W, H);
  const resized = rctx.getImageData(0, 0, W, H).data;
  // Convert to Float32Array, normalize, and transpose
  const floatData = new Float32Array(C * H * W);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      for (let c = 0; c < C; c++) {
        // RGB order
        floatData[c * H * W + y * W + x] = resized[(y * W + x) * 4 + c] / 255.0;
      }
    }
  }
  return floatData;
}

function imageDataToCanvas(imageData) {
  // Convert ImageData to a canvas for resizing
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function postprocess(output, inputShape = [1, 3, 640, 640], confThreshold = 0.4, iouThreshold = 0.45) {
  // YOLOv8 ONNX output: [1, num_boxes, 85] (x, y, w, h, obj, 80 class scores)
  // This is a simplified version for COCO models
  const [N, C, H, W] = inputShape;
  const data = output.data;
  const numBoxes = output.dims[1];
  const numClasses = output.dims[2] - 5;
  const boxes = [];
  for (let i = 0; i < numBoxes; i++) {
    const offset = i * (5 + numClasses);
    const x = data[offset];
    const y = data[offset + 1];
    const w = data[offset + 2];
    const h = data[offset + 3];
    const obj = sigmoid(data[offset + 4]);
    let maxClass = 0, maxScore = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = sigmoid(data[offset + 5 + c]);
      if (score > maxScore) {
        maxScore = score;
        maxClass = c;
      }
    }
    const conf = obj * maxScore;
    if (conf > confThreshold) {
      // Convert xywh to xyxy
      const x1 = (x - w / 2) * W;
      const y1 = (y - h / 2) * H;
      const x2 = (x + w / 2) * W;
      const y2 = (y + h / 2) * H;
      boxes.push({ x1, y1, x2, y2, score: conf, classId: maxClass });
    }
  }
  // NMS (non-maximum suppression)
  return nms(boxes, iouThreshold);
}

function nms(boxes, iouThreshold) {
  // Greedy NMS
  boxes.sort((a, b) => b.score - a.score);
  const keep = [];
  for (let i = 0; i < boxes.length; i++) {
    let shouldKeep = true;
    for (let j = 0; j < keep.length; j++) {
      if (iou(boxes[i], keep[j]) > iouThreshold) {
        shouldKeep = false;
        break;
      }
    }
    if (shouldKeep) keep.push(boxes[i]);
  }
  return keep;
}

function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  const inter = w * h;
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter + 1e-6);
}

export async function runYoloOnFrame(imageData) {
  await loadYoloModel();
  const inputTensor = preprocess(imageData);
  const feeds = { 'images': new ort.Tensor('float32', inputTensor, [1, 3, 640, 640]) };
  const results = await session.run(feeds);
  // The output name may vary depending on your ONNX export
  const output = results[Object.keys(results)[0]];
  return postprocess(output);
} 