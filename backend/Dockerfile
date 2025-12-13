# Build stage
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies including OpenCV requirements
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1-mesa-dev \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU-only first (much smaller)
RUN pip install --no-cache-dir --user torch==2.1.0+cpu torchvision==0.16.0+cpu -f https://download.pytorch.org/whl/cpu/torch_stable.html

# Copy requirements and install remaining dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Pre-download YOLO model to avoid slow downloads at runtime
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Runtime stage
FROM python:3.11-slim

WORKDIR /app

# Install only essential runtime dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-dev \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy only necessary Python packages from builder
COPY --from=builder /root/.local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /root/.local/bin /usr/local/bin

# Copy application code (only what's needed)
COPY main/ ./main/
COPY *.py ./

# Set PYTHONPATH for proper imports
ENV PYTHONPATH=/app

EXPOSE $PORT
# Use 1 worker for CPU-bound workload, but add threads for I/O operations
# Increased timeout to handle longer video processing (up to 10 minutes)
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "2", "--timeout", "600", "--keep-alive", "5", "main.app:app"]