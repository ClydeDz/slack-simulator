import { create } from "zustand";
import type {
  User,
  Channel,
  Workspace,
  App,
  Message,
  WsEvent,
  LogEntry,
  ModalView,
} from "@shared/types";

interface WorkspaceState {
  workspace: Workspace | null;
  users: User[];
  channels: Channel[];
  apps: App[];

  // Active state
  actingUserId: string;
  activeChannelId: string | null;
  activeThreadTs: string | null;
  activeTab: "workspace" | "admin" | "logs" | "database";
  theme: "Slack Light" | "Slack Dark";

  // Messages (keyed by channelId)
  messages: Record<string, Message[]>;

  // Unread DM counts (keyed by channelId)
  unreadCounts: Record<string, number>;

  // Incremented on workspace reset so query keys bust the TanStack cache
  resetAt: number;

  // Logs (live event stream)
  logs: LogEntry[];
  setLogs: (logs: LogEntry[]) => void;
  addLog: (entry: LogEntry) => void;

  // App config update
  updateAppConfig: (app: App) => void;

  // Modal stack (Block Kit interactivity — last item is top/visible)
  activeModals: Array<{ view: ModalView; appId: string }>;
  openModal: (view: ModalView, appId: string) => void;
  closeModal: () => void;
  closeAllModals: () => void;
  updateTopModal: (view: ModalView) => void;

  // Actions
  setWorkspaceData: (data: {
    workspace: Workspace;
    users: User[];
    channels: Channel[];
    apps: App[];
  }) => void;
  setActingUser: (userId: string) => void;
  setActiveChannel: (channelId: string) => void;
  setActiveThread: (ts: string | null) => void;
  setActiveTab: (tab: "workspace" | "admin" | "logs" | "database") => void;
  setTheme: (theme: "Slack Light" | "Slack Dark") => void;
  setChannelMessages: (channelId: string, messages: Message[]) => void;
  applyWsEvent: (event: WsEvent) => void;
  addChannel: (channel: Channel) => void;
}

export const useStore = create<WorkspaceState>((set, get) => ({
  workspace: null,
  users: [],
  channels: [],
  apps: [],
  actingUserId: "U001",
  activeChannelId: null,
  activeThreadTs: null,
  activeTab: "workspace",
  theme: "Slack Light",
  messages: {},
  unreadCounts: {},
  resetAt: 0,
  logs: [],
  activeModals: [],

  setWorkspaceData: ({ workspace, users, channels, apps }) => {
    set({
      workspace,
      users,
      channels,
      apps,
      actingUserId: users[0]?.id ?? "U001",
      activeChannelId: channels[0]?.id ?? null,
    });
  },

  setActingUser: (userId) => set({ actingUserId: userId }),
  setActiveChannel: (channelId) =>
    set((s) => ({
      activeChannelId: channelId,
      activeThreadTs: null,
      unreadCounts: { ...s.unreadCounts, [channelId]: 0 },
    })),
  setActiveThread: (ts) => set({ activeThreadTs: ts }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTheme: (theme) => set({ theme }),
  setChannelMessages: (channelId, messages) =>
    set((s) => ({ messages: { ...s.messages, [channelId]: messages } })),

  addChannel: (channel) => set((s) => ({ channels: [...s.channels, channel] })),

  openModal: (view, appId) =>
    set((s) => ({ activeModals: [...s.activeModals, { view, appId }] })),
  closeModal: () => set((s) => ({ activeModals: s.activeModals.slice(0, -1) })),
  closeAllModals: () => set({ activeModals: [] }),
  updateTopModal: (view) =>
    set((s) => {
      if (s.activeModals.length === 0) return {};
      const updated = [...s.activeModals];
      updated[updated.length - 1] = { ...updated[updated.length - 1], view };
      return { activeModals: updated };
    }),

  setLogs: (logs) => set({ logs }),
  addLog: (entry) => set((s) => ({ logs: [entry, ...s.logs].slice(0, 300) })),
  updateAppConfig: (app) =>
    set((s) => ({ apps: s.apps.map((a) => (a.id === app.id ? app : a)) })),

  applyWsEvent: (event) => {
    const s = get();
    switch (event.type) {
      case "message_new": {
        const { message } = event;
        if (!message.threadTs) {
          set((st) => {
            const channel = st.channels.find((c) => c.id === message.channel);
            const isDm = channel?.type === "im" || channel?.type === "mpim";
            const isActive = st.activeChannelId === message.channel;
            const isFromActingUser = message.user === st.actingUserId;
            const unreadCounts =
              isDm && !isActive && !isFromActingUser
                ? {
                    ...st.unreadCounts,
                    [message.channel]:
                      (st.unreadCounts[message.channel] ?? 0) + 1,
                  }
                : st.unreadCounts;
            return {
              messages: {
                ...st.messages,
                [message.channel]: [
                  ...(st.messages[message.channel] ?? []),
                  message,
                ],
              },
              unreadCounts,
            };
          });
        } else {
          // Append to thread view AND bump reply metadata on the parent message
          set((st) => {
            const channelMsgs = st.messages[message.channel] ?? [];
            const updatedChannelMsgs = channelMsgs.map((m) => {
              if (m.ts !== message.threadTs) return m;
              const prevUsers = m.replyUsers ?? [];
              const newUsers = prevUsers.includes(message.user)
                ? prevUsers
                : [...prevUsers, message.user].slice(0, 4);
              return {
                ...m,
                replyCount: (m.replyCount ?? 0) + 1,
                replyUsers: newUsers,
                latestReplyTs: message.ts,
              };
            });
            return {
              messages: {
                ...st.messages,
                [message.channel]: updatedChannelMsgs,
                [`thread:${message.threadTs}`]: [
                  ...(st.messages[`thread:${message.threadTs}`] ?? []),
                  message,
                ],
              },
            };
          });
        }
        break;
      }
      case "reaction_updated": {
        const { ts, channelId, reactions } = event;
        set((st) => {
          // Update main channel messages
          const updatedChannelMessages = (st.messages[channelId] ?? []).map(
            (m) => (m.ts === ts ? { ...m, reactions } : m),
          );

          // Also update thread messages if they exist
          const updatedMessages = { ...st.messages };
          updatedMessages[channelId] = updatedChannelMessages;

          // Check all thread keys and update if the message is there
          Object.keys(updatedMessages).forEach((key) => {
            if (key.startsWith("thread:")) {
              updatedMessages[key] = (updatedMessages[key] ?? []).map((m) =>
                m.ts === ts ? { ...m, reactions } : m,
              );
            }
          });

          return { messages: updatedMessages };
        });
        break;
      }
      case "channel_created":
        set((st) => ({ channels: [...st.channels, event.channel] }));
        break;
      case "channel_updated":
        set((st) => ({
          channels: st.channels.map((c) =>
            c.id === event.channel.id ? event.channel : c,
          ),
        }));
        break;
      case "log_entry":
        get().addLog(event.entry);
        break;
      case "workspace_reset":
        set({
          messages: {},
          unreadCounts: {},
          activeChannelId: null,
          activeThreadTs: null,
          resetAt: Date.now(),
        });
        // Refetch workspace data
        fetch("/_control/workspace")
          .then((r) => r.json())
          .then((data) => {
            get().setWorkspaceData(data);
          });
        break;
      case "message_updated": {
        const { message } = event;
        set((st) => ({
          messages: {
            ...st.messages,
            [message.channel]: (st.messages[message.channel] ?? []).map((m) =>
              m.ts === message.ts ? message : m,
            ),
          },
        }));
        break;
      }
      case "message_deleted": {
        const { channelId, ts } = event;
        set((st) => ({
          messages: {
            ...st.messages,
            [channelId]: (st.messages[channelId] ?? []).filter(
              (m) => m.ts !== ts,
            ),
          },
        }));
        break;
      }
      case "modal_open":
        set((st) => ({
          activeModals: [
            ...st.activeModals,
            { view: event.view, appId: event.appId },
          ],
        }));
        break;
      case "modal_push":
        set((st) => ({
          activeModals: [
            ...st.activeModals,
            { view: event.view, appId: event.appId },
          ],
        }));
        break;
      case "modal_update":
        set((st) => {
          const idx = st.activeModals.findIndex(
            (m) => m.view.id === event.view.id,
          );
          if (idx < 0) return {};
          const updated = [...st.activeModals];
          updated[idx] = { ...updated[idx], view: event.view };
          return { activeModals: updated };
        });
        break;
      case "modal_close":
        set((st) => ({
          activeModals: st.activeModals.filter(
            (m) => m.view.id !== event.viewId,
          ),
        }));
        break;
    }
  },
}));
