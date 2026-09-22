import React from 'react';
import { useStore } from '../../store';
import { controlApi } from '../../lib/api';
import Avatar from '../Avatar';

export default function AppList() {
  const {
    apps,
    channels,
    actingUserId,
    activeChannelId,
    unreadCounts,
    setActiveChannel,
  } = useStore();

  function getDmChannelId(botUserId: string): string | null {
    const dm = channels.find(
      (c) =>
        c.type === 'im' &&
        c.members.includes(actingUserId) &&
        c.members.includes(botUserId)
    );
    return dm?.id ?? null;
  }

  async function handleClick(botUserId: string) {
    const existing = getDmChannelId(botUserId);
    if (existing) {
      setActiveChannel(existing);
      return;
    }
    // No DM yet — create it, then navigate (channel_created WsEvent updates the store)
    try {
      const channel = await controlApi.openDm(botUserId);
      setActiveChannel(channel.id);
    } catch (_) {
      /* silent */
    }
  }

  return (
    <div style={{ marginTop: 'var(--slacksim-space-4)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--slacksim-space-2)',
          margin: '1px 8px',
          padding: '5px 8px',
          fontSize: 'var(--slacksim-font-size-sm)',
          fontWeight: 'var(--slacksim-font-weight-bold)',
          color: 'var(--slacksim-color-sidebar-fg)',
          letterSpacing: '0.01em',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0, opacity: 0.75 }}
        >
          <circle cx="12" cy="5" r="1" />
          <circle cx="19" cy="5" r="1" />
          <circle cx="5" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
          <circle cx="19" cy="19" r="1" />
          <circle cx="5" cy="19" r="1" />
        </svg>
        <span>Apps</span>
      </div>

      {apps.map((app) => {
        const dmChannelId = getDmChannelId(app.botUserId);
        const isActive = !!dmChannelId && activeChannelId === dmChannelId;
        const unread = dmChannelId ? (unreadCounts[dmChannelId] ?? 0) : 0;
        const hasUnread = unread > 0 && !isActive;

        return (
          <button
            key={app.id}
            onClick={() => handleClick(app.botUserId)}
            className={`ss-sidebar-item${isActive ? ' ss-sidebar-item--active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--slacksim-space-2)',
              width: 'calc(100% - 16px)',
              margin: '1px 8px',
              padding: '5px 8px 5px 28px',
              background: isActive
                ? 'var(--slacksim-color-sidebar-active-bg)'
                : 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              color: isActive
                ? 'var(--slacksim-color-sidebar-active-fg)'
                : 'var(--slacksim-color-sidebar-fg)',
              fontSize: 'var(--slacksim-font-size-md)',
              borderRadius: 'var(--slacksim-radius-sm)',
            }}
          >
            <Avatar seed={app.botUserName} size={20} url={app.avatarUrl} />
            <span
              style={{
                flex: 1,
                fontWeight: hasUnread
                  ? 'var(--slacksim-font-weight-bold)'
                  : undefined,
                color: hasUnread
                  ? 'var(--slacksim-color-sidebar-fg-active)'
                  : undefined,
              }}
            >
              {app.name}
            </span>
            {hasUnread && (
              <span
                style={{
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
                }}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
