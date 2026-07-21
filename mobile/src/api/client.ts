import { File, UploadType } from "expo-file-system";
import * as SecureStore from "expo-secure-store";

export const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  // Fail loudly in dev rather than silently hitting "undefined/...".
  console.warn("EXPO_PUBLIC_API_URL is not set - check mobile/.env");
}

export const TOKEN_STORAGE_KEY = "finance_app_access_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth) {
    const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : undefined;

  if (!response.ok) {
    const message = (data && (data.detail || data.message)) || `Request failed (${response.status})`;
    throw new ApiError(response.status, typeof message === "string" ? message : JSON.stringify(message));
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: "GET", auth }),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: "POST", body, auth }),
};

/**
 * Uploads a local file URI (e.g. from expo-image-picker) as a multipart/form-data
 * request, using expo-file-system's native upload task rather than fetch+FormData.
 *
 * Why: as of Expo SDK 57, `expo/fetch` replaces the global `fetch` with a
 * WinterCG-compliant implementation that does NOT understand React Native's
 * classic `{uri, name, type}` FormData part shape - passing one throws
 * "Unsupported FormDataPart implementation". expo-file-system's `File.upload()`
 * hands the transfer to native code directly, sidestepping the JS FormData/fetch
 * layer entirely, which is the currently-documented way to upload local files.
 */
const UPLOAD_TIMEOUT_MS = 30000;

export async function uploadFile<T>(path: string, fileUri: string, mimeType: string): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let result: { status: number; headers: Record<string, string>; body: string };
  try {
    const file = new File(fileUri);
    result = await file.upload(`${API_URL}${path}`, {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: "file",
      mimeType,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    // Thrown for network failures, DNS issues, the abort() above, or the file
    // being unreadable - none of which produce a response to parse. Surface a
    // distinguishable message instead of an opaque native error.
    console.error("uploadFile error:", err);
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(0, "Upload timed out - check your connection and try again");
    }
    throw new ApiError(0, "Could not reach the server - check your connection and try again");
  } finally {
    clearTimeout(timeout);
  }

  // Native upload task headers aren't guaranteed to come back lowercase, so
  // look the key up case-insensitively rather than assuming "content-type".
  const contentTypeHeader = Object.entries(result.headers).find(([key]) => key.toLowerCase() === "content-type")?.[1];
  const isJson = contentTypeHeader?.includes("application/json") ?? false;
  const data = isJson && result.body ? JSON.parse(result.body) : undefined;

  if (result.status < 200 || result.status >= 300) {
    const message = (data && (data.detail || data.message)) || `Upload failed (${result.status})`;
    throw new ApiError(result.status, typeof message === "string" ? message : JSON.stringify(message));
  }

  return data as T;
}
