const BASE_API_URI = process.env.REACT_APP_API_URL || "http://4.240.108.250.nip.io/api";

// Helper function to safely parse server responses without hitting unconfigured callbacks
const handleResponse = async (response) => {
    const contentType = response.headers.get("content-type");
    if (response.ok && contentType && contentType.includes("application/json")) {
        return await response.json();
    } else {
        // If the server fails (500), this will extract the text or JSON error directly
        let errorMsg = "Unknown Error";
        let errorCode = null;
        try {
            const errJson = await response.json();
            errorMsg = errJson.error || JSON.stringify(errJson);
            errorCode = errJson.error; // capture the error code string
        } catch {
            errorMsg = await response.text();
        }

        // ── Global Session Eviction Handler ──────────────────────────────
        // If the middleware sent SESSION_EVICTED, clear creds and broadcast
        // the event so the UI can show the lockout popup wherever it lives.
        if (errorCode === 'SESSION_EVICTED') {
            localStorage.removeItem('userSessionToken');
            window.dispatchEvent(new CustomEvent('session-evicted'));
        }

        return { success: false, error: errorMsg, errorCode };
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// SESSION HEARTBEAT
// Called every 30 s from the root App component. If the backend replies with
// SESSION_EVICTED, handleResponse() fires the 'session-evicted' window event
// and the SweetAlert2 popup appears — regardless of what page the user is on.
// ═════════════════════════════════════════════════════════════════════════════
export const heartbeatAPI = async () => {
    const token = localStorage.getItem('userSessionToken');
    if (!token) return null; // not logged in — skip
    try {
        const response = await fetch(`${BASE_API_URI}/auth/heartbeat`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return handleResponse(response);
    } catch {
        // Network failure — just ignore, don't log out the user
        return null;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// AUTH PIPELINES
// ═════════════════════════════════════════════════════════════════════════════
export const handleRegisterAPI = async (name, email, password) => {
    const response = await fetch(`${BASE_API_URI}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    return handleResponse(response);
};

export const handleLoginAPI = async (email, password) => {
    const response = await fetch(`${BASE_API_URI}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    return handleResponse(response);
};

export const handleForgotPasswordAPI = async (email) => {
    const response = await fetch(`${BASE_API_URI}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    return handleResponse(response);
};

export const handleResetPasswordAPI = async (resetToken, password) => {
    const response = await fetch(`${BASE_API_URI}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, password })
    });
    return handleResponse(response);
};

export const handleGoogleAuthAPI = async (access_token) => {
    const response = await fetch(`${BASE_API_URI}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token })
    });
    return handleResponse(response);
};

// ═════════════════════════════════════════════════════════════════════════════
// SCRAPER & DATA ENGINE
// ═════════════════════════════════════════════════════════════════════════════
export const startLeadScraperAPI = async (keyword, city) => {
    const token = localStorage.getItem('userSessionToken');
    const response = await fetch(`${BASE_API_URI}/leads/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ keyword, city })
    });
    return handleResponse(response);
};

export const cancelLeadScraperAPI = async () => {
    const token = localStorage.getItem('userSessionToken');
    const response = await fetch(`${BASE_API_URI}/leads/cancel-search`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return handleResponse(response);
};

export const loadDashboardLeadsAPI = async () => {
    // 💥 IMPORTANT: Ensure this key matches your exact localStorage string name!
    // If your login system saves it as 'token', change this to 'token'
    const token = localStorage.getItem('userSessionToken') || localStorage.getItem('token');
    
    const response = await fetch(`${BASE_API_URI}/leads/dashboard`, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    return handleResponse(response);
};

export const sendEmailBlastAPI = async (leadIds, subject = "", body = "") => {
    const token = localStorage.getItem('userSessionToken');
    const response = await fetch(`${BASE_API_URI}/leads/blast`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ leadIds, subject, body })
    });
    return handleResponse(response);
};

// ═════════════════════════════════════════════════════════════════════════════
// AI EMAIL GENERATOR
// ═════════════════════════════════════════════════════════════════════════════
export const generateAIEmailAPI = async (keyword, city) => {
    const token = localStorage.getItem('userSessionToken') || localStorage.getItem('token');
    const response = await fetch(`${BASE_API_URI}/leads/generate-email`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ keyword, city })
    });
    return handleResponse(response);
};

// ═════════════════════════════════════════════════════════════════════════════
// CAMPAIGN TRACKING ANALYTICS FETCH ENGINE LINK
// ═════════════════════════════════════════════════════════════════════════════
export const loadCampaignOutboxAPI = async () => {
    // Dynamically pulls the exact storage key matching your active user session
    const token = localStorage.getItem('userSessionToken') || localStorage.getItem('token');
    
    const response = await fetch(`${BASE_API_URI}/leads/campaigns`, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    return handleResponse(response);
};

// ═════════════════════════════════════════════════════════════════════════════
// REPLIES
// ═════════════════════════════════════════════════════════════════════════════
export const loadRepliesAPI = async () => {
    const token = localStorage.getItem('userSessionToken') || localStorage.getItem('token');
    const response = await fetch(`${BASE_API_URI}/leads/replies`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    return handleResponse(response);
};
