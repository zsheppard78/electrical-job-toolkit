import type { ToolResult } from './bends'
import { formatLength, parseLength } from './measure'

/**
 * Tape-measure calculator: "7' 5-3/8" - 2' 11-3/4"", "10' / 2", "3 x 14-1/2".
 *
 * Operators need spaces around them, because "5-3/8" (five and three-eighths)
 * and "5 - 3/8" (five minus three-eighths) mean different things.
 * Lengths can be added and subtracted; × and ÷ take a plain number.
 */

const OPERATOR = /\s+([+\-−x×*/÷])\s+/

type Op = '+' | '-' | '*' | '/'

function normalizeOp(op: string): Op {
  if (op === '−' || op === '-') return '-'
  if (op === 'x' || op === '×' || op === '*') return '*'
  if (op === '/' || op === '÷') return '/'
  return '+'
}

const opSymbol: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }

export function evaluateTape(expression: string): { inches: number; steps: { title: string; detail: string }[] } {
  if (/\s[+\-−x×*/÷]\s*$/.test(expression.trim() + ' ')) throw new Error('Something is missing after the last + − × ÷')
  const parts = expression.trim().split(OPERATOR)
  if (parts.length === 0 || parts[0].trim() === '') throw new Error('Type a measurement, like 7\' 5-3/8" - 2\' 11-3/4"')

  const first = parseLength(parts[0])
  if (first === null) throw new Error(`Can't read "${parts[0]}"`)

  let total = first
  const steps = [{ title: 'Start', detail: formatLength(first) }]

  for (let i = 1; i < parts.length; i += 2) {
    const op = normalizeOp(parts[i])
    const termText = parts[i + 1]
    if (termText === undefined || termText.trim() === '') throw new Error('Something is missing after the last + − × ÷')

    if (op === '*' || op === '/') {
      // Multiply/divide by a plain number, not a length.
      if (/['"]|ft|in/i.test(termText)) throw new Error(`× and ÷ need a plain number, like "/ 2", not "${termText}"`)
      const n = parseLength(termText) // also understands "1-1/2"
      if (n === null) throw new Error(`Can't read "${termText}"`)
      if (op === '/' && n === 0) throw new Error("Can't divide by 0")
      const before = total
      total = op === '*' ? total * n : total / n
      steps.push({ title: `${opSymbol[op]} ${termText.trim()}`, detail: `${formatLength(before)} ${opSymbol[op]} ${termText.trim()} = ${formatLength(total)}` })
    } else {
      const n = parseLength(termText)
      if (n === null) throw new Error(`Can't read "${termText}"`)
      const before = total
      total = op === '+' ? total + n : total - n
      steps.push({ title: `${opSymbol[op]} ${formatLength(n)}`, detail: `${formatLength(before)} ${opSymbol[op]} ${formatLength(n)} = ${formatLength(total)}` })
    }
  }

  return { inches: total, steps }
}

export function tapeCalculator(expression: string): ToolResult {
  const { inches, steps } = evaluateTape(expression)
  return {
    marks: [],
    headline: [{ label: 'Answer', value: formatLength(inches), good: inches >= 0 }],
    stats: [
      { label: 'Decimal inches', value: inches.toFixed(3) },
      { label: 'Decimal feet', value: (inches / 12).toFixed(3) },
      { label: 'Millimeters', value: Math.round(inches * 25.4).toLocaleString() },
      { label: 'Half of it (center)', value: formatLength(inches / 2) },
    ],
    howToBend: [
      'Put spaces around + − × ÷.  "5-3/8" is one number; "5 - 3/8" is a subtraction.',
      '× and ÷ take a plain number: 10\' / 2, 14-1/2 x 3',
      'Answers round to the nearest 1/16".',
    ],
    notesTitle: 'How to type it',
    steps,
    warning: inches < 0 ? 'The answer is negative. Did you subtract the bigger number?' : undefined,
  }
}
