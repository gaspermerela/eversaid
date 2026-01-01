"use client"

import type React from "react"

import { forwardRef } from "react"

export interface RawSegmentListProps {
  segments: Array<{
    id: string
    speaker: number
    time: string
    rawText: string
  }>
  activeSegmentId: string | null
  showSpeakerLabels?: boolean // Added prop for single-speaker support
  isSelectingMoveTarget: boolean
  moveSourceSegmentId: string | null
  onSegmentClick: (id: string) => void
  onTextSelect: (segmentId: string, text: string, startOffset: number, endOffset: number) => void
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
}

export const RawSegmentList = forwardRef<HTMLDivElement, RawSegmentListProps>(
  (
    {
      segments,
      activeSegmentId,
      showSpeakerLabels = true,
      isSelectingMoveTarget,
      moveSourceSegmentId,
      onSegmentClick,
      onTextSelect,
      onScroll,
    },
    ref,
  ) => {
    const handleMouseUp = (segmentId: string) => {
      const selection = window.getSelection()
      if (selection && selection.toString().trim()) {
        const text = selection.toString().replace(/\s+/g, " ").trim()
        const range = selection.getRangeAt(0)
        onTextSelect(segmentId, text, range.startOffset, range.endOffset)
      }
    }

    return (
      <div ref={ref} data-column="raw" className="p-5 overflow-y-auto border-r border-border" onScroll={onScroll}>
        {segments.map((seg) => {
          const isValidTarget = isSelectingMoveTarget && seg.id !== moveSourceSegmentId
          const isSource = seg.id === moveSourceSegmentId

          return (
            <div
              key={seg.id}
              data-segment-id={seg.id}
              className={`p-4 mb-3 rounded-xl bg-secondary border-l-4 transition-all cursor-pointer ${
                seg.id === activeSegmentId
                  ? "shadow-[0_0_0_2px_rgba(var(--color-primary),0.3),0_4px_12px_rgba(0,0,0,0.05)] bg-background"
                  : ""
              } ${showSpeakerLabels ? (seg.speaker === 1 ? "border-primary" : "border-purple-500") : "border-border"} ${
                isValidTarget ? "ring-2 ring-primary ring-offset-2 hover:bg-blue-50/50 cursor-pointer" : ""
              } ${isSource ? "opacity-60" : ""}`}
              onClick={() => onSegmentClick(seg.id)}
              onMouseUp={() => !isSelectingMoveTarget && handleMouseUp(seg.id)}
            >
              <div className="flex justify-between items-center mb-2.5">
                <div className="flex items-center gap-2">
                  {showSpeakerLabels && (
                    <span className={`text-xs font-bold ${seg.speaker === 1 ? "text-blue-600" : "text-purple-600"}`}>
                      Speaker {seg.speaker}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground font-medium">{seg.time}</span>
                  {isValidTarget && (
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50/50 px-1.5 py-0.5 rounded animate-pulse">
                      Click to move here
                    </span>
                  )}
                </div>
              </div>
              <div className="text-[15px] leading-[1.7] text-foreground select-text">{seg.rawText}</div>
            </div>
          )
        })}
      </div>
    )
  },
)

RawSegmentList.displayName = "RawSegmentList"
