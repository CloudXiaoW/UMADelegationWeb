<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isRedeemPastClaimableTime } from '@/lib/redeemClaimWindow'
import type { RedeemRequestView } from '@/types/pool'

const props = defineProps<{
  active: RedeemRequestView | null
}>()

defineEmits<{
  claim: []
  scroll: []
}>()

const { t } = useI18n()

const nowSec = ref(Math.floor(Date.now() / 1000))
let clockId: ReturnType<typeof setInterval> | undefined

function syncNow(): void {
  nowSec.value = Math.floor(Date.now() / 1000)
}

watch(
  () => props.active && props.active.currentStep !== 'claimed',
  (run) => {
    if (clockId !== undefined) {
      clearInterval(clockId)
      clockId = undefined
    }
    if (!run) return
    syncNow()
    clockId = setInterval(syncNow, 1000)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (clockId !== undefined) clearInterval(clockId)
})

const showBanner = computed(() => {
  const a = props.active
  return !!a && isRedeemPastClaimableTime(a, nowSec.value)
})
</script>

<template>
  <div v-if="showBanner" class="banner card">
    <div>
      <strong>{{ t('claimBanner.title') }}</strong>
      <div class="hint mono" style="margin-top: 6px">
        {{ props.active?.assetsToClaim }} {{ t('common.uma') }} → {{ props.active?.receiver }}
      </div>
    </div>
    <div class="row">
      <button type="button" class="btn btn-sm" @click="$emit('scroll')">{{ t('progress.title') }}</button>
      <button type="button" class="btn btn-primary btn-sm" @click="$emit('claim')">{{ t('claimBanner.claimNow') }}</button>
    </div>
  </div>
</template>

<style scoped>
.banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border-color: rgba(37, 99, 235, 0.28);
  background: linear-gradient(90deg, rgba(239, 246, 255, 0.95), rgba(219, 234, 254, 0.5));
}
.banner strong {
  color: var(--accent-dim);
}
.row {
  display: flex;
  gap: 8px;
}
</style>
