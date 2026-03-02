import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/apiClient';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

// ─── Single source of truth for storage keys ───────────────────────────────
const STORAGE_KEY_TOKEN = 'token';
const STORAGE_KEY_USER = 'user';
const STORAGE_KEY_REMEMBER = 'remember_me';

// ─── Helpers ────────────────────────────────────────────────────────────────
const getStoredToken = () => localStorage.getItem(STORAGE_KEY_TOKEN);

const getStoredUser = () => {
    const stored = localStorage.getItem(STORAGE_KEY_USER);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
};

const isTokenExpired = (token) => {
    if (!token) return true;
    // Mock tokens (fallback) never expire within session
    if (token.startsWith('mock-token-')) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 < Date.now();
    } catch {
        return false; // Can't decode → assume valid
    }
};

const clearAuth = () => {
    // Remove all possible legacy keys in one sweep
    [STORAGE_KEY_TOKEN, STORAGE_KEY_USER, STORAGE_KEY_REMEMBER,
        'auth_token', 'authUser', 'sessionUser'].forEach(k => localStorage.removeItem(k));
};

const persistAuth = (token, user, rememberMe = false) => {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    // Never store plain password; strip it from the user object before saving
    const safeUser = { ...user };
    delete safeUser.password;
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(safeUser));
    if (rememberMe) {
        localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
    }
};

// ─── Provider ───────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 1) SESSION RESTORE ON APP LOAD
    useEffect(() => {
        const initAuth = async () => {
            console.log('🔄 AUTH: Initializing session...');
            const token = getStoredToken();
            const user = getStoredUser();

            if (token && user && !isTokenExpired(token)) {
                console.log('✅ AUTH: Session restored for', user.email);
                setCurrentUser(user);
            } else if (token && isTokenExpired(token)) {
                console.warn('⚠️ AUTH: Token expired – clearing session');
                clearAuth();
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    // ─── LOGIN ────────────────────────────────────────────────────────────────
    // Signature matches Login.jsx: login(email, password, rememberMe)
    const login = async (email, password, rememberMe = false) => {
        try {
            setError(null);
            console.log('🔑 AUTH: Attempting login for', email);

            let user = null;
            let token = null;

            // ── 1. Try the backend API first (real JWT token, bcrypt verification) ──
            try {
                const { data } = await authAPI.login(email, password, rememberMe);
                user = data.user;
                token = data.token;
                console.log('✅ AUTH: API login successful');
            } catch (apiErr) {
                // ── 2. Fallback: check localStorage registered users (offline mode) ──
                console.warn('⚠️ AUTH: API unavailable, checking local storage fallback');
                const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');
                const found = storedUsers.find(
                    u => u.email === email && u.password === password
                );
                if (found) {
                    user = { id: found.id || Date.now(), name: found.name, email: found.email, is_admin: false };
                    token = 'mock-token-' + Date.now();
                    console.log('✅ AUTH: Local fallback login successful');
                } else {
                    // Throw the original API error message
                    const msg = apiErr.response?.data?.detail || apiErr.message || 'Invalid email or password';
                    throw new Error(msg);
                }
            }

            if (!user || !token) throw new Error('Login failed: no user or token returned');
            if (!user.name) user.name = 'User';

            persistAuth(token, user, rememberMe);
            setCurrentUser(user);
            return { success: true };

        } catch (err) {
            const msg = err.message || 'Login failed. Please check your credentials.';
            console.error('❌ AUTH: Login failed –', msg);
            setError(msg);
            return { success: false, error: msg };
        }
    };

    // ─── SIGNUP ───────────────────────────────────────────────────────────────
    const signup = async (name, email, password) => {
        try {
            setError(null);

            // Basic validation
            if (!name || name.trim().length < 2) {
                return { success: false, error: 'Name must be at least 2 characters' };
            }
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return { success: false, error: 'Please enter a valid email address' };
            }
            if (!password || password.length < 8) {
                return { success: false, error: 'Password must be at least 8 characters' };
            }

            let user = null;
            let token = null;

            // ── 1. Try API first ──────────────────────────────────────────────
            try {
                const { data } = await authAPI.signup(name.trim(), email, password);
                user = data.user;
                token = data.token;
                console.log('✅ AUTH: API signup successful');
            } catch (apiErr) {
                // ── 2. Fallback: save locally ──────────────────────────────────
                console.warn('⚠️ AUTH: API unavailable, registering locally');
                const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');
                if (storedUsers.some(u => u.email === email)) {
                    const msg = apiErr.response?.data?.detail || 'Email already registered';
                    return { success: false, error: msg };
                }
                const newUser = {
                    id: Date.now(),
                    name: name.trim(),
                    email,
                    password, // stored only for local auth fallback
                    is_admin: false,
                    createdAt: new Date().toISOString()
                };
                storedUsers.push(newUser);
                localStorage.setItem('users', JSON.stringify(storedUsers));
                user = { id: newUser.id, name: newUser.name, email: newUser.email, is_admin: false };
                token = 'mock-token-' + Date.now();
            }

            if (!user || !token) throw new Error('Signup failed: no user returned');

            persistAuth(token, user, false);
            setCurrentUser(user);
            return { success: true };

        } catch (err) {
            const msg = err.response?.data?.detail || err.message || 'Signup failed. Please try again.';
            console.error('❌ AUTH: Signup failed –', msg);
            return { success: false, error: msg };
        }
    };

    // ─── LOGOUT ───────────────────────────────────────────────────────────────
    const logout = () => {
        clearAuth();
        setCurrentUser(null);
    };

    // ─── IS AUTHENTICATED ────────────────────────────────────────────────────
    const isAuthenticated = () => {
        const token = getStoredToken();
        return !!token && !isTokenExpired(token) && !!currentUser;
    };

    const isAdmin = () => currentUser?.is_admin === true;

    const value = {
        user: currentUser,
        token: getStoredToken(),
        login,
        signup,
        logout,
        isAuthenticated,
        isAdmin,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
