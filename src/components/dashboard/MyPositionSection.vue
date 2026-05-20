<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { EXPLORER_ADDRESS_BASE } from '@/config'
import { useClipboard } from '@/composables/useClipboard'
import type { UserPosition, WalletState } from '@/types/pool'

const props = defineProps<{
  wallet: WalletState | null
  position: UserPosition | null
  loading: boolean
}>()

defineEmits<{
  connect: []
}>()

const { t } = useI18n()
const { copy, copied } = useClipboard()

const short = computed(() => {
  const a = props.wallet?.address
  if (!a) return '—'
  return `${a.slice(0, 6)}…${a.slice(-4)}`
})

const explorerUrl = computed(() =>
  props.wallet?.address ? `${EXPLORER_ADDRESS_BASE}/${props.wallet.address}` : '#'
)

const redeemLabel = computed(() => {
  const p = props.position
  if (!p) return ''
  if (parseFloat(p.claimableUma.replace(/,/g, '')) > 0) return t('position.statusClaim')
  if (p.hasActiveRedeem) return t('position.statusActive')
  return t('position.statusNone')
})
</script>

<template>
  <section id="section-pos" class="section">
    <h2 class="section-title">{{ t('position.title') }}</h2>
    <div v-if="!wallet?.connected" class="card pad empty">
      <p class="hint">{{ t('position.empty') }}</p>
      <button type="button" class="btn btn-primary" style="margin-top: 12px" @click="$emit('connect')">
        {{ t('common.connectWallet') }}
      </button>
    </div>
    <div v-else class="grid-4">
      <div class="mini card">
        <label>{{ t('position.wallet') }}</label>
        <div class="mono val">{{ short }}</div>
        <div class="row">
          <button type="button" class="btn btn-sm btn-ghost" @click="wallet?.address && copy(wallet.address)">
            {{ copied ? t('common.copied') : t('position.copy') }}
          </button>
          <a class="btn btn-sm btn-ghost" :href="explorerUrl" target="_blank" rel="noreferrer">{{ t('position.explorer') }}</a>
        </div>
      </div>
      <div class="mini card">
        <label>{{ t('position.umaV') }}</label>
        <div class="mono val">{{ loading ? '…' : position?.umaVBalance }} {{ t('common.umaV') }}</div>
      </div>
      <div class="mini card">
        <label>{{ t('position.umaEq') }}</label>
        <div class="mono val">{{ loading ? '…' : `≈ ${position?.umaEquivalent}` }} {{ t('common.uma') }}</div>
      </div>
      <div class="mini card">
        <label>{{ t('position.redeemStatus') }}</label>
        <div class="val status-txt">{{ redeemLabel }}</div>
      </div>
    </div>
    <p v-if="wallet?.connected" class="hint helper">{{ t('position.helper') }}</p>
  </section>
</template>

<style scoped>
.pad {
  padding: 18px;
}
.empty {
  text-align: center;
}
.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 900px) {
  .grid-4 {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 520px) {
  .grid-4 {
    grid-template-columns: 1fr;
  }
}
.mini {
  padding: 12px;
}
.mini label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}
.val {
  font-weight: 700;
  font-size: 15px;
  color: var(--accent-bright);
}
.status-txt {
  color: var(--text);
  font-weight: 600;
}
.row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.helper {
  margin-top: 10px;
}
</style>
