import React from 'react';

/**
 * Eye Contact Pie Chart Component
 * Visualizes eye contact performance with a clean pie chart
 */
const EyeContactChart = ({ eyeContactScore }) => {
    // Calculate percentages
    const goodPercentage = Math.round(eyeContactScore);
    const poorPercentage = 100 - goodPercentage;

    // SVG circle parameters
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const goodArc = (goodPercentage / 100) * circumference;
    const poorArc = (poorPercentage / 100) * circumference;

    // Colors
    const goodColor = '#10b981'; // green-500
    const poorColor = '#ef4444'; // red-500

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Pie Chart */}
            <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                    {/* Background circle */}
                    <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="20"
                    />

                    {/* Good eye contact arc */}
                    <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="none"
                        stroke={goodColor}
                        strokeWidth="20"
                        strokeDasharray={`${goodArc} ${circumference}`}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />

                    {/* Poor eye contact arc */}
                    <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="none"
                        stroke={poorColor}
                        strokeWidth="20"
                        strokeDasharray={`${poorArc} ${circumference}`}
                        strokeDashoffset={-goodArc}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />

                    {/* Center text */}
                    <text
                        x="70"
                        y="70"
                        textAnchor="middle"
                        dy="0.3em"
                        className="text-2xl font-bold fill-white"
                        transform="rotate(90 70 70)"
                    >
                        {goodPercentage}%
                    </text>
                </svg>
            </div>

            {/* Legend */}
            <div className="flex gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: goodColor }}></div>
                    <span className="text-sm text-slate-300">
                        Focused ({goodPercentage}%)
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: poorColor }}></div>
                    <span className="text-sm text-slate-300">
                        Distracted ({poorPercentage}%)
                    </span>
                </div>
            </div>

            {/* Status message */}
            <div className="text-center">
                {goodPercentage >= 70 ? (
                    <p className="text-sm text-green-400 font-medium">
                        Excellent engagement! Your gaze was steady and focused throughout.
                    </p>
                ) : goodPercentage >= 50 ? (
                    <p className="text-sm text-green-300 font-medium">
                        Good engagement. You maintained solid eye contact most of the time.
                    </p>
                ) : goodPercentage >= 30 ? (
                    <p className="text-sm text-yellow-400 font-medium">
                        Moderate focus. Try to look directly at the camera more consistently.
                    </p>
                ) : goodPercentage > 0 ? (
                    <p className="text-sm text-orange-400 font-medium">
                        Low engagement. Position your camera at eye level and look at the screen.
                    </p>
                ) : (
                    <p className="text-sm text-red-400 font-medium">
                        Unable to analyze gaze. Ensure face is visible and well-lit.
                    </p>
                )}
            </div>
        </div>
    );
};

export default EyeContactChart;
