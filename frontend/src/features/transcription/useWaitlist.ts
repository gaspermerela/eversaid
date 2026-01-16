import { useState, useCallback } from 'react'
import { joinWaitlist } from './api'
import { ApiError, type WaitlistType } from './types'
import { toast } from 'sonner'

/**
 * Form data passed from WaitlistFlow component
 */
export interface WaitlistFormData {
  useCase: string
  volume: string
  source: string
}

/**
 * Options for the useWaitlist hook
 */
export interface UseWaitlistOptions {
  /** The type of waitlist: api_access or extended_usage */
  waitlistType: WaitlistType
  /** Optional source page for tracking */
  sourcePage?: string
}

/**
 * Return type for the useWaitlist hook
 */
export interface UseWaitlistReturn {
  /** User's email address */
  email: string
  /** Whether form is currently submitting */
  isSubmitting: boolean
  /** Whether form was successfully submitted */
  isSubmitted: boolean
  /** Error message if submission failed */
  error: string | null
  /** Referral code received on success */
  referralCode: string | null
  /** Set email address */
  setEmail: (email: string) => void
  /** Submit the waitlist form with form data from component */
  submit: (formData: WaitlistFormData) => Promise<void>
  /** Reset all form state */
  reset: () => void
}

/**
 * Hook for managing waitlist form state and submission
 *
 * @example
 * ```tsx
 * const {
 *   email,
 *   setEmail,
 *   isSubmitting,
 *   isSubmitted,
 *   referralCode,
 *   submit,
 * } = useWaitlist({ waitlistType: 'extended_usage' })
 *
 * return (
 *   <form onSubmit={submit}>
 *     <input value={email} onChange={e => setEmail(e.target.value)} />
 *     <button disabled={isSubmitting}>Join Waitlist</button>
 *   </form>
 * )
 * ```
 */
export function useWaitlist(options: UseWaitlistOptions): UseWaitlistReturn {
  const { waitlistType, sourcePage } = options

  // Form state (email is controlled by the hook, other fields come from WaitlistFlow)
  const [email, setEmail] = useState('')

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)

  const submit = useCallback(async (formData: WaitlistFormData) => {
    // Validate email (required)
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    // Clear previous error
    setError(null)
    setIsSubmitting(true)

    try {
      await joinWaitlist({
        email: email.trim(),
        use_case: formData.useCase.trim() || undefined,
        waitlist_type: waitlistType,
        source_page: sourcePage,
      })

      // Generate a referral code on success
      // In production this would come from the API response
      const generatedCode = `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      setReferralCode(generatedCode)
      setIsSubmitted(true)
      toast.success("You're on the waitlist!")
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // Duplicate email - treat as success (already registered)
          setReferralCode(null) // No new referral code for existing users
          setIsSubmitted(true)
          toast.success('You\'re already on the waitlist!')
        } else if (err.status === 429) {
          const message = 'Too many requests. Please try again later.'
          setError(message)
          toast.error(message)
        } else if (err.status === 422) {
          // Validation error
          const message = 'Please check your email address and try again.'
          setError(message)
          toast.error(message)
        } else {
          setError(err.message)
          toast.error(err.message)
        }
      } else {
        const message = 'Failed to join waitlist. Please try again.'
        setError(message)
        toast.error(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [email, waitlistType, sourcePage])

  const reset = useCallback(() => {
    setEmail('')
    setIsSubmitting(false)
    setIsSubmitted(false)
    setError(null)
    setReferralCode(null)
  }, [])

  return {
    email,
    isSubmitting,
    isSubmitted,
    error,
    referralCode,
    setEmail,
    submit,
    reset,
  }
}
