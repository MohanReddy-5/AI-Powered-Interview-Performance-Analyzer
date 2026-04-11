/**
 * Voice Capture Manager - Robust Speech Recognition with Error Handling
 * Handles voice activity detection, automatic reconnection, and transcript validation
 *
 * Uses speechCorrections.js for high-accuracy (95%+) technical term recognition.
 */
import { correctTranscript, CORRECTIONS } from './speechCorrections.js';

class VoiceCaptureManager {
    constructor() {
        this.recognition = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        this.isActive = false;
        this.transcript = '';
        this.interimTranscript = '';
        this.onTranscriptUpdate = null;
        this.onError = null;
        this.onStatusChange = null;
        this.restartAttempts = 0;
        this.maxRestartAttempts = 15;
        this.silenceTimeout = null;
        this.hasReceivedSpeech = false;
        this._recognitionRunning = false; // Track actual running state
    }

    /**
     * Initialize speech recognition with robust error handling
     */
    async initialize() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('❌ SpeechRecognition API not available in this browser');
            return false;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        // Language: try browser-preferred locale first; default to en-US.
        // Indian-English users benefit from 'en-IN' for better phonetic decoding.
        this.recognition.lang = navigator.language?.startsWith('en-IN') ? 'en-IN' : 'en-US';
        this.recognition.maxAlternatives = 7; // More candidates = higher chance of catching correct word

        this.recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            this._recognitionRunning = true;
            this.restartAttempts = 0;
            this.notifyStatus('listening');
        };

        this.recognition.onresult = (event) => {
            this.hasReceivedSpeech = true;
            this.clearSilenceTimeout();

            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                // Pick the BEST alternative from all candidates.
                // Strategy: run each alternative through correctTranscript(),
                // then score by (a) number of recognized technical terms and
                // (b) browser confidence. This catches cases where alt #3 has
                // the correct "closure" while alt #0 says "clo sure".
                let bestTranscript = event.results[i][0].transcript;
                let bestScore = -1;
                const numAlts = event.results[i].length;

                for (let a = 0; a < numAlts; a++) {
                    const altText = event.results[i][a].transcript;
                    const cleaned = correctTranscript(altText);

                    // Count recognized technical terms after correction
                    const techTermPattern = /\b(useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer|TypeScript|JavaScript|ReactJS|React|Node\.js|Next\.js|Vue\.js|GraphQL|NoSQL|REST|RESTful|API|APIs|JWT|OAuth|CRUD|SQL|CSS|HTML|Docker|Kubernetes|AWS|GCP|Azure|MongoDB|PostgreSQL|MySQL|Redis|Virtual DOM|closure|closures|hoisting|callback|prototype|async|synchronous|asynchronous|promise|promises|destructuring|memoization|polymorphism|encapsulation|inheritance|abstraction|middleware|webpack|algorithm|recursion|iteration|flexbox|specificity|schema|indexing|sharding|caching|microservices|TDD|BDD|E2E|CI\/CD|CORS|XSS|CSRF|bcrypt|SSL|TLS|DNS|TCP|HTTP|HTTPS|AJAX|JSON|XML|ORM|MVC|SOLID|DFS|BFS|CDN|NGINX|Git|Linux|JVM|JRE|JDK|garbage collection|heap|bytecode|HashMap|ArrayList|synchronized|volatile|thread|Hibernate|Spring|Maven|Gradle|Servlet|ACID|Atomicity|Consistency|Isolation|Durability|transaction|rollback|monitoring|logging|observability|troubleshooting|Prometheus|Grafana|Elasticsearch|non-blocking|event-driven|event loop|blocking|latency|throughput|scalability|availability|reliability|idempotent|bottleneck)\b/gi;
                    const techMatches = (cleaned.match(techTermPattern) || []).length;

                    // Browser confidence (0-1)
                    const confScore = event.results[i][a].confidence || 0;

                    // Combined score: tech terms weighted heavily
                    const combined = techMatches * 3 + confScore;

                    if (combined > bestScore) {
                        bestScore = combined;
                        bestTranscript = altText;
                    }
                }

                if (event.results[i].isFinal) {
                    // Apply full correction pipeline to the best alternative
                    final += correctTranscript(bestTranscript) + ' ';
                } else {
                    // For interim results, apply corrections for live display
                    interim += correctTranscript(bestTranscript);
                }
            }

            if (final) {
                this.transcript += final;
                this.interimTranscript = '';
            } else {
                this.interimTranscript = interim;
            }

            const fullTranscript = this.transcript + this.interimTranscript;
            if (this.onTranscriptUpdate) {
                this.onTranscriptUpdate(fullTranscript.trim(), this.transcript.trim());
            }
            this.startSilenceTimeout();
        };

        this.recognition.onerror = (event) => {
            console.warn('⚠️ Speech recognition error:', event.error);

            if (event.error === 'no-speech') {
                // Browser stops recognition after silence — restart it
                this.notifyStatus('no-speech');
                this._safeRestart(300);
            } else if (event.error === 'aborted') {
                this._recognitionRunning = false;
                // If still supposed to be active, restart
                if (this.isActive) {
                    this._safeRestart(500);
                }
            } else if (event.error === 'network') {
                this._recognitionRunning = false;
                this.notifyStatus('error');
                this._safeRestart(2000);
            } else if (event.error === 'audio-capture') {
                this._recognitionRunning = false;
                this.notifyStatus('error');
                if (this.onError) {
                    this.onError('Microphone not available. Please check permissions.');
                }
            } else if (event.error === 'not-allowed') {
                this._recognitionRunning = false;
                this.notifyStatus('error');
                if (this.onError) {
                    this.onError('Microphone permission denied. Please allow access.');
                }
            } else {
                this._recognitionRunning = false;
                this.notifyStatus('error');
                this._safeRestart(1000);
            }
        };

        this.recognition.onend = () => {
            console.log('🛑 Speech recognition ended (isActive:', this.isActive, ')');
            this._recognitionRunning = false;

            // Browser speech API stops itself frequently — restart if still recording
            if (this.isActive) {
                this._safeRestart(200);
            } else {
                this.notifyStatus('stopped');
            }
        };

        return true;
    }

    /**
     * Safely restart recognition with guards
     */
    _safeRestart(delayMs) {
        if (!this.isActive || !this.recognition) return;
        if (this.restartAttempts >= this.maxRestartAttempts) {
            console.warn('⚠️ Max restart attempts reached');
            this.notifyStatus('error');
            return;
        }

        this.restartAttempts++;
        console.log(`🔄 Restarting speech recognition (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`);

        setTimeout(() => {
            if (!this.isActive || !this.recognition) return;
            if (this._recognitionRunning) return; // Already running

            try {
                this.recognition.start();
            } catch (e) {
                // "already started" — that's fine
                console.warn('Recognition start caught:', e.message);
                this._recognitionRunning = true;
            }
        }, delayMs);
    }

    /**
     * Start capturing voice (Speech API + MediaRecorder)
     */
    async start() {
        // Ensure initialized
        if (!this.recognition) {
            const ok = await this.initialize();
            if (!ok) return false;
        }

        try {
            // 1. Get Audio Stream for Recording
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });

            console.log('✅ Microphone stream acquired, tracks:', this.stream.getAudioTracks().length);

            // 2. Setup MediaRecorder for audio blob capture
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4';

            this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(1000); // Capture in 1-second chunks for reliability
            console.log('🎙 MediaRecorder started with mimeType:', mimeType);

            // 3. Reset state and start Speech Recognition
            this.isActive = true;
            this.transcript = '';
            this.interimTranscript = '';
            this.restartAttempts = 0;
            this.hasReceivedSpeech = false;
            this._recognitionRunning = false;

            // Small delay to let audio stream stabilize before starting recognition
            await new Promise(resolve => setTimeout(resolve, 200));

            try {
                this.recognition.start();
                console.log('🎤 Speech recognition start() called');
            } catch (e) {
                console.error('❌ Speech recognition start failed:', e.message);
                // Try aborting and re-starting
                try {
                    this.recognition.abort();
                    this._recognitionRunning = false;
                    await new Promise(resolve => setTimeout(resolve, 300));
                    this.recognition.start();
                    console.log('🎤 Speech recognition started after abort-retry');
                } catch (e2) {
                    console.error('❌ Speech recognition retry also failed:', e2.message);
                    // Still return true — MediaRecorder is capturing audio
                    // The audio blob can be sent to Gemini for transcription
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to start voice capture:', error);
            if (this.onError) {
                this.onError('Microphone access failed: ' + error.message);
            }
            return false;
        }
    }

    /**
     * Stop capturing voice and return transcript + audio blob
     * 
     * CRITICAL FIX: Previously only returned `this.transcript` (finalized speech)
     * but discarded `this.interimTranscript` (in-progress speech that was visible
     * on screen). Now we include both, and add a brief delay to let the browser's
     * SpeechRecognition API fire any pending onresult events before stopping.
     */
    async stop() {
        this.clearSilenceTimeout();

        // STEP 1: Brief delay to let pending onresult events fire
        // The browser's SpeechRecognition API often has in-flight results
        // that arrive ~100-300ms AFTER we call stop(). Keep isActive=true
        // during this window so the onresult handler still processes them.
        await new Promise(resolve => setTimeout(resolve, 350));

        // STEP 2: NOW mark inactive (prevents auto-restart in onend)
        this.isActive = false;

        // STEP 3: Fold any remaining interim text into the final transcript
        // This is the text the user saw on screen that hadn't been finalized yet
        if (this.interimTranscript && this.interimTranscript.trim()) {
            console.log('📝 Including interim transcript:', this.interimTranscript.trim().substring(0, 80));
            this.transcript += correctTranscript(this.interimTranscript) + ' ';
            this.interimTranscript = '';
        }

        // STEP 3.5: Run FULL correction pipeline on the complete transcript.
        // This catches multi-word patterns and context-aware corrections that
        // couldn't be detected when processing fragments individually.
        const finalText = correctTranscript(this.transcript.trim());
        console.log('📝 Final captured transcript length:', finalText.length, 'chars');

        return new Promise((resolve) => {
            // Stop Speech Recognition
            if (this.recognition) {
                try {
                    this.recognition.stop();
                } catch (e) { /* ignore */ }
                this._recognitionRunning = false;
            }

            // Stop MediaRecorder
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    console.log('📦 Audio blob created, size:', audioBlob.size, 'bytes');

                    // Stop all mic tracks
                    if (this.stream) {
                        this.stream.getTracks().forEach(track => track.stop());
                    }

                    resolve({
                        transcript: finalText,
                        audioBlob: audioBlob
                    });
                };
                this.mediaRecorder.stop();
            } else {
                // No MediaRecorder — still return transcript
                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                }
                resolve({
                    transcript: finalText,
                    audioBlob: null
                });
            }
        });
    }

    startSilenceTimeout() {
        this.clearSilenceTimeout();
        this.silenceTimeout = setTimeout(() => {
            // After 8s silence, just let the browser handle it via onend -> restart
        }, 8000);
    }

    clearSilenceTimeout() {
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
            this.silenceTimeout = null;
        }
    }

    notifyStatus(status) {
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
    }

    /**
     * Clean and correct a transcript fragment using the comprehensive
     * speech corrections engine (speechCorrections.js).
     *
     * This replaces the old inline dictionary with a multi-pass pipeline:
     *   1. 600+ exact phrase corrections  (covers Indian/UK/US accents)
     *   2. Fuzzy matching (Levenshtein)    (catches misspellings within 1-2 edits)
     *   3. Phonetic matching (Soundex)     (catches phonetically similar words)
     *   4. Context-aware corrections       (e.g., "you state" near "React" → "useState")
     */
    cleanTranscript(text) {
        if (!text) return '';
        return correctTranscript(text);
    }

    destroy() {
        this.isActive = false;
        this._recognitionRunning = false;
        this.clearSilenceTimeout();
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.recognition) {
            try { this.recognition.abort(); } catch (e) { /* ignore */ }
        }
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            try { this.mediaRecorder.stop(); } catch (e) { /* ignore */ }
        }
    }
}

export default VoiceCaptureManager;
