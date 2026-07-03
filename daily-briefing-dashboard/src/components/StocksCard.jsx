import { useState, useMemo } from 'react'
import BentoCard, { CardHeader, CardSkeleton, CardError } from './BentoCard.jsx'
import { fmtCurrency, fmtPct } from '../utils/parsers.js'

const ACCENT = '#34d399'

// ─── Pseudo-random helper ─────────────────────────────────────────────────────
function pr(i, seed) {
  const x = Math.sin(i * seed + seed * 0.7) * 43758.5453
  return x - Math.floor(x)
}

// ─── Stock portfolio background ───────────────────────────────────────────────
function StocksRiseScene() {
  const dots = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left:    `${pr(i, 7.3) * 96}%`,
    delay:   `${pr(i, 3.7) * 8}s`,
    dur:     `${8 + pr(i, 5.1) * 6}s`,
    size:    `${2 + Math.floor(pr(i, 2.9) * 3)}px`,
    drift:   `${(pr(i, 6.3) - 0.5) * 28}px`,
    opacity: 0.07 + pr(i, 4.1) * 0.1,
  })), [])

  return (
    <>
      {dots.map(d => (
        <div key={d.id} style={{
          position: 'absolute', left: d.left, bottom: 0,
          width: d.size, height: d.size, borderRadius: '50%',
          background: 'rgba(52,211,153,0.9)',
          boxShadow: '0 0 5px rgba(52,211,153,0.4)',
          opacity: d.opacity,
          willChange: 'transform',
          '--wx-drift': d.drift,
          animation: `wx-rise ${d.dur} ${d.delay} ease-in-out infinite`,
        }} />
      ))}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '100px',
        background: 'linear-gradient(to top, rgba(52,211,153,0.06), transparent)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20px', right: '-20px', width: '180px', height: '160px',
        background: 'radial-gradient(ellipse, rgba(52,211,153,0.08) 0%, transparent 70%)',
        animation: 'wx-sun-glow 7s ease-in-out infinite', borderRadius: '50%',
      }} />
    </>
  )
}

function StocksFallScene() {
  const dots = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left:    `${pr(i, 7.3) * 96}%`,
    delay:   `${pr(i, 3.7) * 7}s`,
    dur:     `${7 + pr(i, 5.1) * 5}s`,
    size:    `${2 + Math.floor(pr(i, 2.9) * 3)}px`,
    drift:   `${(pr(i, 6.3) - 0.5) * 24}px`,
    opacity: 0.07 + pr(i, 4.1) * 0.09,
  })), [])

  return (
    <>
      {dots.map(d => (
        <div key={d.id} style={{
          position: 'absolute', left: d.left, top: 0,
          width: d.size, height: d.size, borderRadius: '50%',
          background: 'rgba(251,113,133,0.9)',
          boxShadow: '0 0 5px rgba(251,113,133,0.3)',
          opacity: d.opacity,
          willChange: 'transform',
          '--wx-drift': d.drift,
          animation: `wx-snow ${d.dur} ${d.delay} linear infinite`,
        }} />
      ))}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '80px',
        background: 'linear-gradient(to bottom, rgba(251,113,133,0.05), transparent)',
      }} />
    </>
  )
}

function StocksBackground({ pnl }) {
  const bg = pnl === null
    ? 'linear-gradient(150deg, #020a06 0%, #040e0a 50%, #020a06 100%)'
    : pnl >= 0
      ? 'linear-gradient(150deg, #030c07 0%, #05140a 50%, #030c07 100%)'
      : 'linear-gradient(150deg, #0c0303 0%, #140506 50%, #0c0303 100%)'
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: bg }} />
      {pnl !== null && pnl >= 0 && <StocksRiseScene />}
      {pnl !== null && pnl < 0  && <StocksFallScene />}
    </div>
  )
}

function SortIcon({ active, dir }) {
  return (
    <span className="inline-flex flex-col ml-1 opacity-40" style={{ opacity: active ? 1 : 0.3 }}>
      <span style={{ color: active && dir === 'asc' ? ACCENT : undefined }}>▲</span>
      <span style={{ color: active && dir === 'desc' ? ACCENT : undefined }}>▼</span>
    </span>
  )
}

export default function StocksCard({ data, loading, error, onRetry, onRefresh, delay = 0, syncedAt }) {
  const [activeBroker, setActiveBroker] = useState('all')
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [valuesHidden, setValuesHidden] = useState(false)

  const rows   = data || []
  const brokers = useMemo(() => ['all', ...new Set(rows.map(r => r.broker).filter(Boolean))], [rows])

  const filtered = useMemo(() => {
    let list = activeBroker === 'all' ? rows : rows.filter(r => r.broker === activeBroker)
    if (sort.key) {
      list = [...list].sort((a, b) => {
        const av = a[sort.key] ?? 0, bv = b[sort.key] ?? 0
        return sort.dir === 'asc' ? av - bv : bv - av
      })
    }
    return list
  }, [rows, activeBroker, sort])

  const totals = useMemo(() => {
    const invested = filtered.reduce((s, r) => s + (r.buy || 0) * (r.qty || 0), 0)
    const current  = filtered.reduce((s, r) => s + (r.curr || 0) * (r.qty || 0), 0)
    return { invested, current, pnl: current - invested, pnlPct: invested ? ((current - invested) / invested) * 100 : 0 }
  }, [filtered])

  const overallPnl = useMemo(() => {
    if (!rows.length) return null
    const inv = rows.reduce((s, r) => s + (r.buy  || 0) * (r.qty || 0), 0)
    const cur = rows.reduce((s, r) => s + (r.curr || 0) * (r.qty || 0), 0)
    return cur - inv
  }, [rows])

  function toggleSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const Th = ({ label, sortKey }) => (
    <th
      className="py-2 px-3 text-left card-label cursor-pointer select-none whitespace-nowrap hover:text-slate-300 transition-colors"
      onClick={() => sortKey && toggleSort(sortKey)}
    >
      {label}{sortKey && <SortIcon active={sort.key === sortKey} dir={sort.dir} />}
    </th>
  )

  return (
    <BentoCard accent={ACCENT} delay={delay} syncedAt={syncedAt} className="p-5">
      <StocksBackground pnl={loading || error ? null : overallPnl} />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <CardHeader
        icon={
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
        title="Stock Portfolio"
        accent={ACCENT}
      >
        {!loading && !error && (
          <>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${ACCENT}18`, color: ACCENT }}>
              {rows.length} holdings
            </span>
            <button
              onClick={() => setValuesHidden(v => !v)}
              className="btn-icon !py-1 !px-2"
              aria-label={valuesHidden ? 'Show values' : 'Hide values'}
              title={valuesHidden ? 'Show summary' : 'Hide summary'}
            >
              {valuesHidden ? (
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            <button onClick={onRefresh} className="btn-icon !py-1 !px-2" aria-label="Refresh stocks">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </>
        )}
      </CardHeader>

      {loading && <CardSkeleton rows={5} />}
      {!loading && error && <CardError message={error} onRetry={onRetry} />}

      {!loading && !error && rows.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-400">No portfolio data</p>
          <p className="text-xs text-slate-600 mt-1">Configure a Google Sheet in Settings → Stocks</p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Broker tabs */}
          {brokers.length > 2 && (
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
              {brokers.map(b => (
                <button
                  key={b}
                  onClick={() => setActiveBroker(b)}
                  className={`broker-tab ${activeBroker === b ? 'active' : ''}`}
                >
                  {b === 'all' ? 'All Brokers' : b}
                </button>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[540px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <Th label="Symbol" />
                  <Th label="Qty"        sortKey="qty" />
                  <Th label="Buy ₹"      sortKey="buy" />
                  <Th label="Current ₹"  sortKey="curr" />
                  <Th label="P&L"        sortKey="pnl" />
                  <Th label="%" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const positive = r.pnl >= 0
                  return (
                    <tr
                      key={r.sym + i}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-200 font-mono text-xs">{r.sym}</span>
                        <p className="text-[10px] text-slate-500 truncate max-w-[100px]">{r.name !== r.sym ? r.name : ''}</p>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-300">{r.qty}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-300">{fmtCurrency(r.buy)}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-200 font-medium">{fmtCurrency(r.curr)}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-semibold" style={{ color: positive ? '#34d399' : '#fb7185' }}>
                        {positive ? '+' : ''}{fmtCurrency(r.pnl)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            color:      positive ? '#34d399' : '#fb7185',
                            background: positive ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)',
                          }}
                        >
                          {fmtPct(r.pnlPct)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals footer */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/[0.06]">
            {[
              { label: 'Invested',      value: fmtCurrency(totals.invested, true), color: 'text-slate-300' },
              { label: 'Current Value', value: fmtCurrency(totals.current,  true), color: 'text-slate-200' },
              { label: 'Overall P&L',   value: fmtCurrency(totals.pnl, true),      color: totals.pnl >= 0 ? '#34d399' : '#fb7185' },
            ].map(({ label, value, color }) => (
              <div key={label} className="metric-item">
                <span className="card-label">{label}</span>
                <span className="text-sm font-bold tabular-nums font-mono mt-1" style={typeof color === 'string' && color.startsWith('#') ? { color } : {}}>
                  {valuesHidden ? '••••••' : value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      </div>
    </BentoCard>
  )
}
