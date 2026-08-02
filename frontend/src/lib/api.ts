const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  if (method !== "GET" && method !== "HEAD") {
    // Django's CSRF cookie must be fetched once (see ensureCsrf) before
    // any unsafe request — this just forwards whatever's already set.
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) headers.set("X-CSRFToken", csrfToken);
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      message = data.detail ?? JSON.stringify(data);
    } catch {
      // response had no JSON body
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function ensureCsrf(): Promise<void> {
  await request("/api/auth/csrf/");
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  full_name: string;
  is_platform_admin: boolean;
}

export interface Company {
  id: number;
  name: string;
  logo_url: string;
  industry: string;
  country: string;
  currency: string;
  timezone: string;
  tax_number: string;
  address: string;
  phone: string;
  email: string;
  status: string;
  created_at: string;
}

export interface Membership {
  id: number;
  company: Company;
  status: string;
  roles: { id: number; name: string }[];
  permissions: string[];
  created_at: string;
  accepted_at: string | null;
}

export interface Me {
  user: User;
  memberships: Membership[];
  active_company_id: number | null;
}

export const api = {
  ensureCsrf,
  me: () => request<Me>("/api/auth/me/"),
  login: (email: string, password: string) =>
    request<User>("/api/auth/login/", { method: "POST", body: JSON.stringify({ email, password }) }),
  signup: (data: { email: string; password: string; first_name: string; last_name: string }) =>
    request<User>("/api/auth/signup/", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request<void>("/api/auth/logout/", { method: "POST" }),
  listCompanies: () => request<Company[]>("/api/companies/"),
  createCompany: (data: Partial<Company>) =>
    request<Company>("/api/companies/", { method: "POST", body: JSON.stringify(data) }),
  setActiveCompany: (companyId: number) =>
    request<Company>("/api/companies/active/", {
      method: "POST",
      body: JSON.stringify({ company_id: companyId }),
    }),
  updateCompany: (id: number, data: Partial<Company>) =>
    request<Company>(`/api/companies/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
};
