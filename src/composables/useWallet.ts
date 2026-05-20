import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  connectWithThirdwebModal,
  disconnectInjected,
  getWalletState,
  tryAutoReconnect,
  walletStateChangeTarget,
} from '@/lib/thirdwebWallet'
import { setPoolWalletContext } from '@/services/poolService'
import type { WalletState } from '@/types/pool'

export function useWallet() {
  const { t } = useI18n()
  const wallet = shallowRef<WalletState | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function syncFromThirdweb(): void {
    const s = getWalletState()
    wallet.value = s
    setPoolWalletContext(s.connected && s.chainOk, s.address)
  }

  function mapConnectError(e: unknown): string {
    if (e instanceof Error && e.message === 'THIRDWEB_CLIENT_ID_MISSING') {
      return t('errors.THIRDWEB_CLIENT_ID')
    }
    if (e instanceof Error && e.message === 'THIRDWEB_CONNECT_BRIDGE_NOT_READY') {
      return t('errors.THIRDWEB_BRIDGE')
    }
    // thirdweb 关闭弹窗时 Promise 可能无明确 reason
    if (e === undefined || e === null || (e instanceof Error && e.message === '')) {
      return t('errors.CONNECT_CANCELLED')
    }
    return e instanceof Error ? e.message : 'CONNECT_ERROR'
  }

  async function refresh(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await tryAutoReconnect()
      syncFromThirdweb()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'WALLET_ERROR'
    } finally {
      loading.value = false
    }
  }

  async function connect(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await connectWithThirdwebModal()
      syncFromThirdweb()
    } catch (e) {
      error.value = mapConnectError(e)
    } finally {
      loading.value = false
    }
  }

  async function disconnect(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await disconnectInjected()
      syncFromThirdweb()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'DISCONNECT_ERROR'
    } finally {
      loading.value = false
    }
  }

  function onThirdwebEvent(): void {
    syncFromThirdweb()
  }

  onMounted(() => {
    walletStateChangeTarget.addEventListener('change', onThirdwebEvent)
    void refresh()
  })

  onUnmounted(() => {
    walletStateChangeTarget.removeEventListener('change', onThirdwebEvent)
  })

  return { wallet, loading, error, refresh, connect, disconnect }
}
