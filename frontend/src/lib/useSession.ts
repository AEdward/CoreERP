"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Me } from "./api";

/** Fetches /api/auth/me/ on mount, redirects to /login if unauthenticated.
 * Shared by every page under /dashboard — extracted once three pages
 * needed the identical fetch/redirect/active-membership logic. */
export function useSession() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const data = await api.me();
      setMe(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.push("/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load session.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeMembership = me?.memberships.find((m) => m.company.id === me.active_company_id) ?? null;

  return { me, activeMembership, error, refresh };
}
