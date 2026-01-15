'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/routing'
import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { locales, localeNames, type Locale } from '@/i18n/config'

export function LanguageSwitcher() {
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLocaleChange = useCallback((newLocale: Locale) => {
    // Set cookie to persist locale preference (next-intl reads NEXT_LOCALE)
    // Using globalThis.document to satisfy eslint immutability rule
    globalThis.document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`
    router.replace(pathname, { locale: newLocale })
    setIsOpen(false)
  }, [router, pathname])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all"
        aria-label="Select language"
      >
        <Globe className="w-4 h-4" />
        {locale.toUpperCase()}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50 min-w-[140px]">
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleLocaleChange(loc)}
              className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 transition-colors ${
                loc === locale ? 'bg-gray-50 font-semibold text-blue-600' : 'text-gray-700'
              }`}
            >
              {localeNames[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Alternative light variant for use on light backgrounds
export function LanguageSwitcherLight() {
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLocaleChange = useCallback((newLocale: Locale) => {
    // Set cookie to persist locale preference (next-intl reads NEXT_LOCALE)
    // Using globalThis.document to satisfy eslint immutability rule
    globalThis.document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`
    router.replace(pathname, { locale: newLocale })
    setIsOpen(false)
  }, [router, pathname])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all"
        aria-label="Select language"
      >
        <Globe className="w-4 h-4" />
        {locale.toUpperCase()}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50 min-w-[140px]">
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleLocaleChange(loc)}
              className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 transition-colors ${
                loc === locale ? 'bg-gray-50 font-semibold text-blue-600' : 'text-gray-700'
              }`}
            >
              {localeNames[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
