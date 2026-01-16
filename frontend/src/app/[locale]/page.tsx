"use client"

import { Link } from "@/i18n/routing"
import { Shield } from "lucide-react"
import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { WaitlistFlow } from "@/components/waitlist/waitlist-flow"
import { useWaitlist } from "@/features/transcription/useWaitlist"
import { LiveTranscriptPreview } from "@/components/landing/live-transcript-preview"
import { LanguageSwitcher } from "@/components/ui/language-switcher"
import { MotionDiv } from "@/components/motion"
import { SectionDivider, DIVIDER_COLORS } from "@/components/landing/section-divider"
import {
  heroTitle,
  heroSubtitle,
  heroCta,
  heroNote,
  sectionHeader,
  sectionSubtitle,
  staggerContainer,
  cardItem,
  fadeUp,
  scaleFade,
  stepsContainer,
  stepItem,
} from "@/lib/animation-variants"

export default function HomePage() {
  const t = useTranslations('landing')
  const tNav = useTranslations('navigation')
  const tRoot = useTranslations()

  // Waitlist modal state
  const [waitlistState, setWaitlistState] = useState<"hidden" | "toast" | "form" | "success">("hidden")
  const [waitlistType, setWaitlistType] = useState<"extended_usage" | "api_access">("extended_usage")

  // Form fields (not managed by hook)
  const [useCase, setUseCase] = useState("")
  const [volume, setVolume] = useState("")
  const [source, setSource] = useState("")
  const [copied, setCopied] = useState(false)

  // Hook for API integration
  const waitlist = useWaitlist({
    waitlistType,
    sourcePage: '/'
  })

  const handleWaitlistClick = useCallback((type: "extended_usage" | "api_access") => {
    setWaitlistType(type)
    setWaitlistState("form")
  }, [])

  const handleWaitlistSubmit = useCallback(async () => {
    await waitlist.submit({ useCase, volume, source })
    // Transition to success state - the hook handles errors internally with toasts
    setWaitlistState("success")
  }, [waitlist, useCase, volume, source])

  const handleWaitlistClose = useCallback(() => {
    setWaitlistState("hidden")
    setUseCase("")
    setVolume("")
    setSource("")
    setCopied(false)
    waitlist.reset()
  }, [waitlist])

  const handleWaitlistCopyLink = useCallback(() => {
    const referralLink = `https://eversaid.com?ref=${waitlist.referralCode}`
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [waitlist.referralCode])

  return (
    <main className="h-screen overflow-y-scroll snap-y snap-proximity">
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
            EverSaid
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
          {/* TODO: Enable when API docs are ready */}
          <span
            className="text-white/40 text-[15px] font-medium cursor-not-allowed"
            title="Coming soon"
          >
            {tNav('apiDocs')}
          </span>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="snap-start snap-always relative min-h-screen flex flex-col justify-center items-center px-8 md:px-16 pt-40 pb-[120px] overflow-hidden bg-[linear-gradient(135deg,#0F172A_0%,#1E3A5F_50%,#0F172A_100%)]">
        {/* Background gradients */}
        <div className="absolute top-[-50%] right-[-20%] w-[80%] h-[200%] bg-[radial-gradient(ellipse,rgba(56,189,248,0.15)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute bottom-[-50%] left-[-20%] w-[60%] h-[150%] bg-[radial-gradient(ellipse,rgba(168,85,247,0.1)_0%,transparent_60%)] pointer-events-none" />

        <div className="relative z-10 max-w-[900px] mx-auto text-center">
          <MotionDiv
            variants={heroTitle}
            initial="hidden"
            animate="visible"
          >
            <h1 className="text-4xl md:text-5xl lg:text-[64px] font-extrabold text-white mb-6 leading-[1.05] tracking-[-0.03em]">
              {t('hero.title')}
              <br />
              <span className="bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] bg-clip-text text-transparent">
                {t('hero.titleAccent')}
              </span>
            </h1>
          </MotionDiv>
          <MotionDiv
            variants={heroSubtitle}
            initial="hidden"
            animate="visible"
          >
            <p className="text-lg md:text-[22px] text-white/75 mb-12 max-w-[650px] mx-auto leading-relaxed font-normal">
              {t('hero.subtitle')}
            </p>
          </MotionDiv>
          <MotionDiv
            variants={heroCta}
            initial="hidden"
            animate="visible"
            className="flex gap-4 justify-center flex-wrap"
          >
            <Link
              href="/demo"
              className="bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white px-10 py-[18px] rounded-xl font-bold text-[17px] transition-all hover:-translate-y-0.5 shadow-[0_8px_32px_rgba(56,189,248,0.3)] hover:shadow-[0_12px_40px_rgba(56,189,248,0.4)]"
            >
              {t('hero.cta')}
            </Link>
          </MotionDiv>
          <MotionDiv
            variants={heroNote}
            initial="hidden"
            animate="visible"
            className="mt-8 flex items-center justify-center gap-2 text-sm text-white/60"
          >
            <Shield className="w-4 h-4 opacity-70" />
            {t('hero.noSignup')}
          </MotionDiv>
        </div>
      </section>

      {/* Divider: Hero → Proof Visual */}
      <SectionDivider fillColor={DIVIDER_COLORS.light} />

      {/* Proof Visual Section */}
      <section className="snap-start snap-always min-h-screen flex items-center px-8 md:px-16 py-20 bg-[#F8FAFC]">
        <div className="max-w-[1100px] mx-auto w-full">
          <MotionDiv
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <MotionDiv variants={sectionHeader}>
              <div className="text-[13px] font-semibold text-[#38BDF8] uppercase tracking-[2px] mb-4">
                {t('proofVisual.sectionLabel')}
              </div>
              <h2 className="text-[32px] md:text-[40px] font-extrabold text-[#0F172A] mb-10 tracking-[-0.02em]">
                {t('proofVisual.title')}
              </h2>
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={scaleFade}
          >
            <LiveTranscriptPreview />
          </MotionDiv>
        </div>
      </section>

      {/* Divider: Proof Visual → AI Insights */}
      <SectionDivider fillColor={DIVIDER_COLORS.white} />

      {/* AI Insights Section */}
      <section className="snap-start snap-always min-h-screen flex items-center px-8 md:px-16 py-20" id="insights">
        <div className="max-w-[1200px] mx-auto w-full">
          <MotionDiv
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <MotionDiv variants={sectionHeader}>
              <div className="text-[13px] font-semibold text-[#38BDF8] uppercase tracking-[2px] mb-4">
                {t('insights.sectionLabel')}
              </div>
              <h2 className="text-[32px] md:text-[40px] font-extrabold text-[#0F172A] mb-4 tracking-[-0.02em]">
                {t('insights.title')}
              </h2>
            </MotionDiv>
            <MotionDiv variants={sectionSubtitle}>
              <p className="text-lg text-[#64748B] mb-12 max-w-[600px] mx-auto">
                {t('insights.subtitle')}
              </p>
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] border border-[rgba(56,189,248,0.3)] rounded-[20px] p-8 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[84px] h-[84px] bg-white rounded-[20px] flex items-center justify-center text-[40px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                📋
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('insights.summary.title')}</h3>
              <p className="text-[15px] text-[#64748B] leading-relaxed">
                {t('insights.summary.description')}
              </p>
            </MotionDiv>

            <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[84px] h-[84px] bg-white rounded-[20px] flex items-center justify-center text-[40px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                ✅
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('insights.actionItems.title')}</h3>
              <p className="text-[15px] text-[#64748B] leading-relaxed">
                {t('insights.actionItems.description')}
              </p>
            </MotionDiv>

            <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[84px] h-[84px] bg-white rounded-[20px] flex items-center justify-center text-[40px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                💭
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('insights.reflection.title')}</h3>
              <p className="text-[15px] text-[#64748B] leading-relaxed">
                {t('insights.reflection.description')}
              </p>
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <p className="text-center text-sm text-[#94A3B8] mt-8">
              {t('insights.comingSoon')}
            </p>
          </MotionDiv>
        </div>
      </section>

      {/* Features Section */}
      <section className="snap-start snap-always min-h-screen flex items-center px-8 md:px-16 py-20" id="features">
        <div className="max-w-[1200px] mx-auto w-full">
          <MotionDiv
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <MotionDiv variants={sectionHeader}>
              <div className="text-[13px] font-semibold text-[#38BDF8] uppercase tracking-[2px] mb-4">
                {t('features.sectionLabel')}
              </div>
              <h2 className="text-[32px] md:text-[40px] font-extrabold text-[#0F172A] mb-4 tracking-[-0.02em]">
                {t('features.title')}
              </h2>
            </MotionDiv>
            <MotionDiv variants={sectionSubtitle}>
              <p className="text-lg text-[#64748B] mb-12 max-w-[600px] mx-auto">
                {t('features.subtitle')}
              </p>
            </MotionDiv>
          </MotionDiv>

          {/* Verify Every Word */}
          <div className="mb-12">
            <MotionDiv
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-sm font-bold text-[#38BDF8] uppercase tracking-wider mb-6 text-center"
            >
              {t('features.verifyEveryWord')}
            </MotionDiv>
            <MotionDiv
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer}
            >
              <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                  🔍
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.sideBySide.title')}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{t('features.sideBySide.description')}</p>
              </MotionDiv>

              <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                  👥
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.speakerLabels.title')}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{t('features.speakerLabels.description')}</p>
              </MotionDiv>

              <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                  🎧
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.audioLinked.title')}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{t('features.audioLinked.description')}</p>
              </MotionDiv>

              <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                  ✏️
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.editRevert.title')}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{t('features.editRevert.description')}</p>
              </MotionDiv>
            </MotionDiv>
          </div>

          {/* Your Data, Protected */}
          <div className="mb-6">
            <MotionDiv
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-sm font-bold text-[#38BDF8] uppercase tracking-wider mb-6 text-center"
            >
              {t('features.dataProtected')}
            </MotionDiv>
            <MotionDiv
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer}
            >
              <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                  🇪🇺
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.gdpr.title')}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{t('features.gdpr.description')}</p>
              </MotionDiv>

              <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                  🔒
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.encrypted.title')}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{t('features.encrypted.description')}</p>
              </MotionDiv>

              <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                  🛡️
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.isolated.title')}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{t('features.isolated.description')}</p>
              </MotionDiv>

              <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                <div className="w-[72px] h-[72px] bg-white rounded-[20px] flex items-center justify-center text-[32px] mx-auto mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                  🚫
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-3">{t('features.noTraining.title')}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{t('features.noTraining.description')}</p>
              </MotionDiv>
            </MotionDiv>
            <MotionDiv
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <p className="text-center text-sm text-[#1D3557] mt-5 italic">
                {t('features.disclaimerDemo')}
              </p>
            </MotionDiv>
          </div>

          <MotionDiv
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <p className="text-center text-sm text-[#10B981] font-medium mt-6">
              ✓ {t('features.spellcheck')}
            </p>
          </MotionDiv>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="snap-start snap-always min-h-screen flex items-center px-8 md:px-16 py-20" id="use-cases">
        <div className="max-w-[1200px] mx-auto w-full">
          <MotionDiv
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <MotionDiv variants={sectionHeader}>
              <div className="text-[13px] font-semibold text-[#38BDF8] uppercase tracking-[2px] mb-4">
                {t('useCases.sectionLabel')}
              </div>
              <h2 className="text-[32px] md:text-[40px] font-extrabold text-[#0F172A] mb-4 tracking-[-0.02em]">
                {t('useCases.title')}
              </h2>
            </MotionDiv>
            <MotionDiv variants={sectionSubtitle}>
              <p className="text-lg text-[#64748B] mb-12 max-w-[600px] mx-auto">
                {t('useCases.subtitle')}
              </p>
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-white border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[100px] h-[100px] bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] rounded-[24px] flex items-center justify-center text-[44px] mx-auto mb-5">
                🧠
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('useCases.therapists.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('useCases.therapists.description')}</p>
            </MotionDiv>

            <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-white border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[100px] h-[100px] bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] rounded-[24px] flex items-center justify-center text-[44px] mx-auto mb-5">
                🎤
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('useCases.journalists.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('useCases.journalists.description')}</p>
            </MotionDiv>

            <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-white border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[100px] h-[100px] bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] rounded-[24px] flex items-center justify-center text-[44px] mx-auto mb-5">
                💼
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('useCases.meetings.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('useCases.meetings.description')}</p>
            </MotionDiv>

            <MotionDiv variants={cardItem} whileHover={{ y: -4 }} className="bg-white border border-[#E2E8F0] rounded-[20px] p-8 text-center transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <div className="w-[100px] h-[100px] bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] rounded-[24px] flex items-center justify-center text-[44px] mx-auto mb-5">
                👂
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('useCases.accessibility.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('useCases.accessibility.description')}</p>
            </MotionDiv>
          </MotionDiv>
        </div>
      </section>

      {/* Divider: Use Cases → How It Works */}
      <SectionDivider fillColor={DIVIDER_COLORS.light} />

      {/* How It Works Section */}
      <section className="snap-start snap-always min-h-screen flex items-center px-8 md:px-16 py-20 bg-[#F8FAFC]" id="how-it-works">
        <div className="max-w-[1000px] mx-auto w-full">
          <MotionDiv
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <MotionDiv variants={sectionHeader}>
              <div className="text-[13px] font-semibold text-[#38BDF8] uppercase tracking-[2px] mb-4">
                {t('howItWorks.sectionLabel')}
              </div>
              <h2 className="text-[32px] md:text-[40px] font-extrabold text-[#0F172A] mb-4 tracking-[-0.02em]">
                {t('howItWorks.title')}
              </h2>
            </MotionDiv>
            <MotionDiv variants={sectionSubtitle}>
              <p className="text-lg text-[#64748B] mb-12 max-w-[600px] mx-auto">
                {t('howItWorks.subtitle')}
              </p>
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stepsContainer}
          >
            <MotionDiv variants={stepItem} className="text-center relative">
              <div className="hidden lg:block absolute top-8 right-[-16px] w-8 h-0.5 bg-[linear-gradient(90deg,#38BDF8,#A855F7)] opacity-30" />
              <div className="w-16 h-16 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white rounded-full flex items-center justify-center text-2xl font-extrabold mx-auto mb-5">
                1
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('howItWorks.step1.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                {t('howItWorks.step1.description')}
              </p>
            </MotionDiv>

            <MotionDiv variants={stepItem} className="text-center relative">
              <div className="hidden lg:block absolute top-8 right-[-16px] w-8 h-0.5 bg-[linear-gradient(90deg,#38BDF8,#A855F7)] opacity-30" />
              <div className="w-16 h-16 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white rounded-full flex items-center justify-center text-2xl font-extrabold mx-auto mb-5">
                2
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('howItWorks.step2.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{t('howItWorks.step2.description')}</p>
            </MotionDiv>

            <MotionDiv variants={stepItem} className="text-center relative">
              <div className="hidden lg:block absolute top-8 right-[-16px] w-8 h-0.5 bg-[linear-gradient(90deg,#38BDF8,#A855F7)] opacity-30" />
              <div className="w-16 h-16 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white rounded-full flex items-center justify-center text-2xl font-extrabold mx-auto mb-5">
                3
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('howItWorks.step3.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                {t('howItWorks.step3.description')}
              </p>
            </MotionDiv>

            <MotionDiv variants={stepItem} className="text-center">
              <div className="w-16 h-16 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white rounded-full flex items-center justify-center text-2xl font-extrabold mx-auto mb-5">
                4
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-3">{t('howItWorks.step4.title')}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                {t('howItWorks.step4.description')}
              </p>
            </MotionDiv>
          </MotionDiv>
        </div>
      </section>

      {/* Divider: How It Works → Final CTA */}
      <SectionDivider fillColor={DIVIDER_COLORS.dark} />

      {/* Final CTA Section */}
      <section className="snap-start snap-always min-h-[60vh] flex items-center relative px-8 md:px-16 py-16 text-center overflow-hidden bg-[linear-gradient(135deg,#0F172A_0%,#1E3A5F_100%)]">
        <div className="absolute top-[-50%] right-[-20%] w-[60%] h-[200%] bg-[radial-gradient(ellipse,rgba(56,189,248,0.1)_0%,transparent_60%)] pointer-events-none" />

        <MotionDiv
          className="relative z-10 max-w-[600px] mx-auto w-full"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
        >
          <MotionDiv variants={sectionHeader}>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-[-0.02em]">
              {t('finalCta.title')}
            </h2>
          </MotionDiv>
          <MotionDiv variants={sectionSubtitle}>
            <p className="text-lg text-white/70 mb-8">{t('finalCta.subtitle')}</p>
          </MotionDiv>
          <MotionDiv variants={scaleFade}>
            <Link
              href="/demo"
              className="inline-block bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] text-white px-12 py-5 rounded-xl font-bold text-lg transition-all hover:-translate-y-0.5 shadow-[0_8px_32px_rgba(56,189,248,0.3)] hover:shadow-[0_12px_40px_rgba(56,189,248,0.4)]"
            >
              {t('finalCta.cta')}
            </Link>
          </MotionDiv>
          <MotionDiv variants={fadeUp}>
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
          </MotionDiv>
        </MotionDiv>
      </section>

      {/* Footer */}
      <footer className="px-8 md:px-16 py-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-t border-[#E2E8F0]">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <span className="text-sm text-[#64748B]">{t('footer.copyright', { year: new Date().getFullYear() })}</span>
          <span className="flex items-center gap-1.5 text-[13px] text-[#94A3B8] px-3 py-1.5 bg-[#F8FAFC] rounded-lg">
            🇸🇮 {t('footer.builtIn')}
          </span>
        </div>
        <div className="flex gap-8 items-center">
          <Link href="#" className="text-sm text-[#64748B] hover:text-[#0F172A] font-medium transition-colors">
            {t('footer.privacy')}
          </Link>
          <Link href="#" className="text-sm text-[#64748B] hover:text-[#0F172A] font-medium transition-colors">
            {t('footer.terms')}
          </Link>
          <a href="mailto:hello@eversaid.ai" className="text-sm text-[#64748B] hover:text-[#0F172A] font-medium transition-colors">
            hello@eversaid.ai
          </a>
          <a
            href="https://github.com/gaspermerela/eversaid"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            GitHub
          </a>
        </div>
      </footer>

      <WaitlistFlow
        state={waitlistState}
        type={waitlistType}
        email={waitlist.email}
        useCase={useCase}
        volume={volume}
        source={source}
        isSubmitting={waitlist.isSubmitting}
        referralCode={waitlist.referralCode || ""}
        copied={copied}
        onEmailChange={waitlist.setEmail}
        onUseCaseChange={setUseCase}
        onVolumeChange={setVolume}
        onSourceChange={setSource}
        onSubmit={handleWaitlistSubmit}
        onClose={handleWaitlistClose}
        onCopyLink={handleWaitlistCopyLink}
        t={tRoot}
      />
    </main>
  )
}
