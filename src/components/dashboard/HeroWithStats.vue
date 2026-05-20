<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatNavDecimal } from '@/format'
import type { PoolMetrics } from '@/types/pool'

defineProps<{
  metrics: PoolMetrics | null
  loading: boolean
}>()

defineEmits<{
  scrollStake: []
  scrollPosition: []
}>()

const { t } = useI18n()

function feePctText(pct: number | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1)
}
</script>

<template>
  <section class="hero card">
    <div class="hero-bg">
      <div class="hero-inner">
        <h1>{{ t('hero.title') }}</h1>
        <p class="sub">{{ t('hero.subtitle') }}</p>
        <div class="cta">
          <button type="button" class="btn btn-primary" @click="$emit('scrollStake')">{{ t('hero.ctaStake') }}</button>
          <button type="button" class="btn btn-primary" @click="$emit('scrollPosition')">{{ t('hero.ctaPosition') }}</button>
        </div>
      </div>
      <div class="stat-row" style="margin-top: 18px">
        <div class="stat-card">
          <label>{{ t('stats.supplyTitle') }}</label>
          <div class="val mono">{{ loading && !metrics ? '—' : `${metrics?.totalSupplyUmaV ?? '—'} ${t('common.umaV')}` }}</div>
          <div class="sub">{{ t('stats.supplySub') }}</div>
        </div>
        <div class="stat-card">
          <label>{{ t('stats.assetsTitle') }}</label>
          <div class="val mono">{{ loading && !metrics ? '—' : `${metrics?.totalAssetsUma ?? '—'} ${t('common.uma')}` }}</div>
          <div class="sub">{{ t('stats.assetsSub') }}</div>
        </div>
        <div class="stat-card">
          <label>{{ t('stats.navTitle') }}</label>
          <div class="val mono">
            {{
              metrics
                ? `1 ${t('common.umaV')} = ${formatNavDecimal(metrics.navUmaPerShare)} ${t('common.uma')}`
                : '—'
            }}
          </div>
          <div class="sub">{{ t('stats.navSub') }}</div>
        </div>
        <div class="stat-card">
          <label>{{ t('stats.aprTitle') }}</label>
          <div class="val mono apr-val">
            {{
              loading && !metrics ? '—' : metrics ? `${feePctText(metrics.annualizedYieldPercent)} %` : '—'
            }}
          </div>
          <div class="sub">{{ t('stats.aprSub') }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  overflow: hidden;
  border: 1px solid var(--line);
}
.hero-bg {
  background: var(--bg-hero);
  padding: 22px 20px 20px;
}
.hero-inner h1 {
  font-size: clamp(24px, 4vw, 32px);
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.03em;
}
.sub {
  margin-top: 10px;
  max-width: 62ch;
  color: var(--muted);
  line-height: 1.55;
  font-size: 15px;
}
/* Hero 副标题单行不换行（英文长句）；窄屏可横向滚动 */
.hero-inner > .sub {
  max-width: none;
  white-space: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.cta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.stat-card .val.apr-val {
  color: #dc2626;
}
</style>
