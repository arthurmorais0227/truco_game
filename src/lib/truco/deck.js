import { SUITS, RANKS } from './constants'

/** Cria o baralho de 40 cartas (sem 8, 9, 10 e sem coringa). */
export function createDeck() {
  const deck = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, id: `${rank}-${suit}` })
    }
  }
  return deck
}

/** Fisher-Yates shuffle (não muta o array original). */
export function shuffle(deck) {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Dado o naipe/valor da vira, descobre qual rank é manilha. */
export function getManilhaRank(viraRank) {
  const i = RANKS.indexOf(viraRank)
  return RANKS[(i + 1) % RANKS.length]
}

/**
 * Força de uma carta nesta mão.
 * Manilhas (mesmo rank da manilha) valem 100 + força do naipe.
 * Cartas comuns valem o índice do rank na ordem do truco (naipe não importa).
 */
export function cardStrength(card, manilhaRank) {
  if (card.rank === manilhaRank) {
    return 100 + SUITS.indexOf(card.suit)
  }
  return RANKS.indexOf(card.rank)
}

export function isManilha(card, manilhaRank) {
  return card.rank === manilhaRank
}

/**
 * Distribui 12 cartas (3 por jogador, 4 jogadores) e revela a vira.
 * dealerSeat: assento (0-3) de quem é o "carteador" desta mão.
 * A distribuição começa no jogador à esquerda do carteador.
 */
export function dealNewHand(dealerSeat) {
  const deck = shuffle(createDeck())
  const hands = [[], [], [], []]
  let idx = 0
  const start = (dealerSeat + 1) % 4
  for (let lap = 0; lap < 3; lap++) {
    for (let s = 0; s < 4; s++) {
      const seat = (start + s) % 4
      hands[seat].push(deck[idx++])
    }
  }
  const vira = deck[idx]
  const manilhaRank = getManilhaRank(vira.rank)
  return { hands, vira, manilhaRank }
}
