"use client"

import { useEffect, useCallback, useReducer } from "react"
import { motion, AnimatePresence } from "@/components/motion"
import { TriangleAlert, X } from "lucide-react"

interface PersistentWarningProps {
  message: string
  show: boolean
  autoCollapseMs?: number
  onDismiss?: () => void
}

// State and actions for the warning reducer
interface WarningState {
  isExpanded: boolean
  hasBeenSeen: boolean
  lastShowProp: boolean
}

type WarningAction =
  | { type: "SYNC_SHOW_PROP"; show: boolean }
  | { type: "COLLAPSE" }
  | { type: "TOGGLE" }

function warningReducer(state: WarningState, action: WarningAction): WarningState {
  switch (action.type) {
    case "SYNC_SHOW_PROP":
      // Handle prop changes - expand when show becomes true, reset hasBeenSeen when hidden
      if (action.show && !state.lastShowProp) {
        return { ...state, isExpanded: true, lastShowProp: action.show }
      }
      if (!action.show && state.lastShowProp && state.hasBeenSeen) {
        return { ...state, hasBeenSeen: false, lastShowProp: action.show }
      }
      if (action.show !== state.lastShowProp) {
        return { ...state, lastShowProp: action.show }
      }
      return state
    case "COLLAPSE":
      return { ...state, isExpanded: false, hasBeenSeen: true }
    case "TOGGLE":
      return { ...state, isExpanded: !state.isExpanded, hasBeenSeen: true }
    default:
      return state
  }
}

/**
 * Persistent warning notification that appears in the top-right corner.
 * Collapses smoothly after a delay but stays visible as an icon.
 * Click to expand and see the full message again.
 */
export function PersistentWarning({
  message,
  show,
  autoCollapseMs = 5000,
  onDismiss,
}: PersistentWarningProps) {
  // Use reducer to manage complex state transitions
  const [state, dispatch] = useReducer(warningReducer, {
    isExpanded: true,
    hasBeenSeen: false,
    lastShowProp: show,
  })

  const { isExpanded, hasBeenSeen } = state

  // Sync show prop changes via effect - legitimate external sync use case
  // The rule allows setState in effects when syncing with external state
  useEffect(() => {
    dispatch({ type: "SYNC_SHOW_PROP", show })
  }, [show])

  // Auto-collapse after delay - subscription to timer
  useEffect(() => {
    if (!show || !isExpanded) return

    const timer = setTimeout(() => {
      dispatch({ type: "COLLAPSE" })
    }, autoCollapseMs)

    return () => clearTimeout(timer)
  }, [show, isExpanded, autoCollapseMs])

  const handleToggle = useCallback(() => {
    dispatch({ type: "TOGGLE" })
  }, [])

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDismiss?.()
    },
    [onDismiss]
  )

  if (!show) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed top-4 right-4 z-[110]"
    >
      <div className="flex items-center bg-red-500 text-white rounded-xl shadow-lg overflow-hidden">
        {/* Icon button - always visible, toggles expand/collapse */}
        <button
          onClick={handleToggle}
          className="flex items-center justify-center p-3 hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-inset flex-shrink-0"
          aria-label={isExpanded ? "Collapse warning" : "Expand warning"}
          aria-expanded={isExpanded}
        >
          <TriangleAlert className="h-5 w-5" />
        </button>

        {/* Expandable message area - uses grid for smooth width animation */}
        <div
          className="grid transition-[grid-template-columns] duration-300 ease-out"
          style={{
            gridTemplateColumns: isExpanded ? "1fr" : "0fr",
          }}
        >
          <div className="overflow-hidden">
            <motion.div
              initial={false}
              animate={{ opacity: isExpanded ? 1 : 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex items-center gap-2 pr-3 whitespace-nowrap"
            >
              <span className="text-sm font-medium">{message}</span>
              {onDismiss && (
                <button
                  onClick={handleDismiss}
                  className="ml-1 p-1 rounded-full hover:bg-red-600/50 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 flex-shrink-0"
                  aria-label="Dismiss warning"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Tooltip hint when collapsed */}
      <AnimatePresence>
        {!isExpanded && hasBeenSeen && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ delay: 0.3 }}
            className="absolute right-full top-1/2 -translate-y-1/2 mr-2 pointer-events-none"
          >
            <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Click to view warning
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
