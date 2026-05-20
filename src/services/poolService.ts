import {
  ANNUALIZED_YIELD_PERCENT,
  applyDepositShareAdjustBpsToSharesWei,
  CHAIN_CONTRACTS,
  CHAIN_ENV,
  FALLBACK_STAKE_LIMITS,
  STAKE_LIMITS_JSON_URL,
  parseStakeLimitsConfigJson,
} from '@/config'
import { isRedeemPastClaimableTime } from '@/lib/redeemClaimWindow'
import { parseUmaHumanToWei } from '@/lib/parseUmaAmount'
import type { PoolMetrics, RedeemRequestView, RedeemTimelineStep, StakeLimits, UserPosition } from '@/types/pool'

export interface IPoolService {
  refreshMetrics(): Promise<PoolMetrics>
  refreshUser(): Promise<{
    position: UserPosition
    activeRedeem: RedeemRequestView | null
    candidateRedeem: RedeemRequestView | null
    redeemHistory: RedeemRequestView[]
  }>
  getStakeLimits(): Promise<StakeLimits>
  previewDeposit(umaAmount: string): Promise<string>
  previewRedeem(umaVAmount: string): Promise<string>
  approveUma(_amount: string): Promise<{ txHash: string }>
  stakeUma(umaAmount: string): Promise<{ txHash: string; umaVReceived: string }>
  requestRedeem(umaVAmount: string): Promise<{ txHash: string }>
  claimRedeem(requestId: string): Promise<{ txHash: string }>
  triggerRequestUnstake(): Promise<{ txHash: string }>
  getUmaAllowance(forAmount: string): Promise<boolean>
}

function delay<T>(ms: number, v: T): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms))
}

function isEvmAddress(a: string | null): a is `0x${string}` {
  return !!a && /^0x[0-9a-fA-F]{40}$/.test(a)
}

/** `readContract` with a full human-readable `function …` signature (no selector / raw calldata). */
async function readContractView<T>(
  address: `0x${string}`,
  method: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  try {
    const { getOrCreateClient, getTargetChain } = await import('@/lib/thirdwebWallet')
    const { readContract, getContract } = await import('thirdweb')
    const contract = getContract({
      client: getOrCreateClient(),
      chain: getTargetChain(),
      address,
    })
    const read = readContract as (args: {
      contract: typeof contract
      method: `function ${string}`
      params: unknown[]
    }) => Promise<unknown>
    return (await read({
      contract,
      method: method as `function ${string}`,
      params: [...params],
    })) as T
  } catch {
    return null
  }
}

async function readViewUint256(
  address: `0x${string}`,
  method: string,
  params: readonly unknown[] = [],
): Promise<bigint | null> {
  const raw = await readContractView<bigint | string | number>(address, method, params)
  if (raw === null) return null
  try {
    return typeof raw === 'bigint' ? raw : BigInt(raw as string | number | bigint)
  } catch {
    return null
  }
}

function formatUnits(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals)
  const integer = raw / base
  const fraction = raw % base
  if (fraction === 0n) return integer.toString()
  const fractionPadded = fraction.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${integer}.${fractionPadded}`
}

/** Format fixed-point wei for dashboard copy (grouped int, up to 4 frac digits). */
export function formatAmountForUi(raw: bigint, decimals = 18): string {
  const normalized = formatUnits(raw, decimals)
  const [intPart, fracPart = ''] = normalized.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fixed = fracPart.length > 4 ? fracPart.slice(0, 4) : fracPart
  return fixed ? `${grouped}.${fixed}` : grouped
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

function inferRedeemTimelineStep(r: { proxyAddress: string; claimableTime: bigint }): RedeemTimelineStep {
  const proxyZero = r.proxyAddress.toLowerCase() === ZERO_ADDR
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (proxyZero) return 'waiting_liquidity'
  if (r.claimableTime > 0n && now < r.claimableTime) return 'cooldown'
  if (r.claimableTime > 0n && now >= r.claimableTime) return 'claimable'
  return 'unstake_triggered'
}

type RedeemRequestTuple = readonly [string, bigint, bigint, string, bigint, boolean]

function buildRedeemTuple(raw: unknown): RedeemRequestTuple | null {
  if (!Array.isArray(raw) || raw.length < 6) return null
  const [receiver, sb, atc, proxy, ct, ready] = raw
  if (typeof receiver !== 'string') return null
  const toBi = (v: unknown): bigint => {
    if (typeof v === 'bigint') return v
    if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v))
    if (typeof v === 'string' && /^-?[0-9]+$/.test(v)) return BigInt(v)
    return 0n
  }
  return [receiver, toBi(sb), toBi(atc), String(proxy), toBi(ct), Boolean(ready)]
}

/**
 * Map vault redeem tuple (pending or candidate) into UI view.
 */
async function buildRedeemRequestViewFromTuple(id: string, tuple: RedeemRequestTuple): Promise<RedeemRequestView | null> {
  const [receiver, sharesBurned, assetsToClaim, proxyAddress, claimableTime, isReadyToClaim] = tuple
  if (!receiver || receiver.toLowerCase() === ZERO_ADDR) return null

  const proxyIsZero = proxyAddress.toLowerCase() === ZERO_ADDR
  const canClaimByLiquidityNoUnstake = isReadyToClaim && proxyIsZero

  const currentStep = inferRedeemTimelineStep({
    proxyAddress,
    claimableTime,
  })

  let unstakeReadyTimestampSec: number | null = null
  if (currentStep === 'waiting_liquidity' && !canClaimByLiquidityNoUnstake) {
    unstakeReadyTimestampSec = await readVaultGetUnstakeReadyTimeSec()
  }

  let requestTime: string | null = null
  if (claimableTime > 0n) {
    const cd = await readVotingV2UnstakeCooldownSec()
    if (cd != null) {
      requestTime = computeUnstakeTriggerTimeLabel(claimableTime, cd)
    }
  }

  return {
    id,
    receiver,
    burnedShares: formatAmountForUi(sharesBurned, 18),
    assetsToClaim: formatAmountForUi(assetsToClaim, 18),
    claimableTime:
      claimableTime > 0n ? formatUtcDateTimeForUiFromUnixSec(Number(claimableTime)) : null,
    claimableTimeTimestampSec: claimableTime > 0n ? Number(claimableTime) : null,
    requestTime,
    isReadyToClaim,
    canClaimByLiquidityNoUnstake,
    proxyAddress,
    currentStep,
    completedSteps: [],
    unstakeReadyTimestampSec,
  }
}

async function readVaultRedeemTuple(
  method: string,
  owner: `0x${string}`,
): Promise<RedeemRequestTuple | null> {
  const cfg = CHAIN_CONTRACTS[CHAIN_ENV]
  const raw = await readContractView<unknown>(cfg.stakeDelegationVault, method, [owner])
  return buildRedeemTuple(raw)
}

/** `UmaDelegationVault.getRedeemRequest(address)` — explicit sender address. */
async function readVaultGetRedeemRequestView(owner: `0x${string}`): Promise<RedeemRequestView | null> {
  const tuple = await readVaultRedeemTuple(
    'function getRedeemRequest(address sender) view returns (address receiver, uint128 sharesBurned, uint128 assetsToClaim, address proxyAddress, uint64 claimableTime, bool isReadyToClaim)',
    owner,
  )
  if (!tuple) return null
  return buildRedeemRequestViewFromTuple(`vault:${owner.toLowerCase()}`, tuple)
}

/** `UmaDelegationVault.getCandidateRedeemRequest(address)` — candidate queue entry for sender. */
async function readVaultGetCandidateRedeemRequestView(owner: `0x${string}`): Promise<RedeemRequestView | null> {
  const tuple = await readVaultRedeemTuple(
    'function getCandidateRedeemRequest(address sender) view returns (address receiver, uint128 sharesBurned, uint128 assetsToClaim, address proxyAddress, uint64 claimableTime, bool isReadyToClaim)',
    owner,
  )
  if (!tuple) return null
  return buildRedeemRequestViewFromTuple(`vault:candidate:${owner.toLowerCase()}`, tuple)
}

function formatUtcDateTimeForUiFromUnixSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '—'
  return `${new Date(sec * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

/** VotingV2 `unstakeCoolDown()` — seconds; contract address from `CHAIN_CONTRACTS[CHAIN_ENV].votingV2`. */
async function readVotingV2UnstakeCooldownSec(): Promise<number | null> {
  const cfg = CHAIN_CONTRACTS[CHAIN_ENV]
  const voting = cfg.votingV2
  if (!voting || voting.toLowerCase() === ZERO_ADDR) return null
  const n = await readViewUint256(voting, 'function unstakeCoolDown() view returns (uint256)', [])
  if (n === null) return null
  return Number(n)
}

function computeUnstakeTriggerTimeLabel(
  claimableTimeSec: bigint,
  cooldownSec: number,
): string | null {
  if (claimableTimeSec <= 0n) return null
  if (!Number.isFinite(cooldownSec) || cooldownSec < 0) return null
  const claim = Number(claimableTimeSec)
  if (!Number.isFinite(claim) || claim <= 0) return null
  const trigger = claim - cooldownSec
  if (!Number.isFinite(trigger) || trigger <= 0) return null
  const label = formatUtcDateTimeForUiFromUnixSec(trigger)
  return label === '—' ? null : label
}

async function readVaultGetUnstakeReadyTimeSec(): Promise<number | null> {
  const cfg = CHAIN_CONTRACTS[CHAIN_ENV]
  const n = await readViewUint256(
    cfg.stakeDelegationVault,
    'function getUnstakeReadyTime() view returns (uint256)',
    [],
  )
  if (n === null) return null
  return Number(n)
}

async function readUmaVTotalSupplyWei(): Promise<bigint | null> {
  return readViewUint256(
    CHAIN_CONTRACTS[CHAIN_ENV].umaVaultShare,
    'function totalSupply() view returns (uint256)',
    [],
  )
}

async function readUmaVaultShareBalanceWei(account: `0x${string}`): Promise<bigint | null> {
  return readViewUint256(
    CHAIN_CONTRACTS[CHAIN_ENV].umaVaultShare,
    'function balanceOf(address owner) view returns (uint256)',
    [account],
  )
}

async function readUmaTokenAllowanceWei(owner: `0x${string}`, spender: `0x${string}`): Promise<bigint | null> {
  return readViewUint256(
    CHAIN_CONTRACTS[CHAIN_ENV].umaToken,
    'function allowance(address owner, address spender) view returns (uint256)',
    [owner, spender],
  )
}

async function readUmaTokenBalanceWei(account: `0x${string}`): Promise<bigint | null> {
  return readViewUint256(
    CHAIN_CONTRACTS[CHAIN_ENV].umaToken,
    'function balanceOf(address owner) view returns (uint256)',
    [account],
  )
}

async function readVaultTotalAssetsWei(): Promise<bigint | null> {
  return readViewUint256(
    CHAIN_CONTRACTS[CHAIN_ENV].stakeDelegationVault,
    'function totalAssets() view returns (uint256)',
    [],
  )
}

async function readVaultPreviewDepositSharesWei(assetsWei: bigint): Promise<bigint | null> {
  return readViewUint256(
    CHAIN_CONTRACTS[CHAIN_ENV].stakeDelegationVault,
    'function previewDeposit(uint256 assets) view returns (uint256)',
    [assetsWei],
  )
}

async function readVaultPreviewRedeemAssetsWei(sharesWei: bigint): Promise<bigint | null> {
  return readViewUint256(
    CHAIN_CONTRACTS[CHAIN_ENV].stakeDelegationVault,
    'function previewRedeem(uint256 shares) view returns (uint256)',
    [sharesWei],
  )
}

async function readVaultPreviewWithdrawSharesWei(assetsWei: bigint): Promise<bigint | null> {
  return readViewUint256(
    CHAIN_CONTRACTS[CHAIN_ENV].stakeDelegationVault,
    'function previewWithdraw(uint256 assets) view returns (uint256)',
    [assetsWei],
  )
}

async function readVaultGetMaxPotentialSingleProxyCapacityWei(): Promise<bigint | null> {
  return readViewUint256(
    CHAIN_CONTRACTS[CHAIN_ENV].stakeDelegationVault,
    'function maxPotentialSingleProxyCapacity() view returns (uint256)',
    [],
  )
}

/**
 * Stake / redeem min & max come from local config (`stake-limits.json`).
 * Redeem max per tx is further capped by `previewWithdraw(maxPotentialSingleProxyCapacity())`
 * when unstake capacity &gt; 0; if capacity is 0, config `maxRedeem` applies as-is.
 */
async function mergeRedeemLimitsWithUnstakeCap(base: StakeLimits): Promise<StakeLimits> {
  const maxRedeemWei = parseUmaHumanToWei(base.maxRedeem)
  if (maxRedeemWei === null || maxRedeemWei <= 0n) {
    return { ...base }
  }

  const capWei = await readVaultGetMaxPotentialSingleProxyCapacityWei()
  let maxRedeemSharesWei = maxRedeemWei
  if (capWei !== null && capWei > 0n) {
    const sharesForCap = await readVaultPreviewWithdrawSharesWei(capWei)
    if (sharesForCap !== null && sharesForCap < maxRedeemSharesWei) {
      maxRedeemSharesWei = sharesForCap
    }
  }

  return {
    ...base,
    maxRedeem: formatAmountForUi(maxRedeemSharesWei, 18),
  }
}

/**
 * NAV = totalAssets / totalSupply（均为 18 位 wei）：`navWei = assetsWei * 10^18 / supplyWei`。
 * 转为人类可读十进制字符串时**不截断精度**（最多 18 位小数，与 wei 一致）；展示层用 `formatNavDecimal` 保留 3 位。
 */
function formatNavWeiToFullPrecisionHuman(navWei: bigint): string {
  const decimals = 18
  const base = 10n ** BigInt(decimals)
  const w = navWei < 0n ? -navWei : navWei
  const intPart = w / base
  let frac = (w % base).toString().padStart(decimals, '0')
  frac = frac.replace(/0+$/, '')
  if (!frac) return intPart.toString()
  return `${intPart}.${frac}`
}

function formatNavFullHumanFromAssetsAndSupplyWei(assetsWei: bigint, supplyWei: bigint): string | null {
  if (supplyWei === 0n) return null
  const navWei = (assetsWei * 10n ** 18n) / supplyWei
  return formatNavWeiToFullPrecisionHuman(navWei)
}

let stakeLimitsCached: Promise<StakeLimits> | null = null

async function loadStakeLimitsFromConfigFile(): Promise<StakeLimits> {
  try {
    const res = await fetch(STAKE_LIMITS_JSON_URL, { cache: 'no-cache' })
    if (!res.ok) return FALLBACK_STAKE_LIMITS
    const json: unknown = await res.json()
    return parseStakeLimitsConfigJson(json, CHAIN_ENV) ?? FALLBACK_STAKE_LIMITS
  } catch {
    return FALLBACK_STAKE_LIMITS
  }
}

function getStakeLimitsCached(): Promise<StakeLimits> {
  if (!stakeLimitsCached) {
    stakeLimitsCached = loadStakeLimitsFromConfigFile()
  }
  return stakeLimitsCached
}

/** Wallet connection state mirrored from `useWallet` for pool reads / tx preconditions. */
let poolWalletConnected = false
let poolWalletAddress: string | null = null

/** Called from `useWallet` when Thirdweb connection or chain state changes. */
export function setPoolWalletContext(connected: boolean, address: string | null): void {
  poolWalletConnected = connected
  poolWalletAddress = address
}

class DefaultPoolService implements IPoolService {
  private metrics: PoolMetrics = {
    totalSupplyUmaV: '0.00',
    totalAssetsUma: '0.00',
    navUmaPerShare: '1',
    annualizedYieldPercent: ANNUALIZED_YIELD_PERCENT,
  }

  private position: UserPosition = {
    umaWalletBalance: '0.00',
    umaVBalance: '0.00',
    umaEquivalent: '0.00',
    hasActiveRedeem: false,
    claimableUma: '0.00',
  }

  private activeRedeem: RedeemRequestView | null = null
  private candidateRedeem: RedeemRequestView | null = null
  private history: RedeemRequestView[] = []

  private syncFlags(): void {
    this.position.hasActiveRedeem = this.activeRedeem != null && this.activeRedeem.currentStep !== 'claimed'
    const now = Math.floor(Date.now() / 1000)
    const c =
      this.activeRedeem && isRedeemPastClaimableTime(this.activeRedeem, now) ? this.activeRedeem : null
    this.position.claimableUma = c ? c.assetsToClaim : '0.00'
  }

  async refreshMetrics(): Promise<PoolMetrics> {
    await delay(120, this.metrics)
    const supplyWei = await readUmaVTotalSupplyWei()
    const assetsWei = await readVaultTotalAssetsWei()

    const totalSupplyUmaV =
      supplyWei !== null ? formatAmountForUi(supplyWei, 18) : this.metrics.totalSupplyUmaV
    const totalAssetsUma =
      assetsWei !== null ? formatAmountForUi(assetsWei, 18) : this.metrics.totalAssetsUma

    const navUmaPerShare =
      supplyWei !== null && assetsWei !== null && supplyWei > 0n
        ? (formatNavFullHumanFromAssetsAndSupplyWei(assetsWei, supplyWei) ?? this.metrics.navUmaPerShare)
        : this.metrics.navUmaPerShare

    const next: PoolMetrics = {
      ...this.metrics,
      totalSupplyUmaV,
      totalAssetsUma,
      navUmaPerShare,
      annualizedYieldPercent: ANNUALIZED_YIELD_PERCENT,
    }
    this.metrics = next
    return next
  }

  async refreshUser(): Promise<{
    position: UserPosition
    activeRedeem: RedeemRequestView | null
    candidateRedeem: RedeemRequestView | null
    redeemHistory: RedeemRequestView[]
  }> {
    await delay(120, true)
    if (!poolWalletConnected) {
      this.activeRedeem = null
      this.candidateRedeem = null
      this.position.hasActiveRedeem = false
      this.position.claimableUma = '0.00'
      return {
        position: {
          umaWalletBalance: '0.00',
          umaVBalance: '0.00',
          umaEquivalent: '0.00',
          hasActiveRedeem: false,
          claimableUma: '0.00',
        },
        activeRedeem: null,
        candidateRedeem: null,
        redeemHistory: [],
      }
    }

    const owner = poolWalletAddress
    let umaWalletBalance = '0.00'
    let umaVBalance = '0.00'
    let umaEquivalent = '0.00'
    if (owner && isEvmAddress(owner)) {
      const shareWei = await readUmaVaultShareBalanceWei(owner)
      const [supplyWei, assetsWei, walletUmaWei, redeemPreviewWei] = await Promise.all([
        readUmaVTotalSupplyWei(),
        readVaultTotalAssetsWei(),
        readUmaTokenBalanceWei(owner),
        shareWei !== null && shareWei > 0n ? readVaultPreviewRedeemAssetsWei(shareWei) : Promise.resolve(null as bigint | null),
      ])
      if (walletUmaWei !== null) {
        umaWalletBalance = formatAmountForUi(walletUmaWei, 18)
      }
      if (shareWei !== null) {
        umaVBalance = formatAmountForUi(shareWei, 18)
      }
      if (redeemPreviewWei !== null) {
        umaEquivalent = formatAmountForUi(redeemPreviewWei, 18)
      } else if (shareWei !== null && supplyWei !== null && assetsWei !== null && supplyWei > 0n) {
        const umaWei = (shareWei * assetsWei) / supplyWei
        umaEquivalent = formatAmountForUi(umaWei, 18)
      }
    }
    this.position.umaWalletBalance = umaWalletBalance
    this.position.umaVBalance = umaVBalance
    this.position.umaEquivalent = umaEquivalent

    if (owner && isEvmAddress(owner)) {
      try {
        const [main, cand] = await Promise.all([
          readVaultGetRedeemRequestView(owner),
          readVaultGetCandidateRedeemRequestView(owner),
        ])
        this.activeRedeem = main
        this.candidateRedeem = cand
      } catch {
        /* keep previous on RPC failure */
      }
    } else {
      this.activeRedeem = null
      this.candidateRedeem = null
    }

    this.syncFlags()
    return {
      position: { ...this.position },
      activeRedeem: this.activeRedeem ? { ...this.activeRedeem } : null,
      candidateRedeem: this.candidateRedeem ? { ...this.candidateRedeem } : null,
      redeemHistory: this.history.map((h) => ({ ...h })),
    }
  }

  async getStakeLimits(): Promise<StakeLimits> {
    const lim = await getStakeLimitsCached()
    return mergeRedeemLimitsWithUnstakeCap(lim)
  }

  async previewDeposit(umaAmount: string): Promise<string> {
    const assetsWei = parseUmaHumanToWei(umaAmount)
    if (assetsWei === null || assetsWei <= 0n) return '0.00'
    const sharesWei = await readVaultPreviewDepositSharesWei(assetsWei)
    if (sharesWei === null) return '0.00'
    return formatAmountForUi(applyDepositShareAdjustBpsToSharesWei(sharesWei), 18)
  }

  async previewRedeem(umaVAmount: string): Promise<string> {
    const sharesWei = parseUmaHumanToWei(umaVAmount)
    if (sharesWei === null || sharesWei <= 0n) return '0.00'
    const assetsWei = await readVaultPreviewRedeemAssetsWei(sharesWei)
    if (assetsWei === null) return '0.00'
    return formatAmountForUi(assetsWei, 18)
  }

  async approveUma(amount: string): Promise<{ txHash: string }> {
    const { sendUmaApproveToStakeVault } = await import('@/lib/thirdwebWallet')
    const txHash = await sendUmaApproveToStakeVault(amount)
    return { txHash }
  }

  async getUmaAllowance(forAmount: string): Promise<boolean> {
    if (!poolWalletConnected || !poolWalletAddress || !isEvmAddress(poolWalletAddress)) {
      return false
    }
    const need = parseUmaHumanToWei(forAmount)
    if (need === null || need <= 0n) return false
    const allowance = await readUmaTokenAllowanceWei(
      poolWalletAddress,
      CHAIN_CONTRACTS[CHAIN_ENV].stakeDelegationVault,
    )
    if (allowance === null) return false
    return allowance >= need
  }

  async stakeUma(umaAmount: string): Promise<{ txHash: string; umaVReceived: string }> {
    const assetsWei = parseUmaHumanToWei(umaAmount)
    if (assetsWei === null || assetsWei <= 0n) {
      throw new Error('INVALID_AMOUNT')
    }
    if (!poolWalletConnected || !poolWalletAddress || !isEvmAddress(poolWalletAddress)) {
      throw new Error('WALLET_NOT_CONNECTED')
    }
    const owner = poolWalletAddress
    const balanceBefore = await readUmaVaultShareBalanceWei(owner)
    const { sendUmaDelegationVaultDeposit } = await import('@/lib/thirdwebWallet')
    const txHash = await sendUmaDelegationVaultDeposit(umaAmount)
    const balanceAfter = await readUmaVaultShareBalanceWei(owner)
    let umaVReceived = '0.00'
    if (balanceBefore !== null && balanceAfter !== null && balanceAfter >= balanceBefore) {
      const raw = balanceAfter - balanceBefore
      umaVReceived = formatAmountForUi(applyDepositShareAdjustBpsToSharesWei(raw), 18)
    } else {
      umaVReceived = await this.previewDeposit(umaAmount)
    }
    return { txHash, umaVReceived }
  }

  async requestRedeem(umaVAmount: string): Promise<{ txHash: string }> {
    const sharesWei = parseUmaHumanToWei(umaVAmount)
    if (sharesWei === null || sharesWei <= 0n) {
      throw new Error('INVALID_AMOUNT')
    }
    if (!poolWalletConnected || !poolWalletAddress || !isEvmAddress(poolWalletAddress)) {
      throw new Error('WALLET_NOT_CONNECTED')
    }
    const owner = poolWalletAddress
    const existing = await readVaultGetRedeemRequestView(owner)
    if (existing) {
      throw new Error('ACTIVE_REDEEM_EXISTS')
    }
    const { sendUmaDelegationVaultRequestRedeem } = await import('@/lib/thirdwebWallet')
    const txHash = await sendUmaDelegationVaultRequestRedeem(umaVAmount)
    return { txHash }
  }

  async claimRedeem(requestId: string): Promise<{ txHash: string }> {
    if (!poolWalletConnected || !poolWalletAddress || !isEvmAddress(poolWalletAddress)) {
      throw new Error('WALLET_NOT_CONNECTED')
    }
    const owner = poolWalletAddress
    const expectedId = `vault:${owner.toLowerCase()}`
    if (requestId.toLowerCase() !== expectedId) {
      throw new Error('INVALID_REQUEST')
    }
    const pending = await readVaultGetRedeemRequestView(owner)
    const now = Math.floor(Date.now() / 1000)
    if (!pending || !isRedeemPastClaimableTime(pending, now)) {
      throw new Error('NOT_CLAIMABLE')
    }
    const { sendUmaDelegationVaultClaimRedeem } = await import('@/lib/thirdwebWallet')
    const txHash = await sendUmaDelegationVaultClaimRedeem()
    return { txHash }
  }

  /** Sends `triggerRequestUnstake()` on the vault (no args; proxy handled inside the contract). */
  async triggerRequestUnstake(): Promise<{ txHash: string }> {
    if (!poolWalletConnected || !poolWalletAddress || !isEvmAddress(poolWalletAddress)) {
      throw new Error('WALLET_NOT_CONNECTED')
    }
    const { sendUmaDelegationVaultTriggerRequestUnstake } = await import('@/lib/thirdwebWallet')
    const txHash = await sendUmaDelegationVaultTriggerRequestUnstake()
    return { txHash }
  }
}

export const poolService: IPoolService = new DefaultPoolService()
