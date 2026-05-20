import { createWallet } from 'thirdweb/wallets'
import type { Wallet } from 'thirdweb/wallets'

/**
 * 连接弹窗中展示的钱包（与产品图一致）：浏览器扩展 + WalletConnect + 硬件钱包。
 * 不包含 In-App / 邮箱 / 社交登录（thirdweb 内置账户）。
 */
export const CONNECT_WALLET_LIST: Wallet[] = [
  createWallet('io.metamask'),
  createWallet('walletConnect'),
  createWallet('com.coinbase.wallet'),
  createWallet('com.ledger'),
  createWallet('io.trezor'),
]
