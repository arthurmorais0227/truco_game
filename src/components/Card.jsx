import React from 'react'
import { SUIT_SYMBOL } from '../lib/truco'
import './Card.css'

const RED_SUITS = new Set(['copa', 'ouro'])

export default function Card({ card, faceDown = false, manilha = false, size = 'md', onClick, selected = false, disabled = false }) {
  if (faceDown || !card) {
    return (
      <div className={`card card-${size} card-back ${disabled ? 'card-disabled' : ''}`} onClick={!disabled ? onClick : undefined}>
        <div className="card-back-pattern" />
      </div>
    )
  }

  const red = RED_SUITS.has(card.suit)
  return (
    <button
      type="button"
      className={`card card-${size} ${red ? 'card-red' : 'card-black'} ${manilha ? 'card-manilha' : ''} ${selected ? 'card-selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {manilha && <span className="card-manilha-tag">manilha</span>}
      <span className="card-corner card-corner-top">
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="card-center">{SUIT_SYMBOL[card.suit]}</span>
      <span className="card-corner card-corner-bottom">
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
    </button>
  )
}
