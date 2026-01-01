import { Check } from "lucide-react"

export function FeaturesHint() {
  const features = [
    "Side-by-side comparison",
    "Speaker identification",
    "AI-powered cleanup",
    "Audio-linked segments",
    "Conversation analysis",
  ]

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
      <h4 className="text-[13px] font-bold text-[#38BDF8] uppercase tracking-[1px] mb-4">What you&apos;ll get</h4>
      <div className="space-y-3">
        {features.map((feature) => (
          <div key={feature} className="flex items-center gap-3 text-[13px] text-[#64748B]">
            <Check className="w-4 h-4 stroke-[#10B981] flex-shrink-0" />
            {feature}
          </div>
        ))}
      </div>
    </div>
  )
}
