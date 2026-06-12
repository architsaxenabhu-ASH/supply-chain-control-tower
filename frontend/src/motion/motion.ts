import type { Transition, Variants } from "framer-motion";

// Motion tokens (Phase 5A). Productivity-first: fast, smooth, ease-out, no bounce.
// Every animation has a reduced-motion fallback (handled by callers via the hook).
export const DURATION = { fast: 0.18, base: 0.24, slow: 0.4 } as const;
export const EASE_OUT_QUINT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const transition: Transition = { duration: DURATION.base, ease: EASE_OUT_QUINT };
export const fastTransition: Transition = { duration: DURATION.fast, ease: EASE_OUT_QUINT };
const slowTransition: Transition = { duration: DURATION.slow, ease: EASE_OUT_QUINT };

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

// ---- Workspace signatures (Phase 5A) ---------------------------------------
// Each workspace transition carries one meaning-bearing entrance. Fast, ease-out,
// never blocking: content is interactive immediately; exit is even faster.
//   glide   — lateral travel (shipments, dispatches, goods in motion)
//   rise    — container set-down (inventory, receipts, counts, documents)
//   sweep   — timeline reveal left→right (expiry, progress)
//   flow    — ledger flow (receivables / payables)
//   network — node expansion (commercial, distributors, customers)
//   loop    — return-loop overshoot (returns)
//   path    — decision-path draw top→bottom (decisions, traceability, audit)
//   stamp   — approval settle (approvals)
export type Signature =
  | "fade"
  | "rise"
  | "glide"
  | "sweep"
  | "flow"
  | "network"
  | "loop"
  | "path"
  | "stamp";

const reducedStage: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export function signatureVariants(signature: Signature, reduced: boolean): Variants {
  if (reduced) return reducedStage;
  const exitFade = { opacity: 0, transition: fastTransition };
  switch (signature) {
    case "glide":
      return {
        initial: { opacity: 0, x: 26 },
        animate: { opacity: 1, x: 0, transition: slowTransition },
        exit: { opacity: 0, x: -18, transition: fastTransition },
      };
    case "rise":
      return {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0, transition },
        exit: exitFade,
      };
    case "sweep":
      return {
        initial: { opacity: 0, clipPath: "inset(0 100% 0 0)" },
        animate: { opacity: 1, clipPath: "inset(0 0% 0 0)", transition: slowTransition },
        exit: exitFade,
      };
    case "flow":
      return {
        initial: { opacity: 0, x: -24 },
        animate: { opacity: 1, x: 0, transition },
        exit: { opacity: 0, x: 18, transition: fastTransition },
      };
    case "network":
      return {
        initial: { opacity: 0, scale: 0.985 },
        animate: { opacity: 1, scale: 1, transition },
        exit: exitFade,
      };
    case "loop":
      return {
        initial: { opacity: 0, x: 30 },
        animate: { opacity: 1, x: [30, -8, 0], transition: slowTransition },
        exit: { opacity: 0, x: 24, transition: fastTransition },
      };
    case "path":
      return {
        initial: { opacity: 0, clipPath: "inset(0 0 100% 0)" },
        animate: { opacity: 1, clipPath: "inset(0 0 0% 0)", transition: slowTransition },
        exit: exitFade,
      };
    case "stamp":
      return {
        initial: { opacity: 0, scale: 1.04 },
        animate: { opacity: 1, scale: 1, transition },
        exit: exitFade,
      };
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition },
        exit: exitFade,
      };
  }
}
