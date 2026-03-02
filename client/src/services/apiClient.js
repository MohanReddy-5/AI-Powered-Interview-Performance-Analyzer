import axios from 'axios';

// API Base URL - Uses environment variable in production, localhost in development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            localStorage.removeItem('authUser');
            localStorage.removeItem('sessionUser');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// ============================================================
// AUTH API
// ============================================================

export const authAPI = {
    signup: (name, email, password) =>
        apiClient.post('/api/auth/signup', { name, email, password }),

    login: (email, password, rememberMe = false) =>
        apiClient.post('/api/auth/login', { email, password, remember_me: rememberMe }),

    getMe: () =>
        apiClient.get('/api/auth/me')
};

// ============================================================
// INTERVIEW API
// ============================================================

export const interviewAPI = {
    startSession: (domain) =>
        apiClient.post('/api/start-session', { domain }),

    submitAnswer: (sessionId, questionId, question, transcript, emotions, domain, eyeContactScore, idealAnswer, audioBlob, apiKey) => {
        const formData = new FormData();
        formData.append('session_id', sessionId);
        formData.append('question_id', questionId); // Add question_id
        formData.append('question', question);
        formData.append('transcript', transcript || "");
        formData.append('emotions', JSON.stringify(emotions));
        formData.append('domain', domain);
        formData.append('eye_contact_score', eyeContactScore);
        formData.append('ideal_answer', idealAnswer || "");

        // Forward user's API key to server so it uses it for LLM scoring
        if (apiKey && apiKey.length > 20) {
            formData.append('user_api_key', apiKey);
        }

        if (audioBlob) {
            formData.append('audio', audioBlob, 'answer.webm');
        }

        return apiClient.post('/api/submit-answer', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },

    endSession: (sessionId, eyeContactScore) =>
        apiClient.post(`/api/end-interview/${sessionId}`, { eye_contact_score: eyeContactScore }),

    getResults: (sessionId) =>
        apiClient.get(`/api/results/${sessionId}`)
};

// ============================================================
// HISTORY API
// ============================================================

export const historyAPI = {
    getUserHistory: () =>
        apiClient.get('/api/history'),

    getSessionDetails: (sessionId) =>
        apiClient.get(`/api/history/session/${sessionId}`),

    deleteSession: (sessionId) =>
        apiClient.delete(`/api/history/${sessionId}`)
};

// ============================================================
// ADMIN API
// ============================================================

export const adminAPI = {
    getAllUsers: () =>
        apiClient.get('/api/admin/users'),

    getStats: () =>
        apiClient.get('/api/admin/stats')
};

export default apiClient;
