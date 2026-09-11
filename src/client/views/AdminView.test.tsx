import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminView from './AdminView';
import { useStore } from '../store';

// Mock dependencies
vi.mock('../store', () => ({
  useStore: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  controlApi: {
    updateApp: vi.fn(),
  },
}));

vi.mock('../components/Avatar', () => ({
  default: ({
    seed,
    size,
    url,
  }: {
    seed: string;
    size: number;
    url?: string;
  }) => (
    <div data-testid={`avatar-${seed}`} data-size={size} data-url={url || ''}>
      Avatar
    </div>
  ),
}));

describe('AdminView Component', () => {
  let mockApps: any[];
  let mockWorkspace: any;
  let mockChannels: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockApps = [
      {
        id: 'A001',
        name: 'Test App',
        botUserName: 'testbot',
        botToken: 'xoxb-test-token',
        appToken: 'xapp-test-token',
        signingSecret: 'test-secret',
        requestUrl: 'https://example.com/webhook',
        subscribedEvents: ['message', 'app_mention'],
        socketModeEnabled: true,
        description: 'A test application',
        avatarUrl: 'https://example.com/avatar.png',
        slashCommands: [{ command: '/test', description: 'Test command' }],
        incomingWebhooks: ['C001'],
        unfurlDomains: ['example.com'],
      },
    ];
    mockWorkspace = {
      id: 'W001',
      name: 'Test Workspace',
    };
    mockChannels = [
      { id: 'C001', name: 'general', type: 'public' },
      { id: 'C002', name: 'random', type: 'private' },
    ];
  });

  const renderAdminView = () => {
    vi.mocked(useStore).mockReturnValue({
      apps: mockApps,
      workspace: mockWorkspace,
      channels: mockChannels,
    } as any);

    return render(<AdminView />);
  };

  describe('Rendering', () => {
    it('should render admin view', () => {
      renderAdminView();

      // Check for the presence of the component by looking for section headers
      const credentialsButtons = screen.getAllByText('Credentials');
      expect(credentialsButtons.length).toBeGreaterThan(0);
    });

    it('should render app selector when apps exist', () => {
      renderAdminView();

      // Check for app name in the dropdown
      const appButtons = screen.getAllByText('Test App');
      expect(appButtons.length).toBeGreaterThan(0);
    });

    it('should render SidebarAd in the left sidebar', () => {
      renderAdminView();
      expect(screen.getByLabelText('Advertisement')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should handle empty apps array', () => {
      mockApps = [];
      renderAdminView();

      // Check for the empty state message
      expect(screen.getByText(/No apps configured/)).toBeInTheDocument();
    });
  });

  describe('App Configuration', () => {
    it('should display app credentials', () => {
      renderAdminView();

      expect(screen.getByText('xoxb-test-token')).toBeInTheDocument();
      expect(screen.getByText('xapp-test-token')).toBeInTheDocument();
      expect(screen.getByText('test-secret')).toBeInTheDocument();
    });

    it('should display subscribed events', () => {
      renderAdminView();

      expect(screen.getByText('message')).toBeInTheDocument();
      expect(screen.getByText('app_mention')).toBeInTheDocument();
    });

    it('should display slash commands', () => {
      renderAdminView();

      expect(screen.getByText('/test')).toBeInTheDocument();
    });

    it('should display incoming webhooks', () => {
      renderAdminView();

      // Check for the incoming webhooks section (appears in navigation)
      const webhookButtons = screen.getAllByText(/Incoming Webhooks/i);
      expect(webhookButtons.length).toBeGreaterThan(0);
    });

    it('should display unfurl domains', () => {
      renderAdminView();

      // Check for the unfurl domains section (appears in navigation)
      const unfurlButtons = screen.getAllByText(/Unfurl Domains/i);
      expect(unfurlButtons.length).toBeGreaterThan(0);
    });
  });

  describe('App Selection', () => {
    it('should allow switching between apps', () => {
      mockApps = [
        {
          id: 'A001',
          name: 'App 1',
          botUserName: 'bot1',
          botToken: 'xoxb-1',
          appToken: 'xapp-1',
          signingSecret: 'secret-1',
          requestUrl: 'https://example.com/1',
          subscribedEvents: [],
          socketModeEnabled: false,
        },
        {
          id: 'A002',
          name: 'App 2',
          botUserName: 'bot2',
          botToken: 'xoxb-2',
          appToken: 'xapp-2',
          signingSecret: 'secret-2',
          requestUrl: 'https://example.com/2',
          subscribedEvents: [],
          socketModeEnabled: false,
        },
      ];

      renderAdminView();

      const app1Buttons = screen.getAllByText('App 1');
      expect(app1Buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Socket Mode Toggle', () => {
    it('should display socket mode status', () => {
      renderAdminView();

      expect(screen.getByText(/Socket Mode/i)).toBeInTheDocument();
    });
  });

  describe('Quickstart', () => {
    it('should use the port from the request URL for HTTP mode', () => {
      mockApps[0].requestUrl = 'http://localhost:4003/slack/events';
      mockApps[0].socketModeEnabled = false;

      renderAdminView();

      const quickstart = screen.getByText('Bolt Quickstart').parentElement;
      expect(quickstart?.querySelector('pre')?.textContent).toContain(
        'await app.start(4003)'
      );
    });

    it('should default to port 4001 when the request URL has no port', () => {
      mockApps[0].requestUrl = 'http://localhost/slack/events';
      mockApps[0].socketModeEnabled = false;

      renderAdminView();

      const quickstart = screen.getByText('Bolt Quickstart').parentElement;
      expect(quickstart?.querySelector('pre')?.textContent).toContain(
        'await app.start(4001)'
      );
    });
  });

  describe('App Description', () => {
    it('should display app description', () => {
      renderAdminView();

      expect(screen.getByText('A test application')).toBeInTheDocument();
    });
  });
});
