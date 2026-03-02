import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, LogOut, User, History as HistoryIcon, Shield, Play, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
    const { user, isAuthenticated, isAdmin, logout } = useAuth();
    const navigate = useNavigate();
    const [profileOpen, setProfileOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        setProfileOpen(false);
        logout();
        navigate('/login');
    };

    // Smart name display: Use email prefix if name is generic "User"
    const getDisplayName = () => {
        if (!user) return 'User';
        if (user.name && user.name !== 'User') return user.name;
        // Fallback to email username if name is missing or generic
        return user.email?.split('@')[0]?.charAt(0).toUpperCase() + user.email?.split('@')[0]?.slice(1) || 'User';
    };

    const displayName = getDisplayName();

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500/30">
            {/* Navigation */}
            <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-2">
                            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
                                <div className="relative">
                                    <Sparkles className="w-8 h-8 text-orange-400 group-hover:rotate-12 transition-transform" />
                                    <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xl font-bold bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 bg-clip-text text-transparent">
                                        Confido AI
                                    </span>
                                    <span className="text-[10px] text-slate-400 -mt-1">Build Confidence for Interviews</span>
                                </div>
                            </Link>
                        </div>

                        <div className="flex items-center gap-6">
                            {!isAuthenticated() ? (
                                <>
                                    <a href="#features" className="text-slate-400 hover:text-orange-400 transition-colors text-sm font-medium">How it Works</a>
                                    <Link
                                        to="/login"
                                        className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40"
                                    >
                                        Get Started
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link
                                        to="/domain"
                                        className="text-slate-400 hover:text-orange-400 transition-colors text-sm font-medium"
                                    >
                                        Start Interview
                                    </Link>
                                    {isAdmin() && (
                                        <Link
                                            to="/admin"
                                            className="flex items-center gap-1 text-slate-400 hover:text-orange-400 transition-colors text-sm font-medium"
                                        >
                                            <Shield className="w-4 h-4" />
                                            Admin
                                        </Link>
                                    )}

                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            onClick={() => setProfileOpen(!profileOpen)}
                                            className="flex items-center gap-2 pl-3 border-l border-slate-700 hover:opacity-90 transition-opacity"
                                        >
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                                                <span className="text-sm font-bold text-white">
                                                    {(displayName || 'U').charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="text-sm font-medium text-white leading-tight">{displayName}</span>
                                                <span className="text-[11px] text-slate-400 leading-tight">{user?.email}</span>
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {profileOpen && (
                                            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 py-2 animate-fade-in z-50">
                                                {/* User Info Header */}
                                                <div className="px-4 py-3 border-b border-slate-800">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                                                            <span className="text-base font-bold text-white">
                                                                {(displayName || 'U').charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-white">{displayName}</p>
                                                            <p className="text-xs text-slate-400">{user?.email}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Menu Items */}
                                                <div className="py-1">
                                                    <Link
                                                        to="/domain"
                                                        onClick={() => setProfileOpen(false)}
                                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-orange-400 hover:bg-slate-800/50 transition-colors"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                        Start Interview
                                                    </Link>
                                                    <Link
                                                        to="/history"
                                                        onClick={() => setProfileOpen(false)}
                                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-orange-400 hover:bg-slate-800/50 transition-colors"
                                                    >
                                                        <HistoryIcon className="w-4 h-4" />
                                                        Interview History
                                                    </Link>
                                                </div>

                                                {/* Logout */}
                                                <div className="border-t border-slate-800 pt-1">
                                                    <button
                                                        onClick={handleLogout}
                                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors w-full text-left"
                                                    >
                                                        <LogOut className="w-4 h-4" />
                                                        Sign Out
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main>
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 py-8 mt-20 bg-slate-900">
                <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
                    <p>© 2026 Confido AI - Build Confidence for Interviews</p>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
