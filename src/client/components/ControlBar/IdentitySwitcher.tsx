import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import Avatar from '../Avatar'

export default function IdentitySwitcher({ openUpward = false }: { openUpward?: boolean }) {
  const { users, actingUserId, setActingUser } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeUser = users.find(u => u.id === actingUserId)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="ss-identity-trigger"
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--slacksim-space-2)',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--slacksim-color-sidebar-fg-active)', padding: '6px 8px',
          borderRadius: 'var(--slacksim-radius-sm)',
          width: '100%', textAlign: 'left',
        }}
      >
        {activeUser && <Avatar seed={activeUser.avatarSeed} size={35} url={activeUser.avatarUrl} />}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{
            fontSize: 'var(--slacksim-font-size-sm)', fontWeight: 'var(--slacksim-font-weight-bold)',
            color: 'var(--slacksim-color-sidebar-fg-active)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: 2,
          }}>
            {activeUser?.fullName ?? 'Unknown'}
          </div>
          <div style={{
            fontSize: 'var(--slacksim-font-size-sm)',
            color: 'var(--slacksim-color-sidebar-fg)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            @{activeUser?.username}
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--slacksim-color-tab-fg)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          ...(openUpward ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
          left: 0, right: 0, zIndex: 999,
          background: 'var(--slacksim-color-modal-bg)', borderRadius: 'var(--slacksim-radius-md)',
          boxShadow: 'var(--slacksim-shadow-md)', border: '1px solid var(--slacksim-color-modal-border)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '6px 12px', fontSize: 'var(--slacksim-font-size-sm)', color: 'var(--slacksim-color-fg-muted)', borderBottom: '1px solid var(--slacksim-color-border)' }}>
            Viewing as…
          </div>
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => { setActingUser(u.id); setOpen(false) }}
              className="ss-identity-item"
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--slacksim-space-2)',
                width: '100%', padding: '8px 12px', background: u.id === actingUserId ? 'var(--slacksim-color-bg-secondary)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <Avatar seed={u.avatarSeed} size={24} url={u.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--slacksim-font-size-md)', fontWeight: 'var(--slacksim-font-weight-bold)', color: 'var(--slacksim-color-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.fullName}</div>
                <div style={{ fontSize: 'var(--slacksim-font-size-sm)', color: 'var(--slacksim-color-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{u.username}</div>
              </div>
              {u.id === actingUserId && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--slacksim-color-primary)' }}><path d="M20 6 9 17l-5-5"/></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
