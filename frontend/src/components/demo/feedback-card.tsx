"use client"

import { Sparkles } from "lucide-react"

export interface FeedbackCardProps {
  rating: number
  feedback: string
  onRatingChange: (rating: number) => void
  onFeedbackChange: (text: string) => void
  onSubmit: () => void
  isSubmitting?: boolean
  isSubmitted?: boolean
  disabled?: boolean
}

export function FeedbackCard({ rating, feedback, onRatingChange, onFeedbackChange, onSubmit, isSubmitting, isSubmitted, disabled }: FeedbackCardProps) {
  const isDisabled = disabled || isSubmitted

  return (
    <div className="bg-background rounded-2xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">How was the quality?</h3>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onRatingChange(star)}
            disabled={isDisabled}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              rating >= star ? "bg-amber-100" : "bg-secondary hover:bg-amber-100"
            } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Sparkles className={`w-[18px] h-[18px] ${rating >= star ? "fill-amber-500" : "fill-muted"}`} />
          </button>
        ))}
      </div>
      {isSubmitted && (
        <p className="text-sm text-green-600 font-medium">Thank you for your feedback!</p>
      )}
      {!isSubmitted && rating > 0 && rating <= 3 && (
        <>
          <textarea
            placeholder="What went wrong? Your feedback helps us improve."
            value={feedback}
            onChange={(e) => onFeedbackChange(e.target.value)}
            disabled={isDisabled}
            className="w-full px-3 py-2.5 bg-secondary border border-border focus:border-primary focus:outline-none rounded-[10px] text-[13px] resize-none mb-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            rows={3}
          />
          <button
            onClick={onSubmit}
            disabled={isSubmitting || isDisabled}
            className="w-full py-2.5 bg-primary hover:bg-primary text-primary-foreground text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </>
      )}
    </div>
  )
}
