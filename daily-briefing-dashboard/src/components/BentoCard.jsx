import { useState } from 'react'
import { cn } from '../utils/cn.js'

function fmtSyncTime(date) {
  if (!date) return null
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1)  return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Base card wrapper with per-card accent glow on hover.
 *
 * Props:
 *   accent   — hex colour string, e.g. '#22d3ee'
 *   delay    — animation stagger delay in ms (default 0)
 *   syncedAt — Date of last successful data fetch; shown as bottom-right timestamp
 */
export default function BentoCard({ accent = '#ffffff', delay = 0, syncedAt, className, style, children, ...rest }) {
  const [hovered, setHovered] = useState(false)
  const syncLabel = fmtSyncTime(syncedAt)

  return (
    <div
      {...rest}
      className={cn(
        'glass-card relative overflow-hidden',
        'opacity-0 animate-fade-in-up',
        className,
      )}
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: 'forwards',
        borderColor:  hovered ? `${accent}30` : 'rgba(255,255,255,0.06)',
        boxShadow: hovered
          ? `0 0 0 1px ${accent}25, 0 0 60px -15px ${accent}35, 0 20px 60px -10px rgba(0,0,0,0.5)`
          : '0 1px 0 rgba(255,255,255,0.06) inset, 0 20px 60px -10px rgba(0,0,0,0.5)',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top-edge gradient highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}50, transparent)` }}
      />
      {children}
      {/* Sync timestamp — bottom-right corner */}
      {syncLabel && (
        <div className="pointer-events-none absolute bottom-2 right-3 flex items-center gap-1">
          <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ color: '#334155' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span style={{ fontSize: '9px', color: '#334155', fontFamily: 'Inter,sans-serif', letterSpacing: '0.02em' }}>
            {syncLabel}
          </span>
        </div>
      )}
    </div>
  )
}

/** Reusable card section header row */
export function CardHeader({ icon, title, accent, children }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-xl"
          style={{ background: `${accent}18` }}
        >
          <span style={{ color: accent }}>{icon}</span>
        </div>
        <span className="text-sm font-semibold text-slate-200">{title}</span>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

/** Skeleton shimmer line */
export function SkeletonLine({ className }) {
  return <div className={cn('skeleton h-3 rounded-md', className)} />
}

/** Full-card skeleton state */
export function CardSkeleton({ rows = 4 }) {
  return (
    <div className="flex flex-col gap-3 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine
          key={i}
          className={['w-3/4', 'w-full', 'w-2/3', 'w-5/6', 'w-4/5'][i % 5]}
        />
      ))}
    </div>
  )
}

/** Error + retry state */
export function CardError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
      <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center">
        <svg className="text-rose-400" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-300">Failed to load</p>
        <p className="text-xs text-slate-500 mt-0.5 max-w-[180px]">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
