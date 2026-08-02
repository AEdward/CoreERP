"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.ensureCsrf();
      await api.signup(form);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Create your account</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          First name
          <input value={form.first_name} onChange={update("first_name")} style={{ display: "block", width: "100%", padding: 8 }} />
        </label>
        <label>
          Last name
          <input value={form.last_name} onChange={update("last_name")} style={{ display: "block", width: "100%", padding: 8 }} />
        </label>
        <label>
          Email
          <input type="email" required value={form.email} onChange={update("email")} style={{ display: "block", width: "100%", padding: 8 }} />
        </label>
        <label>
          Password
          <input type="password" required minLength={8} value={form.password} onChange={update("password")} style={{ display: "block", width: "100%", padding: 8 }} />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: 10 }}>
          {submitting ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </main>
  );
}
