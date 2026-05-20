import type { RedeemRequestView } from '@/types/pool'

/**
 * UI「可领取」/ 领取 UMA 可点：链上已 ready，且
 * - `claimableTime` 已到达，或
 * - `isReadyToClaim` 为 true 且 `proxyAddress` 为 0（新流动性下不经底层赎回即可领取）
 */
export function isRedeemPastClaimableTime(req: RedeemRequestView, nowSec: number): boolean {
  if (req.currentStep === 'claimed') return false
  if (req.canClaimByLiquidityNoUnstake) return true
  const ts = req.claimableTimeTimestampSec
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return false
  return nowSec >= ts
}
