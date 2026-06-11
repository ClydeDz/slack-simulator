import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LogsView from "./LogsView";
import { useStore } from "../store";
import { controlApi } from "../lib/api";
import type { LogEntry } from "@shared/types";

// Mock dependencies
vi.mock("../store", () => ({
  useStore: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  controlApi: {
    getLogs: vi.fn(),
  },
}));

describe("LogsView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(controlApi.getLogs).mockResolvedValue([]);
  });

  const mockLogs: LogEntry[] = [
    {
      id: "1",
      direction: "outbound",
      transport: "http",
      eventType: "message",
      status: 200,
      durationMs: 50,
      ts: Date.now(),
      payload: { text: "test" },
      appId: "A001",
      appName: "TestBot",
    },
    {
      id: "2",
      direction: "inbound",
      transport: "http",
      eventType: "app_mention",
      status: 200,
      ts: Date.now(),
      payload: { text: "mention" },
      appId: "A001",
      appName: "TestBot",
    },
    {
      id: "3",
      direction: "outbound",
      transport: "http",
      eventType: "message",
      status: 0,
      error: "Connection failed",
      ts: Date.now(),
      payload: { text: "failed" },
      appId: "A001",
      appName: "TestBot",
    },
  ];

  const renderLogsView = (logs: LogEntry[] = []) => {
    vi.mocked(useStore).mockReturnValue({
      logs,
      setLogs: vi.fn(),
    } as any);

    return render(<LogsView />);
  };

  describe("Rendering", () => {
    it("should render logs view", () => {
      renderLogsView();

      expect(screen.getByText("Logs")).toBeInTheDocument();
    });

    it("should render empty state", () => {
      renderLogsView();

      expect(screen.getByText(/No log entries yet/)).toBeInTheDocument();
    });

    it("should render log entries when logs exist", () => {
      renderLogsView(mockLogs);

      const messageElements = screen.getAllByText("message");
      expect(messageElements.length).toBeGreaterThan(0);
      expect(screen.getByText("app_mention")).toBeInTheDocument();
    });

    it("should render filter buttons", () => {
      renderLogsView();

      expect(screen.getByText("all")).toBeInTheDocument();
      expect(screen.getByText("outbound")).toBeInTheDocument();
      expect(screen.getByText("inbound")).toBeInTheDocument();
      expect(screen.getByText("errors")).toBeInTheDocument();
      expect(screen.getByText("bot offline")).toBeInTheDocument();
    });

    it("should render refresh button", () => {
      renderLogsView();

      expect(screen.getByText("↺ Refresh")).toBeInTheDocument();
    });

    it("should render column headers", () => {
      renderLogsView();

      expect(screen.getByText("dir")).toBeInTheDocument();
      expect(screen.getByText("transport")).toBeInTheDocument();
      expect(screen.getByText("event")).toBeInTheDocument();
      expect(screen.getByText("status")).toBeInTheDocument();
    });
  });

  describe("Filtering", () => {
    it("should filter by outbound", () => {
      renderLogsView(mockLogs);

      fireEvent.click(screen.getByText("outbound"));

      // Should show outbound logs only
      const messageButtons = screen.getAllByText("message");
      expect(messageButtons.length).toBeGreaterThan(0);
    });

    it("should filter by inbound", () => {
      renderLogsView(mockLogs);

      fireEvent.click(screen.getByText("inbound"));

      expect(screen.getByText("app_mention")).toBeInTheDocument();
    });

    it("should filter by errors", () => {
      renderLogsView(mockLogs);

      fireEvent.click(screen.getByText("errors"));

      // Should show error logs
      expect(screen.getByText("ERR")).toBeInTheDocument();
    });

    it("should filter by bot offline", () => {
      renderLogsView(mockLogs);

      fireEvent.click(screen.getByText("bot offline"));

      // Should show logs with status 0
      expect(screen.getByText("no_conn")).toBeInTheDocument();
    });

    it("should show entry count", () => {
      renderLogsView(mockLogs);

      expect(screen.getByText(/3 entries/)).toBeInTheDocument();
    });
  });

  describe("Refresh", () => {
    it("should call getLogs on refresh click", async () => {
      renderLogsView(mockLogs);

      fireEvent.click(screen.getByText("↺ Refresh"));

      expect(controlApi.getLogs).toHaveBeenCalled();
    });
  });

  describe("LogRow", () => {
    it("should show IN badge for inbound logs", () => {
      renderLogsView([mockLogs[1]]);

      expect(screen.getByText("IN")).toBeInTheDocument();
    });

    it("should show OUT badge for outbound logs", () => {
      renderLogsView([mockLogs[0]]);

      expect(screen.getByText("OUT")).toBeInTheDocument();
    });

    it("should show ERR badge for error logs", () => {
      renderLogsView([mockLogs[2]]);

      expect(screen.getByText("ERR")).toBeInTheDocument();
    });

    it("should show transport type", () => {
      renderLogsView(mockLogs);

      expect(screen.getAllByText("http").length).toBeGreaterThan(0);
    });

    it("should show duration", () => {
      renderLogsView([mockLogs[0]]);

      expect(screen.getByText("50ms")).toBeInTheDocument();
    });

    it("should show status", () => {
      renderLogsView([mockLogs[0]]);

      expect(screen.getByText("200")).toBeInTheDocument();
    });
  });
});
