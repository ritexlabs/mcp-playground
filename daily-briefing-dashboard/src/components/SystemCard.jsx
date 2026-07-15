import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import BentoCard from './BentoCard.jsx'

const ACCENT = '#38bdf8'
const POLL_MS = 3000

// ── Colour thresholds ─────────────────────────────────────────────────────────

function gaugeColor(pct) {
  if (pct >= 85) return '#fb7185'
  if (pct >= 65) return '#fbbf24'
  return '#34d399'
}

// ── Format bytes/sec ──────────────────────────────────────────────────────────

function fmtBps(bps) {
  if (bps == null || bps < 0) return '—'
  if (bps < 1024)        return `${bps} B/s`
  if (bps < 1_048_576)   return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1_048_576).toFixed(1)} MB/s`
}

// ── Mini bar gauge ────────────────────────────────────────────────────────────

function Gauge({ label, pct, sub }) {
  const color = gaugeColor(pct)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>{label}</span>
        <div className="flex items-baseline gap-2">
          {sub && <span style={{ color: '#475569', fontSize: 10 }}>{sub}</span>}
          <span className="text-xs font-semibold tabular-nums" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,0.07)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ── Network rate row ──────────────────────────────────────────────────────────

function NetRow({ send, recv }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Network</span>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-[11px] font-mono tabular-nums" style={{ color: '#34d399' }}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {fmtBps(send)}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-mono tabular-nums" style={{ color: ACCENT }}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M5 9V1M1 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {fmtBps(recv)}
        </span>
      </div>
    </div>
  )
}

// ── Battery row ───────────────────────────────────────────────────────────────

function BatteryRow({ battery }) {
  if (!battery) return null
  const pct   = battery.percent ?? 0
  const color = pct <= 20 ? '#fb7185' : pct <= 50 ? '#fbbf24' : '#34d399'
  const label = battery.power_plugged
    ? (battery.time_left ? `Charging · ${battery.time_left}` : 'Charging')
    : (battery.time_left ? `${battery.time_left} left` : 'On battery')
  const barW = Math.max(1, Math.round((pct / 100) * 10))
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Battery</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px]" style={{ color: '#475569' }}>{label}</span>
        <div className="flex items-center gap-1.5">
          <svg width="20" height="11" viewBox="0 0 20 11" fill="none">
            <rect x="0.5" y="0.5" width="16" height="10" rx="2" stroke={color} strokeWidth="1"/>
            <rect x="17" y="3.5" width="2.5" height="4" rx="1" fill={color}/>
            <rect x="1.5" y="1.5" width={barW} height="8" rx="1" fill={color} opacity="0.85"/>
          </svg>
          <span className="text-[11px] font-mono tabular-nums font-semibold" style={{ color }}>{pct}%</span>
        </div>
      </div>
    </div>
  )
}

// ── Temp badge ────────────────────────────────────────────────────────────────

function TempBadge({ celsius }) {
  if (celsius == null) return null
  const color = celsius >= 85 ? '#fb7185' : celsius >= 65 ? '#fbbf24' : '#34d399'
  return (
    <div className="flex items-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
      </svg>
      <span className="text-xs font-semibold tabular-nums" style={{ color }}>{celsius}°C</span>
    </div>
  )
}

// ── OS icon ───────────────────────────────────────────────────────────────────

function OsIcon({ osName }) {
  const lower = (osName || '').toLowerCase()
  if (lower.includes('macos') || lower.includes('darwin')) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#94a3b8' }}>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    )
  }
  if (lower.includes('windows')) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#94a3b8' }}>
        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
      </svg>
    )
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: '#94a3b8' }}>
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 py-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="h-[5px] w-full rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>
      ))}
    </div>
  )
}

// ── Metric row (popup) ────────────────────────────────────────────────────────

function MetricRow({ label, value, sub, pct }) {
  const pctColor = pct != null
    ? (pct >= 80 ? '#fb7185' : pct >= 50 ? '#fbbf24' : '#34d399')
    : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: '#94a3b8', fontSize: 13 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {sub && <span style={{ color: '#334155', fontSize: 11 }}>{sub}</span>}
        <span style={{ color: '#cbd5e1', fontSize: 13, fontFamily: 'monospace' }}>{value}</span>
        {pct != null && (
          <span style={{ color: pctColor, fontSize: 11, fontFamily: 'monospace', minWidth: 36, textAlign: 'right' }}>
            {pct}%
          </span>
        )}
      </div>
    </div>
  )
}

// ── System Details Popup ──────────────────────────────────────────────────────

function SystemDetailsPopup({ data, onClose }) {
  const freq    = data?.cpu_freq
  const loadAvg = data?.load_avg
  const swap    = data?.swap
  const diskIo  = data?.disk_io  || {}
  const procs   = data?.top_processes || []
  const uptime  = data?.uptime
  const battery = data?.battery
  const cpu     = data?.cpu || {}

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(9,14,20,0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          position: 'sticky', top: 0,
          background: 'rgba(9,14,20,0.97)',
          zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            </svg>
            <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15 }}>System Details</span>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1, borderRadius: 6 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Metrics section */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ color: '#334155', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Metrics
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {uptime && <MetricRow label="Uptime" value={uptime} />}
            {freq && (
              <MetricRow
                label="CPU Frequency"
                value={`${freq.current_ghz} GHz${freq.max_ghz ? ` / ${freq.max_ghz} GHz max` : ''}`}
              />
            )}
            {cpu.physical != null && cpu.cores != null && (
              <MetricRow
                label="CPU Cores"
                value={`${cpu.physical} physical · ${cpu.cores} logical`}
              />
            )}
            {loadAvg && (
              <MetricRow
                label="Load Average"
                value={`${loadAvg[0]} / ${loadAvg[1]} / ${loadAvg[2]}`}
                sub="1m / 5m / 15m"
              />
            )}
            {swap && (
              <MetricRow
                label="Swap Memory"
                value={`${swap.used_gb} / ${swap.total_gb} GB`}
                pct={swap.percent}
              />
            )}
            {(diskIo.read_bps != null || diskIo.write_bps != null) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Disk I/O</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: '#34d399', fontSize: 12, fontFamily: 'monospace' }}>
                    R {fmtBps(diskIo.read_bps)}
                  </span>
                  <span style={{ color: ACCENT, fontSize: 12, fontFamily: 'monospace' }}>
                    W {fmtBps(diskIo.write_bps)}
                  </span>
                </div>
              </div>
            )}
            {battery && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Battery</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#475569', fontSize: 12 }}>
                    {battery.power_plugged
                      ? (battery.time_left ? `Charging · ${battery.time_left}` : 'Charging')
                      : (battery.time_left ? `${battery.time_left} left` : 'On battery')}
                  </span>
                  <span style={{
                    color: battery.percent <= 20 ? '#fb7185' : battery.percent <= 50 ? '#fbbf24' : '#34d399',
                    fontSize: 13, fontFamily: 'monospace', fontWeight: 600,
                  }}>
                    {battery.percent}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Processes */}
        {procs.length > 0 && (
          <div style={{ padding: '16px 20px 20px' }}>
            <div style={{ color: '#334155', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              Top Processes
            </div>
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 64px 80px',
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.03)',
              }}>
                <span style={{ color: '#334155', fontSize: 11 }}>Process</span>
                <span style={{ color: '#334155', fontSize: 11, textAlign: 'right' }}>CPU</span>
                <span style={{ color: '#334155', fontSize: 11, textAlign: 'right' }}>RAM</span>
              </div>
              {procs.map((p, i) => {
                const cpuColor = p.cpu > 20 ? '#fb7185' : p.cpu > 5 ? '#fbbf24' : '#64748b'
                const memLabel = p.mem_mb >= 1024
                  ? `${(p.mem_mb / 1024).toFixed(1)} GB`
                  : `${p.mem_mb} MB`
                return (
                  <div
                    key={p.pid ?? i}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 64px 80px',
                      padding: '7px 12px',
                      borderTop: '1px solid rgba(255,255,255,0.04)',
                      background: i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    }}
                  >
                    <span style={{ color: '#cbd5e1', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </span>
                    <span style={{ color: cpuColor, fontSize: 12, fontFamily: 'monospace', textAlign: 'right' }}>
                      {p.cpu}%
                    </span>
                    <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace', textAlign: 'right' }}>
                      {memLabel}
                    </span>
                  </div>
                )
              })}
            </div>
            <p style={{ color: '#1e293b', fontSize: 11, marginTop: 8, textAlign: 'right' }}>
              CPU% initialises on first poll — updates every 3s
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── SystemCard ────────────────────────────────────────────────────────────────

export default function SystemCard({ delay = 0 }) {
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [syncedAt,    setSyncedAt]    = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const timerRef = useRef(null)

  async function fetchStats() {
    try {
      const r = await fetch('/api/system')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setData(d)
      setError(null)
      setSyncedAt(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    timerRef.current = setInterval(fetchStats, POLL_MS)
    return () => clearInterval(timerRef.current)
  }, [])

  const os      = data?.os      || {}
  const cpu     = data?.cpu     || {}
  const ram     = data?.ram     || {}
  const disk    = data?.disk    || {}
  const net     = data?.network || {}
  const temp    = data?.temperature ?? null
  const battery = data?.battery     ?? null
  const uptime  = data?.uptime      ?? null

  return (
    <BentoCard accent={ACCENT} delay={delay} syncedAt={syncedAt} className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
          <span className="text-sm font-semibold text-slate-200">System</span>
        </div>
        <TempBadge celsius={temp} />
      </div>

      {/* OS info row */}
      {data && (
        <div
          className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <OsIcon osName={os.os} />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-slate-300">{os.os}</span>
            <span className="text-xs ml-2" style={{ color: '#475569' }}>{os.version}</span>
          </div>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0"
            style={{ background: 'rgba(56,189,248,0.1)', color: ACCENT, fontSize: 10 }}
          >
            {os.arch}
          </span>
        </div>
      )}

      {/* Gauges + live rows */}
      <div className="flex-1 flex flex-col justify-center gap-3.5 px-4 pb-2">
        {loading && <Skeleton />}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <span style={{ color: '#fb7185', fontSize: 13 }}>Failed to load stats</span>
            <button onClick={fetchStats} className="text-xs" style={{ color: ACCENT }}>Retry</button>
          </div>
        )}

        {data && !loading && (
          <>
            <Gauge label="CPU"    pct={cpu.percent  ?? 0} sub={cpu.cores ? `${cpu.cores} cores` : undefined} />
            <Gauge label="Memory" pct={ram.percent  ?? 0} sub={ram.used_gb  != null ? `${ram.used_gb} / ${ram.total_gb} GB`   : undefined} />
            <Gauge label="Disk"   pct={disk.percent ?? 0} sub={disk.used_gb != null ? `${disk.used_gb} / ${disk.total_gb} GB` : undefined} />
            <NetRow send={net.send_bps} recv={net.recv_bps} />
            <BatteryRow battery={battery} />
          </>
        )}
      </div>

      {/* Footer: uptime + details link */}
      {data && !loading && (
        <div
          className="flex items-center justify-between px-4 pb-3 pt-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span style={{ color: '#334155', fontSize: 11 }}>{uptime ? `Up ${uptime}` : ''}</span>
          <button
            onClick={() => setShowDetails(true)}
            style={{ color: ACCENT, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
          >
            Details
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {showDetails && <SystemDetailsPopup data={data} onClose={() => setShowDetails(false)} />}
    </BentoCard>
  )
}
