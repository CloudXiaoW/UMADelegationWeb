<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseUmaHumanToWei } from '@/lib/parseUmaAmount'
import type { StakeLimits, UserPosition } from '@/types/pool'

const props = defineProps<{
  connected: boolean
  position: UserPosition | null
  navText: string
  limits: StakeLimits | null
  stakeAmount: string
  stakePreview: string
  redeemAmount: string
  redeemPreview: string
  umaApproved: boolean
  canStake: boolean
  canRequestRedeem: boolean
  hasActiveRedeem: boolean
  busy: 'idle' | 'approve' | 'stake' | 'redeem' | 'claim'
  formError: string | null
}>()

const emit = defineEmits<{
  'update:stakeAmount': [v: string]
  'update:redeemAmount': [v: string]
  approve: []
  stake: []
  redeem: []
  stakePct: [pct: 25 | 50 | 100]
  redeemPct: [pct: 25 | 50 | 100]
}>()

const { t } = useI18n()

const err = computed(() => {
  if (!props.formError) return null
  if (props.formError === 'ACTIVE_REDEEM_EXISTS') return t('errors.ACTIVE_REDEEM_EXISTS')
  if (props.formError === 'WRONG_NETWORK') return t('errors.WRONG_NETWORK')
  if (props.formError === 'WALLET_NOT_CONNECTED') return t('errors.WALLET_NOT_CONNECTED')
  if (props.formError === 'INVALID_AMOUNT') return t('errors.INVALID_AMOUNT')
  if (props.formError === 'STAKE_OUT_OF_RANGE') {
    if (props.limits) {
      return t('errors.STAKE_OUT_OF_RANGE', {
        min: props.limits.minStake,
        max: props.limits.maxStake,
      })
    }
    return t('errors.STAKE_LIMITS_UNAVAILABLE')
  }
  if (props.formError === 'STAKE_EXCEEDS_BALANCE') {
    return t('errors.STAKE_EXCEEDS_BALANCE', {
      balance: props.position?.umaWalletBalance ?? '—',
    })
  }
  if (props.formError === 'STAKE_LIMITS_UNAVAILABLE') return t('errors.STAKE_LIMITS_UNAVAILABLE')
  if (props.formError === 'REDEEM_OUT_OF_RANGE') {
    if (props.limits) {
      return t('errors.REDEEM_OUT_OF_RANGE', {
        min: props.limits.minRedeem,
        max: props.limits.maxRedeem,
      })
    }
    return t('errors.REDEEM_LIMITS_UNAVAILABLE')
  }
  if (props.formError === 'REDEEM_EXCEEDS_BALANCE') {
    return t('errors.REDEEM_EXCEEDS_BALANCE', {
      balance: props.position?.umaVBalance ?? '—',
    })
  }
  if (props.formError === 'REDEEM_INVALID_AMOUNT') return t('errors.REDEEM_INVALID_AMOUNT')
  if (props.formError === 'REDEEM_LIMITS_UNAVAILABLE') return t('errors.REDEEM_LIMITS_UNAVAILABLE')
  if (props.formError === 'NOT_CLAIMABLE') return t('errors.NOT_CLAIMABLE')
  if (props.formError === 'INVALID_REQUEST') return t('errors.INVALID_REQUEST')
  return props.formError
})

const stakeDisabled = computed(
  () => !props.connected || props.busy !== 'idle' || !props.canStake || !props.umaApproved
)
const approveDisabled = computed(
  () => !props.connected || props.busy !== 'idle' || !props.canStake || props.umaApproved
)
const redeemDisabled = computed(
  () => !props.connected || props.busy !== 'idle' || !props.canRequestRedeem || props.hasActiveRedeem
)

/** Live hint: stake amount non-empty but invalid or outside min/max UMA (approve/stake disabled). */
const stakeRangeHint = computed(() => {
  if (!props.connected || !props.limits) return null
  const raw = props.stakeAmount.replace(/,/g, '').trim()
  if (!raw) return null
  const w = parseUmaHumanToWei(raw)
  if (w === null || w <= 0n) {
    return t('errors.INVALID_AMOUNT')
  }
  const minW = parseUmaHumanToWei(props.limits.minStake)
  const maxW = parseUmaHumanToWei(props.limits.maxStake)
  if (minW === null || maxW === null) {
    return t('errors.STAKE_LIMITS_UNAVAILABLE')
  }
  if (w < minW || w > maxW) {
    return t('errors.STAKE_OUT_OF_RANGE', {
      min: props.limits.minStake,
      max: props.limits.maxStake,
    })
  }
  const balanceHuman = props.position?.umaWalletBalance
  if (balanceHuman) {
    const balanceWei = parseUmaHumanToWei(balanceHuman)
    if (balanceWei !== null && w > balanceWei) {
      return t('errors.STAKE_EXCEEDS_BALANCE', { balance: balanceHuman })
    }
  }
  return null
})

/** Live hint when input is non-empty but outside min/max or not a valid positive amount (button is disabled). */
const redeemRangeHint = computed(() => {
  if (!props.connected || !props.limits || props.hasActiveRedeem) return null
  const raw = props.redeemAmount.replace(/,/g, '').trim()
  if (!raw) return null
  const w = parseUmaHumanToWei(raw)
  if (w === null || w <= 0n) {
    return t('errors.REDEEM_INVALID_AMOUNT')
  }
  const minW = parseUmaHumanToWei(props.limits.minRedeem)
  const maxW = parseUmaHumanToWei(props.limits.maxRedeem)
  if (minW === null || maxW === null) {
    return t('errors.REDEEM_LIMITS_UNAVAILABLE')
  }
  if (w < minW || w > maxW) {
    return t('errors.REDEEM_OUT_OF_RANGE', {
      min: props.limits.minRedeem,
      max: props.limits.maxRedeem,
    })
  }
  const balanceHuman = props.position?.umaVBalance
  if (balanceHuman) {
    const balanceWei = parseUmaHumanToWei(balanceHuman)
    if (balanceWei !== null && w > balanceWei) {
      return t('errors.REDEEM_EXCEEDS_BALANCE', { balance: balanceHuman })
    }
  }
  return null
})
</script>

<template>
  <section id="section-actions" class="section">
    <div class="grid-2">
      <div class="card pad" :class="{ dim: busy !== 'idle' }">
        <h2 class="section-title">{{ t('stake.title') }}</h2>
        <p class="hint">{{ t('stake.balance') }}: <span class="mono">{{ position?.umaWalletBalance ?? '—' }}</span></p>
        <p class="hint">{{ t('stake.rate') }}: <span class="mono">{{ navText }}</span></p>
        <p v-if="limits" class="hint">{{ t('stake.limits') }}: {{ limits.minStake }} / {{ limits.maxStake }} {{ t('common.uma') }}</p>

        <label class="lbl">{{ t('stake.amount') }} ({{ t('common.uma') }})</label>
        <input
          class="input mono"
          :value="stakeAmount"
          inputmode="decimal"
          :disabled="!connected || busy !== 'idle'"
          @input="emit('update:stakeAmount', ($event.target as HTMLInputElement).value)"
        />
        <div class="pct">
          <button type="button" class="btn btn-sm btn-ghost" :disabled="!connected || busy !== 'idle'" @click="emit('stakePct', 25)">
            {{ t('stake.pct25') }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" :disabled="!connected || busy !== 'idle'" @click="emit('stakePct', 50)">
            {{ t('stake.pct50') }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" :disabled="!connected || busy !== 'idle'" @click="emit('stakePct', 100)">
            {{ t('stake.max') }}
          </button>
        </div>
        <p class="hint stake-estimated-row">
          <span>{{ t('stake.estimated') }}: <span class="mono">{{ stakePreview }} {{ t('common.umaV') }}</span></span>
          <span
            class="stake-estimate-hint"
            tabindex="0"
            role="img"
            :aria-label="t('stake.estimatedDisclaimer')"
            :data-tooltip="t('stake.estimatedDisclaimer')"
          >
            <svg class="stake-estimate-hint__svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.25" />
              <path fill="currentColor" d="M8 4.35a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7zm-.5 2.65h1v5h-1v-5z" />
            </svg>
          </span>
        </p>
        <p v-if="stakeRangeHint" class="error range-hint">{{ stakeRangeHint }}</p>
        <div class="row">
          <button type="button" class="btn btn-primary btn-sm" :disabled="approveDisabled" @click="emit('approve')">
            {{ busy === 'approve' ? t('common.loading') : t('stake.approve') }}
          </button>
          <button type="button" class="btn btn-primary btn-sm" :disabled="stakeDisabled" @click="emit('stake')">
            {{ busy === 'stake' ? t('stake.staking') : t('stake.stakeBtn') }}
          </button>
        </div>
        <p class="flow-hint">{{ t('stake.flowHint') }}</p>
      </div>

      <div class="card pad" :class="{ dim: hasActiveRedeem }">
        <h2 class="section-title">{{ t('redeem.title') }}</h2>
        <p class="hint">{{ t('redeem.hint') }}</p>
        <p v-if="hasActiveRedeem" class="error">{{ t('redeem.blocked') }}</p>
        <p class="hint">{{ t('redeem.available') }}: <span class="mono">{{ position?.umaVBalance ?? '—' }}</span></p>
        <p v-if="limits" class="hint">{{ t('redeem.limits') }}: {{ limits.minRedeem }} / {{ limits.maxRedeem }} {{ t('common.umaV') }}</p>

        <label class="lbl">{{ t('redeem.amount') }} ({{ t('common.umaV') }})</label>
        <input
          class="input mono"
          :value="redeemAmount"
          inputmode="decimal"
          :disabled="!connected || busy !== 'idle' || hasActiveRedeem"
          @input="emit('update:redeemAmount', ($event.target as HTMLInputElement).value)"
        />
        <div class="pct">
          <button type="button" class="btn btn-sm btn-ghost" :disabled="!connected || busy !== 'idle' || hasActiveRedeem" @click="emit('redeemPct', 25)">
            {{ t('stake.pct25') }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" :disabled="!connected || busy !== 'idle' || hasActiveRedeem" @click="emit('redeemPct', 50)">
            {{ t('stake.pct50') }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" :disabled="!connected || busy !== 'idle' || hasActiveRedeem" @click="emit('redeemPct', 100)">
            {{ t('stake.max') }}
          </button>
        </div>
        <p class="hint">{{ t('redeem.burn') }}: <span class="mono">{{ redeemAmount || '0' }}</span></p>
        <p class="hint">{{ t('redeem.estimated') }}: <span class="mono">{{ redeemPreview }} {{ t('common.uma') }}</span></p>
        <p class="hint restrict">{{ t('redeem.restrict') }}</p>
        <p v-if="redeemRangeHint" class="error range-hint">{{ redeemRangeHint }}</p>
        <button type="button" class="btn btn-primary" style="margin-top: 8px" :disabled="redeemDisabled" @click="emit('redeem')">
          {{ busy === 'redeem' ? t('redeem.requesting') : t('redeem.request') }}
        </button>
      </div>
    </div>
    <p v-if="err" class="error" style="margin-top: 10px">{{ err }}</p>
  </section>
</template>

<style scoped>
.pad {
  padding: 16px;
}
.dim {
  opacity: 0.92;
}
.lbl {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  margin: 10px 0 6px;
}
.pct {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.flow-hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
}
.restrict {
  font-size: 12px;
  margin-top: 8px;
}
.range-hint {
  margin-top: 8px;
  margin-bottom: 0;
  font-size: 13px;
}
.stake-estimated-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.stake-estimate-hint {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  cursor: default;
  line-height: 1;
  outline: none;
}
.stake-estimate-hint__svg {
  width: 15px;
  height: 15px;
  display: block;
}
.stake-estimate-hint::after {
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
}
.stake-estimate-hint:hover::after,
.stake-estimate-hint:focus-visible::after {
  opacity: 1;
  visibility: visible;
}
</style>
