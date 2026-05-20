<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import NavHistoryChart from '@/components/dashboard/NavHistoryChart.vue'
import { FEE_RULE_ACTUAL_PERCENT, FEE_RULE_NOMINAL_PERCENT, NAV_HISTORY_JSON_URL } from '@/config'
import { formatFeeRulePercent } from '@/format'
import type { NavHistoryPoint } from '@/types/navHistory'

const { t } = useI18n()

const chartPoints = ref<NavHistoryPoint[] | null>(null)
const chartLoading = ref(true)

const feeNominalPct = formatFeeRulePercent(FEE_RULE_NOMINAL_PERCENT)
const feeActualPct = formatFeeRulePercent(FEE_RULE_ACTUAL_PERCENT)

onMounted(async () => {
  try {
    const res = await fetch(NAV_HISTORY_JSON_URL)
    if (!res.ok) throw new Error(String(res.status))
    const data: unknown = await res.json()
    const raw =
      data && typeof data === 'object' && 'points' in data && Array.isArray((data as { points: unknown }).points)
        ? (data as { points: unknown[] }).points
        : []
    chartPoints.value = raw
      .map((p): NavHistoryPoint | null => {
        if (!p || typeof p !== 'object') return null
        const o = p as { label?: unknown; nav?: unknown }
        const label = o.label != null ? String(o.label) : ''
        const nav = Number(o.nav)
        if (!label || !Number.isFinite(nav)) return null
        return { label, nav }
      })
      .filter((x): x is NavHistoryPoint => x !== null)
  } catch {
    chartPoints.value = []
  } finally {
    chartLoading.value = false
  }
})
</script>

<template>
  <section class="section">
    <div class="yield-layout">
      <div class="card pad chart-card">
        <h2 class="h">{{ t('yieldCard.navChartTitle') }}</h2>
        <NavHistoryChart :points="chartPoints" :loading="chartLoading" />
      </div>
      <div class="yield-side">
        <div class="card pad side-card combined-card">
          <h2 class="h">{{ t('yieldCard.combinedTitle') }}</h2>
          <h3 class="subh">{{ t('yieldCard.yieldTitle') }}</h3>
          <p class="hint">{{ t('yieldCard.yieldBody') }}</p>
          <h3 class="subh subh-fee">{{ t('yieldCard.feeTitle') }}</h3>
          <p class="hint fee-rule-text">{{ t('yieldCard.feeBodyBeforeNominal') }}<span class="fee-nominal">{{ feeNominalPct }}%</span>{{ t('yieldCard.feeBodyBetweenNominalAndActual') }}<span class="fee-actual">{{ feeActualPct }}%</span>{{ t('yieldCard.feeBodyAfterActual') }}</p>
          <p class="hint fee-2">{{ t('yieldCard.feeSecondary') }}</p>
        </div>
      </div>
    </div>

    <div class="chips">
      <span class="chip">{{ t('yieldCard.chip1') }}</span>
      <span class="chip">{{ t('yieldCard.chip2') }}</span>
      <span class="chip">{{ t('yieldCard.chip3') }}</span>
      <span class="chip">{{ t('yieldCard.chip4') }}</span>
      <span class="chip">{{ t('yieldCard.chip5') }}</span>
      <span class="chip">{{ t('yieldCard.chip6') }}</span>
      <span class="chip">{{ t('yieldCard.chip7') }}</span>
      <span class="chip">{{ t('yieldCard.chip8') }}</span>
    </div>
  </section>
</template>

<style scoped>
.pad {
  padding: 16px 16px;
}
.yield-layout {
  display: grid;
  gap: 14px;
  align-items: stretch;
}
.chart-card,
.yield-side {
  min-width: 0;
}
.yield-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.side-card {
  flex: 1 1 auto;
}
.combined-card .subh {
  font-size: 14px;
  font-weight: 700;
  margin: 14px 0 6px;
  color: var(--text);
}
.combined-card .subh:first-of-type {
  margin-top: 4px;
}
.combined-card .subh-fee {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
@media (min-width: 900px) {
  .yield-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
.h {
  font-size: 16px;
  font-weight: 800;
  margin: 8px 0 8px;
  color: var(--accent-bright);
}
.fee-rule-text {
  line-height: 1.65;
}
.fee-nominal {
  font-size: 1.15em;
  font-weight: 800;
  color: #2563eb;
}
.fee-actual {
  font-size: 1.15em;
  font-weight: 800;
  color: #dc2626;
}
.fee-2 {
  margin-top: 10px;
  font-size: 12px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
</style>
