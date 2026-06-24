import React, { useMemo, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useTrucoRoom } from '../hooks/useTrucoRoom'
import { supabase } from '../supabaseClient'
import Table from '../components/Table.jsx'
import Scoreboard from '../components/Scoreboard.jsx'
import TrucoBar from '../components/TrucoBar.jsx'
import PlayerHand from '../components/PlayerHand.jsx'
import Chat from '../components/Chat.jsx'
import './Room.css'

export default function Room({ userId }) {
  const { code } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const name = location.state?.name || localStorage.getItem('truco_name') || 'Jogador'
  const intent = location.state?.intent

  const { loading, error, room, players, myHand, me, isHost, chat, actions } = useTrucoRoom({
    code: code.toUpperCase(),
    userId,
    name,
    intent,
  })

  const [copied, setCopied] = useState(false)

  const gameState = room?.game_state

  const mySeat = me?.seat
  const myTeam = me?.team
  const isMyTurn = gameState?.turnSeat === mySeat
  const canPlay = isMyTurn && gameState?.status === 'playing' && !gameState?.trucoState

  // Em vez de confiar só em "myHand" estar sempre perfeitamente em dia (depende de
  // um evento de tempo real chegar a tempo), filtramos aqui as cartas que o
  // próprio game_state já mostra como jogadas pelo meu assento -- nessa rodada
  // atual ou em rodadas anteriores da mesma mão. game_state é a mesma fonte que
  // desenha a mesa pra todo mundo, então essa filtragem nunca fica desincronizada.
  const remainingHand = useMemo(() => {
    if (!gameState) return myHand
    const playedIds = new Set()
    ;(gameState.rounds || []).forEach((round) => {
      (round.plays || []).forEach((p) => {
        if (p.seat === mySeat) playedIds.add(p.card.id)
      })
    })
    ;(gameState.table || []).forEach((p) => {
      if (p.seat === mySeat) playedIds.add(p.card.id)
    })
    return myHand.filter((c) => !playedIds.has(c.id))
  }, [myHand, gameState, mySeat])

  const seatsFilled = useMemo(() => players.length, [players])

  async function handleLeave() {
    if (me && room) {
      await supabase.from('players').delete().eq('id', me.id)
    }
    navigate('/')
  }

  function handleCopyCode() {
    navigator.clipboard?.writeText(code.toUpperCase())
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  if (loading) {
    return (
      <div className="room-loading">
        <p>Entrando na mesa…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="room-loading">
        <p className="error-text">{error}</p>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          Voltar
        </button>
      </div>
    )
  }

  const showLobby = room.status === 'lobby'

  return (
    <div className="room">
      <header className="room-header">
        <div className="room-code-block" onClick={handleCopyCode} title="Clique para copiar">
          <span className="room-code-label">Sala</span>
          <span className="room-code">{room.code}</span>
          {copied && <span className="room-code-copied">copiado!</span>}
        </div>
        <button className="btn btn-ghost room-leave" onClick={handleLeave}>
          Saída
        </button>
      </header>

      {showLobby ? (
        <LobbyView players={players} isHost={isHost} onStart={actions.startGame} seatsFilled={seatsFilled} />
      ) : (
        <GameView
          room={room}
          gameState={gameState}
          players={players}
          mySeat={mySeat}
          myTeam={myTeam}
          myHand={remainingHand}
          canPlay={canPlay}
          isHost={isHost}
          actions={actions}
          onBackHome={() => navigate('/')}
        />
      )}

      <div className="room-chat">
        <Chat messages={chat} onSend={actions.sendChat} />
      </div>
    </div>
  )
}

function LobbyView({ players, isHost, onStart, seatsFilled }) {
  const slots = [0, 1, 2, 3]
  const bySeat = {}
  players.forEach((p) => (bySeat[p.seat] = p))

  return (
    <div className="lobby">
      <h2>Mesa de espera</h2>
      <p className="lobby-sub">Mande o código da sala pra mais 3 pessoas. Assentos pares são a Dupla A, ímpares são a Dupla B.</p>

      <div className="lobby-seats">
        {slots.map((seat) => {
          const p = bySeat[seat]
          return (
            <div key={seat} className={`lobby-seat ${p ? 'filled' : 'empty'} team-${seat % 2 === 0 ? 'A' : 'B'}`}>
              <span className="lobby-seat-team">Dupla {seat % 2 === 0 ? 'A' : 'B'}</span>
              <span className="lobby-seat-name">{p ? p.name : 'aguardando…'}</span>
            </div>
          )
        })}
      </div>

      {isHost ? (
        <button className="btn btn-primary" onClick={onStart} disabled={seatsFilled < 4}>
          {seatsFilled < 4 ? `Aguardando jogadores (${seatsFilled}/4)` : 'Iniciar partida'}
        </button>
      ) : (
        <p className="lobby-waiting">Aguardando o anfitrião iniciar a partida…</p>
      )}
    </div>
  )
}

function GameView({ room, gameState, players, mySeat, myTeam, myHand, canPlay, isHost, actions, onBackHome }) {
  if (!gameState) return null

  if (gameState.status === 'finished' || room.status === 'finished') {
    return (
      <div className="match-end">
        <h2>{gameState.matchWinner === myTeam ? 'Vitória da sua dupla! 🎉' : 'A outra dupla venceu a partida.'}</h2>
        <p>
          Placar final — Dupla A: {gameState.scores.A} · Dupla B: {gameState.scores.B}
        </p>
        <button className="btn btn-primary" onClick={onBackHome}>
          Voltar ao início
        </button>
      </div>
    )
  }

  return (
    <div className="game-view">
      <Scoreboard gameState={gameState} myTeam={myTeam} />

      {gameState.status === 'mao_ended' && gameState.lastMaoResult && (
        <div className="mao-result-banner">
          {gameState.lastMaoResult.winner
            ? `Dupla ${gameState.lastMaoResult.winner} venceu a mão (+${gameState.lastMaoResult.value} ponto${gameState.lastMaoResult.value > 1 ? 's' : ''})`
            : 'Mão empatada — sem pontos'}
          <br />
          {isHost ? (
            <button className="btn btn-primary btn-small" onClick={actions.startGame}>
              Iniciar próximo ponto
            </button>
          ) : (
            <span className="mao-result-sub">Aguardando o anfitrião iniciar o próximo ponto…</span>
          )}
        </div>
      )}

      <Table players={players} mySeat={mySeat} gameState={gameState} isMyTurn={gameState.turnSeat === mySeat} />

      <TrucoBar
        gameState={gameState}
        mySeat={mySeat}
        myTeam={myTeam}
        onCallTruco={() => actions.callTruco(myTeam)}
        onRespond={(response) => actions.respondTruco(myTeam, response)}
      />

      <PlayerHand
        cards={myHand}
        manilhaRank={gameState.manilhaRank}
        canPlay={canPlay}
        ferroHidden={gameState.ferro}
        onPlay={(card) => actions.playCard(mySeat, card)}
      />

      <details className="game-log">
        <summary>Histórico da rodada</summary>
        <ul>
          {(gameState.log || [])
            .slice()
            .reverse()
            .map((line, i) => (
              <li key={i}>{line}</li>
            ))}
        </ul>
      </details>
    </div>
  )
}