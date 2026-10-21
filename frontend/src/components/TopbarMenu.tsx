import { AnimatePresence, motion } from "framer-motion";
import { Download, LogOut, Moon, Play, RefreshCw, Sun } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { prefersReducedMotion } from "../motion/motion";

// Topbar account menu (Phase 7G). Consolidates the secondary utility actions
// (theme, refresh, tour, export, logout) that previously crowded the topbar into
// one origin-aware animated dropdown, so the demo-critical controls (Primary /
// Secondary, Country / Currency) stay one click away and uncluttered.
//
// Motion follows the house craft rules: opens from its own corner (transform-
// origin top-right), scales from 0.96 (never 0), ease-out-quint, under 200ms in
// / faster out, and degrades to a plain crossfade under prefers-reduced-motion.

type ThemeName = "dark" | "light";

type TopbarMenuProps = {
  userEmail: string;
  roleName: string;
  theme: ThemeName;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onStartTour: () => void;
  onExport: () => void;
  canExport: boolean;
  onLogout: () => void;
};

function initialsOf(email: string): string {
  const handle = (email.split("@")[0] || email).replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const parts = handle.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TopbarMenu({
  userEmail,
  roleName,
  theme,
  onToggleTheme,
  onRefresh,
  onStartTour,
  onExport,
  canExport,
  onLogout,
}: TopbarMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();
  const menuId = useId();

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Dismiss on outside pointer + Escape; only while open.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Move focus into the menu when it opens (accessible keyboard flow).
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not([disabled])");
    first?.focus();
  }, [open]);

  function run(action: () => void) {
    return () => {
      action();
      close();
    };
  }

  const enter = reduced
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, y: 0 };
  const exit = reduced
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.96, y: -6 };
  const initial = reduced
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.96, y: -6 };

  return (
    <div className="topbar-menu" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`topbar-account${open ? " is-open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={`${userEmail} · ${roleName}`}
      >
        <span className="topbar-account-avatar" aria-hidden="true">
          {initialsOf(userEmail)}
        </span>
        <span className="topbar-account-id">
          <span className="topbar-account-name">{userEmail}</span>
          <span className="topbar-account-role">{roleName}</span>
        </span>
        <svg
          className="topbar-account-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={menuId}
            ref={panelRef}
            className="topbar-menu-panel"
            role="menu"
            aria-label="Account and tools"
            initial={initial}
            animate={enter}
            exit={exit}
            transition={
              reduced
                ? { duration: 0.12 }
                : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
            }
          >
            <button type="button" role="menuitem" className="topbar-menu-item" onClick={run(onToggleTheme)}>
              {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              <span>{theme === "dark" ? "Light appearance" : "Dark appearance"}</span>
            </button>
            <button type="button" role="menuitem" className="topbar-menu-item" onClick={run(onStartTour)}>
              <Play size={16} aria-hidden="true" />
              <span>Guided tour</span>
            </button>
            <button type="button" role="menuitem" className="topbar-menu-item" onClick={run(onRefresh)}>
              <RefreshCw size={16} aria-hidden="true" />
              <span>Refresh data</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="topbar-menu-item"
              onClick={run(onExport)}
              disabled={!canExport}
            >
              <Download size={16} aria-hidden="true" />
              <span>Export this view</span>
            </button>
            <div className="topbar-menu-sep" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="topbar-menu-item topbar-menu-item-danger"
              onClick={run(onLogout)}
            >
              <LogOut size={16} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
