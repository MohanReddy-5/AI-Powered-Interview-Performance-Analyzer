#!/bin/bash
# Download face-api.js models
BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

# Tiny Face Detector
curl -O "$BASE_URL/tiny_face_detector_model-weights_manifest.json"
curl -O "$BASE_URL/tiny_face_detector_model-shard1"

# Face Expresion
curl -O "$BASE_URL/face_expression_model-weights_manifest.json"
curl -O "$BASE_URL/face_expression_model-shard1"

# Face Landmark 68 (Tiny)
curl -O "$BASE_URL/face_landmark_68_tiny_model-weights_manifest.json"
curl -O "$BASE_URL/face_landmark_68_tiny_model-shard1"

echo "Models downloaded to $(pwd)"
