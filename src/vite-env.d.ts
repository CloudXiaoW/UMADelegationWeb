/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Annualized yield % for hero stats (e.g. `8.5`). */
  readonly VITE_ANNUALIZED_YIELD_PERCENT?: string
  /** Nominal fee % (blue) in yield section fee rule text. */
  readonly VITE_FEE_RULE_NOMINAL_PERCENT?: string
  /** Actual effective fee % (red) in yield section fee rule text. */
  readonly VITE_FEE_RULE_ACTUAL_PERCENT?: string
  /** Active chain env for on-chain reads (`mainnet` | `sepolia`). */
  readonly VITE_CHAIN_ENV?: string
  /** RPC URL for Ethereum mainnet reads. */
  readonly VITE_MAINNET_RPC_URL?: string
  /** RPC URL for Sepolia reads. */
  readonly VITE_SEPOLIA_RPC_URL?: string
  /** Sepolia UMA ERC20 token address (optional override). */
  readonly VITE_SEPOLIA_UMA_TOKEN?: `0x${string}`
  /** Mainnet UMA ERC20 token address (optional override). */
  readonly VITE_MAINNET_UMA_TOKEN?: `0x${string}`
  /** Mainnet UmaVaultShare contract address. */
  readonly VITE_MAINNET_UMA_VAULT_SHARE?: `0x${string}`
  /** Mainnet StakeDelegationVault contract address. */
  readonly VITE_MAINNET_STAKE_DELEGATION_VAULT?: `0x${string}`
  /** Sepolia VotingV2 contract address (optional override). */
  readonly VITE_SEPOLIA_VOTING_V2?: `0x${string}`
  /** Mainnet VotingV2 contract address (optional override). */
  readonly VITE_MAINNET_VOTING_V2?: `0x${string}`
  /** Deposit: basis points deducted from displayed vault shares during reveal phase only (0–10000). */
  readonly VITE_DEPOSIT_SHARE_ADJUST_BPS?: string
  /** thirdweb Client ID (browser / Connect); create at https://thirdweb.com/create-api-key */
  readonly VITE_THIRDWEB_CLIENT_ID?: string
}
