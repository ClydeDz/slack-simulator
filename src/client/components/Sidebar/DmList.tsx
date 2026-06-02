import React from 'react'
import { useStore } from '../../store'
import Avatar from '../Avatar'

export default function DmList() {
  const { channels, users, apps, actingUserId, activeChannelId, unreadCounts, setActiveChannel } = useStore()

  const botUserIds = new Set(apps.map(a => a.botUserId))

  const dms = channels.filter(
    c => (c.type === 'im' || c.type === 'mpim') &&
      c.members.includes(actingUserId) &&
      // Exclude DMs where the only other member is a bot — those live in the Apps section
      c.members.some(id => id !== actingUserId && !botUserIds.has(id))
  )

  function resolveIdentity(uid: string): { label: string; seed: string; url?: string } {
    const user = users.find(u => u.id === uid)
    if (user) return { label: user.fullName, seed: user.avatarSeed, url: user.avatarUrl }
    const bot = apps.find(a => a.botUserId === uid)
    if (bot) return { label: bot.name, seed: bot.botUserName, url: bot.avatarUrl }
    return { label: uid, seed: uid }
  }

  function getDmLabel(channel: typeof dms[0]) {
    const otherMembers = channel.members.filter(uid => uid !== actingUserId)
    if (otherMembers.length === 0) {
      const self = users.find(u => u.id === actingUserId)
      return { label: self?.fullName ?? 'You', seed: self?.avatarSeed ?? 'default', url: self?.avatarUrl }
    }
    if (otherMembers.length === 1) {
      return resolveIdentity(otherMembers[0])
    }
    // Multiple members — label all, avatar from first
    const names = otherMembers.map(uid => resolveIdentity(uid).label).join(', ')
    const { seed, url } = resolveIdentity(otherMembers[0])
    return { label: names, seed, url }
  }

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
          <path fill="currentColor" fillRule="evenodd" d="M7.675 6.468a4.75 4.75 0 1 1 8.807 3.441.75.75 0 0 0-.067.489l.379 1.896-1.896-.38a.75.75 0 0 0-.489.068 5 5 0 0 1-.648.273.75.75 0 1 0 .478 1.422q.314-.105.611-.242l2.753.55a.75.75 0 0 0 .882-.882l-.55-2.753A6.25 6.25 0 1 0 6.23 6.064a.75.75 0 1 0 1.445.404M6.5 8.5a5 5 0 0 0-4.57 7.03l-.415 2.073a.75.75 0 0 0 .882.882l2.074-.414A5 5 0 1 0 6.5 8.5m-3.5 5a3.5 3.5 0 1 1 1.91 3.119.75.75 0 0 0-.49-.068l-1.214.243.243-1.215a.75.75 0 0 0-.068-.488A3.5 3.5 0 0 1 3 13.5" clipRule="evenodd"/>
        </svg>
        <span>Direct Messages</span>
      </div>
      {dms.map(channel => {
        const { label, seed, url } = getDmLabel(channel)
        const isActive = activeChannelId === channel.id
        const unread = unreadCounts[channel.id] ?? 0
        const hasUnread = unread > 0 && !isActive
        return (
          <button
            key={channel.id}
            onClick={() => setActiveChannel(channel.id)}
            className={`ss-sidebar-item${isActive ? ' ss-sidebar-item--active' : ''}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--slacksim-space-2)',
              width: 'calc(100% - 16px)', margin: '1px 8px',
              padding: '5px 8px 5px 28px',
              background: isActive ? 'var(--slacksim-color-sidebar-active-bg)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              color: isActive ? 'var(--slacksim-color-sidebar-active-fg)' : 'var(--slacksim-color-sidebar-fg)',
              fontSize: 'var(--slacksim-font-size-md)',
              borderRadius: 'var(--slacksim-radius-sm)',
            }}
          >
            <Avatar seed={seed} size={20} url={url} />
            <span style={{
              flex: 1,
              fontWeight: hasUnread ? 'var(--slacksim-font-weight-bold)' : undefined,
              color: hasUnread ? 'var(--slacksim-color-sidebar-fg-active)' : undefined,
            }}>
              {label}
            </span>
            {hasUnread && (
              <span style={{
                flexShrink: 0,
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                background: 'var(--slacksim-color-sidebar-badge-bg)',
                color: '#fff',
                borderRadius: 'var(--slacksim-radius-pill)',
                fontSize: 11,
                fontWeight: 'var(--slacksim-font-weight-bold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
