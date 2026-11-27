import {
  CircleCheck,
  CircleX,
  DatabaseBackup,
  DatabaseZap,
  Gavel,
  GitFork,
  LogIn,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Outcome, StepCategory } from '../schema/system';

// Icon and color per logic step category (SPEC §18.3). Mid-tone colors, readable on the light and
// the dark surface, used for the icon, the card accent and the minimap.

export interface StepCategoryStyle {
  icon: LucideIcon;
  color: string;
}

const NEUTRAL = '#64748b';

export const STEP_CATEGORY_STYLES: Readonly<Record<StepCategory, StepCategoryStyle>> = {
  start: { icon: LogIn, color: NEUTRAL },
  validation: { icon: ShieldCheck, color: '#ea580c' },
  fetch: { icon: DatabaseZap, color: '#2563eb' },
  default: { icon: SlidersHorizontal, color: NEUTRAL },
  rule: { icon: Gavel, color: '#7c3aed' },
  decision: { icon: GitFork, color: '#475569' },
  persist: { icon: DatabaseBackup, color: '#1d4ed8' },
  trigger: { icon: Zap, color: '#0d9488' },
  end: { icon: CircleCheck, color: '#16a34a' },
};

const OUTCOME_STYLES: Readonly<Record<Outcome, StepCategoryStyle>> = {
  success: { icon: CircleCheck, color: '#16a34a' },
  error: { icon: CircleX, color: '#dc2626' },
};

/** Style of a step: `end` steps follow their outcome (success when absent). */
export function stepStyle(category: StepCategory, outcome?: Outcome): StepCategoryStyle {
  if (category === 'end') return OUTCOME_STYLES[outcome ?? 'success'];
  return STEP_CATEGORY_STYLES[category];
}
