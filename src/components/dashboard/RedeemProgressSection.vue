<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatRemainingDurationHMS } from '@/format'
import { buildRedeemTimeline, type TimelineRow } from '@/composables/useRedeemTimeline'
import { isRedeemPastClaimableTime } from '@/lib/redeemClaimWindow'
import type { RedeemRequestView } from '@/types/pool'

const props = defineProps<{
  active: RedeemRequestView | null
  candidate: RedeemRequestView | null
  history: RedeemRequestView[]
  busy: 'idle' | 'approve' | 'stake' | 'redeem' | 'claim' | 'triggerUnstake'
}>()

const emit = defineEmits<{
  claim: [id: string]
  triggerUnstake: []
}>()

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

const { t } = useI18n()

/** Wall-clock second bucket; drives countdown text so it updates every second. */
const nowSec = ref(Math.floor(Date.now() / 1000))

function redeemNeedsSecondClock(a: RedeemRequestView): boolean {
  if (a.currentStep === 'claimed') return false
  if (a.canClaimByLiquidityNoUnstake) return false
  if (a.currentStep === 'waiting_liquidity') {
    const t0 = a.unstakeReadyTimestampSec
    if (t0 != null && Number.isFinite(t0)) return true
  }
  const ts = a.claimableTimeTimestampSec
  if (ts != null && Number.isFinite(ts) && ts > 0 && nowSec.value < ts) return true
  return false
}

const needsSecondClock = computed(() => {
  const a = props.active
  if (!a) return false
  return redeemNeedsSecondClock(a)
})

let countdownId: ReturnType<typeof setInterval> | undefined

function syncNowSec(): void {
  nowSec.value = Math.floor(Date.now() / 1000)
}

const canClaimUma = computed(() => {
  const a = props.active
  if (!a) return false
  return isRedeemPastClaimableTime(a, nowSec.value)
})

watch(
  needsSecondClock,
  (run) => {
    if (countdownId !== undefined) {
      clearInterval(countdownId)
      countdownId = undefined
    }
    if (!run) return
    syncNowSec()
    countdownId = setInterval(syncNowSec, 1000)
  },
  { immediate: true }
)

function onVisibility(): void {
  if (typeof document === 'undefined') return
  if (document.visibilityState === 'visible' && needsSecondClock.value) {
    syncNowSec()
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', onVisibility)
}

onUnmounted(() => {
  if (countdownId !== undefined) clearInterval(countdownId)
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibility)
  }
})

function textForTimelineRow(row: TimelineRow, active: RedeemRequestView, currentSec: number): string {
  if (
    row.step === 'waiting_liquidity' &&
    row.active &&
    active.unstakeReadyTimestampSec != null &&
    Number.isFinite(active.unstakeReadyTimestampSec)
  ) {
    const readyAt = active.unstakeReadyTimestampSec
    const duration =
      readyAt <= currentSec ? '0' : formatRemainingDurationHMS(readyAt - currentSec)
    return t('moduleE.steps.waiting_liquidity_eta', { duration })
  }
  if (
    row.step === 'cooldown' &&
    row.active &&
    active.claimableTimeTimestampSec != null &&
    Number.isFinite(active.claimableTimeTimestampSec) &&
    active.claimableTimeTimestampSec > 0
  ) {
    const end = active.claimableTimeTimestampSec
    const remaining = Math.max(0, end - currentSec)
    const duration = formatRemainingDurationHMS(remaining)
    return t('moduleE.steps.cooldown_eta', { duration })
  }
  return t(`moduleE.steps.${row.labelKey}`)
}

function showWaitingLiquidityEtaHint(row: TimelineRow, active: RedeemRequestView): boolean {
  return (
    row.step === 'waiting_liquidity' &&
    row.active &&
    active.unstakeReadyTimestampSec != null &&
    Number.isFinite(active.unstakeReadyTimestampSec)
  )
}

/**
 * 第三格「unstake_triggered」：在 `waiting_liquidity` 期间一律用「触发底层赎回」按钮替代「已触发底层赎回」文案；
 * 离开该阶段后，仅在已到 ready 时间且 proxy 仍为空时显示可点按钮（与链上一致）。
 */
function shouldShowUnstakeTriggerButtonUi(row: TimelineRow, req: RedeemRequestView, currentSec: number): boolean {
  if (req.canClaimByLiquidityNoUnstake) return false
  if (row.step !== 'unstake_triggered') return false
  if (req.currentStep === 'waiting_liquidity') return true
  if (!row.active) return false
  if (req.unstakeReadyTimestampSec == null || !Number.isFinite(req.unstakeReadyTimestampSec)) return false
  if (currentSec < req.unstakeReadyTimestampSec) return false
  const p = (req.proxyAddress ?? ZERO_ADDR).toLowerCase()
  return p === ZERO_ADDR
}

/** 等待池内流动性阶段：未到 ready 时间则禁用；其它情况仅受 busy 影响（在模板中与 busy 合并）。 */
function isUnstakeTriggerButtonDisabledByLiquidity(row: TimelineRow, req: RedeemRequestView, currentSec: number): boolean {
  if (row.step !== 'unstake_triggered') return true
  if (req.currentStep !== 'waiting_liquidity') return false
  const t0 = req.unstakeReadyTimestampSec
  if (t0 == null || !Number.isFinite(t0)) return true
  return currentSec < t0
}

function unstakeTriggerCountdownText(req: RedeemRequestView, currentSec: number): string | null {
  const t0 = req.unstakeReadyTimestampSec
  if (t0 == null || !Number.isFinite(t0)) return null
  if (t0 <= currentSec) return null
  return formatRemainingDurationHMS(t0 - currentSec)
}

/** 「已触发底层赎回」文案展示且应视为已完成时，使用与 `.done` 相同的绿色底（避免仍带 active+t-wait 黄底）。 */
function shouldShowUnstakeDoneGreen(row: TimelineRow, showTriggerUi: boolean, req: RedeemRequestView): boolean {
  if (row.step !== 'unstake_triggered' || showTriggerUi) return false
  if (row.done) return true
  const p = (req.proxyAddress ?? ZERO_ADDR).toLowerCase()
  return p !== ZERO_ADDR
}

const timelineNodes = computed(() => {
  const sec = nowSec.value
  const active = props.active
  if (!active) return []
  return buildRedeemTimeline(active, sec).map((row) => {
    const showTriggerUi = shouldShowUnstakeTriggerButtonUi(row, active, sec)
    const unstakeGreen = shouldShowUnstakeDoneGreen(row, showTriggerUi, active)
    const triggerDisabledByLiquidity = isUnstakeTriggerButtonDisabledByLiquidity(row, active, sec)
    return {
      row,
      text: textForTimelineRow(row, active, sec),
      showLiquidityEtaHint: showWaitingLiquidityEtaHint(row, active),
      showTriggerUnstake: showTriggerUi,
      triggerDisabledByLiquidity,
      unstakeGreen,
    }
  })
})

function toneClass(row: TimelineRow): string {
  if (!row.active) return ''
  if (row.tone === 'wait') return 't-wait'
  if (row.tone === 'cool') return 't-cool'
  if (row.tone === 'ok') return 't-ok'
  return ''
}
</script>

<template>
  <section id="section-redeem" class="section">
    <h2 class="section-title">{{ t('progress.title') }}</h2>

    <div v-if="!active && !candidate" class="card pad muted-box">
      {{ t('position.statusNone') }}
    </div>

    <div v-else-if="active" class="card pad">
      <div class="metrics-row">
        <div class="cell">
          <div class="hint">{{ t('progress.claimable') }}</div>
          <div class="mono val-em">{{ active.assetsToClaim }} {{ t('common.uma') }}</div>
        </div>
        <div class="cell">
          <div class="hint">{{ t('progress.burned') }}</div>
          <div class="mono">{{ active.burnedShares }} {{ t('common.umaV') }}</div>
        </div>
        <div class="cell">
          <div class="hint">{{ t('progress.requestedAt') }}</div>
          <div class="mono">{{ active.requestTime ?? '—' }}</div>
        </div>
        <div class="cell">
          <div class="hint">{{ t('progress.eta') }}</div>
          <div class="mono">{{ active.claimableTime ?? '—' }}</div>
        </div>
      </div>

      <div class="timeline5 timeline-arrow">
        <div
          v-for="item in timelineNodes"
          :key="`${active.id}-${item.row.step}`"
          class="tl-node"
          :class="[
            item.unstakeGreen ? '' : toneClass(item.row),
            {
              done: item.row.done || item.unstakeGreen,
              active: item.row.active && !item.unstakeGreen,
              'tl-node--unstake-trigger': item.showTriggerUnstake,
            },
          ]"
        >
          <span v-if="item.showTriggerUnstake" class="tl-node__text tl-node__text--btn">
            <button
              type="button"
              class="btn-tl-unstake"
              :disabled="item.triggerDisabledByLiquidity || busy !== 'idle'"
              @click.stop="emit('triggerUnstake')"
            >
              {{
                busy === 'triggerUnstake'
                  ? t('progress.triggerUnstakeSubmitting')
                  : t('progress.triggerUnstake')
              }}
            </button>
            <span
              v-if="active && item.triggerDisabledByLiquidity"
              class="tl-unstake-countdown mono"
              style="margin-left: 6px"
            >
              {{ unstakeTriggerCountdownText(active, nowSec) ?? '' }}
            </span>
          </span>
          <span v-else class="tl-node__text" :class="{ 'tl-node__text--row': item.showLiquidityEtaHint }">
            <span class="tl-node__text-main">{{ item.text }}</span>
            <span
              v-if="item.showLiquidityEtaHint"
              class="tl-liquidity-hint"
              tabindex="0"
              role="img"
              :aria-label="t('moduleE.steps.waiting_liquidity_eta_tooltip')"
              :data-tooltip="t('moduleE.steps.waiting_liquidity_eta_tooltip')"
            >
              <svg class="tl-liquidity-hint__svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.25" />
                <path
                  fill="currentColor"
                  d="M8 4.35a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7zm-.5 2.65h1v5h-1v-5z"
                />
              </svg>
            </span>
          </span>
        </div>
      </div>

      <div class="row-actions">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="!canClaimUma || busy !== 'idle'"
          @click="emit('claim', active.id)"
        >
          {{ busy === 'claim' ? t('progress.claiming') : t('progress.claim') }}
        </button>
        <span v-if="active.currentStep === 'claimed'" class="muted">{{ t('progress.claimed') }}</span>
      </div>
    </div>

    <div v-if="candidate" class="card pad candidate-redeem-card">
      <h3 class="candidate-title">{{ t('progress.candidateTitle') }}</h3>
      <p class="hint candidate-hint">{{ t('progress.candidateHint') }}</p>
      <div class="metrics-row">
        <div class="cell">
          <div class="hint">{{ t('progress.claimable') }}</div>
          <div class="mono val-em">{{ candidate.assetsToClaim }} {{ t('common.uma') }}</div>
        </div>
        <div class="cell">
          <div class="hint">{{ t('progress.burned') }}</div>
          <div class="mono">{{ candidate.burnedShares }} {{ t('common.umaV') }}</div>
        </div>
        <div class="cell">
          <div class="hint">{{ t('progress.requestedAt') }}</div>
          <div class="mono">{{ candidate.requestTime ?? '—' }}</div>
        </div>
        <div class="cell">
          <div class="hint">{{ t('progress.eta') }}</div>
          <div class="mono">{{ candidate.claimableTime ?? '—' }}</div>
        </div>
      </div>
    </div>

    <details v-if="history.length" class="hist card pad">
      <summary>
        <strong>{{ t('progress.history') }}</strong>
        <span class="hint"> — {{ t('progress.historyHint') }}</span>
      </summary>
      <table>
        <thead>
          <tr>
            <th>{{ t('progress.thTime') }}</th>
            <th>{{ t('progress.thBurned') }}</th>
            <th>{{ t('progress.thClaim') }}</th>
            <th>{{ t('progress.thStatus') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in history" :key="h.id">
            <td class="mono">{{ h.requestTime ?? '—' }}</td>
            <td class="mono">{{ h.burnedShares }}</td>
            <td class="mono">{{ h.assetsToClaim }}</td>
            <td>{{ h.currentStep === 'claimed' ? t('progress.claimed') : h.currentStep }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </section>
</template>

<style scoped>
.pad {
  padding: 16px;
}
.muted-box {
  padding: 14px;
  color: var(--muted);
  font-weight: 600;
}
.candidate-redeem-card {
  margin-top: 14px;
  border: 1px dashed var(--line-strong);
}
.candidate-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 800;
}
.candidate-hint {
  margin: 0 0 12px;
  line-height: 1.45;
}
.candidate-status-line {
  margin: 12px 0 0;
}
.metrics-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 12px;
  align-items: start;
}
.cell .hint {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}
.cell .mono {
  font-size: 15px;
  line-height: 1.35;
  word-break: break-word;
}
.val-em {
  font-size: 18px;
  font-weight: 800;
  color: var(--accent-bright);
}
@media (max-width: 900px) {
  .metrics-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 420px) {
  .metrics-row {
    grid-template-columns: 1fr;
  }
}

/* 向右箭头形（平行四边形），表示步骤依次推进 */
.timeline-arrow {
  gap: 6px;
}
.timeline-arrow .tl-node {
  flex: 1 1 100px;
  transform: skewX(-18deg);
  border-radius: 5px;
  padding-left: 12px;
  padding-right: 12px;
  overflow: visible;
}
.timeline-arrow .tl-node__text {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  transform: skewX(18deg);
  min-height: 100%;
  line-height: 1.3;
}
.timeline-arrow .tl-node__text--row {
  flex-wrap: nowrap;
  gap: 4px;
  max-width: 100%;
}
.timeline-arrow .tl-node__text-main {
  min-width: 0;
  overflow-wrap: anywhere;
}
.timeline-arrow .tl-liquidity-hint {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  cursor: default;
  line-height: 1;
  outline: none;
}
.timeline-arrow .tl-liquidity-hint::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: min(280px, 72vw);
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  text-align: left;
  white-space: normal;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.12);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  z-index: 80;
  transition: opacity 0.06s ease-out, visibility 0.06s ease-out;
  transition-delay: 0s;
}
.timeline-arrow .tl-liquidity-hint:hover::after,
.timeline-arrow .tl-liquidity-hint:focus-visible::after {
  opacity: 1;
  visibility: visible;
}
.timeline-arrow .tl-liquidity-hint:focus-visible {
  box-shadow: 0 0 0 2px var(--accent-bright);
  border-radius: 50%;
}
.timeline-arrow .tl-liquidity-hint__svg {
  width: 15px;
  height: 15px;
  display: block;
}
/* 与 global `.tl-node.done` 一致：箭头形时间线里已完成阶段也用绿色底 */
.timeline-arrow .tl-node.done {
  background: var(--timeline-done-bg);
  border-color: var(--timeline-done-border);
  color: var(--timeline-done-text);
}
.timeline-arrow .tl-node.tl-node--unstake-trigger.active {
  background: var(--surface);
  border-color: var(--line);
  box-shadow: none;
}
.timeline-arrow .tl-node.tl-node--unstake-trigger.active.t-wait {
  color: var(--text);
}
.timeline-arrow .tl-node__text--btn {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.btn-tl-unstake {
  width: max-content;
  max-width: 100%;
  white-space: nowrap;
  border: 0;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.25;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(180deg, var(--accent-bright) 0%, var(--accent-dim) 100%);
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.35);
}
.btn-tl-unstake:hover:not(:disabled) {
  filter: brightness(1.05);
}
.btn-tl-unstake:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.hist summary {
  cursor: pointer;
  list-style: none;
}
.hist summary::-webkit-details-marker {
  display: none;
}
.row-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}
.hist {
  margin-top: 12px;
}
.hist table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
  font-size: 13px;
}
.hist th,
.hist td {
  text-align: left;
  padding: 8px 6px;
  border-bottom: 1px solid var(--line);
}
.hist th {
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
}
</style>
