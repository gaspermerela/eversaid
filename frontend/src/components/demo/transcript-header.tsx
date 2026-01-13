"use client"
import { useState } from "react"
import type { Segment } from "@/components/demo/types"
import type { ModelInfo, CleanupType } from "@/features/transcription/types"
import { Eye, EyeOff, Copy, X, ChevronDown, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

export interface CleanupOptionsProps {
  /** Available LLM models */
  models: ModelInfo[]
  /** Currently selected model ID */
  selectedModel: string
  /** Currently selected cleanup level */
  selectedLevel: CleanupType
  /** Whether cleanup is currently processing */
  isProcessing?: boolean
  /** Callback when model changes */
  onModelChange: (modelId: string) => void
  /** Callback when level changes */
  onLevelChange: (level: CleanupType) => void
}

export interface TranscriptHeaderProps {
  title: string
  segments: Segment[]
  textKey: "rawText" | "cleanedText"
  showDiffToggle?: boolean
  showDiff?: boolean
  onToggleDiff?: () => void
  showCopyButton?: boolean
  showCloseButton?: boolean
  onClose?: () => void
  /** Cleanup options (only for AI CLEANED header) */
  cleanupOptions?: CleanupOptionsProps
}

const CLEANUP_LEVEL_IDS: CleanupType[] = ["verbatim", "corrected", "formal"]

export function TranscriptHeader({
  title,
  segments,
  textKey,
  showDiffToggle = false,
  showDiff = false,
  onToggleDiff,
  showCopyButton = true,
  showCloseButton = false,
  onClose,
  cleanupOptions,
}: TranscriptHeaderProps) {
  const t = useTranslations("demo.cleanup")
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showLevelMenu, setShowLevelMenu] = useState(false)

  const handleCopy = () => {
    const text = segments.map((s) => s[textKey]).join("\n\n")
    navigator.clipboard.writeText(text)
  }

  const selectedModelName = cleanupOptions?.models.find(m => m.id === cleanupOptions.selectedModel)?.name
    || cleanupOptions?.selectedModel
    || "Default"

  const selectedLevelLabel = cleanupOptions?.selectedLevel
    ? t(`levels.${cleanupOptions.selectedLevel}`)
    : t("levels.corrected")

  return (
    <div className="px-6 py-4 flex justify-between items-center border-r border-border last:border-r-0">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[1px]">{title}</span>

        {/* Cleanup options dropdowns */}
        {cleanupOptions && (
          <>
          {/* Vertical divider */}
          <div className="h-4 w-px bg-border mx-2" />
          <div className="flex items-center gap-3">
            {/* Processing spinner */}
            {cleanupOptions.isProcessing && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            )}

            {/* Model dropdown */}
            <div className="flex items-center">
              <span className="text-xs font-semibold text-foreground/70 mr-1.5">{t("openSourceModel")}</span>
              <div className="relative">
                <button
                  onClick={() => !cleanupOptions.isProcessing && setShowModelMenu(!showModelMenu)}
                  disabled={cleanupOptions.isProcessing}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    cleanupOptions.isProcessing
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="max-w-[80px] truncate">{selectedModelName}</span>
                  <ChevronDown className="w-3 h-3 flex-shrink-0" />
                </button>
                {showModelMenu && (
                  <div className="absolute left-0 top-full mt-1 bg-background border border-border rounded-md overflow-hidden z-20 shadow-lg min-w-[160px]">
                    {cleanupOptions.models.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          cleanupOptions.onModelChange(model.id)
                          setShowModelMenu(false)
                        }}
                        className={`block w-full px-3 py-2 text-left text-[11px] transition-colors hover:bg-muted ${
                          cleanupOptions.selectedModel === model.id ? "bg-secondary font-medium" : ""
                        }`}
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Level dropdown */}
            <div className="flex items-center">
              <span className="text-xs font-semibold text-foreground/70 mr-1.5">{t("style")}</span>
              <div className="relative">
                <button
                  onClick={() => !cleanupOptions.isProcessing && setShowLevelMenu(!showLevelMenu)}
                  disabled={cleanupOptions.isProcessing}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    cleanupOptions.isProcessing
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {selectedLevelLabel}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showLevelMenu && (
                  <div className="absolute left-0 top-full mt-1 bg-background border border-border rounded-md overflow-hidden z-20 shadow-lg min-w-[100px]">
                    {CLEANUP_LEVEL_IDS.map((levelId) => (
                      <button
                        key={levelId}
                        onClick={() => {
                          cleanupOptions.onLevelChange(levelId)
                          setShowLevelMenu(false)
                        }}
                        className={`block w-full px-3 py-2 text-left text-[11px] transition-colors hover:bg-muted ${
                          cleanupOptions.selectedLevel === levelId ? "bg-secondary font-medium" : ""
                        }`}
                      >
                        {t(`levels.${levelId}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </>
        )}
      </div>

      <div className="flex gap-2 items-center">
        {showDiffToggle && onToggleDiff && (
          <button
            onClick={onToggleDiff}
            className={`flex items-center justify-center p-1.5 rounded-md transition-all ${
              showDiff
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-background text-muted-foreground border border-border hover:bg-secondary hover:text-foreground"
            }`}
          >
            {showDiff ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
        )}
        {showCopyButton && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary hover:bg-muted rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
            {t("copy")}
          </button>
        )}
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 p-1.5 bg-muted/80 hover:bg-red-100 hover:text-red-600 rounded-md text-muted-foreground transition-all"
            aria-label="Exit fullscreen"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
