<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppTopNav from '@/components/layout/AppTopNav.vue'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher.vue'
import WalletMenu from '@/components/layout/WalletMenu.vue'
import ClaimBanner from '@/components/dashboard/ClaimBanner.vue'
import HeroWithStats from '@/components/dashboard/HeroWithStats.vue'
import MyPositionSection from '@/components/dashboard/MyPositionSection.vue'
import RedeemProgressSection from '@/components/dashboard/RedeemProgressSection.vue'
import StakeRedeemGrid from '@/components/dashboard/StakeRedeemGrid.vue'
import TransparencySection from '@/components/dashboard/TransparencySection.vue'
import YieldBenefitsSection from '@/components/dashboard/YieldBenefitsSection.vue'
import { EXPLORER_TX_BASE } from '@/config'
import { formatNavDecimal } from '@/format'
import { usePoolMetrics } from '@/composables/usePoolMetrics'
import { scrollToSection } from '@/composables/useScrollTo'
import { useStakeRedeemActions } from '@/composables/useStakeRedeemActions'
import { useUserPortfolio } from '@/composables/useUserPortfolio'
import { useWallet } from '@/composables/useWallet'
import { poolService } from '@/services/poolService'

const { t } = useI18n()

const { wallet, connect, disconnect, loading: walletLoading } = useWallet()
const connected = computed(() => wallet.value?.connected ?? false)

const { metrics, loading: metricsLoading, refresh: refreshMetrics } = usePoolMetrics()
const { position, activeRedeem, candidateRedeem, redeemHistory, loading: portfolioLoading, refresh: refreshPortfolio } =
  useUserPortfolio(connected)

const ops = useStakeRedeemActions(() => position.value, connected, metrics)

const triggerUnstakeBusy = ref(false)

const redeemProgressBusy = computed(
  () => (triggerUnstakeBusy.value ? ('triggerUnstake' as const) : ops.busy),
)

const navText = computed(() => {
  const n = metrics.value?.navUmaPerShare
  if (!n) return '—'
  return `1 ${t('common.umaV')} = ${formatNavDecimal(n)} ${t('common.uma')}`
})

const busyForUi = computed(() => {
  if (ops.busy === 'claim') return 'idle'
  return ops.busy
})

async function onConnect(): Promise<void> {
  await connect()
  await Promise.all([refreshPortfolio(), refreshMetrics()])
  await ops.refreshValidationCache()
}

async function onDisconnect(): Promise<void> {
  await disconnect()
  ops.lastTxHash = null
  ops.formError = null
  await Promise.all([refreshPortfolio(), refreshMetrics()])
  await ops.refreshValidationCache()
}

async function onApprove(): Promise<void> {
  await ops.approveUma()
  await refreshPortfolio()
}

async function onStake(): Promise<void> {
  await ops.stakeUma()
  await Promise.all([refreshPortfolio(), refreshMetrics()])
  await ops.refreshValidationCache()
}

async function onRedeem(): Promise<void> {
  await ops.requestRedeem()
  await Promise.all([refreshPortfolio(), refreshMetrics()])
  await ops.refreshValidationCache()
}

async function onClaim(id: string): Promise<void> {
  await ops.claim(id)
  await Promise.all([refreshPortfolio(), refreshMetrics()])
}

async function onTriggerUnstake(): Promise<void> {
  triggerUnstakeBusy.value = true
  try {
    const { txHash } = await poolService.triggerRequestUnstake()
    ops.lastTxHash = txHash
    await Promise.all([refreshPortfolio(), refreshMetrics()])
  } finally {
    triggerUnstakeBusy.value = false
  }
}

function onBannerClaim(): void {
  const id = activeRedeem.value?.id
  if (id) void onClaim(id)
}
</script>

<template>
  <div>
    <AppTopNav>
      <template #lang>
        <LanguageSwitcher />
      </template>
      <template #wallet>
        <WalletMenu
          :connected="!!wallet?.connected"
          :address="wallet?.address ?? null"
          :loading="walletLoading"
          @connect="onConnect"
          @disconnect="onDisconnect"
        />
      </template>
    </AppTopNav>

    <div class="shell">
      <HeroWithStats
        :metrics="metrics"
        :loading="metricsLoading"
        @scroll-stake="() => scrollToSection('section-actions')"
        @scroll-position="() => scrollToSection('section-pos')"
      />

      <div id="section-yield">
        <YieldBenefitsSection />
      </div>

      <MyPositionSection :wallet="wallet" :position="position" :loading="portfolioLoading" @connect="onConnect" />

      <ClaimBanner
        v-if="activeRedeem"
        :active="activeRedeem"
        @scroll="() => scrollToSection('section-redeem')"
        @claim="onBannerClaim"
      />

      <StakeRedeemGrid
        :connected="connected"
        :position="position"
        :nav-text="navText"
        :limits="ops.limits"
        :stake-amount="ops.stakeAmount"
        :stake-preview="ops.stakePreview"
        :redeem-amount="ops.redeemAmount"
        :redeem-preview="ops.redeemPreview"
        :uma-approved="ops.umaApproved"
        :can-stake="ops.canStake"
        :can-request-redeem="ops.canRequestRedeem"
        :has-active-redeem="!!position?.hasActiveRedeem"
        :busy="busyForUi"
        :form-error="ops.formError"
        @update:stake-amount="(v: string) => (ops.stakeAmount = v)"
        @update:redeem-amount="(v: string) => (ops.redeemAmount = v)"
        @approve="onApprove"
        @stake="onStake"
        @redeem="onRedeem"
        @stake-pct="(p) => ops.setStakePct(p)"
        @redeem-pct="(p) => ops.setRedeemPct(p)"
      />

      <div v-if="ops.lastTxHash" class="card pad tx">
        <span class="hint">{{ t('common.viewTx') }}</span>
        <a class="mono" rel="noreferrer" target="_blank" :href="`${EXPLORER_TX_BASE}/${ops.lastTxHash}`">{{ ops.lastTxHash }}</a>
      </div>

      <RedeemProgressSection
        :active="activeRedeem"
        :candidate="candidateRedeem"
        :history="redeemHistory"
        :busy="redeemProgressBusy"
        @claim="onClaim"
        @trigger-unstake="onTriggerUnstake"
      />

      <TransparencySection />
    </div>
  </div>
</template>

<style scoped>
.pad {
  padding: 14px 16px;
}
.tx {
  margin-top: 16px;
}
.tx .hint {
  margin-right: 0.5em;
}
.tx a {
  color: var(--accent-bright);
  word-break: break-all;
}
.tx a:hover {
  text-decoration: underline;
}
</style>
