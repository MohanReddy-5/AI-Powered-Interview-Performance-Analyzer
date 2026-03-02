/**
 * Voice Capture Manager - Robust Speech Recognition with Error Handling
 * Handles voice activity detection, automatic reconnection, and transcript validation
 */

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
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 3;

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
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += this.cleanTranscript(transcript) + ' ';
                } else {
                    interim += transcript;
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
            this.transcript += this.cleanTranscript(this.interimTranscript) + ' ';
            this.interimTranscript = '';
        }

        const finalText = this.transcript.trim();
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

    cleanTranscript(text) {
        if (!text) return '';

        let cleaned = text;

        // Common speech-to-text corrections for technical terms
        const corrections = {
            'react jay ess': 'ReactJS',
            'react js': 'ReactJS',
            'java script': 'JavaScript',
            'type script': 'TypeScript',
            'no js': 'Node.js',
            'node jay ess': 'Node.js',
            'pie thon': 'Python',
            'my sequel': 'MySQL',
            'mongo db': 'MongoDB',
            'a p i': 'API',
            'a p is': 'APIs',
            'rest api': 'REST API',
            'jason': 'JSON',
            'j son': 'JSON',
            'my sql': 'MySQL',
        };

        Object.keys(corrections).forEach(wrong => {
            const regex = new RegExp(wrong, 'gi');
            cleaned = cleaned.replace(regex, corrections[wrong]);
        });

        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
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
