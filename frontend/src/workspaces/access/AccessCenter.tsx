import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, ShieldCheck, Stamp, UserPlus, Users } from "lucide-react";

import {
  fetchSecurityOverview,
  saveApprovalRule,
  saveSecurityUser,
  type ApiAuthenticatedUser,
  type ApiSecurityOverview,
  type ApiSecurityUser,
} from "../../lib/api";
import { useCountry } from "../../context/CountryContext";
import { itemVariants, listVariants, prefersReducedMotion, signatureVariants } from "../../motion/motion";

// Access Management Center (Phase 5A). Roles are templates; permissions drive
// access; scopes bound what a user sees; approval rules grant authority by
// process + country + vertical + material. Nothing is hardcoded.

function humanize(value: string): string {
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type UserDraft = {
  email: string;
  full_name: string;
  role_name: string;
  country_scope: string;
  warehouse_scope: string;
  is_active: boolean;
  password: string;
  change_reason: string;
};

type RuleDraft = {
  process_name: string;
  country: string;
  vertical: string;
  material_code: string;
  approver_role: string;
  approver_email: string;
  change_reason: string;
};

const EMPTY_USER: UserDraft = {
  email: "",
  full_name: "",
  role_name: "",
  country_scope: "",
  warehouse_scope: "",
  is_active: true,
  password: "",
  change_reason: "",
};

const EMPTY_RULE: RuleDraft = {
  process_name: "import_approval",
  country: "",
  vertical: "All",
  material_code: "All",
  approver_role: "",
  approver_email: "",
  change_reason: "",
};

const splitList = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export function AccessCenter({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const reduced = prefersReducedMotion();
  const { available } = useCountry();
  const [overview, setOverview] = useState<ApiSecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [userDraft, setUserDraft] = useState<UserDraft | null>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const isAdmin = currentUser.role_name === "Admin" || currentUser.permissions.includes("security");

  const load = useCallback(() => {
    setLoading(true);
    fetchSecurityOverview()
      .then((result) => {
        setOverview(result);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const roles = overview?.role_definitions ?? [];
  const users = overview?.users ?? [];
  const rules = overview?.approval_rules ?? [];

  const countrySuggestions = useMemo(() => {
    const set = new Set<string>(available);
    users.forEach((user) => user.country_scope.forEach((c) => set.add(c)));
    rules.forEach((rule) => rule.country && rule.country !== "All" && set.add(rule.country));
    return [...set].filter(Boolean).sort();
  }, [available, users, rules]);

  const draftRole = useMemo(
    () => roles.find((role) => role.role_name === userDraft?.role_name),
    [roles, userDraft?.role_name],
  );

  const openEditUser = (user: ApiSecurityUser) => {
    setMessage(null);
    setUserDraft({
      email: user.email,
      full_name: user.full_name,
      role_name: user.role_name,
      country_scope: user.country_scope.join(", "),
      warehouse_scope: user.warehouse_scope.join(", "),
      is_active: user.is_active,
      password: "",
      change_reason: "",
    });
  };

  const handleSaveUser = async () => {
    if (!userDraft) return;
    if (!userDraft.email.trim() || !userDraft.full_name.trim() || !userDraft.role_name) {
      setMessage({ tone: "bad", text: "Email, name, and a role template are required." });
      return;
    }
    if (!userDraft.change_reason.trim()) {
      setMessage({ tone: "bad", text: "Add a change reason — every access change is audited." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveSecurityUser({
        email: userDraft.email.trim(),
        full_name: userDraft.full_name.trim(),
        role_name: userDraft.role_name,
        country_scope: splitList(userDraft.country_scope),
        warehouse_scope: splitList(userDraft.warehouse_scope),
        is_active: userDraft.is_active,
        password: userDraft.password.trim() || null,
        changed_by: currentUser.email,
        change_reason: userDraft.change_reason.trim(),
        auth_token: currentUser.session_token,
      });
      setMessage({ tone: "good", text: `${userDraft.full_name} saved.` });
      setUserDraft(null);
      load();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "The user could not be saved." });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRule = async () => {
    if (!ruleDraft) return;
    if (!ruleDraft.process_name.trim() || !ruleDraft.country.trim() || !ruleDraft.approver_email.trim()) {
      setMessage({ tone: "bad", text: "Process, country, and approver email are required for authority rules." });
      return;
    }
    if (!ruleDraft.change_reason.trim()) {
      setMessage({ tone: "bad", text: "Add a change reason — approval authority changes are audited." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveApprovalRule({
        process_name: ruleDraft.process_name.trim(),
        country: ruleDraft.country.trim(),
        vertical: ruleDraft.vertical.trim() || "All",
        material_code: ruleDraft.material_code.trim() || "All",
        approver_role: ruleDraft.approver_role,
        approver_email: ruleDraft.approver_email.trim(),
        is_active: true,
        changed_by: currentUser.email,
        change_reason: ruleDraft.change_reason.trim(),
        auth_token: currentUser.session_token,
      });
      setMessage({ tone: "good", text: "Approval authority saved." });
      setRuleDraft(null);
      load();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "The rule could not be saved." });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
      </div>
    );
  }

  return (
    <motion.div
      className="access-center"
      variants={signatureVariants("fade", reduced)}
      initial="initial"
      animate="animate"
    >
      <section className="cockpit-hero finance-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Access Management Center</p>
            <h2>
              {users.length} people · {roles.length} role templates · {rules.filter((rule) => rule.is_active).length}{" "}
              authority rules
            </h2>
          </div>
          {isAdmin ? (
            <button
              type="button"
              className="review-decide-open"
              onClick={() => {
                setMessage(null);
                setUserDraft({ ...EMPTY_USER, role_name: roles[0]?.role_name ?? "" });
              }}
            >
              <UserPlus size={15} aria-hidden="true" /> Create user
            </button>
          ) : null}
        </div>
        <p className="decision-empty-hint">
          Roles are templates — assigning one gives its permission set. Country and warehouse scope bound what a
          person sees. Approval authority is granted per process, country, and vertical below, never hardcoded.
        </p>
      </section>

      {message ? (
        <p className={`review-message ${message.tone}`} role={message.tone === "bad" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}

      {/* User editor */}
      {userDraft ? (
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <UserPlus size={15} aria-hidden="true" />
              <h2>{users.some((user) => user.email === userDraft.email) ? "Edit user" : "Create user"}</h2>
            </div>
          </div>
          <div className="review-decision-form">
            <div className="review-form-grid">
              <label>
                <span>Email (sign-in)</span>
                <input
                  type="email"
                  value={userDraft.email}
                  onChange={(event) => setUserDraft({ ...userDraft, email: event.target.value })}
                  placeholder="person@company.com"
                />
              </label>
              <label>
                <span>Full name</span>
                <input
                  type="text"
                  value={userDraft.full_name}
                  onChange={(event) => setUserDraft({ ...userDraft, full_name: event.target.value })}
                />
              </label>
              <label>
                <span>Role template</span>
                <select
                  value={userDraft.role_name}
                  onChange={(event) => setUserDraft({ ...userDraft, role_name: event.target.value })}
                >
                  {roles.map((role) => (
                    <option key={role.role_name} value={role.role_name}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {draftRole ? (
              <div className="access-permission-preview">
                <small>This template grants:</small>
                <div className="access-chiprow">
                  {draftRole.permissions.map((permission) => (
                    <span className="tag" key={permission}>
                      {humanize(permission)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="review-form-grid">
              <label>
                <span>Country scope (comma-separated, empty = all)</span>
                <input
                  type="text"
                  value={userDraft.country_scope}
                  onChange={(event) => setUserDraft({ ...userDraft, country_scope: event.target.value })}
                  placeholder={countrySuggestions.slice(0, 3).join(", ") || "e.g. Italy, Vietnam"}
                  list="access-country-suggestions"
                />
              </label>
              <label>
                <span>Warehouse scope (comma-separated, empty = all)</span>
                <input
                  type="text"
                  value={userDraft.warehouse_scope}
                  onChange={(event) => setUserDraft({ ...userDraft, warehouse_scope: event.target.value })}
                />
              </label>
              <label>
                <span>Set / reset password (optional)</span>
                <input
                  type="password"
                  value={userDraft.password}
                  onChange={(event) => setUserDraft({ ...userDraft, password: event.target.value })}
                  autoComplete="new-password"
                />
              </label>
            </div>
            <datalist id="access-country-suggestions">
              {countrySuggestions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <div className="review-form-grid">
              <label className="access-active-toggle">
                <span>Status</span>
                <select
                  value={userDraft.is_active ? "active" : "inactive"}
                  onChange={(event) => setUserDraft({ ...userDraft, is_active: event.target.value === "active" })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive (sign-in blocked)</option>
                </select>
              </label>
              <label>
                <span>Change reason (audited)</span>
                <input
                  type="text"
                  value={userDraft.change_reason}
                  onChange={(event) => setUserDraft({ ...userDraft, change_reason: event.target.value })}
                  placeholder="e.g. New country incharge for Italy"
                />
              </label>
            </div>
            <div className="review-form-actions">
              <button type="button" className="secondary-action" onClick={() => setUserDraft(null)}>
                Cancel
              </button>
              <button type="button" className="review-decide-save" disabled={saving} onClick={handleSaveUser}>
                {saving ? "Saving…" : "Save user"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="access-columns">
        {/* People */}
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Users size={15} aria-hidden="true" />
              <h2>People</h2>
            </div>
            <span className="cc-panel-meta">{users.length}</span>
          </div>
          {users.length === 0 ? (
            <p className="empty-state">No users yet. Create the first one to open up the platform.</p>
          ) : (
            <motion.div
              className="worklist-body"
              variants={reduced ? undefined : listVariants}
              initial={reduced ? undefined : "hidden"}
              animate={reduced ? undefined : "visible"}
            >
              {users.map((user) => (
                <motion.div className="worklist-row access-user" key={user.email} variants={reduced ? undefined : itemVariants}>
                  <div>
                    <strong>{user.full_name}</strong>
                    <small>
                      {user.email} · {user.role_name}
                      {user.country_scope.length > 0 ? ` · ${user.country_scope.join(", ")}` : " · all countries"}
                    </small>
                  </div>
                  <div className="queue-row-side">
                    <span className={`risk-pill ${user.is_active ? "risk-low" : "risk-critical"}`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                    {isAdmin ? (
                      <button type="button" className="signal-act" onClick={() => openEditUser(user)}>
                        Edit
                      </button>
                    ) : null}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>

        {/* Role templates */}
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <KeyRound size={15} aria-hidden="true" />
              <h2>Role templates</h2>
            </div>
            <span className="cc-panel-meta">{roles.length}</span>
          </div>
          <div className="access-roles">
            {roles.map((role) => (
              <div className="access-role" key={role.role_name}>
                <div className="access-role-head">
                  <strong>{role.role_name}</strong>
                  <span className="cc-panel-meta">{role.permissions.length} permissions</span>
                </div>
                {role.description ? <small>{role.description}</small> : null}
                <div className="access-chiprow">
                  {role.permissions.map((permission) => (
                    <span className="tag" key={permission}>
                      {humanize(permission)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Approval authority */}
      <section className="panel cockpit-panel">
        <div className="panel-heading">
          <div className="worklist-title">
            <Stamp size={15} aria-hidden="true" />
            <h2>Approval authority</h2>
          </div>
          <div className="cc-panel-meta">
            {isAdmin ? (
              <button
                type="button"
                className="signal-act"
                onClick={() => {
                  setMessage(null);
                  setRuleDraft({ ...EMPTY_RULE, approver_role: roles[0]?.role_name ?? "" });
                }}
              >
                Grant authority
              </button>
            ) : null}
          </div>
        </div>

        {ruleDraft ? (
          <div className="review-decision-form">
            <div className="review-form-grid">
              <label>
                <span>Process</span>
                <input
                  type="text"
                  value={ruleDraft.process_name}
                  onChange={(event) => setRuleDraft({ ...ruleDraft, process_name: event.target.value })}
                  placeholder="e.g. import_approval"
                />
              </label>
              <label>
                <span>Country</span>
                <input
                  type="text"
                  value={ruleDraft.country}
                  onChange={(event) => setRuleDraft({ ...ruleDraft, country: event.target.value })}
                  list="access-country-suggestions"
                  placeholder="Country or All"
                />
              </label>
              <label>
                <span>Vertical</span>
                <input
                  type="text"
                  value={ruleDraft.vertical}
                  onChange={(event) => setRuleDraft({ ...ruleDraft, vertical: event.target.value })}
                  placeholder="All"
                />
              </label>
              <label>
                <span>Material code</span>
                <input
                  type="text"
                  value={ruleDraft.material_code}
                  onChange={(event) => setRuleDraft({ ...ruleDraft, material_code: event.target.value })}
                  placeholder="All"
                />
              </label>
              <label>
                <span>Approver role</span>
                <select
                  value={ruleDraft.approver_role}
                  onChange={(event) => setRuleDraft({ ...ruleDraft, approver_role: event.target.value })}
                >
                  {roles.map((role) => (
                    <option key={role.role_name} value={role.role_name}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Approver email</span>
                <input
                  type="email"
                  value={ruleDraft.approver_email}
                  onChange={(event) => setRuleDraft({ ...ruleDraft, approver_email: event.target.value })}
                  placeholder="approver@company.com"
                />
              </label>
              <label>
                <span>Change reason (audited)</span>
                <input
                  type="text"
                  value={ruleDraft.change_reason}
                  onChange={(event) => setRuleDraft({ ...ruleDraft, change_reason: event.target.value })}
                />
              </label>
            </div>
            <div className="review-form-actions">
              <button type="button" className="secondary-action" onClick={() => setRuleDraft(null)}>
                Cancel
              </button>
              <button type="button" className="review-decide-save" disabled={saving} onClick={handleSaveRule}>
                {saving ? "Saving…" : "Save authority"}
              </button>
            </div>
          </div>
        ) : null}

        {rules.length === 0 && !ruleDraft ? (
          <p className="empty-state">
            No approval authority granted yet. Unknown country + vertical combinations will ask for an approver and
            learn the rule.
          </p>
        ) : rules.length > 0 ? (
          <div className="worklist-body">
            {rules.map((rule) => (
              <div className="worklist-row access-rule" key={rule.rule_id}>
                <div>
                  <strong>{humanize(rule.process_name)}</strong>
                  <small>
                    {rule.country} · {rule.vertical} · {rule.material_code} → {rule.approver_email} ({rule.approver_role})
                  </small>
                </div>
                <span className={`risk-pill ${rule.is_active ? "risk-low" : "risk-critical"}`}>
                  {rule.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {!isAdmin ? (
        <p className="approval-viewonly access-note">
          <ShieldCheck size={14} aria-hidden="true" /> You can see access but not change it — that needs the security
          permission.
        </p>
      ) : null}
    </motion.div>
  );
}
