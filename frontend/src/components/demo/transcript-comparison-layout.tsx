"use client"

import type React from "react"

import { useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "@/components/motion"
import { Maximize2 } from "lucide-react"
import { RawSegmentList } from "./raw-segment-list"
import { EditableSegmentList } from "./editable-segment-list"
import { TranscriptHeader } from "./transcript-header"
import type { Segment, TextMoveSelection, ActiveSuggestion, SpellcheckError } from "./types"

interface TranscriptComparisonLayoutProps {
  segments: Segment[]
  activeSegmentId: string | null
  editingSegmentId: string | null
  editedTexts: Map<string, string>
  revertedSegments: Map<string, string>
  spellcheckErrors: Map<string, SpellcheckError[]>
  showDiff: boolean
  showSpeakerLabels: boolean
  textMoveSelection: TextMoveSelection | null
  isSelectingMoveTarget: boolean
  activeSuggestion: ActiveSuggestion | null
  editingCount: number
  /** Index of the currently active word within the active segment */
  activeWordIndex?: number
  /** Whether audio is currently playing */
  isPlaying?: boolean
  /** Whether the editor is in expanded (fullscreen) mode */
  isExpanded?: boolean
  /** Callback when user clicks to expand from collapsed state */
  onExpandToggle?: () => void
  /** Callback when user clicks X or presses ESC to collapse */
  onClose?: () => void
  onSegmentClick: (segmentId: string) => void
  onRevert: (segmentId: string) => void
  onUndoRevert: (segmentId: string) => void
  onSave: (segmentId: string) => void
  onEditStart: (segmentId: string) => void
  onEditCancel: (segmentId: string) => void
  onTextChange: (segmentId: string, text: string) => void
  onWordClick: (segmentId: string, e: React.MouseEvent, error: SpellcheckError) => void
  onSuggestionSelect: (suggestion: string) => void
  onCloseSuggestions: () => void
  onUpdateAll: () => void
  onToggleDiff: () => void
  onRawTextSelect: (segmentId: string, text: string, startOffset: number, endOffset: number) => void
  onCleanedTextSelect: (segmentId: string, text: string, startOffset: number, endOffset: number) => void
  onRawMoveTargetClick: (segmentId: string) => void
  onCleanedMoveTargetClick: (segmentId: string) => void
  showRevertButton?: boolean
  showCopyButton?: boolean
  variant?: "demo" | "preview"
}

export function TranscriptComparisonLayout({
  segments,
  activeSegmentId,
  editingSegmentId,
  editedTexts,
  revertedSegments,
  spellcheckErrors,
  showDiff,
  showSpeakerLabels,
  textMoveSelection,
  isSelectingMoveTarget,
  activeSuggestion,
  editingCount,
  activeWordIndex = -1,
  isPlaying = false,
  isExpanded = true,
  onExpandToggle,
  onClose,
  onSegmentClick,
  onRevert,
  onUndoRevert,
  onSave,
  onEditStart,
  onEditCancel,
  onTextChange,
  onWordClick,
  onSuggestionSelect,
  onCloseSuggestions,
  onUpdateAll,
  onToggleDiff,
  onRawTextSelect,
  onCleanedTextSelect,
  onRawMoveTargetClick,
  onCleanedMoveTargetClick,
  showRevertButton = true,
  showCopyButton = true,
  variant = "demo",
}: TranscriptComparisonLayoutProps) {
  const t = useTranslations('demo.transcript')
  const rawScrollRef = useRef<HTMLDivElement>(null)
  const cleanedScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingScrollRef = useRef(false)

  const handleRawScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScrollRef.current) return

    const rawEl = e.currentTarget
    const cleanedEl = cleanedScrollRef.current
    if (!cleanedEl) return

    isSyncingScrollRef.current = true

    // Use percentage-based scrolling to handle different content heights
    const rawMaxScroll = rawEl.scrollHeight - rawEl.clientHeight
    const cleanedMaxScroll = cleanedEl.scrollHeight - cleanedEl.clientHeight

    if (rawMaxScroll > 0 && cleanedMaxScroll > 0) {
      const scrollPercentage = rawEl.scrollTop / rawMaxScroll
      cleanedEl.scrollTop = scrollPercentage * cleanedMaxScroll
    }

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false
    })
  }

  const handleCleanedScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScrollRef.current) return

    const cleanedEl = e.currentTarget
    const rawEl = rawScrollRef.current
    if (!rawEl) return

    isSyncingScrollRef.current = true

    // Use percentage-based scrolling to handle different content heights
    const rawMaxScroll = rawEl.scrollHeight - rawEl.clientHeight
    const cleanedMaxScroll = cleanedEl.scrollHeight - cleanedEl.clientHeight

    if (rawMaxScroll > 0 && cleanedMaxScroll > 0) {
      const scrollPercentage = cleanedEl.scrollTop / cleanedMaxScroll
      rawEl.scrollTop = scrollPercentage * rawMaxScroll
    }

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false
    })
  }

  // Sync heights of corresponding segments so they align horizontally
  useEffect(() => {
    const syncHeights = () => {
      segments.forEach((seg) => {
        const rawEl = rawScrollRef.current?.querySelector(`[data-segment-id="${seg.id}"]`) as HTMLElement | null
        const cleanedEl = cleanedScrollRef.current?.querySelector(`[data-segment-id="${seg.id}"]`) as HTMLElement | null

        if (rawEl && cleanedEl) {
          // Reset heights first to get natural heights
          rawEl.style.minHeight = ''
          cleanedEl.style.minHeight = ''

          // Get natural heights
          const rawHeight = rawEl.offsetHeight
          const cleanedHeight = cleanedEl.offsetHeight

          // Set both to the max height
          const maxHeight = Math.max(rawHeight, cleanedHeight)
          rawEl.style.minHeight = `${maxHeight}px`
          cleanedEl.style.minHeight = `${maxHeight}px`
        }
      })
    }

    // Run after render
    requestAnimationFrame(syncHeights)

    // Re-sync on window resize
    window.addEventListener('resize', syncHeights)
    return () => window.removeEventListener('resize', syncHeights)
  }, [segments, showDiff, editedTexts, editingSegmentId])

  return (
    <div className={`relative flex flex-col ${variant === "demo" && !isExpanded ? "" : "h-full"}`}>
      <div className="grid grid-cols-2 border-b border-border">
        <TranscriptHeader
          title={t('rawTitle')}
          segments={segments}
          textKey="rawText"
          showCopyButton={showCopyButton}
        />
        <TranscriptHeader
          title={t('cleanedTitle')}
          segments={segments}
          textKey="cleanedText"
          showDiffToggle
          showDiff={showDiff}
          onToggleDiff={onToggleDiff}
          showCopyButton={showCopyButton}
          showCloseButton={isExpanded && variant === "demo"}
          onClose={onClose}
        />
      </div>

      <div
        className={`grid grid-cols-2 overflow-hidden ${variant === "demo" && !isExpanded ? "" : "flex-1"}`}
        style={{ height: variant === "demo" && !isExpanded ? "280px" : undefined }}
      >
        <RawSegmentList
          ref={rawScrollRef}
          segments={segments}
          activeSegmentId={activeSegmentId}
          showSpeakerLabels={showSpeakerLabels}
          isSelectingMoveTarget={isSelectingMoveTarget && textMoveSelection?.sourceColumn === "raw"}
          moveSourceSegmentId={textMoveSelection?.sourceColumn === "raw" ? textMoveSelection.sourceSegmentId : null}
          activeWordIndex={activeWordIndex}
          isPlaying={isPlaying}
          onSegmentClick={
            isSelectingMoveTarget && textMoveSelection?.sourceColumn === "raw" ? onRawMoveTargetClick : onSegmentClick
          }
          onTextSelect={onRawTextSelect}
          onScroll={handleRawScroll}
        />
        <EditableSegmentList
          ref={cleanedScrollRef}
          segments={segments}
          activeSegmentId={activeSegmentId}
          editingSegmentId={editingSegmentId}
          editedTexts={editedTexts}
          revertedSegments={revertedSegments}
          spellcheckErrors={spellcheckErrors}
          showDiff={showDiff}
          showSpeakerLabels={showSpeakerLabels}
          textMoveSelection={textMoveSelection}
          isSelectingMoveTarget={isSelectingMoveTarget && textMoveSelection?.sourceColumn === "cleaned"}
          activeSuggestion={activeSuggestion}
          onRevert={onRevert}
          onUndoRevert={onUndoRevert}
          onSave={onSave}
          onEditStart={onEditStart}
          onEditCancel={onEditCancel}
          onTextChange={onTextChange}
          onWordClick={onWordClick}
          onSuggestionSelect={onSuggestionSelect}
          onCloseSuggestions={onCloseSuggestions}
          onUpdateAll={onUpdateAll}
          onToggleDiff={onToggleDiff}
          onTextSelect={onCleanedTextSelect}
          onMoveTargetClick={onCleanedMoveTargetClick}
          onSegmentClick={onSegmentClick}
          editingCount={editingCount}
          onScroll={handleCleanedScroll}
          showRevertButton={showRevertButton}
        />
      </div>

      {/* Expand overlay - only shown when collapsed */}
      <AnimatePresence>
        {!isExpanded && onExpandToggle && variant === "demo" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            onClick={onExpandToggle}
            className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80
                       cursor-pointer z-10 flex items-end justify-center pb-6"
            role="button"
            aria-label={t('expandEditor')}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground
                         rounded-full text-sm font-medium shadow-lg"
            >
              <Maximize2 className="w-4 h-4" />
              <span>{t('clickToExpand')}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
