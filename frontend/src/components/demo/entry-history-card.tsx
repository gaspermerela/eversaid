"use client"

import { useState } from "react"
import { Upload, Check, Trash2, Loader2 } from "lucide-react"
import { useTranslations } from 'next-intl'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { HistoryEntry } from "./types"

export interface EntryHistoryCardProps {
  entries: HistoryEntry[]
  activeId?: string | null
  isEmpty?: boolean
  deletingId?: string | null
  onSelect?: (id: string) => void
  onDelete?: (id: string) => void
}

export function EntryHistoryCard({
  entries,
  activeId = null,
  isEmpty = entries.length === 0,
  deletingId = null,
  onSelect,
  onDelete,
}: EntryHistoryCardProps) {
  const t = useTranslations('demo.history')
  const tDelete = useTranslations('demo.delete')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeleteConfirmId(id)
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      onDelete?.(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  return (
    <>
      <div className="bg-background rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex justify-between items-center">
          <span className="text-sm font-bold text-foreground">{t('title')}</span>
        </div>

        {isEmpty ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 stroke-muted-foreground" />
            </div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-1.5">{t('empty')}</h4>
            <p className="text-[13px] text-muted-foreground">{t('emptySubtitle')}</p>
          </div>
        ) : (
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {entries.map((entry) => {
              const isDeleting = deletingId === entry.id
              return (
                <div
                  key={entry.id}
                  onClick={() => !isDeleting && onSelect?.(entry.id)}
                  className={`group flex items-center gap-3 p-3 rounded-[10px] cursor-pointer transition-all ${
                    isDeleting ? "opacity-50 pointer-events-none" : ""
                  } ${
                    activeId === entry.id
                      ? "bg-[linear-gradient(135deg,rgba(var(--color-primary),0.1)_0%,rgba(168,85,247,0.1)_100%)]"
                      : "hover:bg-secondary"
                  }`}
                >
                  <div className="w-9 h-9 bg-[linear-gradient(135deg,var(--color-primary)_0%,#A855F7_100%)] rounded-lg flex items-center justify-center">
                    <Upload className="w-[18px] h-[18px] stroke-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-foreground truncate">{entry.filename}</span>
                      {entry.isDemo && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                          {t('sampleBadge')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex gap-2">
                      <span>{entry.duration}</span>
                      <span>·</span>
                      <span className="capitalize">{entry.status}</span>
                    </div>
                  </div>
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : entry.status === "complete" ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-emerald-600" />
                      </div>
                      {/* Hide delete button for demo entries - they can't be deleted */}
                      {onDelete && !entry.isDemo && (
                        <button
                          onClick={(e) => handleDeleteClick(e, entry.id)}
                          className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
                          aria-label={tDelete('button')}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  ) : onDelete && !entry.isDemo ? (
                    <button
                      onClick={(e) => handleDeleteClick(e, entry.id)}
                      className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
                      aria-label={tDelete('button')}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tDelete('confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{tDelete('confirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tDelete('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {tDelete('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
