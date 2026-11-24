/** Below this width the sidebar and details panel are overlay drawers (SPEC §5.1). */
export const NARROW_SCREEN_PX = 900;

export function isNarrowScreen(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(`(max-width: ${NARROW_SCREEN_PX}px)`).matches
  );
}
