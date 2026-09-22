import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import Avatar from '../Avatar';
import type { Channel, User, App } from '@shared/types';

interface Props {
  label: string;
  channel: Channel;
  users: User[];
  apps?: App[];
  onClick?: () => void;
  /** When true, renders as plain muted text instead of a mention chip (e.g. in the header) */
  plain?: boolean;
}

const MAX_AVATARS = 5;

export default function ChannelChip({
  label,
  channel,
  users,
  apps = [],
  onClick,
  plain,
}: Props) {
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    placement: 'above' | 'below';
  } | null>(null);
  const ref = React.useRef<HTMLSpanElement>(null);

  const TOOLTIP_HEIGHT = 90; // conservative estimate: name + avatars row
  const MARGIN = 8;

  function handleMouseEnter() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const placement = r.top - TOOLTIP_HEIGHT - MARGIN < 0 ? 'below' : 'above';
    const top = placement === 'above' ? r.top - MARGIN : r.bottom + MARGIN;
    setPos({ top, left: r.left + r.width / 2, placement });
  }

  const isIm = channel.type === 'im' || channel.type === 'mpim';

  // Human members from channel.members
  const resolvedHumans = channel.members
    .map((id) => {
      const u = users.find((u) => u.id === id);
      return u
        ? {
            seed: u.avatarSeed,
            name: u.fullName,
            url: u.avatarUrl as string | undefined,
          }
        : null;
    })
    .filter(
      (m): m is { seed: string; name: string; url: string | undefined } => !!m
    );

  // All apps are available in every channel
  const resolvedApps = apps.map((a) => ({
    seed: a.botUserName,
    name: a.name,
    url: a.avatarUrl,
  }));

  const allResolved = [...resolvedHumans, ...resolvedApps];
  const avatarsToShow = allResolved.slice(0, MAX_AVATARS);

  const humanCount = resolvedHumans.length;
  const botCount = apps.length;
  const memberCountLabel =
    humanCount > 0 && botCount > 0
      ? `${humanCount} ${humanCount === 1 ? 'member' : 'members'} and ${botCount} ${botCount === 1 ? 'app' : 'apps'}`
      : humanCount > 0
        ? `${humanCount} ${humanCount === 1 ? 'member' : 'members'}`
        : `${botCount} ${botCount === 1 ? 'app' : 'apps'}`;

  // Tooltip title: for DMs show comma-separated names; for channels show #name
  const tooltipTitle = isIm
    ? resolvedHumans.map((m) => m.name).join(', ')
    : `#${channel.name}`;

  return (
    <>
      <span
        ref={ref}
        className={plain ? undefined : 'ss-mention'}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setPos(null)}
        style={{
          cursor: onClick ? 'pointer' : 'default',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          ...(plain
            ? {
                fontSize: 'var(--slacksim-font-size-sm)',
                color: 'var(--slacksim-color-fg-muted)',
                textDecoration: 'underline dotted',
                textUnderlineOffset: 3,
              }
            : {}),
        }}
      >
        {plain ? (
          label
        ) : (
          <>
            {channel.type === 'private' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            ) : (
              <span
                style={{
                  fontWeight: 'var(--slacksim-font-weight-bold)',
                  lineHeight: 1,
                }}
              >
                #
              </span>
            )}
            {channel.name}
          </>
        )}
      </span>

      {pos &&
        ReactDOM.createPortal(
          <div
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform:
                pos.placement === 'above'
                  ? 'translate(-50%, -100%)'
                  : 'translate(-50%, 0)',
              zIndex: 2000,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                background: 'var(--slacksim-color-modal-bg)',
                border: '1px solid var(--slacksim-color-modal-border)',
                borderRadius: 'var(--slacksim-radius-md)',
                boxShadow: 'var(--slacksim-shadow-md)',
                padding: '10px 14px',
                minWidth: 200,
              }}
            >
              {/* Title: member names for DMs, #channel-name for channels */}
              <div
                style={{
                  fontWeight: 'var(--slacksim-font-weight-bold)',
                  fontSize: 'var(--slacksim-font-size-lg)',
                  color: 'var(--slacksim-color-fg)',
                  marginBottom: 8,
                  whiteSpace: 'nowrap',
                }}
              >
                {tooltipTitle}
              </div>

              {/* Avatars + member count */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--slacksim-space-2)',
                }}
              >
                {avatarsToShow.length > 0 && (
                  <div style={{ display: 'flex' }}>
                    {avatarsToShow.map((m, idx) => (
                      <div
                        key={m.seed}
                        style={{
                          marginLeft: idx === 0 ? 0 : -6,
                          zIndex: MAX_AVATARS - idx,
                        }}
                      >
                        <Avatar
                          seed={m.seed}
                          size={22}
                          alt={m.name}
                          url={m.url}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <span
                  style={{
                    fontSize: 'var(--slacksim-font-size-sm)',
                    color: 'var(--slacksim-color-fg-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {memberCountLabel}
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
