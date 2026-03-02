import React, { useEffect } from 'react';
import Layout from '../components/Layout';
import { domains } from '../data/questionBank';
import { Code, Layout as LayoutIcon, Database, Users, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getGeminiApiKey, hasApiKey } from '../config/apiConfig';

const iconMap = {
    'Code': Code,
    'Layout': LayoutIcon,
    'Database': Database,
    'Users': Users
};

const DomainSelect = () => {
    const navigate = useNavigate();
    const [apiKey, setApiKey] = React.useState('');

    // Auto-load API key from environment or localStorage
    useEffect(() => {
        const key = getGeminiApiKey();
        if (key) {
            setApiKey(key);
        }
    }, []);

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
                        <div className="max-w-md mx-auto mb-12 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                <span className="text-sm text-green-400 font-medium">AI Evaluation Enabled</span>
                            </div>
                        </div>
                    )}

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
