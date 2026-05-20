import { type Ref, ref, shallowRef, watch } from 'vue'
import { poolService } from '@/services/poolService'
import type { RedeemRequestView, UserPosition } from '@/types/pool'

export function useUserPortfolio(connected: Ref<boolean>) {
  const position = shallowRef<UserPosition | null>(null)
  const activeRedeem = shallowRef<RedeemRequestView | null>(null)
  const candidateRedeem = shallowRef<RedeemRequestView | null>(null)
  const redeemHistory = shallowRef<RedeemRequestView[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function refresh(): Promise<void> {
    if (!connected.value) {
      position.value = null
      activeRedeem.value = null
      candidateRedeem.value = null
      redeemHistory.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      const data = await poolService.refreshUser()
      position.value = data.position
      activeRedeem.value = data.activeRedeem
      candidateRedeem.value = data.candidateRedeem
      redeemHistory.value = data.redeemHistory
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'USER_ERROR'
    } finally {
      loading.value = false
    }
  }

  watch(
    connected,
    (ok) => {
      if (ok) void refresh()
      else {
        position.value = null
        activeRedeem.value = null
        candidateRedeem.value = null
        redeemHistory.value = []
      }
    },
    { immediate: true }
  )

  return { position, activeRedeem, candidateRedeem, redeemHistory, loading, error, refresh }
}
