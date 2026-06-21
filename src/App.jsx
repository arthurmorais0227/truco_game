import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAnonAuth } from './hooks/useAnonAuth'
import Home from './pages/Home.jsx'
import Room from './pages/Room.jsx'
import './App.css'

export default function App() {
  const { userId, ready, error } = useAnonAuth()

  if (!ready) {
    return (
      <div className="splash">
        <div className="splash-card">
          <h1>Truco Paulista</h1>
          <p>Abrindo a mesa…</p>
        </div>
      </div>
    )
  }

  if (error || !userId) {
    return (
      <div className="splash">
        <div className="splash-card">
          <h1>Truco Paulista</h1>
          <p className="error-text">
            Não consegui abrir uma sessão anônima no Supabase.
            <br />
            Confira se <strong>Anonymous Sign-Ins</strong> está habilitado em
            Authentication → Providers, e se as variáveis <code>VITE_SUPABASE_URL</code> /{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> estão no seu <code>.env</code>.
          </p>
          {error && <p className="error-detail">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home userId={userId} />} />
        <Route path="/sala/:code" element={<Room userId={userId} />} />
      </Routes>
    </BrowserRouter>
  )
}
