import { useAdjacentApp } from '@purescience/platform-ui/bridge/react/useAdjacentApp'

/**
 * True only while PureChart is held inside a page (a room, the Personal agent's). Everything compact hangs off this one
 * answer. Beside a room in split view it is the whole app, and a room's "Full app" says it is alone, which gives the whole
 * app back without a reload.
 */
export function useCompactInRoom(): boolean {
  return useAdjacentApp()?.heldInRoom === true
}

/** Names a part of the screen for compact-in-room.css, only while compact: otherwise the markup is exactly as ever. */
export const compactPart = (compact: boolean, part: string) => (compact ? { 'data-compact': part } : undefined)
