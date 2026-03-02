import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Play, CheckCircle, Brain, Target, TrendingUp, LogIn, History, LogOut, User, ArrowRight, Camera, MessageSquare } from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const Landing = () => {
    const { isAuthenticated, isAdmin, logout, user } = useAuth();

    return (
        <Layout>
            <div className="relative isolate overflow-hidden bg-black min-h-screen">
                {/* Animated Background */}
                <div className="absolute inset-0 -z-10">
                    <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-500/20 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-orange-500/5 to-transparent" />
                </div>

                {/* Top Navigation */}
                <div className="relative mx-auto max-w-7xl px-6 pt-6">
                    <div className="flex justify-end gap-3">
                        {isAuthenticated() ? (
                            <div className="flex items-center gap-3">
                                {/* User Info */}
                                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700">
                                    <User className="w-4 h-4 text-orange-400" />
                                    <span className="text-sm text-white font-medium">{user?.name || user?.email}</span>
                                </div>

                                {/* History Button */}
                                <Link
                                    to="/history"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700 text-white rounded-lg hover:bg-slate-700/50 transition-all"
                                >
                                    <History className="w-4 h-4" />
                                    <span className="hidden sm:inline">History</span>
                                </Link>

                                {/* Logout Button */}
                                <button
                                    onClick={logout}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span className="hidden sm:inline">Logout</span>
                                </button>
                            </div>
                        ) : (
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all"
                            >
                                <LogIn className="w-4 h-4" />
                                Login
                            </Link>
                        )}
                    </div>
                </div>

                {/* Hero Section */}
                <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:items-center lg:gap-x-10 lg:px-8 lg:py-20">
                    {/* Left Content */}
                    <div className="mx-auto max-w-2xl lg:mx-0 lg:flex-auto">
                        <div className="flex items-center gap-2 mb-8">
                            <Sparkles className="w-5 h-5 text-orange-400" />
                            <span className="inline-flex items-center rounded-full bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-400 ring-1 ring-inset ring-orange-500/20">
                                AI-Powered Interview Platform
                            </span>
                        </div>

                        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl leading-tight">
                            Confido AI{' '}
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 animate-gradient">
                                Build Confidence for Interviews
                            </span>
                        </h1>

                        <p className="mt-6 text-lg leading-8 text-slate-300">
                            Transform your interview preparation with real-time AI analysis.
                            Get instant feedback on technical accuracy, facial expressions, and communication skills.
                            Practice anytime, anywhere, and ace your next interview.
                        </p>

                        <div className="mt-10 flex items-center gap-x-6">
                            <Link
                                to="/domain"
                                className="group relative inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-orange-500/50 hover:shadow-orange-500/70 hover:scale-105 transition-all duration-300">
                                Start Interview
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <a
                                href="#features"
                                className="text-sm font-semibold leading-6 text-slate-300 hover:text-orange-400 transition-colors flex items-center gap-1">
                                Learn more <span aria-hidden="true">→</span>
                            </a>
                        </div>
                    </div>

                    {/* Right Visual - Illustration */}
                    <div className="mt-16 sm:mt-24 lg:mt-0 lg:flex-shrink-0 lg:flex-grow">
                        <div className="relative mx-auto w-[22rem] max-w-full sm:w-[32rem]">
                            {/* Outer glow ring */}
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 opacity-30 blur-2xl animate-pulse" />

                            {/* Middle ring with gradient */}
                            <div className="relative rounded-full bg-gradient-to-br from-orange-500/40 via-orange-600/30 to-amber-500/40 p-1 backdrop-blur-sm">
                                {/* Inner dark circle */}
                                <div className="relative rounded-full bg-gradient-to-br from-slate-950 to-slate-900 p-8 border border-orange-500/20 overflow-hidden">
                                    {/* Center content - ILLUSTRATION */}
                                    <div className="relative aspect-square flex items-center justify-center rounded-full overflow-hidden">
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500/10 to-transparent" />
                                        <img
                                            src="/interview-illustration.png"
                                            alt="AI Interview Platform - Person doing interview on laptop"
                                            className="relative w-full h-full object-cover rounded-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Features Section */}
                <div id="features" className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
                    <div className="mx-auto max-w-2xl text-center mb-16">
                        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                            Everything you need to excel
                        </h2>
                        <p className="mt-4 text-lg text-slate-400">
                            Advanced AI analysis combined with real-time feedback
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <FeatureCard
                            icon={<Camera className="text-orange-400" />}
                            title="Real-time Video Analysis"
                            desc="Track eye contact, facial expressions, and body language with advanced AI models during your interview.">
                        </FeatureCard>
                        <FeatureCard
                            icon={<Brain className="text-orange-400" />}
                            title="Semantic Understanding"
                            desc="Our AI evaluates your answers based on conceptual understanding, not just keyword matching.">
                        </FeatureCard>
                        <FeatureCard
                            icon={<MessageSquare className="text-orange-400" />}
                            title="Intelligent Feedback"
                            desc="Get detailed, actionable insights on technical accuracy, communication skills, and areas for improvement.">
                        </FeatureCard>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

const FeatureCard = ({ icon, title, desc }) => (
    <div className="group relative bg-slate-900/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 hover:border-orange-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/5 group-hover:to-transparent rounded-2xl transition-all duration-300" />
        <div className="relative">
            <div className="bg-slate-800/50 w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                {icon}
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
            <p className="text-slate-400 leading-relaxed">{desc}</p>
        </div>
    </div>
);

export default Landing;
