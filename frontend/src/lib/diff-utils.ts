export interface DiffToken {
  text: string
  type: "unchanged" | "deleted" | "inserted"
}

// Simple word tokenizer that preserves punctuation
function tokenize(text: string): string[] {
  return text.match(/[\w']+|[.,!?;:]+|\s+/g) || []
}

// Longest Common Subsequence for word arrays
function lcs(a: string[], b: string[]): string[] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find LCS
  const result: string[] = []
  let i = m,
    j = n
  while (i > 0 && j > 0) {
    if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
      result.unshift(a[i - 1])
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return result
}

export function computeDiff(rawText: string, cleanedText: string): DiffToken[] {
  const rawTokens = tokenize(rawText)
  const cleanTokens = tokenize(cleanedText)

  // Find LCS to identify unchanged words
  const common = lcs(
    rawTokens.filter((t) => t.trim()),
    cleanTokens.filter((t) => t.trim()),
  )

  const result: DiffToken[] = []
  let rawIdx = 0
  let cleanIdx = 0
  let commonIdx = 0

  while (cleanIdx < cleanTokens.length) {
    const cleanToken = cleanTokens[cleanIdx]

    // Skip whitespace
    if (!cleanToken.trim()) {
      result.push({ text: cleanToken, type: "unchanged" })
      cleanIdx++
      continue
    }

    // Check if this token is in the common sequence
    if (commonIdx < common.length && cleanToken.toLowerCase() === common[commonIdx].toLowerCase()) {
      // Find and mark deleted tokens from raw (before this common token)
      while (rawIdx < rawTokens.length) {
        const rawToken = rawTokens[rawIdx]
        if (!rawToken.trim()) {
          rawIdx++
          continue
        }
        if (rawToken.toLowerCase() === common[commonIdx].toLowerCase()) {
          rawIdx++
          break
        }
        // This raw token was deleted
        result.push({ text: rawToken, type: "deleted" })
        rawIdx++
      }

      // Add the common (unchanged) token
      result.push({ text: cleanToken, type: "unchanged" })
      cleanIdx++
      commonIdx++
    } else {
      // This clean token is new (inserted)
      result.push({ text: cleanToken, type: "inserted" })
      cleanIdx++
    }
  }

  // Add any remaining deleted tokens from raw
  while (rawIdx < rawTokens.length) {
    const rawToken = rawTokens[rawIdx]
    if (rawToken.trim()) {
      result.push({ text: rawToken, type: "deleted" })
    }
    rawIdx++
  }

  return result
}

// Group consecutive tokens for cleaner rendering
export function groupDiffTokens(tokens: DiffToken[]): DiffToken[] {
  if (tokens.length === 0) return []

  const grouped: DiffToken[] = []
  let current = { ...tokens[0] }

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === current.type) {
      current.text += token.text
    } else {
      grouped.push(current)
      current = { ...token }
    }
  }
  grouped.push(current)

  return grouped
}
