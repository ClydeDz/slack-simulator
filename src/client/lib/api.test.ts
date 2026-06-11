import { describe, it, expect, beforeEach, vi } from "vitest";
import { controlFetch, controlApi } from "./api";

// Mock the store at module level to avoid clearing issues
vi.mock("../store", () => ({
  useStore: {
    getState: vi.fn(() => ({
      actingUserId: "U001",
    })),
  },
}));

describe("API Client Tests", () => {
  beforeEach(() => {
    // Don't clear mocks to preserve the store mock
  });

  describe("controlFetch", () => {
    it("should include acting user header", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await controlFetch("/test");

      expect(fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Slacksim-Acting-User": "U001",
          }),
        }),
      );
    });

    it("should set content-type to JSON", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await controlFetch("/test");

      expect(fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should return JSON on successful response", async () => {
      const mockData = { success: true, data: "test" };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await controlFetch("/test");

      expect(result).toEqual(mockData);
    });

    it("should parse error from response body on failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Invalid request" }),
      });

      await expect(controlFetch("/test")).rejects.toThrow("Invalid request");
    });

    it("should use generic error message if response body has no error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Server error" }),
      });

      await expect(controlFetch("/test")).rejects.toThrow(
        "Request failed (500)",
      );
    });

    it("should use generic error message if JSON parsing fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      await expect(controlFetch("/test")).rejects.toThrow(
        "Request failed (500)",
      );
    });

    it("should merge custom headers with default headers", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await controlFetch("/test", {
        headers: { "X-Custom-Header": "custom-value" },
      });

      expect(fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Slacksim-Acting-User": "U001",
            "X-Custom-Header": "custom-value",
          }),
        }),
      );
    });
  });

  describe("controlApi methods", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    it("getChannelMessages should call correct endpoint", async () => {
      await controlApi.getChannelMessages("C001");

      expect(fetch).toHaveBeenCalledWith(
        "/_control/channels/C001/messages",
        expect.any(Object),
      );
    });

    it("postMessage should send correct payload", async () => {
      await controlApi.postMessage("C001", "Hello", "1234567890.000001");

      expect(fetch).toHaveBeenCalledWith(
        "/_control/messages",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            channelId: "C001",
            text: "Hello",
            threadTs: "1234567890.000001",
          }),
        }),
      );
    });

    it("postMessage should work without threadTs", async () => {
      await controlApi.postMessage("C001", "Hello");

      expect(fetch).toHaveBeenCalledWith(
        "/_control/messages",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            channelId: "C001",
            text: "Hello",
            threadTs: undefined,
          }),
        }),
      );
    });

    it("toggleReaction should send correct endpoint and payload", async () => {
      await controlApi.toggleReaction("M001", "thumbsup");

      expect(fetch).toHaveBeenCalledWith(
        "/_control/messages/M001/reactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "thumbsup" }),
        }),
      );
    });

    it("pinMessage should send correct endpoint and payload", async () => {
      await controlApi.pinMessage("M001", true);

      expect(fetch).toHaveBeenCalledWith(
        "/_control/messages/M001/pin",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ pinned: true }),
        }),
      );
    });

    it("createChannel should convert isPrivate to type", async () => {
      await controlApi.createChannel("general", ["U001", "U002"], true);

      expect(fetch).toHaveBeenCalledWith(
        "/_control/channels",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "general",
            type: "private",
            memberIds: ["U001", "U002"],
          }),
        }),
      );
    });

    it("createChannel should convert isPrivate=false to public", async () => {
      await controlApi.createChannel("general", ["U001", "U002"], false);

      expect(fetch).toHaveBeenCalledWith(
        "/_control/channels",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "general",
            type: "public",
            memberIds: ["U001", "U002"],
          }),
        }),
      );
    });

    it("addAppToChannel should send correct payload", async () => {
      await controlApi.addAppToChannel("C001", "A001");

      expect(fetch).toHaveBeenCalledWith(
        "/_control/channels/C001/apps",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ appId: "A001" }),
        }),
      );
    });

    it("joinChannel should send POST with empty body", async () => {
      await controlApi.joinChannel("C001");

      expect(fetch).toHaveBeenCalledWith(
        "/_control/channels/C001/join",
        expect.objectContaining({
          method: "POST",
          body: "{}",
        }),
      );
    });

    it("leaveChannel should send POST with empty body", async () => {
      await controlApi.leaveChannel("C001");

      expect(fetch).toHaveBeenCalledWith(
        "/_control/channels/C001/leave",
        expect.objectContaining({
          method: "POST",
          body: "{}",
        }),
      );
    });

    it("archiveChannel should send POST with empty body", async () => {
      await controlApi.archiveChannel("C001");

      expect(fetch).toHaveBeenCalledWith(
        "/_control/channels/C001/archive",
        expect.objectContaining({
          method: "POST",
          body: "{}",
        }),
      );
    });

    it("resetWorkspace should call correct endpoint", async () => {
      await controlApi.resetWorkspace();

      expect(fetch).toHaveBeenCalledWith(
        "/_control/workspace/reset",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        }),
      );
    });

    it("getLogs should call correct endpoint", async () => {
      await controlApi.getLogs();

      expect(fetch).toHaveBeenCalledWith("/_control/logs", expect.any(Object));
    });

    it("postSlashCommand should send correct payload", async () => {
      await controlApi.postSlashCommand("C001", "/test", "arg1");

      expect(fetch).toHaveBeenCalledWith(
        "/_control/slash_command",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            channelId: "C001",
            command: "/test",
            text: "arg1",
          }),
        }),
      );
    });

    it("postModalBlockAction should send correct payload", async () => {
      await controlApi.postModalBlockAction(
        "V001",
        "B001",
        "A001",
        "value",
        "A001",
      );

      expect(fetch).toHaveBeenCalledWith(
        "/_control/modal_block_action",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            viewId: "V001",
            blockId: "B001",
            actionId: "A001",
            value: "value",
            appId: "A001",
            selectedOption: undefined,
          }),
        }),
      );
    });

    it("postBlockAction should send correct payload", async () => {
      await controlApi.postBlockAction(
        "C001",
        "1234567890.000001",
        "B001",
        "A001",
        "value",
        "A001",
      );

      expect(fetch).toHaveBeenCalledWith(
        "/_control/block_action",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            channelId: "C001",
            messageTs: "1234567890.000001",
            blockId: "B001",
            actionId: "A001",
            value: "value",
            appId: "A001",
            selectedOption: undefined,
          }),
        }),
      );
    });

    it("submitView should send correct payload", async () => {
      const values = {
        block1: { action1: { type: "plain_text", value: "test" } },
      };
      await controlApi.submitView("V001", values);

      expect(fetch).toHaveBeenCalledWith(
        "/_control/view_submit",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ viewId: "V001", values }),
        }),
      );
    });

    it("closeView should send correct payload", async () => {
      await controlApi.closeView("V001");

      expect(fetch).toHaveBeenCalledWith(
        "/_control/view_close",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ viewId: "V001" }),
        }),
      );
    });

    it("openDm should send correct payload", async () => {
      await controlApi.openDm("U001");

      expect(fetch).toHaveBeenCalledWith(
        "/_control/dm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ botUserId: "U001" }),
        }),
      );
    });

    it("updateApp should send correct payload", async () => {
      await controlApi.updateApp("A001", {
        requestUrl: "http://example.com",
        socketModeEnabled: true,
      });

      expect(fetch).toHaveBeenCalledWith(
        "/_control/apps/A001",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            requestUrl: "http://example.com",
            socketModeEnabled: true,
          }),
        }),
      );
    });

    it("getDbTables should call correct endpoint", async () => {
      await controlApi.getDbTables();

      expect(fetch).toHaveBeenCalledWith(
        "/_control/db/tables",
        expect.any(Object),
      );
    });

    it("getDbTableRows should build query string correctly", async () => {
      await controlApi.getDbTableRows("users", {
        limit: 10,
        offset: 5,
        orderBy: "username",
        order: "asc",
      });

      expect(fetch).toHaveBeenCalledWith(
        "/_control/db/tables/users?limit=10&offset=5&orderBy=username&order=asc",
        expect.any(Object),
      );
    });

    it("getDbTableRows should handle partial params", async () => {
      await controlApi.getDbTableRows("users", { limit: 10 });

      expect(fetch).toHaveBeenCalledWith(
        "/_control/db/tables/users?limit=10",
        expect.any(Object),
      );
    });
  });
});
