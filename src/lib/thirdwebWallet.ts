import { createThirdwebClient, type ThirdwebClient } from 'thirdweb'
import { getContract, prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import type { Wallet } from 'thirdweb/wallets'
import { defineChain } from 'thirdweb/chains'
import { CHAIN_CONTRACTS, CHAIN_ENV } from '@/config'
import { parseUmaHumanToWei } from '@/lib/parseUmaAmount'
import type { WalletState } from '@/types/pool'

let client: ThirdwebClient | null = null
let activeWallet: Wallet | null = null

const listenerUnsubs: Array<() => void> = []

export const walletStateChangeTarget = new EventTarget()

function emitWalletChange(): void {
  walletStateChangeTarget.dispatchEvent(new Event('change'))
}

export function getOrCreateClient(): ThirdwebClient {
  const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID as string | undefined
  if (!clientId?.trim()) {
    throw new Error('THIRDWEB_CLIENT_ID_MISSING')
  }
  if (!client) {
    client = createThirdwebClient({ clientId: clientId.trim() })
  }
  return client
}

export function getTargetChain() {
  return defineChain(CHAIN_CONTRACTS[CHAIN_ENV].chainId)
}

function expectedChainId(): number {
  return CHAIN_CONTRACTS[CHAIN_ENV].chainId
}

function detachListeners(): void {
  for (const u of listenerUnsubs) {
    try {
      u()
    } catch {
      /* ignore */
    }
  }
  listenerUnsubs.length = 0
}

function pushSub(fn: (() => void) | void): void {
  if (typeof fn === 'function') listenerUnsubs.push(fn)
}

function attachListeners(w: Wallet): void {
  detachListeners()
  pushSub(
    w.subscribe('disconnect', () => {
      activeWallet = null
      detachListeners()
      emitWalletChange()
    }),
  )
  pushSub(
    w.subscribe('chainChanged', () => {
      emitWalletChange()
    }),
  )
  pushSub(
    w.subscribe('accountChanged', () => {
      emitWalletChange()
    }),
  )
}

/**
 * 由 React 桥（`useActiveWallet`）在自动重连 / 切换时同步当前活动钱包。
 */
export function applyActiveWalletFromBridge(w: Wallet | undefined): void {
  const next = w ?? null
  if (activeWallet === next) return
  detachListeners()
  activeWallet = next
  if (activeWallet) attachListeners(activeWallet)
  emitWalletChange()
}

export function getWalletState(): WalletState {
  const w = activeWallet
  if (!w) {
    return { connected: false, address: null, chainId: null, chainOk: false }
  }
  const acc = w.getAccount()
  const chain = w.getChain()
  if (!acc) {
    return { connected: false, address: null, chainId: null, chainOk: false }
  }
  const chainId = chain?.id != null ? Number(chain.id) : null
  return {
    connected: true,
    address: acc.address,
    chainId,
    chainOk: chainId === expectedChainId(),
  }
}

/**
 * 挂载 React 桥后由 `<AutoConnect />` 恢复上次连接；此处仅确保桥已初始化。
 */
export async function tryAutoReconnect(): Promise<void> {
  try {
    getOrCreateClient()
    const { mountThirdwebConnectRoot } = await import('./thirdwebConnectBridge')
    mountThirdwebConnectRoot()
  } catch {
    // 无 Client ID 等：保持未连接
  }
}

export async function connectWithThirdwebModal(): Promise<WalletState> {
  const { mountThirdwebConnectRoot, openThirdwebConnectModal } = await import('./thirdwebConnectBridge')
  mountThirdwebConnectRoot()
  const wallet = await openThirdwebConnectModal()
  applyActiveWalletFromBridge(wallet)
  return getWalletState()
}

export async function disconnectInjected(): Promise<void> {
  detachListeners()
  if (activeWallet) {
    await activeWallet.disconnect()
    activeWallet = null
  }
  emitWalletChange()
}

/**
 * UMA ERC20 `approve(StakeDelegationVault, amount)` — amount 为「Amount (UMA)」输入对应的 wei。
 */
export async function sendUmaApproveToStakeVault(amountHuman: string): Promise<string> {
  const w = activeWallet
  if (!w) throw new Error('WALLET_NOT_CONNECTED')
  const acc = w.getAccount()
  if (!acc) throw new Error('WALLET_NOT_CONNECTED')
  if (!getWalletState().chainOk) throw new Error('WRONG_NETWORK')

  const amountWei = parseUmaHumanToWei(amountHuman)
  if (amountWei === null || amountWei <= 0n) throw new Error('INVALID_AMOUNT')

  const cfg = CHAIN_CONTRACTS[CHAIN_ENV]
  const client = getOrCreateClient()
  const chain = getTargetChain()
  const contract = getContract({
    client,
    chain,
    address: cfg.umaToken,
  })

  const transaction = prepareContractCall({
    contract,
    method: 'function approve(address spender, uint256 amount)',
    params: [cfg.stakeDelegationVault, amountWei],
  })

  const receipt = await sendAndConfirmTransaction({
    account: acc,
    transaction,
  })
  return receipt.transactionHash
}

/**
 * `UmaDelegationVault.deposit(assets, receiver)` — assets 为输入 UMA 数量（wei），receiver 为当前连接账户。
 */
export async function sendUmaDelegationVaultDeposit(amountHuman: string): Promise<string> {
  const w = activeWallet
  if (!w) throw new Error('WALLET_NOT_CONNECTED')
  const acc = w.getAccount()
  if (!acc) throw new Error('WALLET_NOT_CONNECTED')
  if (!getWalletState().chainOk) throw new Error('WRONG_NETWORK')

  const assetsWei = parseUmaHumanToWei(amountHuman)
  if (assetsWei === null || assetsWei <= 0n) throw new Error('INVALID_AMOUNT')

  const cfg = CHAIN_CONTRACTS[CHAIN_ENV]
  const client = getOrCreateClient()
  const chain = getTargetChain()
  const contract = getContract({
    client,
    chain,
    address: cfg.stakeDelegationVault,
  })

  const transaction = prepareContractCall({
    contract,
    method: 'function deposit(uint256 assets, address receiver)',
    params: [assetsWei, acc.address],
  })

  const receipt = await sendAndConfirmTransaction({
    account: acc,
    transaction,
  })
  return receipt.transactionHash
}

/**
 * `UmaDelegationVault.requestRedeem(shares, receiver)` — shares 为 UMA-V 数量（wei），receiver 为当前连接账户。
 */
export async function sendUmaDelegationVaultRequestRedeem(umaVAmountHuman: string): Promise<string> {
  const w = activeWallet
  if (!w) throw new Error('WALLET_NOT_CONNECTED')
  const acc = w.getAccount()
  if (!acc) throw new Error('WALLET_NOT_CONNECTED')
  if (!getWalletState().chainOk) throw new Error('WRONG_NETWORK')

  const sharesWei = parseUmaHumanToWei(umaVAmountHuman)
  if (sharesWei === null || sharesWei <= 0n) throw new Error('INVALID_AMOUNT')

  const cfg = CHAIN_CONTRACTS[CHAIN_ENV]
  const client = getOrCreateClient()
  const chain = getTargetChain()
  const contract = getContract({
    client,
    chain,
    address: cfg.stakeDelegationVault,
  })

  const transaction = prepareContractCall({
    contract,
    method: 'function requestRedeem(uint256 shares, address receiver)',
    params: [sharesWei, acc.address],
  })

  const receipt = await sendAndConfirmTransaction({
    account: acc,
    transaction,
  })
  return receipt.transactionHash
}

/**
 * `UmaDelegationVault.claimRedeem(requestSender)` — caller must be `requestSender` or `receiver`.
 */
export async function sendUmaDelegationVaultClaimRedeem(): Promise<string> {
  const w = activeWallet
  if (!w) throw new Error('WALLET_NOT_CONNECTED')
  const acc = w.getAccount()
  if (!acc) throw new Error('WALLET_NOT_CONNECTED')
  if (!getWalletState().chainOk) throw new Error('WRONG_NETWORK')

  const cfg = CHAIN_CONTRACTS[CHAIN_ENV]
  const client = getOrCreateClient()
  const chain = getTargetChain()
  const contract = getContract({
    client,
    chain,
    address: cfg.stakeDelegationVault,
  })

  const transaction = prepareContractCall({
    contract,
    method: 'function claimRedeem(address requestSender)',
    params: [acc.address],
  })

  const receipt = await sendAndConfirmTransaction({
    account: acc,
    transaction,
  })
  return receipt.transactionHash
}

/**
 * `UmaDelegationVault.triggerRequestUnstake()` — no parameters; the vault selects proxy
 * and batches redeems internally. Callers do not pass or choose a proxy address.
 */
export async function sendUmaDelegationVaultTriggerRequestUnstake(): Promise<string> {
  const w = activeWallet
  if (!w) throw new Error('WALLET_NOT_CONNECTED')
  const acc = w.getAccount()
  if (!acc) throw new Error('WALLET_NOT_CONNECTED')
  if (!getWalletState().chainOk) throw new Error('WRONG_NETWORK')

  const cfg = CHAIN_CONTRACTS[CHAIN_ENV]
  const client = getOrCreateClient()
  const chain = getTargetChain()
  const contract = getContract({
    client,
    chain,
    address: cfg.stakeDelegationVault,
  })

  const transaction = prepareContractCall({
    contract,
    method: 'function triggerRequestUnstake()',
    params: [],
  })

  const receipt = await sendAndConfirmTransaction({
    account: acc,
    transaction,
  })
  return receipt.transactionHash
}
