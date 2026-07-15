import { useReducer, useEffect, useRef, useCallback } from 'react'
import {
  parseWeather, parseCalendar, parseStocks,
  parseCelebrations, parseIndMoney,
} from '../utils/parsers.js'

// ── State shape ───────────────────────────────────────────────────────────────

const CARDS = ['weather', 'calendar', 'stocks', 'indices', 'celebrations', 'indmoney', 'gmail']

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

// Backoff for persistently-failing cards so they don't hammer the gateway.
// attempt 1-3 → retry on the next 10 s poll tick (no added delay)
// attempt 4-8 → wait 60 s before next retry
// attempt 9+  → wait 5 min before next retry
function _backoffMs(attempt) {
  if (attempt <= 3) return 0
  if (attempt <= 8) return 60_000
  return 300_000
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Interval handles — stored in refs so the visibility handler can clear both
  const pollRef            = useRef(null)
  const indicesIntervalRef = useRef(null)

  // Per-card AbortController: lets us cancel a previous in-flight fetch before
  // starting a new one, and enforces a 20 s hard timeout on every request.
  const abortRefs = useRef({})

  // Retry backoff — tracked outside React state so reads inside setInterval
  // callbacks are always fresh without needing the callbacks to be recreated.
  const retryAttemptsRef = useRef(Object.fromEntries(CARDS.map(k => [k, 0])))
  const retryNextRef     = useRef(Object.fromEntries(CARDS.map(k => [k, 0])))

  // Keep errors readable inside setInterval without stale closure
  const errRef = useRef(initialState.errors)
  errRef.current = state.errors

  // Keep location readable without making fetchWeather depend on state.location,
  // which would force refreshAll/refreshCard to be recreated on every location change.
  const locationRef = useRef(state.location)
  locationRef.current = state.location

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  // Cancel any in-flight request for `card` and return a new AbortSignal.
  // The signal also self-aborts after 20 s so hung requests never accumulate.
  const _signal = useCallback((card) => {
    abortRefs.current[card]?.abort()
    const ctrl  = new AbortController()
    abortRefs.current[card] = ctrl
    const timer = setTimeout(() => ctrl.abort(), 20_000)
    ctrl.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
    return ctrl.signal
  }, [])

  const _onOk = useCallback((card) => {
    retryAttemptsRef.current[card] = 0
    retryNextRef.current[card]     = 0
  }, [])

  const _onErr = useCallback((card) => {
    const a = ++retryAttemptsRef.current[card]
    retryNextRef.current[card] = Date.now() + _backoffMs(a)
  }, [])

  // ── Individual fetch functions ────────────────────────────────────────────

  const fetchWeather = useCallback(async (loc) => {
    const location = loc ?? locationRef.current
    const signal   = _signal('weather')
    dispatch({ type: 'LOAD_START', card: 'weather' })
    try {
      const r = await fetch(`/api/weather?location=${encodeURIComponent(location.name)}`, { signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      if (raw.error) throw new Error(raw.error)
      dispatch({ type: 'LOAD_OK', card: 'weather', payload: parseWeather(raw) })
      _onOk('weather')
    } catch (e) {
      if (e.name === 'AbortError') return
      dispatch({ type: 'LOAD_ERR', card: 'weather', error: e.message })
      _onErr('weather')
    }
  }, [_signal, _onOk, _onErr])

  const fetchCalendar = useCallback(async () => {
    const signal = _signal('calendar')
    dispatch({ type: 'LOAD_START', card: 'calendar' })
    try {
      const r = await fetch('/api/calendar?daysAhead=1&maxResults=15', { signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      dispatch({ type: 'LOAD_OK', card: 'calendar', payload: parseCalendar(raw) })
      _onOk('calendar')
    } catch (e) {
      if (e.name === 'AbortError') return
      dispatch({ type: 'LOAD_ERR', card: 'calendar', error: e.message })
      _onErr('calendar')
    }
  }, [_signal, _onOk, _onErr])

  const fetchStocks = useCallback(async () => {
    const signal = _signal('stocks')
    dispatch({ type: 'LOAD_START', card: 'stocks' })
    try {
      const r = await fetch('/api/stocks', { signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      dispatch({ type: 'LOAD_OK', card: 'stocks', payload: parseStocks(raw) })
      _onOk('stocks')
    } catch (e) {
      if (e.name === 'AbortError') return
      dispatch({ type: 'LOAD_ERR', card: 'stocks', error: e.message })
      _onErr('stocks')
    }
  }, [_signal, _onOk, _onErr])

  const fetchCelebrations = useCallback(async () => {
    const signal = _signal('celebrations')
    dispatch({ type: 'LOAD_START', card: 'celebrations' })
    try {
      const r = await fetch('/api/celebrations', { signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      dispatch({ type: 'LOAD_OK', card: 'celebrations', payload: parseCelebrations(raw) })
      _onOk('celebrations')
    } catch (e) {
      if (e.name === 'AbortError') return
      dispatch({ type: 'LOAD_ERR', card: 'celebrations', error: e.message })
      _onErr('celebrations')
    }
  }, [_signal, _onOk, _onErr])

  const fetchIndMoney = useCallback(async () => {
    const signal = _signal('indmoney')
    dispatch({ type: 'LOAD_START', card: 'indmoney' })
    try {
      const r = await fetch('/api/indmoney/overview', { signal })
      if (r.status === 401) {
        dispatch({ type: 'LOAD_OK', card: 'indmoney', payload: { authRequired: true } })
        _onOk('indmoney')
        return
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      dispatch({ type: 'LOAD_OK', card: 'indmoney', payload: parseIndMoney(raw) })
      _onOk('indmoney')
    } catch (e) {
      if (e.name === 'AbortError') return
      dispatch({ type: 'LOAD_ERR', card: 'indmoney', error: e.message })
      _onErr('indmoney')
    }
  }, [_signal, _onOk, _onErr])

  const fetchGmail = useCallback(async () => {
    const signal = _signal('gmail')
    dispatch({ type: 'LOAD_START', card: 'gmail' })
    try {
      const r = await fetch('/api/gmail?page=1&pageSize=5', { signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      dispatch({ type: 'LOAD_OK', card: 'gmail', payload: raw })
      _onOk('gmail')
    } catch (e) {
      if (e.name === 'AbortError') return
      dispatch({ type: 'LOAD_ERR', card: 'gmail', error: e.message })
      _onErr('gmail')
    }
  }, [_signal, _onOk, _onErr])

  const fetchIndices = useCallback(async () => {
    const signal = _signal('indices')
    dispatch({ type: 'LOAD_START', card: 'indices' })
    try {
      const r = await fetch('/api/indices', { signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const raw = await r.json()
      dispatch({ type: 'LOAD_OK', card: 'indices', payload: raw })
      _onOk('indices')
    } catch (e) {
      if (e.name === 'AbortError') return
      dispatch({ type: 'LOAD_ERR', card: 'indices', error: e.message })
      _onErr('indices')
    }
  }, [_signal, _onOk, _onErr])

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
      fetchIndices(), fetchCelebrations(), fetchIndMoney(), fetchGmail(),
    ])
  }, [fetchWeather, fetchCalendar, fetchStocks, fetchIndices, fetchCelebrations, fetchIndMoney, fetchGmail])

  const refreshCard = useCallback((card) => {
    const map = {
      weather:      fetchWeather,
      calendar:     fetchCalendar,
      stocks:       fetchStocks,
      indices:      fetchIndices,
      celebrations: fetchCelebrations,
      indmoney:     fetchIndMoney,
      gmail:        fetchGmail,
    }
    map[card]?.()
  }, [fetchWeather, fetchCalendar, fetchStocks, fetchIndices, fetchCelebrations, fetchIndMoney, fetchGmail])

  // ── Set location + re-fetch weather ──────────────────────────────────────

  const setLocation = useCallback((location) => {
    localStorage.setItem('dashboard-location', JSON.stringify(location))
    dispatch({ type: 'SET_LOCATION', location })
    fetchWeather(location)
  }, [fetchWeather])

  // ── Polling ───────────────────────────────────────────────────────────────
  // • 10 s tick: check gateway status; retry only errored cards that have
  //   passed their backoff window (exponential: 10 s → 60 s → 5 min).
  // • Separate 5-min interval for market indices (less time-sensitive).
  // • Both intervals are stored in refs so the visibility handler can
  //   pause them when the tab is hidden and restart them on focus.
  // • On unmount, all intervals are cleared and every in-flight request
  //   is aborted to prevent state updates on an unmounted component.

  useEffect(() => {
    checkStatus()
    refreshAll()

    pollRef.current = setInterval(async () => {
      await checkStatus()
      const now = Date.now()
      CARDS
        .filter(k => errRef.current[k] && retryNextRef.current[k] <= now)
        .forEach(k => refreshCard(k))
    }, 10_000)

    indicesIntervalRef.current = setInterval(() => fetchIndices(), 5 * 60 * 1000)

    return () => {
      clearInterval(pollRef.current)
      clearInterval(indicesIntervalRef.current)
      // Abort every in-flight request so their callbacks never fire after unmount
      Object.values(abortRefs.current).forEach(ctrl => ctrl?.abort())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Page visibility — pause all polling when tab is hidden ───────────────

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        // Stop all background activity while the tab is invisible;
        // also abort in-flight requests — they would just queue up.
        clearInterval(pollRef.current)
        clearInterval(indicesIntervalRef.current)
        Object.values(abortRefs.current).forEach(ctrl => ctrl?.abort())
      } else {
        // Tab regained focus: immediately refresh errored cards, then
        // restart both intervals from scratch to avoid double-firing.
        checkStatus()
        const now = Date.now()
        CARDS
          .filter(k => errRef.current[k] && retryNextRef.current[k] <= now)
          .forEach(k => refreshCard(k))

        pollRef.current = setInterval(async () => {
          await checkStatus()
          const n = Date.now()
          CARDS
            .filter(k => errRef.current[k] && retryNextRef.current[k] <= n)
            .forEach(k => refreshCard(k))
        }, 10_000)

        indicesIntervalRef.current = setInterval(() => fetchIndices(), 5 * 60 * 1000)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [checkStatus, refreshCard, fetchIndices])

  return { state, actions: { refreshAll, refreshCard, setLocation, fetchWeather }, syncedAt: state.syncedAt }
}
