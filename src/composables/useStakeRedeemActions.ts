import { applyDepositShareAdjustBpsToSharesWei } from '@/config'
import { type Ref, computed, reactive, ref, watch } from 'vue'
import { parseUmaHumanToWei } from '@/lib/parseUmaAmount'
import { formatAmountForUi, poolService } from '@/services/poolService'
import type { PoolMetrics, StakeLimits, UserPosition } from '@/types/pool'

function isStakeAmountWithinLimits(amountHuman: string, lim: StakeLimits): boolean {
  const w = parseUmaHumanToWei(amountHuman)
  if (w === null || w <= 0n) return false
  const minW = parseUmaHumanToWei(lim.minStake)
  const maxW = parseUmaHumanToWei(lim.maxStake)
  if (minW === null || maxW === null) return false
  return w >= minW && w <= maxW
}

function isRedeemAmountWithinLimits(amountHuman: string, lim: StakeLimits): boolean {
  const w = parseUmaHumanToWei(amountHuman)
  if (w === null || w <= 0n) return false
  const minW = parseUmaHumanToWei(lim.minRedeem)
  const maxW = parseUmaHumanToWei(lim.maxRedeem)
  if (minW === null || maxW === null) return false
  return w >= minW && w <= maxW
}

function isStakeAmountWithinWalletBalance(amountHuman: string, walletBalanceHuman: string): boolean {
  const amountWei = parseUmaHumanToWei(amountHuman)
  const balanceWei = parseUmaHumanToWei(walletBalanceHuman)
  if (amountWei === null || balanceWei === null) return false
  return amountWei <= balanceWei
}

/** Parse `navUmaPerShare` from metrics (UMA per 1 UMA-V). */
function navUmaPerOneShare(metrics: PoolMetrics | null): number | null {
  if (!metrics?.navUmaPerShare) return null
  const v = parseFloat(String(metrics.navUmaPerShare).replace(/,/g, ''))
  return Number.isFinite(v) && v > 0 ? v : null
}

/** Preview line from cached NAV only (no `previewDeposit` / `previewRedeem` RPC). */
function formatPreviewUi(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0.00'
  const fixed = n.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  const [intPart, fracPart = ''] = fixed.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const frac = fracPart.length > 4 ? fracPart.slice(0, 4) : fracPart
  return frac ? `${grouped}.${frac}` : grouped
}

/** Shares from assets / NAV (wei), then same {@link applyDepositShareAdjustBpsToSharesWei} as `previewDeposit` / `stakeUma`. */
function stakePreviewFromNav(umaHuman: string, metrics: PoolMetrics | null): string {
  if (!metrics?.navUmaPerShare) return '0.00'
  const raw = umaHuman.replace(/,/g, '').trim()
  const assetsWei = parseUmaHumanToWei(raw)
  if (assetsWei === null || assetsWei <= 0n) return '0.00'
  const navStr = String(metrics.navUmaPerShare).replace(/,/g, '').trim()
  const navWei = parseUmaHumanToWei(navStr)
  if (navWei === null || navWei <= 0n) return '0.00'
  const sharesRaw = (assetsWei * 10n ** 18n) / navWei
  const sharesAdj = applyDepositShareAdjustBpsToSharesWei(sharesRaw)
  return formatAmountForUi(sharesAdj, 18)
}

function redeemPreviewFromNav(umaVHuman: string, nav: number | null): string {
  if (nav == null) return '0.00'
  const raw = umaVHuman.replace(/,/g, '').trim()
  if (!raw) return '0.00'
  const shares = parseFloat(raw)
  if (!Number.isFinite(shares) || shares <= 0) return '0.00'
  return formatPreviewUi(shares * nav)
}

/**
 * Stake / redeem form: min–max validation uses a **snapshot** from `refreshValidationCache()`
 * (chain-backed limits), not per-keystroke reads. Previews use **cached** `metrics.navUmaPerShare` only.
 */
export function useStakeRedeemActions(
  getPosition: () => UserPosition | null,
  walletConnected: Ref<boolean>,
  metrics: Ref<PoolMetrics | null>,
) {
  const stakeAmount = ref('')
  const redeemAmount = ref('')
  const stakePreview = ref('0.00')
  const redeemPreview = ref('0.00')
  const limits = ref<StakeLimits | null>(null)
  const umaApproved = ref(false)
  const busy = ref<'idle' | 'approve' | 'stake' | 'redeem' | 'claim'>('idle')
  const lastTxHash = ref<string | null>(null)
  const formError = ref<string | null>(null)

  let allowanceDebounce: ReturnType<typeof setTimeout> | null = null

  function syncPreviewsFromCache(): void {
    const nav = navUmaPerOneShare(metrics.value)
    stakePreview.value = stakePreviewFromNav(stakeAmount.value, metrics.value)
    redeemPreview.value = redeemPreviewFromNav(redeemAmount.value, nav)
  }

  function scheduleAllowanceCheck(): void {
    if (allowanceDebounce) clearTimeout(allowanceDebounce)
    if (!walletConnected.value) return
    allowanceDebounce = setTimeout(async () => {
      allowanceDebounce = null
      try {
        umaApproved.value = await poolService.getUmaAllowance(stakeAmount.value || '0')
      } catch {
        umaApproved.value = false
      }
    }, 450)
  }

  /** Load stake/redeem limits (includes one-time chain merge in `poolService`) + current allowance. Call after page-style refresh or post-tx. */
  async function refreshValidationCache(): Promise<void> {
    limits.value = await poolService.getStakeLimits()
    if (walletConnected.value) {
      try {
        umaApproved.value = await poolService.getUmaAllowance(stakeAmount.value || '0')
      } catch {
        umaApproved.value = false
      }
    } else {
      umaApproved.value = false
    }
    syncPreviewsFromCache()
  }

  watch(
    walletConnected,
    async (ok) => {
      await refreshValidationCache()
      if (!ok) {
        umaApproved.value = false
      }
    },
    { immediate: true },
  )

  watch([stakeAmount, metrics], () => {
    if (
      formError.value === 'STAKE_OUT_OF_RANGE' ||
      formError.value === 'STAKE_LIMITS_UNAVAILABLE' ||
      formError.value === 'STAKE_EXCEEDS_BALANCE'
    ) {
      formError.value = null
    }
    syncPreviewsFromCache()
    scheduleAllowanceCheck()
  })

  watch([redeemAmount, metrics], () => {
    if (
      formError.value === 'REDEEM_OUT_OF_RANGE' ||
      formError.value === 'REDEEM_INVALID_AMOUNT' ||
      formError.value === 'REDEEM_LIMITS_UNAVAILABLE'
    ) {
      formError.value = null
    }
    syncPreviewsFromCache()
  })

  const canStake = computed(() => {
    const p = getPosition()
    if (!walletConnected.value || !p) return false
    const lim = limits.value
    if (!lim) return false
    if (!isStakeAmountWithinLimits(stakeAmount.value, lim)) return false
    return isStakeAmountWithinWalletBalance(stakeAmount.value, p.umaWalletBalance)
  })

  const canRequestRedeem = computed(() => {
    const p = getPosition()
    if (!walletConnected.value || !p) return false
    if (p.hasActiveRedeem) return false
    const lim = limits.value
    if (!lim) return false
    return isRedeemAmountWithinLimits(redeemAmount.value, lim)
  })

  function assertStakeAmountReady(lim: StakeLimits): boolean {
    const p = getPosition()
    if (!p) {
      formError.value = 'WALLET_NOT_CONNECTED'
      return false
    }
    if (!isStakeAmountWithinLimits(stakeAmount.value, lim)) {
      formError.value = 'STAKE_OUT_OF_RANGE'
      return false
    }
    if (!isStakeAmountWithinWalletBalance(stakeAmount.value, p.umaWalletBalance)) {
      formError.value = 'STAKE_EXCEEDS_BALANCE'
      return false
    }
    return true
  }

  async function approveUma(): Promise<void> {
    busy.value = 'approve'
    formError.value = null
    try {
      const lim = limits.value
      if (!lim) {
        formError.value = 'STAKE_LIMITS_UNAVAILABLE'
        return
      }
      if (!assertStakeAmountReady(lim)) return
      const r = await poolService.approveUma(stakeAmount.value || '0')
      lastTxHash.value = r.txHash
      umaApproved.value = await poolService.getUmaAllowance(stakeAmount.value || '0')
    } catch (e) {
      formError.value = e instanceof Error ? e.message : 'APPROVE_ERROR'
    } finally {
      busy.value = 'idle'
    }
  }

  async function stakeUma(): Promise<void> {
    busy.value = 'stake'
    formError.value = null
    try {
      const lim = limits.value
      if (!lim) {
        formError.value = 'STAKE_LIMITS_UNAVAILABLE'
        return
      }
      if (!assertStakeAmountReady(lim)) return
      const { txHash } = await poolService.stakeUma(stakeAmount.value)
      lastTxHash.value = txHash
      stakeAmount.value = ''
    } catch (e) {
      formError.value = e instanceof Error ? e.message : 'STAKE_ERROR'
    } finally {
      busy.value = 'idle'
    }
  }

  async function requestRedeem(): Promise<void> {
    busy.value = 'redeem'
    formError.value = null
    try {
      const lim = limits.value
      if (!lim) {
        formError.value = 'REDEEM_LIMITS_UNAVAILABLE'
        return
      }
      const w = parseUmaHumanToWei(redeemAmount.value.trim() || '')
      if (w === null || w <= 0n) {
        formError.value = 'REDEEM_INVALID_AMOUNT'
        return
      }
      const minW = parseUmaHumanToWei(lim.minRedeem)
      const maxW = parseUmaHumanToWei(lim.maxRedeem)
      if (minW === null || maxW === null) {
        formError.value = 'REDEEM_LIMITS_UNAVAILABLE'
        return
      }
      if (w < minW || w > maxW) {
        formError.value = 'REDEEM_OUT_OF_RANGE'
        return
      }

      const r = await poolService.requestRedeem(redeemAmount.value)
      lastTxHash.value = r.txHash
      redeemAmount.value = ''
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'REDEEM_ERROR'
      formError.value = msg === 'ACTIVE_REDEEM_EXISTS' ? 'ACTIVE_REDEEM_EXISTS' : msg
    } finally {
      busy.value = 'idle'
    }
  }

  async function claim(requestId: string): Promise<void> {
    busy.value = 'claim'
    formError.value = null
    try {
      const r = await poolService.claimRedeem(requestId)
      lastTxHash.value = r.txHash
    } catch (e) {
      formError.value = e instanceof Error ? e.message : 'CLAIM_ERROR'
    } finally {
      busy.value = 'idle'
    }
  }

  function setStakePct(pct: 25 | 50 | 100): void {
    const p = getPosition()
    if (!p) return
    const bal = parseFloat(p.umaWalletBalance.replace(/,/g, ''))
    if (!Number.isFinite(bal)) return
    stakeAmount.value = ((bal * pct) / 100).toFixed(2)
  }

  function setRedeemPct(pct: 25 | 50 | 100): void {
    const p = getPosition()
    if (!p) return
    const bal = parseFloat(p.umaVBalance.replace(/,/g, ''))
    if (!Number.isFinite(bal)) return
    redeemAmount.value = ((bal * pct) / 100).toFixed(2)
  }

  return reactive({
    stakeAmount,
    redeemAmount,
    stakePreview,
    redeemPreview,
    limits,
    umaApproved,
    busy,
    lastTxHash,
    formError,
    canStake,
    canRequestRedeem,
    refreshValidationCache,
    approveUma,
    stakeUma,
    requestRedeem,
    claim,
    setStakePct,
    setRedeemPct,
  })
}
