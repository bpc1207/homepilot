export type ApiResult<T> = T & { ok: boolean; message?: string };

const tokenKey = "homepilot.token";

export function getToken() {
  return window.localStorage.getItem(tokenKey) || "";
}

export function setToken(token: string) {
  window.localStorage.setItem(tokenKey, token);
}

export function clearToken() {
  window.localStorage.removeItem(tokenKey);
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...options, headers });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Request failed.");
  }
  return result;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<ApiResult<T>> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { method: "POST", headers, body: formData });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Upload failed.");
  }
  return result;
}

export async function adminJson<T>(path: string, adminToken: string): Promise<ApiResult<T>> {
  const response = await fetch(path, { headers: { "x-admin-token": adminToken } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Admin request failed.");
  }
  return result;
}
