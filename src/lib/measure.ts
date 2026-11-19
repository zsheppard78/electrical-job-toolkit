/**
 * Tape-measure math: convert what you'd write on a pipe ("7' 5-3/8\"")
 * into decimal inches, and back again.
 *
 * Everything inside the app is stored in decimal inches. We only convert
 * to feet/inches/fractions when showing numbers to the user.
 */

/**
 * Parse a tape-measure style string into decimal inches.
 * Returns null if the input can't be understood.
 *
 * Accepted examples:
 *   "12"  "12.5"  "5-3/8"  "5 3/8"  "3/8"  "7'"  "7'5"  "7' 5-3/8\""  "7ft 5in"
 */
export function parseLength(input: string): number | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[’′]/g, "'")
    .replace(/[”″]/g, '"')
    .replace(/\s*(feet|foot|ft)\b/g, "'")
    .replace(/\s*(inches|inch|in)\b/g, '"')

  if (s === '') return null

  // Split into an optional feet part and an inches part.
  const feetMatch = s.match(/^(\d+(?:\.\d+)?)\s*'\s*(.*)$/)
  const feet = feetMatch ? parseFloat(feetMatch[1]) : 0
  const inchesText = (feetMatch ? feetMatch[2] : s).replace(/"$/, '').trim()

  if (inchesText === '') return feetMatch ? feet * 12 : null

  // Inches: optional whole number, optional fraction ("5", "5-3/8", "5 3/8", "3/8")
  const inchMatch = inchesText.match(/^(?:(\d+(?:\.\d+)?)(?:[\s-]+(?=\d)|$))?(?:(\d+)\/(\d+))?$/)
  if (!inchMatch || (inchMatch[1] === undefined && inchMatch[2] === undefined)) return null

  const whole = inchMatch[1] ? parseFloat(inchMatch[1]) : 0
  let fraction = 0
  if (inchMatch[2] !== undefined) {
    const denominator = parseInt(inchMatch[3], 10)
    if (denominator === 0) return null
    fraction = parseInt(inchMatch[2], 10) / denominator
  }

  return feet * 12 + whole + fraction
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * Format decimal inches the way you'd read a tape: 89.375 -> 7' 5-3/8"
 * Rounds to the nearest 1/16" by default.
 */
export function formatLength(inches: number, precision = 16): string {
  const sign = inches < 0 ? '-' : ''
  // Work in whole sixteenths so rounding can't leave us with "5-16/16".
  const totalUnits = Math.round(Math.abs(inches) * precision)

  const feet = Math.floor(totalUnits / (12 * precision))
  const remainingUnits = totalUnits - feet * 12 * precision
  const wholeInches = Math.floor(remainingUnits / precision)
  const numerator = remainingUnits - wholeInches * precision

  let inchPart: string
  if (numerator === 0) {
    inchPart = `${wholeInches}"`
  } else {
    const divisor = gcd(numerator, precision)
    const frac = `${numerator / divisor}/${precision / divisor}`
    inchPart = wholeInches === 0 ? `${frac}"` : `${wholeInches}-${frac}"`
  }

  if (feet === 0) return sign + inchPart
  return `${sign}${feet}' ${inchPart}`
}
