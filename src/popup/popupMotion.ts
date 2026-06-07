import type { AnimationType } from '@/types/models'

export function getPopupEnterState(animation: AnimationType) {
  if (animation === 'none') return false as const

  return {
    opacity: 0,
    scale: animation === 'scale' ? 0.94 : 1,
    y: animation === 'slide-down' ? -10 : 0,
  }
}

export function getPopupExitState(animation: AnimationType) {
  if (animation === 'none') return { opacity: 1, scale: 1, y: 0 }

  return {
    opacity: 0,
    scale: animation === 'scale' ? 0.94 : 1,
    y: animation === 'slide-up' ? -10 : 0,
  }
}

export const popupMotionEase = [0.2, 0.8, 0.2, 1] as const
