import React from 'react'
import { PONTOS_PARA_VENCER } from '../lib/truco'
import './Scoreboard.css'

export default function Scoreboard({ gameState, myTeam }) {
  if (!gameState) return null
  const { scores, maoValue, maoIsOnze } = gameState
  return (
    <div className="scoreboard">
      <ScoreSide label="Nós" value={scores[myTeam]} highlight />
      <div className="scoreboard-mid">
        <span className="mao-value">{maoValue}</span>
        <span className="mao-value-label">na mão</span>
        {maoIsOnze && <span className="onze-tag">Mão de 11</span>}
      </div>
      <ScoreSide label="Eles" value={scores[myTeam === 'A' ? 'B' : 'A']} />
      <div className="scoreboard-goal">de {PONTOS_PARA_VENCER}</div>
    </div>
  )
}

function ScoreSide({ label, value, highlight }) {
  return (
    <div className={`score-side ${highlight ? 'score-side-mine' : ''}`}>
      <span className="score-value">{value}</span>
      <span className="score-label">{label}</span>
    </div>
  )
}
