<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { EXPLORER_ADDRESS_BASE } from '@/config'
import { useClipboard } from '@/composables/useClipboard'

const props = defineProps<{
  connected: boolean
  address: string | null
  loading: boolean
}>()

const emit = defineEmits<{
  connect: []
  disconnect: []
}>()

const menuOpen = ref(false)
const wmRef = ref<HTMLElement | null>(null)

const { t } = useI18n()
const { copy, copied } = useClipboard()

const short = computed(() => {
  const a = props.address
  if (!a) return ''
  return `${a.slice(0, 6)}…${a.slice(-4)}`
})

const explorerUrl = computed(() => (props.address ? `${EXPLORER_ADDRESS_BASE}/${props.address}` : '#'))

function toggle(): void {
  menuOpen.value = !menuOpen.value
}

function onCopy(): void {
  if (props.address) void copy(props.address)
  menuOpen.value = false
}

function onDocumentPointerDown(ev: PointerEvent): void {
  if (!menuOpen.value) return
  const root = wmRef.value
  if (!root) return
  const t = ev.target
  if (t instanceof Node && !root.contains(t)) {
    menuOpen.value = false
  }
}

function onDocumentKeydown(ev: KeyboardEvent): void {
  if (!menuOpen.value) return
  if (ev.key === 'Escape') {
    menuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onDocumentKeydown, true)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown, true)
})
</script>

<template>
  <div ref="wmRef" class="wm">
    <button v-if="!connected" type="button" class="btn btn-primary btn-sm" :disabled="loading" @click="emit('connect')">
      {{ loading ? t('common.loading') : t('common.connectWallet') }}
    </button>
    <template v-else>
      <button type="button" class="btn btn-sm" @click="toggle">
        <span class="mono">{{ short }}</span>
      </button>
      <div v-if="menuOpen" class="dropdown" role="menu">
        <button type="button" @click="onCopy">{{ copied ? t('common.copied') : t('position.copy') }}</button>
        <a class="row-a" :href="explorerUrl" target="_blank" rel="noreferrer" @click="menuOpen = false">
          {{ t('position.explorer') }}
        </a>
        <button
          type="button"
          @click="
            emit('disconnect');
            menuOpen = false
          "
        >
          {{ t('common.disconnect') }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.wm {
  position: relative;
}
.row-a {
  display: block;
  padding: 10px 10px;
  border-radius: 8px;
  font-weight: 600;
  color: var(--text);
}
.row-a:hover {
  background: var(--surface-2);
}
</style>
