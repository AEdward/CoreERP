"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import styles from "@/styles/auth.module.css";

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
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>C</span>
          CoreERP
        </div>
        <p className={styles.subtitle}>Create your account.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.row2}>
            <label className={styles.field}>
              <span className={styles.label}>First name</span>
              <input value={form.first_name} onChange={update("first_name")} className={styles.input} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Last name</span>
              <input value={form.last_name} onChange={update("last_name")} className={styles.input} />
            </label>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={update("email")}
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={update("password")}
              className={styles.input}
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" disabled={submitting} className={styles.submit}>
            {submitting ? "Creating…" : "Sign up"}
          </button>
        </form>

        <p className={styles.footer}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
