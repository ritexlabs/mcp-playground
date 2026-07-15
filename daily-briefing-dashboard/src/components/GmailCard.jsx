import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import BentoCard from './BentoCard.jsx'

const ACCENT = '#4f8ef7'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEmailDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86_400_000)
  if (diffDays === 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function parseSenderName(from) {
  if (!from) return 'Unknown'
  const m = from.match(/^([^<]+)</)
  if (m) return m[1].trim()
  const em = from.match(/<([^>]+)>/)
  return em ? em[1] : from
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function EnvelopeIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M2 7l10 7 10-7"/>
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
    </svg>
  )
}

function CloseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
    </svg>
  )
}

// ── Email row ─────────────────────────────────────────────────────────────────

function EmailRow({ msg, onClick, compact = false }) {
  return (
    <button
      onClick={() => onClick(msg)}
      className="w-full text-left px-3 py-2.5 rounded-lg transition-colors hover:bg-white/5 flex gap-2.5 items-start"
      style={{ background: msg.isUnread ? `${ACCENT}08` : 'transparent' }}
    >
      <span
        className="flex-shrink-0 rounded-full"
        style={{ width: 6, height: 6, marginTop: 6, background: msg.isUnread ? ACCENT : 'transparent' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-xs truncate"
            style={{ color: msg.isUnread ? '#e2e8f0' : '#94a3b8', fontWeight: msg.isUnread ? 600 : 400 }}
          >
            {parseSenderName(msg.from)}
          </span>
          <span className="flex-shrink-0" style={{ color: '#475569', fontSize: 10 }}>
            {fmtEmailDate(msg.date)}
          </span>
        </div>
        <div
          className="text-xs truncate mt-0.5"
          style={{ color: msg.isUnread ? '#cbd5e1' : '#64748b', fontWeight: msg.isUnread ? 500 : 400 }}
        >
          {msg.subject}
        </div>
        {!compact && (
          <div className="text-xs truncate mt-0.5" style={{ color: '#475569', fontSize: 10 }}>
            {msg.snippet}
          </div>
        )}
      </div>
    </button>
  )
}

// ── Email detail popup ────────────────────────────────────────────────────────

function EmailDetailPopup({ messageId, onClose }) {
  const [detail,  setDetail]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!messageId) return
    setLoading(true)
    setError(null)
    fetch(`/api/gmail/message/${messageId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setDetail(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [messageId])

  const hasHtml = detail?.body_html && !detail?.body_text

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl mx-4 rounded-2xl border border-white/10 flex flex-col"
        style={{ background: 'rgba(9,14,20,0.97)', height: 'min(600px, 85vh)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0"
          style={{ background: `${ACCENT}0d` }}
        >
          <button onClick={onClose} className="btn-icon !p-1" aria-label="Close">
            <ChevronLeft />
          </button>
          <span className="text-sm font-semibold text-slate-200 truncate flex-1">
            {loading ? 'Loading…' : (detail?.subject || '(no subject)')}
          </span>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <span style={{ color: '#64748b', fontSize: 13 }}>Loading email…</span>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <span style={{ color: '#fb7185', fontSize: 13 }}>Could not load email</span>
            <span style={{ color: '#475569', fontSize: 11 }}>{error}</span>
          </div>
        )}

        {detail && !loading && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1 pb-3 border-b border-white/8">
              <div className="flex gap-2 text-xs">
                <span style={{ color: '#64748b', minWidth: 40 }}>From</span>
                <span style={{ color: '#94a3b8' }}>{detail.from}</span>
              </div>
              <div className="flex gap-2 text-xs">
                <span style={{ color: '#64748b', minWidth: 40 }}>Date</span>
                <span style={{ color: '#94a3b8' }}>{detail.date}</span>
              </div>
            </div>

            {hasHtml ? (
              <iframe
                srcDoc={detail.body_html}
                sandbox="allow-same-origin"
                className="flex-1 w-full rounded border-0"
                style={{ minHeight: 300, background: '#fff', borderRadius: 8 }}
                title="Email content"
              />
            ) : (
              <pre
                className="text-xs flex-1 whitespace-pre-wrap break-words"
                style={{ color: '#94a3b8', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.6 }}
              >
                {detail.body_text || '(no content)'}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Inbox popup ───────────────────────────────────────────────────────────────

function InboxPopup({ onClose, onOpenDetail }) {
  const [messages,     setMessages]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [page,         setPage]         = useState(1)
  const [hasNext,      setHasNext]      = useState(false)
  const [totalUnread,  setTotalUnread]  = useState(0)

  const loadPage = useCallback(async (p) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/gmail?page=${p}&pageSize=20`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setMessages(data.messages || [])
      setHasNext(!!data.nextPageToken)
      setTotalUnread(data.totalUnread || 0)
      setPage(p)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPage(1) }, [loadPage])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl mx-4 rounded-2xl border border-white/10 flex flex-col"
        style={{ background: 'rgba(9,14,20,0.97)', height: 'min(600px, 85vh)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0"
          style={{ background: `${ACCENT}0d` }}
        >
          <div className="flex items-center gap-2">
            <EnvelopeIcon size={15} color={ACCENT} />
            <span className="text-sm font-semibold text-slate-200">Inbox</span>
            {totalUnread > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: `${ACCENT}22`, color: ACCENT }}
              >
                {totalUnread} unread
              </span>
            )}
          </div>
          <button onClick={onClose} className="btn-icon !p-1" aria-label="Close inbox">
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-1">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <span style={{ color: '#64748b', fontSize: 13 }}>Loading…</span>
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <span style={{ color: '#fb7185', fontSize: 13 }}>Failed to load inbox</span>
              <button onClick={() => loadPage(page)} className="text-xs" style={{ color: ACCENT }}>Retry</button>
            </div>
          )}
          {!loading && !error && messages.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <span style={{ color: '#64748b', fontSize: 13 }}>Your inbox is empty</span>
            </div>
          )}
          {!loading && !error && messages.map(msg => (
            <EmailRow key={msg.id} msg={msg} onClick={() => onOpenDetail(msg.id)} />
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/8 flex-shrink-0">
          <button
            onClick={() => loadPage(page - 1)}
            disabled={page <= 1 || loading}
            className="flex items-center gap-1 text-xs disabled:opacity-30"
            style={{ color: ACCENT }}
          >
            <ChevronLeft /> Prev
          </button>
          <span className="text-xs" style={{ color: '#475569' }}>Page {page}</span>
          <button
            onClick={() => loadPage(page + 1)}
            disabled={!hasNext || loading}
            className="flex items-center gap-1 text-xs disabled:opacity-30"
            style={{ color: ACCENT }}
          >
            Next <ChevronRight />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── GmailCard ─────────────────────────────────────────────────────────────────

export default function GmailCard({ data, loading, error, onRetry, delay = 0, syncedAt }) {
  const [showInbox,   setShowInbox]   = useState(false)
  const [detailMsgId, setDetailMsgId] = useState(null)

  const messages    = data?.messages    || []
  const totalUnread = data?.totalUnread || 0

  return (
    <>
      <BentoCard accent={ACCENT} delay={delay} syncedAt={syncedAt} className="h-full flex flex-col">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <EnvelopeIcon size={16} color={ACCENT} />
            <span className="text-sm font-semibold text-slate-200">Gmail</span>
            {totalUnread > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: `${ACCENT}22`, color: ACCENT }}
              >
                {totalUnread} unread
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-2 py-1 overflow-hidden">
          {loading && (
            <div className="flex flex-col gap-2 px-2 pt-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <span style={{ color: '#fb7185', fontSize: 13 }}>Failed to load emails</span>
              <button onClick={onRetry} className="text-xs" style={{ color: ACCENT }}>Retry</button>
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <EnvelopeIcon size={28} color="#334155" />
              <span style={{ color: '#64748b', fontSize: 13 }}>Your inbox is empty</span>
            </div>
          )}

          {!loading && !error && messages.slice(0, 3).map(msg => (
            <EmailRow key={msg.id} msg={msg} onClick={() => setDetailMsgId(msg.id)} compact />
          ))}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div className="px-4 pb-3 pt-1">
            <button
              onClick={() => setShowInbox(true)}
              className="text-xs font-medium"
              style={{ color: ACCENT }}
            >
              View all →
            </button>
          </div>
        )}
      </BentoCard>

      {showInbox && (
        <InboxPopup
          onClose={() => setShowInbox(false)}
          onOpenDetail={(id) => setDetailMsgId(id)}
        />
      )}

      {detailMsgId && (
        <EmailDetailPopup
          messageId={detailMsgId}
          onClose={() => setDetailMsgId(null)}
        />
      )}
    </>
  )
}
