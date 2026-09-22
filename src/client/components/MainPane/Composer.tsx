import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { controlApi } from '../../lib/api';
import Avatar from '../Avatar';

interface Props {
  channelId: string;
  threadTs?: string;
  placeholder?: string;
}

export default function Composer({ channelId, threadTs, placeholder }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState(0);
  const [channelQuery, setChannelQuery] = useState<string | null>(null);
  const [channelAnchor, setChannelAnchor] = useState(0);
  const [emojiQuery, setEmojiQuery] = useState<string | null>(null);
  const [emojiAnchor, setEmojiAnchor] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { channels, users, apps, actingUserId, workspace } = useStore();

  const channel = channels.find((c) => c.id === channelId);
  const isPrivateChannel = channel?.type === 'private';
  const isIm = channel?.type === 'im' || channel?.type === 'mpim';

  const dmName = isIm
    ? (channel?.members ?? [])
        .filter((id) => id !== actingUserId)
        .map((id) => {
          const u = users.find((u) => u.id === id);
          const a = apps.find((a) => a.botUserId === id);
          return u?.fullName ?? a?.name ?? id;
        })
        .join(', ') || 'them'
    : null;

  // ── Slash command detection ────────────────────────────────────
  // Active when text starts with / and no space yet (still typing command name)
  const slashQuery: string | null = (() => {
    if (!text.startsWith('/')) return null;
    if (text.includes(' ')) return null;
    return text.slice(1); // partial command name after /
  })();

  type SlashEntry = {
    command: string;
    usage?: string;
    description: string;
    appName: string;
    avatarSeed: string;
    avatarUrl?: string;
  };
  const slashMatches: SlashEntry[] =
    slashQuery !== null
      ? apps.flatMap((a) =>
          (a.slashCommands || [])
            .filter((sc) =>
              sc.command.slice(1).startsWith(slashQuery.toLowerCase())
            )
            .map((sc) => ({
              command: sc.command,
              usage: sc.usage,
              description: sc.description,
              appName: a.name,
              avatarSeed: a.botUserName,
              avatarUrl: a.avatarUrl,
            }))
        )
      : [];

  function selectSlashCommand(command: string) {
    setText(command + ' ');
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const pos = command.length + 1;
        el.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  // ── Mention detection ──────────────────────────────────────────
  // Unified mention list: users + apps (bots)
  type MentionEntry =
    | {
        kind: 'user';
        id: string;
        username: string;
        fullName: string;
        avatarSeed: string;
        avatarUrl?: string;
      }
    | {
        kind: 'app';
        id: string;
        username: string;
        fullName: string;
        avatarSeed: string;
        avatarUrl?: string;
      };

  const mentionMatches: MentionEntry[] =
    mentionQuery !== null
      ? [
          ...apps
            .filter(
              (a) =>
                a.botUserName
                  .toLowerCase()
                  .startsWith(mentionQuery!.toLowerCase()) ||
                a.name.toLowerCase().includes(mentionQuery!.toLowerCase())
            )
            .map((a) => ({
              kind: 'app' as const,
              id: a.id,
              username: a.botUserName,
              fullName: a.name,
              avatarSeed: a.botUserName,
              avatarUrl: a.avatarUrl,
            })),
          ...users
            .filter(
              (u) =>
                u.username
                  .toLowerCase()
                  .startsWith(mentionQuery!.toLowerCase()) ||
                u.fullName.toLowerCase().includes(mentionQuery!.toLowerCase())
            )
            .slice(0, 5)
            .map((u) => ({
              kind: 'user' as const,
              id: u.id,
              username: u.username,
              fullName: u.fullName,
              avatarSeed: u.avatarSeed,
              avatarUrl: u.avatarUrl,
            })),
        ]
      : [];

  // ── Channel mention detection ──────────────────────────────────
  const channelMatches =
    channelQuery !== null
      ? channels
          .filter((c) => c.type !== 'im' && c.type !== 'mpim' && c.name)
          .filter((c) =>
            c.name.toLowerCase().startsWith(channelQuery.toLowerCase())
          )
          .slice(0, 8)
      : [];

  // ── Emoji shortcode detection ──────────────────────────────────
  const emojiMap = workspace?.emojiMap ?? {};
  const emojiMatches: Array<{ name: string; char: string }> =
    emojiQuery !== null
      ? Object.entries(emojiMap)
          .filter(([name]) =>
            name.toLowerCase().startsWith(emojiQuery.toLowerCase())
          )
          .map(([name, char]) => ({ name, char }))
      : [];

  function insertChannelMention(id: string, name: string) {
    void id; // stored as plain #name; renderer resolves to chip by name lookup
    const before = text.slice(0, channelAnchor);
    const after = text.slice(channelAnchor + 1 + (channelQuery?.length ?? 0));
    const newText = `${before}#${name} ${after}`;
    setText(newText);
    setChannelQuery(null);
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        const pos = before.length + name.length + 2;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  function insertEmoji(name: string, char: string) {
    const before = text.slice(0, emojiAnchor);
    const after = text.slice(emojiAnchor + 1 + (emojiQuery?.length ?? 0));
    const newText = `${before}${char} ${after}`;
    setText(newText);
    setEmojiQuery(null);
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        const pos = before.length + char.length + 1; // after "char "
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  function detectMention(value: string, cursorPos: number) {
    const before = value.slice(0, cursorPos);

    // Channel mention: look for # that hasn't been closed
    const channelMatch = before.match(/#([\w-]*)$/);
    if (channelMatch) {
      setChannelQuery(channelMatch[1]);
      setChannelAnchor(before.length - channelMatch[0].length);
      setMentionQuery(null);
      setEmojiQuery(null);
      return;
    }

    // User mention: look for @ that hasn't been closed
    const mentionMatch = before.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionAnchor(before.length - mentionMatch[0].length);
      setChannelQuery(null);
      setEmojiQuery(null);
      return;
    }

    // Emoji shortcode: look for : followed by word chars (no closing : yet)
    const emojiMatch = before.match(/:([\w+\-]*)$/);
    if (emojiMatch) {
      setEmojiQuery(emojiMatch[1]);
      setEmojiAnchor(before.length - emojiMatch[0].length);
      setMentionQuery(null);
      setChannelQuery(null);
      return;
    }

    setMentionQuery(null);
    setChannelQuery(null);
    setEmojiQuery(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setText(val);
    setSendError(null);
    // Suppress all dropdown detection for any slash command input (name or args)
    if (val.startsWith('/')) {
      setMentionQuery(null);
      setChannelQuery(null);
      setEmojiQuery(null);
    } else {
      detectMention(val, e.target.selectionStart ?? val.length);
    }
    // Auto-grow
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }

  function insertMention(username: string) {
    const before = text.slice(0, mentionAnchor);
    const after = text.slice(mentionAnchor + 1 + (mentionQuery?.length ?? 0)); // skip @<query>
    const newText = `${before}@${username} ${after}`;
    setText(newText);
    setMentionQuery(null);
    // Restore focus
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        const pos = before.length + username.length + 2; // after "@username "
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setSendError(null);
    console.log('[Composer] handleSend called, text:', trimmed);
    try {
      if (trimmed.startsWith('/')) {
        // Slash command: split into command + args
        const spaceIdx = trimmed.indexOf(' ');
        const command = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
        const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();
        console.log(
          '[Composer] dispatching slash command:',
          command,
          'args:',
          args
        );
        await controlApi.postSlashCommand(channelId, command, args);
        console.log('[Composer] slash command dispatched ok');
      } else {
        await controlApi.postMessage(channelId, trimmed, threadTs);
      }
      setText('');
      setMentionQuery(null);
      setEmojiQuery(null);
      const el = textareaRef.current;
      if (el) el.style.height = 'auto';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send';
      setSendError(msg);
      console.error('[Composer] Failed to send:', e);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // When composing slash command args (e.g. /vote "a" "b"), Enter always sends — never intercepted by dropdowns
    const isSlashCommandArgs = text.startsWith('/') && text.includes(' ');

    // Slash command dropdown navigation
    if (slashQuery !== null && slashMatches.length > 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setText('');
        return;
      }
      if (e.key === 'Tab' || e.key === 'ArrowDown') {
        e.preventDefault();
        selectSlashCommand(slashMatches[0].command);
        return;
      }
    }

    // Channel dropdown navigation
    if (
      !isSlashCommandArgs &&
      channelQuery !== null &&
      channelMatches.length > 0
    ) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setChannelQuery(null);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertChannelMention(channelMatches[0].id, channelMatches[0].name); // id unused, kept for signature clarity
        return;
      }
    }

    // Mention dropdown navigation
    if (
      !isSlashCommandArgs &&
      mentionQuery !== null &&
      mentionMatches.length > 0
    ) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && mentionQuery !== null)) {
        e.preventDefault();
        insertMention(mentionMatches[0].username);
        return;
      }
    }

    // Emoji dropdown navigation
    if (!isSlashCommandArgs && emojiQuery !== null && emojiMatches.length > 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEmojiQuery(null);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertEmoji(emojiMatches[0].name, emojiMatches[0].char);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Close dropdowns if clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        !textareaRef.current
          ?.closest('.ss-composer')
          ?.contains(e.target as Node)
      ) {
        setMentionQuery(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canSend = text.trim().length > 0 && !sending;

  return (
    <div
      className="ss-composer"
      style={{
        padding: '0 var(--slacksim-space-5) var(--slacksim-space-4)',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Slash command dropdown */}
      {slashQuery !== null && slashMatches.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 'var(--slacksim-space-5)',
            right: 'var(--slacksim-space-5)',
            marginBottom: 4,
            background: 'var(--slacksim-color-modal-bg)',
            border: '1px solid var(--slacksim-color-modal-border)',
            borderRadius: 'var(--slacksim-radius-md)',
            boxShadow: 'var(--slacksim-shadow-md)',
            overflow: 'hidden',
            zIndex: 100,
          }}
        >
          {slashMatches.map((entry) => (
            <button
              key={entry.command}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSlashCommand(entry.command);
              }}
              className="ss-mention-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--slacksim-space-3)',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s ease',
              }}
            >
              <Avatar seed={entry.avatarSeed} size={28} url={entry.avatarUrl} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontSize: 'var(--slacksim-font-size-md)',
                    color: 'var(--slacksim-color-fg)',
                  }}
                >
                  <span
                    style={{ fontWeight: 'var(--slacksim-font-weight-bold)' }}
                  >
                    {entry.command}
                  </span>
                  {entry.usage && (
                    <span
                      style={{
                        fontWeight: 'var(--slacksim-font-weight-normal, 400)',
                        color: 'var(--slacksim-color-fg-muted)',
                      }}
                    >
                      {' '}
                      {entry.usage}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: 'var(--slacksim-font-size-sm)',
                    color: 'var(--slacksim-color-fg-muted)',
                  }}
                >
                  App · {entry.appName} · {entry.description}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Channel dropdown */}
      {channelQuery !== null && channelMatches.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 'var(--slacksim-space-5)',
            right: 'var(--slacksim-space-5)',
            marginBottom: 4,
            background: 'var(--slacksim-color-modal-bg)',
            border: '1px solid var(--slacksim-color-modal-border)',
            borderRadius: 'var(--slacksim-radius-md)',
            boxShadow: 'var(--slacksim-shadow-md)',
            overflow: 'hidden',
            zIndex: 100,
          }}
        >
          {channelMatches.map((c) => (
            <button
              key={c.id}
              onMouseDown={(e) => {
                e.preventDefault();
                insertChannelMention(c.id, c.name);
              }}
              className="ss-mention-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--slacksim-space-2)',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s ease',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--slacksim-font-size-md)',
                  color: 'var(--slacksim-color-fg-muted)',
                  fontWeight: 'var(--slacksim-font-weight-bold)',
                }}
              >
                #
              </span>
              <span
                style={{
                  fontWeight: 'var(--slacksim-font-weight-bold)',
                  fontSize: 'var(--slacksim-font-size-md)',
                  color: 'var(--slacksim-color-fg)',
                }}
              >
                {c.name}
              </span>
              <span
                style={{
                  fontSize: 'var(--slacksim-font-size-sm)',
                  color: 'var(--slacksim-color-fg-muted)',
                  marginLeft: 'auto',
                }}
              >
                {c.type === 'private' ? 'Private' : 'Channel'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji dropdown */}
      {emojiQuery !== null && emojiMatches.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 'var(--slacksim-space-5)',
            right: 'var(--slacksim-space-5)',
            marginBottom: 4,
            background: 'var(--slacksim-color-modal-bg)',
            border: '1px solid var(--slacksim-color-modal-border)',
            borderRadius: 'var(--slacksim-radius-md)',
            boxShadow: 'var(--slacksim-shadow-md)',
            overflow: 'hidden',
            zIndex: 100,
          }}
        >
          {emojiMatches.map((entry) => (
            <button
              key={entry.name}
              onMouseDown={(e) => {
                e.preventDefault();
                insertEmoji(entry.name, entry.char);
              }}
              className="ss-mention-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--slacksim-space-3)',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s ease',
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{entry.char}</span>
              <span
                style={{
                  fontWeight: 'var(--slacksim-font-weight-bold)',
                  fontSize: 'var(--slacksim-font-size-md)',
                  color: 'var(--slacksim-color-fg)',
                }}
              >
                :{entry.name}:
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Mention dropdown */}
      {mentionQuery !== null && mentionMatches.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 'var(--slacksim-space-5)',
            right: 'var(--slacksim-space-5)',
            marginBottom: 4,
            background: 'var(--slacksim-color-modal-bg)',
            border: '1px solid var(--slacksim-color-modal-border)',
            borderRadius: 'var(--slacksim-radius-md)',
            boxShadow: 'var(--slacksim-shadow-md)',
            overflow: 'hidden',
            zIndex: 100,
          }}
        >
          {mentionMatches.map((entry) => (
            <button
              key={entry.id}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(entry.username);
              }}
              className="ss-mention-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--slacksim-space-2)',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s ease',
              }}
            >
              <Avatar seed={entry.avatarSeed} size={20} url={entry.avatarUrl} />
              <span
                style={{
                  fontWeight: 'var(--slacksim-font-weight-bold)',
                  fontSize: 'var(--slacksim-font-size-md)',
                  color: 'var(--slacksim-color-fg)',
                }}
              >
                {entry.fullName}
              </span>
              {entry.kind === 'app' && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--slacksim-color-fg)',
                    background: 'var(--slacksim-color-divider)',
                    borderRadius: 'var(--slacksim-radius-sm)',
                    padding: '1px 5px',
                    letterSpacing: '0.04em',
                  }}
                >
                  APP
                </span>
              )}
              <span
                style={{
                  fontSize: 'var(--slacksim-font-size-sm)',
                  color: 'var(--slacksim-color-fg-muted)',
                  marginLeft: 'auto',
                }}
              >
                @{entry.username}
              </span>
            </button>
          ))}
        </div>
      )}

      {sendError && (
        <div
          style={{
            marginBottom: 'var(--slacksim-space-2)',
            padding: '6px 10px',
            background: 'var(--slacksim-color-danger-subtle, #fff0f0)',
            border: '1px solid var(--slacksim-color-danger, #e01e5a)',
            borderRadius: 'var(--slacksim-radius-sm)',
            color: 'var(--slacksim-color-danger, #e01e5a)',
            fontSize: 'var(--slacksim-font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--slacksim-space-2)',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {sendError}
        </div>
      )}

      <div
        style={{
          border: `1px solid ${canSend ? 'var(--slacksim-color-composer-border-focus)' : 'var(--slacksim-color-composer-border)'}`,
          borderRadius: 'var(--slacksim-radius-md)',
          background: 'var(--slacksim-color-composer-bg)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: 'var(--slacksim-space-2) var(--slacksim-space-3)',
          gap: 'var(--slacksim-space-2)',
          transition: 'border-color 0.15s ease',
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Custom placeholder — shown when empty, supports icon for private channels */}
          {!text && !placeholder && channel && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                pointerEvents: 'none',
                fontFamily: 'var(--slacksim-font-body)',
                fontSize: 'var(--slacksim-font-size-md)',
                color: 'var(--slacksim-color-fg-placeholder)',
                lineHeight: 1.46,
                userSelect: 'none',
              }}
            >
              {isIm ? (
                `Message ${dmName}`
              ) : (
                <>
                  <span>Message</span>
                  {isPrivateChannel ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="13"
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
                      style={{ fontWeight: 'var(--slacksim-font-weight-bold)' }}
                    >
                      #
                    </span>
                  )}
                  <span>{channel.name}</span>
                </>
              )}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            style={{
              display: 'block',
              width: '100%',
              border: 'none',
              outline: 'none',
              resize: 'none',
              background: 'transparent',
              fontFamily: 'var(--slacksim-font-body)',
              fontSize: 'var(--slacksim-font-size-md)',
              color: 'var(--slacksim-color-fg)',
              lineHeight: 1.46,
              overflowY: 'hidden',
            }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="ss-btn-primary"
          style={{
            background: canSend
              ? 'var(--slacksim-color-primary)'
              : 'var(--slacksim-color-primary-disabled)',
            color: canSend ? '#fff' : '#888',
            border: 'none',
            borderRadius: 'var(--slacksim-radius-sm)',
            cursor: canSend ? 'pointer' : 'default',
            padding: '5px 14px',
            fontFamily: 'var(--slacksim-font-body)',
            fontSize: 'var(--slacksim-font-size-sm)',
            fontWeight: 'var(--slacksim-font-weight-bold)',
            flexShrink: 0,
            transition: 'background 0.1s ease',
            minWidth: 60,
          }}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
