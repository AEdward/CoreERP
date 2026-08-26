"use client";

import { ModuleShell } from "@/components/ModuleShell";
import { ComingSoon } from "@/components/ComingSoon";
import { useSession } from "@/lib/useSession";

export default function GuestRequestsPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <ComingSoon
        title="Guest Requests"
        description="A logged queue of in-stay guest requests — extra towels, room service, late checkout asks — with status tracking (new/in progress/done), is on the way."
      />
    </ModuleShell>
  );
}
