import { describe, it, expect } from "vitest";
import type {
  Workspace,
  User,
  Channel,
  Message,
  Reaction,
  Block,
  App,
  LogEntry,
  ModalView,
  WsEvent,
} from "./types";

describe("Type Validation Tests", () => {
  describe("Workspace type", () => {
    it("should accept valid workspace object", () => {
      const workspace: Workspace = {
        id: "W001",
        name: "Test Workspace",
        domain: "test-workspace",
        avatarUrl: "https://example.com/avatar.png",
        emojiMap: { rocket: "🚀" },
      };

      expect(workspace.id).toBe("W001");
      expect(workspace.name).toBe("Test Workspace");
    });

    it("should accept workspace without optional fields", () => {
      const workspace: Workspace = {
        id: "W001",
        name: "Test Workspace",
        domain: "test-workspace",
      };

      expect(workspace.id).toBe("W001");
      expect(workspace.avatarUrl).toBeUndefined();
    });
  });

  describe("User type", () => {
    it("should accept valid user object", () => {
      const user: User = {
        id: "U001",
        username: "alice",
        fullName: "Alice Smith",
        email: "alice@example.com",
        avatarSeed: "alice",
        avatarUrl: "https://example.com/alice.png",
      };

      expect(user.id).toBe("U001");
      expect(user.username).toBe("alice");
    });

    it("should accept user without avatarUrl", () => {
      const user: User = {
        id: "U001",
        username: "alice",
        fullName: "Alice Smith",
        email: "alice@example.com",
        avatarSeed: "alice",
      };

      expect(user.avatarUrl).toBeUndefined();
    });
  });

  describe("Channel type", () => {
    it("should accept valid public channel", () => {
      const channel: Channel = {
        id: "C001",
        name: "general",
        type: "public",
        members: ["U001", "U002"],
      };

      expect(channel.type).toBe("public");
      expect(channel.members).toHaveLength(2);
    });

    it("should accept valid private channel", () => {
      const channel: Channel = {
        id: "C002",
        name: "random",
        type: "private",
        members: ["U001"],
      };

      expect(channel.type).toBe("private");
    });

    it("should accept DM channel", () => {
      const channel: Channel = {
        id: "D001",
        name: "",
        type: "im",
        members: ["U001", "U002"],
      };

      expect(channel.type).toBe("im");
    });

    it("should accept channel with archived flag", () => {
      const channel: Channel = {
        id: "C001",
        name: "general",
        type: "public",
        members: ["U001"],
        archived: true,
      };

      expect(channel.archived).toBe(true);
    });
  });

  describe("Message type", () => {
    it("should accept valid message", () => {
      const message: Message = {
        id: "M001",
        channel: "C001",
        user: "U001",
        text: "Hello world",
        ts: "1234567890.123456",
        reactions: [],
      };

      expect(message.id).toBe("M001");
      expect(message.text).toBe("Hello world");
    });

    it("should accept message with thread metadata", () => {
      const message: Message = {
        id: "M001",
        channel: "C001",
        user: "U001",
        text: "Hello world",
        ts: "1234567890.123456",
        threadTs: "1234567890.123456",
        reactions: [],
        replyCount: 5,
        replyUsers: ["U002", "U003"],
        latestReplyTs: "1234567895.123456",
      };

      expect(message.threadTs).toBeDefined();
      expect(message.replyCount).toBe(5);
    });

    it("should accept message with blocks", () => {
      const message: Message = {
        id: "M001",
        channel: "C001",
        user: "U001",
        text: "Hello world",
        ts: "1234567890.123456",
        reactions: [],
        blocks: [
          {
            type: "section",
            text: { type: "plain_text", text: "Section text" },
          },
        ],
      };

      expect(message.blocks).toBeDefined();
      expect(message.blocks).toHaveLength(1);
    });

    it("should accept ephemeral message", () => {
      const message: Message = {
        id: "M001",
        channel: "C001",
        user: "U001",
        text: "Ephemeral message",
        ts: "1234567890.123456",
        reactions: [],
        ephemeralRecipient: "U002",
      };

      expect(message.ephemeralRecipient).toBe("U002");
    });
  });

  describe("Reaction type", () => {
    it("should accept valid reaction", () => {
      const reaction: Reaction = {
        name: "thumbsup",
        users: ["U001", "U002"],
      };

      expect(reaction.name).toBe("thumbsup");
      expect(reaction.users).toHaveLength(2);
    });
  });

  describe("App type", () => {
    it("should accept valid app", () => {
      const app: App = {
        id: "A001",
        name: "Test App",
        botUserId: "U003",
        botUserName: "testbot",
        botToken: "xoxb-test-token",
        appToken: "xapp-test-token",
        signingSecret: "test-secret",
        requestUrl: "https://example.com/webhook",
        subscribedEvents: ["message", "app_mention"],
        socketModeEnabled: true,
      };

      expect(app.id).toBe("A001");
      expect(app.socketModeEnabled).toBe(true);
    });

    it("should accept app with optional fields", () => {
      const app: App = {
        id: "A001",
        name: "Test App",
        botUserId: "U003",
        botUserName: "testbot",
        botToken: "xoxb-test-token",
        appToken: "xapp-test-token",
        signingSecret: "test-secret",
        requestUrl: "https://example.com/webhook",
        socketModeEnabled: false,
        description: "A test app",
        avatarUrl: "https://example.com/avatar.png",
      };

      expect(app.description).toBe("A test app");
    });
  });

  describe("LogEntry type", () => {
    it("should accept valid outbound log entry", () => {
      const logEntry: LogEntry = {
        id: "L001",
        ts: 1234567890000,
        appId: "A001",
        appName: "Test App",
        direction: "outbound",
        eventType: "message",
        transport: "http",
        status: 200,
        durationMs: 150,
        payload: { text: "Hello" },
      };

      expect(logEntry.direction).toBe("outbound");
      expect(logEntry.status).toBe(200);
    });

    it("should accept valid inbound log entry", () => {
      const logEntry: LogEntry = {
        id: "L002",
        ts: 1234567890000,
        appId: "A001",
        appName: "Test App",
        direction: "inbound",
        eventType: "reaction_added",
        transport: "socket_mode",
        status: 200,
        durationMs: 50,
        payload: { reaction: "thumbsup" },
      };

      expect(logEntry.direction).toBe("inbound");
      expect(logEntry.transport).toBe("socket_mode");
    });

    it("should accept log entry with error", () => {
      const logEntry: LogEntry = {
        id: "L003",
        ts: 1234567890000,
        appId: "A001",
        appName: "Test App",
        direction: "outbound",
        eventType: "message",
        transport: "http",
        status: 500,
        durationMs: 1000,
        payload: { text: "Hello" },
        error: "Internal server error",
      };

      expect(logEntry.error).toBe("Internal server error");
    });
  });

  describe("ModalView type", () => {
    it("should accept valid modal view", () => {
      const modalView: ModalView = {
        id: "V001",
        type: "modal",
        title: { type: "plain_text", text: "Test Modal" },
        submit: { type: "plain_text", text: "Submit" },
        close: { type: "plain_text", text: "Close" },
        blocks: [
          {
            type: "section",
            text: { type: "plain_text", text: "Section text" },
          },
        ],
        callback_id: "test_callback",
        notify_on_close: true,
      };

      expect(modalView.type).toBe("modal");
      expect(modalView.notify_on_close).toBe(true);
    });
  });

  describe("WsEvent type", () => {
    it("should accept message_new event", () => {
      const event: WsEvent = {
        type: "message_new",
        message: {
          id: "M001",
          channel: "C001",
          user: "U001",
          text: "Hello",
          ts: "1234567890.123456",
          reactions: [],
        },
      };

      expect(event.type).toBe("message_new");
    });

    it("should accept reaction_updated event", () => {
      const event: WsEvent = {
        type: "reaction_updated",
        ts: "1234567890.123456",
        channelId: "C001",
        reactions: [{ name: "thumbsup", users: ["U001"] }],
      };

      expect(event.type).toBe("reaction_updated");
    });

    it("should accept workspace_reset event", () => {
      const event: WsEvent = {
        type: "workspace_reset",
      };

      expect(event.type).toBe("workspace_reset");
    });

    it("should accept modal_open event", () => {
      const event: WsEvent = {
        type: "modal_open",
        view: {
          id: "V001",
          type: "modal",
          title: { type: "plain_text", text: "Test" },
          blocks: [],
        },
        appId: "A001",
      };

      expect(event.type).toBe("modal_open");
    });
  });
});
