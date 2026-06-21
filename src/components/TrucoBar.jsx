import React from 'react'
import { ladderLabel, nextLadderValue } from '../lib/truco'
import './TrucoBar.css'

export default function TrucoBar({ gameState, mySeat, myTeam, onCallTruco, onRespond }) {
  if (!gameState || gameState.status !== 'playing') return null

  const { trucoState, turnSeat, maoValue, maoIsOnze } = gameState
  const otherTeam = myTeam === 'A' ? 'B' : 'A'

  if (trucoState) {
    if (trucoState.awaitingTeam !== myTeam) {
      return (
        <div className="truco-bar truco-bar-waiting">
          Aguardando a dupla {trucoState.awaitingTeam} responder o pedido de {ladderLabel(trucoState.proposedValue)}…
        </div>
      )
    }
    const canRaise = !!nextLadderValue(trucoState.proposedValue)
    return (
      <div className="truco-bar">
        <span className="truco-bar-prompt">
          Dupla {trucoState.requestedByTeam} pediu <strong>{ladderLabel(trucoState.proposedValue)}</strong>. O que vocês fazem?
        </span>
        <div className="truco-bar-actions">
          <button className="btn btn-primary" onClick={() => onRespond('accept')}>
            Aceitar
          </button>
          <button className="btn btn-danger" onClick={() => onRespond('run')}>
            Correr
          </button>
          {canRaise && (
            <button className="btn btn-ghost" onClick={() => onRespond('raise')}>
              Pedir {ladderLabel(nextLadderValue(trucoState.proposedValue))}
            </button>
          )}
        </div>
      </div>
    )
  }

  const isMyTurn = turnSeat === mySeat
  const canCall = isMyTurn && maoValue < 12

  if (!canCall) return null

  function handleCall() {
    if (maoIsOnze) {
      const ok = window.confirm(
        `Atenção: a mão já vale 3 pontos (mão de 11). Pedir truco agora dá a vitória da PARTIDA inteira pra dupla ${otherTeam} se vocês pedirem. Quer mesmo pedir?`
      )
      if (!ok) return
    }
    onCallTruco()
  }

  return (
    <div className="truco-bar truco-bar-call">
      <button className="btn btn-primary" onClick={handleCall}>
        {maoValue === 1 ? 'Pedir truco' : `Pedir ${ladderLabel(nextLadderValue(maoValue))}`}
      </button>
    </div>
  )
}
