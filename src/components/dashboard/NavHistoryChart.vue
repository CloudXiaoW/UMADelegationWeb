<script setup lang="ts">
import { computed } from 'vue'
import { formatNavChartAxisLabel } from '@/format'
import type { NavHistoryPoint } from '@/types/navHistory'

const props = defineProps<{
  points: NavHistoryPoint[] | null
  loading?: boolean
}>()

const W = 520
/** SVG height — larger gives more vertical room for the line chart. */
const H = 280
const padL = 44
const padR = 10
/** Inset plot horizontally so first/last x-axis labels (middle-anchored) stay inside the SVG. */
const plotInsetL = 10
const plotInsetR = 26
const padT = 16
/** Space below plot for x-axis labels (more = farther from chart grid to month text). */
const padB = 34
/** Baseline Y offset from SVG bottom for month labels. */
const padAxisXBtm = 10

const chartGeom = computed(() => {
  const pts = props.points ?? []
  if (pts.length === 0) return null

  const vals = pts.map((p) => p.nav)
  let minV = Math.min(...vals)
  let maxV = Math.max(...vals)
  if (minV === maxV) {
    minV *= 0.999
    maxV *= 1.001
  }
  const span = maxV - minV
  const padY = span * 0.12 || 0.0001
  const y0 = minV - padY
  const y1 = maxV + padY

  const plotLeft = padL + plotInsetL
  const plotRight = W - padR - plotInsetR
  const innerW = plotRight - plotLeft
  const innerH = H - padT - padB
  const n = pts.length
  const coords = pts.map((p, i) => {
    const x = n === 1 ? plotLeft + innerW / 2 : plotLeft + (innerW * i) / (n - 1)
    const t = (p.nav - y0) / (y1 - y0)
    const y = padT + innerH * (1 - t)
    return { x, y, label: formatNavChartAxisLabel(p.label), nav: p.nav }
  })

  const lineD = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(' ')

  const yTicks = [y1, y0 + (y1 - y0) * 0.5, y0].map((v) => ({
    v,
    y: padT + innerH * (1 - (v - y0) / (y1 - y0)),
  }))

  return { coords, lineD, yTicks, y0, y1, plotLeft, plotRight }
})

function fmtNav(n: number): string {
  return n.toFixed(4)
}
</script>

<template>
  <div class="wrap" role="img" :aria-busy="loading">
    <div v-if="loading" class="skeleton" />
    <template v-else-if="chartGeom">
      <svg
        class="svg"
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          v-for="(tick, idx) in chartGeom.yTicks"
          :key="idx"
          class="grid"
          :x1="chartGeom.plotLeft"
          :y1="tick.y"
          :x2="chartGeom.plotRight"
          :y2="tick.y"
        />
        <text
          v-for="(tick, idx) in chartGeom.yTicks"
          :key="'y' + idx"
          class="axis"
          :x="padL - 6"
          :y="tick.y + 4"
          text-anchor="end"
        >
          {{ fmtNav(tick.v) }}
        </text>
        <path class="stroke" :d="chartGeom.lineD" fill="none" />
        <circle v-for="(c, idx) in chartGeom.coords" :key="idx" class="dot" :cx="c.x" :cy="c.y" r="4" />
        <text
          v-for="(c, idx) in chartGeom.coords"
          :key="'x' + idx"
          class="axis-x"
          :x="c.x"
          :y="H - padAxisXBtm"
          text-anchor="middle"
        >
          {{ c.label }}
        </text>
      </svg>
    </template>
    <p v-else class="empty-hint">{{ $t('yieldCard.navChartEmpty') }}</p>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 280px;
  margin-top: 4px;
}
.skeleton {
  height: 280px;
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    var(--line) 0%,
    rgba(0, 0, 0, 0.04) 50%,
    var(--line) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}
@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
.svg {
  width: 96%;
  max-width: 100%;
  height: auto;
  display: block;
  margin-left: auto;
  margin-right: auto;
}
.grid {
  stroke: var(--line);
  stroke-width: 1;
}
.axis {
  fill: var(--muted);
  font-size: 11px;
}
.axis-x {
  fill: var(--muted);
  font-size: 11px;
}
.stroke {
  stroke: var(--accent);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dot {
  fill: #fff;
  stroke: var(--accent);
  stroke-width: 2;
}
.empty-hint {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}
</style>
