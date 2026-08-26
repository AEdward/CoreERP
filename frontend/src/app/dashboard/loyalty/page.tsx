"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModuleShell } from "@/components/ModuleShell";
import { IconPlus } from "@/components/icons";
import {
  api,
  ApiError,
  type Customer,
  type LoyaltyMember,
  type LoyaltyReward,
  type LoyaltyTier,
  type LoyaltyTransaction,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_TIER_FORM = { name: "", min_points: "", benefits: "", discount_percent: "0" };
const EMPTY_REWARD_FORM = { name: "", points_cost: "", description: "" };
const EMPTY_AWARD_FORM: Record<number, { points: string; reason: string }> = {};
const EMPTY_REDEEM_FORM: Record<number, string> = {};

export default function LoyaltyPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [tiers, setTiers] = useState<LoyaltyTier[] | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[] | null>(null);
  const [members, setMembers] = useState<LoyaltyMember[] | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showTierModal, setShowTierModal] = useState(false);
  const [tierForm, setTierForm] = useState(EMPTY_TIER_FORM);
  const [tierWorking, setTierWorking] = useState(false);

  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardForm, setRewardForm] = useState(EMPTY_REWARD_FORM);
  const [rewardWorking, setRewardWorking] = useState(false);

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollGuest, setEnrollGuest] = useState("");
  const [enrollWorking, setEnrollWorking] = useState(false);

  const [awardForms, setAwardForms] = useState(EMPTY_AWARD_FORM);
  const [redeemForms, setRedeemForms] = useState(EMPTY_REDEEM_FORM);
  const [rowWorking, setRowWorking] = useState<number | null>(null);

  async function loadAll() {
    try {
      const [t, rw, m, tx, c] = await Promise.all([
        api.listLoyaltyTiers(),
        api.listLoyaltyRewards(),
        api.listLoyaltyMembers(),
        api.listLoyaltyTransactions(),
        api.listCustomers(),
      ]);
      setTiers(t);
      setRewards(rw);
      setMembers(m);
      setTransactions(tx);
      setCustomers(c);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load loyalty data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddTier(e: React.FormEvent) {
    e.preventDefault();
    setTierWorking(true);
    try {
      await api.createLoyaltyTier({
        name: tierForm.name,
        min_points: Number(tierForm.min_points || 0),
        benefits: tierForm.benefits,
        discount_percent: Number(tierForm.discount_percent || 0),
      });
      setShowTierModal(false);
      setTierForm(EMPTY_TIER_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to add tier.");
    } finally {
      setTierWorking(false);
    }
  }

  function startAddTier() {
    setTierForm(EMPTY_TIER_FORM);
    setShowTierModal(true);
  }

  function closeTierModal() {
    setShowTierModal(false);
  }

  async function handleAddReward(e: React.FormEvent) {
    e.preventDefault();
    setRewardWorking(true);
    try {
      await api.createLoyaltyReward({
        name: rewardForm.name,
        points_cost: Number(rewardForm.points_cost || 0),
        description: rewardForm.description,
      });
      setShowRewardModal(false);
      setRewardForm(EMPTY_REWARD_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to add reward.");
    } finally {
      setRewardWorking(false);
    }
  }

  function startAddReward() {
    setRewardForm(EMPTY_REWARD_FORM);
    setShowRewardModal(true);
  }

  function closeRewardModal() {
    setShowRewardModal(false);
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollGuest) return;
    setEnrollWorking(true);
    setActionError(null);
    try {
      await api.enrollLoyaltyMember({ guest: Number(enrollGuest) });
      setShowEnrollModal(false);
      setEnrollGuest("");
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to enroll guest.");
    } finally {
      setEnrollWorking(false);
    }
  }

  function startEnroll() {
    setEnrollGuest("");
    setActionError(null);
    setShowEnrollModal(true);
  }

  function closeEnrollModal() {
    setShowEnrollModal(false);
    setActionError(null);
  }

  async function handleAward(e: React.FormEvent, memberId: number) {
    e.preventDefault();
    const form = awardForms[memberId];
    if (!form?.points) return;
    setRowWorking(memberId);
    setActionError(null);
    try {
      await api.awardLoyaltyPoints({
        member: memberId,
        points: Number(form.points),
        reason: form.reason || "Manual award",
      });
      setAwardForms({ ...awardForms, [memberId]: { points: "", reason: "" } });
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to award points.");
    } finally {
      setRowWorking(null);
    }
  }

  async function handleRedeem(memberId: number) {
    const rewardId = redeemForms[memberId];
    if (!rewardId) return;
    const reward = rewards?.find((r) => r.id === Number(rewardId));
    if (!reward) return;
    setRowWorking(memberId);
    setActionError(null);
    try {
      await api.redeemLoyaltyReward({
        member: memberId,
        reward: reward.id,
        points: -reward.points_cost,
        reason: `Redeem ${reward.name}`,
      });
      setRedeemForms({ ...redeemForms, [memberId]: "" });
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to redeem reward.");
    } finally {
      setRowWorking(null);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("loyalty.manage") ?? false;
  const enrolledGuestIds = new Set(members?.map((m) => m.guest) ?? []);
  const unenrolledCustomers = customers?.filter((c) => !enrolledGuestIds.has(c.id)) ?? [];

  return (
    <ModuleShell moduleKey="loyalty" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1150, margin: "40px auto", padding: "0 16px 40px" }}>
        <div>
          <h1 className="page-title">Loyalty</h1>
          <p className="page-subtitle">{activeMembership?.company.name}</p>
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}
        {actionError && <p className="error-text" style={{ marginTop: 8 }}>{actionError}</p>}

        {/* Tiers */}
        <section style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <h2 className="section-label">Membership levels</h2>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startAddTier}>
                <IconPlus size={14} />
                Add tier
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {tiers?.map((t) => (
              <div key={t.id} className="panel" style={{ padding: "10px 14px", fontSize: 13 }}>
                <strong>{t.name}</strong> — {t.min_points}+ pts, {t.discount_percent}% off
                {t.benefits && <div style={{ color: "#8a8577", fontSize: 12, marginTop: 2 }}>{t.benefits}</div>}
              </div>
            ))}
            {tiers?.length === 0 && <p style={{ color: "#8a8577", fontSize: 13 }}>No tiers yet.</p>}
          </div>
        </section>

        {canManage && showTierModal && (
          <Modal title="Add tier" onClose={closeTierModal}>
            <form onSubmit={handleAddTier} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="field-input"
                placeholder="Tier name"
                required
                value={tierForm.name}
                onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                style={{ flex: 1, minWidth: 160 }}
              />
              <input
                className="field-input"
                type="number"
                min={0}
                placeholder="Min points"
                value={tierForm.min_points}
                onChange={(e) => setTierForm({ ...tierForm, min_points: e.target.value })}
                style={{ width: 110 }}
              />
              <input
                className="field-input"
                type="number"
                min={0}
                max={100}
                placeholder="Discount %"
                value={tierForm.discount_percent}
                onChange={(e) => setTierForm({ ...tierForm, discount_percent: e.target.value })}
                style={{ width: 110 }}
              />
              <input
                className="field-input"
                placeholder="Benefits"
                value={tierForm.benefits}
                onChange={(e) => setTierForm({ ...tierForm, benefits: e.target.value })}
                style={{ flex: 1, minWidth: 160 }}
              />
              <div style={{ width: "100%", display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={tierWorking || !tierForm.name}>
                  Add tier
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeTierModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Rewards */}
        <section style={{ marginTop: 32 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <h2 className="section-label">Rewards</h2>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startAddReward}>
                <IconPlus size={14} />
                Add reward
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {rewards?.map((r) => (
              <div key={r.id} className="panel" style={{ padding: "10px 14px", fontSize: 13 }}>
                <strong>{r.name}</strong> — {r.points_cost} pts
                {r.description && <div style={{ color: "#8a8577", fontSize: 12, marginTop: 2 }}>{r.description}</div>}
              </div>
            ))}
            {rewards?.length === 0 && <p style={{ color: "#8a8577", fontSize: 13 }}>No rewards yet.</p>}
          </div>
        </section>

        {canManage && showRewardModal && (
          <Modal title="Add reward" onClose={closeRewardModal}>
            <form onSubmit={handleAddReward} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="field-input"
                placeholder="Reward name"
                required
                value={rewardForm.name}
                onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                style={{ flex: 1, minWidth: 160 }}
              />
              <input
                className="field-input"
                type="number"
                min={1}
                placeholder="Points cost"
                value={rewardForm.points_cost}
                onChange={(e) => setRewardForm({ ...rewardForm, points_cost: e.target.value })}
                style={{ width: 120 }}
              />
              <input
                className="field-input"
                placeholder="Description"
                value={rewardForm.description}
                onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                style={{ flex: 1, minWidth: 160 }}
              />
              <div style={{ width: "100%", display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={rewardWorking || !rewardForm.name || !rewardForm.points_cost}>
                  Add reward
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeRewardModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Members */}
        <section style={{ marginTop: 32 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <h2 className="section-label">Members</h2>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startEnroll} disabled={unenrolledCustomers.length === 0}>
                <IconPlus size={14} />
                Enroll member
              </button>
            )}
          </div>
          <div className="panel" style={{ marginTop: 10 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Points</th>
                    <th>Tier</th>
                    {canManage && <th>Award points</th>}
                    {canManage && <th>Redeem</th>}
                  </tr>
                </thead>
                <tbody>
                  {members?.map((m) => (
                    <tr key={m.id}>
                      <td>{m.guest_name}</td>
                      <td>{m.points_balance}</td>
                      <td>{m.tier_name || "—"}</td>
                      {canManage && (
                        <td>
                          <form onSubmit={(e) => handleAward(e, m.id)} style={{ display: "flex", gap: 4 }}>
                            <input
                              className="field-input"
                              type="number"
                              placeholder="Pts"
                              value={awardForms[m.id]?.points ?? ""}
                              onChange={(e) => setAwardForms({ ...awardForms, [m.id]: { ...awardForms[m.id], points: e.target.value, reason: awardForms[m.id]?.reason ?? "" } })}
                              style={{ width: 60, padding: "5px 8px" }}
                            />
                            <input
                              className="field-input"
                              placeholder="Reason"
                              value={awardForms[m.id]?.reason ?? ""}
                              onChange={(e) => setAwardForms({ ...awardForms, [m.id]: { ...awardForms[m.id], reason: e.target.value, points: awardForms[m.id]?.points ?? "" } })}
                              style={{ width: 100, padding: "5px 8px" }}
                            />
                            <button type="submit" className="btn btn-secondary btn-sm" disabled={rowWorking === m.id}>
                              Award
                            </button>
                          </form>
                        </td>
                      )}
                      {canManage && (
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <select
                              className="field-select"
                              value={redeemForms[m.id] ?? ""}
                              onChange={(e) => setRedeemForms({ ...redeemForms, [m.id]: e.target.value })}
                              style={{ padding: "5px 8px" }}
                            >
                              <option value="">Reward…</option>
                              {rewards?.filter((r) => r.is_active).map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name} ({r.points_cost})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleRedeem(m.id)}
                              disabled={rowWorking === m.id || !redeemForms[m.id]}
                            >
                              Redeem
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {members?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={5}>No members enrolled yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {canManage && showEnrollModal && (
          <Modal title="Enroll member" onClose={closeEnrollModal}>
            <form onSubmit={handleEnroll} style={{ display: "flex", gap: 8 }}>
              <select className="field-select" value={enrollGuest} onChange={(e) => setEnrollGuest(e.target.value)} style={{ flex: 1 }}>
                <option value="">Enroll a guest…</option>
                {unenrolledCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary" disabled={enrollWorking || !enrollGuest}>
                Enroll
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeEnrollModal}>
                Cancel
              </button>
            </form>
            {actionError && <p className="error-text" style={{ marginTop: 8 }}>{actionError}</p>}
          </Modal>
        )}

        {/* Recent transactions */}
        <section style={{ marginTop: 32, marginBottom: 40 }}>
          <h2 className="section-label">Recent activity</h2>
          <div className="panel" style={{ marginTop: 10 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Points</th>
                    <th>Reason</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions?.slice(0, 20).map((t) => (
                    <tr key={t.id}>
                      <td>{t.member_guest_name}</td>
                      <td>
                        <span className={`badge ${t.points >= 0 ? "badge-green" : "badge-red"}`}>
                          {t.points > 0 ? `+${t.points}` : t.points}
                        </span>
                      </td>
                      <td>{t.reason}</td>
                      <td>{new Date(t.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {transactions?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={4}>No activity yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </ModuleShell>
  );
}
