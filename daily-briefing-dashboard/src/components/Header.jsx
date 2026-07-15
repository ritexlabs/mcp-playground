import { useState, useEffect } from 'react'
import { useClock } from '../hooks/useClock.js'

export default function Header({ onRefresh, onSettings, refreshing }) {
  const { greeting, time, seconds, date } = useClock()
  const [userName, setUserName] = useState(() => localStorage.getItem('dashboard_user_name') || '')

  useEffect(() => {
    function onNameChange(e) { setUserName(e.detail) }
    window.addEventListener('dashboard-user-name-change', onNameChange)
    return () => window.removeEventListener('dashboard-user-name-change', onNameChange)
  }, [])

  const greetingText = userName.trim() ? `${greeting}, ${userName.trim()}` : greeting

  return (
    <header className="flex items-center justify-between px-6 py-4 opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
      {/* Left — greeting + date */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{greetingText} 👋</h1>
        <p className="text-sm text-slate-400 mt-0.5">{date}</p>
      </div>

      {/* Right — clock + actions */}
      <div className="flex items-center gap-3">
        {/* Live clock */}
        <div className="hidden sm:flex items-baseline gap-1 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.07]">
          <span className="font-mono text-xl font-semibold text-white tabular-nums tracking-tight">{time}</span>
          <span className="font-mono text-xs text-slate-500 tabular-nums">{seconds}s</span>
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          aria-label="Refresh Dashboard"
          className="btn-icon"
          disabled={refreshing}
        >
          <svg
            width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            className={refreshing ? 'animate-spin' : ''}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Settings */}
        <button
          onClick={onSettings}
          aria-label="Open Settings"
          className="btn-icon"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </header>
  )
}
