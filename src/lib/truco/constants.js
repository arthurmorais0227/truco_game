// Ordem dos naipes nas manilhas, do mais fraco pro mais forte (índice = força)
export const SUITS = ['ouro', 'espada', 'copa', 'paus']

export const SUIT_SYMBOL = { ouro: '♦', espada: '♠', copa: '♥', paus: '♣' }
export const SUIT_NAME_PT = { ouro: 'Ouros', espada: 'Espadas', copa: 'Copas', paus: 'Paus' }
export const SUIT_NICK_PT = { ouro: 'Pica-fumo', espada: 'Espadilha', copa: 'Copeta', paus: 'Zap' }

// Ordem das cartas do truco, do mais fraco pro mais forte (baralho de 40, sem 8/9/10)
export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3']
export const RANK_LABEL = { 4: '4', 5: '5', 6: '6', 7: '7', Q: 'Q', J: 'J', K: 'K', A: 'A', 2: '2', 3: '3' }

// Escada de valores da mão ao pedir truco
export const LADDER = [1, 3, 6, 9, 12]
export const LADDER_CALL_LABEL = { 3: 'Truco', 6: 'Seis', 9: 'Nove', 12: 'Doze' }

export const PONTOS_PARA_VENCER = 12
