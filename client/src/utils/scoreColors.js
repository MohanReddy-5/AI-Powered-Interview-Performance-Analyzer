/**
 * Get color for score based on thresholds
 * @param {number} score - Score from 0-100
 * @returns {object} - Color classes for text and background
 */
export const getScoreColor = (score) => {
    if (score >= 90) {
        return {
            text: 'text-white',
            bg: 'bg-white/20',
            border: 'border-white/30',
            label: 'Excellent'
        };
    } else if (score >= 50) {
        return {
            text: 'text-green-400',
            bg: 'bg-green-500/20',
            border: 'border-green-500/30',
            label: 'Good'
        };
    } else if (score >= 30) {
        return {
            text: 'text-orange-400',
            bg: 'bg-orange-500/20',
            border: 'border-orange-500/30',
            label: 'Fair'
        };
    } else {
        return {
            text: 'text-red-400',
            bg: 'bg-red-500/20',
            border: 'border-red-500/30',
            label: 'Needs Work'
        };
    }
};

/**
 * Get status label for score
 */
export const getScoreStatus = (score) => {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'needs-improvement';
};
