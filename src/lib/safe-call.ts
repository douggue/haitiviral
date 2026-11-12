/**
 * Browser side: call a server action without ever losing the screen. If the connection drops (slow mobile data),
 * the action throws instead of answering; we turn that into { ok: false, error: "network" } so the form stays
 * filled in and shows a clear message. Orders carry a one-time requestId, so trying again never charges twice.
 */
export async function safeCall<T>(fn: () => Promise<T>): Promise<T | { ok: false; error: "network" }> {
  try {
    return await fn();
  } catch (e) {
    console.error("server call failed", e);
    return { ok: false, error: "network" };
  }
}

/** One-time code for an order screen (kept for the life of the screen, so a retry finds the first order). */
export function newRequestId() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}
