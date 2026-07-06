import { useState, useEffect } from 'react'

export default function StatusPill({ connected, checkedAt, gatewayUrl }) {
  const [dashUrl, setDashUrl] = useState(null)

  useEffect(() => {
    if (gatewayUrl) {
      setDashUrl(`${gatewayUrl}/dashboard`)
      return
    }
    fetch('/api/config/gateway-url')
      .then(r => r.json())
      .then(d => setDashUrl(`${d.url}/dashboard`))
      .catch(() => {})
  }, [gatewayUrl])

  const gwColor = connected ? '#34d399' : '#fb7185'
  const time = checkedAt
    ? checkedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
    : ''

  const pillContent = (
    <>
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{
          background: gwColor,
          boxShadow:  `0 0 6px ${gwColor}80`,
          animation:  connected ? 'blinkDot 2s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{ color: gwColor }}>{connected ? 'Gateway Online' : 'Gateway Offline'}</span>
      {time && <span className="opacity-40 hidden sm:inline">· {time}</span>}
    </>
  )

  const pillClass =
    'fixed bottom-5 right-5 z-40 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium backdrop-blur-md border transition-all duration-300'
  const pillStyle = { background: 'rgba(9,14,20,0.75)', borderColor: 'rgba(255,255,255,0.09)' }

  if (dashUrl) {
    return (
      <a
        href={dashUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={pillClass}
        style={{ ...pillStyle, textDecoration: 'none', cursor: 'pointer' }}
        title="Open MCP Gateway Dashboard"
      >
        {pillContent}
        <span className="opacity-30 ml-1">↗</span>
      </a>
    )
  }

  return (
    <div className={pillClass} style={pillStyle}>
      {pillContent}
    </div>
  )
}
