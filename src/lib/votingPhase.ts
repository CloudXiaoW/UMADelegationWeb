import { CHAIN_CONTRACTS, CHAIN_ENV } from '@/config'

/** UMA DVM: one round = 2 days (commit 1d + reveal 1d). Phase length is on-chain in VoteTimingV2. */
export const VOTING_ROUND_LENGTH_SEC = 2 * 86_400
export const VOTING_PHASE_LENGTH_SEC = 86_400

/** `VotingAncillaryInterface.Phase`: Commit = 0, Reveal = 1. */
const PHASE_REVEAL = 1

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

let cachedReveal: boolean | null = null
let cacheExpiresAt = 0
const CACHE_TTL_MS = 30_000

let inFlight: Promise<boolean> | null = null

async function readVotePhaseIsReveal(): Promise<boolean | null> {
  const voting = CHAIN_CONTRACTS[CHAIN_ENV].votingV2
  if (!voting || voting.toLowerCase() === ZERO_ADDR) return null

  try {
    const { getOrCreateClient, getTargetChain } = await import('@/lib/thirdwebWallet')
    const { readContract, getContract } = await import('thirdweb')
    const contract = getContract({
      client: getOrCreateClient(),
      chain: getTargetChain(),
      address: voting,
    })
    const read = readContract as (args: {
      contract: typeof contract
      method: `function ${string}`
      params: unknown[]
    }) => Promise<unknown>
    const raw = await read({
      contract,
      method: 'function getVotePhase() view returns (uint8)',
      params: [],
    })
    const phase = typeof raw === 'bigint' ? Number(raw) : Number(raw)
    if (!Number.isFinite(phase)) return null
    return phase === PHASE_REVEAL
  } catch {
    return null
  }
}

/**
 * Whether the active UMA voting round is in the **reveal** phase (not commit).
 * Deposit share adjust bps applies only during reveal.
 */
export async function isVotingRevealPhase(): Promise<boolean> {
  const now = Date.now()
  if (cachedReveal !== null && now < cacheExpiresAt) {
    return cachedReveal
  }
  if (inFlight) return inFlight

  inFlight = (async () => {
    const reveal = await readVotePhaseIsReveal()
    cachedReveal = reveal ?? false
    cacheExpiresAt = Date.now() + CACHE_TTL_MS
    inFlight = null
    return cachedReveal
  })()

  return inFlight
}

/** Last cached reveal flag (null = not fetched yet). Used for sync stake previews. */
export function getCachedVotingRevealPhase(): boolean | null {
  if (Date.now() >= cacheExpiresAt) return null
  return cachedReveal
}

/** Force-refresh phase cache (e.g. on page refresh / wallet connect). */
export async function refreshVotingRevealPhaseCache(): Promise<boolean> {
  cacheExpiresAt = 0
  cachedReveal = null
  return isVotingRevealPhase()
}
