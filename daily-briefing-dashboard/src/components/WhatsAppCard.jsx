import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import BentoCard, { CardHeader } from './BentoCard.jsx'

const ACCENT = '#25D366'
const POLL_MS = 30_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(epoch) {
  return new Date(epoch * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function fmtDate(epoch) {
  const d   = new Date(epoch * 1000)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function fmtRelative(epoch) {
  const diffMs  = Date.now() - epoch * 1000
  const mins    = Math.floor(diffMs / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return fmtDate(epoch)
}

function windowSecondsLeft(conv) {
  const lastTs = conv.messages[0]?.timestamp || 0
  return Math.max(0, lastTs + 86_400 - Math.floor(Date.now() / 1000))
}

function displayName(conv) {
  return conv.name || conv.phone
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TunnelIcon({ size = 20, color = '#f59e0b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M8 12h8M12 8l4 4-4 4" />
    </svg>
  )
}

function SpinnerIcon({ size = 14 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
      style={{ animation: 'spin 0.9s linear infinite', transformOrigin: '12px 12px' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}

// WhatsApp double-tick delivery icon
function DeliveryIcon({ status, size = 14 }) {
  const color = status === 'read' ? '#53BDEB' : '#94a3b8'
  if (!status || status === 'sent') {
    // single tick
    return (
      <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  // double tick (delivered | read)
  return (
    <svg width={size + 4} height={size} fill="none" viewBox="0 0 28 24" stroke={color} strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 13l4 4L16 7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13l4 4L23 7" />
    </svg>
  )
}

// ─── Background ───────────────────────────────────────────────────────────────

function WhatsAppBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(150deg, #020c08 0%, #041008 50%, #020a05 100%)',
      }} />
      <div style={{
        position: 'absolute', top: '-40px', right: '-40px',
        width: '220px', height: '220px',
        background: `radial-gradient(circle, ${ACCENT}14 0%, ${ACCENT}06 45%, transparent 70%)`,
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute', bottom: '-30px', left: '-20px',
        width: '180px', height: '180px',
        background: `radial-gradient(circle, ${ACCENT}08 0%, transparent 70%)`,
        borderRadius: '50%',
      }} />
    </div>
  )
}

// ─── Conversation row ─────────────────────────────────────────────────────────

function ConversationRow({ conv, onClick }) {
  const hasUnread = conv.unread_count > 0
  const name      = displayName(conv)

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left"
      style={{ background: hasUnread ? `${ACCENT}0a` : 'rgba(255,255,255,0.03)' }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background: `${ACCENT}22`, color: ACCENT }}
      >
        {name.charAt(0).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: hasUnread ? '#e2e8f0' : '#94a3b8' }}
          >
            {name}
          </span>
          <span className="text-[10px] text-slate-500 flex-shrink-0">
            {fmtRelative(conv.last_timestamp)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-slate-500 truncate flex-1">{conv.last_message}</p>
          {hasUnread ? (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: ACCENT, color: '#000' }}
            >
              {conv.unread_count}
            </span>
          ) : (
            <span className="flex-shrink-0 text-slate-600">
              <ChevronRight />
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function IncomingBubble({ msg }) {
  return (
    <div className="flex justify-start mb-2">
      <div className="max-w-[75%]">
        <div
          className="px-3 py-2 rounded-2xl rounded-tl-sm text-sm text-slate-200 leading-relaxed"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          {msg.body}
        </div>
        <p className="text-[10px] text-slate-600 mt-1 ml-1">{fmtTime(msg.timestamp)}</p>
      </div>
    </div>
  )
}

function OutgoingBubble({ text, repliedAt, delivery }) {
  return (
    <div className="flex justify-end mb-2">
      <div className="max-w-[75%]">
        <div
          className="px-3 py-2 rounded-2xl rounded-tr-sm text-sm leading-relaxed"
          style={{ background: `${ACCENT}28`, color: '#d1fae5' }}
        >
          {text}
        </div>
        <div className="flex items-center justify-end gap-1 mt-1 mr-1">
          <p className="text-[10px] text-slate-600">{repliedAt ? fmtTime(repliedAt) : ''}</p>
          <DeliveryIcon status={delivery} size={12} />
        </div>
      </div>
    </div>
  )
}

// ─── Conversation modal ───────────────────────────────────────────────────────

function ConversationModal({ conv, onClose, onReplySent, onMarkRead }) {
  const [replyText, setReplyText]   = useState('')
  const [sending,   setSending]     = useState(false)
  const [sendErr,   setSendErr]     = useState(null)
  const threadRef                   = useRef(null)

  const secsLeft   = windowSecondsLeft(conv)
  const windowOpen = secsLeft > 0
  const hrsLeft    = Math.floor(secsLeft / 3600)
  const minsLeft   = Math.floor((secsLeft % 3600) / 60)

  // Chronological order for display (oldest first)
  const chronological = [...conv.messages].sort((a, b) => a.timestamp - b.timestamp)

  // Group messages by date for separators (computed before effects so grouped.length is stable)
  const grouped = []
  let lastDate  = null
  for (const msg of chronological) {
    const d = fmtDate(msg.timestamp)
    if (d !== lastDate) { grouped.push({ type: 'date', label: d }); lastDate = d }
    if (msg.direction === 'outgoing') {
      // New format: outgoing reply stored as its own record
      grouped.push({ type: 'reply', text: msg.body, repliedAt: msg.timestamp, delivery: msg.wa_delivery })
    } else {
      grouped.push({ type: 'msg', msg })
      // Legacy format: reply embedded on the incoming message record
      if (msg.reply_text) {
        grouped.push({ type: 'reply', text: msg.reply_text, repliedAt: msg.replied_at, delivery: msg.wa_delivery })
      }
    }
  }

  // Mark as read on open
  useEffect(() => {
    const lastMsg = conv.messages[0]
    if (conv.unread_count > 0 && lastMsg) {
      onMarkRead(conv.phone, lastMsg.wa_message_id)
    }
  }, [conv.phone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on open and whenever a new bubble is added (e.g. after sending a reply)
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [grouped.length])

  async function send() {
    const txt = replyText.trim()
    if (!txt || !windowOpen) return
    setSending(true); setSendErr(null)
    try {
      const r = await fetch('/api/whatsapp/reply', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          to:               conv.phone,
          text:             txt,
          replyToMessageId: conv.messages[0]?.wa_message_id,
        }),
      })
      const d = await r.json()
      if (!r.ok || d.error || d.detail) { setSendErr(d.detail || d.error || 'Send failed'); return }
      setReplyText('')
      onReplySent()
    } catch (e) {
      setSendErr(e.message)
    } finally {
      setSending(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg flex flex-col rounded-2xl border border-white/[0.10] overflow-hidden"
        style={{ background: 'rgba(9,14,20,0.97)', height: 'min(600px, 85vh)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08] flex-shrink-0"
          style={{ background: `${ACCENT}0d` }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            {displayName(conv).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{displayName(conv)}</p>
            {conv.name && <p className="text-[11px] text-slate-500">{conv.phone}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.06] text-slate-400"
            aria-label="Close"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-3">
          {grouped.map((item, i) => {
            if (item.type === 'date') return (
              <div key={`d-${i}`} className="flex justify-center my-2">
                <span className="text-[10px] text-slate-600 px-2 py-0.5 rounded-full bg-white/[0.05]">
                  {item.label}
                </span>
              </div>
            )
            if (item.type === 'reply') return (
              <OutgoingBubble
                key={`r-${i}`}
                text={item.text}
                repliedAt={item.repliedAt}
                delivery={item.delivery}
              />
            )
            return <IncomingBubble key={item.msg.wa_message_id} msg={item.msg} />
          })}
        </div>

        {/* 24h window indicator */}
        {!windowOpen && (
          <div
            className="px-4 py-2 text-xs text-center flex-shrink-0"
            style={{ background: 'rgba(251,113,133,0.08)', color: '#fb7185' }}
          >
            <svg className="inline mr-1" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            24h window closed — use a WhatsApp template to reply
          </div>
        )}
        {windowOpen && secsLeft < 7200 && (
          <div
            className="px-4 py-1.5 text-[11px] text-center flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}
          >
            Window closes in {hrsLeft > 0 ? `${hrsLeft}h ` : ''}{minsLeft}m
          </div>
        )}

        {/* Reply input */}
        <div className="px-4 py-3 border-t border-white/[0.08] flex items-end gap-2 flex-shrink-0">
          <textarea
            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:ring-1 transition-all"
            style={{
              background:  'rgba(255,255,255,0.06)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'rgba(255,255,255,0.1)',
              minHeight:   '40px',
              maxHeight:   '120px',
              '--tw-ring-color': ACCENT,
            }}
            placeholder={windowOpen ? 'Type a reply… (Enter to send)' : 'Reply unavailable — 24h window closed'}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={handleKey}
            disabled={!windowOpen || sending}
            rows={1}
          />
          <button
            onClick={send}
            disabled={!replyText.trim() || !windowOpen || sending}
            className="p-2.5 rounded-xl flex-shrink-0 transition-all"
            style={{
              background: replyText.trim() && windowOpen && !sending ? ACCENT : 'rgba(255,255,255,0.08)',
              color:      replyText.trim() && windowOpen && !sending ? '#000' : '#475569',
            }}
            aria-label="Send reply"
          >
            <SendIcon />
          </button>
        </div>

        {sendErr && (
          <p className="px-4 pb-3 text-xs flex-shrink-0" style={{ color: '#fb7185' }}>
            Failed: {sendErr}
          </p>
        )}
      </div>
    </div>,
    document.body
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export default function WhatsAppCard({ delay = 0 }) {
  const [data,           setData]           = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [activeConv,     setActiveConv]     = useState(null)
  const [tunnelStarting, setTunnelStarting] = useState(false)
  const tunnelCheckRef = useRef(null)

  const fetchMessages = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp/messages')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setData(d)
      setError(null)

      // Refresh the active conversation if it's still open
      if (activeConv) {
        const fresh = d.conversations?.find(c => c.phone === activeConv.phone)
        if (fresh) setActiveConv(fresh)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [activeConv?.phone]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMessages()
    const id = setInterval(fetchMessages, POLL_MS)
    return () => {
      clearInterval(id)
      if (tunnelCheckRef.current) clearInterval(tunnelCheckRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function startTunnel() {
    if (tunnelStarting) return
    setTunnelStarting(true)
    try {
      await fetch('/api/tunnel/start', { method: 'POST' })
    } catch {}

    let tries = 0
    tunnelCheckRef.current = setInterval(async () => {
      tries++
      try {
        const r = await fetch('/api/tunnel/status')
        const d = await r.json()
        if (d.running || tries >= 15) {
          clearInterval(tunnelCheckRef.current)
          setTunnelStarting(false)
          fetchMessages()
        }
      } catch {
        if (tries >= 15) {
          clearInterval(tunnelCheckRef.current)
          setTunnelStarting(false)
        }
      }
    }, 2000)
  }

  async function markRead(phone, lastMessageId) {
    await fetch('/api/whatsapp/mark-read', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone, lastMessageId }),
    }).catch(() => {})
    // Optimistically clear unread badge in local state
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        conversations: prev.conversations.map(c =>
          c.phone === phone
            ? { ...c, unread_count: 0, messages: c.messages.map(m => m.dashboard_status === 'unread' ? { ...m, dashboard_status: 'read' } : m) }
            : c
        ),
        totalUnread: Math.max(0, (prev.totalUnread || 0) - (prev.conversations.find(c => c.phone === phone)?.unread_count || 0)),
      }
    })
  }

  const notConfigured = data && !data.configured
  const conversations = data?.conversations || []
  const totalUnread   = data?.totalUnread   || 0
  // Default to true until we have data to avoid a false "tunnel off" flash on load
  const tunnelRunning = data != null ? (data.tunnelRunning ?? true) : true

  return (
    <>
      <BentoCard accent={ACCENT} delay={delay} className="p-5 flex flex-col h-full">
        <WhatsAppBackground />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
          <CardHeader
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill={ACCENT}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.105.546 4.082 1.5 5.8L0 24l6.336-1.476A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.001-1.364l-.36-.214-3.728.868.937-3.42-.234-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
              </svg>
            }
            title="WhatsApp"
            accent={ACCENT}
          >
            {!loading && !error && totalUnread > 0 && (
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: ACCENT, color: '#000' }}
              >
                {totalUnread} unread
              </span>
            )}
          </CardHeader>

          {/* Tunnel not running — full empty state */}
          {!loading && !error && !notConfigured && !tunnelRunning && !tunnelStarting && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 flex-1 py-6 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.12)' }}
              >
                <TunnelIcon size={22} color="#f59e0b" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300">Cloudflare Tunnel not running</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[230px]">
                  Start the tunnel so WhatsApp can deliver messages to this dashboard.
                </p>
              </div>
              <button
                onClick={startTunnel}
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl transition-all"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}
              >
                <TunnelIcon size={13} color="#f59e0b" />
                Start Tunnel
              </button>
            </div>
          )}

          {/* Tunnel starting — full empty state */}
          {!loading && !error && !notConfigured && tunnelStarting && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 flex-1 py-6 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(37,211,102,0.1)' }}
              >
                <SpinnerIcon size={22} />
              </div>
              <p className="text-sm text-slate-400">Starting tunnel…</p>
              <p className="text-xs text-slate-600">This usually takes a few seconds.</p>
            </div>
          )}

          {/* Tunnel stopped banner — shown above existing conversations */}
          {!loading && !error && !notConfigured && !tunnelRunning && conversations.length > 0 && (
            <div
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl mt-1 mb-1 flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.14)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#f59e0b' }}
                />
                <span className="text-[11px] text-amber-400 truncate">
                  {tunnelStarting ? 'Starting tunnel…' : 'Tunnel stopped — new messages won\'t arrive'}
                </span>
              </div>
              {!tunnelStarting && (
                <button
                  onClick={startTunnel}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 transition-all"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                >
                  Start
                </button>
              )}
              {tunnelStarting && (
                <span className="text-[11px] text-amber-500 flex-shrink-0 flex items-center gap-1">
                  <SpinnerIcon size={11} /> Starting…
                </span>
              )}
            </div>
          )}

          {/* Not configured */}
          {notConfigured && (
            <div className="flex flex-col items-center justify-center gap-3 flex-1 py-6 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `${ACCENT}15` }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill={ACCENT} opacity="0.6">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.105.546 4.082 1.5 5.8L0 24l6.336-1.476A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.001-1.364l-.36-.214-3.728.868.937-3.42-.234-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
                </svg>
              </div>
              <p className="text-sm text-slate-400">WhatsApp not configured</p>
              <p className="text-xs text-slate-600">Go to Settings → WhatsApp to set up your access token and webhook.</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col gap-2 mt-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-14 rounded-xl animate-pulse bg-white/[0.04]" />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center gap-2 py-6 text-center flex-1 justify-center">
              <p className="text-sm text-slate-400">Could not load messages</p>
              <button onClick={fetchMessages} className="text-xs" style={{ color: ACCENT }}>
                Retry
              </button>
            </div>
          )}

          {/* Empty state — only shown when tunnel IS running */}
          {!loading && !error && !notConfigured && tunnelRunning && !tunnelStarting && conversations.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center flex-1 justify-center">
              <p className="text-sm text-slate-400">No messages yet</p>
              <p className="text-xs text-slate-600">Incoming WhatsApp messages will appear here.</p>
            </div>
          )}

          {/* Conversation list */}
          {!loading && !error && conversations.length > 0 && (
            <div className="flex flex-col gap-1 mt-2 overflow-y-auto flex-1 -mr-1 pr-1">
              {conversations.map(conv => (
                <ConversationRow
                  key={conv.phone}
                  conv={conv}
                  onClick={() => setActiveConv(conv)}
                />
              ))}
            </div>
          )}
        </div>
      </BentoCard>

      {activeConv && (
        <ConversationModal
          conv={activeConv}
          onClose={() => setActiveConv(null)}
          onReplySent={fetchMessages}
          onMarkRead={markRead}
        />
      )}
    </>
  )
}
