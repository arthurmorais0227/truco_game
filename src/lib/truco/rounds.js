import { cardStrength } from './deck'

export function teamOfSeat(seat) {
  return seat % 2 === 0 ? 'A' : 'B'
}

export function otherTeam(team) {
  return team === 'A' ? 'B' : 'A'
}

/**
 * Resolve uma rodada (4 jogadas, uma por jogador).
 * plays: [{ seat, card }] (length 4)
 * Retorna { tie:false, winnerSeat, winnerTeam } ou { tie:true }.
 */
export function resolveRound(plays, manilhaRank) {
  let best = null
  let bestStrength = -1
  let topPlays = []

  for (const p of plays) {
    const s = cardStrength(p.card, manilhaRank)
    if (s > bestStrength) {
      bestStrength = s
      best = p
      topPlays = [p]
    } else if (s === bestStrength) {
      topPlays.push(p)
    }
  }

  if (topPlays.length === 1) {
    return { tie: false, winnerSeat: best.seat, winnerTeam: teamOfSeat(best.seat) }
  }

  const teams = new Set(topPlays.map((p) => teamOfSeat(p.seat)))
  if (teams.size === 1) {
    // as cartas mais fortes empatadas são da mesma dupla -> a dupla vence mesmo assim
    const team = [...teams][0]
    return { tie: false, winnerSeat: topPlays[0].seat, winnerTeam: team }
  }

  // cartas mais fortes empatadas pertencem a duplas diferentes -> rodada empatada
  return { tie: true, winnerSeat: null, winnerTeam: null }
}

/**
 * Decide, a cada rodada concluída, se a MÃO já tem um vencedor
 * (pra não precisar jogar a 3ª rodada quando já está decidido).
 *
 * roundResults: array com 'A' | 'B' | 'tie' por rodada já jogada (1 a 3 itens).
 * Retorna:
 *  - { decided:false }                          -> precisa jogar mais uma rodada
 *  - { decided:true, winner:'A'|'B' }            -> dupla venceu a mão
 *  - { decided:true, winner:null, allTied:true } -> 3 rodadas empatadas, ninguém pontua
 */
export function evaluateMao(roundResults) {
  const wins = { A: 0, B: 0 }
  for (const r of roundResults) if (r !== 'tie') wins[r]++

  if (wins.A >= 2) return { decided: true, winner: 'A' }
  if (wins.B >= 2) return { decided: true, winner: 'B' }

  const n = roundResults.length

  if (n === 1) return { decided: false }

  if (n === 2) {
    const [r1, r2] = roundResults
    if (r1 === 'tie' && r2 !== 'tie') return { decided: true, winner: r2 }
    if (r1 !== 'tie' && r2 === 'tie') return { decided: true, winner: r1 }
    return { decided: false }
  }

  // n === 3 (chegou até a última rodada)
  const [r1, , r3] = roundResults
  if (roundResults.every((r) => r === 'tie')) {
    return { decided: true, winner: null, allTied: true }
  }
  if (r3 === 'tie' && r1 !== 'tie') {
    return { decided: true, winner: r1 }
  }
  if (r3 !== 'tie') return { decided: true, winner: r3 }
  return { decided: true, winner: null, allTied: true }
}
