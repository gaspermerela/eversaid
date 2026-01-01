/* eslint-disable react/no-unescaped-entities */
"use client"

import { Link } from "@/i18n/routing"
import { useState, useEffect } from "react"
import { Check, LinkIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { WaitlistFlow } from "@/components/waitlist/waitlist-flow"

export default function ApiDocsPage() {
  const tNav = useTranslations('navigation')
  const [activeSection, setActiveSection] = useState("quickstart")
  const [activeTab, setActiveTab] = useState<Record<string, string>>({
    register: "curl",
    login: "curl",
    workflow: "python",
  })
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [copiedAnchor, setCopiedAnchor] = useState<string | null>(null)

  // For upload tab
  const [activeUploadTab, setActiveUploadTab] = useState<string>("cURL")

  const [waitlistState, setWaitlistState] = useState<"hidden" | "toast" | "form" | "success">("hidden")
  const [waitlistEmail, setWaitlistEmail] = useState("")
  const [waitlistReferralCode, setWaitlistReferralCode] = useState("")

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleCopyAnchor = (anchorId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${anchorId}`
    navigator.clipboard.writeText(url)
    setCopiedAnchor(anchorId)
    setTimeout(() => setCopiedAnchor(null), 2000)
  }

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      setActiveSection(sectionId)
      const navHeight = 80
      const targetPosition = element.offsetTop - navHeight
      window.scrollTo({ top: targetPosition, behavior: "smooth" })
    }
  }

  const handleWaitlistSubmit = () => {
    setWaitlistReferralCode("ABC123XYZ")
    setWaitlistState("success")
  }

  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        "quickstart",
        "authentication",
        "options",
        "languages",
        "analysis-profiles",
        "upload",
        "entries",
        "transcription",
        "cleanup",
        "analysis",
        "workflow",
        "polling",
      ]
      const scrollPosition = window.scrollY + 120

      for (const sectionId of sections) {
        const element = document.getElementById(sectionId)
        if (element) {
          const offsetTop = element.offsetTop
          const offsetBottom = offsetTop + element.offsetHeight
          if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
            setActiveSection(sectionId)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <WaitlistFlow
        state={waitlistState}
        type="api_access"
        email={waitlistEmail}
        referralCode={waitlistReferralCode}
        onClose={() => setWaitlistState("hidden")}
        onEmailChange={setWaitlistEmail}
        onSubmit={handleWaitlistSubmit}
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 flex justify-between items-center px-8 md:px-12 py-4 bg-[linear-gradient(135deg,#0F172A_0%,#1E3A5F_50%,#0F172A_100%)]">
        <Link href="/" className="flex items-center gap-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 44" className="h-8 w-auto">
            <g>
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
              <path d="M25 22 L38 22" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
              <path
                d="M34 16 L40 22 L34 28"
                stroke="#38BDF8"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line x1="45" y1="10" x2="65" y2="10" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="45" y1="22" x2="65" y2="22" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="45" y1="34" x2="65" y2="34" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </g>
          </svg>
          <span className="font-[family-name:var(--font-comfortaa)] font-bold text-[22px] text-white tracking-[0.01em]">
            eversaid
          </span>
        </Link>

        <div className="hidden md:flex gap-8 items-center">
          <Link href="/" className="text-white/70 hover:text-white text-sm font-medium transition-colors">
            {tNav('home')}
          </Link>
          <Link href="/demo" className="text-white/70 hover:text-white text-sm font-medium transition-colors">
            {tNav('demo')}
          </Link>
          <Link
            href="/api-docs"
            className="text-white text-sm font-medium relative pb-2 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] after:rounded-[1px]"
          >
            {tNav('apiDocs')}
          </Link>
        </div>

        <button
          onClick={() => setWaitlistState("form")}
          className="px-5 py-2.5 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] hover:shadow-[0_4px_12px_rgba(56,189,248,0.3)] hover:-translate-y-px text-white text-sm font-semibold rounded-lg transition-all"
        >
          {tNav('joinWaitlist')}
        </button>
      </nav>

      {/* Hero Section */}
      <div className="bg-[linear-gradient(180deg,white_0%,#F8FAFC_100%)] border-b border-[#E2E8F0] px-8 md:px-12 py-12">
        <div className="max-w-[1200px] mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] border border-[rgba(56,189,248,0.2)] rounded-full text-[12px] font-semibold text-[#38BDF8] mb-4">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            Core API
          </div>
          <h1 className="text-4xl md:text-[36px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-3">
            API Documentation
          </h1>
          <p className="text-[17px] text-[#64748B] max-w-[600px] leading-relaxed">
            Integrate eversaid's transcription, cleanup, and analysis capabilities into your application. RESTful API
            with JSON responses.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1200px] mx-auto px-8 md:px-12 py-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
        {/* Sidebar */}
        <aside className="hidden lg:block sticky top-24 h-fit">
          <div className="mb-6">
            <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3">Getting Started</div>
            <div className="flex flex-col gap-0.5">
              {[
                { id: "quickstart", label: "Quick Start" },
                { id: "authentication", label: "Authentication" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-left px-3 py-2 text-sm rounded-lg transition-all border-l-2 ${
                    activeSection === item.id
                      ? "bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] text-[#0F172A] font-semibold border-[#38BDF8]"
                      : "text-[#64748B] hover:bg-white hover:text-[#0F172A] border-transparent"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3">Public Endpoints</div>
            <div className="flex flex-col gap-0.5">
              {[
                { id: "options", label: "Options" },
                { id: "languages", label: "Languages" },
                { id: "analysis-profiles", label: "Analysis Profiles" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-left px-3 py-2 text-sm rounded-lg transition-all border-l-2 relative ${
                    activeSection === item.id
                      ? "bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] text-[#0F172A] font-semibold border-[#38BDF8]"
                      : "text-[#64748B] hover:bg-white hover:text-[#0F172A] border-transparent"
                  }`}
                >
                  {item.label}
                  <span className="ml-2 text-[9px] font-bold text-[#10B981] bg-[rgba(16,185,129,0.1)] px-1.5 py-0.5 rounded">
                    PUBLIC
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3">Core API</div>
            <div className="flex flex-col gap-0.5">
              {[
                { id: "upload", label: "Upload" },
                { id: "entries", label: "Entries" },
                { id: "transcription", label: "Transcription" },
                { id: "cleanup", label: "Cleanup" },
                { id: "analysis", label: "Analysis" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-left px-3 py-2 text-sm rounded-lg transition-all border-l-2 ${
                    activeSection === item.id
                      ? "bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] text-[#0F172A] font-semibold border-[#38BDF8]"
                      : "text-[#64748B] hover:bg-white hover:text-[#0F172A] border-transparent"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3">Examples</div>
            <div className="flex flex-col gap-0.5">
              {[
                { id: "workflow", label: "Complete Workflow" },
                { id: "polling", label: "Polling Pattern" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-left px-3 py-2 text-sm rounded-lg transition-all border-l-2 ${
                    activeSection === item.id
                      ? "bg-[linear-gradient(135deg,rgba(56,189,248,0.1)_0%,rgba(168,85,247,0.1)_100%)] text-[#0F172A] font-semibold border-[#38BDF8]"
                      : "text-[#64748B] hover:bg-white hover:text-[#0F172A] border-transparent"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0">
          {/* Quick Start Section */}
          <section id="quickstart" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Getting Started</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4 flex items-center gap-2">
              Quick Start
              <button
                onClick={() => handleCopyAnchor("quickstart")}
                aria-label="Copy link to section"
                className={`opacity-0 hover:opacity-100 group-hover:opacity-100 p-1 rounded hover:bg-[rgba(56,189,248,0.1)] transition-all ${
                  copiedAnchor === "quickstart" ? "opacity-100 text-[#16A34A]" : "text-[#94A3B8] hover:text-[#38BDF8]"
                }`}
              >
                {copiedAnchor === "quickstart" ? (
                  <Check className="w-[18px] h-[18px]" />
                ) : (
                  <LinkIcon className="w-[18px] h-[18px]" />
                )}
              </button>
            </h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-4">
              The eversaid API provides speech-to-text transcription with AI-powered cleanup and analysis. All responses
              are JSON.
            </p>

            {/* Base URL */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 mb-5">
              <div className="text-[12px] font-semibold text-[#64748B] mb-2">Base URL</div>
              <div className="flex items-center gap-3">
                <code className="flex-1 px-4 py-3 bg-[#0F172A] rounded-lg font-mono text-sm text-[#38BDF8]">
                  https://api.eversaid.com/api/v1
                </code>
              </div>
            </div>

            <h3 className="text-[20px] font-bold text-[#0F172A] mt-8 mb-3">API Versioning</h3>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-4">
              All endpoints are prefixed with{" "}
              <code className="px-1.5 py-0.5 bg-[#F1F5F9] text-[#0F172A] font-mono text-sm rounded">/api/v1</code>. We
              use semantic versioning and will maintain backward compatibility within major versions.
            </p>

            <h3 className="text-[20px] font-bold text-[#0F172A] mt-8 mb-3">Response Format</h3>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-2">
              All responses return JSON with appropriate HTTP status codes:
            </p>
            <ul className="mb-4 pl-6">
              <li className="text-[15px] text-[#475569] leading-[1.7] mb-2">
                <strong>2xx</strong> - Success (200, 201, 202)
              </li>
              <li className="text-[15px] text-[#475569] leading-[1.7] mb-2">
                <strong>4xx</strong> - Client error (400, 401, 404, 422)
              </li>
              <li className="text-[15px] text-[#475569] leading-[1.7] mb-2">
                <strong>5xx</strong> - Server error (500, 503)
              </li>
            </ul>

            <div className="bg-[linear-gradient(135deg,rgba(56,189,248,0.08)_0%,rgba(168,85,247,0.08)_100%)] border border-[rgba(56,189,248,0.2)] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[13px] font-bold text-[#0284C7] mb-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                Try the Public Endpoints
              </div>
              <p className="text-[14px] text-[#475569] mb-0">
                Three endpoints require no authentication. Use them to explore available models, languages, and analysis
                profiles before signing up.
              </p>
            </div>
          </section>

          {/* Authentication Section - with comprehensive content from HTML */}
          <section id="authentication" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Getting Started</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4">Authentication</h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              The API uses JWT (JSON Web Token) bearer authentication. You must register an account, login to receive
              tokens, and include the access token in all authenticated requests.
            </p>

            {/* Auth Flow Steps */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[
                { num: 1, title: "Register", desc: "Create account with email + password" },
                { num: 2, title: "Login", desc: "Receive access + refresh tokens" },
                { num: 3, title: "Use API", desc: "Include token in Authorization header" },
                { num: 4, title: "Refresh", desc: "Get new tokens when expired" },
              ].map((step, idx) => (
                <div key={idx} className="relative bg-white border border-[#E2E8F0] rounded-xl p-5 text-center">
                  <div className="w-8 h-8 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] rounded-full flex items-center justify-center text-sm font-bold text-white mx-auto mb-3">
                    {step.num}
                  </div>
                  <h4 className="text-sm font-bold text-[#0F172A] mb-1">{step.title}</h4>
                  <p className="text-[12px] text-[#64748B] mb-0">{step.desc}</p>
                </div>
              ))}
            </div>

            <h3 className="text-[20px] font-bold text-[#0F172A] mt-8 mb-4">Step 1: Register</h3>
            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden mb-5">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1.5 bg-[#DBEAFE] text-[#1E40AF] rounded-md text-[11px] font-bold font-mono">
                  POST
                </span>
                <code className="font-mono text-sm font-medium text-[#0F172A]">/auth/register</code>
                <span className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-[#10B981]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  No Auth
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-[#64748B] mb-4">Create a new user account with email and password.</p>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <th className="px-3 py-2.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                          Parameter
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[#F1F5F9]">
                        <td className="px-3 py-3 text-[13px]">
                          <code className="font-mono font-medium text-[#0F172A]">email</code>
                          <span className="ml-2 px-1.5 py-0.5 bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold rounded">
                            REQUIRED
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[13px]">
                          <code className="font-mono text-[12px] text-[#64748B]">string</code>
                        </td>
                        <td className="px-3 py-3 text-[13px] text-[#475569]">Valid email address</td>
                      </tr>
                      <tr className="border-b border-[#F1F5F9]">
                        <td className="px-3 py-3 text-[13px]">
                          <code className="font-mono font-medium text-[#0F172A]">password</code>
                          <span className="ml-2 px-1.5 py-0.5 bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold rounded">
                            REQUIRED
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[13px]">
                          <code className="font-mono text-[12px] text-[#64748B]">string</code>
                        </td>
                        <td className="px-3 py-3 text-[13px] text-[#475569]">Minimum 8 characters</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Code tabs for register */}
            <div className="bg-[#0F172A] rounded-xl overflow-hidden mb-6">
              <div className="flex bg-white/5 border-b border-white/10">
                {["curl", "python", "js"].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveTab({ ...activeTab, register: lang })}
                    className={`px-5 py-3 text-[13px] font-medium transition-all relative ${
                      activeTab.register === lang
                        ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)]"
                        : "text-[#64748B] hover:text-[#94A3B8]"
                    }`}
                  >
                    {lang === "curl" ? "cURL" : lang === "python" ? "Python" : "JavaScript"}
                  </button>
                ))}
              </div>
              <div className="p-5 overflow-x-auto">
                {activeTab.register === "curl" && (
                  <pre className="font-mono text-[13px] leading-relaxed text-[#E2E8F0]">
                    <span className="text-[#F472B6]">curl</span> -X POST https://api.eversaid.com/api/v1/auth/register{" "}
                    {"\n"}
                    -H <span className="text-[#86EFAC]">"Content-Type: application/json"</span> {"\n"}
                    -d{" "}
                    <span className="text-[#86EFAC]">
                      {'{\n    "email": "user@example.com",\n    "password": "your-secure-password"\n  }'}
                    </span>
                  </pre>
                )}
                {activeTab.register === "python" && (
                  <pre className="font-mono text-[13px] leading-relaxed text-[#E2E8F0]">
                    <span className="text-[#F472B6]">import</span> requests{"\n\n"}
                    response = requests.post(
                    <span className="text-[#86EFAC]">"https://api.eversaid.com/api/v1/auth/register"</span>, {"{"}
                    {"\n"}
                    <span className="text-[#86EFAC]">"email"</span>:{" "}
                    <span className="text-[#86EFAC]">"user@example.com"</span>,{"\n"}
                    <span className="text-[#86EFAC]">"password"</span>:{" "}
                    <span className="text-[#86EFAC]">"your-secure-password"</span>
                    {"\n"}
                    {"}"}
                    {"\n"}
                    user = response.json()
                  </pre>
                )}
                {activeTab.register === "js" && (
                  <pre className="font-mono text-[13px] leading-relaxed text-[#E2E8F0]">
                    <span className="text-[#F472B6]">const</span> response ={" "}
                    <span className="text-[#F472B6]">await</span> fetch(
                    <span className="text-[#86EFAC]">'https://api.eversaid.com/api/v1/auth/register'</span>, {"{"}
                    {"\n"}
                    method: <span className="text-[#86EFAC]">'POST'</span>,{"\n"}
                    headers: {"{"} <span className="text-[#86EFAC]">'Content-Type'</span>:{" "}
                    <span className="text-[#86EFAC]">'application/json'</span> {"}"},{"\n"}
                    body: JSON.stringify({"{"}
                    {"\n"}
                    email: <span className="text-[#86EFAC]">"user@example.com"</span>,{"\n"}
                    password: <span className="text-[#86EFAC]">"your-secure-password"</span>
                    {"\n"}
                    {"}"}){"\n"}
                    {"}"});{"\n"}
                    <span className="text-[#F472B6]">const</span> user = <span className="text-[#F472B6]">await</span>{" "}
                    response.json();
                  </pre>
                )}
              </div>
            </div>

            {/* Step 2: Login, Step 3: Using Token, Step 4: Refresh - similar structure... */}
            <h3 className="text-[20px] font-bold text-[#0F172A] mt-8 mb-4">Step 2: Login</h3>
            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden mb-5">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1.5 bg-[#DBEAFE] text-[#1E40AF] rounded-md text-[11px] font-bold font-mono">
                  POST
                </span>
                <code className="font-mono text-sm font-medium text-[#0F172A]">/auth/login</code>
                <span className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-[#10B981]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  No Auth
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-[#64748B] mb-4">Authenticate and receive access and refresh tokens.</p>
                <div className="text-sm font-bold text-[#0F172A] mb-3">Response (200 OK)</div>
              </div>
            </div>

            <div className="bg-[#0F172A] rounded-xl overflow-hidden mb-6">
              <div className="flex justify-between items-center px-4 py-3 bg-white/5 border-b border-white/10">
                <span className="text-[12px] font-semibold text-[#94A3B8]">Response</span>
              </div>
              <div className="p-5 overflow-x-auto">
                <pre className="font-mono text-[13px] leading-relaxed text-[#E2E8F0]">
                  {"{"}
                  {"\n"}
                  <span className="text-[#7DD3FC]">"access_token"</span>:{" "}
                  <span className="text-[#86EFAC]">"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."</span>,{"\n"}
                  <span className="text-[#7DD3FC]">"refresh_token"</span>:{" "}
                  <span className="text-[#86EFAC]">"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."</span>,{"\n"}
                  <span className="text-[#7DD3FC]">"token_type"</span>: <span className="text-[#86EFAC]">"bearer"</span>
                  ,{"\n"}
                  <span className="text-[#7DD3FC]">"user"</span>: {"{"}
                  {"\n"}
                  <span className="text-[#7DD3FC]">"id"</span>:{" "}
                  <span className="text-[#86EFAC]">"550e8400-e29b-41d4-a716-446655440000"</span>,{"\n"}
                  <span className="text-[#7DD3FC]">"email"</span>:{" "}
                  <span className="text-[#86EFAC]">"user@example.com"</span>,{"\n"}
                  <span className="text-[#7DD3FC]">"is_active"</span>: <span className="text-[#F472B6]">true</span>,
                  {"\n"}
                  <span className="text-[#7DD3FC]">"role"</span>: <span className="text-[#86EFAC]">"user"</span>
                  {"\n"}
                  {"}"}
                  {"\n"}
                  {"}"}
                </pre>
              </div>
            </div>

            <h3 className="text-[20px] font-bold text-[#0F172A] mt-8 mb-4">Step 3: Using the Token</h3>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-4">
              Include the access token in the{" "}
              <code className="px-1.5 py-0.5 bg-[#F1F5F9] text-[#0F172A] font-mono text-sm rounded">Authorization</code>{" "}
              header for all authenticated requests:
            </p>

            <div className="bg-[#0F172A] rounded-xl overflow-hidden mb-6">
              <div className="flex justify-between items-center px-4 py-3 bg-white/5 border-b border-white/10">
                <span className="text-[12px] font-semibold text-[#94A3B8]">Authorization Header</span>
              </div>
              <div className="p-5 overflow-x-auto">
                <pre className="font-mono text-[13px] leading-relaxed text-[#E2E8F0]">
                  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                </pre>
              </div>
            </div>

            <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[13px] font-bold text-[#B45309] mb-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Token Security
              </div>
              <p className="text-[14px] text-[#92400E] mb-0">
                Store tokens securely. Never expose them in client-side code or version control. Access tokens expire
                after 30 minutes; refresh tokens expire after 7 days.
              </p>
            </div>
          </section>

          {/* Options Section */}
          <section id="options" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Public Endpoints</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4">Options</h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              Get available transcription and LLM options including providers, models, and parameter constraints. Use
              this to build dynamic configuration UIs.
            </p>

            <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-[13px] font-bold text-[#16A34A] mb-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                No Authentication Required
              </div>
              <p className="text-[14px] text-[#475569] mb-0">
                This endpoint is publicly accessible. Try it now to see available models and providers.
              </p>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden mb-5">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1.5 bg-[#DCFCE7] text-[#166534] rounded-md text-[11px] font-bold font-mono">
                  GET
                </span>
                <code className="font-mono text-sm font-medium text-[#0F172A]">/options</code>
                <span className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-[#10B981]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Public
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-[#64748B] mb-4">
                  Returns unified options for both transcription and LLM services, including available providers,
                  models, and parameters with their constraints.
                </p>

                <div className="bg-[#0F172A] rounded-xl p-4 overflow-x-auto">
                  <pre className="text-[13px] font-mono text-white">
                    {`{
  "transcription": {
    "providers": ["elevenlabs"],
    "models": {
      "elevenlabs": ["scribe_v1"]
    },
    "default_provider": "elevenlabs",
    "default_model": "scribe_v1"
  },
  "llm": {
    "providers": ["openai", "anthropic"],
    "models": {
      "openai": ["gpt-4o", "gpt-4o-mini"],
      "anthropic": ["claude-3.5-sonnet", "claude-3-haiku"]
    },
    "default_provider": "openai",
    "default_model": "gpt-4o-mini"
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* Languages Section */}
          <section id="languages" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Public Endpoints</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4">Languages</h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              List supported transcription languages with accuracy tiers. ElevenLabs Scribe V1 supports 99+ languages
              with Word Error Rate (WER) data.
            </p>

            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden mb-5">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1.5 bg-[#DCFCE7] text-[#166534] rounded-md text-[11px] font-bold font-mono">
                  GET
                </span>
                <code className="font-mono text-sm font-medium text-[#0F172A]">/languages</code>
                <span className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-[#10B981]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Public
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-[#64748B] mb-4">
                  Returns list of supported languages with BCP-47 codes and accuracy information.
                </p>

                <div className="bg-[#0F172A] rounded-xl p-4 overflow-x-auto">
                  <pre className="text-[13px] font-mono text-white">
                    {`[
  {
    "code": "en",
    "name": "English",
    "tier": "high",
    "wer": "3.2%"
  },
  {
    "code": "es",
    "name": "Spanish",
    "tier": "high",
    "wer": "4.1%"
  },
  {
    "code": "fr",
    "name": "French",
    "tier": "high",
    "wer": "4.8%"
  }
]`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* Analysis Profiles Section */}
          <section id="analysis-profiles" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Public Endpoints</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4">Analysis Profiles</h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              Get available analysis profiles (summary, action items, reflection, etc.). Each profile extracts different
              insights from cleaned transcripts.
            </p>

            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden mb-5">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1.5 bg-[#DCFCE7] text-[#166534] rounded-md text-[11px] font-bold font-mono">
                  GET
                </span>
                <code className="font-mono text-sm font-medium text-[#0F172A]">/analysis-profiles</code>
                <span className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-[#10B981]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Public
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-[#64748B] mb-4">
                  Returns available analysis profiles with their IDs, names, and what they extract.
                </p>

                <div className="bg-[#0F172A] rounded-xl p-4 overflow-x-auto">
                  <pre className="text-[13px] font-mono text-white">
                    {`[
  {
    "id": "generic-summary",
    "name": "Summary",
    "description": "General summary of the transcript"
  },
  {
    "id": "action-items",
    "name": "Action Items & Decisions",
    "description": "Extract action items, decisions, and follow-ups"
  },
  {
    "id": "reflection",
    "name": "Reflection & Insights",
    "description": "Personal insights and reflections"
  }
]`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* Upload Section */}
          <section id="upload" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Core API</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4">Upload</h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              Upload audio files for transcription. We offer three endpoints depending on how much processing you want
              in a single request.
            </p>

            <h3 className="text-[18px] font-bold text-[#0F172A] mb-3">Recommended: Complete Workflow</h3>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              Upload, transcribe, and cleanup in one request. This is the recommended approach for most use cases.
            </p>

            {/* Complete Workflow Endpoint */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-6">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#3B82F6] text-white rounded uppercase">
                  POST
                </span>
                <span className="font-mono text-[14px] text-[#0F172A]">/upload-transcribe-cleanup</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569] mb-4">
                  Upload audio, transcribe with speaker diarization, and clean with LLM in a single request. Optionally
                  trigger analysis.
                </p>

                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="text-left py-2 pr-4 font-semibold text-[#0F172A]">Parameter</th>
                      <th className="text-left py-2 pr-4 font-semibold text-[#0F172A]">Type</th>
                      <th className="text-left py-2 font-semibold text-[#0F172A]">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#E2E8F0]">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">file</span>
                        <span className="ml-2 text-[11px] text-[#DC2626]">Required</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">binary</span>
                      </td>
                      <td className="py-3 text-[#475569]">Audio file (MP3, M4A, WAV, FLAC)</td>
                    </tr>
                    <tr className="border-b border-[#E2E8F0]">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">entry_type</span>
                        <span className="ml-2 text-[11px] text-[#64748B]">Optional</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">string</span>
                      </td>
                      <td className="py-3 text-[#475569]">
                        Type of entry: dream, journal, meeting, note. Default: dream
                      </td>
                    </tr>
                    <tr className="border-b border-[#E2E8F0]">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">language</span>
                        <span className="ml-2 text-[11px] text-[#64748B]">Optional</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">string</span>
                      </td>
                      <td className="py-3 text-[#475569]">Language code (en, sl, de) or "auto" for detection</td>
                    </tr>
                    <tr className="border-b border-[#E2E8F0]">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">enable_diarization</span>
                        <span className="ml-2 text-[11px] text-[#64748B]">Optional</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">boolean</span>
                      </td>
                      <td className="py-3 text-[#475569]">Enable speaker identification. Default: false</td>
                    </tr>
                    <tr className="border-b border-[#E2E8F0]">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">speaker_count</span>
                        <span className="ml-2 text-[11px] text-[#64748B]">Optional</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">integer</span>
                      </td>
                      <td className="py-3 text-[#475569]">
                        Expected speakers (1-10). Only used when diarization enabled.
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">analysis_profile</span>
                        <span className="ml-2 text-[11px] text-[#64748B]">Optional</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">string</span>
                      </td>
                      <td className="py-3 text-[#475569]">
                        Analysis profile ID. If provided, runs analysis after cleanup.
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-5">
                  <div className="text-[13px] font-semibold text-[#0F172A] mb-3">Response Codes</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 bg-[#10B981] text-white text-[12px] font-mono rounded">202</span>
                      <span className="text-[13px] text-[#475569]">Accepted - Processing started</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 bg-[#EF4444] text-white text-[12px] font-mono rounded">400</span>
                      <span className="text-[13px] text-[#475569]">Invalid file type</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 bg-[#EF4444] text-white text-[12px] font-mono rounded">413</span>
                      <span className="text-[#475569] text-[13px]">File too large</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Code Examples */}
            <div className="mb-6">
              <div className="flex gap-2 border-b border-[#E2E8F0] mb-0">
                {["cURL", "Python", "JavaScript"].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveUploadTab(lang)}
                    className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
                      activeUploadTab === lang
                        ? "border-[#38BDF8] text-[#38BDF8]"
                        : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <div className="bg-[#0F172A] rounded-b-lg p-5 overflow-x-auto">
                {activeUploadTab === "cURL" && (
                  <pre className="text-[13px] leading-relaxed">
                    <code className="text-[#E2E8F0]">
                      <span className="text-[#38BDF8]">curl</span> -X POST
                      https://api.eversaid.com/api/v1/upload-transcribe-cleanup \{"\n"}
                      {"  "}-H <span className="text-[#4ADE80]">"Authorization: Bearer YOUR_ACCESS_TOKEN"</span> \{"\n"}
                      {"  "}-F <span className="text-[#4ADE80]">"file=@meeting-recording.mp3"</span> \{"\n"}
                      {"  "}-F <span className="text-[#4ADE80]">"entry_type=meeting"</span> \{"\n"}
                      {"  "}-F <span className="text-[#4ADE80]">"language=en"</span> \{"\n"}
                      {"  "}-F <span className="text-[#4ADE80]">"enable_diarization=true"</span> \{"\n"}
                      {"  "}-F <span className="text-[#4ADE80]">"speaker_count=2"</span> \{"\n"}
                      {"  "}-F <span className="text-[#4ADE80]">"analysis_profile=action-items"</span>
                    </code>
                  </pre>
                )}
                {activeUploadTab === "Python" && (
                  <pre className="text-[13px] leading-relaxed">
                    <code className="text-[#E2E8F0]">
                      <span className="text-[#C084FC]">import</span> requests{"\n\n"}
                      <span className="text-[#C084FC]">with</span> open(
                      <span className="text-[#4ADE80]">"meeting-recording.mp3"</span>,{" "}
                      <span className="text-[#4ADE80]">"rb"</span>) <span className="text-[#C084FC]">as</span> f:{"\n"}
                      {"    "}response = requests.post({"\n"}
                      {"        "}
                      <span className="text-[#4ADE80]">
                        "https://api.eversaid.com/api/v1/upload-transcribe-cleanup"
                      </span>
                      ,{"\n"}
                      {"        "}headers={"{"}
                      <span className="text-[#4ADE80]">"Authorization"</span>:{" "}
                      <span className="text-[#4ADE80]">f"Bearer {"{"}"</span>access_token
                      <span className="text-[#4ADE80]">{"}"}"</span>
                      {"}"},{"\n"}
                      {"        "}files={"{"}
                      <span className="text-[#4ADE80]">"file"</span>: f{"}"},{"\n"}
                      {"        "}data={"{"}
                      {"\n"}
                      {"            "}
                      <span className="text-[#4ADE80]">"entry_type"</span>:{" "}
                      <span className="text-[#4ADE80]">"meeting"</span>,{"\n"}
                      {"            "}
                      <span className="text-[#4ADE80]">"language"</span>: <span className="text-[#4ADE80]">"en"</span>,
                      {"\n"}
                      {"            "}
                      <span className="text-[#4ADE80]">"enable_diarization"</span>:{" "}
                      <span className="text-[#4ADE80]">"true"</span>,{"\n"}
                      {"            "}
                      <span className="text-[#4ADE80]">"speaker_count"</span>:{" "}
                      <span className="text-[#4ADE80]">"2"</span>,{"\n"}
                      {"            "}
                      <span className="text-[#4ADE80]">"analysis_profile"</span>:{" "}
                      <span className="text-[#4ADE80]">"action-items"</span>
                      {"\n"}
                      {"        "}
                      {"}"}
                      {"\n"}
                      {"    "}){"\n"}
                      result = response.json()
                    </code>
                  </pre>
                )}
                {activeUploadTab === "JavaScript" && (
                  <pre className="text-[13px] leading-relaxed">
                    <code className="text-[#E2E8F0]">
                      <span className="text-[#C084FC]">const</span> formData ={" "}
                      <span className="text-[#C084FC]">new</span> FormData();{"\n"}
                      formData.append(<span className="text-[#4ADE80]">'file'</span>, audioFile);{"\n"}
                      formData.append(<span className="text-[#4ADE80]">'entry_type'</span>,{" "}
                      <span className="text-[#4ADE80]">'meeting'</span>);{"\n"}
                      formData.append(<span className="text-[#4ADE80]">'language'</span>,{" "}
                      <span className="text-[#4ADE80]">'en'</span>);{"\n"}
                      formData.append(<span className="text-[#4ADE80]">'enable_diarization'</span>,{" "}
                      <span className="text-[#4ADE80]">'true'</span>);{"\n"}
                      formData.append(<span className="text-[#4ADE80]">'speaker_count'</span>,{" "}
                      <span className="text-[#4ADE80]">'2'</span>);{"\n"}
                      formData.append(<span className="text-[#4ADE80]">'analysis_profile'</span>,{" "}
                      <span className="text-[#4ADE80]">'action-items'</span>);{"\n\n"}
                      <span className="text-[#C084FC]">const</span> response ={" "}
                      <span className="text-[#C084FC]">await</span> <span className="text-[#38BDF8]">fetch</span>(
                      <span className="text-[#4ADE80]">
                        'https://api.eversaid.com/api/v1/upload-transcribe-cleanup'
                      </span>
                      , {"{"}
                      {"\n"}
                      {"  "}method: <span className="text-[#4ADE80]">'POST'</span>,{"\n"}
                      {"  "}headers: {"{"} <span className="text-[#4ADE80]">'Authorization'</span>:{" "}
                      <span className="text-[#4ADE80]">
                        `Bearer ${"{"}accessToken{"}"}`
                      </span>{" "}
                      {"}"},{"\n"}
                      {"  "}body: formData{"\n"}
                      {"}"});{"\n"}
                      <span className="text-[#C084FC]">const</span> result ={" "}
                      <span className="text-[#C084FC]">await</span> response.json();
                    </code>
                  </pre>
                )}
              </div>
            </div>

            {/* Response Example */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-6">
              <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="text-[13px] font-medium text-[#475569]">Response (202 Accepted)</span>
              </div>
              <div className="bg-[#0F172A] p-5">
                <pre className="text-[13px] leading-relaxed">
                  <code className="text-[#E2E8F0]">
                    {"{"}
                    {"\n  "}
                    <span className="text-[#38BDF8]">"entry_id"</span>:{" "}
                    <span className="text-[#4ADE80]">"550e8400-e29b-41d4-a716-446655440000"</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"transcription_id"</span>:{" "}
                    <span className="text-[#4ADE80]">"550e8400-e29b-41d4-a716-446655440001"</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"cleanup_id"</span>:{" "}
                    <span className="text-[#4ADE80]">"550e8400-e29b-41d4-a716-446655440002"</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"analysis_id"</span>:{" "}
                    <span className="text-[#4ADE80]">"550e8400-e29b-41d4-a716-446655440003"</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"transcription_status"</span>:{" "}
                    <span className="text-[#4ADE80]">"pending"</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"cleanup_status"</span>:{" "}
                    <span className="text-[#4ADE80]">"pending"</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"analysis_status"</span>:{" "}
                    <span className="text-[#4ADE80]">"pending"</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"message"</span>:{" "}
                    <span className="text-[#4ADE80]">"File uploaded, transcription and cleanup started"</span>
                    {"\n"}
                    {"}"}
                  </code>
                </pre>
              </div>
            </div>

            <h3 className="text-[18px] font-bold text-[#0F172A] mb-3">Alternative Endpoints</h3>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              For more control, use these separate endpoints:
            </p>

            {/* Upload Only Endpoint */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-4">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#3B82F6] text-white rounded uppercase">
                  POST
                </span>
                <span className="font-mono text-[14px] text-[#0F172A]">/upload</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569]">
                  Upload audio file only. Use this when you want to manually trigger transcription later.
                </p>
              </div>
            </div>

            {/* Upload and Transcribe Endpoint */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#3B82F6] text-white rounded uppercase">
                  POST
                </span>
                <span className="font-mono text-[14px] text-[#0F172A]">/upload-and-transcribe</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569]">
                  Upload and start transcription. Use this when you want to manually trigger cleanup later.
                </p>
              </div>
            </div>
          </section>

          {/* Entries Section */}
          <section id="entries" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Core API</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4">Entries</h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              Manage voice entries (uploaded audio files). Each entry can have multiple transcriptions and cleaned
              versions.
            </p>

            {/* List Entries */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-4">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#10B981] text-white rounded uppercase">GET</span>
                <span className="font-mono text-[14px] text-[#0F172A]">/entries</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569] mb-4">
                  List all voice entries for the authenticated user, ordered by newest first.
                </p>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="text-left py-2 pr-4 font-semibold text-[#0F172A]">Parameter</th>
                      <th className="text-left py-2 pr-4 font-semibold text-[#0F172A]">Type</th>
                      <th className="text-left py-2 font-semibold text-[#0F172A]">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#E2E8F0]">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">limit</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">integer</span>
                      </td>
                      <td className="py-3 text-[#475569]">Results per page (1-100). Default: 20</td>
                    </tr>
                    <tr className="border-b border-[#E2E8F0]">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">offset</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">integer</span>
                      </td>
                      <td className="py-3 text-[#475569]">Pagination offset. Default: 0</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">entry_type</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">string</span>
                      </td>
                      <td className="py-3 text-[#475569]">Filter by type (dream, journal, meeting, note)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Get Entry */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-4">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#10B981] text-white rounded uppercase">GET</span>
                <span className="font-mono text-[14px] text-[#0F172A]">/entries/{"{entry_id}"}</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569]">
                  Get detailed metadata for a specific voice entry including primary transcription.
                </p>
              </div>
            </div>

            {/* Get Audio */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-4">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#10B981] text-white rounded uppercase">GET</span>
                <span className="font-mono text-[14px] text-[#0F172A]">/entries/{"{entry_id}"}/audio</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569]">
                  Download the audio file for a voice entry. Returns preprocessed WAV format.
                </p>
              </div>
            </div>

            {/* Delete Entry */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#EF4444] text-white rounded uppercase">
                  DELETE
                </span>
                <span className="font-mono text-[14px] text-[#0F172A]">/entries/{"{entry_id}"}</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569]">
                  Permanently delete a voice entry and all associated data (transcriptions, cleaned entries, audio
                  file).
                </p>
              </div>
            </div>
          </section>

          {/* Transcription Section */}
          <section id="transcription" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Core API</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4">Transcription</h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              Manage transcriptions with speaker diarization. Poll transcription status until complete, then retrieve
              the text and segments.
            </p>

            {/* Start Transcription */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-4">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#3B82F6] text-white rounded uppercase">
                  POST
                </span>
                <span className="font-mono text-[14px] text-[#0F172A]">/entries/{"{entry_id}"}/transcribe</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569] mb-4">
                  Start background transcription for an uploaded audio file. Supports speaker diarization (1-10
                  speakers).
                </p>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="text-left py-2 pr-4 font-semibold text-[#0F172A]">Parameter</th>
                      <th className="text-left py-2 pr-4 font-semibold text-[#0F172A]">Type</th>
                      <th className="text-left py-2 font-semibold text-[#0F172A]">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#E2E8F0]">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">language</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">string</span>
                      </td>
                      <td className="py-3 text-[#475569]">Language code or "auto". Default: en</td>
                    </tr>
                    <tr className="border-b border-[#E2E8F0]">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">enable_diarization</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">boolean</span>
                      </td>
                      <td className="py-3 text-[#475569]">Identify different speakers. Default: false</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">speaker_count</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">integer</span>
                      </td>
                      <td className="py-3 text-[#475569]">Expected number of speakers (1-10)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Get Transcription Status */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-6">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#10B981] text-white rounded uppercase">GET</span>
                <span className="font-mono text-[14px] text-[#0F172A]">/transcriptions/{"{transcription_id}"}</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569]">
                  Get transcription status and result. Poll this endpoint until status is "completed" or "failed".
                </p>
              </div>
            </div>

            {/* Response Example */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-6">
              <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="text-[13px] font-medium text-[#475569]">Response with Speaker Diarization</span>
              </div>
              <div className="bg-[#0F172A] p-5">
                <pre className="text-[13px] leading-relaxed">
                  <code className="text-[#E2E8F0]">
                    {"{"}
                    {"\n  "}
                    <span className="text-[#38BDF8]">"id"</span>:{" "}
                    <span className="text-[#4ADE80]">"550e8400-e29b-41d4-a716-446655440001"</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"status"</span>:{" "}
                    <span className="text-[#4ADE80]">"completed"</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"transcribed_text"</span>:{" "}
                    <span className="text-[#4ADE80]">"So what we're trying to do here is..."</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"language_code"</span>:{" "}
                    <span className="text-[#4ADE80]">"en"</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"diarization_applied"</span>:{" "}
                    <span className="text-[#C084FC]">true</span>,{"\n  "}
                    <span className="text-[#38BDF8]">"speaker_count"</span>: <span className="text-[#FB923C]">2</span>,
                    {"\n  "}
                    <span className="text-[#38BDF8]">"segments"</span>: [{"\n    "}
                    {"{"}
                    {"\n      "}
                    <span className="text-[#38BDF8]">"id"</span>: <span className="text-[#FB923C]">0</span>,{"\n      "}
                    <span className="text-[#38BDF8]">"start"</span>: <span className="text-[#FB923C]">0.0</span>,
                    {"\n      "}
                    <span className="text-[#38BDF8]">"end"</span>: <span className="text-[#FB923C]">4.5</span>,
                    {"\n      "}
                    <span className="text-[#38BDF8]">"text"</span>:{" "}
                    <span className="text-[#4ADE80]">
                      "So what we're trying to do here is figure out the best approach."
                    </span>
                    ,{"\n      "}
                    <span className="text-[#38BDF8]">"speaker"</span>:{" "}
                    <span className="text-[#4ADE80]">"Speaker 1"</span>
                    {"\n    "}
                    {"}"},{"\n    "}
                    {"{"}
                    {"\n      "}
                    <span className="text-[#38BDF8]">"id"</span>: <span className="text-[#FB923C]">1</span>,{"\n      "}
                    <span className="text-[#38BDF8]">"start"</span>: <span className="text-[#FB923C]">4.8</span>,
                    {"\n      "}
                    <span className="text-[#38BDF8]">"end"</span>: <span className="text-[#FB923C]">8.2</span>,
                    {"\n      "}
                    <span className="text-[#38BDF8]">"text"</span>:{" "}
                    <span className="text-[#4ADE80]">"I think we should start with the research phase first."</span>,
                    {"\n      "}
                    <span className="text-[#38BDF8]">"speaker"</span>:{" "}
                    <span className="text-[#4ADE80]">"Speaker 2"</span>
                    {"\n    "}
                    {"}"}
                    {"\n  "}]{"\n"}
                    {"}"}
                  </code>
                </pre>
              </div>
            </div>

            {/* List Transcriptions */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-4">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#10B981] text-white rounded uppercase">GET</span>
                <span className="font-mono text-[14px] text-[#0F172A]">/entries/{"{entry_id}"}/transcriptions</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569]">
                  List all transcription attempts for an entry. Useful when re-transcribing with different settings.
                </p>
              </div>
            </div>

            {/* Set Primary Transcription */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#F59E0B] text-white rounded uppercase">PUT</span>
                <span className="font-mono text-[14px] text-[#0F172A]">
                  /transcriptions/{"{transcription_id}"}/set-primary
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569]">
                  Mark a transcription as the primary one to display for its entry.
                </p>
              </div>
            </div>
          </section>

          {/* Cleanup Section */}
          <section id="cleanup" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Core API</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4">Cleanup</h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              LLM-powered text cleanup removes filler words, fixes grammar, and formats transcriptions. Supports user
              edits with revert capability.
            </p>

            <h3 className="text-[18px] font-bold text-[#0F172A] mb-3">Start Cleanup</h3>
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-6">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#3B82F6] text-white rounded uppercase">
                  POST
                </span>
                <span className="font-mono text-[14px] text-[#0F172A]">
                  /transcriptions/{"{transcription_id}"}/cleanup
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569] mb-4">
                  Start LLM cleanup on a completed transcription. Returns immediately with cleanup ID.
                </p>
              </div>
            </div>

            <h3 className="text-[18px] font-bold text-[#0F172A] mb-3">Get Cleanup Status</h3>
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-6">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1.5 bg-[#DCFCE7] text-[#166534] rounded-md text-[11px] font-bold font-mono">
                  GET
                </span>
                <code className="font-mono text-sm font-medium text-[#0F172A]">
                  /cleaned-entries/{"{cleaned_entry_id}"}
                </code>
                <span className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-[#64748B] mb-4">
                  Get cleaned entry details including the LLM-processed text and any user edits.
                </p>
              </div>
            </div>

            <h3 className="text-[18px] font-bold text-[#0F172A] mb-3">User Edits</h3>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              Users can edit the cleaned text while preserving the original AI output for revert.
            </p>

            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-6">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#F59E0B] text-white rounded uppercase">PUT</span>
                <span className="font-mono text-[14px] text-[#0F172A]">
                  /cleaned-entries/{"{cleanup_id}"}/user-edit
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-[#64748B] mb-4">
                  Save user-edited text. The original AI-generated text is preserved for revert.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-6">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#EF4444] text-white rounded uppercase">
                  DELETE
                </span>
                <span className="font-mono text-[14px] text-[#0F172A]">
                  /cleaned-entries/{"{cleanup_id}"}/user-edit
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-[#64748B] mb-4">Revert to AI-generated cleanup by clearing user edits.</p>
              </div>
            </div>
          </section>

          {/* Analysis Section */}
          <section id="analysis" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Core API</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4">Analysis</h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              Run AI analysis on cleaned transcripts using different profiles (summary, action items, reflection).
            </p>

            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-6">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1 text-[11px] font-bold bg-[#3B82F6] text-white rounded uppercase">
                  POST
                </span>
                <span className="font-mono text-[14px] text-[#0F172A]">
                  /cleaned-entries/{"{cleaned_entry_id}"}/analyze
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-[#475569] mb-4">
                  Start analysis on a cleaned entry using the specified profile. Processes in background.
                </p>

                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="text-left py-2 pr-4 font-semibold text-[#0F172A]">Parameter</th>
                      <th className="text-left py-2 pr-4 font-semibold text-[#0F172A]">Type</th>
                      <th className="text-left py-2 font-semibold text-[#0F172A]">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#E2E8F0]">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#0F172A]">profile_id</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[#64748B]">string</span>
                      </td>
                      <td className="py-3 text-[#475569]">
                        Profile ID: generic-summary, action-items, reflection. Default: default
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden mb-6">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="px-2.5 py-1.5 bg-[#DCFCE7] text-[#166534] rounded-md text-[11px] font-bold font-mono">
                  GET
                </span>
                <code className="font-mono text-sm font-medium text-[#0F172A]">/analyses/{"{analysis_id}"}</code>
                <span className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-[#DC2626]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Auth Required
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-[#64748B] mb-4">
                  Get analysis results. Poll until status is "completed" or "failed".
                </p>

                <div className="bg-[#0F172A] rounded-xl p-4 overflow-x-auto mt-4">
                  <div className="text-[11px] text-[#64748B] mb-2 font-semibold">RESPONSE (action-items profile)</div>
                  <pre className="text-[13px] font-mono text-white">
                    {`{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "status": "completed",
  "profile_id": "action-items",
  "profile_label": "Action Items & Decisions",
  "result": {
    "summary": "Team meeting about project timeline.",
    "action_items": [
      "Review budget proposal by Friday",
      "Schedule follow-up with design team"
    ],
    "decisions": [
      "Move deadline to Q2",
      "Hire two contractors"
    ]
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* Complete Workflow Example */}
          <section id="workflow" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Examples</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4">Complete Workflow</h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              This example shows the full flow: upload, poll for completion, and retrieve results.
            </p>

            <div className="bg-[#0F172A] rounded-xl overflow-hidden mb-6">
              <div className="flex bg-white/5 border-b border-white/10">
                {["python", "js"].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveTab({ ...activeTab, workflow: lang })}
                    className={`px-5 py-3 text-[13px] font-medium transition-all relative ${
                      activeTab.workflow === lang
                        ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)]"
                        : "text-[#64748B] hover:text-[#94A3B8]"
                    }`}
                  >
                    {lang === "python" ? "Python" : "JavaScript"}
                  </button>
                ))}
              </div>
              <div className="p-5 overflow-x-auto">
                {activeTab.workflow === "python" ? (
                  <pre className="text-[13px] font-mono text-white">
                    {`import requests
import time

BASE_URL = "https://api.eversaid.com/api/v1"

# 1. Login
auth = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "user@example.com",
    "password": "your-password"
}).json()
headers = {"Authorization": f"Bearer {auth['access_token']}"}

# 2. Upload and start processing
with open("meeting.mp3", "rb") as f:
    result = requests.post(
        f"{BASE_URL}/upload-transcribe-cleanup",
        headers=headers,
        files={"file": f},
        data={
            "enable_diarization": "true",
            "speaker_count": "2",
            "analysis_profile": "action-items"
        }
    ).json()

# 3. Poll for transcription completion
while True:
    status = requests.get(
        f"{BASE_URL}/transcriptions/{result['transcription_id']}",
        headers=headers
    ).json()
    if status["status"] in ["completed", "failed"]:
        break
    time.sleep(2)

# 4. Get results
cleaned = requests.get(
    f"{BASE_URL}/cleaned-entries/{result['cleanup_id']}",
    headers=headers
).json()

analysis = requests.get(
    f"{BASE_URL}/analyses/{result['analysis_id']}",
    headers=headers
).json()

print("Cleaned:", cleaned["cleaned_text"])
print("Actions:", analysis["result"]["action_items"])}`}
                  </pre>
                ) : (
                  <pre className="text-[13px] font-mono text-white">
                    {`const BASE_URL = 'https://api.eversaid.com/api/v1';

// 1. Login
const auth = await fetch(\`\${BASE_URL}/auth/login\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'your-password'
  })
}).then(r => r.json());

const headers = {
  'Authorization': \`Bearer \${auth.access_token}\`
};

// 2. Upload and start processing
const formData = new FormData();
formData.append('file', audioFile);
formData.append('enable_diarization', 'true');
formData.append('speaker_count', '2');
formData.append('analysis_profile', 'action-items');

const result = await fetch(\`\${BASE_URL}/upload-transcribe-cleanup\`, {
  method: 'POST',
  headers,
  body: formData
}).then(r => r.json());

// 3. Poll for completion
const poll = async (url) => {
  while (true) {
    const status = await fetch(url, { headers })
      .then(r => r.json());
    if (['completed', 'failed'].includes(status.status))
      return status;
    await new Promise(r => setTimeout(r, 2000));
  }
};

await poll(\`\${BASE_URL}/transcriptions/\${result.transcription_id}\`);

// 4. Get results
const cleaned = await fetch(
  \`\${BASE_URL}/cleaned-entries/\${result.cleanup_id}\`,
  { headers }
).then(r => r.json());

const analysis = await fetch(
  \`\${BASE_URL}/analyses/\${result.analysis_id}\`,
  { headers }
).then(r => r.json());

console.log('Cleaned:', cleaned.cleaned_text);
console.log('Actions:', analysis.result.action_items);}
`}
                  </pre>
                )}
              </div>
            </div>
          </section>

          {/* Polling Pattern */}
          <section id="polling" className="mb-12 pb-12 border-b border-[#E2E8F0]">
            <div className="text-[11px] font-bold text-[#38BDF8] uppercase tracking-[1.5px] mb-3">Examples</div>
            <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.02em] mb-4">Polling Pattern</h2>
            <p className="text-[15px] text-[#475569] leading-[1.7] mb-6">
              Transcription, cleanup, and analysis run asynchronously. Poll the status endpoints until processing
              completes.
            </p>

            <div className="bg-[#EFF6FF] border border-[#93C5FD] rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-[13px] font-bold text-[#1E40AF] mb-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                Recommended Polling Interval
              </div>
              <p className="text-[14px] text-[#475569] mb-0">
                Poll every 2-3 seconds. Most transcriptions complete within 30 seconds. Cleanup and analysis complete
                within 10 seconds each.
              </p>
            </div>

            <h3 className="text-[18px] font-bold text-[#0F172A] mb-3">Status Values</h3>
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="text-left py-3 px-4 font-semibold text-[#0F172A]">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#0F172A]">Meaning</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#0F172A]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-3 px-4">
                      <span className="font-mono text-[#0F172A]">pending</span>
                    </td>
                    <td className="py-3 px-4 text-[#475569]">Queued, not started yet</td>
                    <td className="py-3 px-4 text-[#475569]">Keep polling</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-3 px-4">
                      <span className="font-mono text-[#0F172A]">processing</span>
                    </td>
                    <td className="py-3 px-4 text-[#475569]">Currently being processed</td>
                    <td className="py-3 px-4 text-[#475569]">Keep polling</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-3 px-4">
                      <span className="font-mono text-[#10B981]">completed</span>
                    </td>
                    <td className="py-3 px-4 text-[#475569]">Successfully finished</td>
                    <td className="py-3 px-4 text-[#10B981] font-semibold">Fetch results</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[#DC2626]">failed</span>
                    </td>
                    <td className="py-3 px-4 text-[#475569]">Error occurred</td>
                    <td className="py-3 px-4 text-[#DC2626] font-semibold">Check error_message</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer CTA */}
          <div className="bg-[linear-gradient(135deg,#0F172A_0%,#1E3A5F_100%)] rounded-[20px] p-12 text-center mt-12">
            <h3 className="text-[28px] font-extrabold text-white mb-3">Ready to integrate?</h3>
            <p className="text-base text-white/70 mb-6">Join the waitlist to get API access and start building.</p>
            <button
              onClick={() => setWaitlistState("form")}
              className="inline-block px-8 py-4 bg-[linear-gradient(135deg,#38BDF8_0%,#A855F7_100%)] hover:shadow-[0_8px_24px_rgba(56,189,248,0.4)] hover:-translate-y-0.5 text-white text-base font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(56,189,248,0.3)]"
            >
              Join Waitlist
            </button>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-[#0F172A] px-8 md:px-12 py-6 flex flex-col md:flex-row justify-between items-center gap-4 mt-12">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <span className="text-[13px] text-white/60">© 2025 eversaid</span>
          <span className="text-[12px] text-white/40">🇸🇮 Built in Slovenia · Independent & bootstrapped</span>
        </div>
        <div className="flex gap-6">
          <Link href="#" className="text-[13px] text-white/60 hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link href="#" className="text-[13px] text-white/60 hover:text-white transition-colors">
            Terms
          </Link>
          <Link href="#" className="text-[13px] text-white/60 hover:text-white transition-colors">
            Contact
          </Link>
        </div>
      </footer>
    </div>
  )
}
