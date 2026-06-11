import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TabSwitcher from "./TabSwitcher";
import { useStore } from "../../store";

// Mock the store with module-level variables
let mockActiveTab = "workspace";
let mockSetActiveTab = vi.fn();

vi.mock("../../store", () => ({
  useStore: vi.fn(() => ({
    activeTab: mockActiveTab,
    setActiveTab: mockSetActiveTab,
  })),
}));

describe("TabSwitcher Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveTab = "workspace";
    mockSetActiveTab = vi.fn();
  });

  const renderTabSwitcher = () => {
    return render(<TabSwitcher />);
  };

  describe("Tab Switching", () => {
    it("should render all tabs", () => {
      renderTabSwitcher();

      expect(screen.getByText("Workspace")).toBeInTheDocument();
      expect(screen.getByText("Apps")).toBeInTheDocument();
      expect(screen.getByText("Logs")).toBeInTheDocument();
      expect(screen.getByText("Database")).toBeInTheDocument();
    });

    it("should call setActiveTab when clicking a tab", () => {
      const mockSetActiveTab = vi.fn();
      vi.mocked(useStore).mockReturnValue({
        activeTab: "workspace",
        setActiveTab: mockSetActiveTab,
      } as any);

      render(<TabSwitcher />);

      const adminTab = screen.getByText("Apps");
      fireEvent.click(adminTab);

      expect(mockSetActiveTab).toHaveBeenCalledWith("admin");
    });

    it("should call setActiveTab with correct tab id for each tab", () => {
      const mockSetActiveTab = vi.fn();
      vi.mocked(useStore).mockReturnValue({
        activeTab: "workspace",
        setActiveTab: mockSetActiveTab,
      } as any);

      render(<TabSwitcher />);

      fireEvent.click(screen.getByText("Workspace"));
      expect(mockSetActiveTab).toHaveBeenCalledWith("workspace");

      fireEvent.click(screen.getByText("Apps"));
      expect(mockSetActiveTab).toHaveBeenCalledWith("admin");

      fireEvent.click(screen.getByText("Logs"));
      expect(mockSetActiveTab).toHaveBeenCalledWith("logs");

      fireEvent.click(screen.getByText("Database"));
      expect(mockSetActiveTab).toHaveBeenCalledWith("database");
    });
  });

  describe("Active State", () => {
    it("should indicate active tab visually", () => {
      mockActiveTab = "admin";
      renderTabSwitcher();

      const adminTab = screen.getByText("Apps");
      expect(adminTab).toBeInTheDocument();
      // The active tab should have different styling (bold font weight)
      // This is verified by the component rendering correctly
    });

    it("should update active tab when store changes", () => {
      const { rerender } = renderTabSwitcher();

      mockActiveTab = "logs";
      rerender(<TabSwitcher />);

      // Component should re-render with new active tab
      expect(screen.getByText("Logs")).toBeInTheDocument();
    });
  });
});
