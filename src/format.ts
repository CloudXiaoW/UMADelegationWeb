import { parseUmaHumanToWei } from '@/lib/parseUmaAmount'

const NAV_DECIMALS = 18

/** Format NAV (UMA per UMA-V) for UI: three decimal places (half-up from full-precision string). */
export function formatNavDecimal(raw: string): string {
  const w = parseUmaHumanToWei(String(raw).replace(/,/g, '').trim())
  if (w === null) {
    const v = parseFloat(String(raw).replace(/,/g, ''))
    return Number.isFinite(v) ? v.toFixed(3) : String(raw)
  }
  const scale = 10n ** BigInt(NAV_DECIMALS)
  const roundedThousandths = (w * 1000n + scale / 2n) / scale
  const whole = roundedThousandths / 1000n
  const frac = roundedThousandths % 1000n
  return `${whole}.${frac.toString().padStart(3, '0')}`
}

/** NAV chart X-axis: `YYYY.M` (e.g. `2026.3`). Accepts `YYYY-MM`, `YYYY.M`, `YYYY/M`. */
export function formatNavChartAxisLabel(raw: string): string {
  const s = raw.trim()
  const dot = /^(\d{4})\.(\d{1,2})$/.exec(s)
  if (dot) return `${dot[1]}.${Number(dot[2])}`
  const dash = /^(\d{4})-(\d{1,2})$/.exec(s)
  if (dash) return `${dash[1]}.${Number(dash[2])}`
  const slash = /^(\d{4})\/(\d{1,2})$/.exec(s)
  if (slash) return `${slash[1]}.${Number(slash[2])}`
  return s
}

/** Percent values in fee-rule sentence (supports decimals like 3.2). */
export function formatFeeRulePercent(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return String(Number(value.toFixed(4)))
}

/**
 * Remaining seconds as `hh:mm:ss` (24h+ supported, e.g. `48:05:09`). Locale-neutral.
 */
export function formatRemainingDurationHMS(seconds: number): string {
  if (!Number.isFinite(seconds)) return '00:00:00'
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
