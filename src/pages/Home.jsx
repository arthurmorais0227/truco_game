import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateRoomCode } from '../lib/truco'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  const [name, setName] = useState(() => localStorage.getItem('truco_name') || '')
  const [joinCode, setJoinCode] = useState('')

  function saveName(v) {
    setName(v)
    localStorage.setItem('truco_name', v)
  }

  function handleCreate() {
    if (!name.trim()) return
    const code = generateRoomCode()
    navigate(`/sala/${code}`, { state: { name: name.trim(), intent: 'create' } })
  }

  function handleJoin(e) {
    e.preventDefault()
    if (!name.trim() || !joinCode.trim()) return
    navigate(`/sala/${joinCode.trim().toUpperCase()}`, { state: { name: name.trim(), intent: 'join' } })
  }

  return (
    <div className="home">
      <div className="home-felt" />
      <div className="home-card">
        <div className="home-eyebrow">Truco Paulista · 2 duplas, 12 pontos</div>
        <h1>
          Zap, copeta,
          <br />
          espadilha e mole.
        </h1>
        <p className="home-sub">Crie uma mesa ou entre com o código que sua dupla te mandou.</p>

        <div className="field">
          <label htmlFor="name">Seu nome</label>
          <input
            id="name"
            value={name}
            onChange={(e) => saveName(e.target.value)}
            placeholder="Como vamos te chamar na mesa"
            maxLength={20}
          />
        </div>

        <button className="btn btn-primary home-create" onClick={handleCreate} disabled={!name.trim()}>
          Criar sala
        </button>

        <div className="home-divider">
          <span>ou</span>
        </div>

        <form onSubmit={handleJoin} className="home-join">
          <div className="field">
            <label htmlFor="code">Código da sala</label>
            <input
              id="code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="EX: 7K2QM"
              maxLength={6}
              className="code-input"
            />
          </div>
          <button className="btn btn-ghost" type="submit" disabled={!name.trim() || !joinCode.trim()}>
            Entrar na sala
          </button>
        </form>
      </div>
    </div>
  )
}
