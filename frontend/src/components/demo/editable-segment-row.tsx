"use client"

import type React from "react"
import { useRef, useEffect } from "react"
import { RotateCcw, Check, X, Undo2 } from "lucide-react"
import { useTranslations } from "next-intl"
import type { SpellcheckError } from "./types"
import { DiffSegmentDisplay } from "./diff-segment-display"
import { filterSelectionForDiff } from "@/lib/text-selection-utils"
import { getSpeakerBorderColor, getSpeakerTextColor } from "@/lib/speaker-utils"

export interface EditableSegmentRowProps {
  id: string
  speaker: number
  time: string
  text: string
  rawText: string
  originalRawText: string
  paragraphs?: string[]
  isActive: boolean
  isReverted: boolean
  isEditing: boolean
  editedText: string
  hasUnsavedEdits: boolean
  showDiff: boolean
  showSpeakerLabels?: boolean
  showRevertButton?: boolean
  isSelectingMoveTarget: boolean
  isValidMoveTarget: boolean
  isMoveSource: boolean
  spellcheckErrors: SpellcheckError[]
  activeSuggestion: {
    word: string
    position: { x: number; y: number }
    suggestions: string[]
  } | null
  onRevert: () => void
  onUndoRevert: () => void
  onSave: () => void
  onEditStart: () => void
  onEditCancel: () => void
  onTextChange: (text: string) => void
  onWordClick: (e: React.MouseEvent, error: SpellcheckError) => void
  onSuggestionSelect: (suggestion: string) => void
  onCloseSuggestions: () => void
  onTextSelect: (text: string, startOffset: number, endOffset: number) => void
  onMoveTargetClick: () => void
  onSegmentClick?: () => void
}

export function EditableSegmentRow({
  id,
  speaker,
  time,
  text,
  rawText,
  originalRawText: _originalRawText,
  paragraphs,
  isActive,
  isReverted,
  isEditing,
  editedText,
  hasUnsavedEdits,
  showDiff,
  showSpeakerLabels = true,
  showRevertButton = true,
  isSelectingMoveTarget,
  isValidMoveTarget,
  isMoveSource: _isMoveSource,
  spellcheckErrors,
  activeSuggestion,
  onRevert,
  onUndoRevert,
  onSave,
  onEditStart,
  onEditCancel,
  onTextChange,
  onWordClick,
  onSuggestionSelect,
  onCloseSuggestions,
  onTextSelect,
  onMoveTargetClick,
  onSegmentClick,
}: EditableSegmentRowProps) {
  const t = useTranslations("demo")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea when editing
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || !isEditing) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    // Apply height with min constraint only (no max - grows to fit content)
    const newHeight = Math.max(scrollHeight, 60)
    textarea.style.height = `${newHeight}px`
  }, [editedText, isEditing])

  const handleMouseUp = () => {
    if (isSelectingMoveTarget || isEditing) return
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      const selectedText = filterSelectionForDiff(selection, showDiff, isReverted)

      // Only trigger selection if there's valid text remaining
      if (selectedText) {
        const range = selection.getRangeAt(0)
        onTextSelect(selectedText, range.startOffset, range.endOffset)
      }
    }
  }

  const handleClick = () => {
    if (isSelectingMoveTarget && isValidMoveTarget) {
      onMoveTargetClick()
    } else if (!isSelectingMoveTarget) {
      onSegmentClick?.()
    }
  }

  const _renderTextWithSpellcheck = () => {
    if (!isEditing || spellcheckErrors.length === 0) {
      return editedText
    }

    const parts: React.ReactNode[] = []
    let lastIndex = 0

    spellcheckErrors.forEach((error, idx) => {
      if (error.start > lastIndex) {
        parts.push(editedText.substring(lastIndex, error.start))
      }

      parts.push(
        <span
          key={`error-${idx}`}
          className="border-b-2 border-amber-500 border-dashed cursor-pointer hover:bg-amber-50/20"
          onClick={(e) => onWordClick(e, error)}
        >
          {error.word}
        </span>,
      )

      lastIndex = error.end
    })

    if (lastIndex < editedText.length) {
      parts.push(editedText.substring(lastIndex))
    }

    return parts
  }

  const renderContent = () => {
    if (showDiff && !isReverted) {
      return <DiffSegmentDisplay rawText={rawText} cleanedText={text} showDiff={showDiff} />
    }
    return text
  }

  const renderParagraphs = () => {
    if (!paragraphs || paragraphs.length === 0) {
      return renderContent()
    }
    return (
      <div className="space-y-4">
        {paragraphs.map((paragraph, idx) => (
          <p key={idx} className="text-[15px] leading-[1.7] text-foreground">
            {paragraph}
          </p>
        ))}
      </div>
    )
  }

  return (
    <>
      <div
        data-segment-id={id}
        className={`p-3 mb-2 rounded-xl border-l-4 transition-all cursor-pointer relative ${
          isActive
            ? "bg-blue-100 shadow-[0_0_0_2px_rgba(59,130,246,0.25),0_4px_12px_rgba(0,0,0,0.08)]"
            : "bg-secondary"
        } ${showSpeakerLabels ? getSpeakerBorderColor(speaker) : "border-border"}`}
        onClick={handleClick}
        onMouseUp={handleMouseUp}
      >
        {hasUnsavedEdits && !isEditing && (
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-background shadow-sm" />
        )}

        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            {showSpeakerLabels && (
              <span className={`text-xs font-bold ${getSpeakerTextColor(speaker)}`}>
                {t("transcript.speaker", { number: speaker + 1 })}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground font-medium">{time}</span>
            {hasUnsavedEdits && !isEditing && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50/50 px-1.5 py-0.5 rounded">
                Edited
              </span>
            )}
            {isValidMoveTarget && (
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50/50 px-1.5 py-0.5 rounded animate-pulse">
                Click to move here
              </span>
            )}
          </div>
          {showRevertButton && (
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={onSave}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-md text-[11px] font-semibold text-emerald-700 transition-all"
                  >
                    <Check className="w-3 h-3" />
                    Save
                  </button>
                  <button
                    onClick={onEditCancel}
                    className="flex items-center gap-1 px-2.5 py-1 bg-background hover:bg-secondary border border-border rounded-md text-[11px] font-semibold text-muted-foreground transition-all"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {isReverted ? (
                    <button
                      onClick={onUndoRevert}
                      className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-md text-[11px] font-semibold text-blue-700 transition-all"
                    >
                      <Undo2 className="w-3 h-3" />
                      Undo
                    </button>
                  ) : (
                    <button
                      onClick={onRevert}
                      className="flex items-center gap-1 px-2.5 py-1 bg-background hover:bg-red-50 border border-border hover:border-red-300 rounded-md text-[11px] font-semibold text-muted-foreground hover:text-red-600 transition-all"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Revert
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editedText}
            onChange={(e) => onTextChange(e.target.value)}
            onDoubleClick={onEditStart}
            className="w-full text-[15px] leading-[1.7] text-foreground p-4 rounded-lg border-2 border-primary bg-background font-inherit overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            style={{
              fontFamily: "inherit",
              minHeight: "60px",
              resize: "none"
            }}
          />
        ) : (
          <div className="text-[15px] leading-[1.7] text-foreground select-text" onDoubleClick={onEditStart}>
            {showDiff && !isReverted ? renderContent() : renderParagraphs()}
          </div>
        )}

        {!isEditing && !isSelectingMoveTarget && (
          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded font-medium">
              Double-click to edit
            </div>
          </div>
        )}
      </div>

      {/* Spellcheck Suggestions Dropdown */}
      {activeSuggestion && (
        <>
          <div className="fixed inset-0 z-40" onClick={onCloseSuggestions} />
          <div
            className="fixed z-50 bg-background rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.15)] border border-border py-1 min-w-[180px]"
            style={{
              left: `${activeSuggestion.position.x}px`,
              top: `${activeSuggestion.position.y}px`,
            }}
          >
            <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-muted">
              Suggestions
            </div>
            {activeSuggestion.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionSelect(suggestion)}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
