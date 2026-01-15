"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from "react"
import { DemoNavigation } from "@/components/demo/demo-navigation"
import { AnalysisSection } from "@/components/demo/analysis-section"
import { DemoWarningBanner } from "@/components/demo/demo-warning-banner"
import { EntryHistoryCard } from "@/components/demo/entry-history-card"
import { FeedbackCard } from "@/components/demo/feedback-card"
// TextMoveToolbar temporarily disabled - kept for future use
// import { TextMoveToolbar } from "@/components/demo/text-move-toolbar"
import { TranscriptComparisonLayout } from "@/components/demo/transcript-comparison-layout"
import { TranscriptLoadingSkeleton } from "@/components/demo/transcript-loading-skeleton"
import { AudioPlayer } from "@/components/demo/audio-player"
import { UploadZone } from "@/components/demo/upload-zone"
import { ExpandableCard } from "@/components/demo/expandable-card"
import type { SpellcheckError, TextMoveSelection } from "@/components/demo/types"
import { WaitlistFlow } from "@/components/waitlist/waitlist-flow"
import { useWaitlist } from "@/features/transcription/useWaitlist"
import { useTranslations, useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useRouter } from "@/i18n/routing"
import { motion, AnimatePresence } from "@/components/motion"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { PersistentWarning } from "@/components/ui/persistent-warning"
import { ErrorDisplay } from "@/components/demo/error-display"
import { RateLimitModal } from "@/components/demo/rate-limit-modal"
import { RecordingModal } from "@/components/demo/recording-modal"
import { useTranscription } from "@/features/transcription/useTranscription"
import { useVoiceRecorder } from "@/features/transcription/useVoiceRecorder"
import { useRateLimits } from "@/features/transcription/useRateLimits"
import { ApiError, type ModelInfo, type CleanupType, type CleanupSummary } from "@/features/transcription/types"
import { useFeedback } from "@/features/transcription/useFeedback"
import { useEntries } from "@/features/transcription/useEntries"
import { useAudioPlayer } from "@/features/transcription/useAudioPlayer"
import { useWordHighlight } from "@/features/transcription/useWordHighlight"
import { useAnalysis } from "@/features/transcription/useAnalysis"
import { useProcessingStages } from "@/features/transcription/useProcessingStages"
import { getEntryAudioUrl, getOptions, getCleanedEntries, getCleanedEntry } from "@/features/transcription/api"
import { getCleanupModels, getAnalysisModels, getDefaultModelForLevel } from "@/lib/model-config"
import { toast } from "sonner"
import { useDemoCleanupTrigger } from "@/features/transcription/useDemoCleanupTrigger"
import { ProcessingStages } from "@/components/demo/processing-stages"

// Singleton promise for session initialization - prevents concurrent calls
// from Suspense/hydration remounts while allowing re-init after navigation
let sessionInitPromise: Promise<void> | null = null

// Feature flag for model selection UI (controlled via NEXT_PUBLIC_ENABLE_MODEL_SELECTION env var)
const isModelSelectionEnabled = process.env.NEXT_PUBLIC_ENABLE_MODEL_SELECTION === 'true'

// Mock spellcheck - in production, call a Slovenian spellcheck API
// Kept for future use when spellcheck feature is implemented
const _checkSpelling = (text: string): SpellcheckError[] => {
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
  // Navigation hooks for URL query params (browser back button support)
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL-based flags (use searchParams hook to avoid hydration mismatch)
  const isTestWarning = searchParams.has('testWarning')

  // Transcription hook
  const transcription = useTranscription()

  // Translation hook
  const t = useTranslations()

  // Locale hook - kept for future i18n usage
  const _locale = useLocale()

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

  // LLM Model Selection State
  const [cleanupModels, setCleanupModels] = useState<ModelInfo[]>([])
  const [analysisModels, setAnalysisModels] = useState<ModelInfo[]>([])
  const [selectedCleanupModel, setSelectedCleanupModel] = useState<string>('')
  const [selectedCleanupLevel, setSelectedCleanupLevel] = useState<CleanupType>('corrected')
  const [selectedAnalysisModel, setSelectedAnalysisModel] = useState<string>('')
  // Track if user has manually selected a model (vs using defaults)
  const [hasManualCleanupModelSelection, setHasManualCleanupModelSelection] = useState(false)
  // Cache of completed cleanups for indicator and avoiding re-processing
  const [cleanupCache, setCleanupCache] = useState<CleanupSummary[]>([])

  // Editing State
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [editedTexts, setEditedTexts] = useState<Map<string, string>>(new Map())
  const [revertedSegments, setRevertedSegments] = useState<Map<string, string>>(new Map())
  const [spellcheckErrors, _setSpellcheckErrors] = useState<Map<string, SpellcheckError[]>>(new Map())
  const [activeSuggestion, setActiveSuggestion] = useState<{
    segmentId: string
    word: string
    position: { x: number; y: number }
    suggestions: string[]
  } | null>(null)

  const [showDiff, setShowDiff] = useState(true)
  const [_showSpeedMenu, _setShowSpeedMenu] = useState(false)
  const [showAnalysisMenu, setShowAnalysisMenu] = useState(false)

  const [textMoveSelection, setTextMoveSelection] = useState<TextMoveSelection | null>(null)
  const [isSelectingMoveTarget, setIsSelectingMoveTarget] = useState(false)

  // Analysis State
  const [analysisType, setAnalysisType] = useState<"summary" | "action-items" | "sentiment">("summary")

  // Session initialization state (prevents race condition on first load)
  const [sessionReady, setSessionReady] = useState(false)

  // Entry history hook (autoFetch disabled - we fetch after session is ready)
  // Demo entries are automatically copied to user's history by the database trigger
  const entriesHook = useEntries({
    autoFetch: false,
  })

  // Auto-trigger cleanup for demo entries when they load
  // This updates sidebar from "Processing" → "Complete" without user clicking
  useDemoCleanupTrigger({
    entries: entriesHook.rawEntries,
    isLoading: entriesHook.isLoading,
    onRefresh: entriesHook.refresh,
  })

  // Audio playback hook
  // All entries (including demo) use the standard entry audio URL
  const audioUrl = transcription.entryId
    ? getEntryAudioUrl(transcription.entryId)
    : null

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

  // Processing stages for progress UI
  const processingStages = useProcessingStages({
    status: transcription.status,
    isAnalyzing: analysisHook.isPolling,
    hasError: transcription.status === 'error',
  })

  // Waitlist modal state
  const [waitlistState, setWaitlistState] = useState<"hidden" | "toast" | "form" | "success">("hidden")
  const [waitlistType, setWaitlistType] = useState<"extended_usage" | "api_access">("extended_usage")

  // Form fields (not managed by hook)
  const [useCase, setUseCase] = useState("")
  const [volume, setVolume] = useState("")
  const [source, setSource] = useState("")
  const [copied, setCopied] = useState(false)

  // Hook for API integration
  const waitlist = useWaitlist({
    waitlistType,
    sourcePage: '/demo'
  })

  // Rate limit modal state
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  const rateLimits = useRateLimits()

  // Recording modal state
  const [showRecordingModal, setShowRecordingModal] = useState(false)
  const recorder = useVoiceRecorder()

  // Track deleted entry IDs to prevent reloading from URL after deletion
  const deletedEntryRef = useRef<string | null>(null)

  // Load entry from URL query param on mount (for browser back button support)
  // Wait for sessionReady to avoid race condition where multiple requests
  // with invalid session cookie create separate sessions
  useEffect(() => {
    if (!sessionReady) return

    const entryId = searchParams.get('entry')
    // Don't reload if this entry was just deleted
    if (entryId && entryId === deletedEntryRef.current) {
      return
    }
    if (entryId && !transcription.entryId && transcription.status === 'idle') {
      // loadEntry handles both demo and real entries
      // Demo entries detected by "demo-*" ID pattern
      transcription.loadEntry(entryId)
    }
  }, [sessionReady, searchParams, transcription.entryId, transcription.status, transcription.loadEntry])

  // Update URL when entry is loaded (creates browser history entry)
  // Use a ref to track if we've already pushed this entry to avoid loops
  const pushedEntryRef = useRef<string | null>(null)
  useEffect(() => {
    // Only update URL when transcription is complete and we have an entryId
    if (transcription.entryId && transcription.status === 'complete') {
      const currentEntry = searchParams.get('entry')
      // Only push if:
      // 1. URL doesn't match current entryId
      // 2. We haven't already pushed this entryId
      if (currentEntry !== transcription.entryId && pushedEntryRef.current !== transcription.entryId) {
        pushedEntryRef.current = transcription.entryId
        router.push(`/demo?entry=${transcription.entryId}`)
      }
    }
    // Reset the ref if entryId changes (new entry loaded)
    if (pushedEntryRef.current && pushedEntryRef.current !== transcription.entryId) {
      pushedEntryRef.current = null
    }
  }, [transcription.entryId, transcription.status, searchParams, router])

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

  // Height sync logic removed - moved to transcript-comparison-layout component

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

  const _handleToggleSpeedMenu = useCallback(() => {
    _setShowSpeedMenu((prev) => !prev)
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

  const _handleMoveClick = useCallback(() => {
    if (textMoveSelection) {
      setIsSelectingMoveTarget(true)
    }
  }, [textMoveSelection])

  const _handleCancelTextMove = useCallback(() => {
    setTextMoveSelection(null)
    setIsSelectingMoveTarget(false)
    window.getSelection()?.removeAllRanges()
  }, [])

  const handleCleanedMoveTargetClick = useCallback(
    async (targetSegmentId: string) => {
      if (!textMoveSelection || textMoveSelection.sourceColumn !== "cleaned") {
        // Only support moving from cleaned column
        setTextMoveSelection(null)
        setIsSelectingMoveTarget(false)
        window.getSelection()?.removeAllRanges()
        return
      }

      const { sourceSegmentId, text: selectedText } = textMoveSelection

      // Don't move to the same segment
      if (sourceSegmentId === targetSegmentId) {
        setTextMoveSelection(null)
        setIsSelectingMoveTarget(false)
        window.getSelection()?.removeAllRanges()
        return
      }

      // Find source and target segments
      const sourceSegment = transcription.segments.find((s) => s.id === sourceSegmentId)
      const targetSegment = transcription.segments.find((s) => s.id === targetSegmentId)

      if (!sourceSegment || !targetSegment) {
        setTextMoveSelection(null)
        setIsSelectingMoveTarget(false)
        window.getSelection()?.removeAllRanges()
        return
      }

      // Get the current text (either from editedTexts or the segment)
      const sourceCurrentText = editedTexts.get(sourceSegmentId) ?? sourceSegment.cleanedText
      const targetCurrentText = editedTexts.get(targetSegmentId) ?? targetSegment.cleanedText

      // Find the selected text in the source text
      // Note: DOM offsets are unreliable due to diff rendering, so we search for the text instead
      const selectedTextTrimmed = selectedText.trim()
      const textIndex = sourceCurrentText.indexOf(selectedTextTrimmed)

      if (textIndex === -1) {
        // Selected text not found in source - this shouldn't happen but handle gracefully
        console.warn("Selected text not found in source segment")
        setTextMoveSelection(null)
        setIsSelectingMoveTarget(false)
        window.getSelection()?.removeAllRanges()
        return
      }

      // Remove selected text from source
      const newSourceText =
        sourceCurrentText.slice(0, textIndex) + sourceCurrentText.slice(textIndex + selectedTextTrimmed.length)

      // Append selected text to target (with space if needed)
      const needsSpace = targetCurrentText.length > 0 && !targetCurrentText.endsWith(" ")
      const newTargetText = targetCurrentText + (needsSpace ? " " : "") + selectedTextTrimmed

      // Update both segments via the hook
      const updates = new Map<string, string>()
      updates.set(sourceSegmentId, newSourceText.trim())
      updates.set(targetSegmentId, newTargetText)

      await transcription.updateMultipleSegments(updates)

      // Clear local editing state for these segments
      setEditedTexts((prev) => {
        const newMap = new Map(prev)
        newMap.delete(sourceSegmentId)
        newMap.delete(targetSegmentId)
        return newMap
      })

      // Clear text move state
      setTextMoveSelection(null)
      setIsSelectingMoveTarget(false)
      window.getSelection()?.removeAllRanges()
    },
    [textMoveSelection, transcription, editedTexts],
  )

  const handleRawMoveTargetClick = useCallback(
    (targetSegmentId: string) => {
      // Raw text is immutable (original transcription), so we don't support moving to raw column
      // Instead, redirect to cleaned column move if the selection is from cleaned
      if (textMoveSelection?.sourceColumn === "cleaned") {
        handleCleanedMoveTargetClick(targetSegmentId)
        return
      }
      // For raw-to-raw moves, just cancel (raw text shouldn't be edited)
      setTextMoveSelection(null)
      setIsSelectingMoveTarget(false)
      window.getSelection()?.removeAllRanges()
    },
    [textMoveSelection, handleCleanedMoveTargetClick],
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

  // Handler for cleanup model change - uses cached cleanup if available
  const handleCleanupModelChange = useCallback(async (modelId: string) => {
    const previousModel = selectedCleanupModel
    setSelectedCleanupModel(modelId)
    // Mark as manual selection so level changes don't override
    setHasManualCleanupModelSelection(true)
    if (!transcription.transcriptionId || !transcription.entryId) return

    try {
      // Check if cleanup already exists (exact match on cleanup_type)
      const existing = cleanupCache.find(c =>
        c.llm_model === modelId &&
        c.cleanup_type === selectedCleanupLevel &&
        c.status === 'completed'
      )

      if (existing) {
        // CACHED: Fetch existing cleanup (no LLM call)
        const { data: cleanup } = await getCleanedEntry(existing.id)
        transcription.loadCleanupData(cleanup)
        return
      }

      // NOT CACHED: Trigger new cleanup
      await transcription.reprocessCleanup({
        cleanupType: selectedCleanupLevel,
        llmModel: modelId,
      })
      // Refresh cache after completion
      const { data: updatedCleanups } = await getCleanedEntries(transcription.entryId)
      setCleanupCache(updatedCleanups)
    } catch (err) {
      console.error('Re-cleanup failed:', err)
      // Revert to previous model and show error
      setSelectedCleanupModel(previousModel)
      toast.error(t('demo.cleanup.modelChangeFailed'))
    }
  }, [transcription, selectedCleanupLevel, selectedCleanupModel, cleanupCache, t])

  // Handler for cleanup level change - uses cached cleanup if available
  const handleCleanupLevelChange = useCallback(async (level: CleanupType) => {
    const previousLevel = selectedCleanupLevel
    setSelectedCleanupLevel(level)
    if (!transcription.transcriptionId || !transcription.entryId) return

    // Only switch to level default if user hasn't manually selected a model
    let modelToUse = selectedCleanupModel
    if (!hasManualCleanupModelSelection) {
      const levelDefault = getDefaultModelForLevel(level)
      if (levelDefault) {
        modelToUse = levelDefault
        setSelectedCleanupModel(levelDefault)
      }
    }

    try {
      // Check if cleanup already exists (exact match on cleanup_type)
      const existing = modelToUse ? cleanupCache.find(c =>
        c.llm_model === modelToUse &&
        c.cleanup_type === level &&
        c.status === 'completed'
      ) : null

      if (existing) {
        // CACHED: Fetch existing cleanup (no LLM call)
        const { data: cleanup } = await getCleanedEntry(existing.id)
        transcription.loadCleanupData(cleanup)
        return
      }

      // NOT CACHED: Trigger new cleanup
      await transcription.reprocessCleanup({
        cleanupType: level,
        llmModel: modelToUse,
      })
      // Refresh cache after completion
      const { data: updatedCleanups } = await getCleanedEntries(transcription.entryId)
      setCleanupCache(updatedCleanups)
    } catch (err) {
      console.error('Re-cleanup failed:', err)
      // Revert to previous level and show error
      setSelectedCleanupLevel(previousLevel)
      toast.error(t('demo.cleanup.levelChangeFailed'))
    }
  }, [transcription, selectedCleanupModel, selectedCleanupLevel, cleanupCache, hasManualCleanupModelSelection, t])

  // Handler for analysis model change - auto-triggers re-analysis
  const handleAnalysisModelChange = useCallback(async (modelId: string) => {
    const previousModel = selectedAnalysisModel
    setSelectedAnalysisModel(modelId)
    if (!transcription.cleanupId || !analysisHook.currentProfileId) return

    try {
      await analysisHook.runAnalysis(analysisHook.currentProfileId, modelId)
    } catch (err) {
      console.error('Re-analysis failed:', err)
      // Revert to previous model and show error
      setSelectedAnalysisModel(previousModel)
      toast.error(t('demo.analysis.modelChangeFailed'))
    }
  }, [transcription.cleanupId, analysisHook, selectedAnalysisModel, t])

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

  // Refresh entry list after upload completes
  useEffect(() => {
    if (transcription.status === 'complete' && transcription.entryId) {
      entriesHook.refresh()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcription.status, transcription.entryId])

  // Initialize session: fetch rate limits first (establishes session cookie)
  // Then mark session as ready for other API calls
  // Use singleton promise to prevent concurrent calls from Suspense/hydration remounts
  useEffect(() => {
    const initSession = async () => {
      // If already initializing, wait for it
      if (sessionInitPromise) {
        await sessionInitPromise
        setSessionReady(true)
        return
      }

      // Start initialization (singleton pattern)
      sessionInitPromise = transcription.fetchRateLimits()
      try {
        await sessionInitPromise
        setSessionReady(true)
      } finally {
        // Clear promise after completion to allow re-init after navigation
        sessionInitPromise = null
      }
    }
    initSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After session is ready, fetch entries, analysis profiles, and LLM options
  useEffect(() => {
    if (sessionReady) {
      entriesHook.refresh()
      analysisHook.loadProfiles()
      // Fetch available LLM models if model selection feature is enabled
      if (isModelSelectionEnabled) {
        getOptions().then(({ data }) => {
          const filteredCleanup = getCleanupModels(data.llm.models)
          const filteredAnalysis = getAnalysisModels(data.llm.models)

          setCleanupModels(filteredCleanup)
          setAnalysisModels(filteredAnalysis)

          if (filteredCleanup.length > 0) {
            setSelectedCleanupModel(filteredCleanup[0].id)
          }
          if (filteredAnalysis.length > 0) {
            setSelectedAnalysisModel(filteredAnalysis[0].id)
          }
        }).catch((err) => {
          console.error('Failed to fetch options:', err)
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady])

  // Populate analysis cache when analyses are loaded from entry
  useEffect(() => {
    if (transcription.analyses && transcription.analyses.length > 0) {
      analysisHook.populateCache(transcription.analyses)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcription.analyses])

  // Sync cleanup model selection with actual model used (when loading entry)
  useEffect(() => {
    if (transcription.cleanupModelName) {
      setSelectedCleanupModel(transcription.cleanupModelName)
    }
  }, [transcription.cleanupModelName])

  // Sync analysis model selection with actual model used (when loading entry)
  useEffect(() => {
    if (analysisHook.currentAnalysisModelName) {
      setSelectedAnalysisModel(analysisHook.currentAnalysisModelName)
    }
  }, [analysisHook.currentAnalysisModelName])

  // Build cleanup cache when entry loads (for cache indicator)
  // Stores full CleanupSummary array for exact matching by cleanup_type
  useEffect(() => {
    if (transcription.entryId) {
      // Reset manual model selection when loading a new entry
      // This allows defaults to be used again for fresh entries
      setHasManualCleanupModelSelection(false)
      getCleanedEntries(transcription.entryId).then(({ data }) => {
        setCleanupCache(data)
        const completedCount = data.filter(c => c.status === 'completed').length
        console.log('[Demo] Cleanup cache built:', completedCount, 'completed entries')
      }).catch((err) => {
        console.error('Failed to fetch cleanups for cache:', err)
      })
    } else {
      // Clear cache when no entry is loaded
      setCleanupCache([])
    }
  }, [transcription.entryId])

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

  const handleWaitlistSubmit = useCallback(async () => {
    await waitlist.submit({ useCase, volume, source })
    // Transition to success state - the hook handles errors internally with toasts
    setWaitlistState("success")
  }, [waitlist, useCase, volume, source])

  const handleWaitlistClose = useCallback(() => {
    setWaitlistState("hidden")
    setUseCase("")
    setVolume("")
    setSource("")
    setCopied(false)
    waitlist.reset()
  }, [waitlist])

  const handleWaitlistCopyLink = useCallback(() => {
    const referralLink = `https://eversaid.com?ref=${waitlist.referralCode}`
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [waitlist.referralCode])

  // Rate limit modal handlers
  const handleRateLimitModalClose = useCallback(() => {
    setShowRateLimitModal(false)
  }, [])

  const handleRateLimitJoinWaitlist = useCallback(() => {
    setShowRateLimitModal(false)
    handleOpenWaitlist("extended_usage")
  }, [handleOpenWaitlist])

  // Recording modal handlers
  const handleRecordClick = useCallback(() => {
    setShowRecordingModal(true)
  }, [])

  const handleRecordingConfirm = useCallback(() => {
    if (recorder.audioBlob) {
      const file = new File(
        [recorder.audioBlob],
        `recording-${Date.now()}.webm`,
        { type: recorder.audioBlob.type }
      )
      setSelectedFile(file)
      setShowRecordingModal(false)
      recorder.resetRecording()
    }
  }, [recorder])

  const handleRecordingClose = useCallback(() => {
    setShowRecordingModal(false)
    recorder.resetRecording()
  }, [recorder])

  const handleReRecord = useCallback(() => {
    recorder.resetRecording()
  }, [recorder])

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
    try {
      // loadEntry handles both demo and real entries
      // Demo entries detected by "demo-*" ID pattern
      await transcription.loadEntry(entryId)
      // Note: feedbackHook auto-loads existing feedback when entryId changes via its useEffect
      // Note: analysisHook auto-resets when transcription.analysisId changes via its useEffect
    } catch (err) {
      // If entry was deleted (404), remove from list and stay on upload mode
      if (err instanceof ApiError && err.status === 404) {
        await entriesHook.refresh()
      }
    }
  }, [transcription, entriesHook])

  // Handle entry deletion
  const handleDeleteEntry = useCallback(async (entryId: string) => {
    const deleted = await entriesHook.deleteEntry(entryId)
    if (deleted && transcription.entryId === entryId) {
      // Mark as deleted to prevent useEffect from trying to reload from URL
      deletedEntryRef.current = entryId
      // Clear URL and reset to upload mode
      router.push('/demo')
      transcription.reset()
    }
  }, [entriesHook, transcription, router])

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

  // Computed state for loading skeleton
  // Show loading when: actively loading OR when URL has entry param but hasn't started loading yet
  const hasEntryParam = !!searchParams.get('entry')
  const isLoadingEntry = transcription.segments.length === 0 &&
    (transcription.status === 'loading' || (hasEntryParam && transcription.status === 'idle'))

  // Show processing stages when loading an existing entry that's still processing
  // (has entry ID, no segments yet, and is transcribing/cleaning)
  const isLoadingProcessingEntry = transcription.entryId &&
    transcription.segments.length === 0 &&
    ['transcribing', 'cleaning'].includes(transcription.status)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <OfflineBanner />
      <PersistentWarning
        message={transcription.cleanedSegmentsWarning || "Per-segment cleanup unavailable. Showing original text."}
        show={!!transcription.cleanedSegmentsWarning || isTestWarning}
        autoCollapseMs={5000}
        onDismiss={transcription.dismissCleanedSegmentsWarning}
      />
      <DemoNavigation />

      {!isLoadingEntry && (
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
      )}

      <main className="mx-auto px-6 max-w-[1400px]">
        {isLoadingEntry ? (
          /* Loading State - fetching entry data */
          <div className="rounded-xl overflow-hidden shadow-lg">
            <TranscriptLoadingSkeleton />
          </div>
        ) : isLoadingProcessingEntry ? (
          /* Processing State - entry is still being transcribed/cleaned */
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-lg">
            <ProcessingStages
              stages={processingStages.stages}
              currentStageId={processingStages.currentStageId}
            />
          </div>
        ) : transcription.segments.length === 0 ? (
          /* Upload Mode */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <DemoWarningBanner />
              <UploadZone
                selectedSpeakerCount={selectedSpeakerCount}
                isUploading={processingStages.isProcessing}
                uploadProgress={transcription.uploadProgress}
                hasFile={!!selectedFile}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onRemoveFile={handleRemoveFile}
                onSpeakerCountChange={handleSpeakerCountChange}
                onTranscribeClick={handleTranscribeClick}
                onRecordClick={handleRecordClick}
                stages={processingStages.stages}
                currentStageId={processingStages.currentStageId}
              />
            </div>
            <div>
              <EntryHistoryCard
                entries={entriesHook.entries}
                activeId={transcription.entryId}
                deletingId={entriesHook.deletingId}
                onSelect={handleEntrySelect}
                onDelete={handleDeleteEntry}
                isEmpty={entriesHook.entries.length === 0 && !entriesHook.isLoading}
              />
            </div>
          </div>
        ) : (
          /* Transcript Mode */
          <>
            <ExpandableCard
              isExpanded={isEditorExpanded}
              topOffset={64}
              collapsedClassName="rounded-xl mb-12"
              expandedClassName="rounded-none border-x-0"
            >
              {audioUrl && (
                <audio src={audioUrl} {...audioPlayer.audioProps} preload="metadata" className="hidden" />
              )}
              <div className={`bg-gradient-to-b from-muted/30 to-transparent border-b border-border/50 flex-shrink-0 ${
                isEditorExpanded ? "rounded-none" : "rounded-t-lg"
              }`}>
                <AudioPlayer
                  isPlaying={audioPlayer.isPlaying}
                  currentTime={audioPlayer.currentTime}
                  duration={audioPlayer.duration}
                  playbackSpeed={audioPlayer.playbackSpeed}
                  isFullscreen={isEditorExpanded}
                  onPlayPause={handlePlayPause}
                  onSeek={handleSeek}
                  onSpeedChange={handleSpeedChange}
                  onDownload={handleDownload}
                  onDelete={transcription.entryId ? () => handleDeleteEntry(transcription.entryId!) : undefined}
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
                cleanupOptions={{
                  models: cleanupModels,
                  selectedModel: selectedCleanupModel,
                  selectedLevel: selectedCleanupLevel,
                  isProcessing: transcription.status === 'cleaning',
                  onModelChange: handleCleanupModelChange,
                  onLevelChange: handleCleanupLevelChange,
                  cachedCleanups: cleanupCache,
                  hasManualSelection: hasManualCleanupModelSelection,
                }}
              />
            </ExpandableCard>

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
                      availableModels={analysisModels}
                      selectedModel={selectedAnalysisModel}
                      onModelChange={handleAnalysisModelChange}
                    />
                  </div>

                  <div>
                    <FeedbackCard
                      rating={feedbackHook.rating}
                      feedback={feedbackHook.feedbackText}
                      onRatingChange={feedbackHook.setRating}
                      onFeedbackChange={feedbackHook.setFeedbackText}
                      onSubmit={feedbackHook.submit}
                      isLoading={feedbackHook.isLoading}
                      isSubmitting={feedbackHook.isSubmitting}
                      isSubmitted={feedbackHook.isSubmitted}
                      hasExisting={feedbackHook.hasExisting}
                      disabled={!transcription.entryId}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>

      {/* TODO: Re-enable when text move feature is fully working
      {textMoveSelection && (
        <TextMoveToolbar
          selectedText={textMoveSelection.text}
          isSelectingTarget={isSelectingMoveTarget}
          onMoveClick={() => setIsSelectingMoveTarget(true)}
          onCancel={handleCancelTextMove}
        />
      )}
      */}

      <WaitlistFlow
        state={waitlistState}
        type={waitlistType}
        email={waitlist.email}
        useCase={useCase}
        volume={volume}
        source={source}
        isSubmitting={waitlist.isSubmitting}
        referralCode={waitlist.referralCode || ""}
        copied={copied}
        onEmailChange={waitlist.setEmail}
        onUseCaseChange={setUseCase}
        onVolumeChange={setVolume}
        onSourceChange={setSource}
        onSubmit={handleWaitlistSubmit}
        onClose={handleWaitlistClose}
        onOpenForm={() => setWaitlistState("form")}
        onCopyLink={handleWaitlistCopyLink}
        t={t}
      />

      <RateLimitModal
        isOpen={showRateLimitModal}
        retryAfter={rateLimits.retryAfter}
        onClose={handleRateLimitModalClose}
        onJoinWaitlist={handleRateLimitJoinWaitlist}
      />

      <RecordingModal
        isOpen={showRecordingModal}
        isRecording={recorder.isRecording}
        duration={recorder.duration}
        audioBlob={recorder.audioBlob}
        error={recorder.error}
        onStartRecording={recorder.startRecording}
        onStopRecording={recorder.stopRecording}
        onConfirm={handleRecordingConfirm}
        onReRecord={handleReRecord}
        onClose={handleRecordingClose}
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
