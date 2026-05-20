import { useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AutoConnect, ThirdwebProvider, useActiveWallet, useConnectModal } from 'thirdweb/react'
import type { UseConnectModalOptions } from 'thirdweb/react'
import type { Wallet } from 'thirdweb/wallets'
import { CONNECT_WALLET_LIST } from './connectWallets'
import { applyActiveWalletFromBridge, getOrCreateClient, getTargetChain } from './thirdwebWallet'

let root: Root | null = null
let connectModalFn: ((opts: UseConnectModalOptions) => Promise<Wallet>) | null = null

function ConnectModalRegistry() {
  const { connect } = useConnectModal()
  useEffect(() => {
    connectModalFn = connect
    return () => {
      connectModalFn = null
    }
  }, [connect])
  return null
}

function WalletSync() {
  const w = useActiveWallet()
  useEffect(() => {
    applyActiveWalletFromBridge(w)
  }, [w])
  return null
}

export function mountThirdwebConnectRoot(): void {
  if (root) return
  const container = document.getElementById('thirdweb-bridge-root')
  if (!container) return

  let twClient: ReturnType<typeof getOrCreateClient>
  try {
    twClient = getOrCreateClient()
  } catch {
    return
  }

  const chain = getTargetChain()
  root = createRoot(container)
  root.render(
    <ThirdwebProvider>
      <AutoConnect client={twClient} chain={chain} wallets={CONNECT_WALLET_LIST} />
      <ConnectModalRegistry />
      <WalletSync />
    </ThirdwebProvider>,
  )
}

async function waitForConnectModalReady(deadlineMs: number): Promise<void> {
  const deadline = Date.now() + deadlineMs
  while (!connectModalFn && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 32))
  }
}

export async function openThirdwebConnectModal(): Promise<Wallet> {
  getOrCreateClient()
  mountThirdwebConnectRoot()
  await waitForConnectModalReady(8000)
  if (!connectModalFn) {
    throw new Error('THIRDWEB_CONNECT_BRIDGE_NOT_READY')
  }
  const client = getOrCreateClient()
  const chain = getTargetChain()
  return connectModalFn({
    client,
    chain,
    chains: [chain],
    wallets: CONNECT_WALLET_LIST,
    /** 仅展示上方列表，不显示「浏览全部钱包」及 In-App 入口 */
    showAllWallets: false,
  })
}
