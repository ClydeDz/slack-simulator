import { describe, it, expect, beforeEach, vi } from "vitest";
import { useStore } from "./index";

describe("WorkspaceState", () => {
  beforeEach(() => {
    // Reset the store before each test
    useStore.setState({
      workspace: null,
      users: [],
      channels: [],
      apps: [],
      actingUserId: "U001",
      activeChannelId: null,
      activeThreadTs: null,
      activeTab: "workspace",
      messages: {},
      unreadCounts: {},
      resetAt: 0,
      logs: [],
      activeModals: [],
    });
  });

  describe("Initial State", () => {
    it("should have correct default state values", () => {
      const state = useStore.getState();
      expect(state.workspace).toBeNull();
      expect(state.users).toEqual([]);
      expect(state.channels).toEqual([]);
      expect(state.apps).toEqual([]);
      expect(state.actingUserId).toBe("U001");
      expect(state.activeChannelId).toBeNull();
      expect(state.activeThreadTs).toBeNull();
      expect(state.activeTab).toBe("workspace");
      expect(state.messages).toEqual({});
      expect(state.unreadCounts).toEqual({});
      expect(state.resetAt).toBe(0);
      expect(state.logs).toEqual([]);
      expect(state.activeModals).toEqual([]);
    });
  });

  describe("setWorkspaceData", () => {
    it("should set workspace, users, channels, apps correctly", () => {
      const workspaceData = {
        workspace: { id: "W001", name: "Test Workspace", domain: "test" },
        users: [
          {
            id: "U001",
            username: "alice",
            fullName: "Alice",
            email: "alice@test.com",
            avatarSeed: "alice",
          },
        ],
        channels: [
          {
            id: "C001",
            name: "general",
            type: "public" as const,
            members: ["U001"],
          },
        ],
        apps: [],
      };

      useStore.getState().setWorkspaceData(workspaceData);

      const state = useStore.getState();
      expect(state.workspace).toEqual(workspaceData.workspace);
      expect(state.users).toEqual(workspaceData.users);
      expect(state.channels).toEqual(workspaceData.channels);
      expect(state.apps).toEqual(workspaceData.apps);
    });

    it("should default actingUserId to first user", () => {
      const workspaceData = {
        workspace: { id: "W001", name: "Test Workspace", domain: "test" },
        users: [
          {
            id: "U001",
            username: "alice",
            fullName: "Alice",
            email: "alice@test.com",
            avatarSeed: "alice",
          },
        ],
        channels: [],
        apps: [],
      };

      useStore.getState().setWorkspaceData(workspaceData);

      expect(useStore.getState().actingUserId).toBe("U001");
    });

    it("should default activeChannelId to first channel", () => {
      const workspaceData = {
        workspace: { id: "W001", name: "Test Workspace", domain: "test" },
        users: [],
        channels: [
          { id: "C001", name: "general", type: "public" as const, members: [] },
        ],
        apps: [],
      };

      useStore.getState().setWorkspaceData(workspaceData);

      expect(useStore.getState().activeChannelId).toBe("C001");
    });
  });

  describe("setActingUser", () => {
    it("should update actingUserId correctly", () => {
      useStore.getState().setActingUser("U002");
      expect(useStore.getState().actingUserId).toBe("U002");
    });
  });

  describe("setActiveChannel", () => {
    it("should update activeChannelId", () => {
      useStore.getState().setActiveChannel("C001");
      expect(useStore.getState().activeChannelId).toBe("C001");
    });

    it("should clear activeThreadTs", () => {
      useStore.setState({ activeThreadTs: "1234567890.000001" });
      useStore.getState().setActiveChannel("C001");
      expect(useStore.getState().activeThreadTs).toBeNull();
    });

    it("should reset unreadCount for the channel to 0", () => {
      useStore.setState({ unreadCounts: { C001: 5 } });
      useStore.getState().setActiveChannel("C001");
      expect(useStore.getState().unreadCounts["C001"]).toBe(0);
    });
  });

  describe("setActiveThread", () => {
    it("should update activeThreadTs", () => {
      useStore.getState().setActiveThread("1234567890.000001");
      expect(useStore.getState().activeThreadTs).toBe("1234567890.000001");
    });
  });

  describe("setActiveTab", () => {
    it("should switch tabs correctly", () => {
      useStore.getState().setActiveTab("admin");
      expect(useStore.getState().activeTab).toBe("admin");

      useStore.getState().setActiveTab("logs");
      expect(useStore.getState().activeTab).toBe("logs");
    });
  });

  describe("setChannelMessages", () => {
    it("should store messages per channel", () => {
      const messages = [
        {
          id: "M001",
          channel: "C001",
          user: "U001",
          text: "Hello",
          ts: "1234567890.000001",
          reactions: [],
        },
      ];

      useStore.getState().setChannelMessages("C001", messages);

      expect(useStore.getState().messages["C001"]).toEqual(messages);
    });
  });

  describe("addChannel", () => {
    it("should add new channel to channels array", () => {
      const channel = {
        id: "C001",
        name: "general",
        type: "public" as const,
        members: ["U001"],
      };
      useStore.getState().addChannel(channel);

      expect(useStore.getState().channels).toContainEqual(channel);
    });
  });

  describe("Modal Stack Operations", () => {
    const mockView = {
      id: "V001",
      type: "modal" as const,
      title: { type: "plain_text" as const, text: "Test Modal" },
      blocks: [],
    };

    it("openModal should push modal to stack", () => {
      useStore.getState().openModal(mockView, "A001");

      const state = useStore.getState();
      expect(state.activeModals).toHaveLength(1);
      expect(state.activeModals[0]).toEqual({ view: mockView, appId: "A001" });
    });

    it("closeModal should remove top modal", () => {
      useStore.getState().openModal(mockView, "A001");
      useStore.getState().closeModal();

      expect(useStore.getState().activeModals).toHaveLength(0);
    });

    it("closeAllModals should clear all modals", () => {
      useStore.getState().openModal(mockView, "A001");
      useStore.getState().openModal(mockView, "A002");
      useStore.getState().closeAllModals();

      expect(useStore.getState().activeModals).toHaveLength(0);
    });

    it("updateTopModal should update top modal", () => {
      useStore.getState().openModal(mockView, "A001");
      const updatedView = {
        ...mockView,
        title: { type: "plain_text" as const, text: "Updated" },
      };
      useStore.getState().updateTopModal(updatedView);

      expect(useStore.getState().activeModals[0].view).toEqual(updatedView);
    });
  });

  describe("Log Operations", () => {
    const mockLogEntry = {
      id: "L001",
      ts: Date.now(),
      appId: "A001",
      appName: "Test App",
      direction: "outbound" as const,
      eventType: "message",
      transport: "http" as const,
      status: 200,
      payload: {},
    };

    it("setLogs should replace logs", () => {
      const logs = [mockLogEntry];
      useStore.getState().setLogs(logs);

      expect(useStore.getState().logs).toEqual(logs);
    });

    it("addLog should add log to front", () => {
      useStore.getState().addLog(mockLogEntry);

      expect(useStore.getState().logs[0]).toEqual(mockLogEntry);
    });

    it("addLog should limit logs to 300 entries", () => {
      // Add 301 logs
      for (let i = 0; i < 301; i++) {
        useStore.getState().addLog({ ...mockLogEntry, id: `L${i}` });
      }

      expect(useStore.getState().logs).toHaveLength(300);
    });
  });

  describe("updateAppConfig", () => {
    it("should update app in apps array", () => {
      const app = {
        id: "A001",
        name: "Test App",
        botUserId: "U001",
        botUserName: "TestBot",
        botToken: "xoxb-test",
        appToken: "xapp-test",
        signingSecret: "secret",
        requestUrl: "",
        subscribedEvents: [],
        socketModeEnabled: false,
      };

      useStore.setState({ apps: [app] });
      const updatedApp = { ...app, requestUrl: "http://example.com" };
      useStore.getState().updateAppConfig(updatedApp);

      expect(useStore.getState().apps[0]).toEqual(updatedApp);
    });
  });

  describe("WebSocket Event Handling (applyWsEvent)", () => {
    describe("message_new", () => {
      it("should add message to correct channel", () => {
        const message = {
          id: "M001",
          channel: "C001",
          user: "U001",
          text: "Hello",
          ts: "1234567890.000001",
          reactions: [],
        };

        useStore.getState().applyWsEvent({ type: "message_new", message });

        expect(useStore.getState().messages["C001"]).toContainEqual(message);
      });

      it("should handle thread messages", () => {
        const parentMessage = {
          id: "M001",
          channel: "C001",
          user: "U001",
          text: "Thread start",
          ts: "1234567890.000001",
          reactions: [],
        };

        const replyMessage = {
          id: "M002",
          channel: "C001",
          user: "U002",
          text: "Reply",
          ts: "1234567890.000002",
          threadTs: "1234567890.000001",
          reactions: [],
        };

        useStore.setState({ messages: { C001: [parentMessage] } });
        useStore
          .getState()
          .applyWsEvent({ type: "message_new", message: replyMessage });

        // Should update parent metadata
        const parent = useStore.getState().messages["C001"][0];
        expect(parent.replyCount).toBe(1);
        expect(parent.replyUsers).toContain("U002");
        expect(parent.latestReplyTs).toBe("1234567890.000002");
      });

      it("should increment unread count for DMs from other users", () => {
        const message = {
          id: "M001",
          channel: "C001",
          user: "U002",
          text: "Hello",
          ts: "1234567890.000001",
          reactions: [],
        };

        useStore.setState({
          channels: [
            {
              id: "C001",
              name: "dm",
              type: "im" as const,
              members: ["U001", "U002"],
            },
          ],
          actingUserId: "U001",
          activeChannelId: null,
        });

        useStore.getState().applyWsEvent({ type: "message_new", message });

        expect(useStore.getState().unreadCounts["C001"]).toBe(1);
      });
    });

    describe("message_updated", () => {
      it("should update message in place", () => {
        const originalMessage = {
          id: "M001",
          channel: "C001",
          user: "U001",
          text: "Original",
          ts: "1234567890.000001",
          reactions: [],
        };

        const updatedMessage = {
          id: "M001",
          channel: "C001",
          user: "U001",
          text: "Updated",
          ts: "1234567890.000001",
          reactions: [],
        };

        useStore.setState({ messages: { C001: [originalMessage] } });
        useStore
          .getState()
          .applyWsEvent({ type: "message_updated", message: updatedMessage });

        expect(useStore.getState().messages["C001"][0].text).toBe("Updated");
      });
    });

    describe("message_deleted", () => {
      it("should remove message", () => {
        const message = {
          id: "M001",
          channel: "C001",
          user: "U001",
          text: "Hello",
          ts: "1234567890.000001",
          reactions: [],
        };

        useStore.setState({ messages: { C001: [message] } });
        useStore.getState().applyWsEvent({
          type: "message_deleted",
          channelId: "C001",
          ts: "1234567890.000001",
        });

        expect(useStore.getState().messages["C001"]).toHaveLength(0);
      });
    });

    describe("reaction_updated", () => {
      it("should update reactions on message", () => {
        const message = {
          id: "M001",
          channel: "C001",
          user: "U001",
          text: "Hello",
          ts: "1234567890.000001",
          reactions: [],
        };

        const updatedReactions = [{ name: "thumbsup", users: ["U002"] }];

        useStore.setState({ messages: { C001: [message] } });
        useStore.getState().applyWsEvent({
          type: "reaction_updated",
          ts: "1234567890.000001",
          channelId: "C001",
          reactions: updatedReactions,
        });

        expect(useStore.getState().messages["C001"][0].reactions).toEqual(
          updatedReactions,
        );
      });
    });

    describe("channel_created", () => {
      it("should add channel", () => {
        const channel = {
          id: "C001",
          name: "general",
          type: "public" as const,
          members: ["U001"],
        };
        useStore.getState().applyWsEvent({ type: "channel_created", channel });

        expect(useStore.getState().channels).toContainEqual(channel);
      });
    });

    describe("channel_updated", () => {
      it("should update channel", () => {
        const originalChannel = {
          id: "C001",
          name: "general",
          type: "public" as const,
          members: ["U001"],
        };
        const updatedChannel = {
          id: "C001",
          name: "general-updated",
          type: "public" as const,
          members: ["U001"],
        };

        useStore.setState({ channels: [originalChannel] });
        useStore
          .getState()
          .applyWsEvent({ type: "channel_updated", channel: updatedChannel });

        expect(useStore.getState().channels[0].name).toBe("general-updated");
      });
    });

    describe("workspace_reset", () => {
      it("should clear state and increment resetAt", () => {
        // Mock fetch to avoid network error
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              workspace: { id: "W001", name: "Test Workspace", domain: "test" },
              users: [],
              channels: [],
              apps: [],
            }),
        });

        useStore.setState({
          messages: {
            C001: [
              {
                id: "M001",
                channel: "C001",
                user: "U001",
                text: "test",
                ts: "1234567890.000001",
                reactions: [],
              },
            ],
          },
          unreadCounts: { C001: 5 },
          activeChannelId: "C001",
          activeThreadTs: "1234567890.000001",
        });

        const beforeResetAt = useStore.getState().resetAt;
        useStore.getState().applyWsEvent({ type: "workspace_reset" });

        expect(useStore.getState().messages).toEqual({});
        expect(useStore.getState().unreadCounts).toEqual({});
        expect(useStore.getState().activeChannelId).toBeNull();
        expect(useStore.getState().activeThreadTs).toBeNull();
        expect(useStore.getState().resetAt).toBeGreaterThan(beforeResetAt);
      });
    });

    describe("modal_open", () => {
      it("should push modal to stack", () => {
        const view = {
          id: "V001",
          type: "modal" as const,
          title: { type: "plain_text" as const, text: "Test" },
          blocks: [],
        };

        useStore
          .getState()
          .applyWsEvent({ type: "modal_open", view, appId: "A001" });

        expect(useStore.getState().activeModals).toHaveLength(1);
        expect(useStore.getState().activeModals[0]).toEqual({
          view,
          appId: "A001",
        });
      });
    });

    describe("modal_push", () => {
      it("should push modal to stack", () => {
        const view = {
          id: "V001",
          type: "modal" as const,
          title: { type: "plain_text" as const, text: "Test" },
          blocks: [],
        };

        useStore
          .getState()
          .applyWsEvent({ type: "modal_push", view, appId: "A001" });

        expect(useStore.getState().activeModals).toHaveLength(1);
      });
    });

    describe("modal_update", () => {
      it("should update modal by viewId", () => {
        const view = {
          id: "V001",
          type: "modal" as const,
          title: { type: "plain_text" as const, text: "Test" },
          blocks: [],
        };

        const updatedView = {
          id: "V001",
          type: "modal" as const,
          title: { type: "plain_text" as const, text: "Updated" },
          blocks: [],
        };

        useStore.setState({ activeModals: [{ view, appId: "A001" }] });
        useStore
          .getState()
          .applyWsEvent({ type: "modal_update", view: updatedView });

        expect(useStore.getState().activeModals[0].view.title.text).toBe(
          "Updated",
        );
      });
    });

    describe("modal_close", () => {
      it("should remove modal by viewId", () => {
        const view = {
          id: "V001",
          type: "modal" as const,
          title: { type: "plain_text" as const, text: "Test" },
          blocks: [],
        };

        useStore.setState({ activeModals: [{ view, appId: "A001" }] });
        useStore
          .getState()
          .applyWsEvent({ type: "modal_close", viewId: "V001" });

        expect(useStore.getState().activeModals).toHaveLength(0);
      });
    });

    describe("log_entry", () => {
      it("should add log entry", () => {
        const entry = {
          id: "L001",
          ts: Date.now(),
          appId: "A001",
          appName: "Test App",
          direction: "outbound" as const,
          eventType: "message",
          transport: "http" as const,
          status: 200,
          payload: {},
        };

        useStore.getState().applyWsEvent({ type: "log_entry", entry });

        expect(useStore.getState().logs[0]).toEqual(entry);
      });
    });
  });
});
