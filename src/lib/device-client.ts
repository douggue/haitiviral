/**
 * Browser side of the trial anti-cheat.
 * - localId: a random id kept in both localStorage and IndexedDB; if one is cleared the other puts it back.
 * - fingerprint: a short hash of the phone model and settings (screen, time zone, languages, CPU, a drawing test).
 *   Many identical iPhones share one, so it only adds risk points on the server, it never blocks alone.
 * Both fail quietly (private mode, old browsers): the server then relies on the cookie, IP and phone.
 */
const KEY = "hv_lid";

function idbGet(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open("hv", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("kv");
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        try {
          const req = open.result.transaction("kv", "readonly").objectStore("kv").get(KEY);
          req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

function idbSet(value: string) {
  try {
    const open = indexedDB.open("hv", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onsuccess = () => {
      try {
        open.result.transaction("kv", "readwrite").objectStore("kv").put(value, KEY);
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

export async function getLocalId(): Promise<string | undefined> {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    // ignore
  }
  const id = stored ?? (await idbGet()) ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // ignore
  }
  idbSet(id);
  return /^[A-Za-z0-9_-]{16,64}$/.test(id) ? id : undefined;
}

export async function getFingerprint(): Promise<string | undefined> {
  try {
    const n = navigator as Navigator & { deviceMemory?: number };
    let canvas = "";
    try {
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = 40;
      const g = c.getContext("2d");
      if (g) {
        g.textBaseline = "top";
        g.font = "16px Arial";
        g.fillStyle = "#f60";
        g.fillRect(100, 1, 62, 20);
        g.fillStyle = "#069";
        g.fillText("HaitiViral ✓ 2026", 2, 15);
        canvas = c.toDataURL();
      }
    } catch {
      // ignore
    }
    const parts = [
      screen.width, screen.height, devicePixelRatio, screen.colorDepth, Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.languages?.join(","), navigator.platform, navigator.hardwareConcurrency, n.deviceMemory ?? "", navigator.maxTouchPoints, canvas,
    ].join("|");
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts));
    return Array.from(new Uint8Array(hash).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}
