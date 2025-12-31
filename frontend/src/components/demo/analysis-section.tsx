"use client"

import { Check, ChevronDown, Loader2, AlertCircle, RefreshCw } from "lucide-react"

export interface AnalysisProfile {
  id: string
  label: string
  intent: string
  description: string
  is_default: boolean
}

export interface AnalysisSectionProps {
  analysisType: "summary" | "action-items" | "sentiment"
  analysisData: {
    summary: string
    topics: string[]
    keyPoints: string[]
  } | null
  showAnalysisMenu: boolean
  isLoading?: boolean
  error?: string | null
  profiles?: AnalysisProfile[]
  onAnalysisTypeChange: (type: "summary" | "action-items" | "sentiment") => void
  onToggleAnalysisMenu: () => void
  onRerunAnalysis?: (profileId: string) => void
}

export function AnalysisSection({
  analysisType,
  analysisData,
  showAnalysisMenu,
  isLoading = false,
  error = null,
  profiles = [],
  onAnalysisTypeChange,
  onToggleAnalysisMenu,
  onRerunAnalysis,
}: AnalysisSectionProps) {
  const analysisLabels = {
    summary: "Conversation Summary",
    "action-items": "Action Items",
    sentiment: "Sentiment Analysis",
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="bg-[linear-gradient(135deg,rgba(var(--color-primary),0.05)_0%,rgba(168,85,247,0.05)_100%)] border border-[rgba(var(--color-primary),0.2)] rounded-[20px] p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="text-[11px] font-bold text-primary uppercase tracking-[1px]">AI Analysis</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing...
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Analyzing your conversation...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-[linear-gradient(135deg,rgba(var(--color-primary),0.05)_0%,rgba(168,85,247,0.05)_100%)] border border-[rgba(var(--color-primary),0.2)] rounded-[20px] p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="text-[11px] font-bold text-primary uppercase tracking-[1px]">AI Analysis</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <AlertCircle className="w-4 h-4" />
            Error
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            {onRerunAnalysis && profiles.length > 0 && (
              <button
                onClick={() => onRerunAnalysis(profiles[0].id)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Analysis
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show empty state
  if (!analysisData) {
    return (
      <div className="bg-[linear-gradient(135deg,rgba(var(--color-primary),0.05)_0%,rgba(168,85,247,0.05)_100%)] border border-[rgba(var(--color-primary),0.2)] rounded-[20px] p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="text-[11px] font-bold text-primary uppercase tracking-[1px]">AI Analysis</div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">No analysis data available yet</p>
            {onRerunAnalysis && profiles.length > 0 && (
              <button
                onClick={() => onRerunAnalysis(profiles[0].id)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Run Analysis
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[linear-gradient(135deg,rgba(var(--color-primary),0.05)_0%,rgba(168,85,247,0.05)_100%)] border border-[rgba(var(--color-primary),0.2)] rounded-[20px] p-7">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-bold text-primary uppercase tracking-[1px]">AI Analysis</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Check className="w-4 h-4 text-emerald-500" />
            {analysisLabels[analysisType]}
          </div>
        </div>
        <div className="relative">
          <button
            onClick={onToggleAnalysisMenu}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-background hover:bg-secondary border border-border hover:border-muted-foreground rounded-lg text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-all"
          >
            {onRerunAnalysis && profiles.length > 0 ? "Re-analyze" : "Change"}
            <ChevronDown className="w-4 h-4" />
          </button>
          {showAnalysisMenu && (
            <div className="absolute right-0 top-full mt-2 bg-background border border-border rounded-lg overflow-hidden z-10 shadow-lg min-w-[220px]">
              {onRerunAnalysis && profiles.length > 0 ? (
                // Show profile options when re-analyze is available
                profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => {
                      onRerunAnalysis(profile.id)
                      onToggleAnalysisMenu()
                    }}
                    className="block w-full px-4 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <div className="text-[13px] font-medium text-foreground">{profile.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{profile.intent}</div>
                  </button>
                ))
              ) : (
                // Fallback to original type selector
                (["summary", "action-items", "sentiment"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      onAnalysisTypeChange(type)
                      onToggleAnalysisMenu()
                    }}
                    className={`block w-full px-4 py-2.5 text-[13px] font-medium text-left transition-colors ${
                      analysisType === type
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {analysisLabels[type]}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <h4 className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.5px] mb-2 mt-4">Summary</h4>
      <p className="text-[15px] text-foreground leading-[1.7] mb-4">{analysisData.summary}</p>

      <h4 className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.5px] mb-2 mt-4">
        Topics Discussed
      </h4>
      <div className="flex flex-wrap gap-2 mb-4">
        {analysisData.topics.map((topic) => (
          <span
            key={topic}
            className="px-3 py-1.5 bg-background border border-border rounded-full text-[13px] text-muted-foreground"
          >
            {topic}
          </span>
        ))}
      </div>

      <h4 className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.5px] mb-2 mt-4">Key Points</h4>
      <ul className="space-y-2">
        {analysisData.keyPoints.map((point, i) => (
          <li key={i} className="relative pl-5 text-sm text-foreground leading-[1.6]">
            <div className="absolute left-0 top-2 w-1.5 h-1.5 bg-[linear-gradient(135deg,var(--color-primary)_0%,#A855F7_100%)] rounded-full" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  )
}
