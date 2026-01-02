"use client"
import type { Segment } from "@/components/demo/types"
import { Eye, EyeOff, Copy, X } from "lucide-react"

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
}

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
}: TranscriptHeaderProps) {
  const handleCopy = () => {
    const text = segments.map((s) => s[textKey]).join("\n\n")
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="px-6 py-4 flex justify-between items-center border-r border-border last:border-r-0">
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[1px]">{title}</span>
      <div className="flex gap-2 items-center">
        {showDiffToggle && onToggleDiff && (
          <button
            onClick={onToggleDiff}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              showDiff
                ? "bg-blue-100 text-blue-900 border border-blue-300"
                : "bg-background text-muted-foreground border border-border hover:bg-secondary"
            }`}
          >
            {showDiff ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {showDiff ? "Diff On" : "Diff Off"}
          </button>
        )}
        {showCopyButton && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary hover:bg-muted rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
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
