import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Lock no nível do modulo: garante que so existe UMA chamada de signInAnonymously()
// em voo por aba, mesmo se o efeito rodar duas vezes (ex: React.StrictMode em dev).
let signInPromise = null

function ensureAnonSession() {
  if (!signInPromise) {
    signInPromise = (async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session?.user) return sessionData.session

      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) {
        signInPromise = null // permite tentar de novo numa proxima chamada
        throw error
      }
      return data.session
    })()
  }
  return signInPromise
}

/**
 * Garante que o navegador tem uma sessao anonima do Supabase.
 * Isso da um auth.uid() estavel (sem precisar de login/senha) que
 * usamos pras politicas de RLS (ex: so o dono le a propria mao).
 *
 * IMPORTANTE: precisa estar habilitado no painel do Supabase em
 * Authentication > Providers > Anonymous Sign-Ins.
 */
export function useAnonAuth() {
  const [userId, setUserId] = useState(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    ensureAnonSession()
      .then((session) => {
        if (active) {
          setUserId(session?.user?.id ?? null)
          setReady(true)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message)
          setReady(true)
        }
      })

    // Fonte unica de verdade: sempre reflete a sessao REAL que o supabase-js
    // esta usando pra assinar as requisicoes (evita qualquer descompasso
    // entre o id guardado no estado do React e o auth.uid() do banco).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user?.id ?? null)
    })

    return () => {
      active = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  return { userId, ready, error }
}
