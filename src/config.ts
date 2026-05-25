import type { StakeLimits } from '@/types/pool'

/** Annualized yield (percent) for hero stats card. Override with `VITE_ANNUALIZED_YIELD_PERCENT`; production should use `refreshMetrics()`. */
export const ANNUALIZED_YIELD_PERCENT = Number(import.meta.env.VITE_ANNUALIZED_YIELD_PERCENT ?? 8.5)

/** Nominal fee rate (blue) in「手续费规则」copy. Override: `VITE_FEE_RULE_NOMINAL_PERCENT`. */
export const FEE_RULE_NOMINAL_PERCENT = Number(import.meta.env.VITE_FEE_RULE_NOMINAL_PERCENT ?? 5)

/** Effective / actual fee rate (red) in「手续费规则」copy. Override: `VITE_FEE_RULE_ACTUAL_PERCENT`. */
export const FEE_RULE_ACTUAL_PERCENT = Number(import.meta.env.VITE_FEE_RULE_ACTUAL_PERCENT ?? 3)

/**
 * Deposit: during UMA **reveal** phase only, scale expected vault shares by
 * `(10000 - depositShareAdjustBps) / 10000` (basis points). Commit phase uses no adjustment.
 * Round = 2 days (commit 1d + reveal 1d); phase from `VotingV2.getVotePhase()`.
 * Override: `VITE_DEPOSIT_SHARE_ADJUST_BPS` (integer 0–10000).
 */
const rawDepositShareAdjustBps = Number(import.meta.env.VITE_DEPOSIT_SHARE_ADJUST_BPS ?? 0)
export const depositShareAdjustBps = Math.min(10000, Math.trunc(rawDepositShareAdjustBps))

/**
 * Apply {@link depositShareAdjustBps} to raw share wei when `inRevealPhase` is true.
 * Commit phase returns `sharesWei` unchanged.
 */
export function applyDepositShareAdjustBpsToSharesWei(sharesWei: bigint, inRevealPhase: boolean): bigint {
  if (!inRevealPhase) return sharesWei
  if (depositShareAdjustBps <= 0) return sharesWei
  if (depositShareAdjustBps >= 10000) return 0n
  return (sharesWei * BigInt(10000 - depositShareAdjustBps)) / 10000n
}

export type ChainEnv = 'mainnet' | 'sepolia'

/** Active chain for on-chain reads. Override: `VITE_CHAIN_ENV=mainnet|sepolia`. */
export const CHAIN_ENV: ChainEnv = (import.meta.env.VITE_CHAIN_ENV === 'mainnet' ? 'mainnet' : 'sepolia')

export interface ChainContracts {
  rpcUrl: string
  chainId: number
  /** ERC20 UMA token (wallet balance / approvals). */
  umaToken: `0x${string}`
  umaVaultShare: `0x${string}`
  stakeDelegationVault: `0x${string}`
  /** UMA VotingV2 (e.g. `unstakeCoolDown()` for redeem UI). */
  votingV2: `0x${string}`
}

/**
 * Contract + RPC config by environment.
 * - sepolia addresses are provided by current deployment.
 * - mainnet placeholders should be replaced before production rollout.
 */
export const CHAIN_CONTRACTS: Record<ChainEnv, ChainContracts> = {
  sepolia: {
    rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org',
    chainId: 11155111,
    umaToken: (import.meta.env.VITE_SEPOLIA_UMA_TOKEN ??
      '0x9a6abb64afaae431e0e158763a4b7e0737804d48') as `0x${string}`,
    umaVaultShare: '0x1F613984b4fF6F1Ab657Fb485fd1a9033c855257',
    stakeDelegationVault: '0x0880B22De9376CDd8adcA0549d1A0f4823FD11EB',
    votingV2: (import.meta.env.VITE_SEPOLIA_VOTING_V2 ??
      '0x0d3a84927a52a88dd5bc324934f28953a01218d0') as `0x${string}`,
  },
  mainnet: {
    rpcUrl: import.meta.env.VITE_MAINNET_RPC_URL ?? 'https://ethereum-rpc.publicnode.com',
    chainId: 1,
    umaToken: (import.meta.env.VITE_MAINNET_UMA_TOKEN ??
      '0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828') as `0x${string}`,
    umaVaultShare: (import.meta.env.VITE_MAINNET_UMA_VAULT_SHARE ??
      '0x536A4271788f187360049c8f5725098D79f036B6') as `0x${string}`,
    stakeDelegationVault: (import.meta.env.VITE_MAINNET_STAKE_DELEGATION_VAULT ??
      '0xC468D594d1e4215e9c4a6fA8D2f80968E76fAc9C') as `0x${string}`,
    votingV2: (import.meta.env.VITE_MAINNET_VOTING_V2 ??
      '0x004395edb43EFca9885CEdad51EC9fAf93Bd34ac') as `0x${string}`,
  },
}

/** Public JSON with 6-month NAV series for the yield section chart. Deployed file: `public/config/nav-history.json` (fetch at runtime, no rebuild to update). */
export const NAV_HISTORY_JSON_URL = `${import.meta.env.BASE_URL}config/nav-history.json`

/**
 * Stake / redeem amount limits for UI validation (`public/config/stake-limits.json`).
 * Per-chain keys `sepolia` | `mainnet` match `CHAIN_ENV`. Edit the JSON at deploy time without rebuild.
 */
export const STAKE_LIMITS_JSON_URL = `${import.meta.env.BASE_URL}config/stake-limits.json`

/** Used when `stake-limits.json` is missing or invalid. */
export const FALLBACK_STAKE_LIMITS: StakeLimits = {
  minStake: '10',
  maxStake: '10,000,000',
  minRedeem: '1,000',
  maxRedeem: '10,000,000',
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/** Parse `stake-limits.json`: prefer `json[chain]`, else a flat object with all four fields. */
export function parseStakeLimitsConfigJson(json: unknown, chain: ChainEnv): StakeLimits | null {
  if (!json || typeof json !== 'object') return null
  const root = json as Record<string, unknown>
  const byChain = root[chain]
  const src =
    byChain && typeof byChain === 'object' && !Array.isArray(byChain)
      ? (byChain as Record<string, unknown>)
      : root
  if (!isNonEmptyString(src.minStake)) return null
  if (!isNonEmptyString(src.maxStake)) return null
  if (!isNonEmptyString(src.minRedeem)) return null
  if (!isNonEmptyString(src.maxRedeem)) return null
  return {
    minStake: src.minStake.trim(),
    maxStake: src.maxStake.trim(),
    minRedeem: src.minRedeem.trim(),
    maxRedeem: src.maxRedeem.trim(),
  }
}

/** Etherscan (mainnet / Sepolia) — paths match `CHAIN_ENV`. */
const EXPLORER_BY_CHAIN: Record<ChainEnv, { tx: string; address: string }> = {
  mainnet: {
    tx: 'https://etherscan.io/tx',
    address: 'https://etherscan.io/address',
  },
  sepolia: {
    tx: 'https://sepolia.etherscan.io/tx',
    address: 'https://sepolia.etherscan.io/address',
  },
}

export const EXPLORER_TX_BASE = EXPLORER_BY_CHAIN[CHAIN_ENV].tx
export const EXPLORER_ADDRESS_BASE = EXPLORER_BY_CHAIN[CHAIN_ENV].address
/** Nav「文档」— whitepapers (Google Drive). Override via `VITE_LINK_*`. */
export const LINK_PRODUCT_WHITEPAPER_EN =
  import.meta.env.VITE_LINK_PRODUCT_WHITEPAPER_EN?.trim() ||
  'https://drive.google.com/file/d/10lv1eJUFF8bHm0snxHKmR5bjLaZE3nH3/view?usp=drive_link'
export const LINK_PRODUCT_WHITEPAPER_CN =
  import.meta.env.VITE_LINK_PRODUCT_WHITEPAPER_CN?.trim() ||
  'https://drive.google.com/file/d/131gnMmJjXwYjAlbUnzyYKU5qXdYYYDBj/view?usp=drive_link'
export const LINK_TECHNICAL_WHITEPAPER_EN =
  import.meta.env.VITE_LINK_TECHNICAL_WHITEPAPER_EN?.trim() ||
  'https://drive.google.com/file/d/1Ei5VAuMKjZgzUQhVhp0GAP4Hr9lXCXak/view?usp=drive_link'
export const LINK_TECHNICAL_WHITEPAPER_CN =
  import.meta.env.VITE_LINK_TECHNICAL_WHITEPAPER_CN?.trim() ||
  'https://drive.google.com/file/d/1ppNttMfQXf33iMLFMYUfFCSgFdolwkaC/view?usp=drive_link'

/** Ordered whitepaper entries for the nav Docs dropdown (before audit reports). */
export const NAV_DOCS_WHITEPAPERS = [
  { href: LINK_PRODUCT_WHITEPAPER_EN, i18nKey: 'nav.productWhitepaperEn' },
  { href: LINK_PRODUCT_WHITEPAPER_CN, i18nKey: 'nav.productWhitepaperZh' },
  { href: LINK_TECHNICAL_WHITEPAPER_EN, i18nKey: 'nav.technicalWhitepaperEn' },
  { href: LINK_TECHNICAL_WHITEPAPER_CN, i18nKey: 'nav.technicalWhitepaperZh' },
] as const

/** Nav「文档」— audit reports (Google Drive). */
export const LINK_AUDIT_REPORT_EN =
  'https://drive.google.com/file/d/1DE7IgobPXq8bKFXnbMKPVwhizFzi5ols/view?usp=sharing'
export const LINK_AUDIT_REPORT_CN =
  'https://drive.google.com/file/d/1A58C8Og6bTCTjoa_35gONqqLRNAWhYJP/view?usp=sharing'
/** Nav「合约」— delegation vault source repo. */
export const LINK_CONTRACTS = 'https://github.com/CloudXiaoW/UMADelegationVault'

/** @deprecated Use `CHAIN_CONTRACTS[CHAIN_ENV]` in UI; kept for any external imports. */
export const PLACEHOLDER_VAULT = CHAIN_CONTRACTS.mainnet.stakeDelegationVault
export const PLACEHOLDER_UMA_V = CHAIN_CONTRACTS.mainnet.umaVaultShare
