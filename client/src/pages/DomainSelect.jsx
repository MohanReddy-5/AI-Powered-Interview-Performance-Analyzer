import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { domains } from '../data/questionBank';
import { Code, Layout as LayoutIcon, Database, Users, ArrowRight, Sparkles, Key, CheckCircle, AlertCircle, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getGeminiApiKey, hasApiKey, saveApiKey } from '../config/apiConfig';
import { interviewAPI } from '../services/apiClient';

const iconMap = {
    'Code': Code,
    'Layout': LayoutIcon,
    'Database': Database,
    'Users': Users
};

const DomainSelect = () => {
    const navigate = useNavigate();
    const [apiKey, setApiKey] = useState('');

    // API key input UI state
    const [showApiKeySection, setShowApiKeySection] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [validationStatus, setValidationStatus] = useState('idle'); // idle, validating, valid, invalid
    const [validationMessage, setValidationMessage] = useState('');

    // Auto-load API key from environment or localStorage
    useEffect(() => {
        const key = getGeminiApiKey();
        if (key) {
            setApiKey(key);
            setApiKeyInput(key);
            setValidationStatus('valid');
            setValidationMessage('Previously saved key loaded.');
        }
    }, []);

    const handleValidateKey = async () => {
        const key = apiKeyInput.trim();
        if (!key || key.length < 10) {
            setValidationStatus('invalid');
            setValidationMessage('API key is too short. Please enter a valid Gemini API key.');
            return;
        }

        setValidationStatus('validating');
        setValidationMessage('Validating your API key...');

        try {
            const response = await interviewAPI.validateApiKey(key);
            const data = response.data;

            if (data.valid) {
                setValidationStatus('valid');
                setValidationMessage(data.message || 'API key is valid!');
                saveApiKey(key);
                setApiKey(key);
            } else {
                setValidationStatus('invalid');
                setValidationMessage(data.message || 'Invalid API key.');
            }
        } catch (error) {
            console.error('API key validation error:', error);
            setValidationStatus('invalid');
            setValidationMessage(
                error.response?.status === 401
                    ? 'Please log in first to validate your API key.'
                    : 'Could not validate key. Check your connection and try again.'
            );
        }
    };

    const handleClearKey = () => {
        setApiKeyInput('');
        setApiKey('');
        setValidationStatus('idle');
        setValidationMessage('');
        localStorage.removeItem('gemini_api_key');
    };

    const handleSelect = (domain) => {
        navigate('/interview', { state: { domain, apiKey } });
    };

    return (
        <Layout>
            {/* Animated Background - Match Landing Page */}
            <div className="relative isolate overflow-hidden bg-black min-h-screen">
                <div className="absolute inset-0 -z-10">
                    <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-500/20 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-orange-500/5 to-transparent" />
                </div>

                <div className="relative max-w-7xl mx-auto px-6 py-16">
                    {/* Header - Match Landing Style */}
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <div className="flex items-center justify-center gap-2 mb-6">
                            <Sparkles className="w-5 h-5 text-orange-400" />
                            <span className="inline-flex items-center rounded-full bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-400 ring-1 ring-inset ring-orange-500/20">
                                Choose Your Path
                            </span>
                        </div>
                        <h1 className="text-4xl font-bold text-white mb-4">
                            Select Your{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400">
                                Interview Track
                            </span>
                        </h1>
                        <p className="text-slate-300 text-lg">
                            Choose a domain to get tailored questions and specialized feedback
                        </p>
                    </div>

                    {/* AI Status Indicator */}
                    {apiKey && (
                        <div className="max-w-md mx-auto mb-6 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                <span className="text-sm text-green-400 font-medium">
                                    {validationStatus === 'valid' && apiKeyInput ? 'Your API Key Active' : 'AI Evaluation Enabled'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════ */}
                    {/* USER API KEY SECTION */}
                    {/* ═══════════════════════════════════════════════════ */}
                    <div className="max-w-2xl mx-auto mb-12">
                        <button
                            onClick={() => setShowApiKeySection(!showApiKeySection)}
                            className="w-full flex items-center justify-between px-6 py-4 bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-orange-500/30 transition-all duration-300 group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-slate-800/50 w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Key className="w-5 h-5 text-orange-400" />
                                </div>
                                <div className="text-left">
                                    <p className="text-white font-semibold text-sm">Use Your Own API Key</p>
                                    <p className="text-slate-400 text-xs">Optional — Avoid API quota limits with your own Gemini key</p>
                                </div>
                            </div>
                            {showApiKeySection
                                ? <ChevronUp className="w-5 h-5 text-slate-400" />
                                : <ChevronDown className="w-5 h-5 text-slate-400" />
                            }
                        </button>

                        {/* Expandable API Key Input */}
                        {showApiKeySection && (
                            <div className="mt-3 bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 p-6 animate-in slide-in-from-top-2">
                                <p className="text-slate-300 text-sm mb-4">
                                    Enter your free Gemini API key to use your own quota.
                                    Get one at{' '}
                                    <a
                                        href="https://aistudio.google.com/apikey"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-orange-400 hover:text-orange-300 underline underline-offset-2"
                                    >
                                        aistudio.google.com/apikey
                                    </a>
                                </p>

                                <div className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <input
                                            type="password"
                                            value={apiKeyInput}
                                            onChange={(e) => {
                                                setApiKeyInput(e.target.value);
                                                if (validationStatus !== 'idle') {
                                                    setValidationStatus('idle');
                                                    setValidationMessage('');
                                                }
                                            }}
                                            placeholder="AIzaSy..."
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all placeholder:text-slate-500"
                                        />
                                        {apiKeyInput && (
                                            <button
                                                onClick={handleClearKey}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                                title="Clear key"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleValidateKey}
                                        disabled={validationStatus === 'validating' || !apiKeyInput.trim()}
                                        className="px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 whitespace-nowrap"
                                    >
                                        {validationStatus === 'validating' ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Validating
                                            </>
                                        ) : (
                                            'Validate Key'
                                        )}
                                    </button>
                                </div>

                                {/* Validation Feedback */}
                                {validationMessage && (
                                    <div className={`flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
                                        validationStatus === 'valid'
                                            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                                            : validationStatus === 'invalid'
                                                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                                                : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                                    }`}>
                                        {validationStatus === 'valid' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                                        {validationStatus === 'invalid' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                                        {validationStatus === 'validating' && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                                        <span>{validationMessage}</span>
                                    </div>
                                )}

                                <p className="text-slate-500 text-xs mt-3">
                                    🔒 Your key is stored only in your browser and sent securely to the server for scoring.
                                    The system's built-in key is used as fallback if you don't provide one.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Domain Cards - Match Landing Feature Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        {domains.map((domain) => {
                            const Icon = iconMap[domain.icon] || Users;

                            return (
                                <button
                                    key={domain.id}
                                    onClick={() => handleSelect(domain)}
                                    className="group relative bg-slate-900/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 hover:border-orange-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10 text-left"
                                >
                                    {/* Hover gradient effect */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/5 group-hover:to-transparent rounded-2xl transition-all duration-300" />

                                    <div className="relative">
                                        {/* Icon */}
                                        <div className="bg-slate-800/50 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                            <Icon className="w-7 h-7 text-orange-400" />
                                        </div>

                                        {/* Title */}
                                        <h3 className="text-2xl font-bold text-white mb-3">{domain.title}</h3>

                                        {/* Description */}
                                        <p className="text-slate-400 leading-relaxed mb-6">
                                            {domain.description}
                                        </p>

                                        {/* Start Button */}
                                        <div className="flex items-center gap-2 text-orange-400 text-sm font-semibold opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                            Start Session <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default DomainSelect;
