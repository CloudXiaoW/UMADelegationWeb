/** Internal lifecycle (may map to 5-node UI timeline). */
export type RedeemTimelineStep =
  | 'requested'
  | 'waiting_liquidity'
  | 'unstake_triggered'
  | 'cooldown'
  | 'claimable'
  | 'claimed'

export interface RedeemRequestView {
  id: string
  receiver: string
  burnedShares: string
  assetsToClaim: string
  claimableTime: string | null
  /** UNIX seconds from on-chain `claimableTime`; used only for time-based claim UI. */
  claimableTimeTimestampSec?: number | null
  /** 约等于链上 `claimableTime - unstakeCoolDown()` 的显示：底层赎回已触发时的时间。 */
  requestTime?: string | null
  isReadyToClaim: boolean
  /**
   * `isReadyToClaim` && 无 proxy：因池子流动性/新 deposit 已可直接领取，不经底层赎回；
   * 时间线中「可领取」单独高亮，不将「触发底层赎回」「冷却中」标为已完成。
   */
  canClaimByLiquidityNoUnstake?: boolean
  proxyAddress?: string
  currentStep: RedeemTimelineStep
  completedSteps: RedeemTimelineStep[]
  /**
   * UNIX seconds from `getUnstakeReadyTime()`; only set while `currentStep === 'waiting_liquidity'`.
   * If `<= now`, UI shows `0` (unstake can be triggered); else show countdown to this timestamp.
   */
  unstakeReadyTimestampSec?: number | null
}

export interface PoolMetrics {
  totalSupplyUmaV: string
  totalAssetsUma: string
  navUmaPerShare: string
  /** Annualized yield percent for display (e.g. APY-style headline number). */
  annualizedYieldPercent: number
}

export interface UserPosition {
  umaWalletBalance: string
  umaVBalance: string
  umaEquivalent: string
  hasActiveRedeem: boolean
  claimableUma: string
}

export interface StakeLimits {
  minStake: string
  maxStake: string
  minRedeem: string
  maxRedeem: string
}

export interface WalletState {
  connected: boolean
  address: string | null
  chainId: number | null
  chainOk: boolean
}
