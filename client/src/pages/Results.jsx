import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { CheckCircle, AlertTriangle, ArrowRight, History, Calendar, Award, BarChart2, PieChart as PieIcon, Activity, Eye, Clock } from 'lucide-react';
import { historyAPI } from '../services/apiClient';
import EyeContactChart from '../components/EyeContactChart';
import { getScoreColor } from '../utils/scoreColors';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
    PieChart, Pie, Cell, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const Results = () => {
    const location = useLocation();
    const [loading, setLoading] = useState(true);

    // Data
    const [currentReport, setCurrentReport] = useState(null);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('current');

    // Chart Data
    const [radarData, setRadarData] = useState([]);
    const [pieData, setPieData] = useState([]);
    const [barData, setBarData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Current Session from Backend API or Local Storage
                // Support both router state AND URL query params (?session=ID from History page)
                const urlParams = new URLSearchParams(location.search);
                const sessionId = location.state?.sessionId || urlParams.get('session');
                let reportData = null;

                console.log("🔍 Results page loading. sessionId:", sessionId, "source:", location.state?.sessionId ? "state" : urlParams.get('session') ? "URL" : "none");

                if (sessionId) {
                    try {
                        const response = await historyAPI.getSessionDetails(sessionId);
                        if (response.data?.data) {
                            reportData = response.data.data;
                            console.log("✅ Loaded report from API, score:", reportData.overall_score);
                        }
                    } catch (error) {
                        console.warn("⚠️ API fetch failed, trying local storage fallback...");
                    }
                }

                // 2. FALLBACK: Check Local Storage if API failed or no ID
                if (!reportData) {
                    const localSessions = JSON.parse(localStorage.getItem("interview_sessions") || "[]");
                    console.log("📂 Local sessions found:", localSessions.length);

                    if (localSessions.length > 0) {
                        // Get latest session (step 4)
                        const latestSession = localSessions[localSessions.length - 1] || {};
                        console.log("LOADED SESSION:", latestSession);

                        // If we were looking for a specific ID, try to find it
                        let specific = null;
                        if (sessionId) {
                            specific = localSessions.find(s => s.sessionId === sessionId);
                        }

                        const targetSession = specific || latestSession;

                        if (targetSession) {
                            // 2) FALLBACK FEEDBACK SOURCE: Use analysisResults if answers missing
                            let safeAnswers = targetSession.answers || [];

                            if (!safeAnswers.length && targetSession.analysisResults) {
                                console.warn("⚠️ 'answers' array missing, deriving from analysisResults...");
                                safeAnswers = Object.values(targetSession.analysisResults).map(a => ({
                                    question: a.question || "Question",
                                    score: a.score || 0,
                                    feedback: a.feedback || "Feedback not available",
                                    status: "completed",
                                    transcript: a.transcript
                                }));
                            }

                            // Recalculate overall score using WEIGHTED FORMULA:
                            // 85% from answer average (all questions) + 15% from eye contact
                            const answerAvg = safeAnswers.length > 0
                                ? safeAnswers.reduce((sum, a) => sum + (a.score || 0), 0) / safeAnswers.length
                                : 0;
                            const rawEye = targetSession.eyeContactScore || 0;
                            // eyeContactScore is stored as 0-100 in localStorage
                            const eyeContactPct = Math.min(100, Math.max(0, rawEye));
                            const weightedScore = Math.round((answerAvg * 0.85) + (eyeContactPct * 0.15));
                            console.log(`📊 Weighted overall: (${Math.round(answerAvg)} * 0.85) + (${eyeContactPct} * 0.15) = ${weightedScore}%`);

                            reportData = {
                                overall_score: Math.min(100, Math.max(0, weightedScore)),
                                answers: safeAnswers,
                                session: {
                                    domain: targetSession.domain || localStorage.getItem('interview_domain') || "Interview",
                                    created_at: new Date(targetSession.createdAt || Date.now()).toISOString(),
                                    eye_contact_score: targetSession.eyeContactScore || 0,
                                    questionTimings: targetSession.questionTimings || [],
                                    totalDurationSeconds: targetSession.totalDurationSeconds || 0
                                }
                            };
                            console.log("✅ Loaded session from Local Storage (Fallback active)");
                        }
                    }
                }

                if (reportData) {
                    // 3) SAFE RENDER CHECK
                    const safeFeedback = reportData.answers || [];
                    if (!safeFeedback.length) {
                        console.warn("⚠️ No feedback items found even after fallback.");
                        // We still render, but UI will handle empty state
                    }

                    // 4) Supplement timer data from localStorage if not in API response
                    if (!reportData.session?.totalDurationSeconds && sessionId) {
                        try {
                            const localSessions = JSON.parse(localStorage.getItem("interview_sessions") || "[]");
                            const localMatch = localSessions.find(s => s.sessionId === sessionId);
                            if (localMatch) {
                                reportData.session = {
                                    ...reportData.session,
                                    questionTimings: localMatch.questionTimings || [],
                                    totalDurationSeconds: localMatch.totalDurationSeconds || 0
                                };
                            }
                        } catch { /* ignore */ }
                    }

                    setCurrentReport(reportData);
                    processChartData(safeFeedback, reportData.overall_score);
                    setActiveTab('current');
                } else {
                    console.warn("❌ No report data found (API or Local)");
                    setActiveTab('history');
                }

                // 3. Fetch History (Optional - might fail if API is down, that's fine)
                try {
                    const historyResponse = await historyAPI.getUserHistory();
                    setHistory(historyResponse.data?.sessions || []);
                } catch (e) {
                    console.warn("Could not load history from API");
                    // Could also load history from local storage 'interview_sessions' here if we wanted full offline
                }

            } catch (error) {
                console.error("Failed to load data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [location.state]);

    /**
     * ============================================================
     * SCORE PROCESSING PIPELINE - BEGINNER GUIDE
     * ============================================================
     * 
     * PURPOSE:
     * This function takes the raw answers from the backend evaluator
     * and converts them into data that the radar chart can display.
     * 
     * DATA FLOW:
     * 1. Backend evaluator analyzes each answer
     * 2. Returns JSON with scores in `feedback.breakdown`
     * 3. Field names may vary (technical vs technical_score vs knowledge)
     * 4. Values may be numbers, strings, fractions ("8/10"), or percentages ("85%")
     * 5. This function extracts and normalizes all values to 0-100 numbers
     * 6. Calculates averages for the radar chart
     * 
     * FIELD NAME MAPPING:
     * - Technical: technical_score, technical, knowledge, knowledge_score
     * - Communication: communication_score, communication, clarity, clarity_score
     * - Depth: depth_score, depth, relevance, accuracy, accuracy_score
     * - Confidence: confidence_score, confidence, delivery, delivery_score
     */
    const processChartData = (answers, overallScore) => {
        if (!answers || answers.length === 0) {
            console.warn("⚠️ No answers provided to processChartData");
            return;
        }

        console.log("\n" + "=".repeat(60));
        console.log("📊 PROCESSING CHART DATA - Starting Analysis");
        console.log("=".repeat(60));
        console.log(`Total answers to process: ${answers.length}`);
        console.log(`Overall score provided: ${overallScore}`);

        /**
         * HELPER FUNCTION: Safe Numeric Parser
         * 
         * Converts any value to a number between 0-100
         * Handles: numbers, strings, fractions ("8/10"), percentages ("85%")
         */
        function parseNumericValue(value, fieldName = "unknown") {
            if (value === null || value === undefined) {
                console.log(`   ⚠️ ${fieldName}: null/undefined → 0`);
                return 0;
            }

            // Already a number
            if (typeof value === 'number') {
                const rounded = Math.round(value);
                console.log(`   ✓ ${fieldName}: ${value} (number) → ${rounded}`);
                return rounded;
            }

            // String parsing
            if (typeof value === 'string') {
                // Handle "8/10" format (convert to percentage)
                if (value.includes('/')) {
                    const [num, denom] = value.split('/').map(Number);
                    if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
                        const result = Math.round((num / denom) * 100);
                        console.log(`   ✓ ${fieldName}: "${value}" (fraction) → ${result}`);
                        return result;
                    }
                }

                // Handle "85%" format
                if (value.includes('%')) {
                    const result = Math.round(parseFloat(value.replace('%', '')));
                    if (!isNaN(result)) {
                        console.log(`   ✓ ${fieldName}: "${value}" (percentage) → ${result}`);
                        return result;
                    }
                }

                // Handle plain number string
                const parsed = parseFloat(value);
                if (!isNaN(parsed)) {
                    const rounded = Math.round(parsed);
                    console.log(`   ✓ ${fieldName}: "${value}" (string) → ${rounded}`);
                    return rounded;
                }
            }

            console.log(`   ❌ ${fieldName}: ${value} (${typeof value}) → 0 (unparseable)`);
            return 0;
        }

        // 1. RADAR DATA (Skills Average)
        console.log("\n📈 Step 1: Processing Radar Chart Data");
        console.log("-".repeat(60));

        let techTotal = 0, commTotal = 0, depthTotal = 0, confTotal = 0;
        let breakdownCount = 0; // Count answers that contributed valid scores

        answers.forEach((a, index) => {
            console.log(`\n🔍 Answer ${index + 1}: "${a.question?.substring(0, 50)}..."`);

            // Try to find breakdown data from MULTIPLE sources:
            // 1. Direct breakdown field on the answer object (from Interview.jsx save)
            // 2. Inside feedback JSON (from server API response)
            // 3. Fallback to overall answer score for all dimensions
            let bd = null;

            // Source 1: Direct breakdown field (most common from localStorage)
            if (a.breakdown && typeof a.breakdown === 'object') {
                bd = a.breakdown;
                console.log("   ✓ Found breakdown on answer object:", bd);
            }

            // Source 2: Inside feedback (from server API response)
            if (!bd) {
                let parsedFeedback = null;
                try {
                    parsedFeedback = typeof a.feedback === 'string' ? JSON.parse(a.feedback) : a.feedback;
                } catch (e) {
                    parsedFeedback = null;
                }
                if (parsedFeedback && parsedFeedback.breakdown) {
                    bd = parsedFeedback.breakdown;
                    console.log("   ✓ Found breakdown inside feedback:", bd);
                }
            }

            if (bd) {
                // FLEXIBLE FIELD MAPPING - Try multiple possible field names
                let technicalScore = parseNumericValue(
                    bd.technical_score || bd.technical || bd.knowledge || bd.knowledge_score,
                    "Technical"
                );
                let communicationScore = parseNumericValue(
                    bd.communication_score || bd.communication || bd.grammar || bd.clarity || bd.clarity_score,
                    "Communication"
                );
                let depthScore = parseNumericValue(
                    bd.depth_score || bd.depth || bd.accent || bd.relevance || bd.accuracy || bd.accuracy_score,
                    "Depth"
                );
                let confidenceScore = parseNumericValue(
                    bd.confidence_score || bd.confidence || bd.delivery || bd.delivery_score,
                    "Confidence"
                );

                // Auto-scale: if values are 0-10 range (server-side LLM evaluator), multiply by 10
                if (technicalScore <= 10 && communicationScore <= 10 && depthScore <= 10 && confidenceScore <= 10) {
                    if (technicalScore > 0 || communicationScore > 0 || depthScore > 0 || confidenceScore > 0) {
                        console.log("   📐 Auto-scaling 0-10 scores to 0-100");
                        technicalScore *= 10;
                        communicationScore *= 10;
                        depthScore *= 10;
                        confidenceScore *= 10;
                    }
                }

                // Only add to totals if at least one score is > 0
                if (technicalScore > 0 || communicationScore > 0 || depthScore > 0 || confidenceScore > 0) {
                    techTotal += technicalScore;
                    commTotal += communicationScore;
                    depthTotal += depthScore;
                    confTotal += confidenceScore;
                    breakdownCount++;
                    console.log(`   ✅ Scores added: T=${technicalScore} C=${communicationScore} D=${depthScore} Cf=${confidenceScore}`);
                } else {
                    console.warn(`   ⚠️ All scores are 0 - using fallback`);
                    const fallbackScore = parseNumericValue(a.score, "Fallback");
                    if (fallbackScore > 0) {
                        techTotal += fallbackScore;
                        commTotal += fallbackScore;
                        depthTotal += fallbackScore;
                        confTotal += fallbackScore;
                        breakdownCount++;
                    }
                }
            } else {
                console.warn(`   ⚠️ No breakdown found, using overall score as fallback`);
                // Fallback: Use overall answer score for all dimensions
                const fallbackScore = parseNumericValue(a.score, "Fallback");
                if (fallbackScore > 0) {
                    techTotal += fallbackScore;
                    commTotal += fallbackScore;
                    depthTotal += fallbackScore;
                    confTotal += fallbackScore;
                    breakdownCount++;
                    console.log(`   ℹ️ Using overall score (${fallbackScore}) for all dimensions`);
                }
            }
        });

        // Calculate averages using ALL answers (not just ones with breakdowns)
        // This ensures zero-scored questions drag down the average properly
        const count = answers.length > 0 ? answers.length : 1;
        const avgTech = Math.round(techTotal / count);
        const avgComm = Math.round(commTotal / count);
        const avgDepth = Math.round(depthTotal / count);
        const avgConf = Math.round(confTotal / count);

        console.log("\n" + "-".repeat(60));
        console.log("📊 RADAR CHART AVERAGES CALCULATED:");
        console.log(`   Technical: ${avgTech}/100 (from ${breakdownCount} answers)`);
        console.log(`   Communication: ${avgComm}/100 (from ${breakdownCount} answers)`);
        console.log(`   Depth: ${avgDepth}/100 (from ${breakdownCount} answers)`);
        console.log(`   Confidence: ${Math.round(overallScore || avgConf)}/100 (from overall score)`);
        console.log(`   Structure: ${avgComm}/100 (proxy from communication)`);

        setRadarData([
            { subject: 'Technical', A: avgTech, fullMark: 100 },
            { subject: 'Communication', A: avgComm, fullMark: 100 },
            { subject: 'Depth', A: avgDepth, fullMark: 100 },
            { subject: 'Confidence', A: avgConf, fullMark: 100 },
            { subject: 'Structure', A: Math.round((avgTech + avgComm + avgDepth + avgConf) / 4), fullMark: 100 },
        ]);

        // 2. PIE DATA (Emotions)
        console.log("\n🥧 Step 2: Processing Emotion Pie Chart");
        console.log("-".repeat(60));

        const emotionCounts = {};
        answers.forEach((a, index) => {
            const e = a.emotions?.dominant || 'neutral';
            emotionCounts[e] = (emotionCounts[e] || 0) + 1;
            console.log(`   Answer ${index + 1}: ${e}`);
        });

        const pData = Object.keys(emotionCounts).map(key => ({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            value: emotionCounts[key]
        }));
        setPieData(pData);
        console.log("   ✓ Emotion distribution:", emotionCounts);

        // 3. BAR DATA (Progression)
        console.log("\n📊 Step 3: Processing Score Progression Bar Chart");
        console.log("-".repeat(60));

        const bData = answers.map((a, i) => {
            const score = parseNumericValue(a.score, `Q${i + 1}`);
            return { name: `Q${i + 1}`, score };
        });
        setBarData(bData);

        console.log("=".repeat(60));
        console.log("✅ CHART DATA PROCESSING COMPLETE");
        console.log("=".repeat(60) + "\n");
    };

    const COLORS = ['#f97316', '#10b981', '#f59e0b', '#ef4444', '#fb923c'];

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading Results...</div>;

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-4 py-12">

                {/* Navigation Tabs */}
                <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-4">
                    {currentReport && (
                        <button
                            onClick={() => setActiveTab('current')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'current' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <Activity className="w-4 h-4" /> Analysis
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <History className="w-4 h-4" /> Past Sessions
                    </button>
                </div>

                {/* --- VIEW: CURRENT ANALYTICS --- */}
                {activeTab === 'current' && currentReport && (
                    <div className="animate-fade-in space-y-8">

                        {/* 1. Top Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-orange-500/30 p-6 rounded-2xl flex flex-col items-center justify-center transition-all">
                                <span className={`text-4xl font-bold mb-2 ${getScoreColor(currentReport.overall_score).text}`}>
                                    {currentReport.overall_score}%
                                </span>
                                <span className="text-sm text-slate-400 uppercase tracking-wider">Overall Score</span>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center">
                                <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-1">✦ AI Evaluated</span>
                                <span className="text-2xl font-bold text-white mb-2">{currentReport.session?.domain || "Unknown"}</span>
                                <span className="text-sm text-slate-400 uppercase tracking-wider">Interview Domain</span>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-green-400 mb-2">{currentReport.answers?.length || 0}</span>
                                <span className="text-sm text-slate-400 uppercase tracking-wider">Questions Answered</span>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-orange-400 mb-2">
                                    {pieData.length > 0 ? pieData.sort((a, b) => b.value - a.value)[0].name : 'Neutral'}
                                </span>
                                <span className="text-sm text-slate-400 uppercase tracking-wider">Dominant Vibe</span>
                            </div>
                        </div>

                        {/* 2. Visual Dashboards (Charts) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* Skills Radar */}
                            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-orange-500/30 p-6 rounded-2xl transition-all">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-orange-400" />
                                    Skill Breakdown
                                </h3>
                                <div className="h-[300px] w-full">
                                    {radarData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                                <PolarGrid stroke="#334155" />
                                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                                <Radar name="Candidate" dataKey="A" stroke="#f97316" fill="#f97316" fillOpacity={0.4} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-slate-500">
                                            Not enough data for skill analysis
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Emotion Pie */}
                            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-orange-500/30 p-6 rounded-2xl transition-all">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <PieIcon className="w-5 h-5 text-orange-400" />
                                    Emotion Analysis
                                </h3>
                                <div className="h-[300px] w-full flex items-center justify-center">
                                    {pieData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="text-slate-500">No emotion data available</div>
                                    )}
                                </div>
                            </div>


                        </div>

                        {/* 3. Eye Contact Analysis (New) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-[-1rem]"> {/* Using negative margin to pull it up closer if grid allows, or just remove mt-[-1rem] and let it flow */}
                            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-orange-500/30 p-6 rounded-2xl transition-all flex flex-col items-center">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 self-start">
                                    <Eye className="w-5 h-5 text-orange-400" />
                                    Visual Engagement Analysis
                                </h3>
                                {/* Eye contact score: API returns decimal (0-1), localStorage returns 0-100 */}
                                <EyeContactChart
                                    eyeContactScore={
                                        currentReport.session?.eye_contact_score != null
                                            ? (() => {
                                                const raw = currentReport.session.eye_contact_score;
                                                // If value is <= 1, it's a decimal from API — multiply by 100
                                                // If value is > 1, it's already a percentage from localStorage
                                                const asPercent = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
                                                return Math.min(100, asPercent);
                                            })()
                                            : 0
                                    }
                                />
                            </div>

                            {/* Interview Pace / Timer Block */}
                            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-orange-500/30 p-6 rounded-2xl transition-all flex flex-col">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-orange-400" />
                                    Interview Timing
                                </h3>
                                {(() => {
                                    const totalSec = currentReport.session?.totalDurationSeconds || 0;
                                    const timings = currentReport.session?.questionTimings || [];
                                    const totalMin = Math.floor(totalSec / 60);
                                    const totalRemSec = totalSec % 60;
                                    const questionCount = timings.length || (currentReport.answers?.length || 5);
                                    // Recommended: 1-2 min per question
                                    const recommendedMin = questionCount * 1;
                                    const recommendedMax = questionCount * 2;

                                    return (
                                        <div className="flex flex-col flex-1">
                                            {/* Total Time */}
                                            <div className="text-center mb-5">
                                                <span className="text-4xl font-bold text-white font-mono">
                                                    {totalMin}:{totalRemSec.toString().padStart(2, '0')}
                                                </span>
                                                <p className="text-sm text-slate-400 mt-1">Total Interview Time</p>
                                            </div>

                                            {/* Per-question times */}
                                            {timings.length > 0 && (
                                                <div className="space-y-2 mb-4">
                                                    {timings.map((qt, i) => (
                                                        <div key={i} className="flex justify-between items-center text-sm">
                                                            <span className="text-slate-400">Question {i + 1}</span>
                                                            <span className="text-white font-mono font-medium">
                                                                {Math.floor(qt.durationSeconds / 60)}:{(qt.durationSeconds % 60).toString().padStart(2, '0')}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Recommended time */}
                                            <div className="mt-auto pt-4 border-t border-slate-700/50">
                                                <p className="text-xs text-slate-500 mb-1">Recommended Pace</p>
                                                <p className="text-sm text-orange-400 font-medium">
                                                    {recommendedMin}-{recommendedMax} min for {questionCount} questions
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    (~1-2 min per question is ideal)
                                                </p>
                                            </div>

                                            {totalSec === 0 && (
                                                <p className="text-xs text-slate-500 italic mt-2">Timing data not available for this session.</p>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* 4. Detailed Per-Question Analysis */}
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-white">Detailed Question Analysis</h3>
                            {(!currentReport.answers || currentReport.answers.length === 0) && (
                                <p className="text-slate-400">No detailed answers recorded for this session.</p>
                            )}
                            {currentReport.answers?.map((ans, idx) => {
                                // Normalize: feedback may be string or object
                                let feedbackText = '';
                                let technicalFeedback = ans.technical_feedback || '';
                                let grammarFeedback = ans.grammar_feedback || '';
                                let improvementPoints = ans.improvement_points || [];
                                let missingConcepts = ans.missing_concepts || [];
                                let breakdown = ans.breakdown || {};

                                if (typeof ans.feedback === 'string') {
                                    try {
                                        const parsed = JSON.parse(ans.feedback);
                                        feedbackText = parsed.feedback || parsed.message || ans.feedback;
                                        technicalFeedback = technicalFeedback || parsed.technical_feedback || '';
                                        grammarFeedback = grammarFeedback || parsed.grammar_feedback || '';
                                        improvementPoints = improvementPoints.length ? improvementPoints : (parsed.improvement_points || []);
                                        missingConcepts = missingConcepts.length ? missingConcepts : (parsed.missing_concepts || []);
                                        breakdown = Object.keys(breakdown).length ? breakdown : (parsed.breakdown || {});
                                    } catch {
                                        feedbackText = ans.feedback;
                                    }
                                } else if (ans.feedback && typeof ans.feedback === 'object') {
                                    feedbackText = ans.feedback.feedback || ans.feedback.message || '';
                                    technicalFeedback = technicalFeedback || ans.feedback.technical_feedback || '';
                                    grammarFeedback = grammarFeedback || ans.feedback.grammar_feedback || '';
                                    improvementPoints = improvementPoints.length ? improvementPoints : (ans.feedback.improvement_points || []);
                                    missingConcepts = missingConcepts.length ? missingConcepts : (ans.feedback.missing_concepts || []);
                                }

                                if (!feedbackText) feedbackText = 'No feedback available.';

                                const score = ans.score || 0;
                                const { text: scoreText, bg: scoreBg, border: scoreBorder } = getScoreColor(score);

                                return (
                                    <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">

                                        {/* Question Header */}
                                        <div className="flex justify-between items-start mb-5">
                                            <h4 className="text-lg font-semibold text-white flex-1 pr-4">
                                                Q{idx + 1}: {ans.question}
                                            </h4>
                                            <span className={`px-4 py-1.5 rounded-full text-sm font-bold shrink-0 ${scoreBg} ${scoreText} border ${scoreBorder}`}>
                                                {score}/100
                                            </span>
                                        </div>

                                        {/* Answers: User vs Ideal */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                                            {/* User's Answer */}
                                            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">🎙️ Your Answer</span>
                                                </div>
                                                <p className="text-slate-200 text-sm leading-relaxed">
                                                    {ans.transcript
                                                        ? `"${ans.transcript}"`
                                                        : <span className="text-slate-500 italic">No answer recorded</span>
                                                    }
                                                </p>
                                            </div>

                                            {/* Ideal Answer */}
                                            <div className="bg-green-900/10 border border-green-500/20 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                                    <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Ideal Answer</span>
                                                </div>
                                                <p className="text-green-200/90 text-sm leading-relaxed italic">
                                                    {ans.ideal_answer
                                                        ? `"${ans.ideal_answer}"`
                                                        : <span className="text-slate-500 not-italic">Not available</span>
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        {/* Structured Feedback */}
                                        <div className="bg-orange-900/10 border border-orange-500/20 rounded-lg p-4 space-y-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Award className="w-4 h-4 text-orange-400" />
                                                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">AI Feedback</span>
                                            </div>

                                            {/* Overall feedback sentence */}
                                            <p className="text-slate-200 text-sm leading-relaxed">{feedbackText}</p>



                                            {/* Missing concepts */}
                                            {missingConcepts.length > 0 && (
                                                <div className="pt-2 border-t border-orange-500/10">
                                                    <span className="text-xs font-bold text-red-400 uppercase block mb-2">❌ Missing Key Concepts</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {missingConcepts.map((concept, i) => (
                                                            <span key={i} className="px-2 py-1 rounded-md bg-red-500/10 text-red-300 text-xs border border-red-500/20">
                                                                {concept}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Improvement points */}
                                            {improvementPoints.length > 0 && (
                                                <div className="pt-2 border-t border-orange-500/10">
                                                    <span className="text-xs font-bold text-yellow-400 uppercase block mb-2">🎯 Action Points</span>
                                                    <ul className="space-y-1.5">
                                                        {improvementPoints.map((point, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-xs text-yellow-200/80">
                                                                <span className="text-yellow-500 mt-0.5 shrink-0">▸</span>
                                                                {point}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                );
                            })}
                        </div>

                    </div>
                )}

                {/* --- VIEW: HISTORY --- */}
                {activeTab === 'history' && (
                    <div className="animate-fade-in">
                        {/* Same History Code as before... */}
                        <h2 className="text-xl font-bold text-white mb-6">Your Progress History</h2>
                        {history.length === 0 ? (
                            <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800">
                                <History className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-white">No sessions yet</h3>
                                <p className="text-slate-400 mb-6">Complete your first interview to see history.</p>
                                <Link to="/domain" className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg transition-all shadow-lg shadow-orange-500/30">
                                    Start New Session
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {history.map((session) => (
                                    <div key={session.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
                                                <Calendar className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-white font-medium">{session.domain} Interview</h4>
                                                <p className="text-slate-400 text-sm">
                                                    {new Date(session.created_at).toLocaleDateString()} at {new Date(session.created_at).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 uppercase">Score</p>
                                                <p className="text-xl font-bold text-white">{session.overall_score || '--'}%</p>
                                            </div>
                                            <Link
                                                to="/results"
                                                state={{ sessionId: session.id }}
                                                onClick={() => { setActiveTab('current'); setCurrentReport(null); }}
                                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                                            >
                                                <ArrowRight className="w-5 h-5" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </Layout>
    );
};

export default Results;
