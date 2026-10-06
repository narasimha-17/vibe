/**
 * All authenticated calls go through the same-origin `/api/proxy/*` route
 * handler (see app/api/proxy/[...path]/route.ts) so the browser only ever
 * needs to send its httpOnly session cookie — never a token it can read.
 */

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : (detail as any)?.detail || "Request failed");
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  async upload<T>(path: string, file: File, extra?: Record<string, string>): Promise<T> {
    const form = new FormData();
    form.append("file", file);
    const qs = new URLSearchParams(extra).toString();
    const res = await fetch(`/api/proxy/${path}${qs ? `?${qs}` : ""}`, { method: "POST", body: form });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
    return res.json();
  },
  async downloadZip(path: string, body: unknown, filename: string) {
    const res = await fetch(`/api/proxy/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
