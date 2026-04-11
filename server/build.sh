#!/usr/bin/env bash
# ============================================================
# Render.com Build Script
# Runs during deployment to install deps + download spaCy model
# ============================================================

set -o errexit  # Exit on error

echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "🧠 Downloading spaCy model (small, for 512MB RAM)..."
python -m spacy download en_core_web_sm

echo "✅ Build complete!"
