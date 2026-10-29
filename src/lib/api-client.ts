import { CONFIG } from "./config";
import { SessionStorageManager } from "./storage";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = CONFIG.apiBaseUrl) {
    this.baseUrl = baseUrl;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { params, skipAuth, headers = {}, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    const requestHeaders: Record<string, string> = {
      Accept: "application/json",
      ...(headers as Record<string, string>),
    };

    if (!(fetchOptions.body instanceof FormData)) {
      requestHeaders["Content-Type"] = "application/json";
    }

    if (!skipAuth) {
      const token = SessionStorageManager.getToken();
      if (token) {
        requestHeaders["Authorization"] = `Bearer ${token}`;
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر الاتصال بالخادم";
      throw new ApiError(`فشل الاتصال بخادم الـ Backend: ${msg}`, 0);
    }

    if (!response.ok) {
      let errorMessage = `حدث خطأ في الخادم (رمز ${response.status})`;
      let details: unknown;

      try {
        const errorJson = await response.json();
        if (errorJson.error) {
          errorMessage = errorJson.error;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
        details = errorJson.details;
      } catch {
        // Fallback to text
        const text = await response.text().catch(() => "");
        if (text) errorMessage = text;
      }

      if (response.status === 401) {
        SessionStorageManager.clearSession();
      }

      throw new ApiError(errorMessage, response.status, details);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET", params });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
