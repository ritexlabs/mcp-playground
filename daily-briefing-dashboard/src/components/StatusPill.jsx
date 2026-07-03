export default function StatusPill({ connected, checkedAt }) {
  const label = connected ? 'Gateway Online' : 'Gateway Offline'
  const time  = checkedAt
    ? checkedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
    : ''

  return (
    <div
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium backdrop-blur-md border transition-all duration-300"
      style={{
        background:   connected ? 'rgba(52,211,153,0.08)'  : 'rgba(251,113,133,0.08)',
        borderColor:  connected ? 'rgba(52,211,153,0.2)'   : 'rgba(251,113,133,0.2)',
        color:        connected ? '#34d399' : '#fb7185',
      }}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{
          background: connected ? '#34d399' : '#fb7185',
          boxShadow:  connected ? '0 0 6px #34d39980' : '0 0 6px #fb718580',
          animation: 'blinkDot 2s ease-in-out infinite',
        }}
      />
      {label}
      {time && <span className="opacity-50 hidden sm:inline">· {time}</span>}
    </div>
  )
}
