import { useReducer, useEffect, useRef, useCallback } from 'react'
import {
  parseWeather, parseCalendar, parseStocks,
  parseCelebrations, parseIndMoney,
} from '../utils/parsers.js'

// ── State shape ───────────────────────────────────────────────────────────────

const CARDS = ['weather', 'calendar', 'stocks', 'celebrations', 'indmoney']

const initialState = {
  data:     Object.fromEntries(CARDS.map(k => [k, null])),
  loading:  Object.fromEntries(CARDS.map(k => [k, true])),
  errors:   Object.fromEntries(CARDS.map(k => [k, null])),
  syncedAt: Object.fromEntries(CARDS.map(k => [k, null])),
  mcp:     { connected: false, checkedAt: null },
  location: (() => {
    try { return JSON.parse(localStorage.getItem('dashboard-location')) } catch { return null }
  })() ?? { name: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 },
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: { ...state.loading, [action.card]: true }, errors: { ...state.errors, [action.card]: null } }
    case 'LOAD_OK':
      return {
        ...state,
        data:     { ...state.data,     [action.card]: action.payload },
        loading:  { ...state.loading,  [action.card]: false },
        errors:   { ...state.errors,   [action.card]: null },
        syncedAt: { ...state.syncedAt, [action.card]: new Date() },
      }
    case 'LOAD_ERR':
      return { ...state, loading: { ...state.loading, [action.card]: false }, errors: { ...state.errors, [action.card]: action.error } }
    case 'MCP_STATUS':
      return { ...state, mcp: { connected: action.connected, checkedAt: new Date() } }
    case 'SET_LOCATION':
      return { ...state, location: action.location }
    default:
      return state
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const pollRef = useRef(null)
  const errRef  = useRef(initialState.errors)
  errRef.current = state.errors

  // ── Individual fetch functions ────────────────────────────────────────────

  const fetchWeather = useCallback(async (loc) => {
    const location = loc ?? state.location
    dispatch({ type: 'LOAD_START', card: 'weather' })
    try {
      const r = await fetch(`/api/weather?location=${encodeURIComponent(location.name)}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      if (raw.error) throw new Error(raw.error)
      dispatch({ type: 'LOAD_OK', card: 'weather', payload: parseWeather(raw) })
    } catch (e) {
      dispatch({ type: 'LOAD_ERR', card: 'weather', error: e.message })
    }
  }, [state.location])

  const fetchCalendar = useCallback(async () => {
    dispatch({ type: 'LOAD_START', card: 'calendar' })
    try {
      const r = await fetch('/api/calendar?daysAhead=1&maxResults=15')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      dispatch({ type: 'LOAD_OK', card: 'calendar', payload: parseCalendar(raw) })
    } catch (e) {
      dispatch({ type: 'LOAD_ERR', card: 'calendar', error: e.message })
    }
  }, [])

  const fetchStocks = useCallback(async () => {
    dispatch({ type: 'LOAD_START', card: 'stocks' })
    try {
      const r = await fetch('/api/stocks')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      dispatch({ type: 'LOAD_OK', card: 'stocks', payload: parseStocks(raw) })
    } catch (e) {
      dispatch({ type: 'LOAD_ERR', card: 'stocks', error: e.message })
    }
  }, [])

  const fetchCelebrations = useCallback(async () => {
    dispatch({ type: 'LOAD_START', card: 'celebrations' })
    try {
      const r = await fetch('/api/celebrations')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      dispatch({ type: 'LOAD_OK', card: 'celebrations', payload: parseCelebrations(raw) })
    } catch (e) {
      dispatch({ type: 'LOAD_ERR', card: 'celebrations', error: e.message })
    }
  }, [])

  const fetchIndMoney = useCallback(async () => {
    dispatch({ type: 'LOAD_START', card: 'indmoney' })
    try {
      const r = await fetch('/api/indmoney/overview')
      if (r.status === 401) {
        dispatch({ type: 'LOAD_OK', card: 'indmoney', payload: { authRequired: true } })
        return
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      dispatch({ type: 'LOAD_OK', card: 'indmoney', payload: parseIndMoney(raw) })
    } catch (e) {
      dispatch({ type: 'LOAD_ERR', card: 'indmoney', error: e.message })
    }
  }, [])

  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/status', { signal: AbortSignal.timeout(4000) })
      const d = await r.json()
      dispatch({ type: 'MCP_STATUS', connected: d.connected ?? r.ok })
    } catch {
      dispatch({ type: 'MCP_STATUS', connected: false })
    }
  }, [])

  // ── Bulk refresh ──────────────────────────────────────────────────────────

  const refreshAll = useCallback(() => {
    return Promise.allSettled([
      fetchWeather(), fetchCalendar(), fetchStocks(),
      fetchCelebrations(), fetchIndMoney(),
    ])
  }, [fetchWeather, fetchCalendar, fetchStocks, fetchCelebrations, fetchIndMoney])

  const refreshCard = useCallback((card) => {
    const map = { weather: fetchWeather, calendar: fetchCalendar, stocks: fetchStocks, celebrations: fetchCelebrations, indmoney: fetchIndMoney }
    map[card]?.()
  }, [fetchWeather, fetchCalendar, fetchStocks, fetchCelebrations, fetchIndMoney])

  // ── Set location + re-fetch weather ──────────────────────────────────────

  const setLocation = useCallback((location) => {
    localStorage.setItem('dashboard-location', JSON.stringify(location))
    dispatch({ type: 'SET_LOCATION', location })
    fetchWeather(location)
  }, [fetchWeather])

  // ── Polling — retry errored cards every 10 s, status every 10 s ──────────

  useEffect(() => {
    checkStatus()
    refreshAll()

    pollRef.current = setInterval(async () => {
      const wasConnected = state.mcp.connected
      await checkStatus()

      // If gateway just came online, refresh everything
      if (!wasConnected && state.mcp.connected) {
        refreshAll()
        return
      }

      // Retry only errored cards
      const toRetry = CARDS.filter(k => errRef.current[k])
      toRetry.forEach(k => refreshCard(k))
    }, 10_000)

    return () => clearInterval(pollRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Page visibility — pause polling when hidden ───────────────────────────

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(pollRef.current)
      } else {
        checkStatus()
        const toRetry = CARDS.filter(k => errRef.current[k])
        if (toRetry.length) toRetry.forEach(k => refreshCard(k))
        pollRef.current = setInterval(async () => {
          await checkStatus()
          CARDS.filter(k => errRef.current[k]).forEach(k => refreshCard(k))
        }, 10_000)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [checkStatus, refreshCard])

  return { state, actions: { refreshAll, refreshCard, setLocation, fetchWeather }, syncedAt: state.syncedAt }
}
