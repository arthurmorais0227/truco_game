import { LADDER, LADDER_CALL_LABEL } from './constants'

export function nextLadderValue(current) {
  const i = LADDER.indexOf(current)
  if (i === -1 || i === LADDER.length - 1) return null
  return LADDER[i + 1]
}

export function ladderLabel(value) {
  return LADDER_CALL_LABEL[value] || 'Truco'
}

export function isMaoDeOnze(scores, team) {
  return scores[team] === 11
}

export function isMaoDeFerro(scores) {
  return scores.A === 11 && scores.B === 11
}

/** Valor inicial da mão: 1 ponto, ou 3 se alguma dupla está na mão de 11. */
export function initialMaoValue(scores) {
  return scores.A === 11 || scores.B === 11 ? 3 : 1
}
