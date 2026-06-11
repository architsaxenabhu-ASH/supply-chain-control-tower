import type { Transition, Variants } from "framer-motion";

// Motion tokens (Phase 5A). Productivity-first: fast, smooth, ease-out, no bounce.
// Every animation has a reduced-motion fallback (handled by callers via the hook).
export const DURATION = { fast: 0.18, base: 0.24, slow: 0.4 } as const;
export const EASE_OUT_QUINT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const transition: Transition = { duration: DURATION.base, ease: EASE_OUT_QUINT };
export const fastTransition: Transition = { duration: DURATION.fast, ease: EASE_OUT_QUINT };

// Workspace content reveal: visible-by-default fade + small rise (never gates content).
export const workspaceVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition },
};

// List stagger for queues / metric rows.
export const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: fastTransition },
};

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
