const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem letras/números ambíguos (I, O, 0, 1)

export function generateRoomCode(length = 5) {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}
