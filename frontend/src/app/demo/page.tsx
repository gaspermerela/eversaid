"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { DemoNavigation } from "@/components/demo/demo-navigation"
import { AnalysisSection } from "@/components/demo/analysis-section"
import { EntryHistoryCard } from "@/components/demo/entry-history-card"
import { FeedbackCard } from "@/components/demo/feedback-card"
import { TextMoveToolbar } from "@/components/demo/text-move-toolbar"
import { TranscriptComparisonLayout } from "@/components/demo/transcript-comparison-layout"
import { AudioPlayer } from "@/components/demo/audio-player"
import type { Segment, HistoryEntry, SpellcheckError, TextMoveSelection } from "@/components/demo/types"
import { WaitlistFlow } from "@/components/waitlist/waitlist-flow"
import { useTranscription } from "@/features/transcription/useTranscription"
import { useFeedback } from "@/features/transcription/useFeedback"

// Mock spellcheck - in production, call a Slovenian spellcheck API
const checkSpelling = (text: string): SpellcheckError[] => {
  const mockErrors: SpellcheckError[] = []
  const words = text.split(/\b/)
  let position = 0

  const misspellings: Record<string, string[]> = {
    implementaton: ["implementation", "implementacija"],
    teh: ["the", "ta"],
    recieve: ["receive", "prejeti"],
  }

  words.forEach((word) => {
    const cleanWord = word.toLowerCase().replace(/[.,!?]/g, "")
    if (misspellings[cleanWord]) {
      mockErrors.push({
        word: word,
        start: position,
        end: position + word.length,
        suggestions: misspellings[cleanWord],
      })
    }
    position += word.length
  })

  return mockErrors
}

export default function DemoPage() {
  // Transcription hook
  const transcription = useTranscription({ mockMode: false })

  // Feedback hook
  const feedbackHook = useFeedback({
    entryId: transcription.entryId ?? '',
    feedbackType: 'transcription'
  })

  // UI State
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(34)
  const [duration] = useState(285) // Updated duration for more segments (4:45)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedSpeakerCount, setSelectedSpeakerCount] = useState(2)

  // Editing State
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [editedTexts, setEditedTexts] = useState<Map<string, string>>(new Map())
  const [revertedSegments, setRevertedSegments] = useState<Map<string, string>>(new Map())
  const [spellcheckErrors, setSpellcheckErrors] = useState<Map<string, SpellcheckError[]>>(new Map())
  const [activeSuggestion, setActiveSuggestion] = useState<{
    segmentId: string
    word: string
    position: { x: number; y: number }
    suggestions: string[]
  } | null>(null)

  const [showDiff, setShowDiff] = useState(true)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [showAnalysisMenu, setShowAnalysisMenu] = useState(false)

  const [textMoveSelection, setTextMoveSelection] = useState<TextMoveSelection | null>(null)
  const [isSelectingMoveTarget, setIsSelectingMoveTarget] = useState(false)

  // Analysis State
  const [analysisType, setAnalysisType] = useState<"summary" | "action-items" | "sentiment">("summary")

  // History entries
  const [historyEntries] = useState<HistoryEntry[]>([
    {
      id: "entry-1",
      filename: "team-meeting.mp3",
      duration: "03:28",
      status: "complete",
      timestamp: "2025-01-15T10:30:00Z",
    },
  ])

  // Analysis data
  const analysisData = {
    summary:
      "A discussion about project planning and resource allocation, focusing on establishing a timeline and bringing in external expertise for technical aspects.",
    topics: [
      "Project timeline",
      "Research phase",
      "External consultants",
      "Machine learning expertise",
      "Budget allocation",
      "Vendor selection",
    ],
    keyPoints: [
      "Proposed starting with research phase before design work",
      "Need to ensure team alignment on project approach",
      "Considering bringing in external consultants for technical expertise",
      "Identified need for machine learning expertise in data processing",
      "Q3 contingency fund available for consultant costs",
      "Follow-up meeting scheduled for Thursday to finalize requirements",
    ],
  }

  // Waitlist modal state
  const [waitlistState, setWaitlistState] = useState<"hidden" | "toast" | "form" | "success">("hidden")
  const [waitlistType, setWaitlistType] = useState<"extended_usage" | "api_access">("extended_usage")
  const [waitlistEmail, setWaitlistEmail] = useState("")
  const [waitlistReferralCode, setWaitlistReferralCode] = useState("")

  const rawScrollRef = useRef<HTMLDivElement>(null)
  const cleanedScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingScrollRef = useRef(false)

  const handleRawScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScrollRef.current) return

    const rawEl = e.currentTarget
    const cleanedEl = cleanedScrollRef.current
    if (!cleanedEl) return

    isSyncingScrollRef.current = true

    // Calculate scroll percentage
    const scrollPercentage = rawEl.scrollTop / (rawEl.scrollHeight - rawEl.clientHeight)
    // Apply to cleaned side
    cleanedEl.scrollTop = scrollPercentage * (cleanedEl.scrollHeight - cleanedEl.clientHeight)

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

    // Calculate scroll percentage
    const scrollPercentage = cleanedEl.scrollTop / (cleanedEl.scrollHeight - cleanedEl.clientHeight)
    // Apply to raw side
    rawEl.scrollTop = scrollPercentage * (rawEl.scrollHeight - rawEl.clientHeight)

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false
    })
  }

  // Sync segment heights
  useEffect(() => {
    const syncHeights = () => {
      transcription.segments.forEach((seg) => {
        const rawSegment = document.querySelector(`[data-segment-id="${seg.id}"]`) as HTMLElement
        const cleanedSegments = document.querySelectorAll(`[data-segment-id="${seg.id}"]`) as NodeListOf<HTMLElement>

        if (rawSegment && cleanedSegments.length === 2) {
          const cleanedSegment = cleanedSegments[1]
          const rawHeight = rawSegment.offsetHeight
          const cleanedHeight = cleanedSegment.offsetHeight
          const maxHeight = Math.max(rawHeight, cleanedHeight)

          rawSegment.style.minHeight = `${maxHeight}px`
          cleanedSegment.style.minHeight = `${maxHeight}px`
        }
      })
    }

    syncHeights()
    window.addEventListener("resize", syncHeights)
    return () => window.removeEventListener("resize", syncHeights)
  }, [transcription.segments, showDiff])

  // Segment Handlers
  const handleRevertSegment = useCallback(
    async (segmentId: string) => {
      const originalCleaned = await transcription.revertSegmentToRaw(segmentId)
      if (originalCleaned) {
        setRevertedSegments((prev) => new Map(prev).set(segmentId, originalCleaned))
      }
    },
    [transcription],
  )

  const handleUndoRevert = useCallback((segmentId: string) => {
    const originalCleanedText = revertedSegments.get(segmentId)
    if (originalCleanedText) {
      transcription.undoRevert(segmentId, originalCleanedText)
      setRevertedSegments((prev) => {
        const newMap = new Map(prev)
        newMap.delete(segmentId)
        return newMap
      })
    }
  }, [revertedSegments, transcription])

  const handleSaveSegment = useCallback(
    async (segmentId: string) => {
      const newText = editedTexts.get(segmentId)
      if (newText !== undefined) {
        await transcription.updateSegmentCleanedText(segmentId, newText)
      }
      setEditingSegmentId(null)
      setEditedTexts((prev) => {
        const newMap = new Map(prev)
        newMap.delete(segmentId)
        return newMap
      })
      setRevertedSegments((prev) => {
        const newMap = new Map(prev)
        newMap.delete(segmentId)
        return newMap
      })
    },
    [editedTexts, transcription],
  )

  const handleSegmentEditStart = useCallback(
    (segmentId: string) => {
      const segment = transcription.segments.find((s) => s.id === segmentId)
      if (segment) {
        setEditingSegmentId(segmentId)
        if (!editedTexts.has(segmentId)) {
          setEditedTexts((prev) => new Map(prev).set(segmentId, segment.cleanedText))
        }
      }
    },
    [transcription.segments, editedTexts],
  )

  const handleSegmentEditCancel = useCallback((segmentId: string) => {
    setEditingSegmentId(null)
    setEditedTexts((prev) => {
      const newMap = new Map(prev)
      newMap.delete(segmentId)
      return newMap
    })
    setActiveSuggestion(null)
  }, [])

  const handleTextChange = useCallback((segmentId: string, text: string) => {
    setEditedTexts((prev) => new Map(prev).set(segmentId, text))
  }, [])

  const handleWordClick = useCallback((segmentId: string, e: React.MouseEvent, error: SpellcheckError) => {
    e.stopPropagation()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setActiveSuggestion({
      segmentId,
      word: error.word,
      position: { x: rect.left, y: rect.bottom + 5 },
      suggestions: error.suggestions,
    })
  }, [])

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      if (!activeSuggestion) return

      const segmentId = activeSuggestion.segmentId
      const currentText = editedTexts.get(segmentId) || ""
      const errors = spellcheckErrors.get(segmentId) || []
      const error = errors.find((e) => e.word === activeSuggestion.word)

      if (error) {
        const newText = currentText.substring(0, error.start) + suggestion + currentText.substring(error.end)
        setEditedTexts((prev) => new Map(prev).set(segmentId, newText))
      }
      setActiveSuggestion(null)
    },
    [activeSuggestion, editedTexts, spellcheckErrors],
  )

  const handleCloseSuggestions = useCallback(() => {
    setActiveSuggestion(null)
  }, [])

  const handleUpdateAllSegments = useCallback(async () => {
    // Save all edited texts to API
    for (const [segmentId, text] of editedTexts.entries()) {
      await transcription.updateSegmentCleanedText(segmentId, text)
    }
    setEditingSegmentId(null)
    setEditedTexts(new Map())
  }, [editedTexts, transcription])

  const handleToggleDiff = useCallback(() => {
    setShowDiff((prev) => !prev)
  }, [])

  const handleToggleSpeedMenu = useCallback(() => {
    setShowSpeedMenu((prev) => !prev)
  }, [])

  const handleToggleAnalysisMenu = useCallback(() => {
    setShowAnalysisMenu((prev) => !prev)
  }, [])

  const handleRawTextSelect = useCallback((segmentId: string, text: string, startOffset: number, endOffset: number) => {
    setTextMoveSelection({
      text,
      sourceSegmentId: segmentId,
      sourceColumn: "raw",
      startOffset,
      endOffset,
    })
    setIsSelectingMoveTarget(false)
  }, [])

  const handleCleanedTextSelect = useCallback(
    (segmentId: string, text: string, startOffset: number, endOffset: number) => {
      setTextMoveSelection({
        text,
        sourceSegmentId: segmentId,
        sourceColumn: "cleaned",
        startOffset,
        endOffset,
      })
      setIsSelectingMoveTarget(false)
    },
    [],
  )

  const handleMoveClick = useCallback(() => {
    if (textMoveSelection) {
      setIsSelectingMoveTarget(true)
    }
  }, [textMoveSelection])

  const handleCancelTextMove = useCallback(() => {
    setTextMoveSelection(null)
    setIsSelectingMoveTarget(false)
    window.getSelection()?.removeAllRanges()
  }, [])

  const handleRawMoveTargetClick = useCallback(
    (targetSegmentId: string) => {
      // TODO: Text move feature needs API support for moving text between segments
      // For now, this feature is disabled until API endpoint is available
      console.warn("Text move feature not yet implemented with API")
      setTextMoveSelection(null)
      setIsSelectingMoveTarget(false)
      window.getSelection()?.removeAllRanges()
    },
    [textMoveSelection],
  )

  const handleCleanedMoveTargetClick = useCallback(
    (targetSegmentId: string) => {
      // TODO: Text move feature needs API support for moving text between segments
      // For now, this feature is disabled until API endpoint is available
      console.warn("Text move feature not yet implemented with API")
      setTextMoveSelection(null)
      setIsSelectingMoveTarget(false)
      window.getSelection()?.removeAllRanges()
    },
    [textMoveSelection],
  )

  // Upload Handlers
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
  }, [])

  const handleSpeakerCountChange = useCallback((count: number) => {
    setSelectedSpeakerCount(count)
    // Speaker count will be used on next upload
    // No segment switching - real data comes from API
  }, [])

  const handleTranscribeClick = useCallback(async () => {
    if (!selectedFile) return
    try {
      await transcription.uploadAudio(selectedFile, selectedSpeakerCount)
    } catch (err) {
      // Error is captured in transcription.error
      console.error('Upload failed:', err)
    }
  }, [selectedFile, selectedSpeakerCount, transcription])

  // Auto-submit feedback for ratings >= 4
  useEffect(() => {
    if (feedbackHook.rating >= 4 && !feedbackHook.isSubmitted && !feedbackHook.isSubmitting) {
      feedbackHook.submit()
    }
  }, [feedbackHook.rating, feedbackHook.isSubmitted, feedbackHook.isSubmitting, feedbackHook])

  // Waitlist Handlers
  const handleOpenWaitlist = useCallback((type: "extended_usage" | "api_access" = "extended_usage") => {
    setWaitlistType(type)
    setWaitlistState("form")
  }, [])

  const handleWaitlistSubmit = useCallback(() => {
    // Simulate API call
    setTimeout(() => {
      setWaitlistReferralCode("EVERSAID-" + Math.random().toString(36).substring(2, 8).toUpperCase())
      setWaitlistState("success")
    }, 500)
  }, [])

  const handleWaitlistClose = useCallback(() => {
    setWaitlistState("hidden")
    setWaitlistEmail("")
  }, [])

  const handleSegmentClick = useCallback((id: string) => {
    setActiveSegmentId(id)
  }, [])

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  const handleDownload = useCallback(() => {
    console.log("Download requested")
  }, [])

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed)
  }, [])

  const editingCount = Array.from(editedTexts.entries()).filter(([id, text]) => {
    const segment = transcription.segments.find((s) => s.id === id)
    return segment && text !== segment.cleanedText
  }).length

  const showSpeakerLabels = useMemo(() => {
    const uniqueSpeakers = new Set(transcription.segments.map((seg) => seg.speaker))
    return uniqueSpeakers.size > 1
  }, [transcription.segments])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <DemoNavigation />

      <div className="max-w-[1400px] mx-auto px-6 pt-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-[#1E293B] mb-2">Try eversaid</h1>
            <p className="text-[#64748B] text-lg">
              Upload audio or record directly. See the AI cleanup difference in seconds.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="px-4 py-2 bg-white rounded-lg border border-[#E2E8F0] shadow-sm">
              <span className="text-sm font-semibold text-[#64748B]">
                {transcription.rateLimits?.day
                  ? `${transcription.rateLimits.day.remaining}/${transcription.rateLimits.day.limit}`
                  : '--/--'}
              </span>
              <span className="text-xs text-[#94A3B8] ml-1">daily</span>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto px-6 max-w-[1400px]">
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-8">
          <div className="bg-gradient-to-b from-muted/30 to-transparent border-b border-border/50 rounded-t-lg">
            <AudioPlayer
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              playbackSpeed={playbackSpeed}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              onSpeedChange={handleSpeedChange}
              onDownload={handleDownload}
            />
          </div>

          {/* Transcript comparison directly below */}
          <TranscriptComparisonLayout
            segments={transcription.segments}
            activeSegmentId={activeSegmentId}
            editingSegmentId={editingSegmentId}
            editedTexts={editedTexts}
            revertedSegments={revertedSegments}
            spellcheckErrors={spellcheckErrors}
            showDiff={showDiff}
            showSpeakerLabels={showSpeakerLabels}
            textMoveSelection={textMoveSelection}
            isSelectingMoveTarget={isSelectingMoveTarget}
            activeSuggestion={activeSuggestion}
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
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AnalysisSection
              analysisType={analysisType}
              analysisData={analysisData}
              showAnalysisMenu={showAnalysisMenu}
              onAnalysisTypeChange={setAnalysisType}
              onToggleAnalysisMenu={handleToggleAnalysisMenu}
            />
          </div>

          <div className="space-y-6">
            <EntryHistoryCard entries={historyEntries} />
            <FeedbackCard
              rating={feedbackHook.rating}
              feedback={feedbackHook.feedbackText}
              onRatingChange={feedbackHook.setRating}
              onFeedbackChange={feedbackHook.setFeedbackText}
              onSubmit={feedbackHook.submit}
              isSubmitting={feedbackHook.isSubmitting}
              isSubmitted={feedbackHook.isSubmitted}
              disabled={!transcription.entryId}
            />
          </div>
        </div>
      </main>

      {textMoveSelection && (
        <TextMoveToolbar
          selectedText={textMoveSelection.text}
          isSelectingTarget={isSelectingMoveTarget}
          onMoveClick={() => setIsSelectingMoveTarget(true)}
          onCancel={handleCancelTextMove}
        />
      )}

      <WaitlistFlow
        state={waitlistState}
        type={waitlistType}
        email={waitlistEmail}
        referralCode={waitlistReferralCode}
        onEmailChange={setWaitlistEmail}
        onSubmit={handleWaitlistSubmit}
        onClose={handleWaitlistClose}
        onOpenForm={() => setWaitlistState("form")}
      />
    </div>
  )
}
