# Detection Configuration Guide

## Quick Start

### Using Presets

Set `DETECTION_PRESET` in your `.env` file:

- **speed**: Fastest processing, lower accuracy
- **balanced**: Good balance (default) - **Recommended for most use cases**
- **accuracy**: Best accuracy, slower processing - **Requires Railway Pro 16GB+**

### Manual Configuration

Set individual parameters in your `.env` file:

```bash
# For better accuracy (requires Railway Pro 16GB+)
YOLO_CONFIDENCE=0.5
YOLO_INPUT_SIZE=640
FRAME_SKIP=5
DEEPSORT_MAX_AGE=50

# For faster processing (current default)
YOLO_CONFIDENCE=0.4
YOLO_INPUT_SIZE=320
FRAME_SKIP=10
DEEPSORT_MAX_AGE=30
```

## Parameter Reference

### YOLO Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `YOLO_CONFIDENCE` | 0.4 | 0.0-1.0 | Detection confidence threshold. Higher = fewer false positives but may miss people |
| `YOLO_IOU` | 0.5 | 0.0-1.0 | IoU threshold for Non-Maximum Suppression. Lower = more aggressive filtering |
| `YOLO_POST_CONFIDENCE` | 0.3 | 0.0-1.0 | Additional confidence filter after YOLO inference |
| `YOLO_INPUT_SIZE` | 320 | 320/416/640/1280 | Input image size. Larger = more accurate but slower |
| `YOLO_MAX_DETECTIONS` | 5 | 1-100 | Maximum detections per frame |
| `YOLO_MODEL` | yolov8n.pt | yolov8n/s/m/l/x.pt | YOLO model variant (n=nano, s=small, m=medium, l=large, x=xlarge) |

### DeepSort Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `DEEPSORT_MAX_AGE` | 30 | 1-100 | Frames to keep track without detection. Higher = better persistence |
| `DEEPSORT_N_INIT` | 3 | 1-10 | Frames needed to confirm a track. Higher = more stable tracks |
| `DEEPSORT_MAX_IOU_DISTANCE` | 0.7 | 0.0-1.0 | Maximum IoU distance for matching. Lower = stricter matching |
| `DEEPSORT_MAX_COSINE_DISTANCE` | 0.2 | 0.0-1.0 | Maximum cosine distance for appearance matching. Lower = stricter |

### Processing Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `FRAME_SKIP` | 10 | 1-30 | Process every Nth frame. Lower = more accurate tracking but slower |
| `MAX_FRAME_WIDTH` | 320 | 320-1920 | Resize frames to this width for processing. Larger = more accurate but slower |

### Live Stream Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `LIVE_STREAM_CONFIDENCE` | 0.25 | 0.0-1.0 | Confidence threshold for live stream processing (typically lower for real-time) |

## Preset Configurations

### Speed Preset
```bash
DETECTION_PRESET=speed
```
- **YOLO Confidence**: 0.3
- **Input Size**: 320x320
- **Frame Skip**: 15
- **Max Frame Width**: 320px
- **DeepSort max_age**: 20
- **Best For**: Fast processing, development/testing
- **Railway**: Works on Free tier (if upgraded to Pro)

### Balanced Preset (Default)
```bash
DETECTION_PRESET=balanced
```
- **YOLO Confidence**: 0.4
- **Input Size**: 320x320
- **Frame Skip**: 10
- **Max Frame Width**: 320px
- **DeepSort max_age**: 30
- **Best For**: Production use, good balance
- **Railway**: Works on Pro 8GB+ (recommended 16GB)

### Accuracy Preset
```bash
DETECTION_PRESET=accuracy
```
- **YOLO Confidence**: 0.5
- **Input Size**: 640x640
- **Frame Skip**: 5
- **Max Frame Width**: 640px
- **DeepSort max_age**: 50
- **DeepSort n_init**: 5
- **Best For**: High-accuracy requirements
- **Railway**: Requires Pro 16GB+ (recommended)

## Resource Impact Summary

### Current Settings (Balanced)
- **RAM per job**: ~1.5 GB
- **CPU per job**: ~2 vCPU
- **Processing time**: 2-3 min per 1-min video
- **Concurrent jobs (16GB)**: 7-10 jobs

### High-Accuracy Settings
- **RAM per job**: ~2.7 GB (+80%)
- **CPU per job**: ~6-8 vCPU (+300%)
- **Processing time**: 8-15 min per 1-min video (+400%)
- **Concurrent jobs (16GB)**: 5-7 jobs

## Railway Pro Recommendations

### For Balanced Settings
- **Minimum**: 8 GB RAM, 8 vCPU
- **Recommended**: 16 GB RAM, 16 vCPU
- **Can handle**: 7-10 concurrent jobs

### For High-Accuracy Settings
- **Minimum**: 16 GB RAM, 16 vCPU
- **Recommended**: 16 GB RAM, 16 vCPU (optimal)
- **Can handle**: 5-7 concurrent jobs

### For Maximum Performance
- **Recommended**: 32 GB RAM, 32 vCPU
- **Can handle**: 10-14 concurrent jobs (high-accuracy)

## Example Configurations

### Development/Testing
```bash
DETECTION_PRESET=speed
# Fast iteration, lower resource usage
```

### Production (Standard)
```bash
DETECTION_PRESET=balanced
# Good balance of speed and accuracy
```

### Production (High Accuracy)
```bash
DETECTION_PRESET=accuracy
# Best accuracy, requires Railway Pro 16GB+
```

### Custom High-Performance
```bash
YOLO_CONFIDENCE=0.6
YOLO_INPUT_SIZE=1280
FRAME_SKIP=3
MAX_FRAME_WIDTH=1280
DEEPSORT_MAX_AGE=60
YOLO_MAX_DETECTIONS=20
# Maximum accuracy, very resource-intensive
```

## See Also

- [RAILWAY_RESOURCE_ANALYSIS.md](./RAILWAY_RESOURCE_ANALYSIS.md) - Detailed resource analysis
- Railway Pro Plan: https://railway.app/pricing

