# Truco Paulista — multiplayer online

Truco Paulista completo (2 duplas, 12 pontos, manilhas, mão de 11, mão de ferro,
escada de truco 3/6/9/12) com salas online em tempo real via **Supabase Realtime**,
seguindo o mesmo pipeline do projeto "Jogo do Impostor" (Vite + React + Supabase → Vercel/GitHub).

## Como funciona (arquitetura)

- **Estado público da sala** (`rooms.game_state`): vira, manilha, mesa, placar, truco
  pendente, etc. Visível pra todo mundo, mas só o **host** (quem criou a sala) escreve nele.
- **Mão de cada jogador** (`player_hands`): privada — RLS garante que só o próprio
  jogador lê suas cartas.
- **Quem manda no jogo**: o navegador de quem criou a sala roda a engine do truco
  (`src/lib/truco/engine.js`) e grava o resultado no Supabase. Os outros jogadores
  mandam suas jogadas via **Broadcast** (canal `actions-{codigo}`) e recebem o
  resultado já processado pelas mudanças em tempo real da tabela `rooms`.
- **Chat**: broadcast simples entre todos, sem persistir no banco.

> ⚠️ **Limitação conhecida**: como é o navegador de um dos jogadores (o host) que
> roda a engine e guarda as 4 mãos em memória durante a distribuição, alguém com
> acesso ao DevTools daquele navegador específico conseguiria ver as cartas dos
> outros — e se o host recarregar a página no meio de uma mão, a mão em andamento
> se perde. Pra ambiente de amigos/sala de aula isso é tranquilo (mesmo modelo do
> Jogo do Impostor). Se algum dia você quiser deixar 100% à prova de trapaça, o
> próximo passo é mover a engine pra uma **Supabase Edge Function**, que nunca
> entrega a mão de ninguém pro cliente errado. Me chama que a gente monta isso.

## 1. Configurar o Supabase

1. Crie um projeto novo em [supabase.com](https://supabase.com).
2. Vá em **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → **Run**.
   Isso cria as tabelas `rooms`, `players`, `player_hands`, as policies de RLS
   e habilita o Realtime nelas.
3. Vá em **Authentication → Providers** → habilite **Anonymous Sign-Ins**.
   (sem isso, ninguém consegue entrar — usamos sessão anônima em vez de login/senha,
   só pra cada navegador ter um `auth.uid()` estável.)
4. Vá em **Project Settings → API** e copie:
   - `Project URL`
   - `anon public` key

## 2. Rodar localmente

```bash
cp .env.example .env
# cole a URL e a anon key no .env

npm install
npm run dev
```

Abra duas (ou quatro) abas/dispositivos diferentes em `http://localhost:5173`
pra simular os 4 jogadores.

## 3. Deploy (Vercel)

Mesmo fluxo do Jogo do Impostor:

1. Suba este projeto pro GitHub.
2. Importe o repo na Vercel.
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` com os mesmos valores do `.env`.
4. Deploy. Pronto, sala compartilhável por link/código.

## Estrutura

```
src/
  lib/truco/        engine pura (sem React) — deck, manilhas, rodadas, truco, escada
  hooks/
    useAnonAuth.js   sessão anônima do Supabase
    useTrucoRoom.js  liga a engine ao Supabase Realtime (salas, ações, chat)
  pages/
    Home.jsx         criar sala / entrar com código
    Room.jsx         lobby de espera + mesa de jogo
  components/        Card, PlayerHand, Table, Scoreboard, TrucoBar, Chat
supabase/schema.sql  tabelas + RLS + realtime
```

## Regras implementadas

- Baralho de 40 cartas (sem 8, 9, 10, sem coringa), 3 cartas por jogador.
- Vira define a manilha; ordem dos naipes na manilha: Paus > Copas > Espadas > Ouros.
- Mão com até 3 rodadas; empates resolvidos exatamente como nas regras oficiais
  (incluindo "quem ganhou a 1ª rodada leva a mão se a 2ª ou 3ª empatar").
- Pedido de truco só na vez do jogador, escada 1 → 3 → 6 → 9 → 12 ("truco",
  "seis", "nove", "doze"), com aceitar / correr / pedir mais.
- Mão de 11 já começa valendo 3 — e pedir truco durante a mão de 11 dá a
  partida inteira pra dupla adversária.
- Mão de ferro (as duas duplas em 11): cartas viradas pra todo mundo, incluindo
  o próprio dono da mão ("no escuro").
- Partida até 12 pontos.
