export function option(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name)
  if (i === -1) return fallback
  const value = process.argv[i + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`)
  }
  return value
}

export function flag(name: string): boolean {
  return process.argv.includes(name)
}

export function countOption(): number {
  const count = Number(option('--count', '1'))
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('--count must be an integer from 1 to 100')
  }
  return count
}

export function indexOption(): number {
  const index = Number(option('--index', '0'))
  if (!Number.isInteger(index) || index < 0 || index > 999999) {
    throw new Error('--index must be a non-negative integer')
  }
  return index
}
