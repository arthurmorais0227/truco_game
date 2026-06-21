import React from 'react'
import Card from './Card.jsx'
import { SUIT_SYMBOL } from '../lib/truco'
import './Table.css'

const POSITION_CLASS = { 0: 'seat-south', 1: 'seat-east', 2: 'seat-north', 3: 'seat-west' }

export default function Table({ players, mySeat, gameState, isMyTurn }) {
  const bySeat = {}
  players.forEach((p) => (bySeat[p.seat] = p))

  const tableCards = {}
  ;(gameState?.table || []).forEach((play) => {
    tableCards[play.seat] = play.card
  })

  const ferro = !!gameState?.ferro

  return (
    <div className="truco-table">
      <div className="truco-felt">
        {[0, 1, 2, 3].map((seat) => {
          const rel = (seat - mySeat + 4) % 4
          const posClass = POSITION_CLASS[rel]
          const player = bySeat[seat]
          const isTurn = gameState?.turnSeat === seat
          const card = tableCards[seat]
          const isMe = seat === mySeat

          return (
            <div key={seat} className={`seat ${posClass} ${isTurn ? 'seat-active' : ''}`}>
              <div className={`seat-badge team-${player?.team || 'A'}`}>
                <span className="seat-name">{player ? player.name : 'vago'}</span>
                <span className="seat-team">Dupla {player?.team || '-'}</span>
                {!player?.connected && player && <span className="seat-offline">desconectado</span>}
              </div>
              <div className="seat-play">{card ? <Card card={card} size="sm" manilha={card.rank === gameState.manilhaRank} /> : <div className="seat-play-empty" />}</div>
              {isMe && isTurn && <div className="seat-turn-pill">Sua vez</div>}
            </div>
          )
        })}

        <div className="table-center">
          {gameState?.vira && (
            <div className="vira-block">
              <span className="vira-label">Vira</span>
              <Card card={gameState.vira} size="sm" />
              <span className="manilha-label">
                Manilha: <strong>{gameState.manilhaRank}</strong>
              </span>
            </div>
          )}
          {ferro && <div className="ferro-tag">Mão de ferro — jogando no escuro</div>}
        </div>
      </div>
    </div>
  )
}
