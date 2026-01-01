'use client'

import { X, Clock, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

export interface RateLimitModalProps {
  isOpen: boolean
  retryAfter: number | null
  onClose: () => void
  onJoinWaitlist: () => void
}

/**
 * Format seconds into MM:SS format
 */
function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Modal shown when user hits rate limit (429).
 * Displays countdown timer and waitlist CTA.
 */
export function RateLimitModal({
  isOpen,
  retryAfter,
  onClose,
  onJoinWaitlist,
}: RateLimitModalProps) {
  const t = useTranslations('rateLimit')
  const tCommon = useTranslations('common')
  const [countdown, setCountdown] = useState<number>(retryAfter ?? 0)

  // Sync countdown with retryAfter prop when it changes
  useEffect(() => {
    if (retryAfter !== null && retryAfter > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from prop
      setCountdown(retryAfter)
    }
  }, [retryAfter])

  // Countdown timer
  useEffect(() => {
    if (!isOpen || countdown <= 0) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onClose()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, countdown, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-limit-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[2000] bg-[rgba(15,23,42,0.7)] backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300"
    >
      <div className="bg-white rounded-3xl w-full max-w-[400px] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.2)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-[linear-gradient(135deg,#0F172A_0%,#1E3A5F_100%)] px-6 pt-8 pb-7 text-center relative">
          <button
            onClick={onClose}
            aria-label={tCommon('close')}
            className="absolute top-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all"
          >
            <X className="w-[18px] h-[18px] stroke-white/70" strokeWidth={2} />
          </button>

          <div className="w-16 h-16 bg-[linear-gradient(135deg,rgba(251,191,36,0.2)_0%,rgba(245,158,11,0.2)_100%)] rounded-[20px] flex items-center justify-center mx-auto mb-5">
            <Clock className="w-8 h-8 stroke-amber-400" strokeWidth={2} />
          </div>

          <h2 id="rate-limit-title" className="text-2xl font-extrabold text-white mb-2">
            {t('title')}
          </h2>
          <p className="text-[15px] text-white/70 leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 pt-7 pb-8">
          {/* Countdown */}
          <div className="text-center mb-6">
            <div className="text-sm text-gray-500 mb-2">{t('tryAgainIn')}</div>
            <div className="text-5xl font-mono font-bold text-gray-900 tracking-wider">
              {formatCountdown(countdown)}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{tCommon('or')}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Waitlist CTA */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-4">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>{t('unlimitedCta')}</span>
            </div>
            <button
              onClick={onJoinWaitlist}
              className="w-full py-3.5 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] hover:shadow-[0_8px_24px_rgba(56,189,248,0.4)] hover:-translate-y-0.5 text-white text-base font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(56,189,248,0.3)]"
            >
              {t('joinWaitlistBtn')}
            </button>
          </div>

          {/* Wait button */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-all"
          >
            {t('waitItOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
