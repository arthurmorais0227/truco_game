import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { startNewMao, applyPlayCard, applyCallTruco, applyRespondTruco, emptyPublicState } from '../lib/truco'

const MAO_REVEAL_DELAY_MS = 2600

// Trava por código: garante que só existe UMA tentativa de "criar/achar sala"
// em voo por código, mesmo se o efeito do React rodar duas vezes (StrictMode em dev)
// ou se duas abas tentarem a mesma coisa quase ao mesmo tempo.
const roomSetupLocks = new Map()

async function ensureRoom(code, userId, intent) {
  if (roomSetupLocks.has(code)) return roomSetupLocks.get(code)

  const attempt = (async () => {
    const { data: existing } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle()
    if (existing) return existing

    if (intent !== 'create') {
      throw new Error('Sala não encontrada. Confira o código com quem te convidou.')
    }

    const { data: inserted, error: insertError } = await supabase
      .from('rooms')
      .insert({ code, host_id: userId, status: 'lobby', game_state: emptyPublicState(0) })
      .select('*')
      .single()

    if (!insertError) return inserted

    // 23505 = unique_violation: alguém (ou uma segunda chamada nossa) já criou
    // essa sala com esse código entre o select e o insert. Só usa a que existe.
    if (insertError.code === '23505') {
      const { data: nowExisting } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle()
      if (nowExisting) return nowExisting
    }

    throw new Error('Não foi possível criar a sala: ' + insertError.message)
  })().finally(() => {
    roomSetupLocks.delete(code)
  })

  roomSetupLocks.set(code, attempt)
  return attempt
}

async function ensurePlayer(roomRow, userId, name) {
  for (let attemptNumber = 0; attemptNumber < 4; attemptNumber++) {
    const { data: current } = await supabase.from('players').select('*').eq('room_id', roomRow.id).order('seat')
    const list = current || []

    if (list.some((p) => p.user_id === userId)) return list

    if (list.length >= 4) {
      throw new Error('Essa sala já está com 4 jogadores.')
    }

    const takenSeats = new Set(list.map((p) => p.seat))
    let seat = 0
    while (takenSeats.has(seat)) seat++
    const team = seat % 2 === 0 ? 'A' : 'B'

    const { error: joinError } = await supabase
      .from('players')
      .insert({ room_id: roomRow.id, user_id: userId, name: name || 'Jogador', seat, team })

    if (!joinError) {
      const { data: fresh } = await supabase.from('players').select('*').eq('room_id', roomRow.id).order('seat')
      return fresh || []
    }

    // 23505: ou já entramos numa chamada concorrente (segue o loop e isso será
    // detectado no topo), ou outra pessoa pegou esse assento (tenta o próximo).
    if (joinError.code !== '23505') {
      throw new Error('Não foi possível entrar na sala: ' + joinError.message)
    }
  }

  throw new Error('Não foi possível entrar na sala — tente de novo.')
}

export function useTrucoRoom({ code, userId, name, intent }) {
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [myHand, setMyHand] = useState([])
  const [chat, setChat] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const actionsChannelRef = useRef(null)
  const chatChannelRef = useRef(null)
  const hostHandsRef = useRef({}) // só populado no navegador do host: { [seat]: [cards] }
  const advancingRef = useRef(false) // evita disparar a próxima mão duas vezes

  // refs sempre atualizadas: o listener de broadcast do host é montado uma única vez,
  // então não pode depender de closures de `room`/`players` que ficariam desatualizadas.
  const roomRef = useRef(room)
  const playersRef = useRef(players)
  useEffect(() => {
    roomRef.current = room
  }, [room])
  useEffect(() => {
    playersRef.current = players
  }, [players])

  async function getSeatToUserId(roomId) {
    const { data: players } = await supabase.from('players').select('seat,user_id').eq('room_id', roomId).order('seat')
    const seatToUserId = {}
    ;(players || []).forEach((p) => {
      if (p?.seat != null) seatToUserId[p.seat] = p.user_id
    })
    return seatToUserId
  }

  async function savePlayerHand(roomId, userId, cards) {
    const { data, error: updateError } = await supabase
      .from('player_hands')
      .update({ cards, updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .select('id')

    if (updateError) {
      return { error: updateError }
    }

    if (!data?.length) {
      const { error: insertError } = await supabase.from('player_hands').insert({
        room_id: roomId,
        user_id: userId,
        cards,
        updated_at: new Date().toISOString(),
      })
      return { error: insertError }
    }

    return {}
  }

  const me = players.find((p) => p.user_id === userId) || null
  const isHost = !!room && room.host_id === userId

  // ---------- setup: garante sala + jogador, conecta nos canais ----------
  useEffect(() => {
    if (!userId || !code) return
    let cancelled = false

    async function setup() {
      setLoading(true)
      setError(null)

      try {
        const roomRow = await ensureRoom(code, userId, intent)
        const freshPlayers = await ensurePlayer(roomRow, userId, name)

        if (cancelled) return
        setRoom(roomRow)
        setPlayers(freshPlayers)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      }
    }

    setup()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, code])

  // ---------- realtime: sala (estado público), jogadores, minha mão ----------
  useEffect(() => {
    if (!room?.id) return

    const roomSub = supabase
      .channel(`room-row-${room.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (payload) => {
        setRoom(payload.new)
      })
      .subscribe()

    const playersSub = supabase
      .channel(`room-players-${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, async () => {
        const { data } = await supabase.from('players').select('*').eq('room_id', room.id).order('seat')
        setPlayers(data || [])
      })
      .subscribe()

    const handSub = supabase
      .channel(`my-hand-${room.id}-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_hands', filter: `room_id=eq.${room.id}` },
        async () => {
          const { data } = await supabase
            .from('player_hands')
            .select('cards')
            .eq('room_id', room.id)
            .eq('user_id', userId)
            .maybeSingle()
          setMyHand(data?.cards || [])
        }
      )
      .subscribe()

    // carrega a mão atual (caso já exista ao entrar/recarregar)
    supabase
      .from('player_hands')
      .select('cards')
      .eq('room_id', room.id)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setMyHand(data?.cards || []))

    return () => {
      supabase.removeChannel(roomSub)
      supabase.removeChannel(playersSub)
      supabase.removeChannel(handSub)
    }
  }, [room?.id, userId])

  // ---------- canal de ações (jogadores -> host) e de chat (todos) ----------
  useEffect(() => {
    if (!room?.id) return

    const actionsChannel = supabase.channel(`actions-${room.code}`, { config: { broadcast: { self: false } } })
    if (isHost) {
      actionsChannel.on('broadcast', { event: 'move' }, ({ payload }) => {
        hostProcessAction(payload)
      })
    }
    actionsChannel.subscribe()
    actionsChannelRef.current = actionsChannel

    const chatChannel = supabase.channel(`chat-${room.code}`, { config: { broadcast: { self: false } } })
    chatChannel.on('broadcast', { event: 'msg' }, ({ payload }) => {
      setChat((prev) => [...prev.slice(-49), payload])
    })
    chatChannel.subscribe()
    chatChannelRef.current = chatChannel

    return () => {
      supabase.removeChannel(actionsChannel)
      supabase.removeChannel(chatChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, isHost])

  // ---------- host: processa uma ação (própria ou recebida via broadcast) ----------
  const hostProcessAction = useCallback(async (action) => {
    const room = roomRef.current
    if (!room || room.host_id !== userId) return

    if (action.type === 'START_GAME') {
      const { publicState, hands } = startNewMao(emptyPublicState(0))
      hostHandsRef.current = hands
      await writeNewMao(room, publicState, hands)
      return
    }

    const current = room.game_state
    let result

    if (action.type === 'PLAY_CARD') {
      if (!hostHandsRef.current || !Array.isArray(hostHandsRef.current[action.seat])) {
        console.error('[truco] host não tem mão carregada para o assento', action.seat)
        return
      }
      result = applyPlayCard(current, hostHandsRef.current, action.seat, action.card)
      if (result.hands) hostHandsRef.current = result.hands
    } else if (action.type === 'CALL_TRUCO') {
      result = applyCallTruco(current, action.team)
    } else if (action.type === 'RESPOND_TRUCO') {
      result = applyRespondTruco(current, action.team, action.response)
    } else {
      return
    }

    if (result.error || !result.publicState) return

    const { error: roomUpdateError } = await supabase
      .from('rooms')
      .update({ game_state: result.publicState, updated_at: new Date().toISOString() })
      .eq('id', room.id)
    if (roomUpdateError) console.error('[truco] falha ao gravar game_state:', roomUpdateError)

    if (action.type === 'PLAY_CARD') {
      const seatToUserId = await getSeatToUserId(room.id)
      const seat = action.seat
      const userIdForSeat = seatToUserId[seat]
      if (!userIdForSeat) {
        console.error('[truco] não achei user_id ao atualizar mão do assento', seat, { seatToUserId })
      } else {
        const { error: handUpdateError } = await savePlayerHand(room.id, userIdForSeat, hostHandsRef.current[seat] || [])
        if (handUpdateError) console.error('[truco] falha ao atualizar a mão do assento', seat, handUpdateError)
      }
    }

    if (result.publicState.status === 'finished') {
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
    }
  }, [userId])

  async function writeNewMao(roomRow, publicState, hands) {
    const { error: roomError } = await supabase
      .from('rooms')
      .update({ status: 'playing', game_state: publicState, updated_at: new Date().toISOString() })
      .eq('id', roomRow.id)
    if (roomError) console.error('[truco] falha ao iniciar a mão (rooms.update):', roomError)

    const seatToUserId = await getSeatToUserId(roomRow.id)
    const missingSeats = Object.keys(hands).map(Number).filter((seat) => !seatToUserId[seat])
    if (missingSeats.length) {
      console.error(
        '[truco] não achei o user_id de algum assento ao distribuir as cartas — provavelmente "players" ainda não tinha carregado todo mundo:',
        { missingSeats, playersConhecidos: playersRef.current }
      )
      return
    }

    const inserts = Object.entries(hands).map(([seat, cards]) => ({
      room_id: roomRow.id,
      user_id: seatToUserId[Number(seat)],
      cards,
      mao_number: (publicState.rounds?.length || 0) + 1,
      updated_at: new Date().toISOString(),
    }))

    if (inserts.length !== 4) {
      console.error('[truco] distribuição incompleta de mãos, não vou gravar nada:', { inserts, seatToUserId })
      return
    }

    const { error: deleteError } = await supabase.from('player_hands').delete().eq('room_id', roomRow.id)
    if (deleteError) {
      console.error('[truco] falha ao limpar mãos antigas:', deleteError)
      return
    }

    const { error: insertError } = await supabase.from('player_hands').insert(inserts)
    if (insertError) {
      console.error('[truco] falha ao gravar as mãos:', insertError, inserts)
    }
  }

  // ---------- host: avança automaticamente pra próxima mão após mostrar o resultado ----------
  useEffect(() => {
    if (!isHost || !room) return
    if (room.game_state?.status !== 'mao_ended') {
      advancingRef.current = false
      return
    }
    if (advancingRef.current) return
    advancingRef.current = true

    const t = setTimeout(() => {
      const { publicState, hands } = startNewMao(room.game_state)
      hostHandsRef.current = hands
      writeNewMao(room, publicState, hands)
    }, MAO_REVEAL_DELAY_MS)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, room])

  // ---------- API pública do hook ----------
  const sendAction = useCallback(
    (action) => {
      if (isHost) {
        hostProcessAction(action)
      } else {
        actionsChannelRef.current?.send({ type: 'broadcast', event: 'move', payload: action })
      }
    },
    [isHost, hostProcessAction]
  )

  const startGame = useCallback(() => sendAction({ type: 'START_GAME' }), [sendAction])
  const playCard = useCallback((seat, card) => sendAction({ type: 'PLAY_CARD', seat, card }), [sendAction])
  const callTruco = useCallback((team) => sendAction({ type: 'CALL_TRUCO', team }), [sendAction])
  const respondTruco = useCallback((team, response) => sendAction({ type: 'RESPOND_TRUCO', team, response }), [sendAction])

  const sendChat = useCallback(
    (text) => {
      const payload = { name: name || 'Jogador', text, ts: Date.now() }
      setChat((prev) => [...prev.slice(-49), payload])
      chatChannelRef.current?.send({ type: 'broadcast', event: 'msg', payload })
    },
    [name]
  )

  return {
    loading,
    error,
    room,
    players,
    myHand,
    me,
    isHost,
    chat,
    actions: { startGame, playCard, callTruco, respondTruco, sendChat },
  }
}