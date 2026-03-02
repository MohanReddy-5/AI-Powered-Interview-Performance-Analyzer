import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Mail, Lock, AlertCircle, Sparkles, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = isLogin
            ? await login(email, password, rememberMe)
            : await signup(name, email, password);

        if (result.success) {
            navigate('/domain');
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="relative isolate overflow-hidden bg-black min-h-screen flex items-center justify-center">
            {/* Animated Background */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-500/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-orange-500/5 to-transparent" />
            </div>

            <div className="relative w-full max-w-md px-6">
                {/* Logo/Brand */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 mb-4">
                        <Sparkles className="w-8 h-8 text-orange-400" />
                        <span className="text-2xl font-bold text-white">Confido AI</span>
                    </Link>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {isLogin ? 'Welcome Back' : 'Create Account'}
                    </h1>
                    <p className="text-slate-400">
                        {isLogin ? 'Sign in to continue your interview prep' : 'Start your interview preparation journey'}
                    </p>
                </div>

                {/* Login/Signup Card */}
                <div className="relative bg-slate-900/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 shadow-lg shadow-orange-500/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent rounded-2xl" />

                    <div className="relative">
                        {/* Toggle Tabs */}
                        <div className="flex gap-2 mb-6 bg-slate-800/50 p-1 rounded-lg">
                            <button
                                onClick={() => { setIsLogin(true); setError(''); }}
                                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${isLogin
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <LogIn className="w-4 h-4 inline mr-2" />
                                Login
                            </button>
                            <button
                                onClick={() => { setIsLogin(false); setError(''); }}
                                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${!isLogin
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <UserPlus className="w-4 h-4 inline mr-2" />
                                Sign Up
                            </button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Name Field (Signup Only) */}
                            {!isLogin && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Full Name
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required={!isLogin}
                                            minLength={2}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Email Field */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={8}
                                        className="w-full pl-11 pr-12 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-400 transition-colors"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-5 h-5" />
                                        ) : (
                                            <Eye className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                                {!isLogin && (
                                    <p className="mt-1 text-xs text-slate-500">
                                        Minimum 8 characters required
                                    </p>
                                )}
                            </div>

                            {/* Remember Me Checkbox (Login Only) */}
                            {isLogin && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="remember-me"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 bg-slate-800 border-slate-600 rounded text-orange-500 focus:ring-orange-500 focus:ring-2 cursor-pointer"
                                    />
                                    <label htmlFor="remember-me" className="text-sm text-slate-400 cursor-pointer select-none">
                                        Remember me for 30 days
                                    </label>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-lg shadow-lg shadow-orange-500/50 hover:shadow-orange-500/70 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                            </button>
                        </form>

                        {/* Back to Home */}
                        <div className="mt-6 text-center">
                            <Link
                                to="/"
                                className="text-sm text-slate-400 hover:text-orange-400 transition-colors"
                            >
                                ← Back to Home
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
