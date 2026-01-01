"use client"

import { ArrowRight, X } from "lucide-react"

export interface TextMoveToolbarProps {
  selectedText: string
  isSelectingTarget: boolean
  onMoveClick: () => void
  onCancel: () => void
}

export function TextMoveToolbar({ selectedText, isSelectingTarget, onMoveClick, onCancel }: TextMoveToolbarProps) {
  if (!selectedText && !isSelectingTarget) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-3 px-4 py-3 bg-primary rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-muted">
        {isSelectingTarget ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
              <span className="text-sm text-primary-foreground font-medium">Click a segment to move text there</span>
            </div>
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-secondary rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </>
        ) : (
          <>
            <div className="max-w-[200px] truncate text-sm text-primary-foreground">&quot;{selectedText}&quot;</div>
            <button
              onClick={onMoveClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-primary rounded-lg text-sm font-semibold text-accent-foreground transition-all shadow-[0_2px_8px_rgba(56,189,248,0.3)]"
            >
              Move to...
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
