import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "./index";
import { useStore } from "../../store";

// Mock dependencies
vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

vi.mock("./ChannelList", () => ({
  default: ({ onCreateChannel }: { onCreateChannel: () => void }) => (
    <div data-testid="channel-list">
      <button onClick={onCreateChannel} data-testid="create-channel-btn">
        Create Channel
      </button>
    </div>
  ),
}));

vi.mock("./DmList", () => ({
  default: () => <div data-testid="dm-list">DM List</div>,
}));

vi.mock("./AppList", () => ({
  default: () => <div data-testid="app-list">App List</div>,
}));

vi.mock("./SidebarAd", () => ({
  default: () => <div data-testid="sidebar-ad">Sidebar Ad</div>,
}));

vi.mock("../modals/CreateChannelModal", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="create-channel-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock("../ControlBar/IdentitySwitcher", () => ({
  default: ({ openUpward }: { openUpward?: boolean }) => (
    <div data-testid="identity-switcher" data-open-upward={openUpward}>
      Identity Switcher
    </div>
  ),
}));

describe("Sidebar Component", () => {
  let mockWorkspace: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspace = {
      name: "Test Workspace",
      avatarUrl: null,
    };
  });

  const renderSidebar = () => {
    vi.mocked(useStore).mockReturnValue({
      workspace: mockWorkspace,
    } as any);

    return render(<Sidebar />);
  };

  describe("Rendering", () => {
    it("should render sidebar container", () => {
      renderSidebar();

      const sidebar = screen.getByTestId("channel-list").closest("div")
        ?.parentElement?.parentElement;
      expect(sidebar).toBeInTheDocument();
    });

    it("should render workspace name", () => {
      renderSidebar();

      expect(screen.getByText("Test Workspace")).toBeInTheDocument();
    });

    it("should render workspace avatar with first letter when no avatarUrl", () => {
      renderSidebar();

      expect(screen.getByText("T")).toBeInTheDocument();
    });

    it("should render workspace avatar image when avatarUrl is provided", () => {
      mockWorkspace = {
        name: "Test Workspace",
        avatarUrl: "https://example.com/avatar.png",
      };

      renderSidebar();

      const avatar = screen.getByAltText("Test Workspace");
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute("src", "https://example.com/avatar.png");
    });

    it("should render ChannelList", () => {
      renderSidebar();

      expect(screen.getByTestId("channel-list")).toBeInTheDocument();
    });

    it("should render DmList", () => {
      renderSidebar();

      expect(screen.getByTestId("dm-list")).toBeInTheDocument();
    });

    it("should render AppList", () => {
      renderSidebar();

      expect(screen.getByTestId("app-list")).toBeInTheDocument();
    });

    it("should render SidebarAd pinned above identity switcher", () => {
      renderSidebar();

      expect(screen.getByTestId("sidebar-ad")).toBeInTheDocument();
    });

    it("should render IdentitySwitcher at bottom", () => {
      renderSidebar();

      expect(screen.getByTestId("identity-switcher")).toBeInTheDocument();
      expect(screen.getByTestId("identity-switcher")).toHaveAttribute(
        "data-open-upward",
        "true",
      );
    });
  });

  describe("Create Channel Modal", () => {
    it("should show CreateChannelModal when create channel button is clicked", () => {
      renderSidebar();

      const createButton = screen.getByTestId("create-channel-btn");
      fireEvent.click(createButton);

      expect(screen.getByTestId("create-channel-modal")).toBeInTheDocument();
    });

    it("should close CreateChannelModal when onClose is called", () => {
      renderSidebar();

      const createButton = screen.getByTestId("create-channel-btn");
      fireEvent.click(createButton);

      const closeButton = screen.getByText("Close");
      fireEvent.click(closeButton);

      expect(
        screen.queryByTestId("create-channel-modal"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Workspace State", () => {
    it("should display workspace name from store", () => {
      mockWorkspace = {
        name: "My Company",
        avatarUrl: null,
      };

      renderSidebar();

      expect(screen.getByText("My Company")).toBeInTheDocument();
    });

    it("should display first letter of workspace name", () => {
      mockWorkspace = {
        name: "Acme Corp",
        avatarUrl: null,
      };

      renderSidebar();

      expect(screen.getByText("A")).toBeInTheDocument();
    });

    it("should handle null workspace gracefully", () => {
      mockWorkspace = null;

      renderSidebar();

      expect(screen.getByText("W")).toBeInTheDocument();
      expect(screen.getByText("Workspace")).toBeInTheDocument();
    });
  });
});
