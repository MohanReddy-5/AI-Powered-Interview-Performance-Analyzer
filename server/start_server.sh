#!/bin/bash
# ====================================================
# AUTO-RESTART SERVER SCRIPT
# Use this instead of: python main.py
# If the server crashes for ANY reason, it will
# automatically restart after 3 seconds.
# ====================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate the virtual environment if it exists
if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
  echo "✅ Virtual environment activated"
fi

echo ""
echo "========================================"
echo "  AI Interview Server (Auto-Restart)"
echo "  Press Ctrl+C to fully stop"
echo "========================================"
echo ""

RESTART_COUNT=0

while true; do
  RESTART_COUNT=$((RESTART_COUNT + 1))
  if [ $RESTART_COUNT -gt 1 ]; then
    echo ""
    echo "🔁 Restart #$RESTART_COUNT — $(date '+%H:%M:%S')"
    echo ""
  fi

  python main.py

  EXIT_CODE=$?
  echo ""
  echo "⚠️  Server stopped (exit code: $EXIT_CODE)"
  echo "   Restarting in 3 seconds... (Ctrl+C to cancel)"
  sleep 3
done
