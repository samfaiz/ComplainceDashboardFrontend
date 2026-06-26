export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  payload?: unknown;

  constructor(status: number, message: string, errors?: Record<string, string[]>, payload?: unknown) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.payload = payload;
  }

  /** First validation message, if any. */
  get firstError(): string | undefined {
    if (!this.errors) return undefined;
    const first = Object.values(this.errors)[0];
    return first?.[0];
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

let csrfReady = false;

/** Fetch the Sanctum CSRF cookie once (sets the XSRF-TOKEN cookie). */
export async function ensureCsrf(force = false): Promise<void> {
  if (csrfReady && !force) return;
  await fetch(`${API_BASE}/sanctum/csrf-cookie`, { credentials: "include" });
  csrfReady = true;
}

/**
 * Forget the cached CSRF state so the next mutating request re-primes the
 * cookie. Call this after logout, since the session (and its CSRF token)
 * rotates server-side.
 */
export function resetCsrf(): void {
  csrfReady = false;
}

type Options = {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
};

export async function apiFetch<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const method = (opts.method || "GET").toUpperCase();
  const mutating = method !== "GET" && method !== "HEAD";

  // Mutating requests need a CSRF token.
  if (mutating && !readCookie("XSRF-TOKEN")) await ensureCsrf();

  let url = `${API_BASE}${path}`;
  if (opts.params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  // Re-reads the (possibly refreshed) XSRF-TOKEN cookie on each attempt.
  const send = () => {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = readCookie("XSRF-TOKEN");
    if (token) headers["X-XSRF-TOKEN"] = token;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    return fetch(url, {
      method,
      headers,
      credentials: "include",
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  };

  let res = await send();

  // 419 = CSRF token expired/rotated (e.g. the session regenerated at login).
  // Re-prime the cookie and replay once so mutations like logout don't fail
  // silently and leave the user half-signed-out.
  if (res.status === 419 && mutating) {
    await ensureCsrf(true);
    res = await send();
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const d = data as { message?: string; errors?: Record<string, string[]> } | null;
    throw new ApiError(
      res.status,
      d?.message || `Request failed (${res.status})`,
      d?.errors,
      data
    );
  }

  return data as T;
}

export const api = {
  get: <T = unknown>(path: string, params?: Options["params"], signal?: AbortSignal) =>
    apiFetch<T>(path, { method: "GET", params, signal }),
  post: <T = unknown>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  put: <T = unknown>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body }),
  del: <T = unknown>(path: string, body?: unknown) => apiFetch<T>(path, { method: "DELETE", body }),
};
