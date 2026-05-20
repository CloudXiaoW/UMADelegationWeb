<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CHAIN_CONTRACTS, CHAIN_ENV, EXPLORER_ADDRESS_BASE } from '@/config'

const { t } = useI18n()

const contracts = CHAIN_CONTRACTS[CHAIN_ENV]
const vaultExplorerUrl = `${EXPLORER_ADDRESS_BASE}/${contracts.stakeDelegationVault}`
const umaVExplorerUrl = `${EXPLORER_ADDRESS_BASE}/${contracts.umaVaultShare}`
</script>

<template>
  <section class="section">
    <div class="row-3">
      <div class="card pad sm">
        <h3>{{ t('transparency.onchainTitle') }}</h3>
        <p class="hint">{{ t('transparency.onchainBody') }}</p>
        <div class="btns">
          <a class="btn btn-sm" :href="vaultExplorerUrl" target="_blank" rel="noreferrer">{{
            t('transparency.vaultBtn')
          }}</a>
          <a class="btn btn-sm" :href="umaVExplorerUrl" target="_blank" rel="noreferrer">{{
            t('transparency.shareBtn')
          }}</a>
        </div>
      </div>
      <div class="card pad sm">
        <h3>{{ t('transparency.feeTitle') }}</h3>
        <p class="hint">{{ t('transparency.feeBody') }}</p>
      </div>
      <div class="card pad sm">
        <h3>{{ t('transparency.riskTitle') }}</h3>
        <p class="hint">{{ t('transparency.riskBody') }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.row-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 900px) {
  .row-3 {
    grid-template-columns: 1fr;
  }
}
.pad {
  padding: 14px;
}
.sm h3 {
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 8px;
  color: var(--accent-bright);
}
.btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
</style>
