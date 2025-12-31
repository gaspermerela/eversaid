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

const mockSegmentsSingleSpeaker: Segment[] = [
  {
    id: "seg-1",
    speaker: 1,
    time: "0:00 – 3:28",
    rawText:
      "Uh so basically what we're trying to do here is um figure out the best approach for the the project timeline and um you know make sure everyone's on the same page. Yeah I think we should we should probably start with the the research phase first you know and then move on to to the design work after we have all the the data we need. That makes sense um and I was thinking maybe we could also like bring in some external consultants to help with the the technical aspects of the project. Sure that's a good idea I mean we we definitely need some expertise in in the machine learning side of things especially for the the data processing pipeline. Right right and um what about the the budget like do we have enough um resources allocated for for bringing in outside help or should we should we look at maybe reallocating from other areas? Well I I think we have some some flexibility there um the Q3 budget had a a contingency fund set aside so so we could tap into that if if needed you know what I mean. Perfect that's that's great to hear um so let's let's plan to to have like a follow-up meeting next week to to finalize the the consultant requirements and um get the ball rolling on that. Sounds good I'll I'll send out a a calendar invite for for Thursday afternoon if if that works for everyone and uh we can we can also invite Sarah from from procurement to to help with the the vendor selection process.",
    cleanedText:
      "So basically what we're trying to do here is figure out the best approach for the project timeline, ensuring everyone's on the same page. I think we should probably start with the research phase first and then move on to the design work after we have all the data we need. That makes sense, and I was thinking maybe we could bring in some external consultants to help with the technical aspects of the project. That's a good idea. We definitely need some expertise in the machine learning side of things, especially for the data processing pipeline. What about the budget? Do we have enough resources allocated for bringing in outside help, or should we look at reallocating from other areas? I think we have some flexibility there. The Q3 budget had a contingency fund set aside, so we could tap into that if needed. Perfect, that's great to hear. Let's plan to have a follow-up meeting next week to finalize the consultant requirements and get the ball rolling on that. I'll send out a calendar invite for Thursday afternoon if that works for everyone. We can also invite Sarah from procurement to help with the vendor selection process.",
    originalRawText:
      "Uh so basically what we're trying to do here is um figure out the best approach for the the project timeline and um you know make sure everyone's on the same page. Yeah I think we should we should probably start with the the research phase first you know and then move on to to the design work after we have all the the data we need. That makes sense um and I was thinking maybe we could also like bring in some external consultants to help with the the technical aspects of the project. Sure that's a good idea I mean we we definitely need some expertise in in the machine learning side of things especially for the the data processing pipeline. Right right and um what about the the budget like do we have enough um resources allocated for for bringing in outside help or should we should we look at maybe reallocating from other areas? Well I I think we have some some flexibility there um the Q3 budget had a a contingency fund set aside so so we could tap into that if if needed you know what I mean. Perfect that's that's great to hear um so let's let's plan to to have like a follow-up meeting next week to to finalize the the consultant requirements and um get the ball rolling on that. Sounds good I'll I'll send out a a calendar invite for for Thursday afternoon if if that works for everyone and uh we can we can also invite Sarah from from procurement to to help with the the vendor selection process.",
    paragraphs: [
      "So basically what we're trying to do here is figure out the best approach for the project timeline, ensuring everyone's on the same page.",
      "I think we should probably start with the research phase first and then move on to the design work after we have all the data we need. That makes sense, and I was thinking maybe we could bring in some external consultants to help with the technical aspects of the project.",
      "That's a good idea. We definitely need some expertise in the machine learning side of things, especially for the data processing pipeline.",
      "What about the budget? Do we have enough resources allocated for bringing in outside help, or should we look at reallocating from other areas?",
      "I think we have some flexibility there. The Q3 budget had a contingency fund set aside, so we could tap into that if needed.",
      "Perfect, that's great to hear. Let's plan to have a follow-up meeting next week to finalize the consultant requirements and get the ball rolling on that.",
      "I'll send out a calendar invite for Thursday afternoon if that works for everyone. We can also invite Sarah from procurement to help with the vendor selection process.",
    ],
  },
]

const mockSegmentsMultiSpeaker: Segment[] = [
  {
    id: "seg-1",
    speaker: 1,
    time: "0:00 – 0:18",
    rawText:
      "Uh so basically what we're trying to do here is um figure out the best approach for the the project timeline and um you know make sure everyone's on the same page.",
    cleanedText:
      "So basically what we're trying to do here is figure out the best approach for the project timeline, ensuring everyone's on the same page.",
    originalRawText:
      "Uh so basically what we're trying to do here is um figure out the best approach for the the project timeline and um you know make sure everyone's on the same page.",
  },
  {
    id: "seg-2",
    speaker: 2,
    time: "0:19 – 0:42",
    rawText:
      "Yeah I think we should we should probably start with the the research phase first you know and then move on to to the design work after we have all the the data we need.",
    cleanedText:
      "Yes, I think we should probably start with the research phase first and then move on to the design work after we have all the data we need.",
    originalRawText:
      "Yeah I think we should we should probably start with the the research phase first you know and then move on to to the design work after we have all the the data we need.",
  },
  {
    id: "seg-3",
    speaker: 1,
    time: "0:43 – 1:05",
    rawText:
      "That makes sense um and I was thinking maybe we could also like bring in some external consultants to help with the the technical aspects of the project.",
    cleanedText:
      "That makes sense, and I was thinking maybe we could bring in some external consultants to help with the technical aspects of the project.",
    originalRawText:
      "That makes sense um and I was thinking maybe we could also like bring in some external consultants to help with the the technical aspects of the project.",
  },
  {
    id: "seg-4",
    speaker: 2,
    time: "1:06 – 1:28",
    rawText:
      "Sure that's a good idea I mean we we definitely need some expertise in in the machine learning side of things especially for the the data processing pipeline.",
    cleanedText:
      "That's a good idea. We definitely need some expertise in the machine learning side of things, especially for the data processing pipeline.",
    originalRawText:
      "Sure that's a good idea I mean we we definitely need some expertise in in the machine learning side of things especially for the the data processing pipeline.",
  },
  {
    id: "seg-5",
    speaker: 1,
    time: "1:29 – 2:15",
    rawText:
      "Right right and um what about the the budget like do we have enough um resources allocated for for bringing in outside help or should we should we look at maybe reallocating from other areas?",
    cleanedText:
      "What about the budget? Do we have enough resources allocated for bringing in outside help, or should we look at reallocating from other areas?",
    originalRawText:
      "Right right and um what about the the budget like do we have enough um resources allocated for for bringing in outside help or should we should we look at maybe reallocating from other areas?",
  },
  {
    id: "seg-6",
    speaker: 2,
    time: "2:16 – 3:28",
    rawText:
      "Well I I think we have some some flexibility there um the Q3 budget had a a contingency fund set aside so so we could tap into that if if needed you know what I mean.",
    cleanedText:
      "I think we have some flexibility there. The Q3 budget had a contingency fund set aside, so we could tap into that if needed.",
    originalRawText:
      "Well I I think we have some some flexibility there um the Q3 budget had a a contingency fund set aside so so we could tap into that if if needed you know what I mean.",
  },
]

export default function DemoPage() {
  // UI State
  const [uiState, setUiState] = useState<"empty" | "upload" | "complete">("complete")
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(34)
  const [duration] = useState(285) // Updated duration for more segments (4:45)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedSpeakerCount, setSelectedSpeakerCount] = useState(2)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

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

  // Feedback State
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState("")

  // Single Speaker Mode State
  const [isSingleSpeaker, setIsSingleSpeaker] = useState(false)

  const [segments, setSegments] = useState<Segment[]>(mockSegmentsMultiSpeaker)

  useEffect(() => {
    console.log("[v0] Segments changed:", segments.length, "segments")
    console.log(
      "[v0] Segment IDs:",
      segments.map((s) => s.id),
    )
  }, [segments])

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
      segments.forEach((seg) => {
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
  }, [segments, showDiff])

  // Segment Handlers
  const handleRevertSegment = useCallback(
    (segmentId: string) => {
      const segment = segments.find((s) => s.id === segmentId)
      if (segment) {
        setRevertedSegments((prev) => new Map(prev).set(segmentId, segment.cleanedText))
        setSegments((prev) => prev.map((seg) => (seg.id === segmentId ? { ...seg, cleanedText: seg.rawText } : seg)))
      }
    },
    [segments],
  )

  const handleUndoRevert = useCallback((segmentId: string) => {
    setRevertedSegments((prev) => {
      const originalCleanedText = prev.get(segmentId)
      if (originalCleanedText) {
        setSegments((prevSegs) =>
          prevSegs.map((seg) => (seg.id === segmentId ? { ...seg, cleanedText: originalCleanedText } : seg)),
        )
      }
      const newMap = new Map(prev)
      newMap.delete(segmentId)
      return newMap
    })
  }, [])

  const handleSaveSegment = useCallback(
    (segmentId: string) => {
      const newText = editedTexts.get(segmentId)
      if (newText !== undefined) {
        setSegments((prev) => prev.map((seg) => (seg.id === segmentId ? { ...seg, cleanedText: newText } : seg)))
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
    [editedTexts],
  )

  const handleSegmentEditStart = useCallback(
    (segmentId: string) => {
      const segment = segments.find((s) => s.id === segmentId)
      if (segment) {
        setEditingSegmentId(segmentId)
        if (!editedTexts.has(segmentId)) {
          setEditedTexts((prev) => new Map(prev).set(segmentId, segment.cleanedText))
        }
      }
    },
    [segments, editedTexts],
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

  const handleUpdateAllSegments = useCallback(() => {
    editedTexts.forEach((text, segmentId) => {
      setSegments((prev) => prev.map((seg) => (seg.id === segmentId ? { ...seg, cleanedText: text } : seg)))
    })
    setEditingSegmentId(null)
    setEditedTexts(new Map())
  }, [editedTexts])

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
      if (!textMoveSelection || textMoveSelection.sourceColumn !== "raw") return

      const sourceId = textMoveSelection.sourceSegmentId
      const selectedText = textMoveSelection.text

      setSegments((prev) => {
        return prev.map((seg) => {
          if (seg.id === sourceId) {
            // Remove text from source
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

      setTextMoveSelection(null)
      setIsSelectingMoveTarget(false)
      window.getSelection()?.removeAllRanges()
    },
    [textMoveSelection],
  )

  const handleCleanedMoveTargetClick = useCallback(
    (targetSegmentId: string) => {
      if (!textMoveSelection || textMoveSelection.sourceColumn !== "cleaned") return

      const sourceId = textMoveSelection.sourceSegmentId
      const selectedText = textMoveSelection.text

      setSegments((prev) => {
        return prev.map((seg) => {
          if (seg.id === sourceId) {
            // Remove text from source
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
    setIsSingleSpeaker(count === 1)
    setSegments(count === 1 ? [...mockSegmentsSingleSpeaker] : [...mockSegmentsMultiSpeaker])
  }, [])

  const handleTranscribeClick = useCallback(() => {
    if (!selectedFile) return
    setIsUploading(true)
    // Simulate upload progress
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setUploadProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)
        setIsUploading(false)
        setUiState("complete")
      }
    }, 200)
  }, [selectedFile])

  // Feedback Handlers
  const handleRatingChange = useCallback((newRating: number) => {
    setRating(newRating)
  }, [])

  const handleFeedbackChange = useCallback((text: string) => {
    setFeedback(text)
  }, [])

  const handleFeedbackSubmit = useCallback(() => {
    console.log("Feedback submitted:", { rating, feedback })
    setRating(0)
    setFeedback("")
  }, [rating, feedback])

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
    const segment = segments.find((s) => s.id === id)
    return segment && text !== segment.cleanedText
  }).length

  const showSpeakerLabels = useMemo(() => {
    const uniqueSpeakers = new Set(segments.map((seg) => seg.speaker))
    return uniqueSpeakers.size > 1
  }, [segments])

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
              <span className="text-sm font-semibold text-[#64748B]">15/20</span>
              <span className="text-xs text-[#94A3B8] ml-1">daily</span>
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor="speaker-mode" className="text-sm text-muted-foreground">
              Demo mode:
            </label>
            <button
              onClick={() => {
                setIsSingleSpeaker(false)
                setSegments([...mockSegmentsMultiSpeaker])
              }}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                !isSingleSpeaker
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Multi-Speaker
            </button>
            <button
              onClick={() => {
                setIsSingleSpeaker(true)
                setSegments([...mockSegmentsSingleSpeaker])
              }}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                isSingleSpeaker
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Single Speaker
            </button>
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
            segments={segments}
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
              rating={rating}
              feedback={feedback}
              onRatingChange={handleRatingChange}
              onFeedbackChange={handleFeedbackChange}
              onSubmit={handleFeedbackSubmit}
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
