import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import type { Message as MessageType, User, App, Channel } from "@shared/types";
import { useStore } from "../../store";
import Avatar from "../Avatar";
import ReactionPicker from "./ReactionPicker";
import BlockKit from "./BlockKit";
import MentionChip from "./MentionChip";
import ChannelChip from "./ChannelChip";
import { controlApi } from "../../lib/api";

function renderText(
  text: string,
  users: User[],
  apps: App[],
  channels: Channel[],
  onChannelClick: (id: string) => void,
) {
  // Split on <#C001>, <@U001>, plain @username, plain #channelname
  const parts = text.split(
    /(<#\w+(?:\|\S*)?>|<@\w+>|@[\w-]+|#[\w-]+|:[a-z0-9_+\-]+:)/g,
  );
  return parts.map((part, i) => {
    // Channel mention: <#C001> or <#C001|general>
    const channelMention = part.match(/^<#(\w+)(?:\|(\S+))?>$/);
    if (channelMention) {
      const channelId = channelMention[1];
      const channel = channels.find((c) => c.id === channelId);
      const label = channel
        ? `#${channel.name}`
        : channelMention[2]
          ? `#${channelMention[2]}`
          : part;
      if (channel) {
        return (
          <ChannelChip
            key={i}
            label={label}
            channel={channel}
            users={users}
            onClick={() => onChannelClick(channelId)}
          />
        );
      }
      return (
        <span key={i} className="ss-mention" style={{ cursor: "default" }}>
          {label}
        </span>
      );
    }
    // Plain #channelname format
    if (part.startsWith("#")) {
      const name = part.slice(1);
      const channel = channels.find((c) => c.name === name);
      if (channel) {
        return (
          <ChannelChip
            key={i}
            label={part}
            channel={channel}
            users={users}
            onClick={() => onChannelClick(channel.id)}
          />
        );
      }
    }
    // User/bot mention: <@U001>
    const slackMention = part.match(/^<@(\w+)>$/);
    if (slackMention) {
      const user = users.find((u) => u.id === slackMention[1]);
      const bot = !user
        ? apps.find((a) => a.botUserId === slackMention[1])
        : undefined;
      if (user) {
        return (
          <MentionChip
            key={i}
            label={`@${user.username}`}
            seed={user.avatarSeed}
            fullName={user.fullName}
            username={user.username}
            url={user.avatarUrl}
          />
        );
      }
      if (bot) {
        return (
          <MentionChip
            key={i}
            label={`@${bot.botUserName}`}
            seed={bot.botUserName}
            fullName={bot.name}
            username={bot.botUserName}
            url={bot.avatarUrl}
          />
        );
      }
      return (
        <span key={i} className="ss-mention">
          @{slackMention[1]}
        </span>
      );
    }
    // Plain @username format
    if (part.startsWith("@")) {
      const username = part.slice(1);
      const user = users.find((u) => u.username === username);
      const bot = apps.find((a) => a.botUserName === username);
      if (user) {
        return (
          <MentionChip
            key={i}
            label={part}
            seed={user.avatarSeed}
            fullName={user.fullName}
            username={user.username}
            url={user.avatarUrl}
          />
        );
      }
      if (bot) {
        return (
          <MentionChip
            key={i}
            label={part}
            seed={bot.botUserName}
            fullName={bot.name}
            username={bot.botUserName}
            url={bot.avatarUrl}
          />
        );
      }
    }
    // Emoji shortcode: :rocket:, :thumbsup:, etc.
    if (/^:[a-z0-9_+\-]+:$/.test(part)) {
      const name = part.slice(1, -1);
      const emojiMap = useStore.getState().workspace?.emojiMap ?? {};
      const char = emojiMap[name];
      if (char)
        return (
          <span key={i} title={part}>
            {char}
          </span>
        );
      return (
        <span
          key={i}
          style={{
            fontFamily: "var(--slacksim-font-mono)",
            fontSize: "0.85em",
            background: "var(--slacksim-color-bg-secondary)",
            border: "1px solid var(--slacksim-color-border)",
            borderRadius: "var(--slacksim-radius-sm)",
            padding: "1px 4px",
            color: "var(--slacksim-color-fg-muted)",
          }}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface Props {
  message: MessageType;
  inThread?: boolean;
}

function formatTs(ts: string): string {
  const date = new Date(parseFloat(ts) * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatReplyTime(ts: string): string {
  const date = new Date(parseFloat(ts) * 1000);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays === 0)
    return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 7)} weeks ago`;
  const years = Math.floor(diffDays / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

export default function Message({ message, inThread = false }: Props) {
  const {
    users,
    apps,
    channels,
    actingUserId,
    setActiveThread,
    setActiveChannel,
  } = useStore();
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const reactionBtnRef = useRef<HTMLButtonElement>(null);

  function openReactionPicker() {
    if (showReactionPicker) {
      setShowReactionPicker(false);
      return;
    }
    const btn = reactionBtnRef.current;
    if (btn) {
      const r = btn.getBoundingClientRect();
      setPickerPos({ top: r.top, left: r.right });
    }
    setShowReactionPicker(true);
  }

  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showReactionPicker) return;
    function handleOutside(e: MouseEvent) {
      if (
        reactionBtnRef.current?.contains(e.target as Node) ||
        pickerRef.current?.contains(e.target as Node)
      )
        return;
      setShowReactionPicker(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showReactionPicker]);

  const author = users.find((u) => u.id === message.user);
  const botApp = !author
    ? apps.find((a) => a.botUserId === message.user)
    : undefined;
  const seed = author?.avatarSeed ?? botApp?.botUserName ?? message.user;
  const avatarUrl = author?.avatarUrl ?? botApp?.avatarUrl;
  const name = author?.fullName ?? botApp?.name ?? message.user;

  async function handleReactionToggle(emoji: string) {
    try {
      await controlApi.toggleReaction(message.id, emoji);
    } catch (e) {
      console.error("Failed to toggle reaction", e);
    }
  }

  async function handleReactionPillClick(reactionName: string) {
    try {
      await controlApi.toggleReaction(message.id, reactionName);
    } catch (e) {
      console.error("Failed to toggle reaction", e);
    }
  }

  async function handlePinToggle() {
    try {
      await controlApi.pinMessage(message.id, !message.pinned);
    } catch (e) {
      console.error("Failed to toggle pin", e);
    }
  }

  // Render system join/leave/archive messages like a regular message but faint
  const isSystemMsg =
    message.subtype === "channel_join" ||
    message.subtype === "channel_leave" ||
    message.subtype === "channel_archive" ||
    message.subtype === "channel_unarchive";
  if (isSystemMsg) {
    return (
      <div
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        style={{
          display: "flex",
          gap: "var(--slacksim-space-3)",
          padding: "var(--slacksim-space-1) var(--slacksim-space-5)",
          background: showActions
            ? "var(--slacksim-color-bg-hover)"
            : "transparent",
        }}
      >
        <Avatar seed={seed} size={36} alt={name} url={avatarUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--slacksim-space-2)",
              marginBottom: "var(--slacksim-space-1)",
            }}
          >
            <span
              style={{
                fontWeight: "var(--slacksim-font-weight-bold)",
                fontSize: "var(--slacksim-font-size-md)",
                color: "var(--slacksim-color-fg)",
              }}
            >
              {name}
            </span>
            <span
              style={{
                fontSize: "var(--slacksim-font-size-sm)",
                color: "var(--slacksim-color-fg-muted)",
              }}
            >
              {formatTs(message.ts)}
            </span>
          </div>
          <span
            style={{
              fontSize: "var(--slacksim-font-size-md)",
              color: "var(--slacksim-color-fg-muted)",
              lineHeight: 1.46,
            }}
          >
            {message.text}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactionPicker(false);
      }}
      style={{
        display: "flex",
        gap: "var(--slacksim-space-3)",
        padding: "var(--slacksim-space-1) var(--slacksim-space-5)",
        position: "relative",
        background: showActions
          ? "var(--slacksim-color-bg-hover)"
          : "transparent",
      }}
    >
      <Avatar seed={seed} size={36} alt={name} url={avatarUrl} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Author + timestamp */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--slacksim-space-2)",
            marginBottom: "var(--slacksim-space-1)",
          }}
        >
          <span
            style={{
              fontWeight: "var(--slacksim-font-weight-bold)",
              fontSize: "var(--slacksim-font-size-md)",
              color: "var(--slacksim-color-fg)",
            }}
          >
            {name}
          </span>
          {botApp && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: "var(--slacksim-color-fg)",
                background: "var(--slacksim-color-divider)",
                borderRadius: "var(--slacksim-radius-sm)",
                padding: "1px 5px",
                letterSpacing: "0.04em",
              }}
            >
              APP
            </span>
          )}
          {message.pinned && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: "var(--slacksim-color-primary)",
                background: "var(--slacksim-color-bg-secondary)",
                border: "1px solid var(--slacksim-color-border)",
                borderRadius: "var(--slacksim-radius-sm)",
                padding: "1px 5px",
                letterSpacing: "0.04em",
              }}
            >
              Pinned
            </span>
          )}
          {message.subtype === "ephemeral" && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: "var(--slacksim-color-fg-muted)",
                background: "var(--slacksim-color-bg-secondary)",
                border: "1px solid var(--slacksim-color-border)",
                borderRadius: "var(--slacksim-radius-sm)",
                padding: "1px 5px",
                letterSpacing: "0.04em",
              }}
            >
              Only visible to you
            </span>
          )}
          <span
            style={{
              fontSize: "var(--slacksim-font-size-sm)",
              color: "var(--slacksim-color-fg-muted)",
            }}
          >
            {formatTs(message.ts)}
          </span>
        </div>

        {/* Message body — blocks take priority; fall back to plain text */}
        {message.blocks?.length ? (
          <div style={{ marginTop: "var(--slacksim-space-1)" }}>
            <BlockKit
              blocks={message.blocks}
              channelId={message.channel}
              messageTs={message.ts}
              appId={message.appId ?? botApp?.id ?? ""}
            />
          </div>
        ) : (
          <div
            style={{
              fontSize: "var(--slacksim-font-size-md)",
              color: "var(--slacksim-color-fg)",
              lineHeight: 1.46,
              wordBreak: "break-word",
            }}
          >
            {renderText(message.text, users, apps, channels, setActiveChannel)}
          </div>
        )}

        {/* Unfurl previews */}
        {message.unfurls && Object.keys(message.unfurls).length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--slacksim-space-2)",
              marginTop: "var(--slacksim-space-2)",
            }}
          >
            {Object.entries(message.unfurls).map(([url, attachment]) => (
              <div
                key={url}
                style={{
                  borderLeft: `4px solid ${(attachment as { color?: string }).color ?? "var(--slacksim-color-border)"}`,
                  paddingLeft: "var(--slacksim-space-3)",
                  paddingTop: "var(--slacksim-space-2)",
                  paddingBottom: "var(--slacksim-space-2)",
                  maxWidth: 500,
                }}
              >
                {(attachment as { blocks?: unknown[] }).blocks?.length ? (
                  <BlockKit
                    blocks={
                      ((attachment as { blocks: unknown[] })
                        .blocks as MessageType["blocks"]) || []
                    }
                    channelId={message.channel}
                    messageTs={message.ts}
                    appId={message.appId ?? botApp?.id ?? ""}
                  />
                ) : (
                  <>
                    {(attachment as { title?: string; title_link?: string })
                      .title && (
                      <div
                        style={{
                          fontWeight: "var(--slacksim-font-weight-bold)",
                          fontSize: "var(--slacksim-font-size-md)",
                          marginBottom: 2,
                        }}
                      >
                        {(attachment as { title_link?: string }).title_link ? (
                          <a
                            href={
                              (attachment as { title_link: string }).title_link
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "var(--slacksim-color-accent)",
                              textDecoration: "none",
                            }}
                          >
                            {(attachment as { title: string }).title}
                          </a>
                        ) : (
                          (attachment as { title: string }).title
                        )}
                      </div>
                    )}
                    {(attachment as { text?: string }).text && (
                      <div
                        style={{
                          fontSize: "var(--slacksim-font-size-sm)",
                          color: "var(--slacksim-color-fg-muted)",
                          lineHeight: 1.46,
                        }}
                      >
                        {(attachment as { text: string }).text}
                      </div>
                    )}
                    {(attachment as { image_url?: string }).image_url && (
                      <img
                        src={(attachment as { image_url: string }).image_url}
                        alt={(attachment as { title?: string }).title ?? ""}
                        style={{
                          maxWidth: 360,
                          maxHeight: 200,
                          marginTop: "var(--slacksim-space-2)",
                          borderRadius: "var(--slacksim-radius-sm)",
                          display: "block",
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--slacksim-space-1)",
              marginTop: "var(--slacksim-space-1)",
            }}
          >
            {message.reactions.map((reaction) => {
              const isMine = reaction.users.includes(actingUserId);
              return (
                <button
                  key={reaction.name}
                  onClick={() => handleReactionPillClick(reaction.name)}
                  title={reaction.users.join(", ")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--slacksim-space-1)",
                    padding: "4px 6px",
                    background: isMine
                      ? "var(--slacksim-color-reaction-bg-mine)"
                      : "var(--slacksim-color-reaction-bg)",
                    border: isMine
                      ? "1px solid var(--slacksim-color-reaction-border-mine)"
                      : "1px solid var(--slacksim-color-reaction-border)",
                    borderRadius: "var(--slacksim-radius-pill)",
                    cursor: "pointer",
                    fontSize: "var(--slacksim-font-size-sm)",
                    color: "var(--slacksim-color-fg)",
                    lineHeight: 1,
                  }}
                >
                  <span>
                    {useStore.getState().workspace?.emojiMap?.[reaction.name] ??
                      `:${reaction.name}:`}
                  </span>
                  <span
                    style={{
                      fontWeight: "var(--slacksim-font-weight-bold)",
                      color: "var(--slacksim-color-accent)",
                    }}
                  >
                    {reaction.users.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Thread reply indicator */}
        {!message.threadTs && (message.replyCount ?? 0) > 0 && (
          <button
            onClick={() => setActiveThread(message.ts)}
            className="ss-thread-footer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--slacksim-space-2)",
              marginTop: "var(--slacksim-space-1)",
              padding: "3px 6px 3px 2px",
              background: "transparent",
              border: "none",
              borderRadius: "var(--slacksim-radius-sm)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {/* Participant avatars */}
            <div style={{ display: "flex", alignItems: "center" }}>
              {(message.replyUsers ?? []).map((uid, i) => {
                const u = users.find((u) => u.id === uid);
                const bot = !u
                  ? apps.find((a) => a.botUserId === uid)
                  : undefined;
                const seed = u?.avatarSeed ?? bot?.botUserName ?? uid;
                const url = u?.avatarUrl ?? bot?.avatarUrl;
                const label = u?.fullName ?? bot?.name;
                return (
                  <div
                    key={uid}
                    style={{
                      marginLeft: i === 0 ? 0 : -6,
                      zIndex: (message.replyUsers?.length ?? 0) - i,
                    }}
                  >
                    <Avatar seed={seed} size={18} alt={label} url={url} />
                  </div>
                );
              })}
            </div>
            {/* Reply count */}
            <span
              style={{
                fontSize: "var(--slacksim-font-size-sm)",
                fontWeight: "var(--slacksim-font-weight-bold)",
                color: "var(--slacksim-color-accent)",
              }}
            >
              {message.replyCount}{" "}
              {message.replyCount === 1 ? "reply" : "replies"}
            </span>
            {/* Last reply time */}
            {message.latestReplyTs && (
              <span
                style={{
                  fontSize: "var(--slacksim-font-size-sm)",
                  color: "var(--slacksim-color-fg-muted)",
                }}
              >
                {formatReplyTime(message.latestReplyTs)}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Hover action buttons */}
      {showActions && (
        <div
          style={{
            position: "absolute",
            top: "var(--slacksim-space-1)",
            right: "var(--slacksim-space-4)",
            display: "flex",
            gap: "var(--slacksim-space-1)",
            background: "var(--slacksim-color-modal-bg)",
            border: "1px solid var(--slacksim-color-border)",
            borderRadius: "var(--slacksim-radius-md)",
            boxShadow: "var(--slacksim-shadow-sm)",
            padding: "2px 4px",
            zIndex: 10,
          }}
        >
          {!inThread && (
            <button
              onClick={handlePinToggle}
              title={message.pinned ? "Unpin message" : "Pin message"}
              className="ss-action-btn"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: "var(--slacksim-radius-sm)",
                color: message.pinned
                  ? "var(--slacksim-color-primary)"
                  : "var(--slacksim-color-fg-muted)",
                lineHeight: 1,
                transition: "background 0.1s ease",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {message.pinned ? (
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
                >
                  <path d="M12 17v5" />
                  <path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89" />
                  <path d="m2 2 20 20" />
                  <path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11" />
                </svg>
              ) : (
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
                >
                  <path d="M12 17v5" />
                  <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                </svg>
              )}
            </button>
          )}
          <div style={{ position: "relative" }}>
            <button
              ref={reactionBtnRef}
              onClick={openReactionPicker}
              title="Add reaction"
              className="ss-action-btn"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: "var(--slacksim-radius-sm)",
                color: "var(--slacksim-color-fg-muted)",
                lineHeight: 1,
                transition: "background 0.1s ease",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                aria-hidden="true"
                style={{ width: 16, height: 16 }}
              >
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M15.5 1a.75.75 0 0 1 .75.75v2h2a.75.75 0 0 1 0 1.5h-2v2a.75.75 0 0 1-1.5 0v-2h-2a.75.75 0 0 1 0-1.5h2v-2A.75.75 0 0 1 15.5 1m-13 10a6.5 6.5 0 0 1 7.166-6.466.75.75 0 0 0 .152-1.493 8 8 0 1 0 7.14 7.139.75.75 0 0 0-1.492.152A7 7 0 0 1 15.5 11a6.5 6.5 0 1 1-13 0m4.25-.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5m4.5 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5M9 15c1.277 0 2.553-.724 3.06-2.173.148-.426-.209-.827-.66-.827H6.6c-.452 0-.808.4-.66.827C6.448 14.276 7.724 15 9 15"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          {!inThread && (
            <button
              onClick={() => setActiveThread(message.ts)}
              title="Reply in thread"
              className="ss-action-btn"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: "var(--slacksim-radius-sm)",
                color: "var(--slacksim-color-fg-muted)",
                lineHeight: 1,
                transition: "background 0.1s ease",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                aria-hidden="true"
                style={{ width: 16, height: 16 }}
              >
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M10 3a7 7 0 1 0 3.394 13.124.75.75 0 0 1 .542-.074l2.794.68-.68-2.794a.75.75 0 0 1 .073-.542A7 7 0 0 0 10 3m-8.5 7a8.5 8.5 0 1 1 16.075 3.859l.904 3.714a.75.75 0 0 1-.906.906l-3.714-.904A8.5 8.5 0 0 1 1.5 10M6 8.25a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 8.25M6.75 11a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Reaction picker — portalled to body so it escapes overflow:auto clipping */}
      {showReactionPicker &&
        pickerPos &&
        ReactDOM.createPortal(
          <div
            ref={pickerRef}
            style={{
              position: "fixed",
              top: pickerPos.top,
              left: pickerPos.left,
              transform: "translateX(-100%) translateY(-100%)",
              zIndex: 1000,
            }}
          >
            <ReactionPicker
              onSelect={handleReactionToggle}
              onClose={() => setShowReactionPicker(false)}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
