"use client"

import { useMemo, useEffect, useRef, useState, useCallback } from "react"
import { TranscriptComparisonLayout } from "@/components/demo/transcript-comparison-layout"
import { TextMoveToolbar } from "@/components/demo/text-move-toolbar"
import type { Segment, TextMoveSelection, ActiveSuggestion, SpellcheckError } from "@/components/demo/types"

export const landingPageSegments: Segment[] = [
  {
    id: "seg-1",
    speaker: 1,
    time: "0:00 – 0:11",
    rawText: "So basically I just wanted to to walk you through um what we're thinking for the the website redesign.",
    cleanedText: "I wanted to walk you through what we're thinking for the website redesign.",
    originalRawText:
      "So basically I just wanted to to walk you through um what we're thinking for the the website redesign.",
  },
  {
    id: "seg-2",
    speaker: 2,
    time: "0:12 – 0:22",
    rawText: "Yeah that sounds good I'm I'm really excited to to see what you've come up with you know.",
    cleanedText: "That sounds good. I'm really excited to see what you've come up with.",
    originalRawText: "Yeah that sounds good I'm I'm really excited to to see what you've come up with you know.",
  },
  {
    id: "seg-3",
    speaker: 1,
    time: "0:23 – 0:34",
    rawText:
      "Perfect so we're gonna we're gonna focus on three main areas I mean the homepage the the product pages and checkout.",
    cleanedText: "We're going to focus on three main areas: the homepage, the product pages, and checkout.",
    originalRawText:
      "Perfect so we're gonna we're gonna focus on three main areas I mean the homepage the the product pages and checkout.",
  },
]

const animationStyles = `
  @keyframes slideInFromLeft {
    from {
      opacity: 0;
      transform: translateX(-30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes slideInFromRight {
    from {
      opacity: 0;
      transform: translateX(30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes fadeSlideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes diffFadeIn {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  .animate-container {
    animation: fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  
  .animate-raw-1 {
    opacity: 0;
    animation: slideInFromLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards;
  }
  
  .animate-raw-2 {
    opacity: 0;
    animation: slideInFromLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.55s forwards;
  }
  
  .animate-raw-3 {
    opacity: 0;
    animation: slideInFromLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.7s forwards;
  }
  
  .animate-cleaned-1 {
    opacity: 0;
    animation: slideInFromRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) 1s forwards;
  }
  
  .animate-cleaned-2 {
    opacity: 0;
    animation: slideInFromRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) 1.3s forwards;
  }
  
  .animate-cleaned-3 {
    opacity: 0;
    animation: slideInFromRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) 1.6s forwards;
  }
  
  .animate-diff-1 [data-diff-token] {
    opacity: 0;
    animation: diffFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) 1.2s forwards;
  }
  
  .animate-diff-2 [data-diff-token] {
    opacity: 0;
    animation: diffFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) 1.5s forwards;
  }
  
  .animate-diff-3 [data-diff-token] {
    opacity: 0;
    animation: diffFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) 1.8s forwards;
  }
  
  @media (prefers-reduced-motion: reduce) {
    .animate-container,
    .animate-raw-1, .animate-raw-2, .animate-raw-3,
    .animate-cleaned-1, .animate-cleaned-2, .animate-cleaned-3,
    .animate-diff-1 [data-diff-token],
    .animate-diff-2 [data-diff-token],
    .animate-diff-3 [data-diff-token] {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
`

export interface LiveTranscriptPreviewProps {
  segments?: Segment[]
  activeSegmentId?: string | null
  editingSegmentId?: string | null
  editedTexts?: Map<string, string>
  revertedSegments?: Map<string, string>
  spellcheckErrors?: Map<string, SpellcheckError[]>
  activeSuggestion?: ActiveSuggestion | null
  showDiff?: boolean
  textMoveSelection?: TextMoveSelection | null
  isSelectingMoveTarget?: boolean
  onSegmentClick?: (segmentId: string) => void
  onRevertSegment?: (segmentId: string) => void
  onUndoRevert?: (segmentId: string) => void
  onSaveSegment?: (segmentId: string) => void
  onSegmentEditStart?: (segmentId: string) => void
  onSegmentEditCancel?: (segmentId: string) => void
  onTextChange?: (segmentId: string, text: string) => void
  onWordClick?: (segmentId: string, word: string, errors: string[]) => void
  onSuggestionSelect?: () => void
  onCloseSuggestions?: () => void
  onUpdateAllSegments?: () => void
  onToggleDiff?: () => void
  onRawTextSelect?: (segmentId: string, text: string, startOffset: number, endOffset: number) => void
  onCleanedTextSelect?: (segmentId: string, text: string, startOffset: number, endOffset: number) => void
  onRawMoveTargetClick?: (targetSegmentId: string) => void
  onCleanedMoveTargetClick?: (targetSegmentId: string) => void
  onMoveClick?: () => void
  onCancelTextMove?: () => void
}

export function LiveTranscriptPreview({
  segments: segmentsProp = landingPageSegments,
  activeSegmentId,
  editingSegmentId,
  editedTexts,
  revertedSegments,
  spellcheckErrors,
  activeSuggestion,
  showDiff,
  textMoveSelection,
  isSelectingMoveTarget,
  onSegmentClick,
  onRevertSegment,
  onUndoRevert,
  onSaveSegment,
  onSegmentEditStart,
  onSegmentEditCancel,
  onTextChange,
  onWordClick,
  onSuggestionSelect,
  onCloseSuggestions,
  onUpdateAllSegments,
  onToggleDiff,
  onRawTextSelect,
  onCleanedTextSelect,
  onRawMoveTargetClick,
  onCleanedMoveTargetClick,
  onMoveClick,
  onCancelTextMove,
}: LiveTranscriptPreviewProps) {
  const [hasAnimated, setHasAnimated] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const [internalSegments, setInternalSegments] = useState<Segment[]>(segmentsProp)
  const [internalActiveSegmentId, setInternalActiveSegmentId] = useState<string | null>(null)
  const [internalEditingSegmentId, setInternalEditingSegmentId] = useState<string | null>(null)
  const [internalEditedTexts, setInternalEditedTexts] = useState<Map<string, string>>(new Map())
  const [internalRevertedSegments, setInternalRevertedSegments] = useState<Map<string, string>>(new Map())
  const [internalSpellcheckErrors] = useState<Map<string, SpellcheckError[]>>(new Map())
  const [internalActiveSuggestion] = useState<ActiveSuggestion | null>(null)
  const [internalShowDiff, setInternalShowDiff] = useState(true)
  const [internalTextMoveSelection, setInternalTextMoveSelection] = useState<TextMoveSelection | null>(null)
  const [internalIsSelectingMoveTarget, setInternalIsSelectingMoveTarget] = useState(false)

  const segments = internalSegments
  const activeSegmentIdState = activeSegmentId !== undefined ? activeSegmentId : internalActiveSegmentId
  const editingSegmentIdState = editingSegmentId !== undefined ? editingSegmentId : internalEditingSegmentId
  const editedTextsState = editedTexts ?? internalEditedTexts
  const revertedSegmentsState = revertedSegments ?? internalRevertedSegments
  const spellcheckErrorsState = spellcheckErrors ?? internalSpellcheckErrors
  const activeSuggestionState = activeSuggestion !== undefined ? activeSuggestion : internalActiveSuggestion
  const showDiffState = showDiff !== undefined ? showDiff : internalShowDiff
  const textMoveSelectionState = textMoveSelection !== undefined ? textMoveSelection : internalTextMoveSelection
  const isSelectingMoveTargetState =
    isSelectingMoveTarget !== undefined ? isSelectingMoveTarget : internalIsSelectingMoveTarget

  const handleSegmentClick = useCallback(
    (segmentId: string) => {
      if (onSegmentClick) {
        onSegmentClick(segmentId)
      } else {
        setInternalActiveSegmentId(segmentId)
      }
    },
    [onSegmentClick],
  )

  const handleRevertSegment = useCallback(
    (segmentId: string) => {
      if (onRevertSegment) {
        onRevertSegment(segmentId)
      } else {
        const segment = segments.find((s) => s.id === segmentId)
        if (segment) {
          setInternalRevertedSegments((prev) => new Map(prev).set(segmentId, segment.cleanedText))
          setInternalSegments((prev) =>
            prev.map((seg) => (seg.id === segmentId ? { ...seg, cleanedText: seg.rawText } : seg)),
          )
        }
      }
    },
    [onRevertSegment, segments],
  )

  const handleUndoRevert = useCallback(
    (segmentId: string) => {
      if (onUndoRevert) {
        onUndoRevert(segmentId)
      } else {
        setInternalRevertedSegments((prev) => {
          const originalCleanedText = prev.get(segmentId)
          if (originalCleanedText) {
            setInternalSegments((prevSegs) =>
              prevSegs.map((seg) => (seg.id === segmentId ? { ...seg, cleanedText: originalCleanedText } : seg)),
            )
          }
          const newMap = new Map(prev)
          newMap.delete(segmentId)
          return newMap
        })
      }
    },
    [onUndoRevert],
  )

  const handleSaveSegment = useCallback(
    (segmentId: string) => {
      if (onSaveSegment) {
        onSaveSegment(segmentId)
      } else {
        const newText = internalEditedTexts.get(segmentId)
        if (newText !== undefined) {
          setInternalSegments((prev) =>
            prev.map((seg) => (seg.id === segmentId ? { ...seg, cleanedText: newText } : seg)),
          )
        }
        setInternalEditingSegmentId(null)
        setInternalEditedTexts((prev) => {
          const newMap = new Map(prev)
          newMap.delete(segmentId)
          return newMap
        })
        setInternalRevertedSegments((prev) => {
          const newMap = new Map(prev)
          newMap.delete(segmentId)
          return newMap
        })
      }
    },
    [onSaveSegment, internalEditedTexts],
  )

  const handleSegmentEditStart = useCallback(
    (segmentId: string) => {
      if (onSegmentEditStart) {
        onSegmentEditStart(segmentId)
      } else {
        setInternalEditingSegmentId(segmentId)
        const segment = segments.find((s) => s.id === segmentId)
        if (segment && !internalEditedTexts.has(segmentId)) {
          setInternalEditedTexts((prev) => new Map(prev).set(segmentId, segment.cleanedText))
        }
      }
    },
    [onSegmentEditStart, segments, internalEditedTexts],
  )

  const handleSegmentEditCancel = useCallback(
    (segmentId: string) => {
      if (onSegmentEditCancel) {
        onSegmentEditCancel(segmentId)
      } else {
        setInternalEditingSegmentId(null)
        setInternalEditedTexts((prev) => {
          const newMap = new Map(prev)
          newMap.delete(segmentId)
          return newMap
        })
      }
    },
    [onSegmentEditCancel],
  )

  const handleTextChange = useCallback(
    (segmentId: string, text: string) => {
      if (onTextChange) {
        onTextChange(segmentId, text)
      } else {
        setInternalEditedTexts((prev) => new Map(prev).set(segmentId, text))
      }
    },
    [onTextChange],
  )

  const handleWordClick = useCallback(
    (segmentId: string, word: string, errors: string[]) => {
      onWordClick?.(segmentId, word, errors)
    },
    [onWordClick],
  )

  const handleSuggestionSelect = useCallback(() => {
    onSuggestionSelect?.()
  }, [onSuggestionSelect])

  const handleCloseSuggestions = useCallback(() => {
    onCloseSuggestions?.()
  }, [onCloseSuggestions])

  const handleUpdateAllSegments = useCallback(() => {
    onUpdateAllSegments?.()
  }, [onUpdateAllSegments])

  const handleToggleDiff = useCallback(() => {
    if (onToggleDiff) {
      onToggleDiff()
    } else {
      setInternalShowDiff((prev) => !prev)
    }
  }, [onToggleDiff])

  const handleRawTextSelect = useCallback(
    (segmentId: string, text: string, startOffset: number, endOffset: number) => {
      if (onRawTextSelect) {
        onRawTextSelect(segmentId, text, startOffset, endOffset)
      } else {
        setInternalTextMoveSelection({
          sourceSegmentId: segmentId,
          text,
          startOffset,
          endOffset,
          sourceColumn: "raw",
        })
      }
    },
    [onRawTextSelect],
  )

  const handleCleanedTextSelect = useCallback(
    (segmentId: string, text: string, startOffset: number, endOffset: number) => {
      if (onCleanedTextSelect) {
        onCleanedTextSelect(segmentId, text, startOffset, endOffset)
      } else {
        setInternalTextMoveSelection({
          sourceSegmentId: segmentId,
          text,
          startOffset,
          endOffset,
          sourceColumn: "cleaned",
        })
      }
    },
    [onCleanedTextSelect],
  )

  const handleRawMoveTargetClick = useCallback(
    (targetSegmentId: string) => {
      if (onRawMoveTargetClick) {
        onRawMoveTargetClick(targetSegmentId)
      } else {
        if (!internalTextMoveSelection || internalTextMoveSelection.sourceColumn !== "raw") return

        const sourceId = internalTextMoveSelection.sourceSegmentId
        const selectedText = internalTextMoveSelection.text

        setInternalSegments((prev) => {
          return prev.map((seg) => {
            if (seg.id === sourceId) {
              const currentText = seg.rawText
              const newText = currentText.replace(selectedText, "").replace(/\s+/g, " ").trim()
              return { ...seg, rawText: newText }
            }
            if (seg.id === targetSegmentId) {
              const trimmedSelected = selectedText.trim()
              const currentText = seg.rawText.trim()
              const startsWithPunctuation = /^[,.!?;:]/.test(trimmedSelected)
              const separator = startsWithPunctuation ? "" : " "
              const newText = currentText ? `${currentText}${separator}${trimmedSelected}` : trimmedSelected
              return { ...seg, rawText: newText }
            }
            return seg
          })
        })

        setInternalTextMoveSelection(null)
        setInternalIsSelectingMoveTarget(false)
        window.getSelection()?.removeAllRanges()
      }
    },
    [onRawMoveTargetClick, internalTextMoveSelection],
  )

  const handleCleanedMoveTargetClick = useCallback(
    (targetSegmentId: string) => {
      if (onCleanedMoveTargetClick) {
        onCleanedMoveTargetClick(targetSegmentId)
      } else {
        if (!internalTextMoveSelection || internalTextMoveSelection.sourceColumn !== "cleaned") return

        const sourceId = internalTextMoveSelection.sourceSegmentId
        const selectedText = internalTextMoveSelection.text

        setInternalSegments((prev) => {
          return prev.map((seg) => {
            if (seg.id === sourceId) {
              const currentText = seg.cleanedText
              const newText = currentText.replace(selectedText, "").replace(/\s+/g, " ").trim()
              return { ...seg, cleanedText: newText }
            }
            if (seg.id === targetSegmentId) {
              const trimmedSelected = selectedText.trim()
              const currentText = seg.cleanedText.trim()
              const startsWithPunctuation = /^[,.!?;:]/.test(trimmedSelected)
              const separator = startsWithPunctuation ? "" : " "
              const newText = currentText ? `${currentText}${separator}${trimmedSelected}` : trimmedSelected
              return { ...seg, cleanedText: newText }
            }
            return seg
          })
        })

        setInternalTextMoveSelection(null)
        setInternalIsSelectingMoveTarget(false)
        window.getSelection()?.removeAllRanges()
      }
    },
    [onCleanedMoveTargetClick, internalTextMoveSelection],
  )

  const handleMoveClick = useCallback(() => {
    if (onMoveClick) {
      onMoveClick()
    } else {
      setInternalIsSelectingMoveTarget(true)
    }
  }, [onMoveClick])

  const handleCancelTextMove = useCallback(() => {
    if (onCancelTextMove) {
      onCancelTextMove()
    } else {
      setInternalTextMoveSelection(null)
      setInternalIsSelectingMoveTarget(false)
    }
  }, [onCancelTextMove])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true)
          }
        })
      },
      { threshold: 0.3 },
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [hasAnimated])

  useEffect(() => {
    if (!hasAnimated) return

    const rawSegments = document.querySelectorAll('[data-column="raw"] [data-segment-id]')
    rawSegments.forEach((el, index) => {
      el.classList.add(`animate-raw-${index + 1}`)
    })

    const cleanedSegments = document.querySelectorAll('[data-column="cleaned"] [data-segment-id]')
    cleanedSegments.forEach((el, index) => {
      el.classList.add(`animate-cleaned-${index + 1}`)
      el.classList.add(`animate-diff-${index + 1}`)
    })
  }, [hasAnimated])

  const showSpeakerLabels = useMemo(() => {
    const uniqueSpeakers = new Set(segments.map((seg) => seg.speaker))
    return uniqueSpeakers.size > 1
  }, [segments])

  const editingCount = Array.from(editedTextsState.entries()).filter(([id, text]) => {
    const segment = segments.find((s) => s.id === id)
    return segment && text !== segment.cleanedText
  }).length

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      <div
        ref={containerRef}
        className={`bg-white rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.08)] border border-border ${hasAnimated ? "animate-container" : "opacity-0"}`}
      >
        <TranscriptComparisonLayout
          segments={segments}
          activeSegmentId={activeSegmentIdState}
          editingSegmentId={editingSegmentIdState}
          editedTexts={editedTextsState}
          revertedSegments={revertedSegmentsState}
          spellcheckErrors={spellcheckErrorsState}
          showDiff={showDiffState}
          showSpeakerLabels={showSpeakerLabels}
          textMoveSelection={textMoveSelectionState}
          isSelectingMoveTarget={isSelectingMoveTargetState}
          activeSuggestion={activeSuggestionState}
          editingCount={editingCount}
          onSegmentClick={handleSegmentClick}
          onRevert={handleRevertSegment}
          onUndoRevert={handleUndoRevert}
          onSave={handleSaveSegment}
          onEditStart={handleSegmentEditStart}
          onEditCancel={handleSegmentEditCancel}
          onTextChange={handleTextChange}
          onWordClick={handleWordClick}
          onSuggestionSelect={handleSuggestionSelect}
          onCloseSuggestions={handleCloseSuggestions}
          onUpdateAll={handleUpdateAllSegments}
          onToggleDiff={handleToggleDiff}
          onRawTextSelect={handleRawTextSelect}
          onCleanedTextSelect={handleCleanedTextSelect}
          onRawMoveTargetClick={handleRawMoveTargetClick}
          onCleanedMoveTargetClick={handleCleanedMoveTargetClick}
          showRevertButton={true}
          showCopyButton={false}
          variant="preview"
        />

        {textMoveSelectionState && (
          <TextMoveToolbar
            selectedText={textMoveSelectionState.text}
            isSelectingTarget={isSelectingMoveTargetState}
            onMoveClick={handleMoveClick}
            onCancel={handleCancelTextMove}
          />
        )}
      </div>
    </>
  )
}
