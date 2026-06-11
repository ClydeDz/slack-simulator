import React from "react";
import { useStore } from "../../store";
import MessageList from "./MessageList";
import Composer from "./Composer";
import ChannelChip from "./ChannelChip";
import { controlApi } from "../../lib/api";

export default function MainPane() {
  const { activeChannelId, channels, apps, users, actingUserId } = useStore();

  const channel = channels.find((c) => c.id === activeChannelId);

  if (!activeChannelId || !channel) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--slacksim-color-bg)",
          color: "var(--slacksim-color-fg-muted)",
          fontSize: "var(--slacksim-font-size-lg)",
        }}
      >
        Select a channel to start messaging
      </div>
    );
  }

  const isIm = channel.type === "im" || channel.type === "mpim";

  // Resolve display names for all DM members
  const dmMemberNames = isIm
    ? channel.members.map((id) => {
        const u = users.find((u) => u.id === id);
        if (u) return u.fullName;
        const a = apps.find((a) => a.botUserId === id);
        return a?.name ?? id;
      })
    : [];

  // Header title: for DMs show the other person's name (or all names if mpim)
  const headerName = isIm
    ? (() => {
        const others = channel.members.filter((id) => id !== actingUserId);
        if (others.length === 0) return dmMemberNames.join(", ");
        return others
          .map((id) => {
            const u = users.find((u) => u.id === id);
            if (u) return u.fullName;
            const a = apps.find((a) => a.botUserId === id);
            return a?.name ?? id;
          })
          .join(", ");
      })()
    : channel.name;

  const isMember = channel.members.includes(actingUserId);

  const humanCount = channel.members.filter((id) =>
    users.some((u) => u.id === id),
  ).length;
  const botCount = apps.length;
  const memberLabel = !isIm
    ? humanCount > 0 && botCount > 0
      ? `${humanCount} members and ${botCount} ${botCount === 1 ? "app" : "apps"}`
      : humanCount > 0
        ? `${humanCount} ${humanCount === 1 ? "member" : "members"}`
        : `${botCount} ${botCount === 1 ? "app" : "apps"}`
    : "";

  async function handleJoinLeave() {
    try {
      if (isMember) {
        await controlApi.leaveChannel(activeChannelId!);
      } else {
        await controlApi.joinChannel(activeChannelId!);
      }
    } catch (e) {
      console.error("Failed to join/leave channel", e);
    }
  }

  async function handleArchive() {
    if (!channel) return;
    const action = channel.archived ? "Unarchive" : "Archive";
    if (!confirm(`${action} #${channel.name}?`)) return;
    try {
      await controlApi.archiveChannel(activeChannelId!);
    } catch (e) {
      console.error("Failed to archive/unarchive channel", e);
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--slacksim-color-bg)",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {/* Channel header */}
      <div
        style={{
          height: "var(--slacksim-channel-header-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--slacksim-space-5) var(--slacksim-space-5)",
          flexShrink: 0,
          background: "var(--slacksim-color-bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--slacksim-space-2)",
          }}
        >
          {!isIm &&
            (channel.type === "private" ? (
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
                style={{
                  flexShrink: 0,
                  color: "var(--slacksim-color-fg-muted)",
                  marginRight: -2,
                }}
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
                style={{
                  flexShrink: 0,
                  color: "var(--slacksim-color-fg-muted)",
                  marginRight: -2,
                }}
              >
                <line x1="4" x2="20" y1="9" y2="9" />
                <line x1="4" x2="20" y1="15" y2="15" />
                <line x1="10" x2="8" y1="3" y2="21" />
                <line x1="16" x2="14" y1="3" y2="21" />
              </svg>
            ))}
          <span
            style={{
              fontWeight: "var(--slacksim-font-weight-bold)",
              fontSize: "var(--slacksim-font-size-md)",
              color: "var(--slacksim-color-fg)",
            }}
          >
            {headerName}
          </span>
          {!isIm && (
            <ChannelChip
              label={memberLabel}
              channel={channel}
              users={users}
              apps={apps}
              plain
            />
          )}
        </div>

        {/* Join / Leave + Archive buttons (non-DM channels only) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--slacksim-space-2)",
          }}
        >
          {!isIm && !channel.archived && (
            <button
              onClick={handleJoinLeave}
              className="ss-header-btn-filled"
              style={{
                background: isMember
                  ? "var(--slacksim-color-sidebar-badge-bg)"
                  : "var(--slacksim-color-primary)",
                color: "var(--slacksim-color-sidebar-fg-active)",
                border: "none",
                borderRadius: "var(--slacksim-radius-sm)",
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: "var(--slacksim-font-size-sm)",
                fontWeight: "var(--slacksim-font-weight-bold)",
                fontFamily: "var(--slacksim-font-body)",
              }}
            >
              {isMember ? "Leave Channel" : "Join Channel"}
            </button>
          )}
          {!isIm && (
            <button
              onClick={handleArchive}
              className={
                channel.archived
                  ? "ss-header-btn-filled"
                  : "ss-header-btn-outline"
              }
              style={{
                background: channel.archived
                  ? "var(--slacksim-color-primary)"
                  : "transparent",
                color: channel.archived
                  ? "var(--slacksim-color-sidebar-fg-active)"
                  : "var(--slacksim-color-fg-muted)",
                border: "1px solid var(--slacksim-color-border)",
                borderRadius: "var(--slacksim-radius-sm)",
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: "var(--slacksim-font-size-sm)",
                fontWeight: "var(--slacksim-font-weight-bold)",
                fontFamily: "var(--slacksim-font-body)",
              }}
            >
              {channel.archived ? "Unarchive" : "Archive"}
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid var(--slacksim-color-border)",
          padding: "0 var(--slacksim-space-5)",
          flexShrink: 0,
          background: "var(--slacksim-color-bg)",
          gap: "var(--slacksim-space-1)",
        }}
      >
        <button
          className="ss-tab-btn"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--slacksim-space-2)",
            padding: "10px 4px 9px",
            background: "transparent",
            border: "none",
            borderBottom: "2px solid var(--slacksim-color-fg)",
            cursor: "pointer",
            fontSize: "var(--slacksim-font-size-sm)",
            fontWeight: "var(--slacksim-font-weight-bold)",
            color: "var(--slacksim-color-fg)",
            fontFamily: "var(--slacksim-font-body)",
            marginBottom: -1,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="var(--slacksim-color-fg)"
            stroke="var(--slacksim-color-fg)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
          </svg>
          Messages
        </button>
      </div>

      <MessageList />
      <Composer channelId={activeChannelId} />
    </div>
  );
}
