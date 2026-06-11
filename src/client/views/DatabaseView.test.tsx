import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DatabaseView from "./DatabaseView";
import { useStore } from "../store";

// Mock dependencies
vi.mock("../store", () => ({
  useStore: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  controlApi: {
    getDbTables: vi.fn(),
    getDbTableRows: vi.fn(),
  },
}));

describe("DatabaseView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDatabaseView = () => {
    vi.mocked(useStore).mockReturnValue({
      channels: [],
      users: [],
      messages: [],
    } as any);

    return render(<DatabaseView />);
  };

  describe("Rendering", () => {
    it("should render database view", () => {
      renderDatabaseView();

      expect(screen.getByText("Tables")).toBeInTheDocument();
    });

    it("should render loading state", () => {
      renderDatabaseView();

      expect(screen.getByText("Loading…")).toBeInTheDocument();
    });

    it("should render select table message", () => {
      renderDatabaseView();

      expect(screen.getByText("Select a table")).toBeInTheDocument();
    });
  });

  describe("Header", () => {
    it("should render refresh button", () => {
      renderDatabaseView();

      expect(screen.getByTitle("Refresh table list")).toBeInTheDocument();
    });
  });
});
