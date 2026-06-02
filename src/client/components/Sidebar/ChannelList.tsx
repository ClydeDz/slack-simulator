import React from 'react'
import { useStore } from '../../store'

interface Props {
  onCreateChannel: () => void
}

export default function ChannelList({ onCreateChannel }: Props) {
  const { channels, activeChannelId, setActiveChannel } = useStore()

  const publicAndPrivate = channels.filter(c => c.type === 'public' || c.type === 'private')

  return (
    <div style={{ marginTop: 'var(--slacksim-space-4)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--slacksim-space-2)',
        margin: '1px 8px',
        padding: '5px 8px',
        fontSize: 'var(--slacksim-font-size-sm)',
        fontWeight: 'var(--slacksim-font-weight-bold)',
        color: 'var(--slacksim-color-sidebar-fg)',
        letterSpacing: '0.01em',
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true" style={{ width: 16, height: 16, flexShrink: 0, opacity: 0.75, color: 'var(--slacksim-color-sidebar-fg)' }}>
          <path fill="currentColor" d="M14.5 1.75a3.75 3.75 0 0 1 3.75 3.75v9a3.75 3.75 0 0 1-3.75 3.75h-9a3.75 3.75 0 0 1-3.75-3.75v-9A3.75 3.75 0 0 1 5.5 1.75zm-9 1.5A2.25 2.25 0 0 0 3.25 5.5v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25zm3.152 2.215a.751.751 0 0 1 1.478.256l-.268 1.556h1.365l.313-1.81a.75.75 0 0 1 1.478.256l-.269 1.554h1.658a.751.751 0 0 1 0 1.5h-1.915l-.475 2.753H13.8a.75.75 0 0 1 0 1.5h-2.042l-.26 1.503a.75.75 0 0 1-1.478-.255l.215-1.248H8.869l-.26 1.501a.75.75 0 0 1-1.478-.255l.215-1.246H5.593a.75.75 0 0 1 .001-1.5h2.012l.475-2.753H6.2a.75.75 0 0 1 0-1.5h2.14zm.476 6.065h1.366l.474-2.753H9.603z"/>
        </svg>
        <span>Channels</span>
      </div>
      {publicAndPrivate.map(channel => (
        <button
          key={channel.id}
          onClick={() => setActiveChannel(channel.id)}
          className={`ss-sidebar-item${activeChannelId === channel.id ? ' ss-sidebar-item--active' : ''}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--slacksim-space-1)',
            width: 'calc(100% - 16px)', padding: '5px 8px 5px 28px',
            background: activeChannelId === channel.id ? 'var(--slacksim-color-sidebar-active-bg)' : 'transparent',
            border: 'none', cursor: 'pointer', textAlign: 'left',
            color: activeChannelId === channel.id ? 'var(--slacksim-color-sidebar-active-fg)' : 'var(--slacksim-color-sidebar-fg)',
            fontSize: 'var(--slacksim-font-size-md)',
            borderRadius: 'var(--slacksim-radius-sm)',
            margin: '1px 8px',
          }}
        >
          {channel.type === 'private' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7, display: 'block' }}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7, display: 'block' }}><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>
          )}
          <span>{channel.name}</span>
        </button>
      ))}
      <button
        onClick={onCreateChannel}
        className="ss-sidebar-item"
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--slacksim-space-1)',
          width: 'calc(100% - 16px)', margin: '1px 8px',
          padding: '5px 8px 5px 28px',
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
          color: 'var(--slacksim-color-sidebar-fg)',
          fontSize: 'var(--slacksim-font-size-md)',
          borderRadius: 'var(--slacksim-radius-sm)',
          opacity: 0.75,
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
        <span>Add a channel</span>
      </button>
    </div>
  )
}
