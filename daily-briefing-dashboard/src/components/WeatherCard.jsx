import { useMemo } from 'react'
import BentoCard, { CardHeader, CardSkeleton, CardError } from './BentoCard.jsx'
import { weatherIcon } from '../utils/parsers.js'

const ACCENT = '#22d3ee'

// ─── Pseudo-random helper (deterministic, no Math.random) ─────────────────────
function pr(i, seed) {
  const x = Math.sin(i * seed + seed * 0.7) * 43758.5453
  return x - Math.floor(x)
}

// ─── Background gradients per condition ───────────────────────────────────────
const BG = {
  sunny:           'linear-gradient(150deg, #1c0e00 0%, #2e1800 45%, #0e1825 100%)',
  'partly-cloudy': 'linear-gradient(150deg, #0f1218 0%, #1e1a08 45%, #101828 100%)',
  cloudy:          'linear-gradient(150deg, #0a1018 0%, #14202e 50%, #0a1620 100%)',
  rain:            'linear-gradient(150deg, #030c18 0%, #091828 50%, #050e1e 100%)',
  fog:             'linear-gradient(150deg, #0c1620 0%, #172436 50%, #0a1624 100%)',
  snow:            'linear-gradient(150deg, #06101e 0%, #0e1c38 50%, #060c1c 100%)',
  storm:           'linear-gradient(150deg, #03060c 0%, #080c14 50%, #030508 100%)',
  night:           'linear-gradient(150deg, #010408 0%, #040918 50%, #020510 100%)',
}

// ─── Scene components ─────────────────────────────────────────────────────────

function SunnyScene() {
  return (
    <>
      {/* Core glow */}
      <div style={{
        position: 'absolute', top: '-70px', right: '-70px',
        width: '260px', height: '260px',
        background: 'radial-gradient(circle, rgba(251,191,36,0.32) 0%, rgba(245,158,11,0.14) 40%, transparent 70%)',
        animation: 'wx-sun-glow 4s ease-in-out infinite',
        borderRadius: '50%',
      }} />
      {/* Rotating rays */}
      <div style={{
        position: 'absolute', top: '-50px', right: '-50px',
        width: '220px', height: '220px',
        animation: 'wx-sun-rays 22s linear infinite',
        opacity: 0.18,
      }}>
        {[0, 30, 60, 90, 120, 150].map(deg => (
          <div key={deg} style={{
            position: 'absolute', top: '50%', left: '50%',
            width: '2px', height: '130px',
            marginLeft: '-1px',
            background: 'linear-gradient(to bottom, rgba(251,191,36,1), transparent)',
            transformOrigin: 'top center',
            transform: `rotate(${deg}deg)`,
          }} />
        ))}
      </div>
      {/* Warm floor wash */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 88% 12%, rgba(245,158,11,0.09) 0%, transparent 55%)',
      }} />
    </>
  )
}

function NightScene({ particles }) {
  return (
    <>
      {/* Moon halo */}
      <div style={{
        position: 'absolute', top: '-10px', right: '30px',
        width: '110px', height: '110px',
        background: 'radial-gradient(circle, rgba(186,230,253,0.2) 0%, rgba(56,189,248,0.07) 50%, transparent 70%)',
        animation: 'wx-moon-pulse 6s ease-in-out infinite',
        borderRadius: '50%',
      }} />
      {/* Stars */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: p.left, top: p.top,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: 'white',
          willChange: 'opacity, transform',
          animation: `wx-twinkle ${p.dur} ${p.delay} ease-in-out infinite`,
        }} />
      ))}
      {/* Deep violet fringe */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 75% 0%, rgba(99,102,241,0.12) 0%, transparent 55%)',
      }} />
    </>
  )
}

function RainScene({ particles, storm }) {
  return (
    <>
      {/* Rain streaks */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: p.left, top: 0,
          width: '1.5px',
          height: p.len,
          background: 'linear-gradient(to bottom, transparent, rgba(147,213,253,0.72))',
          borderRadius: '1px',
          opacity: p.opacity,
          willChange: 'transform',
          animation: `wx-rain ${p.dur} ${p.delay} linear infinite`,
        }} />
      ))}
      {/* Storm lightning flash */}
      {storm && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(180,215,255,0.12)',
          animation: 'wx-lightning 5s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}
      {/* Wet floor */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '70px',
        background: 'linear-gradient(to top, rgba(5,20,50,0.45), transparent)',
      }} />
    </>
  )
}

function SnowScene({ particles }) {
  return (
    <>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: p.left, top: 0,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.88)',
          boxShadow: '0 0 5px rgba(186,230,253,0.6)',
          opacity: p.opacity,
          willChange: 'transform',
          '--wx-drift': p.drift,
          animation: `wx-snow ${p.dur} ${p.delay} linear infinite`,
        }} />
      ))}
      {/* Cold shimmer at bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '90px',
        background: 'linear-gradient(to top, rgba(186,230,253,0.08), transparent)',
      }} />
    </>
  )
}

function FogScene() {
  return (
    <>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          position: 'absolute',
          top: `${10 + i * 18}%`, left: '-10%', right: '-10%',
          height: `${30 + i * 4}px`,
          background: `linear-gradient(90deg, transparent 0%, rgba(148,163,184,${0.08 + i * 0.025}) 20%, rgba(148,163,184,${0.12 + i * 0.02}) 50%, rgba(148,163,184,${0.07 + i * 0.015}) 80%, transparent 100%)`,
          filter: 'blur(5px)',
          willChange: 'transform',
          animation: `wx-fog-drift ${4.5 + i * 1.8}s ${i * 0.9}s ease-in-out infinite alternate`,
        }} />
      ))}
    </>
  )
}

function CloudShape({ style }) {
  return (
    <div style={style}>
      <svg width="220" height="70" viewBox="0 0 220 70" fill="none">
        <ellipse cx="110" cy="50" rx="100" ry="22" fill="#94a3b8" />
        <ellipse cx="85"  cy="36" rx="55"  ry="28" fill="#94a3b8" />
        <ellipse cx="145" cy="32" rx="45"  ry="24" fill="#94a3b8" />
      </svg>
    </div>
  )
}

function CloudyScene() {
  return (
    <>
      {[
        { top: '8%',  scale: 1.15, delay: '0s',   dur: '20s', opacity: 0.055 },
        { top: '38%', scale: 0.75, delay: '-9s',  dur: '26s', opacity: 0.045 },
        { top: '65%', scale: 1.0,  delay: '-5s',  dur: '23s', opacity: 0.04  },
      ].map((c, i) => (
        <CloudShape key={i} style={{
          position: 'absolute', left: '3%', top: c.top,
          opacity: c.opacity,
          transform: `scale(${c.scale})`,
          transformOrigin: 'left center',
          willChange: 'transform',
          animation: `wx-cloud-drift ${c.dur} ${c.delay} ease-in-out infinite alternate`,
        }} />
      ))}
    </>
  )
}

function PartlyCloudyScene() {
  return (
    <>
      <SunnyScene />
      <CloudShape style={{
        position: 'absolute', right: '4%', top: '28%', opacity: 0.07,
        willChange: 'transform',
        animation: 'wx-cloud-drift 16s ease-in-out infinite alternate',
      }} />
    </>
  )
}

// ─── Particle generator ───────────────────────────────────────────────────────
function useParticles(icon) {
  return useMemo(() => {
    if (icon === 'rain' || icon === 'storm') {
      return Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left:    `${pr(i, 7.3) * 100}%`,
        delay:   `${pr(i, 3.7) * 1.4}s`,
        dur:     `${0.5 + pr(i, 5.1) * 0.75}s`,
        len:     `${13 + pr(i, 2.9) * 15}px`,
        opacity: 0.22 + pr(i, 4.1) * 0.32,
      }))
    }
    if (icon === 'snow') {
      return Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left:    `${pr(i, 7.3) * 100}%`,
        delay:   `${pr(i, 3.7) * 5}s`,
        dur:     `${3 + pr(i, 5.1) * 3.5}s`,
        size:    `${3 + Math.floor(pr(i, 2.9) * 4)}px`,
        drift:   `${(pr(i, 6.3) - 0.5) * 44}px`,
        opacity: 0.38 + pr(i, 4.1) * 0.45,
      }))
    }
    if (icon === 'night') {
      return Array.from({ length: 32 }, (_, i) => ({
        id: i,
        left:  `${pr(i, 7.3) * 100}%`,
        top:   `${pr(i, 5.1) * 72}%`,
        delay: `${pr(i, 3.7) * 3.5}s`,
        dur:   `${1.5 + pr(i, 2.9) * 2.5}s`,
        size:  `${1 + Math.floor(pr(i, 6.3) * 2)}px`,
      }))
    }
    return []
  }, [icon])
}

// ─── Main background layer ────────────────────────────────────────────────────
function WeatherBackground({ condition }) {
  const icon      = weatherIcon(condition || '')
  const particles = useParticles(icon)
  const bg        = BG[icon] || BG.cloudy

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: bg }} />
      {icon === 'sunny'          && <SunnyScene />}
      {icon === 'night'          && <NightScene particles={particles} />}
      {(icon === 'rain' || icon === 'storm') && <RainScene particles={particles} storm={icon === 'storm'} />}
      {icon === 'snow'           && <SnowScene  particles={particles} />}
      {icon === 'fog'            && <FogScene />}
      {icon === 'cloudy'         && <CloudyScene />}
      {icon === 'partly-cloudy'  && <PartlyCloudyScene />}
    </div>
  )
}

// ─── Weather icon SVGs ────────────────────────────────────────────────────────
const ICONS = {
  sunny: (
    <svg className="animate-float" width="52" height="52" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" stroke="#f59e0b" strokeWidth="1.5" fill="#fef08a" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  night: (
    <svg className="animate-float" width="52" height="52" viewBox="0 0 24 24" fill="none">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="#38bdf8" strokeWidth="1.5" fill="#bae6fd" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cloudy: (
    <svg className="animate-float" width="52" height="52" viewBox="0 0 24 24" fill="none">
      <path d="M18 10h-1.26A8 8 0 1 0 9 15h9a5 5 0 0 0 0-10z" stroke="#94a3b8" strokeWidth="1.5" fill="#cbd5e1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  'partly-cloudy': (
    <svg className="animate-float" width="52" height="52" viewBox="0 0 24 24" fill="none">
      <circle cx="16" cy="8" r="4" stroke="#f59e0b" strokeWidth="1.5" fill="#fef08a" />
      <path d="M18 14h-1.26A8 8 0 1 0 7 19h11a4 4 0 0 0 0-8z" stroke="#94a3b8" strokeWidth="1.5" fill="#cbd5e1" />
    </svg>
  ),
  rain: (
    <svg className="animate-float" width="52" height="52" viewBox="0 0 24 24" fill="none">
      <path d="M18 10h-1.26A8 8 0 1 0 9 15h9a5 5 0 0 0 0-10z" stroke="#64748b" strokeWidth="1.5" fill="#94a3b8" />
      <path d="M8 19v2M12 18v2M16 19v2" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  fog: (
    <svg className="animate-float" width="52" height="52" viewBox="0 0 24 24" fill="none">
      <path d="M3 15h18M3 12h18M3 9h18" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  snow: (
    <svg className="animate-float" width="52" height="52" viewBox="0 0 24 24" fill="none">
      <path d="M18 10h-1.26A8 8 0 1 0 9 15h9a5 5 0 0 0 0-10z" stroke="#64748b" strokeWidth="1.5" fill="#e2e8f0" />
      <circle cx="8"  cy="19" r="1.2" fill="#cbd5e1" />
      <circle cx="12" cy="20" r="1.2" fill="#cbd5e1" />
      <circle cx="16" cy="19" r="1.2" fill="#cbd5e1" />
    </svg>
  ),
  storm: (
    <svg className="animate-float" width="52" height="52" viewBox="0 0 24 24" fill="none">
      <path d="M18 10h-1.26A8 8 0 1 0 9 15h9a5 5 0 0 0 0-10z" stroke="#64748b" strokeWidth="1.5" fill="#94a3b8" />
      <path d="M13 17l-2 3h3l-1 3" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

function Metric({ label, value }) {
  return (
    <div className="metric-item">
      <span className="card-label">{label}</span>
      <span className="text-sm font-semibold text-slate-200 mt-1 font-mono tabular-nums">{value}</span>
    </div>
  )
}

export default function WeatherCard({ data, loading, error, location, onRetry, onChangeLocation, delay = 0, syncedAt }) {
  return (
    <BentoCard accent={ACCENT} delay={delay} syncedAt={syncedAt} className="p-5 flex flex-col h-full">
      {data && !loading && !error && <WeatherBackground condition={data.condition} />}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <CardHeader
          icon={
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="Weather"
          accent={ACCENT}
        >
          <button
            onClick={onChangeLocation}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: ACCENT, background: `${ACCENT}15` }}
          >
            {location?.name || 'Set Location'}
          </button>
        </CardHeader>

        {loading && <CardSkeleton rows={3} />}
        {!loading && error && <CardError message={error} onRetry={onRetry} />}

        {!loading && !error && data && (
          <div className="flex flex-col gap-3">
            {/* Main row: temp + icon side by side */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-end gap-1 leading-none">
                  <span className="text-5xl font-bold tabular-nums tracking-tight text-white">{data.temp}</span>
                  <span className="text-xl font-medium text-slate-300 mb-1">°C</span>
                </div>
                <p className="text-sm text-slate-300 mt-1.5 font-medium">{data.condition}</p>
                <p className="text-xs text-slate-500 mt-0.5">Feels like {data.feelsLike}</p>
              </div>
              <div className="opacity-90 flex-shrink-0">
                {/* Scale icons down to 52px */}
                {ICONS[weatherIcon(data.condition)] ?? ICONS.sunny}
              </div>
            </div>

            <div className="metric-grid">
              <Metric label="Wind"     value={data.wind} />
              <Metric label="Humidity" value={data.humidity} />
              <Metric label="Rain"     value={data.precip} />
            </div>
          </div>
        )}
      </div>
    </BentoCard>
  )
}
