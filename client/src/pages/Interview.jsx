import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import Layout from '../components/Layout';
import { Square, Play, RefreshCw, Loader2, Key, CheckCircle, AlertCircle, Volume2, VolumeX, Mic, MicOff, Clock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loadModels, detectEyeContact } from '../services/aiModels';
// llmService no longer needed — Gemini calls go through server
import { analyzeLocally } from '../services/localAnalysis';
import { analyzeWithGemini } from '../services/geminiAnalysis';
import { interviewAPI } from '../services/apiClient';
import VoiceCaptureManager from '../services/voiceCaptureManager';
// face-api is used internally by aiModels.js - no direct import needed
import { domains, getRandomQuestions } from '../data/questionBank';

const Interview = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    // -- Setup State --
    const [apiKey, setApiKey] = useState(location.state?.apiKey || localStorage.getItem('gemini_api_key') || "");
    // showKeyModal removed — server handles API key securely
    const [sessionId, setSessionId] = useState(null);
    const [domainTitle, setDomainTitle] = useState("General");

    // -- Interview State --
    const [questions, setQuestions] = useState([]); // Now array of Objects {text, ideal}
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);

    // -- Data Collection --
    const [currentEmotion, setCurrentEmotion] = useState("Neutral");
    const [transcript, setTranscript] = useState("");
    const [finalTranscript, setFinalTranscript] = useState("");
    const [emotionHistory, setEmotionHistory] = useState([]);
    // MULTI-QUESTION RESULT STORAGE: Store results by QUESTION ID
    // Format: { "question-id-1": { score: 80, ... }, "question-id-2": ... }
    const [analysisResults, setAnalysisResults] = useState({});
    const analysisResultsRef = useRef({}); // Mirror of analysisResults — always fresh (no stale closure)
    const voiceCaptureRef = useRef(null);
    const answersRef = useRef({}); // Store raw answers for batch analysis
    const [voiceStatus, setVoiceStatus] = useState('idle'); // idle, listening, no-speech, error, restarting

    // -- Voice Mute State --
    const [isMuted, setIsMuted] = useState(false);
    const isMutedRef = useRef(false); // Ref mirror to avoid stale closure in speakQuestion

    // -- Text Input Mode (Fallback for voice issues) --
    const [useTextMode, setUseTextMode] = useState(false);
    const [textAnswer, setTextAnswer] = useState("");

    // -- Telemetry State (per-question for live UI) --
    const [startTime, setStartTime] = useState(null);
    const [faceTrackedFrames, setFaceTrackedFrames] = useState(0);
    const [cumulativeScore, setCumulativeScore] = useState(0);
    const [totalFrames, setTotalFrames] = useState(0);

    // -- Session-Level Eye Contact (persists across ALL questions) --
    const sessionCumulativeScore = useRef(0);
    const sessionTotalFrames = useRef(0);

    // -- Timer Tracking --
    const [elapsedTime, setElapsedTime] = useState(0); // live display counter (seconds)
    const questionStartTimeRef = useRef(null); // precise start time for current question
    const questionTimingsRef = useRef([]); // array of { questionId, questionText, durationSeconds }
    const interviewStartTimeRef = useRef(null); // overall interview start time

    // 1. Initialize Session & AI
    const initCalledRef = useRef(false); // Guard against React StrictMode double-mount
    useEffect(() => {
        if (initCalledRef.current) return; // Already initialized — skip duplicate call
        initCalledRef.current = true;

        const init = async () => {
            // Load Domain & RANDOMIZE Questions
            const selectedDomainId = location.state?.domain?.id || domains[0].id; // default to first if missing
            const selectedDomainFull = domains.find(d => d.id === selectedDomainId) || domains[0];

            // TRUE RANDOMIZATION: Get 5 fresh questions
            let freshQuestions = getRandomQuestions(selectedDomainId, 5);

            // CRITICAL: Ensure every question has a unique ID for tracking
            freshQuestions = freshQuestions.map((q, idx) => ({
                ...q,
                id: q.id || `${selectedDomainId}-q${idx}-${Date.now()}`
            }));

            setQuestions(freshQuestions);
            setDomainTitle(selectedDomainFull.title);

            // Create Session via API
            try {
                const response = await interviewAPI.startSession(selectedDomainFull.title);
                setSessionId(response.data.session_id);
            } catch (error) {
                console.error('Failed to create session:', error);
                alert('Failed to start interview session. Please login again.');
                navigate('/login');
                return;
            }

            // Load AI Models
            await loadModels();
            setModelsLoaded(true);

            // Speak First Question (with delay)
            setTimeout(() => speakQuestion(freshQuestions[0]?.text), 1500);
        };
        init();
    }, [location.state]);

    // -- Text to Speech Logic --
    const speakQuestion = (text) => {
        if (!text) return;
        window.speechSynthesis.cancel();

        // Check mute state via ref (avoids stale closure)
        if (isMutedRef.current) {
            console.log('🔇 Voice muted — skipping speech');
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85; // Slightly slower for more natural human-like pace
        utterance.pitch = 1.05; // Slightly higher for warmer, more natural tone
        utterance.volume = 1.0;
        utterance.lang = 'en-US';

        // Wait for voices to load (Chrome quirk)
        let voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
            window.speechSynthesis.onvoiceschanged = () => {
                voices = window.speechSynthesis.getVoices();
                setVoice(utterance, voices);
                window.speechSynthesis.speak(utterance);
            };
        } else {
            setVoice(utterance, voices);
            window.speechSynthesis.speak(utterance);
        }
    };

    const setVoice = (utterance, voices) => {
        // Priority list: most natural-sounding voices first
        // 1. Google UK English Female (very natural, Chrome)
        // 2. Microsoft Aria (natural, Edge/Windows)
        // 3. Karen (Mac, Australian English — very clear)
        // 4. Samantha (Mac, US English)
        // 5. Google US English (Chrome fallback)
        // 6. Any English female voice
        const priorityNames = [
            'Google UK English Female',
            'Microsoft Aria',
            'Karen',
            'Samantha',
            'Google US English',
            'Microsoft Zira',
        ];

        for (const name of priorityNames) {
            const match = voices.find(v => v.name.includes(name));
            if (match) {
                utterance.voice = match;
                console.log('🔊 Using voice:', match.name);
                return;
            }
        }

        // Fallback: any English female voice
        const englishVoice = voices.find(v =>
            v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.includes('Fiona') || v.name.includes('Moira'))
        );
        if (englishVoice) {
            utterance.voice = englishVoice;
            console.log('🔊 Using fallback English voice:', englishVoice.name);
        }
    };

    // 2. Initialize Voice Capture Manager + Request Mic Permission Immediately
    useEffect(() => {
        const vcManager = new VoiceCaptureManager();
        vcManager.initialize();

        // Set up callbacks
        vcManager.onTranscriptUpdate = (fullTranscript, finalOnly) => {
            setTranscript(fullTranscript);
            setFinalTranscript(finalOnly);
        };

        vcManager.onStatusChange = (status) => {
            setVoiceStatus(status);
            console.log('Voice capture status:', status);
        };

        vcManager.onError = (errorMessage) => {
            console.error('Voice capture error:', errorMessage);
            setVoiceStatus('error');
        };

        voiceCaptureRef.current = vcManager;

        // ── REQUEST MIC PERMISSION ON PAGE LOAD ──────────────────────────
        // This shows the browser's "Allow Microphone" prompt immediately
        // instead of waiting until the user clicks Start Recording
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                // Permission granted — stop the stream right away (we'll reopen it on start)
                stream.getTracks().forEach(track => track.stop());
                console.log('✅ Microphone permission granted');
                setVoiceStatus('ready');
            })
            .catch(err => {
                console.warn('⚠️ Mic permission denied or unavailable:', err.message);
                // Auto-switch to text mode so user can still complete interview
                setUseTextMode(true);
                setVoiceStatus('error');
            });
        // ─────────────────────────────────────────────────────────────────

        return () => {
            if (voiceCaptureRef.current) {
                voiceCaptureRef.current.destroy();
            }
        };
    }, []);

    // 3. GENUINE Eye Contact & Emotion Tracking (NO VISUAL OVERLAY)
    useEffect(() => {
        let interval;
        if (isRecording && modelsLoaded && webcamRef.current?.video) {
            interval = setInterval(async () => {
                const video = webcamRef.current.video;
                if (video.readyState === 4) {
                    setTotalFrames(prev => prev + 1);

                    try {
                        const result = await detectEyeContact(video);

                        if (result) {
                            // Track face detection for UI
                            if (result.reason !== 'no_face') {
                                setFaceTrackedFrames(prev => prev + 1);
                            }

                            // Use the score directly from aiModels.js
                            // Iris-based gaze scoring:
                            //   'good_eye_contact' → 1.0  (gaze centered on screen)
                            //   'slight_drift'     → 0.5  (gaze slightly off)
                            //   'looking_away'     → 0.0  (gaze clearly away)
                            //   'face_detected'    → 0.3  (no landmarks, face only)
                            //   'eyes_closed'      → 0.0
                            //   'no_face'          → 0.0
                            const frameScore = result.score || 0;
                            setCumulativeScore(prev => prev + frameScore);
                            // NOTE: totalFrames is already incremented above (line 190) — do NOT double-count

                            // ACCUMULATE TO SESSION-LEVEL (persists across all questions)
                            sessionCumulativeScore.current += frameScore;
                            sessionTotalFrames.current += 1;

                            // Track emotions/status for Live UI
                            setCurrentEmotion(result.reason || 'neutral');

                            if (result.details?.expressions) {
                                // CRITICAL FIX: Extract dominant emotion (was broken: [...prev])
                                const expressions = result.details.expressions;
                                const dominantExpression = Object.keys(expressions).reduce((a, b) =>
                                    expressions[a] > expressions[b] ? a : b, 'neutral');
                                console.log('😊 Emotion:', dominantExpression);
                                setEmotionHistory(prev => [...prev, dominantExpression]);
                            }
                        } else {
                            setCurrentEmotion('neutral');
                        }
                    } catch (err) {
                        console.warn('Eye tracking error:', err.message);
                        setTotalFrames(prev => Math.max(0, prev - 1));
                    }
                }
            }, 200); // 5 times per second (balanced tracking)
        }
        return () => clearInterval(interval);
    }, [isRecording, modelsLoaded]);

    const handleStart = async () => {
        window.speechSynthesis.cancel(); // Stop reading if user interrupts

        // Wait briefly for speech audio to fully stop so the mic doesn't capture it
        await new Promise(resolve => setTimeout(resolve, 300));

        setTranscript("");
        setFinalTranscript("");
        setTextAnswer("");
        setEmotionHistory([]);
        setFaceTrackedFrames(0);
        setCumulativeScore(0);
        setTotalFrames(0);
        setStartTime(Date.now());
        setIsRecording(true);

        // Timer tracking
        const now = Date.now();
        questionStartTimeRef.current = now;
        if (!interviewStartTimeRef.current) {
            interviewStartTimeRef.current = now; // First question = interview start
        }
        setElapsedTime(0); // reset per-question live timer

        // If text mode, just start recording state
        if (useTextMode) {
            console.log('Using text input mode');
            return;
        }

        // Start voice capture with new manager
        if (voiceCaptureRef.current) {
            try {
                const started = await voiceCaptureRef.current.start();
                if (!started) {
                    console.error('❌ Voice capture start returned false');
                    setVoiceStatus('error');
                    setUseTextMode(true);
                    alert('Voice capture failed. Switched to text input mode. You can type your answer below.');
                } else {
                    console.log('✅ Voice capture started successfully');
                }
            } catch (err) {
                console.error('❌ Voice start error:', err);
                setVoiceStatus('error');
                setUseTextMode(true);
                alert('Microphone error. Switched to text input mode.');
            }
        }
    };

    const handleStop = async () => {
        setIsRecording(false);

        // Record question timing
        if (questionStartTimeRef.current) {
            const durationMs = Date.now() - questionStartTimeRef.current;
            const currentQ = questions[currentQIndex];
            questionTimingsRef.current = [
                ...questionTimingsRef.current,
                {
                    questionId: currentQ?.id,
                    questionText: currentQ?.text || `Question ${currentQIndex + 1}`,
                    durationSeconds: Math.round(durationMs / 1000)
                }
            ];
            questionStartTimeRef.current = null;
        }

        // Get transcript from either voice or text mode
        let capturedTranscript = '';
        let audioBlob = null;

        if (useTextMode) {
            capturedTranscript = textAnswer.trim();
            console.log('Using text answer:', capturedTranscript);
        } else {
            // Stop voice capture and get final transcript + AUDIO BLOB
            if (voiceCaptureRef.current) {
                const result = await voiceCaptureRef.current.stop();
                capturedTranscript = result.transcript || '';
                audioBlob = result.audioBlob;
                console.log('🎤 Voice capture result length:', capturedTranscript.length, 'hasReceivedSpeech:', voiceCaptureRef.current.hasReceivedSpeech);

                // CRITICAL FALLBACK: If stop() returned empty but the live display
                // had text (via onTranscriptUpdate callbacks), use that instead.
                // The React state `transcript` and `finalTranscript` hold what the user SAW.
                if (!capturedTranscript || capturedTranscript.trim().length < 3) {
                    const displayedTranscript = (finalTranscript || transcript || '').trim();
                    if (displayedTranscript.length >= 3) {
                        console.log('🔄 Using displayed transcript as fallback:', displayedTranscript.substring(0, 80));
                        capturedTranscript = displayedTranscript;
                    }
                }

                // Only force empty if transcript is very short AND no speech event ever fired
                if (!voiceCaptureRef.current.hasReceivedSpeech && capturedTranscript.trim().length < 3) {
                    console.warn('⚠️ No speech events AND very short transcript — treating as empty');
                    capturedTranscript = '';
                }
            } else {
                capturedTranscript = '';
            }
        }

        // CRITICAL: Validate transcript thoroughly
        capturedTranscript = capturedTranscript.trim();

        // Remove ONLY true noise artifacts (single filler syllables)
        // CRITICAL: Do NOT include common English words like 'I', 'is', 'it', 'this' — they appear in valid answers!
        const noisePatterns = /^(um|uh|hmm|huh|ah|er)$/i;
        const words = capturedTranscript.split(/\s+/).filter(w => w.length > 0);
        const meaningfulWords = words.filter(w => !noisePatterns.test(w));

        console.log('📝 Final transcript:', capturedTranscript.length > 0 ? capturedTranscript : '(EMPTY)');
        console.log('📝 Word count:', words.length, '| Meaningful words:', meaningfulWords.length);

        // FORCE ZERO SCORE if:
        // 1. Transcript is empty
        // 2. Less than 3 total words (likely noise)
        // 3. No meaningful words at all
        // EXCEPT: If transcript > 5 chars, we should evaluate it (User Requirement)
        let forceZeroScore = false;
        const isLongEnough = capturedTranscript && capturedTranscript.length > 5;

        if ((!capturedTranscript || capturedTranscript.length === 0 || words.length < 3) && !isLongEnough) {
            console.warn('⚠️ No meaningful answer detected - will force score to 0');
            forceZeroScore = true;
        }

        setIsProcessing(true);

        const currentQ = questions[currentQIndex];

        // --- Analysis Phase ---
        // ============================================================
        // MULTI-QUESTION DEBUG LOGGING
        // ============================================================
        console.log('='.repeat(60));
        console.log('📝 SUBMITTING ANSWER');
        console.log('='.repeat(60));
        console.log('Current Question Index:', currentQIndex);
        console.log('Total Questions:', questions.length);
        console.log('Transcript Length:', capturedTranscript.length);

        // Store the answer transcript in ref for batch processing
        if (capturedTranscript) {
            answersRef.current = {
                ...answersRef.current,
                [currentQ.id]: capturedTranscript
            };
        }

        // TEMPORARY DEBUG LOGS REQUESTED BY USER
        console.log("--------------------------------------------------");
        console.log("🔍 DEBUG STATE:");
        console.log("CURRENT QUESTION ID:", currentQ.id);
        console.log("TOTAL ANSWERS (Keys):", Object.keys(analysisResults));
        console.log("NUMBER OF STORED ANSWERS:", Object.keys(analysisResults).length);
        console.log("--------------------------------------------------");

        console.log('Emotion History Length:', emotionHistory.length);
        console.log('Eye Contact Frames:', totalFrames);
        console.log('Cumulative Score:', cumulativeScore);
        console.log('='.repeat(60) + '\n');

        const emotionCounts = emotionHistory.reduce((acc, e) => { acc[e] = (acc[e] || 0) + 1; return acc; }, {});
        const dominantEmotion = Object.keys(emotionCounts).reduce((a, b) => emotionCounts[a] > emotionCounts[b] ? a : b, "neutral");

        let analysis;

        // Calculate Telemetry
        const safeStartTime = startTime || (Date.now() - 10000);
        const durationMinutes = (Date.now() - safeStartTime) / 60000;
        const wordCount = words.length;
        const wpm = durationMinutes > 0 ? Math.round(wordCount / durationMinutes) : 0;

        const fillerRegex = /\b(um|uh|like|actually|basically|literally)\b/gi;
        const fillerCount = (capturedTranscript && capturedTranscript.match(fillerRegex) || []).length;
        // Calculate final weighted score
        const eyeContactScore = totalFrames > 0
            ? Math.round((cumulativeScore / totalFrames) * 100)
            : 0;
        const telemetry = { wpm, fillerCount, eyeContactScore };
        const emotionData = { dominant: dominantEmotion, history: emotionCounts };

        // === HYBRID ANALYSIS (Server-side Gemini + Local scoring) ===
        try {
            console.log('🤖 Using hybrid analysis (server-side Gemini)...');
            analysis = await analyzeWithGemini({
                transcript: capturedTranscript,
                question: currentQ.text,
                ideal_answer: currentQ.ideal,
                audio_blob: audioBlob
            });

            // Update transcript if Gemini transcribed it
            if (analysis.transcript && !capturedTranscript) {
                capturedTranscript = analysis.transcript;
                // Update ref with better transcript
                if (answersRef.current[currentQ.id]) {
                    answersRef.current[currentQ.id] = analysis.transcript;
                }
            }
        } catch (err) {
            console.error("Hybrid analysis error:", err);
            analysis = await analyzeLocally(capturedTranscript, currentQ.text, { title: domainTitle }, currentQ.ideal);
        }

        // Save to Backend API
        if (sessionId) {
            try {
                await interviewAPI.submitAnswer(
                    sessionId,
                    currentQ.id, // Passed Question ID
                    currentQ.text,
                    capturedTranscript,
                    { dominant: dominantEmotion, history: emotionCounts },
                    domainTitle,
                    // Use SESSION-LEVEL score (not per-question) so server always has cumulative data
                    sessionTotalFrames.current > 0
                        ? (sessionCumulativeScore.current / sessionTotalFrames.current) // decimal 0-1
                        : 0,
                    currentQ.ideal || '', // Pass ideal answer for results page
                    audioBlob // Pass audio blob for server-side Whisper transcription
                );

                // Store analysis result for local state/debugging if backend returns it
                // Backend returns: { "success": true, "analysis": {...} }
                // We use function update to NOT overwrite previous results
                setAnalysisResults(prev => {
                    // Use Question ID as key - PREVENTS OVERWRITING
                    const qId = currentQ.id;

                    const newResults = {
                        ...prev,
                        [qId]: {
                            ...analysis, // Store full analysis first
                            questionId: qId,
                            question: currentQ.text,
                            transcript: capturedTranscript,
                            score: analysis?.score || 0,
                            feedback: analysis?.feedback || "",
                            ideal_answer: currentQ.ideal || analysis?.ideal_answer || "",
                            status: analysis?.status || "pending",
                        }
                    };

                    // DEBUG LOGS requested by user
                    console.log(`\n📝 ANALYSIS STORED for Question ID: ${qId}`);
                    console.log("answers keys:", Object.keys(newResults));
                    console.log("analysisResults:", newResults);
                    console.log(`Score for ${qId}:`, analysis?.score);

                    return newResults;
                });
                // CRITICAL: Also update the ref so batch analysis has fresh data
                analysisResultsRef.current = {
                    ...analysisResultsRef.current,
                    [currentQ.id]: {
                        ...analysis,
                        questionId: currentQ.id,
                        question: currentQ.text,
                        transcript: capturedTranscript,
                        score: analysis?.score || 0,
                        feedback: analysis?.feedback || "",
                        ideal_answer: currentQ.ideal || analysis?.ideal_answer || "",
                        status: analysis?.status || "pending",
                    }
                };
            } catch (error) {
                console.error('Failed to save answer:', error);
                // Continue anyway - don't block user
            }
        }

        setIsProcessing(false);

        if (currentQIndex < questions.length - 1) {
            const nextIndex = currentQIndex + 1;
            setCurrentQIndex(nextIndex);
            setElapsedTime(0); // Reset timer display for next question
            // Auto-Speak Next Question
            setTimeout(() => speakQuestion(questions[nextIndex]?.text), 1000);
        } else {
            console.log("✅ INTERVIEW ENDED - Running Final Batch Analysis...");
            setIsProcessing(true); // Keep loading state

            // 1. FORCE ANALYSIS TRIGGER: Analyze all captured answers
            const finalResults = await analyzeAllAnswers(answersRef.current);
            console.log("📈 Final Analysis Results:", finalResults);

            try {
                // 1. SAFE SESSION OBJECT
                const currentUser = JSON.parse(localStorage.getItem("user") || "null");
                const safeSession = {
                    sessionId: sessionId || Date.now().toString(),
                    userId: currentUser?.email || "local-user",
                    answers: questions.map(q => {
                        // Link question to its result
                        const result = finalResults[q.id] || {};
                        const breakdown = result.breakdown || { technical: 0, grammar: 0, accent: 0, confidence: 0 };

                        // Embed breakdown INSIDE feedback JSON so Results page can find it from both paths
                        const feedbackObj = {
                            text: result.feedback || "No feedback available",
                            breakdown: breakdown,
                            technical_feedback: result.technical_feedback || "",
                            grammar_feedback: result.grammar_feedback || "",
                            improvement_points: result.improvement_points || [],
                            missing_concepts: result.missing_concepts || [],
                        };

                        return {
                            questionId: q.id,
                            question: q.text,
                            transcript: answersRef.current[q.id] || result.transcript || "",
                            score: result.score ?? 0,
                            feedback: JSON.stringify(feedbackObj),
                            ideal_answer: q.ideal || result.ideal_answer || "Not available",
                            breakdown: breakdown, // Also keep as top-level for localStorage reads
                            improvement_points: result.improvement_points || [],
                            missing_concepts: result.missing_concepts || [],
                            status: result.status || "completed"
                        };
                    }),
                    // Calculate overall score: WEIGHTED FORMULA
                    // 85% from answer average (all questions) + 15% from eye contact
                    overallScore: (() => {
                        // 1) Answer average: ALL questions, unanswered = 0
                        const scores = Object.values(finalResults).map(r => r.score || 0);
                        const totalQuestions = questions.length;
                        const sum = scores.reduce((acc, s) => acc + s, 0);
                        const answerAvg = sum / totalQuestions;

                        // 2) Eye contact percentage (0-100)
                        const eyeContact = sessionTotalFrames.current > 0
                            ? Math.round((sessionCumulativeScore.current / sessionTotalFrames.current) * 100)
                            : 0;

                        // 3) Weighted: 85% answers + 15% eye contact
                        const weighted = Math.round((answerAvg * 0.85) + (eyeContact * 0.15));
                        console.log(`📊 Overall Score = (${Math.round(answerAvg)} * 0.85) + (${eyeContact} * 0.15) = ${weighted}%`);
                        return Math.min(100, Math.max(0, weighted));
                    })(),
                    domain: domainTitle, // Store domain for Results page display
                    createdAt: Date.now(),
                    // SESSION-LEVEL eye contact — uses accumulated data from ALL questions
                    eyeContactScore: sessionTotalFrames.current > 0
                        ? Math.round((sessionCumulativeScore.current / sessionTotalFrames.current) * 100)
                        : 0,
                    // Timer data
                    questionTimings: questionTimingsRef.current,
                    totalDurationSeconds: interviewStartTimeRef.current
                        ? Math.round((Date.now() - interviewStartTimeRef.current) / 1000)
                        : 0
                };

                console.log("SAVED SESSION OBJECT:", safeSession);

                // 2. GUARANTEED SAVE (LOCAL FALLBACK)
                const existingSessions = JSON.parse(localStorage.getItem("interview_sessions") || "[]");
                localStorage.setItem(
                    "interview_sessions",
                    JSON.stringify([...existingSessions, safeSession])
                );

                // Attempt backend end-session with final eye contact score
                const finalEyeContact = sessionTotalFrames.current > 0
                    ? Math.round((sessionCumulativeScore.current / sessionTotalFrames.current) * 100)
                    : 0;
                await interviewAPI.endSession(sessionId, finalEyeContact);

            } catch (err) {
                console.error("Failed to save/end session:", err);
            }

            setIsProcessing(false);
            navigate('/results', { state: { sessionId } });
        }
    };

    // NEW: Batch Analysis Helper (defined inside component to access state/props)
    const analyzeAllAnswers = async (allAnswers) => {
        // Use the REF (always fresh) instead of analysisResults state (may be stale)
        const results = { ...analysisResultsRef.current };

        console.log("🕵️‍♀️ BATCH ANALYSIS: Checking", Object.keys(allAnswers).length, "answers");
        console.log("📊 Already analyzed:", Object.keys(results).length, "questions");

        // Helper: delay between API calls to avoid rate limits
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        for (const [qId, transcript] of Object.entries(allAnswers)) {
            const qObj = questions.find(q => q.id === qId);
            const questionText = qObj?.text || "Unknown Question";
            const idealAnswer = qObj?.ideal || "";

            // If we already have a valid result from per-question analysis, just ensure ideal_answer is set
            if (results[qId] && (results[qId].score > 0 || results[qId].transcript)) {
                console.log(`✓ Using existing analysis for ${qId} (score: ${results[qId].score})`);
                // Ensure ideal_answer is always present
                results[qId].ideal_answer = results[qId].ideal_answer || idealAnswer || "Not available";
                results[qId].transcript = results[qId].transcript || transcript;
                continue;
            }

            // Only re-analyze questions that truly have no result
            console.log(`🔄 Analyzing missing result for ${qId}...`);

            let evaluation = null;

            try {
                // Add delay to avoid rate limiting
                await delay(2000);
                evaluation = await analyzeWithGemini({
                    transcript: transcript,
                    question: questionText,
                    ideal_answer: idealAnswer
                });
            } catch (err) {
                console.warn(`Analysis failed for ${qId}:`, err.message);
            }

            // Fallback if analysis failed
            if (!evaluation || (evaluation.score === undefined && evaluation.score !== 0)) {
                evaluation = {
                    score: transcript && transcript.trim().length > 10 ? 40 : 0,
                    feedback: transcript && transcript.trim().length > 10
                        ? "Answer recorded. AI analysis was unavailable — basic scoring applied."
                        : "No meaningful answer detected. Please speak clearly and provide a complete answer.",
                    status: transcript && transcript.trim().length > 10 ? 'fair' : 'poor',
                    improvement_points: ["Study the ideal answer provided", "Practice explaining concepts clearly"],
                };
            }

            // Always include ideal_answer and transcript
            evaluation.ideal_answer = evaluation.ideal_answer || idealAnswer || "Not available";
            evaluation.transcript = evaluation.transcript || transcript;

            results[qId] = evaluation;
        }

        // Also ensure any question that was asked but has no answer gets a proper entry
        for (const q of questions) {
            if (!results[q.id]) {
                results[q.id] = {
                    score: 0,
                    feedback: "No answer was provided for this question.",
                    ideal_answer: q.ideal || "Not available",
                    transcript: "",
                    status: "poor",
                    improvement_points: ["Provide an answer to this question"],
                };
            }
            // Ensure every result has ideal_answer
            if (!results[q.id].ideal_answer || results[q.id].ideal_answer === "Not available") {
                results[q.id].ideal_answer = q.ideal || "Not available";
            }
        }

        setAnalysisResults(results);
        return results;
    };

    const handleRepeatQuestion = () => {
        if (isMutedRef.current) return; // Respect mute state
        speakQuestion(questions[currentQIndex]?.text);
    };

    // Keep mute ref in sync with state
    useEffect(() => {
        isMutedRef.current = isMuted;
        if (isMuted) {
            window.speechSynthesis.cancel(); // Stop any ongoing speech immediately
        }
    }, [isMuted]);

    // Live elapsed timer (ticks every second while recording)
    useEffect(() => {
        let timer;
        if (isRecording) {
            timer = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isRecording]);

    // Format seconds to MM:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Layout>
            {/* API Key Modal removed — server handles API key securely */}

            <div className="max-w-5xl mx-auto px-4 py-12 min-h-[calc(100vh-64px)] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{domainTitle} Interview</h2>
                        <p className="text-slate-400 text-sm">Question {currentQIndex + 1} of {questions.length}</p>
                    </div>
                    {/* Voice Mute/Unmute Toggle */}
                    <button
                        onClick={() => {
                            setIsMuted(prev => !prev);
                            // Immediately cancel any ongoing speech
                            window.speechSynthesis.cancel();
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${isMuted
                            ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                            : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                            }`}
                        title={isMuted ? 'Unmute question voice' : 'Mute question voice'}
                    >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        {isMuted ? 'Unmute' : 'Voice On'}
                    </button>
                    <div className="flex items-center gap-3">
                        {/* Voice Status Indicator */}
                        {voiceStatus === 'listening' && (
                            <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/30">
                                <Mic className="w-4 h-4 text-green-400 animate-pulse" />
                                <span className="text-sm font-medium text-green-400">Listening</span>
                            </div>
                        )}
                        {voiceStatus === 'no-speech' && (
                            <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/30">
                                <MicOff className="w-4 h-4 text-amber-400" />
                                <span className="text-sm font-medium text-amber-400">No speech detected</span>
                            </div>
                        )}
                        {voiceStatus === 'restarting' && (
                            <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/30">
                                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                <span className="text-sm font-medium text-blue-400">Reconnecting...</span>
                            </div>
                        )}
                        {voiceStatus === 'error' && (
                            <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/30">
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                <span className="text-sm font-medium text-red-400">Error - Check mic</span>
                            </div>
                        )}
                        {!isRecording && voiceStatus === 'idle' && (
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-slate-600" />
                                <span className="text-sm font-medium text-slate-300">Ready</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mode Toggle Button */}
                {!isRecording && (
                    <div className="mb-4 flex justify-end">
                        <button
                            onClick={() => setUseTextMode(!useTextMode)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            {useTextMode ? '🎤 Switch to Voice Mode' : '⌨️ Switch to Text Mode'}
                        </button>
                    </div>
                )}

                {/* Real-time Transcript Preview (voice mode) */}
                {isRecording && !useTextMode && transcript && (
                    <div className="mb-6 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                            <Mic className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0 animate-pulse" />
                            <div className="flex-1">
                                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-1">Live Transcript</p>
                                <p className="text-white text-sm leading-relaxed">{transcript}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Text Input (text mode) */}
                {isRecording && useTextMode && (
                    <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                            <div className="flex-1">
                                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Type Your Answer</p>
                                <textarea
                                    value={textAnswer}
                                    onChange={(e) => setTextAnswer(e.target.value)}
                                    placeholder="Type your answer here..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm leading-relaxed min-h-[120px] focus:outline-none focus:border-green-500"
                                    autoFocus
                                />
                                <p className="text-xs text-slate-400 mt-2">Words: {textAnswer.trim().split(/\s+/).filter(w => w).length}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col lg:flex-row gap-8">
                    <div className="flex-1 flex flex-col gap-6">
                        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
                            <Webcam audio={false} ref={webcamRef} className="w-full h-full object-cover transform scale-x-[-1]" />
                            {/* Canvas ref kept for compatibility but hidden */}
                            <canvas
                                ref={canvasRef}
                                style={{ display: 'none' }}
                            />

                            {/* Professional Camera Status Indicator */}
                            {isRecording && modelsLoaded && (
                                <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border transition-colors duration-300 ${faceTrackedFrames > 0
                                        ? (currentEmotion === 'looking_away' || currentEmotion === 'eyes_closed'
                                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                            : currentEmotion === 'slight_drift'
                                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                                : 'bg-green-500/10 border-green-500/30 text-green-400')
                                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                                        }`}>
                                        <div className={`w-2 h-2 rounded-full ${faceTrackedFrames > 0
                                            ? (currentEmotion === 'looking_away' || currentEmotion === 'eyes_closed'
                                                ? 'bg-red-400'
                                                : currentEmotion === 'slight_drift'
                                                    ? 'bg-amber-400'
                                                    : 'bg-green-400 animate-pulse')
                                            : 'bg-red-400'
                                            }`} />
                                        <span className="text-xs font-medium tracking-wide">
                                            {faceTrackedFrames > 0
                                                ? (currentEmotion === 'looking_away' ? 'Looking Away'
                                                    : currentEmotion === 'eyes_closed' ? 'Eyes Closed'
                                                        : currentEmotion === 'slight_drift' ? 'Slight Drift'
                                                            : 'Direct Eye Contact')
                                                : 'Aligning Camera...'}
                                        </span>
                                    </div>

                                    {/* Subtle Performance Metric */}
                                    <div className="bg-black/40 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-slate-400 font-mono">
                                        Quality: {totalFrames > 0 ? Math.round((faceTrackedFrames / totalFrames) * 100) : 0}%
                                    </div>
                                </div>
                            )}

                            {isProcessing && (
                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                                    <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                                    <h3 className="text-white font-medium">Analyzing Response...</h3>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-800 hover:border-orange-500/30 relative transition-all">
                            <button
                                onClick={handleRepeatQuestion}
                                className="absolute top-6 right-6 p-2 bg-slate-700/50 rounded-full hover:bg-slate-600 transition-colors"
                                title="Repeat Question"
                            >
                                <Volume2 className="w-5 h-5 text-orange-400" />
                            </button>
                            <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">Topic to Address</p>
                            <h1 className="text-2xl lg:text-3xl font-medium text-white leading-relaxed pr-12">
                                {questions[currentQIndex]?.text || "Loading..."}
                            </h1>
                        </div>
                    </div>

                    <div className="lg:w-64 flex flex-col justify-center gap-4">
                        {/* Compact Timer */}
                        <div className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-900/50 rounded-xl border border-slate-800">
                            <Clock className={`w-3.5 h-3.5 ${isRecording ? 'text-orange-400 animate-pulse' : 'text-slate-500'}`} />
                            <span className={`text-sm font-mono font-semibold ${isRecording ? 'text-white' : 'text-slate-500'}`}>
                                {formatTime(elapsedTime)}
                            </span>
                        </div>

                        <button
                            onClick={isRecording ? handleStop : handleStart}
                            disabled={isProcessing}
                            className={`w-full py-6 rounded-xl flex flex-col items-center justify-center gap-3 transition-all ${isRecording
                                ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20'
                                : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02]'
                                }`}
                        >
                            {isRecording ? (
                                <>
                                    <Square className="w-8 h-8 fill-current" />
                                    <span className="font-bold">Stop Answer</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-8 h-8 fill-current" />
                                    <span className="font-bold">Start Answer</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </Layout>
    );
};

export default Interview;
