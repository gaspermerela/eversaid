"use client"

import { Link } from "@/i18n/routing"
import { Shield } from "lucide-react"
import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { WaitlistFlow } from "@/components/waitlist/waitlist-flow"
import { LiveTranscriptPreview } from "@/components/landing/live-transcript-preview"
import { LanguageSwitcher } from "@/components/ui/language-switcher"

export default function HomePage() {
  const t = useTranslations('landing')
  const tNav = useTranslations('navigation')
  const tRoot = useTranslations()

  const [waitlistState, setWaitlistState] = useState<"hidden" | "toast" | "form" | "success">("hidden")
  const [waitlistType, setWaitlistType] = useState<"extended_usage" | "api_access">("extended_usage")
  const [waitlistEmail, setWaitlistEmail] = useState("")
  const [waitlistReferralCode, setWaitlistReferralCode] = useState("")
  const [waitlistCopied, setWaitlistCopied] = useState(false)

  const handleWaitlistClick = useCallback((type: "extended_usage" | "api_access") => {
    setWaitlistType(type)
    setWaitlistState("form")
  }, [])

  const handleWaitlistEmailChange = useCallback((email: string) => {
    setWaitlistEmail(email)
  }, [])

  const handleWaitlistSubmit = useCallback(() => {
    console.log("Waitlist submission:", { email: waitlistEmail, type: waitlistType })
    const mockReferralCode = `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    setWaitlistReferralCode(mockReferralCode)
    setWaitlistState("success")
  }, [waitlistEmail, waitlistType])

  const handleWaitlistClose = useCallback(() => {
    setWaitlistState("hidden")
    setWaitlistEmail("")
    setWaitlistReferralCode("")
    setWaitlistCopied(false)
  }, [])

  const handleWaitlistCopyCode = useCallback(() => {
    navigator.clipboard.writeText(waitlistReferralCode)
  }, [waitlistReferralCode])

  const handleWaitlistCopyLink = useCallback(() => {
    const referralLink = `https://eversaid.com?ref=${waitlistReferralCode}`
    navigator.clipboard.writeText(referralLink)
    setWaitlistCopied(true)
    setTimeout(() => setWaitlistCopied(false), 2000)
  }, [waitlistReferralCode])

  return (
    <main>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 md:px-16 py-5 bg-transparent">
        <Link href="/" className="flex items-center gap-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 44" className="h-[39px] w-auto">
            <g transform="translate(0, 0)">
              {/* Messy lines (left) */}
              <line
                x1="0"
                y1="10"
                x2="20"
                y2="12"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="0"
                y1="22"
                x2="18"
                y2="20"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="0"
                y1="32"
                x2="22"
                y2="34"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Arrow */}
              <path d="M25 22 L38 22" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
              <path
                d="M34 16 L40 22 L34 28"
                stroke="#38BDF8"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Clean lines (right) */}
              <line x1="45" y1="10" x2="65" y2="10" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="45" y1="22" x2="65" y2="22" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="45" y1="34" x2="65" y2="34" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </g>
          </svg>
          <span className="font-[family-name:var(--font-comfortaa)] font-bold text-[27px] text-white tracking-[0.01em]">
            eversaid
          </span>
        </Link>
        <div className="hidden md:flex gap-10 items-center">
          <Link href="#features" className="text-white/80 hover:text-white text-[15px] font-medium transition-colors">
            {tNav('features')}
          </Link>
          <Link href="#use-cases" className="text-white/80 hover:text-white text-[15px] font-medium transition-colors">
            {tNav('useCases')}
          </Link>
          <Link
            href="#how-it-works"
            className="text-white/80 hover:text-white text-[15px] font-medium transition-colors"
          >
            {tNav('howItWorks')}
          </Link>
          <Link href="/api-docs" className="text-white/80 hover:text-white text-[15px] font-medium transition-colors">
            {tNav('apiDocs')}
          </Link>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col justify-center items-center px-8 md:px-16 pt-40 pb-[120px] overflow-hidden bg-[linear-gradient(135deg,#0F172A_0%,#1E3A5F_50%,#0F172A_100%)]">
        {/* Background gradients */}
        <div className="absolute top-[-50%] right-[-20%] w-[80%] h-[200%] bg-[radial-gradient(ellipse,rgba(56,189,248,0.15)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute bottom-[-50%] left-[-20%] w-[60%] h-[150%] bg-[radial-gradient(ellipse,rgba(168,85,247,0.1)_0%,transparent_60%)] pointer-events-none" />

        <div className="relative z-10 max-w-[900px] mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-[64px] font-extrabold text-white mb-6 leading-[1.05] tracking-[-0.03em]">
            {t('hero.title')}
            <br />
            <span className="bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] bg-clip-text text-transparent">
              {t('hero.titleAccent')}
            </span>
          </h1>
          <p className="text-lg md:text-[22px] text-white/75 mb-12 max-w-[650px] mx-auto leading-relaxed font-normal">
            {t('hero.subtitle')}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/demo"
              className="bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white px-10 py-[18px] rounded-xl font-bold text-[17px] transition-all hover:-translate-y-0.5 shadow-[0_8px_32px_rgba(56,189,248,0.3)] hover:shadow-[0_12px_40px_rgba(56,189,248,0.4)]"
            >
              {t('hero.cta')}
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-white/60">
            <Shield className="w-4 h-4 opacity-70" />
            {t('hero.noSignup')}
          </div>
        </div>
      </section>

      {/* Proof Visual Section */}
      <section className="px-8 md:px-16 py-20 bg-[#F8FAFC]">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center text-[13px] font-semibold text-[#38BDF8] uppercase tracking-[2px] mb-4">
            {t('proofVisual.sectionLabel')}
          </div>
          <h2 className="text-center text-[32px] md:text-[40px] font-extrabold text-[#0F172A] mb-10 tracking-[-0.02em]">
            {t('proofVisual.title')}
          </h2>

          <LiveTranscriptPreview />
        </div>
      </section>

      {/* AI Insights Section */}
      <section className="px-8 md:px-16 py-20 max-w-[1200px] mx-auto" id="insights">
        <div className="text-center text-[13px] font-semibold text-[#38BDF8] uppercase tracking-[2px] mb-4">
          {t('insights.sectionLabel')}
        </div>
        <h2 className="text-center text-[32px] md:text-[40px] font-extrabold text-[#0F172A] mb-4 tracking-[-0.02em]">
          {t('insights.title')}
        </h2>
        <p className="text-center text-lg text-[#64748B] mb-12 max-w-[600px] mx-auto">
          {t('insights.subtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] border border-[rgba(56,189,248,0.3)] rounded-[20px] p-8 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <div className="w-[84px] h-[84px] bg-white rounded-[20px] flex items-center justify-center text-[40px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
              📋
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('insights.summary.title')}</h3>
            <p className="text-[15px] text-[#64748B] leading-relaxed">
              {t('insights.summary.description')}
            </p>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <div className="w-[84px] h-[84px] bg-white rounded-[20px] flex items-center justify-center text-[40px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
              ✅
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('insights.actionItems.title')}</h3>
            <p className="text-[15px] text-[#64748B] leading-relaxed">
              {t('insights.actionItems.description')}
            </p>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <div className="w-[84px] h-[84px] bg-white rounded-[20px] flex items-center justify-center text-[40px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
              💭
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('insights.reflection.title')}</h3>
            <p className="text-[15px] text-[#64748B] leading-relaxed">
              {t('insights.reflection.description')}
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-[#94A3B8] mt-8">
          {t('insights.comingSoon')}
        </p>
      </section>

      {/* Features Section */}
      <section className="px-8 md:px-16 py-20 max-w-[1200px] mx-auto" id="features">
        <div className="text-center text-[13px] font-semibold text-[#38BDF8] uppercase tracking-[2px] mb-4">
          {t('features.sectionLabel')}
        </div>
        <h2 className="text-center text-[32px] md:text-[40px] font-extrabold text-[#0F172A] mb-4 tracking-[-0.02em]">
          {t('features.title')}
        </h2>
        <p className="text-center text-lg text-[#64748B] mb-12 max-w-[600px] mx-auto">
          {t('features.subtitle')}
        </p>

        {/* Verify Every Word */}
        <div className="mb-12">
          <div className="text-sm font-bold text-[#38BDF8] uppercase tracking-wider mb-6 text-center">
            {t('features.verifyEveryWord')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                🔍
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.sideBySide.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('features.sideBySide.description')}</p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                👥
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.speakerLabels.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('features.speakerLabels.description')}</p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                🎧
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.audioLinked.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('features.audioLinked.description')}</p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                ✏️
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.editRevert.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('features.editRevert.description')}</p>
            </div>
          </div>
        </div>

        {/* Your Data, Protected */}
        <div className="mb-6">
          <div className="text-sm font-bold text-[#38BDF8] uppercase tracking-wider mb-6 text-center">
            {t('features.dataProtected')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                🇪🇺
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.gdpr.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('features.gdpr.description')}</p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                🔒
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.encrypted.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('features.encrypted.description')}</p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                🛡️
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.isolated.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('features.isolated.description')}</p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                🚫
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.noTraining.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('features.noTraining.description')}</p>
            </div>
          </div>
          <p className="text-center text-[13px] text-[#1D3557] mt-5 italic">
            {t('features.disclaimerDemo')}
          </p>
        </div>

        <p className="text-center text-sm text-[#10B981] font-medium mt-6">
          ✓ {t('features.spellcheck')}
        </p>
      </section>

      {/* Use Cases Section */}
      <section className="px-8 md:px-16 py-20 max-w-[1200px] mx-auto" id="use-cases">
        <div className="text-center text-[13px] font-semibold text-[#38BDF8] uppercase tracking-[2px] mb-4">
          {t('useCases.sectionLabel')}
        </div>
        <h2 className="text-center text-[32px] md:text-[40px] font-extrabold text-[#0F172A] mb-4 tracking-[-0.02em]">
          {t('useCases.title')}
        </h2>
        <p className="text-center text-lg text-[#64748B] mb-12 max-w-[600px] mx-auto">
          {t('useCases.subtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <div className="w-[100px] h-[100px] bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] rounded-[24px] flex items-center justify-center text-[44px] mx-auto mb-5">
              🧠
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('useCases.therapists.title')}</h3>
            <p className="text-sm text-[#64748B] leading-relaxed">{t('useCases.therapists.description')}</p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <div className="w-[100px] h-[100px] bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] rounded-[24px] flex items-center justify-center text-[44px] mx-auto mb-5">
              🎤
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('useCases.journalists.title')}</h3>
            <p className="text-sm text-[#64748B] leading-relaxed">{t('useCases.journalists.description')}</p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <div className="w-[100px] h-[100px] bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] rounded-[24px] flex items-center justify-center text-[44px] mx-auto mb-5">
              💼
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('useCases.meetings.title')}</h3>
            <p className="text-sm text-[#64748B] leading-relaxed">{t('useCases.meetings.description')}</p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <div className="w-[100px] h-[100px] bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] rounded-[24px] flex items-center justify-center text-[44px] mx-auto mb-5">
              👂
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('useCases.accessibility.title')}</h3>
            <p className="text-sm text-[#64748B] leading-relaxed">{t('useCases.accessibility.description')}</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-8 md:px-16 py-20 bg-[#F8FAFC]" id="how-it-works">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-center text-[13px] font-semibold text-[#38BDF8] uppercase tracking-[2px] mb-4">
            {t('howItWorks.sectionLabel')}
          </div>
          <h2 className="text-center text-[32px] md:text-[40px] font-extrabold text-[#0F172A] mb-4 tracking-[-0.02em]">
            {t('howItWorks.title')}
          </h2>
          <p className="text-center text-lg text-[#64748B] mb-12 max-w-[600px] mx-auto">
            {t('howItWorks.subtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12">
            <div className="text-center relative">
              <div className="hidden lg:block absolute top-8 right-[-16px] w-8 h-0.5 bg-[linear-gradient(90deg,#38BDF8,#A855F7)] opacity-30" />
              <div className="w-16 h-16 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white rounded-full flex items-center justify-center text-2xl font-extrabold mx-auto mb-5">
                1
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('howItWorks.step1.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                {t('howItWorks.step1.description')}
              </p>
            </div>

            <div className="text-center relative">
              <div className="hidden lg:block absolute top-8 right-[-16px] w-8 h-0.5 bg-[linear-gradient(90deg,#38BDF8,#A855F7)] opacity-30" />
              <div className="w-16 h-16 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white rounded-full flex items-center justify-center text-2xl font-extrabold mx-auto mb-5">
                2
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('howItWorks.step2.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('howItWorks.step2.description')}</p>
            </div>

            <div className="text-center relative">
              <div className="hidden lg:block absolute top-8 right-[-16px] w-8 h-0.5 bg-[linear-gradient(90deg,#38BDF8,#A855F7)] opacity-30" />
              <div className="w-16 h-16 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white rounded-full flex items-center justify-center text-2xl font-extrabold mx-auto mb-5">
                3
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('howItWorks.step3.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                {t('howItWorks.step3.description')}
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white rounded-full flex items-center justify-center text-2xl font-extrabold mx-auto mb-5">
                4
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('howItWorks.step4.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                {t('howItWorks.step4.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative px-8 md:px-16 py-16 text-center overflow-hidden bg-[linear-gradient(135deg,#0F172A_0%,#1E3A5F_100%)]">
        <div className="absolute top-[-50%] right-[-20%] w-[60%] h-[200%] bg-[radial-gradient(ellipse,rgba(56,189,248,0.1)_0%,transparent_60%)] pointer-events-none" />

        <div className="relative z-10 max-w-[600px] mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-[-0.02em]">
            {t('finalCta.title')}
          </h2>
          <p className="text-lg text-white/70 mb-8">{t('finalCta.subtitle')}</p>
          <Link
            href="/demo"
            className="inline-block bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white px-12 py-5 rounded-xl font-bold text-lg transition-all hover:-translate-y-0.5 shadow-[0_8px_32px_rgba(56,189,248,0.3)] hover:shadow-[0_12px_40px_rgba(56,189,248,0.4)]"
          >
            {t('finalCta.cta')}
          </Link>
          <div className="mt-6 text-[15px] text-white/60">
            {t('finalCta.waitlistPrompt')}{" "}
            <button
              onClick={() => handleWaitlistClick("extended_usage")}
              className="text-[#38BDF8] hover:text-white font-medium transition-colors"
            >
              {t('finalCta.waitlistCta')}
            </button>
            <span className="block mt-2 text-[13px] text-white/40">
              {t('finalCta.referralNote')}
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 md:px-16 py-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-t border-[#E2E8F0]">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <span className="text-sm text-[#64748B]">{t('footer.copyright', { year: new Date().getFullYear() })}</span>
          <span className="flex items-center gap-1.5 text-[13px] text-[#94A3B8] px-3 py-1.5 bg-[#F8FAFC] rounded-lg">
            🇸🇮 {t('footer.builtIn')}
          </span>
        </div>
        <div className="flex gap-8">
          <Link href="#" className="text-sm text-[#64748B] hover:text-[#0F172A] font-medium transition-colors">
            {t('footer.privacy')}
          </Link>
          <Link href="#" className="text-sm text-[#64748B] hover:text-[#0F172A] font-medium transition-colors">
            {t('footer.terms')}
          </Link>
          <Link href="#" className="text-sm text-[#64748B] hover:text-[#0F172A] font-medium transition-colors">
            {t('footer.contact')}
          </Link>
        </div>
      </footer>

      <WaitlistFlow
        state={waitlistState}
        type={waitlistType}
        email={waitlistEmail}
        referralCode={waitlistReferralCode}
        copied={waitlistCopied}
        onEmailChange={handleWaitlistEmailChange}
        onSubmit={handleWaitlistSubmit}
        onClose={handleWaitlistClose}
        onCopyCode={handleWaitlistCopyCode}
        onCopyLink={handleWaitlistCopyLink}
        t={tRoot}
      />
    </main>
  )
}
