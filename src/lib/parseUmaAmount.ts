const UMA_DECIMALS = 18

/**
 * Parse a human decimal UMA / UMA-V string into wei (10^18). Returns null if invalid or non-positive.
 */
export function parseUmaHumanToWei(amountHuman: string): bigint | null {
  const raw = amountHuman.replace(/,/g, '').trim()
  if (!raw || raw === '.') return null

  const neg = raw.startsWith('-')
  const body = neg ? raw.slice(1) : raw
  if (!/^\d*\.?\d*$/.test(body)) return null

  const [intPart = '0', fracRaw = ''] = body.split('.')
  const frac = (fracRaw + '0'.repeat(UMA_DECIMALS)).slice(0, UMA_DECIMALS)
  const intDigits = intPart.replace(/^0+/, '') || '0'
  if (!/^\d+$/.test(intDigits) || !/^\d+$/.test(frac)) return null

  try {
    const wei = BigInt(intDigits) * 10n ** BigInt(UMA_DECIMALS) + BigInt(frac)
    if (wei <= 0n) return null
    if (neg) return null
    return wei
  } catch {
    return null
  }
}
