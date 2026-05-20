import type { RedeemRequestView, RedeemTimelineStep } from '@/types/pool'

/** First four fixed nodes; fifth is Claimable/Claimed (wireframe §9.2). */
const PREFIX: RedeemTimelineStep[] = ['requested', 'waiting_liquidity', 'unstake_triggered', 'cooldown']

export type TimelineTone = 'wait' | 'cool' | 'ok' | 'neutral' | 'idle'

export interface TimelineRow {
  step: RedeemTimelineStep | 'final'
  labelKey: string
  done: boolean
  active: boolean
  tone: TimelineTone
}

function activeIndex(step: RedeemTimelineStep): number {
  switch (step) {
    case 'requested':
      return 0
    case 'waiting_liquidity':
      return 1
    case 'unstake_triggered':
      return 2
    case 'cooldown':
      return 3
    case 'claimable':
      return 4
    case 'claimed':
      return 4
    default:
      return 0
  }
}

/**
 * @param nowSec Current UNIX time (seconds). When set, if `currentStep === 'waiting_liquidity'` and
 * `nowSec >= unstakeReadyTimestampSec`, the liquidity wait is treated as completed for UI (green `done`
 * on that node; cursor advances at least to `unstake_triggered`).
 */
export function buildRedeemTimeline(req: RedeemRequestView, nowSec?: number): TimelineRow[] {
  const isClaimed = req.currentStep === 'claimed'

  /**
   * 链上 `isReadyToClaim` + 无 proxy：可领取，但不把「触发底层赎回」「冷却中」标为已完成，仅高亮末段可领取。
   */
  if (!isClaimed && req.canClaimByLiquidityNoUnstake) {
    const prefixRows: TimelineRow[] = PREFIX.map((step, i) => {
      const preDone = i < 2
      return {
        step,
        labelKey: step,
        done: preDone,
        active: false,
        tone: (preDone ? 'neutral' : 'idle') as TimelineTone,
      }
    })
    return [
      ...prefixRows,
      {
        step: 'final' as const,
        labelKey: 'claimable',
        done: false,
        active: true,
        tone: 'ok' as TimelineTone,
      },
    ]
  }

  let logicalStep = req.currentStep
  if (
    nowSec !== undefined &&
    req.claimableTimeTimestampSec != null &&
    Number.isFinite(req.claimableTimeTimestampSec) &&
    req.claimableTimeTimestampSec > 0 &&
    nowSec >= req.claimableTimeTimestampSec &&
    req.currentStep !== 'claimed'
  ) {
    logicalStep = 'claimable'
  }

  let cur = activeIndex(logicalStep)
  if (
    nowSec !== undefined &&
    req.currentStep === 'waiting_liquidity' &&
    req.unstakeReadyTimestampSec != null &&
    Number.isFinite(req.unstakeReadyTimestampSec) &&
    nowSec >= req.unstakeReadyTimestampSec
  ) {
    cur = Math.max(cur, 2)
  }

  const rows: TimelineRow[] = PREFIX.map((step, i) => {
    const done = isClaimed || cur > i
    const active = !isClaimed && cur === i
    let tone: TimelineTone = 'idle'
    if (done && !active) tone = 'neutral'
    if (active) {
      if (step === 'waiting_liquidity') tone = 'wait'
      else if (step === 'cooldown') tone = 'cool'
      else tone = 'wait'
    }
    return {
      step,
      labelKey: step,
      done,
      active,
      tone,
    }
  })

  const finalDone = isClaimed
  const finalActive = logicalStep === 'claimable'
  let finalTone: TimelineTone = 'idle'
  if (finalDone) finalTone = 'neutral'
  else if (finalActive) finalTone = 'ok'

  rows.push({
    step: 'final',
    labelKey: isClaimed ? 'claimed' : 'claimable',
    done: finalDone,
    active: finalActive,
    tone: finalTone,
  })

  return rows
}
