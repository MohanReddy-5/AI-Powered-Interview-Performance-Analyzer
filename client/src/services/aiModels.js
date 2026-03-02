import * as faceapi from 'face-api.js';

/**
 * Load face-api.js models — using FULL landmark model for accurate gaze tracking
 */
export const loadModels = async () => {
    const MODEL_URL = '/models';
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),   // FULL 68-point model for accurate eye landmarks
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        console.log('✅ All face-api models loaded (tinyFaceDetector + faceLandmark68 FULL + faceExpression)');
    } catch (err) {
        console.warn('⚠️ Full landmark model failed, trying tiny:', err.message);
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
            ]);
            console.log('✅ Loaded with TINY landmark model (fallback)');
        } catch (err2) {
            console.warn('⚠️ All landmark models failed, face-only mode:', err2.message);
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
            ]);
            console.log('✅ Loaded tinyFaceDetector + faceExpression (no landmarks)');
        }
    }
};

/**
 * Eye Aspect Ratio — measures if eyes are open or closed.
 * EAR ~0.20-0.35 = open, EAR ~0.05-0.12 = closed/blinking.
 */
const calculateEAR = (eye) => {
    if (!eye || eye.length < 6) return 0;
    const A = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const B = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const C = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    if (C === 0) return 0;
    return (A + B) / (2.0 * C);
};

/**
 * Calculate iris/gaze position within the eye socket.
 *
 * face-api.js 68-landmark eye points:
 *   Left eye:  36=outer, 37=upper-outer, 38=upper-inner, 39=inner, 40=lower-inner, 41=lower-outer
 *   Right eye: 42=inner, 43=upper-inner, 44=upper-outer, 45=outer, 46=lower-outer, 47=lower-inner
 *
 * The "iris center" is estimated from the midpoints of the upper and lower eyelid landmarks,
 * which shift toward where the eye is actually looking:
 *   - Upper eyelid inner points (37,38 / 43,44) track the pupil upward movement
 *   - Lower eyelid inner points (40,41 / 46,47) track downward movement
 *   - The centroid of these 4 points closely follows iris position
 *
 * The "eye socket center" is the geometric center of all 6 eye boundary points.
 *
 * Returns { gazeX, gazeY } where:
 *   gazeX: 0.0 = looking far left, 0.5 = looking center, 1.0 = looking far right
 *   gazeY: 0.0 = looking up, 0.5 = looking center, 1.0 = looking down
 */
const calculateGazeRatio = (eye) => {
    if (!eye || eye.length < 6) return null;

    // Eye socket boundaries
    const outerCorner = eye[0]; // outer corner
    const innerCorner = eye[3]; // inner corner
    const eyeWidth = Math.abs(innerCorner.x - outerCorner.x);

    if (eyeWidth < 1) return null; // eye too small to analyze

    // Eye socket center (geometric center of all 6 landmarks)
    const socketCenterX = eye.reduce((sum, p) => sum + p.x, 0) / eye.length;
    const socketCenterY = eye.reduce((sum, p) => sum + p.y, 0) / eye.length;

    // Iris center estimation: centroid of the 4 inner eyelid points
    // These points (upper-outer, upper-inner, lower-inner, lower-outer)
    // move with the iris as the eye looks around
    const irisCenterX = (eye[1].x + eye[2].x + eye[4].x + eye[5].x) / 4;
    const irisCenterY = (eye[1].y + eye[2].y + eye[4].y + eye[5].y) / 4;

    // Eye height (vertical opening)
    const eyeHeight = (
        Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y) +
        Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y)
    ) / 2;

    if (eyeHeight < 0.5) return null; // Eye nearly closed

    // Horizontal gaze: how far left/right is the iris from the socket center
    // Normalized by eye width → 0.0 (far left) to 1.0 (far right)
    const gazeX = eyeWidth > 0
        ? 0.5 + (irisCenterX - socketCenterX) / eyeWidth
        : 0.5;

    // Vertical gaze: how far up/down is the iris from the socket center
    // Normalized by eye height → 0.0 (looking up) to 1.0 (looking down)
    const gazeY = eyeHeight > 0
        ? 0.5 + (irisCenterY - socketCenterY) / (eyeHeight * 1.5)
        : 0.5;

    return {
        gazeX: Math.max(0, Math.min(1, gazeX)),
        gazeY: Math.max(0, Math.min(1, gazeY)),
        irisCenterX,
        irisCenterY,
        socketCenterX,
        socketCenterY,
        eyeWidth,
        eyeHeight
    };
};

// ── Temporal smoothing state ──────────────────────────────────────────
let smoothedGazeX = 0.5;
let smoothedGazeY = 0.5;
const SMOOTHING_ALPHA = 0.4; // 0 = very smooth (slow), 1 = no smoothing (instant)

/**
 * Detect eye contact — IRIS-BASED GAZE TRACKING version.
 *
 * Uses THREE signals for accurate detection:
 *   1. EAR (Eye Aspect Ratio) — are the eyes open?
 *   2. Iris position within eye socket — WHERE are the eyes looking?
 *   3. Head pose via nose position — is the head oriented toward camera?
 *
 * When someone looks at the screen/camera:
 *   - Iris is centered in the eye socket (gazeX ≈ 0.5, gazeY ≈ 0.5)
 *   - Head is generally facing forward
 *
 * When someone looks away (up, down, left, right):
 *   - Iris shifts to the edge of the eye socket
 *   - gazeX or gazeY deviates significantly from 0.5
 *
 * Scoring:
 *   'good_eye_contact' → 1.0  (eyes open, gaze centered on screen)
 *   'slight_drift'     → 0.5  (gaze slightly off-center but still engaged)
 *   'looking_away'     → 0.0  (gaze clearly directed away from screen)
 *   'eyes_closed'      → 0.0
 *   'no_face'          → 0.0
 */
export const detectEyeContact = async (videoElement) => {
    if (!videoElement) return null;

    const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.3
    });

    try {
        // --- Detection WITH landmarks (full model preferred) ---
        const detection = await faceapi.detectSingleFace(videoElement, options)
            .withFaceLandmarks(false)  // false = use FULL landmark model (more accurate)
            .withFaceExpressions();

        if (detection) {
            const landmarks = detection.landmarks;
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            const nose = landmarks.getNose();

            // 1. EAR CHECK — are eyes open?
            const leftEAR = calculateEAR(leftEye);
            const rightEAR = calculateEAR(rightEye);
            const avgEAR = (leftEAR + rightEAR) / 2;
            const eyesOpen = avgEAR > 0.12;  // Threshold for eyes being open

            if (!eyesOpen) {
                return {
                    hasEyeContact: false,
                    reason: 'eyes_closed',
                    score: 0.0,
                    details: {
                        avgEAR,
                        eyesOpen: false,
                        method: 'landmarks_full'
                    }
                };
            }

            // 2. IRIS-BASED GAZE TRACKING — where are the eyes looking?
            const leftGaze = calculateGazeRatio(leftEye);
            const rightGaze = calculateGazeRatio(rightEye);

            if (leftGaze && rightGaze) {
                // Average both eyes for stability
                const rawGazeX = (leftGaze.gazeX + rightGaze.gazeX) / 2;
                const rawGazeY = (leftGaze.gazeY + rightGaze.gazeY) / 2;

                // Apply temporal smoothing (exponential moving average)
                smoothedGazeX = SMOOTHING_ALPHA * rawGazeX + (1 - SMOOTHING_ALPHA) * smoothedGazeX;
                smoothedGazeY = SMOOTHING_ALPHA * rawGazeY + (1 - SMOOTHING_ALPHA) * smoothedGazeY;

                // 3. HEAD POSE — secondary check
                const leftOuterX = leftEye[0]?.x || 0;
                const rightOuterX = rightEye[3]?.x || 0;
                const noseTipX = nose[3]?.x || 0;
                const eyeMidX = (leftOuterX + rightOuterX) / 2;
                const faceWidth = Math.abs(rightOuterX - leftOuterX);
                let headTurned = false;
                if (faceWidth > 0) {
                    const deviationRatio = Math.abs(noseTipX - eyeMidX) / faceWidth;
                    headTurned = deviationRatio > 0.35; // Head significantly turned
                }

                // 4. DETERMINE STATUS based on gaze deviation from center (0.5, 0.5)
                const horizDeviation = Math.abs(smoothedGazeX - 0.5);  // 0 = perfect center
                const vertDeviation = Math.abs(smoothedGazeY - 0.5);   // 0 = perfect center

                let status, score;

                if (headTurned) {
                    // Head is significantly turned away from camera
                    status = 'looking_away';
                    score = 0.0;
                } else if (horizDeviation < 0.06 && vertDeviation < 0.08) {
                    // Gaze is well-centered — looking at screen/camera
                    status = 'good_eye_contact';
                    score = 1.0;
                } else if (horizDeviation < 0.12 && vertDeviation < 0.14) {
                    // Gaze is slightly off — still mostly engaged
                    status = 'slight_drift';
                    score = 0.5;
                } else {
                    // Gaze is clearly away from center — looking up/down/sideways
                    status = 'looking_away';
                    score = 0.0;
                }

                return {
                    hasEyeContact: status === 'good_eye_contact',
                    reason: status,
                    score,
                    details: {
                        avgEAR,
                        eyesOpen: true,
                        isLookingForward: !headTurned,
                        rawGazeX,
                        rawGazeY,
                        smoothedGazeX,
                        smoothedGazeY,
                        horizDeviation,
                        vertDeviation,
                        leftEyeCenter: {
                            x: leftGaze.socketCenterX,
                            y: leftGaze.socketCenterY
                        },
                        rightEyeCenter: {
                            x: rightGaze.socketCenterX,
                            y: rightGaze.socketCenterY
                        },
                        leftIrisCenter: {
                            x: leftGaze.irisCenterX,
                            y: leftGaze.irisCenterY
                        },
                        rightIrisCenter: {
                            x: rightGaze.irisCenterX,
                            y: rightGaze.irisCenterY
                        },
                        gazeX: smoothedGazeX,
                        gazeY: smoothedGazeY,
                        smoothedScore: score,
                        faceWidth,
                        expressions: detection.expressions,
                        method: 'iris_gaze'
                    }
                };
            }

            // Gaze calculation failed — fall back to head-pose only
            const leftOuterX = leftEye[0]?.x || 0;
            const rightOuterX = rightEye[3]?.x || 0;
            const noseTipX = nose[3]?.x || 0;
            const eyeMidX = (leftOuterX + rightOuterX) / 2;
            const faceWidth = Math.abs(rightOuterX - leftOuterX);

            let isLookingForward = true;
            if (faceWidth > 0) {
                const deviationRatio = Math.abs(noseTipX - eyeMidX) / faceWidth;
                isLookingForward = deviationRatio < 0.30;
            }

            return {
                hasEyeContact: isLookingForward,
                reason: isLookingForward ? 'good_eye_contact' : 'looking_away',
                score: isLookingForward ? 0.7 : 0.0,
                details: {
                    avgEAR,
                    eyesOpen: true,
                    isLookingForward,
                    faceWidth,
                    expressions: detection.expressions,
                    method: 'head_pose_fallback'
                }
            };
        }
    } catch (err) {
        // Full landmark detection failed — try tiny model
        console.warn('Full landmark detection failed, trying tiny:', err.message);
        try {
            const detection = await faceapi.detectSingleFace(videoElement, options)
                .withFaceLandmarks(true)  // true = use TINY landmark model
                .withFaceExpressions();

            if (detection) {
                const landmarks = detection.landmarks;
                const leftEye = landmarks.getLeftEye();
                const rightEye = landmarks.getRightEye();
                const nose = landmarks.getNose();

                const leftEAR = calculateEAR(leftEye);
                const rightEAR = calculateEAR(rightEye);
                const avgEAR = (leftEAR + rightEAR) / 2;
                const eyesOpen = avgEAR > 0.12;

                if (!eyesOpen) {
                    return {
                        hasEyeContact: false,
                        reason: 'eyes_closed',
                        score: 0.0,
                        details: { avgEAR, eyesOpen: false, method: 'landmarks_tiny' }
                    };
                }

                // With tiny model, still attempt gaze ratio
                const leftGaze = calculateGazeRatio(leftEye);
                const rightGaze = calculateGazeRatio(rightEye);

                if (leftGaze && rightGaze) {
                    const rawGazeX = (leftGaze.gazeX + rightGaze.gazeX) / 2;
                    const rawGazeY = (leftGaze.gazeY + rightGaze.gazeY) / 2;

                    smoothedGazeX = SMOOTHING_ALPHA * rawGazeX + (1 - SMOOTHING_ALPHA) * smoothedGazeX;
                    smoothedGazeY = SMOOTHING_ALPHA * rawGazeY + (1 - SMOOTHING_ALPHA) * smoothedGazeY;

                    const horizDeviation = Math.abs(smoothedGazeX - 0.5);
                    const vertDeviation = Math.abs(smoothedGazeY - 0.5);

                    let status, score;
                    // Slightly more generous thresholds for tiny model (less accurate landmarks)
                    if (horizDeviation < 0.08 && vertDeviation < 0.10) {
                        status = 'good_eye_contact';
                        score = 1.0;
                    } else if (horizDeviation < 0.15 && vertDeviation < 0.17) {
                        status = 'slight_drift';
                        score = 0.5;
                    } else {
                        status = 'looking_away';
                        score = 0.0;
                    }

                    return {
                        hasEyeContact: status === 'good_eye_contact',
                        reason: status,
                        score,
                        details: {
                            avgEAR,
                            eyesOpen: true,
                            smoothedGazeX,
                            smoothedGazeY,
                            horizDeviation,
                            vertDeviation,
                            expressions: detection.expressions,
                            method: 'iris_gaze_tiny'
                        }
                    };
                }

                // Tiny model gaze failed — head pose fallback
                const leftOuterX = leftEye[0]?.x || 0;
                const rightOuterX = rightEye[3]?.x || 0;
                const noseTipX = nose[3]?.x || 0;
                const eyeMidX = (leftOuterX + rightOuterX) / 2;
                const faceWidth = Math.abs(rightOuterX - leftOuterX);

                let isLookingForward = true;
                if (faceWidth > 0) {
                    const deviationRatio = Math.abs(noseTipX - eyeMidX) / faceWidth;
                    isLookingForward = deviationRatio < 0.30;
                }

                return {
                    hasEyeContact: isLookingForward,
                    reason: isLookingForward ? 'good_eye_contact' : 'looking_away',
                    score: isLookingForward ? 0.7 : 0.0,
                    details: {
                        avgEAR,
                        eyesOpen: true,
                        isLookingForward,
                        faceWidth,
                        expressions: detection.expressions,
                        method: 'head_pose_tiny_fallback'
                    }
                };
            }
        } catch (err2) {
            console.warn('Tiny landmark detection also failed:', err2.message);
        }
    }

    try {
        // --- Fallback: face detection WITHOUT landmarks ---
        const faceOnly = await faceapi.detectSingleFace(videoElement, options)
            .withFaceExpressions();

        if (faceOnly) {
            return {
                hasEyeContact: false,
                reason: 'face_detected',
                score: 0.3,  // Face visible but can't determine gaze direction
                details: {
                    expressions: faceOnly.expressions,
                    method: 'face_only'
                }
            };
        }
    } catch (err) {
        console.warn('Face detection failed:', err.message);
    }

    // No face detected at all
    return {
        hasEyeContact: false,
        reason: 'no_face',
        score: 0.0,
        details: null
    };
};
