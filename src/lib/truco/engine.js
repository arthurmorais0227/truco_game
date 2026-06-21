import { dealNewHand } from './deck'
import { resolveRound, evaluateMao, teamOfSeat, otherTeam } from './rounds'
import { nextLadderValue, isMaoDeFerro, initialMaoValue } from './ladder'
import { PONTOS_PARA_VENCER } from './constants'

export function freshScores() {
  return { A: 0, B: 0 }
}

export function emptyPublicState(dealerSeat = 0) {
  return {
    status: 'lobby', // lobby | playing | mao_ended | finished
    dealerSeat,
    turnSeat: null,
    leaderSeat: null,
    vira: null,
    manilhaRank: null,
    scores: freshScores(),
    maoValue: 1,
    maoIsOnze: false,
    ferro: false,
    rounds: [], // [{ plays:[{seat,card}], result:'A'|'B'|'tie' }]
    table: [], // plays da rodada em andamento
    trucoState: null, // { requestedByTeam, proposedValue, awaitingTeam }
    lastMaoResult: null, // { winner, value, reason } pra mostrar na UI antes da próxima mão
    matchWinner: null,
    log: [],
  }
}

function pushLog(state, text) {
  const log = [...state.log, text].slice(-30)
  return { ...state, log }
}

/** Inicia uma nova mão: embaralha, distribui e revela a vira. Retorna { publicState, hands }. */
export function startNewMao(prevState) {
  const dealerSeat = prevState.status === 'lobby' ? prevState.dealerSeat : (prevState.dealerSeat + 1) % 4
  const { hands, vira, manilhaRank } = dealNewHand(dealerSeat)
  const scores = prevState.scores
  const maoIsOnze = scores.A === 11 || scores.B === 11

  const state = {
    ...emptyPublicState(dealerSeat),
    scores,
    status: 'playing',
    dealerSeat,
    turnSeat: (dealerSeat + 1) % 4,
    leaderSeat: (dealerSeat + 1) % 4,
    vira,
    manilhaRank,
    maoValue: initialMaoValue(scores),
    maoIsOnze,
    ferro: isMaoDeFerro(scores),
    log: prevState.log,
  }

  return { publicState: pushLog(state, 'Cartas distribuídas. Vira: ' + vira.rank + ' de ' + vira.suit + '.'), hands }
}

/** Jogador joga uma carta. hands = { [seat]: [cards] } mantido em memória pelo host. */
export function applyPlayCard(state, hands, seat, card) {
  if (state.status !== 'playing') return { error: 'A mão não está em andamento.' }
  if (state.trucoState) return { error: 'Aguardando resposta do truco.' }
  if (state.turnSeat !== seat) return { error: 'Não é a vez deste jogador.' }

  const hand = hands[seat] || []
  const idx = hand.findIndex((c) => c.id === card.id)
  if (idx === -1) return { error: 'Carta não está na mão do jogador.' }

  const newHands = { ...hands, [seat]: hand.filter((_, i) => i !== idx) }
  const table = [...state.table, { seat, card }]

  if (table.length < 4) {
    const nextSeat = (seat + 1) % 4
    return { publicState: { ...state, table, turnSeat: nextSeat }, hands: newHands }
  }

  // rodada completa: resolve
  const result = resolveRound(table, state.manilhaRank)
  const roundRecord = { plays: table, result: result.tie ? 'tie' : result.winnerTeam }
  const rounds = [...state.rounds, roundRecord]
  const roundResults = rounds.map((r) => r.result)
  const outcome = evaluateMao(roundResults)

  let nextState = { ...state, table: [], rounds }

  if (outcome.decided) {
    nextState = finishMao(nextState, outcome.winner, outcome.allTied)
  } else {
    // próxima rodada: quem venceu lidera; em empate, o líder atual repete
    const nextLeader = result.tie ? state.leaderSeat : result.winnerSeat
    nextState = { ...nextState, leaderSeat: nextLeader, turnSeat: nextLeader }
  }

  return { publicState: nextState, hands: newHands }
}

function finishMao(state, winnerTeam, allTied) {
  if (allTied || !winnerTeam) {
    return pushLog({ ...state, status: 'mao_ended', lastMaoResult: { winner: null, value: 0, reason: 'Todas as rodadas empataram. Ninguém pontua.' } }, 'Mão empatada — sem pontos.')
  }
  const scores = { ...state.scores, [winnerTeam]: state.scores[winnerTeam] + state.maoValue }
  const matchWinner = checkMatchWinner(scores)
  const text = `Dupla ${winnerTeam} venceu a mão e ganhou ${state.maoValue} ponto(s).`
  let next = { ...state, scores, status: matchWinner ? 'finished' : 'mao_ended', matchWinner, lastMaoResult: { winner: winnerTeam, value: state.maoValue } }
  return pushLog(next, matchWinner ? text + ` Dupla ${matchWinner} venceu a partida!` : text)
}

export function checkMatchWinner(scores) {
  if (scores.A >= PONTOS_PARA_VENCER) return 'A'
  if (scores.B >= PONTOS_PARA_VENCER) return 'B'
  return null
}

/** Uma dupla pede truco/seis/nove/doze. */
export function applyCallTruco(state, callingTeam) {
  if (state.status !== 'playing') return { error: 'Não dá pra pedir truco agora.' }
  if (state.trucoState) return { error: 'Já existe um pedido de truco em aberto.' }
  if (teamOfSeat(state.turnSeat) !== callingTeam) return { error: 'Só quem está na vez pode pedir truco.' }

  // Regra explícita: pedir truco durante a mão de 11 faz a dupla adversária ganhar a partida.
  if (state.maoIsOnze) {
    const winner = otherTeam(callingTeam)
    const next = { ...state, status: 'finished', matchWinner: winner, trucoState: null }
    return { publicState: pushLog(next, `Dupla ${callingTeam} pediu truco na mão de 11 — dupla ${winner} venceu a partida!`) }
  }

  const proposedValue = nextLadderValue(state.maoValue)
  if (!proposedValue) return { error: 'A mão já está no valor máximo (12).' }

  const trucoState = { requestedByTeam: callingTeam, proposedValue, awaitingTeam: otherTeam(callingTeam) }
  const label = proposedValue === 3 ? 'truco' : proposedValue === 6 ? 'seis' : proposedValue === 9 ? 'nove' : 'doze'
  return { publicState: pushLog({ ...state, trucoState }, `Dupla ${callingTeam} pediu ${label} (mão valendo ${proposedValue}).`) }
}

/** Dupla responde a um pedido de truco: 'accept' | 'run' | 'raise'. */
export function applyRespondTruco(state, respondingTeam, response) {
  if (!state.trucoState) return { error: 'Não há truco pendente.' }
  if (state.trucoState.awaitingTeam !== respondingTeam) return { error: 'Não é essa dupla que deve responder.' }

  const { requestedByTeam, proposedValue } = state.trucoState

  if (response === 'accept') {
    const next = { ...state, maoValue: proposedValue, trucoState: null }
    return { publicState: pushLog(next, `Dupla ${respondingTeam} aceitou. Mão valendo ${proposedValue}.`) }
  }

  if (response === 'run') {
    const value = state.maoValue
    const scores = { ...state.scores, [requestedByTeam]: state.scores[requestedByTeam] + value }
    const matchWinner = checkMatchWinner(scores)
    const next = {
      ...state,
      scores,
      status: matchWinner ? 'finished' : 'mao_ended',
      matchWinner,
      trucoState: null,
      lastMaoResult: { winner: requestedByTeam, value },
    }
    return { publicState: pushLog(next, `Dupla ${respondingTeam} correu. Dupla ${requestedByTeam} ganhou ${value} ponto(s).`) }
  }

  if (response === 'raise') {
    const nextValue = nextLadderValue(proposedValue)
    if (!nextValue) return { error: 'Não dá pra pedir mais que doze.' }
    const trucoState = { requestedByTeam: respondingTeam, proposedValue: nextValue, awaitingTeam: requestedByTeam }
    const label = nextValue === 6 ? 'seis' : nextValue === 9 ? 'nove' : 'doze'
    return { publicState: pushLog({ ...state, trucoState }, `Dupla ${respondingTeam} pediu ${label} (mão valendo ${nextValue}).`) }
  }

  return { error: 'Resposta inválida.' }
}
