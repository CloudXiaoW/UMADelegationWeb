<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DISCORD_INVITE_URL } from '@/config'
import { formatNavDecimal } from '@/format'
import { useClipboard } from '@/composables/useClipboard'
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
const discordOpen = ref(false)
const { copy, copied } = useClipboard()

function openDiscordModal(): void {
  discordOpen.value = true
}

function closeDiscordModal(): void {
  discordOpen.value = false
}

async function onCopyInvite(): Promise<void> {
  await copy(DISCORD_INVITE_URL)
}

function onOpenInvite(): void {
  window.open(DISCORD_INVITE_URL, '_blank', 'noopener,noreferrer')
}

function onDocumentKeydown(ev: KeyboardEvent): void {
  if (!discordOpen.value) return
  if (ev.key === 'Escape') discordOpen.value = false
}

onMounted(() => {
  document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
})

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
          <div class="cta-left">
            <button type="button" class="btn btn-primary" @click="$emit('scrollStake')">{{ t('hero.ctaStake') }}</button>
            <button type="button" class="btn btn-primary" @click="$emit('scrollPosition')">{{ t('hero.ctaPosition') }}</button>
          </div>
          <button type="button" class="btn btn-discord" @click="openDiscordModal">{{ t('hero.ctaDiscord') }}</button>
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

    <div v-if="discordOpen" class="discord-backdrop" role="dialog" aria-modal="true" @click.self="closeDiscordModal">
      <div class="discord-modal card">
        <div class="discord-title">{{ t('hero.discordModalTitle') }}</div>
        <div class="discord-sub">{{ t('hero.discordModalSubtitle') }}</div>
        <div class="discord-link-row">
          <input class="input mono discord-input" :value="DISCORD_INVITE_URL" readonly />
        </div>
        <div class="discord-actions">
          <button type="button" class="btn" @click="closeDiscordModal">{{ t('hero.discordClose') }}</button>
          <button type="button" class="btn" @click="onCopyInvite">
            {{ copied ? t('hero.discordCopied') : t('hero.discordCopy') }}
          </button>
          <button type="button" class="btn btn-discord" @click="onOpenInvite">{{ t('hero.discordOpen') }}</button>
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
  align-items: center;
}
.cta-left {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.btn-discord {
  margin-left: auto;
  background: #5865f2;
  border-color: rgba(88, 101, 242, 0.55);
  color: #ffffff;
}
.btn-discord:hover:not(:disabled) {
  background: #4752c4;
  border-color: rgba(71, 82, 196, 0.65);
  color: #ffffff;
}
.discord-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}
.discord-modal {
  width: min(560px, 100%);
  padding: 16px;
}
.discord-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.02em;
}
.discord-sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--muted);
}
.discord-link-row {
  margin-top: 12px;
}
.discord-input {
  font-size: 13px;
}
.discord-actions {
  margin-top: 14px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.stat-card .val.apr-val {
  color: #dc2626;
}
</style>
