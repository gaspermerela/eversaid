"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from "react"
import { DemoNavigation } from "@/components/demo/demo-navigation"
import { AnalysisSection } from "@/components/demo/analysis-section"
import { EntryHistoryCard } from "@/components/demo/entry-history-card"
import { FeedbackCard } from "@/components/demo/feedback-card"
import { TextMoveToolbar } from "@/components/demo/text-move-toolbar"
import { TranscriptComparisonLayout } from "@/components/demo/transcript-comparison-layout"
import { AudioPlayer } from "@/components/demo/audio-player"
import { UploadZone } from "@/components/demo/upload-zone"
import type { Segment, SpellcheckError, TextMoveSelection } from "@/components/demo/types"
import { WaitlistFlow } from "@/components/waitlist/waitlist-flow"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useRouter } from "@/i18n/routing"
import { motion, AnimatePresence } from "@/components/motion"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { ErrorDisplay } from "@/components/demo/error-display"
import { RateLimitModal } from "@/components/demo/rate-limit-modal"
import { useTranscription } from "@/features/transcription/useTranscription"
import { useRateLimits } from "@/features/transcription/useRateLimits"
import { ApiError } from "@/features/transcription/types"
import { useFeedback } from "@/features/transcription/useFeedback"
import { useEntries } from "@/features/transcription/useEntries"
import { useAudioPlayer } from "@/features/transcription/useAudioPlayer"
import { useWordHighlight } from "@/features/transcription/useWordHighlight"
import { useAnalysis } from "@/features/transcription/useAnalysis"
import { getEntryAudioUrl } from "@/features/transcription/api"

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

function DemoPageContent() {
   // TODO: Replace ?mock URL param with MSW (Mock Service Worker) for cleaner E2E testing.
  // MSW intercepts network requests at the test level, keeping production code unaware of testing.
  // Current approach: ?mock param enables mock mode for Playwright E2E tests to bypass upload flow.
  // This works but leaks test concerns into production code. See: https://mswjs.io/
  const isMockMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mock')

  // Transcription hook
  const transcription = useTranscription({ mockMode: isMockMode })

  // Translation hook
  const t = useTranslations()

  // Navigation hooks for URL query params (browser back button support)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Feedback hook
  const feedbackHook = useFeedback({
    entryId: transcription.entryId ?? '',
    feedbackType: 'transcription'
  })

  // UI State
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)
  const [isEditorExpanded, setIsEditorExpanded] = useState(false)

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

  // Entry history hook
  const entriesHook = useEntries()

  // Audio playback hook
  const audioUrl = transcription.entryId ? getEntryAudioUrl(transcription.entryId) : null

  const audioPlayer = useAudioPlayer({
    segments: transcription.segments,
    audioUrl,
    onSegmentChange: (segmentId) => setActiveSegmentId(segmentId),
    fallbackDuration: transcription.durationSeconds,
  })

  // Word highlighting hook for playback
  const wordHighlight = useWordHighlight({
    segments: transcription.segments,
    currentTime: audioPlayer.currentTime,
    isPlaying: audioPlayer.isPlaying,
    activeSegmentId,
  })

  // Analysis hook
  const analysisHook = useAnalysis({
    cleanupId: transcription.cleanupId,
    analysisId: transcription.analysisId,
  })

  // Waitlist modal state
  const [waitlistState, setWaitlistState] = useState<"hidden" | "toast" | "form" | "success">("hidden")
  const [waitlistType, setWaitlistType] = useState<"extended_usage" | "api_access">("extended_usage")
  const [waitlistEmail, setWaitlistEmail] = useState("")
  const [waitlistReferralCode, setWaitlistReferralCode] = useState("")

  // Rate limit modal state
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  const rateLimits = useRateLimits()

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

  // Load entry from URL query param on mount (for browser back button support)
  useEffect(() => {
    const entryId = searchParams.get('entry')
    if (entryId && !transcription.entryId && transcription.status === 'idle') {
      transcription.loadEntry(entryId)
    }
  }, [searchParams, transcription.entryId, transcription.status, transcription.loadEntry])

  // Update URL when entry is loaded (creates browser history entry)
  useEffect(() => {
    if (transcription.entryId && transcription.segments.length > 0) {
      const currentEntry = searchParams.get('entry')
      if (currentEntry !== transcription.entryId) {
        router.push(`/demo?entry=${transcription.entryId}`)
      }
    }
  }, [transcription.entryId, transcription.segments.length, searchParams, router])

  // ESC key handler to collapse editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isEditorExpanded && transcription.segments.length > 0) {
        setIsEditorExpanded(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isEditorExpanded, transcription.segments.length])

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

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null)
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
      // Check if this is a rate limit error
      if (err instanceof ApiError && err.isRateLimited) {
        rateLimits.updateFromError(err)
        setShowRateLimitModal(true)
      }
      // Other errors are captured in transcription.error
      console.error('Upload failed:', err)
    }
  }, [selectedFile, selectedSpeakerCount, transcription, rateLimits])

  // Auto-submit feedback for ratings >= 4
  useEffect(() => {
    if (feedbackHook.rating >= 4 && !feedbackHook.isSubmitted && !feedbackHook.isSubmitting) {
      feedbackHook.submit()
    }
  }, [feedbackHook.rating, feedbackHook.isSubmitted, feedbackHook.isSubmitting, feedbackHook])

  // Refresh entry list after upload completes
  useEffect(() => {
    if (transcription.status === 'complete' && transcription.entryId) {
      entriesHook.refresh()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcription.status, transcription.entryId])

  // Load analysis profiles on mount
  useEffect(() => {
    analysisHook.loadProfiles()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Populate analysis cache when analyses are loaded from entry
  useEffect(() => {
    if (transcription.analyses && transcription.analyses.length > 0) {
      analysisHook.populateCache(transcription.analyses)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcription.analyses])

  // Fetch rate limits on mount
  useEffect(() => {
    transcription.fetchRateLimits()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll to active segment during playback
  useEffect(() => {
    if (audioPlayer.isPlaying && audioPlayer.activeSegmentId) {
      const segmentElement = document.querySelector(`[data-segment-id="${audioPlayer.activeSegmentId}"]`)
      if (segmentElement) {
        segmentElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [audioPlayer.isPlaying, audioPlayer.activeSegmentId])

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

  // Rate limit modal handlers
  const handleRateLimitModalClose = useCallback(() => {
    setShowRateLimitModal(false)
  }, [])

  const handleRateLimitJoinWaitlist = useCallback(() => {
    setShowRateLimitModal(false)
    handleOpenWaitlist("extended_usage")
  }, [handleOpenWaitlist])

  // Retry handler for error display
  const handleRetryUpload = useCallback(() => {
    transcription.reset()
    if (selectedFile) {
      handleTranscribeClick()
    }
  }, [transcription, selectedFile, handleTranscribeClick])

  const handleSegmentClick = useCallback((id: string) => {
    setActiveSegmentId(id)
    audioPlayer.seekToSegment(id)
  }, [audioPlayer])

  const handlePlayPause = useCallback(() => {
    audioPlayer.togglePlayPause()
  }, [audioPlayer])

  const handleSeek = useCallback((time: number) => {
    audioPlayer.seek(time)
  }, [audioPlayer])

  const handleDownload = useCallback(() => {
    if (!audioUrl || !transcription.entryId) return

    // Trigger download by creating a temporary link
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = `eversaid-${transcription.entryId}.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [audioUrl, transcription.entryId])

  const handleSpeedChange = useCallback((speed: number) => {
    audioPlayer.setPlaybackSpeed(speed as typeof audioPlayer.playbackSpeed)
  }, [audioPlayer])

  const handleEntrySelect = useCallback(async (entryId: string) => {
    await transcription.loadEntry(entryId)
    feedbackHook.reset()
    // Note: analysisHook auto-resets when transcription.analysisId changes via its useEffect
  }, [transcription, feedbackHook])

  // Handle profile selection - checks cache, then API, then triggers LLM if needed
  const handleSelectProfile = useCallback((profileId: string) => {
    analysisHook.selectProfile(profileId)
  }, [analysisHook])

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
      <OfflineBanner />
      <DemoNavigation />

      <div className="max-w-[1400px] mx-auto px-6 pt-8 pb-4">
        {transcription.segments.length === 0 && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-[#1E293B] mb-2">Try eversaid</h1>
              <p className="text-[#64748B] text-lg">
                Upload audio or record directly. See the AI cleanup difference in seconds.
              </p>
            </div>
            {transcription.rateLimits?.day &&
             transcription.rateLimits.day.remaining <= Number(process.env.NEXT_PUBLIC_RATE_LIMIT_WARNING_THRESHOLD || 2) && (
              <div className="flex gap-4">
                <div className="px-4 py-2 bg-amber-50 rounded-lg border border-amber-200 shadow-sm">
                  <span className="text-sm font-semibold text-amber-700">
                    {t('demo.rateLimit.remaining', { count: transcription.rateLimits.day.remaining })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error display for upload/transcription errors */}
        {transcription.error && transcription.status === 'error' && (
          <div className="mb-6">
            <ErrorDisplay
              error={transcription.error}
              onRetry={handleRetryUpload}
              retryLabel="Try Again"
            />
          </div>
        )}
      </div>

      <main className="mx-auto px-6 max-w-[1400px]">
        {transcription.segments.length === 0 ? (
          /* Upload Mode */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <UploadZone
                selectedSpeakerCount={selectedSpeakerCount}
                isUploading={transcription.status === 'uploading' || transcription.status === 'transcribing'}
                uploadProgress={transcription.uploadProgress}
                hasFile={!!selectedFile}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onRemoveFile={handleRemoveFile}
                onSpeakerCountChange={handleSpeakerCountChange}
                onTranscribeClick={handleTranscribeClick}
              />
            </div>
            <div>
              <EntryHistoryCard
                entries={entriesHook.entries}
                activeId={transcription.entryId}
                onSelect={handleEntrySelect}
                isEmpty={entriesHook.entries.length === 0 && !entriesHook.isLoading}
              />
            </div>
          </div>
        ) : (
          /* Transcript Mode */
          <>
            <div className={`bg-card shadow-lg border border-border overflow-hidden transition-all duration-300 ${
              isEditorExpanded
                ? "fixed inset-x-0 top-16 bottom-0 z-40 rounded-none border-x-0"
                : "rounded-xl mb-12"
            }`}>
              {audioUrl && (
                <audio src={audioUrl} {...audioPlayer.audioProps} preload="metadata" className="hidden" />
              )}
              <div className={`bg-gradient-to-b from-muted/30 to-transparent border-b border-border/50 ${
                isEditorExpanded ? "rounded-none" : "rounded-t-lg"
              }`}>
                <AudioPlayer
                  isPlaying={audioPlayer.isPlaying}
                  currentTime={audioPlayer.currentTime}
                  duration={audioPlayer.duration}
                  playbackSpeed={audioPlayer.playbackSpeed}
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
                activeWordIndex={wordHighlight.activeWordIndex}
                isPlaying={audioPlayer.isPlaying}
                isExpanded={isEditorExpanded}
                onExpandToggle={() => setIsEditorExpanded(true)}
                onClose={() => setIsEditorExpanded(false)}
              />
            </div>

            {/* Analysis and Feedback - animated visibility */}
            <AnimatePresence mode="wait">
              {!isEditorExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{
                    type: "spring",
                    damping: 25,
                    stiffness: 200,
                    delay: 0.1
                  }}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                >
                  <div className="lg:col-span-2">
                    <AnalysisSection
                      analysisType={analysisType}
                      analysisData={analysisHook.data}
                      showAnalysisMenu={showAnalysisMenu}
                      isLoading={analysisHook.isLoading}
                      error={analysisHook.error}
                      profiles={analysisHook.profiles}
                      currentProfileId={analysisHook.currentProfileId}
                      currentProfileLabel={analysisHook.currentProfileLabel}
                      currentProfileIntent={analysisHook.currentProfileIntent}
                      onAnalysisTypeChange={setAnalysisType}
                      onToggleAnalysisMenu={handleToggleAnalysisMenu}
                      onSelectProfile={handleSelectProfile}
                    />
                  </div>

                  <div>
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
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
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
        t={t}
      />

      <RateLimitModal
        isOpen={showRateLimitModal}
        retryAfter={rateLimits.retryAfter}
        onClose={handleRateLimitModalClose}
        onJoinWaitlist={handleRateLimitJoinWaitlist}
      />
    </div>
  )
}

// Wrap in Suspense for useSearchParams (required by Next.js)
export default function DemoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAFA]" />}>
      <DemoPageContent />
    </Suspense>
  )
}
