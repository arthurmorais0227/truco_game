-- =========================================================
-- TRUCO PAULISTA -- schema do Supabase
-- Rode este arquivo inteiro no SQL Editor do seu projeto
-- (Supabase Dashboard > SQL Editor > New query > Run)
--
-- Seguro de rodar mais de uma vez: comeca apagando as tabelas
-- (se existirem) e recria tudo do zero.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- limpeza (idempotente: nao reclama se nao existir nada ainda)
-- ---------------------------------------------------------
drop table if exists public.player_hands cascade;
drop table if exists public.players cascade;
drop table if exists public.rooms cascade;

-- ---------------------------------------------------------
-- Tabela: rooms (salas)
-- Guarda o estado PUBLICO do jogo (placar, vira, mesa, etc).
-- Quem escreve nessa tabela e sempre o "host" (criador da sala),
-- que roda a engine do truco no proprio navegador.
-- ---------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null,
  status text not null default 'lobby', -- lobby | playing | finished
  game_state jsonb not null default '{}'::jsonb,''
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Tabela: players (jogadores de cada sala)
-- ---------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  seat int not null check (seat >= 0 and seat <= 3),
  team text not null check (team in ('A','B')),
  connected boolean not null default true,
  created_at timestamptz not null default now(),
  unique (room_id, seat),
  unique (room_id, user_id)
);

-- ---------------------------------------------------------
-- Tabela: player_hands (mao de cada jogador)
-- PRIVADA: so o proprio jogador pode ler suas cartas.
-- Quem escreve e o host (que distribuiu as cartas).
-- ---------------------------------------------------------
create table public.player_hands (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  cards jsonb not null default '[]'::jsonb,
  mao_number int not null default 0,
  updated_at timestamptz not null default now(),
  unique (room_id, user_id)
);

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.player_hands enable row level security;

-- rooms: qualquer sessao (anonima) pode ler salas (pra achar pelo codigo)
create policy "rooms_select_all" on public.rooms
  for select using (true);

-- rooms: qualquer sessao autenticada (mesmo anonima) pode criar uma sala,
-- desde que se declare host
create policy "rooms_insert_own" on public.rooms
  for insert with check (auth.uid() = host_id);

-- rooms: so o host pode atualizar o estado publico do jogo
create policy "rooms_update_host" on public.rooms
  for update using (auth.uid() = host_id);

-- players: lista de jogadores e visivel pra quem esta na sala (e pra achar assentos livres)
create policy "players_select_all" on public.players
  for select using (true);

-- players: cada um so insere a propria linha (entrar na sala)
create policy "players_insert_own" on public.players
  for insert with check (auth.uid() = user_id);

-- players: cada um so atualiza a propria linha (ex: status de conectado)
create policy "players_update_own" on public.players
  for update using (auth.uid() = user_id);

-- players: cada um so pode remover a propria linha (saiu da sala)
create policy "players_delete_own" on public.players
  for delete using (auth.uid() = user_id);

-- player_hands: SOMENTE o dono da mao pode ler suas proprias cartas
create policy "hands_select_own" on public.player_hands
  for select using (auth.uid() = user_id);

-- player_hands: so o host da sala pode escrever as cartas (ele distribuiu)
create policy "hands_insert_host" on public.player_hands
  for insert with check (
    auth.uid() = (select host_id from public.rooms where id = room_id)
  );

create policy "hands_update_host" on public.player_hands
  for update using (
    auth.uid() = (select host_id from public.rooms where id = room_id)
  );

create policy "hands_delete_host" on public.player_hands
  for delete using (
    auth.uid() = (select host_id from public.rooms where id = room_id)
  );

-- ---------------------------------------------------------
-- Realtime: habilita os eventos de INSERT/UPDATE/DELETE
-- nessas tabelas pra todo mundo que esta "ouvindo" via supabase-js
-- ---------------------------------------------------------
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.player_hands;
