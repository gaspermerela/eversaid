import { describe, it, expect } from 'vitest'
import { computeDiff, groupDiffTokens, type DiffToken } from './diff-utils'

describe('computeDiff', () => {
  it('returns unchanged tokens for identical text', () => {
    const result = computeDiff('hello world', 'hello world')
    const unchangedText = result
      .filter((t) => t.type === 'unchanged')
      .map((t) => t.text)
      .join('')
    expect(unchangedText).toBe('hello world')
    expect(result.every((t) => t.type === 'unchanged')).toBe(true)
  })

  it('detects deleted filler words', () => {
    const result = computeDiff('um hello uh world', 'hello world')
    const deleted = result.filter((t) => t.type === 'deleted')
    expect(deleted.some((t) => t.text === 'um')).toBe(true)
    expect(deleted.some((t) => t.text === 'uh')).toBe(true)
  })

  it('detects inserted words', () => {
    const result = computeDiff('hello', 'hello world')
    const inserted = result.filter((t) => t.type === 'inserted')
    expect(inserted.some((t) => t.text === 'world')).toBe(true)
  })

  it('handles empty strings', () => {
    expect(computeDiff('', '')).toEqual([])

    // When cleaned is empty, raw tokens are marked as deleted
    const rawToEmpty = computeDiff('hello', '')
    expect(rawToEmpty.some((t) => t.type === 'deleted')).toBe(true)

    const resultFromEmpty = computeDiff('', 'hello')
    expect(resultFromEmpty.some((t) => t.type === 'inserted')).toBe(true)
  })

  it('handles punctuation', () => {
    const result = computeDiff('hello world', 'Hello, world!')
    // Should have some tokens
    expect(result.length).toBeGreaterThan(0)
  })

  it('is case-insensitive for matching', () => {
    const result = computeDiff('Hello World', 'hello world')
    // Words should match despite case difference
    const unchangedWords = result
      .filter((t) => t.type === 'unchanged' && t.text.trim())
      .map((t) => t.text.toLowerCase())
    expect(unchangedWords).toContain('hello')
    expect(unchangedWords).toContain('world')
  })

  it('handles complex transcript cleanup', () => {
    const raw = "Uh so basically what we're trying to do here is um figure out the best approach"
    const cleaned = "So basically what we're trying to do here is figure out the best approach"

    const result = computeDiff(raw, cleaned)

    // "Uh" and "um" should be deleted
    const deleted = result.filter((t) => t.type === 'deleted').map((t) => t.text.toLowerCase())
    expect(deleted).toContain('uh')
    expect(deleted).toContain('um')

    // Core words should be unchanged
    const unchanged = result.filter((t) => t.type === 'unchanged').map((t) => t.text.toLowerCase())
    expect(unchanged).toContain('basically')
  })
})

describe('groupDiffTokens', () => {
  it('returns empty array for empty input', () => {
    expect(groupDiffTokens([])).toEqual([])
  })

  it('groups consecutive tokens of same type', () => {
    const tokens: DiffToken[] = [
      { text: 'hello', type: 'unchanged' },
      { text: ' ', type: 'unchanged' },
      { text: 'world', type: 'unchanged' },
    ]

    const result = groupDiffTokens(tokens)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('hello world')
    expect(result[0].type).toBe('unchanged')
  })

  it('separates tokens of different types', () => {
    const tokens: DiffToken[] = [
      { text: 'hello', type: 'unchanged' },
      { text: 'um', type: 'deleted' },
      { text: 'world', type: 'unchanged' },
    ]

    const result = groupDiffTokens(tokens)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ text: 'hello', type: 'unchanged' })
    expect(result[1]).toEqual({ text: 'um', type: 'deleted' })
    expect(result[2]).toEqual({ text: 'world', type: 'unchanged' })
  })

  it('handles single token', () => {
    const tokens: DiffToken[] = [{ text: 'hello', type: 'unchanged' }]
    const result = groupDiffTokens(tokens)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ text: 'hello', type: 'unchanged' })
  })

  it('groups mixed consecutive deletions', () => {
    const tokens: DiffToken[] = [
      { text: 'um', type: 'deleted' },
      { text: ' ', type: 'deleted' },
      { text: 'uh', type: 'deleted' },
    ]

    const result = groupDiffTokens(tokens)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('um uh')
    expect(result[0].type).toBe('deleted')
  })
})
