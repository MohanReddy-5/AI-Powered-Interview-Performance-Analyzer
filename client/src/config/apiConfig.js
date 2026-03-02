/**
 * API Configuration
 * Loads API keys from environment variables
 */

export const getGeminiApiKey = () => {
    // Try to get from environment variable first
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (envKey && envKey.length > 20) {
        return envKey;
    }

    // Fallback to localStorage (for users who entered it manually)
    const storedKey = localStorage.getItem('gemini_api_key');
    return storedKey || null;
};

export const getOpenAIApiKey = () => {
    const envKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (envKey && envKey.length > 20) {
        return envKey;
    }

    const storedKey = localStorage.getItem('openai_api_key');
    return storedKey || null;
};

export const hasApiKey = () => {
    const key = getGeminiApiKey();
    return key && key.length > 20;
};

// Save API key to localStorage (optional, for manual entry)
export const saveApiKey = (key) => {
    if (key && key.length > 20) {
        localStorage.setItem('gemini_api_key', key);
        return true;
    }
    return false;
};
