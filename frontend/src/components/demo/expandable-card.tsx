"use client"

import { useRef, useSyncExternalStore, type ReactNode } from "react"
import { motion, useReducedMotion } from "@/components/motion"
import { createPortal } from "react-dom"

// useSyncExternalStore pattern for SSR-safe client detection
// This is the React 18+ recommended approach - no useState/useEffect needed
const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

function useIsClient() {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot)
}

interface ExpandableCardProps {
  children: ReactNode
  isExpanded: boolean
  /** Top offset when expanded (e.g., for navbar) */
  topOffset?: number
  /** Class name for the card container */
  className?: string
  /** Class name additions when collapsed */
  collapsedClassName?: string
  /** Class name additions when expanded */
  expandedClassName?: string
}

/**
 * A card component that smoothly animates between inline and fullscreen states.
 *
 * Uses Motion's layoutId for a proper FLIP animation that captures the element's
 * exact position and size before expanding, then animates to fullscreen.
 *
 * The animation works by:
 * 1. Always rendering one motion.div with a stable layoutId
 * 2. When expanded: Portal to document.body with fixed positioning
 * 3. When collapsed: Render inline normally
 * 4. Motion's layout animation handles the smooth transition
 */
export function ExpandableCard({
  children,
  isExpanded,
  topOffset = 64,
  className = "",
  collapsedClassName = "rounded-xl mb-12",
  expandedClassName = "rounded-none",
}: ExpandableCardProps) {
  const shouldReduceMotion = useReducedMotion()
  // Use useSyncExternalStore for SSR-safe client detection
  // This is the React 18+ pattern that avoids setState in effects
  const isMounted = useIsClient()
  const containerRef = useRef<HTMLDivElement>(null)

  // Shared spring transition config
  const springTransition = shouldReduceMotion
    ? { duration: 0 }
    : {
        type: "spring" as const,
        damping: 28,
        stiffness: 350,
        mass: 0.8,
      }

  const sharedLayoutId = "expandable-transcript-card"

  // The animated card content
  const cardContent = (
    <motion.div
      layoutId={sharedLayoutId}
      layout
      transition={springTransition}
      className={`bg-card shadow-lg border border-border overflow-hidden ${className} ${
        isExpanded ? `flex flex-col ${expandedClassName}` : collapsedClassName
      }`}
      style={
        isExpanded
          ? {
              position: "fixed" as const,
              top: topOffset,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              borderLeft: "none",
              borderRight: "none",
            }
          : undefined
      }
    >
      {children}
    </motion.div>
  )

  // During SSR or before hydration, render a placeholder
  if (!isMounted) {
    return (
      <div
        className={`bg-card shadow-lg border border-border overflow-hidden ${className} ${collapsedClassName}`}
      >
        {children}
      </div>
    )
  }

  // When expanded, portal to body to avoid containing block issues
  // When collapsed, render inline
  if (isExpanded) {
    // Keep a placeholder in the DOM flow to prevent layout shift of surrounding elements
    return (
      <>
        <div
          ref={containerRef}
          className={`${collapsedClassName} invisible`}
          style={{ height: 0, marginBottom: 0, overflow: "hidden" }}
          aria-hidden="true"
        />
        {createPortal(cardContent, document.body)}
      </>
    )
  }

  return cardContent
}
