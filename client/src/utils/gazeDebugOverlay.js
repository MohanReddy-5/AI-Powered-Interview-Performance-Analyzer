/**
 * DEBUG OVERLAY FOR EYE GAZE TRACKING
 * Add this to your interview component to visualize gaze detection
 */

import { DEBUG_GAZE } from './services/aiModels';

export const drawGazeDebugOverlay = (canvasElement, videoElement, eyeContactResult) => {
    if (!DEBUG_GAZE || !eyeContactResult?.details) return;

    const ctx = canvasElement.getContext('2d');
    const { leftEyeCenter, rightEyeCenter, leftIrisCenter, rightIrisCenter, gazeX, gazeY, smoothedScore } = eyeContactResult.details;

    if (!leftEyeCenter || !rightEyeCenter) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw eye centers (BLUE)
    ctx.fillStyle = 'blue';
    ctx.beginPath();
    ctx.arc(leftEyeCenter.x, leftEyeCenter.y, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeCenter.x, rightEyeCenter.y, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Draw iris centers (GREEN)
    if (leftIrisCenter && rightIrisCenter) {
        ctx.fillStyle = 'lime';
        ctx.beginPath();
        ctx.arc(leftIrisCenter.x, leftIrisCenter.y, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rightIrisCenter.x, rightIrisCenter.y, 4, 0, 2 * Math.PI);
        ctx.fill();

        // Draw gaze direction lines (YELLOW)
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(leftEyeCenter.x, leftEyeCenter.y);
        ctx.lineTo(leftIrisCenter.x, leftIrisCenter.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rightEyeCenter.x, rightEyeCenter.y);
        ctx.lineTo(rightIrisCenter.x, rightIrisCenter.y);
        ctx.stroke();
    }

    // Display eye contact status
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = eyeContactResult.hasEyeContact ? 'lime' : 'red';
    ctx.fillText(`EYE CONTACT: ${eyeContactResult.hasEyeContact ? 'TRUE' : 'FALSE'}`, 10, 30);

    // Display gaze coordinates
    ctx.font = '14px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText(`Gaze X: ${gazeX?.toFixed(3)} (threshold: ±0.25)`, 10, 55);
    ctx.fillText(`Gaze Y: ${gazeY?.toFixed(3)} (threshold: ±0.30)`, 10, 75);
    ctx.fillText(`Smoothed Score: ${(smoothedScore * 100)?.toFixed(1)}%`, 10, 95);
};

// USAGE IN INTERVIEW COMPONENT:
// 1. Import: import { setDebugGaze } from './services/aiModels';
// 2. Enable debug mode: setDebugGaze(true);
// 3. Add canvas overlay to video element
// 4. Call drawGazeDebugOverlay in your video frame loop
