import { describe, it, expect } from 'vitest'
import {
  parseTimeString,
  parseTimeRange,
  formatTime,
  formatTimeRange,
  parseSegmentTimes,
  parseAllSegmentTimes,
  findSegmentAtTime,
  findSegmentIndexAtTime,
} from './time-utils'
import type { Segment } from '@/components/demo/types'

describe('parseTimeString', () => {
  it('parses "0:00" to 0 seconds', () => {
    expect(parseTimeString('0:00')).toBe(0)
  })

  it('parses "0:43" to 43 seconds', () => {
    expect(parseTimeString('0:43')).toBe(43)
  })

  it('parses "1:05" to 65 seconds', () => {
    expect(parseTimeString('1:05')).toBe(65)
  })

  it('parses "10:30" to 630 seconds', () => {
    expect(parseTimeString('10:30')).toBe(630)
  })

  it('handles leading/trailing whitespace', () => {
    expect(parseTimeString('  1:30  ')).toBe(90)
  })

  it('returns 0 for invalid format', () => {
    expect(parseTimeString('invalid')).toBe(0)
    expect(parseTimeString('1:2:3')).toBe(0)
    expect(parseTimeString('')).toBe(0)
  })
})

describe('parseTimeRange', () => {
  it('parses range with regular hyphen', () => {
    const result = parseTimeRange('0:00 - 0:18')
    expect(result).toEqual({ startTime: 0, endTime: 18 })
  })

  it('parses range with en-dash (–)', () => {
    const result = parseTimeRange('0:43 – 1:05')
    expect(result).toEqual({ startTime: 43, endTime: 65 })
  })

  it('returns zeros for invalid format', () => {
    expect(parseTimeRange('invalid')).toEqual({ startTime: 0, endTime: 0 })
  })
})

describe('formatTime', () => {
  it('formats 0 seconds as "0:00"', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('formats 43 seconds as "0:43"', () => {
    expect(formatTime(43)).toBe('0:43')
  })

  it('formats 65 seconds as "1:05"', () => {
    expect(formatTime(65)).toBe('1:05')
  })

  it('formats 630 seconds as "10:30"', () => {
    expect(formatTime(630)).toBe('10:30')
  })

  it('handles fractional seconds by flooring', () => {
    expect(formatTime(65.9)).toBe('1:05')
  })
})

describe('formatTimeRange', () => {
  it('formats a time range correctly', () => {
    expect(formatTimeRange(0, 18)).toBe('0:00 – 0:18')
  })

  it('formats multi-minute range', () => {
    expect(formatTimeRange(43, 65)).toBe('0:43 – 1:05')
  })
})

describe('parseSegmentTimes', () => {
  it('adds startTime and endTime to a segment', () => {
    const segment: Segment = {
      id: 'seg-1',
      speaker: 1,
      time: '0:43 – 1:05',
      rawText: 'raw',
      cleanedText: 'cleaned',
    }

    const result = parseSegmentTimes(segment)

    expect(result.startTime).toBe(43)
    expect(result.endTime).toBe(65)
    expect(result.id).toBe('seg-1')
    expect(result.rawText).toBe('raw')
  })
})

describe('parseAllSegmentTimes', () => {
  it('parses times for all segments', () => {
    const segments: Segment[] = [
      { id: '1', speaker: 1, time: '0:00 – 0:18', rawText: '', cleanedText: '' },
      { id: '2', speaker: 2, time: '0:19 – 0:42', rawText: '', cleanedText: '' },
    ]

    const result = parseAllSegmentTimes(segments)

    expect(result).toHaveLength(2)
    expect(result[0].startTime).toBe(0)
    expect(result[0].endTime).toBe(18)
    expect(result[1].startTime).toBe(19)
    expect(result[1].endTime).toBe(42)
  })

  it('returns empty array for empty input', () => {
    expect(parseAllSegmentTimes([])).toEqual([])
  })
})

describe('findSegmentAtTime', () => {
  const segments = parseAllSegmentTimes([
    { id: '1', speaker: 1, time: '0:00 – 0:18', rawText: '', cleanedText: '' },
    { id: '2', speaker: 2, time: '0:19 – 0:42', rawText: '', cleanedText: '' },
    { id: '3', speaker: 1, time: '0:43 – 1:05', rawText: '', cleanedText: '' },
  ])

  it('finds segment at start time', () => {
    const result = findSegmentAtTime(segments, 0)
    expect(result?.id).toBe('1')
  })

  it('finds segment in middle', () => {
    const result = findSegmentAtTime(segments, 30)
    expect(result?.id).toBe('2')
  })

  it('returns undefined for time after all segments', () => {
    const result = findSegmentAtTime(segments, 100)
    expect(result).toBeUndefined()
  })

  it('returns undefined for time between segments', () => {
    // Time 18 is exactly at the end of segment 1, but < 19 start of segment 2
    const result = findSegmentAtTime(segments, 18.5)
    expect(result).toBeUndefined()
  })

  it('returns undefined for empty segments array', () => {
    expect(findSegmentAtTime([], 10)).toBeUndefined()
  })
})

describe('findSegmentIndexAtTime', () => {
  const segments = parseAllSegmentTimes([
    { id: '1', speaker: 1, time: '0:00 – 0:18', rawText: '', cleanedText: '' },
    { id: '2', speaker: 2, time: '0:19 – 0:42', rawText: '', cleanedText: '' },
  ])

  it('returns correct index', () => {
    expect(findSegmentIndexAtTime(segments, 10)).toBe(0)
    expect(findSegmentIndexAtTime(segments, 30)).toBe(1)
  })

  it('returns -1 when not found', () => {
    expect(findSegmentIndexAtTime(segments, 100)).toBe(-1)
  })
})
