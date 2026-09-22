import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../store';
import { controlApi } from '../../lib/api';
import MessageComponent from '../MainPane/Message';
import Composer from '../MainPane/Composer';
import type { Message } from '@shared/types';

export default function ThreadPane() {
  const {
    activeChannelId,
    activeThreadTs,
    setActiveThread,
    messages,
    setChannelMessages,
  } = useStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const threadKey = `thread:${activeThreadTs}`;

  const { isLoading } = useQuery({
    queryKey: ['thread', activeChannelId, activeThreadTs],
    queryFn: async () => {
      if (!activeChannelId || !activeThreadTs) return [];
      const result = await fetch(`/api/conversations.replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer xoxb-slacksim-default',
        },
        body: JSON.stringify({ channel: activeChannelId, ts: activeThreadTs }),
      }).then((r) => r.json());

      if (result.ok && result.messages) {
        const threadMessages: Message[] = result.messages.map((m: any) => ({
          id: m.ts,
          channel: activeChannelId,
          user: m.user,
          text: m.text,
          ts: m.ts,
          threadTs: m.thread_ts,
          reactions: (m.reactions ?? []).map((r: any) => ({
            name: r.name,
            users: r.users,
          })),
        }));
        setChannelMessages(threadKey, threadMessages);
        return threadMessages;
      }
      return [];
    },
    enabled: !!activeChannelId && !!activeThreadTs,
  });

  const threadMessages = messages[threadKey] ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length]);

  if (!activeThreadTs || !activeChannelId) return null;

  return (
    <div
      style={{
        width: 'var(--slacksim-thread-width)',
        flexShrink: 0,
        borderLeft: '1px solid var(--slacksim-color-border)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--slacksim-color-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Thread header */}
      <div
        style={{
          height: 'var(--slacksim-channel-header-height)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--slacksim-space-3) var(--slacksim-space-5) 0',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontWeight: 'var(--slacksim-font-weight-bold)',
            fontSize: 'var(--slacksim-font-size-md)',
            color: 'var(--slacksim-color-fg)',
          }}
        >
          Thread
        </span>
        <button
          onClick={() => setActiveThread(null)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--slacksim-font-size-lg)',
            color: 'var(--slacksim-color-fg-muted)',
            padding: 'var(--slacksim-space-1)',
            lineHeight: 1,
          }}
          title="Close thread"
        >
          ✕
        </button>
      </div>

      {/* Thread messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--slacksim-space-4) 0',
        }}
      >
        {isLoading && threadMessages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--slacksim-color-fg-muted)',
              fontSize: 'var(--slacksim-font-size-md)',
            }}
          >
            Loading thread…
          </div>
        ) : (
          threadMessages.map((msg, i) => {
            const isParent = i === 0;
            const replyCount = threadMessages.length - 1;
            const showSeparator = i === 1; // separator goes between parent and first reply
            return (
              <React.Fragment key={msg.ts}>
                {showSeparator && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px var(--slacksim-space-4)',
                      gap: 'var(--slacksim-space-2)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--slacksim-font-size-sm)',
                        color: 'var(--slacksim-color-fg-muted)',
                        fontWeight: 'var(--slacksim-font-weight-normal)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {replyCount === 1 ? '1 reply' : `${replyCount} replies`}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: 'var(--slacksim-color-divider)',
                      }}
                    />
                  </div>
                )}
                <MessageComponent message={msg} inThread />
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Thread composer */}
      <Composer
        channelId={activeChannelId}
        threadTs={activeThreadTs}
        placeholder="Reply in thread…"
      />
    </div>
  );
}
