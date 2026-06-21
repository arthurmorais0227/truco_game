import React, { useEffect, useRef, useState } from 'react'
import './Chat.css'

export default function Chat({ messages, onSend }) {
  const [text, setText] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && <div className="chat-empty">Converse com a mesa por aqui.</div>}
        {messages.map((m, i) => (
          <div key={i} className="chat-msg">
            <strong>{m.name}:</strong> {m.text}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="chat-form">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mandar mensagem…" maxLength={200} />
        <button className="btn btn-ghost" type="submit">
          Enviar
        </button>
      </form>
    </div>
  )
}
