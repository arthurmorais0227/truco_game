import React from 'react'
import Card from './Card.jsx'

export default function PlayerHand({ cards, manilhaRank, canPlay, ferroHidden, onPlay }) {
  return (
    <div className="my-hand">
      {cards.map((card) => (
        <Card
          key={card.id}
          card={card}
          faceDown={ferroHidden}
          manilha={!ferroHidden && card.rank === manilhaRank}
          size="lg"
          disabled={!canPlay}
          onClick={() => canPlay && onPlay(card)}
        />
      ))}
      {cards.length === 0 && <div className="my-hand-empty">Sem cartas na mão</div>}
    </div>
  )
}
