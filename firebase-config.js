// Firebase Configuration (Load from Environment Variables)
// Safely get env or empty object
const getEnv = () => {
    try {
        return import.meta.env || {};
    } catch (e) {
        return {};
    }
};
const env = getEnv();

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

// Export for use in application
window.firebaseConfig = firebaseConfig;
