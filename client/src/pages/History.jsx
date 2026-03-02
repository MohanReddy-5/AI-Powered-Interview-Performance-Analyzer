import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { History as HistoryIcon, Trash2, Calendar, Target, Sparkles, ArrowLeft } from 'lucide-react';
import { historyAPI } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

const History = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const response = await historyAPI.getUserHistory();
            setSessions(response.data.sessions);
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (sessionId) => {
        if (!confirm('Are you sure you want to delete this interview?')) return;

        try {
            await historyAPI.deleteSession(sessionId);
            setSessions(sessions.filter(s => (s.id || s.session_id) !== sessionId));

            // Also remove from localStorage for offline consistency
            try {
                const localSessions = JSON.parse(localStorage.getItem('interview_sessions') || '[]');
                const filtered = localSessions.filter(s =>
                    s.sessionId !== sessionId && s.id !== sessionId
                );
                localStorage.setItem('interview_sessions', JSON.stringify(filtered));
            } catch { /* ignore localStorage errors */ }

            console.log('✅ Session deleted:', sessionId);
        } catch (error) {
            console.error('❌ Failed to delete session:', error);
            alert('Failed to delete session. Please try again.');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="relative isolate overflow-hidden bg-black min-h-screen">
            {/* Animated Background */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-500/20 rounded-full blur-[120px] animate-pulse" />
            </div>

            <div className="relative mx-auto max-w-7xl px-6 py-12">
                {/* Header */}
                <div className="mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-orange-400 transition-colors mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <HistoryIcon className="w-8 h-8 text-orange-400" />
                                <h1 className="text-4xl font-bold text-white">Interview History</h1>
                            </div>
                            <p className="text-slate-400">
                                Logged in as: <span className="text-orange-400">{user?.email}</span>
                            </p>
                        </div>
                        <Link
                            to="/domain"
                            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-lg shadow-lg shadow-orange-500/50 hover:shadow-orange-500/70 hover:scale-105 transition-all"
                        >
                            New Interview
                        </Link>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
                        <p className="text-slate-400 mt-4">Loading your history...</p>
                    </div>
                )}

                {/* Empty State */}
                {!loading && sessions.length === 0 && (
                    <div className="text-center py-16">
                        <div className="bg-slate-900/50 backdrop-blur-sm p-12 rounded-2xl border border-slate-800 max-w-md mx-auto">
                            <HistoryIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-white mb-2">No Interviews Yet</h3>
                            <p className="text-slate-400 mb-6">Start your first interview to see your history here</p>
                            <Link
                                to="/domain"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-lg shadow-lg shadow-orange-500/50 hover:shadow-orange-500/70 hover:scale-105 transition-all"
                            >
                                Start Interview
                            </Link>
                        </div>
                    </div>
                )}

                {/* Sessions Grid */}
                {!loading && sessions.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                className="group relative bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-800 hover:border-orange-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/5 group-hover:to-transparent rounded-2xl transition-all duration-300" />

                                <div className="relative">
                                    {/* Domain Badge */}
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 rounded-full mb-4">
                                        <Sparkles className="w-3 h-3 text-orange-400" />
                                        <span className="text-sm font-medium text-orange-400">{session.domain}</span>
                                    </div>

                                    {/* Score */}
                                    <div className="mb-4">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <Target className="w-5 h-5 text-slate-400" />
                                            <span className="text-3xl font-bold text-white">{session.overall_score || 0}</span>
                                            <span className="text-slate-400">/100</span>
                                        </div>
                                        {session.eye_contact_score !== null && session.eye_contact_score !== undefined && (
                                            <p className="text-sm text-slate-400">
                                                Eye Contact: {Math.round(session.eye_contact_score)}%
                                            </p>
                                        )}
                                    </div>

                                    {/* Date */}
                                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                                        <Calendar className="w-4 h-4" />
                                        {formatDate(session.created_at)}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => navigate(`/results?session=${session.id}`)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-lg transition-all"
                                        >
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${(session.overall_score || 0) >= 70 ? 'bg-green-500/20 text-green-400' :
                                                (session.overall_score || 0) >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                {session.overall_score || 0}
                                            </span>
                                            View Results
                                        </button>
                                        <button
                                            onClick={() => handleDelete(session.id)}
                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default History;
