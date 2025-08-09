import { useState, useEffect } from 'react'

const HIDDEN_SESSIONS_KEY = 'claude_hidden_sessions'

export function useHiddenSessions() {
  const [hiddenSessions, setHiddenSessions] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(HIDDEN_SESSIONS_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  })

  useEffect(() => {
    localStorage.setItem(HIDDEN_SESSIONS_KEY, JSON.stringify(Array.from(hiddenSessions)))
  }, [hiddenSessions])

  const hideSession = (sessionId: string) => {
    setHiddenSessions(prev => new Set(prev).add(sessionId))
  }

  const unhideSession = (sessionId: string) => {
    setHiddenSessions(prev => {
      const newSet = new Set(prev)
      newSet.delete(sessionId)
      return newSet
    })
  }

  const isHidden = (sessionId: string) => hiddenSessions.has(sessionId)
  
  const clearHidden = () => {
    setHiddenSessions(new Set())
  }

  return {
    hiddenSessions,
    hideSession,
    unhideSession,
    isHidden,
    hiddenCount: hiddenSessions.size,
    clearHidden
  }
}