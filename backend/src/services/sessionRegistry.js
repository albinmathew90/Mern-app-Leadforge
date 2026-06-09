// ─── Session SSE Registry ────────────────────────────────────────────────────
// In-memory map of  userId (string) → Set of active SSE response objects.
// Using a Set per userId supports multiple browser tabs open simultaneously:
// all tabs belonging to the same user get evicted the moment a new login hits.
//
// This module is a singleton — both authRoutes (which writes to it on login)
// and the /events SSE endpoint (which reads/writes it) share the same Map.
// ─────────────────────────────────────────────────────────────────────────────

const registry = new Map(); // userId → Set<res>

/**
 * Register an SSE response object for a given userId.
 * Returns a cleanup function that removes it from the registry.
 */
export function registerSSE(userId, res) {
    const id = String(userId);
    if (!registry.has(id)) registry.set(id, new Set());
    registry.get(id).add(res);

    // Return a cleanup so the caller can deregister on connection close
    return () => {
        const set = registry.get(id);
        if (set) {
            set.delete(res);
            if (set.size === 0) registry.delete(id);
        }
    };
}

/**
 * Push a SESSION_EVICTED event to every open SSE connection for this userId,
 * then close those connections. Called from the login route immediately after
 * the new sessionId is persisted to the DB.
 */
export function evictUser(userId) {
    const id = String(userId);
    const set = registry.get(id);
    if (!set || set.size === 0) return;

    // Clone so we can safely iterate while the set is mutated by cleanup calls
    for (const res of [...set]) {
        try {
            // Send the eviction event — the frontend EventSource listener fires instantly
            res.write('event: SESSION_EVICTED\ndata: {"reason":"new_login"}\n\n');
            // res.flush() is critical on Azure iisnode: without it the OS socket
            // buffer may hold the chunk until the connection closes, defeating the
            // purpose of real-time eviction notification.
            if (typeof res.flush === 'function') res.flush();
            res.end(); // close the SSE stream for this old session
        } catch {
            // Connection already dead — just ignore
        }
    }
    registry.delete(id);
}
