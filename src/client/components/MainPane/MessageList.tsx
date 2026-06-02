import React, { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '../../store'
import { controlApi } from '../../lib/api'
import MessageComponent from './Message'

export default function MessageList() {
  const { activeChannelId, messages, setChannelMessages, resetAt, actingUserId } = useStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  const { isLoading } = useQuery({
    queryKey: ['messages', activeChannelId, resetAt],
    queryFn: async () => {
      if (!activeChannelId) return []
      const msgs = await controlApi.getChannelMessages(activeChannelId)
      setChannelMessages(activeChannelId, msgs)
      return msgs
    },
    enabled: !!activeChannelId,
  })

  const allMessages = activeChannelId ? (messages[activeChannelId] ?? []) : []
  const channelMessages = allMessages.filter(msg =>
    msg.subtype !== 'ephemeral' || !msg.ephemeralRecipient || msg.ephemeralRecipient === actingUserId
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [channelMessages.length])

  if (!activeChannelId) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--slacksim-color-fg-muted)', fontSize: 'var(--slacksim-font-size-md)',
      }}>
        Select a channel
      </div>
    )
  }

  if (isLoading && channelMessages.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--slacksim-color-fg-muted)', fontSize: 'var(--slacksim-font-size-md)',
      }}>
        Loading messages…
      </div>
    )
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--slacksim-space-4) 0',
    }}>
      {channelMessages.map(msg => (
        <MessageComponent key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
