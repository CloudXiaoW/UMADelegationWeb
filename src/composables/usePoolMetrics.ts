import { onMounted, ref, shallowRef } from 'vue'
import { poolService } from '@/services/poolService'
import type { PoolMetrics } from '@/types/pool'

export function usePoolMetrics() {
  const metrics = shallowRef<PoolMetrics | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function refresh(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      metrics.value = await poolService.refreshMetrics()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'METRICS_ERROR'
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void refresh()
  })

  return { metrics, loading, error, refresh }
}
