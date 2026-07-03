import { useState, useEffect } from 'react'

export function useClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hours   = now.getHours()
  const greeting =
    hours < 5  ? 'Good Night'    :
    hours < 12 ? 'Good Morning'  :
    hours < 17 ? 'Good Afternoon':
    hours < 21 ? 'Good Evening'  : 'Good Night'

  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const seconds = now.toLocaleTimeString('en-US', { second: '2-digit', hour12: false }).slice(-2)
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return { now, greeting, time, seconds, date }
}
