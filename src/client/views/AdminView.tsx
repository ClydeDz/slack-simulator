import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { controlApi } from '../lib/api';
import Avatar from '../components/Avatar';
import type { App } from '@shared/types';
import SidebarAd from '../components/Sidebar/SidebarAd';

const ALL_EVENTS = [
  'message',
  'app_mention',
  'reaction_added',
  'reaction_removed',
  'pin_added',
  'pin_removed',
  'channel_created',
  'member_joined_channel',
  'channel_archive',
  'channel_unarchive',
  'link_shared',
];

const SECTIONS = [
  { id: 'credentials', label: 'Credentials' },
  { id: 'event-delivery', label: 'Event Delivery' },
  { id: 'slash-commands', label: 'Slash Commands' },
  { id: 'incoming-webhooks', label: 'Incoming Webhooks' },
  { id: 'unfurl-domains', label: 'Unfurl Domains' },
  { id: 'quickstart', label: 'Quickstart' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

// ── Copy field ─────────────────────────────────────────────────

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div style={{ marginBottom: 'var(--slacksim-space-3)' }}>
      <div
        style={{
          fontSize: 'var(--slacksim-font-size-sm)',
          color: 'var(--slacksim-color-fg-muted)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 'var(--slacksim-space-2)',
          alignItems: 'center',
        }}
      >
        <code
          style={{
            flex: 1,
            padding: '6px 10px',
            background: 'var(--slacksim-color-bg-secondary)',
            border: '1px solid var(--slacksim-color-border)',
            borderRadius: 'var(--slacksim-radius-sm)',
            fontSize: 'var(--slacksim-font-size-sm)',
            fontFamily: 'var(--slacksim-font-mono)',
            color: 'var(--slacksim-color-fg)',
            overflow: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </code>
        <button
          onClick={copy}
          style={{
            flexShrink: 0,
            width: 70,
            padding: '0 12px',
            alignSelf: 'stretch',
            background: copied
              ? 'var(--slacksim-color-primary)'
              : 'var(--slacksim-color-bg-secondary)',
            border: '1px solid var(--slacksim-color-border)',
            borderRadius: 'var(--slacksim-radius-sm)',
            cursor: 'pointer',
            fontSize: 'var(--slacksim-font-size-sm)',
            color: copied ? '#fff' : 'var(--slacksim-color-fg)',
            transition: 'background 0.15s ease',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

// ── App dropdown ───────────────────────────────────────────────

function AppDropdown({
  apps,
  selectedId,
  onSelect,
}: {
  apps: App[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = apps.find((a) => a.id === selectedId) ?? apps[0];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!selected) return null;

  return (
    <div
      ref={ref}
      style={{ position: 'relative', marginBottom: 'var(--slacksim-space-4)' }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--slacksim-space-2)',
          width: '100%',
          padding: '8px 10px',
          background: 'var(--slacksim-color-bg)',
          border: '1px solid var(--slacksim-color-border)',
          borderRadius: 'var(--slacksim-radius-sm)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Avatar
          seed={selected.botUserName}
          size={22}
          url={selected.avatarUrl}
        />
        <span
          style={{
            flex: 1,
            fontSize: 'var(--slacksim-font-size-sm)',
            fontWeight: 'var(--slacksim-font-weight-bold)',
            color: 'var(--slacksim-color-fg)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selected.name}
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--slacksim-color-fg-muted)',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 200,
            background: 'var(--slacksim-color-modal-bg)',
            border: '1px solid var(--slacksim-color-modal-border)',
            borderRadius: 'var(--slacksim-radius-md)',
            boxShadow: 'var(--slacksim-shadow-md)',
            overflow: 'hidden',
          }}
        >
          {apps.map((app: App) => (
            <button
              key={app.id}
              onClick={() => {
                onSelect(app.id);
                setOpen(false);
              }}
              className="ss-identity-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--slacksim-space-2)',
                width: '100%',
                padding: '8px 12px',
                background:
                  app.id === selectedId
                    ? 'var(--slacksim-color-bg-secondary)'
                    : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Avatar seed={app.botUserName} size={24} url={app.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--slacksim-font-size-sm)',
                    fontWeight: 'var(--slacksim-font-weight-bold)',
                    color: 'var(--slacksim-color-fg)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {app.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--slacksim-color-fg-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  @{app.botUserName}
                </div>
              </div>
              {app.id === selectedId && (
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
                    marginLeft: 'auto',
                    color: 'var(--slacksim-color-primary)',
                  }}
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────

export default function AdminView() {
  const { apps, channels, updateAppConfig } = useStore();
  const [selectedAppId, setSelectedAppId] = useState(apps[0]?.id ?? '');
  const [activeSection, setActiveSection] = useState<SectionId>('credentials');

  const [requestUrl, setRequestUrl] = useState('');
  const [socketMode, setSocketMode] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const app = apps.find((a) => a.id === selectedAppId) ?? apps[0];

  // Sync form state when selected app changes
  useEffect(() => {
    if (app) {
      setRequestUrl(app.requestUrl ?? '');
      setSocketMode(app.socketModeEnabled ?? false);
      setEvents(app.subscribedEvents ?? []);
      setSaved(false);
    }
  }, [app?.id]);

  const credentialsRef = useRef<HTMLDivElement>(null);
  const eventDeliveryRef = useRef<HTMLDivElement>(null);
  const slashCommandsRef = useRef<HTMLDivElement>(null);
  const incomingWebhooksRef = useRef<HTMLDivElement>(null);
  const unfurlDomainsRef = useRef<HTMLDivElement>(null);
  const quickstartRef = useRef<HTMLDivElement>(null);

  const sectionRefs: Record<SectionId, React.RefObject<HTMLDivElement>> = {
    credentials: credentialsRef,
    'event-delivery': eventDeliveryRef,
    'slash-commands': slashCommandsRef,
    'incoming-webhooks': incomingWebhooksRef,
    'unfurl-domains': unfurlDomainsRef,
    quickstart: quickstartRef,
  };

  // Scroll spy: update active section based on scroll position
  useEffect(() => {
    const mainPane = document.querySelector('[data-main-pane="true"]');
    if (!mainPane) return;

    const handleScroll = () => {
      const scrollPosition = mainPane.scrollTop;
      const windowHeight = mainPane.clientHeight;

      let currentSection: SectionId = 'credentials';
      let minDistance = Infinity;

      for (const section of SECTIONS) {
        const ref = sectionRefs[section.id].current;
        if (!ref) continue;

        const rect = ref.getBoundingClientRect();
        const sectionTop = rect.top + scrollPosition;
        const distance = Math.abs(sectionTop - scrollPosition - 100);

        if (distance < minDistance) {
          minDistance = distance;
          currentSection = section.id;
        }
      }

      setActiveSection(currentSection);
    };

    mainPane.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainPane.removeEventListener('scroll', handleScroll);
  }, [sectionRefs]);

  function scrollTo(id: SectionId) {
    setActiveSection(id);
    sectionRefs[id].current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function toggleEvent(e: string) {
    setEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    );
  }

  async function handleSave() {
    if (!app) return;
    setSaving(true);
    try {
      const updated = await controlApi.updateApp(app.id, {
        requestUrl,
        socketModeEnabled: socketMode,
        subscribedEvents: events,
      });
      updateAppConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!app) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--slacksim-color-fg-muted)',
        }}
      >
        No apps configured. Add one to apps.json and restart.
      </div>
    );
  }

  let requestPort = '4001';
  try {
    requestPort = new URL(requestUrl).port || requestPort;
  } catch {}

  const card: React.CSSProperties = {
    background: 'var(--slacksim-color-bg)',
    border: '1px solid var(--slacksim-color-border)',
    borderRadius: 'var(--slacksim-radius-md)',
    padding: 'var(--slacksim-space-5)',
    marginBottom: 'var(--slacksim-space-5)',
  };

  const h2: React.CSSProperties = {
    fontSize: 'var(--slacksim-font-size-lg)',
    fontWeight: 'var(--slacksim-font-weight-bold)',
    color: 'var(--slacksim-color-fg)',
    marginBottom: 'var(--slacksim-space-4)',
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        background: 'var(--slacksim-color-bg)',
      }}
    >
      {/* Left sidebar */}
      <div
        style={{
          width: 'var(--slacksim-sidebar-width)',
          flexShrink: 0,
          borderRight: '1px solid var(--slacksim-color-border)',
          padding: 'var(--slacksim-space-5) var(--slacksim-space-4)',
          overflowY: 'auto',
          background: 'var(--slacksim-color-bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 'var(--slacksim-font-weight-bold)',
            color: 'var(--slacksim-color-fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 'var(--slacksim-space-2)',
          }}
        >
          Apps
        </div>

        <AppDropdown
          apps={apps}
          selectedId={selectedAppId}
          onSelect={(id) => {
            setSelectedAppId(id);
            setActiveSection('credentials');
          }}
        />

        <div
          style={{
            fontSize: 12,
            fontWeight: 'var(--slacksim-font-weight-bold)',
            color: 'var(--slacksim-color-fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 'var(--slacksim-space-2)',
          }}
        >
          Sections
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                background: 'transparent',
                border: 'none',
                borderLeft:
                  activeSection === s.id
                    ? '2px solid var(--slacksim-color-accent)'
                    : '2px solid transparent',
                borderRadius:
                  '0 var(--slacksim-radius-sm) var(--slacksim-radius-sm) 0',
                cursor: 'pointer',
                fontSize: 'var(--slacksim-font-size-sm)',
                fontWeight:
                  activeSection === s.id
                    ? 'var(--slacksim-font-weight-bold)'
                    : 'var(--slacksim-font-weight-normal)',
                color:
                  activeSection === s.id
                    ? 'var(--slacksim-color-fg)'
                    : 'var(--slacksim-color-fg-muted)',
                transition: 'color 0.1s ease',
              }}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div
          style={{
            marginTop: 'var(--slacksim-space-5)',
            marginLeft: 'calc(-1 * var(--slacksim-space-4))',
            marginRight: 'calc(-1 * var(--slacksim-space-4))',
            marginBottom: 'calc(-1 * var(--slacksim-space-5))',
            flexShrink: 0,
          }}
        >
          <SidebarAd />
        </div>
      </div>

      {/* Main pane */}
      <div
        data-main-pane="true"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--slacksim-space-6)',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ marginBottom: 'var(--slacksim-space-5)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--slacksim-space-3)',
                marginBottom: app.description ? 'var(--slacksim-space-2)' : 0,
              }}
            >
              <Avatar seed={app.botUserName} size={48} url={app.avatarUrl} />
              <div>
                <div
                  style={{
                    fontSize: 'var(--slacksim-font-size-xl)',
                    fontWeight: 'var(--slacksim-font-weight-bold)',
                    color: 'var(--slacksim-color-fg)',
                    lineHeight: 1.2,
                  }}
                >
                  {app.name}
                </div>
                <div
                  style={{
                    fontSize: 'var(--slacksim-font-size-sm)',
                    color: 'var(--slacksim-color-fg-muted)',
                    marginTop: 3,
                  }}
                >
                  @{app.botUserName}
                </div>
              </div>
            </div>
            {app.description && (
              <p
                style={{
                  fontSize: 'var(--slacksim-font-size-md)',
                  color: 'var(--slacksim-color-fg-muted)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {app.description}
              </p>
            )}
          </div>

          {/* Credentials */}
          <section ref={credentialsRef} style={card}>
            <h2 style={h2}>Credentials</h2>
            <CopyField
              label="Bot Token  (SLACK_BOT_TOKEN)"
              value={app.botToken}
            />
            <CopyField
              label="App Token  (SLACK_APP_TOKEN)"
              value={app.appToken}
            />
            <CopyField
              label="Signing Secret  (SLACK_SIGNING_SECRET)"
              value={app.signingSecret}
            />
            <CopyField
              label="API Base URL  (slackApiUrl)"
              value="http://localhost:4500/api/"
            />
          </section>

          {/* Event Delivery */}
          <section ref={eventDeliveryRef} style={card}>
            <h2 style={h2}>Event Delivery</h2>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--slacksim-space-3)',
                marginBottom: 'var(--slacksim-space-4)',
              }}
            >
              <input
                type="checkbox"
                id={`socketMode-${app.id}`}
                checked={socketMode}
                onChange={(e) => setSocketMode(e.target.checked)}
                style={{ cursor: 'pointer', width: 16, height: 16 }}
              />
              <label
                htmlFor={`socketMode-${app.id}`}
                style={{
                  cursor: 'pointer',
                  fontSize: 'var(--slacksim-font-size-md)',
                  color: 'var(--slacksim-color-fg)',
                }}
              >
                Socket Mode
                <span
                  style={{
                    fontSize: 'var(--slacksim-font-size-sm)',
                    color: 'var(--slacksim-color-fg-muted)',
                    marginLeft: 8,
                  }}
                >
                  bot connects via WebSocket instead of HTTP webhooks
                </span>
              </label>
            </div>

            {!socketMode && (
              <div style={{ marginBottom: 'var(--slacksim-space-4)' }}>
                <label
                  htmlFor="request-url-input"
                  style={{
                    display: 'block',
                    fontSize: 'var(--slacksim-font-size-sm)',
                    color: 'var(--slacksim-color-fg-muted)',
                    marginBottom: 4,
                  }}
                >
                  Request URL: Events API endpoint on your bot
                </label>
                <input
                  id="request-url-input"
                  type="text"
                  value={requestUrl}
                  onChange={(e) => setRequestUrl(e.target.value)}
                  placeholder="http://localhost:4001/slack/events"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid var(--slacksim-color-composer-border)',
                    borderRadius: 'var(--slacksim-radius-sm)',
                    fontFamily: 'var(--slacksim-font-mono)',
                    fontSize: 'var(--slacksim-font-size-sm)',
                    color: 'var(--slacksim-color-fg)',
                    background: 'var(--slacksim-color-bg)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: 'var(--slacksim-space-4)' }}>
              <div
                style={{
                  fontSize: 'var(--slacksim-font-size-sm)',
                  color: 'var(--slacksim-color-fg-muted)',
                  marginBottom: 8,
                }}
              >
                Subscribed Events
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--slacksim-space-3)',
                }}
              >
                {ALL_EVENTS.map((e) => (
                  <label
                    key={e}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={events.includes(e)}
                      onChange={() => toggleEvent(e)}
                      style={{ cursor: 'pointer' }}
                    />
                    <code
                      style={{
                        fontSize: 'var(--slacksim-font-size-sm)',
                        color: 'var(--slacksim-color-fg)',
                      }}
                    >
                      {e}
                    </code>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="ss-btn-primary"
              style={{
                background: 'var(--slacksim-color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--slacksim-radius-sm)',
                padding: '8px 20px',
                cursor: saving ? 'default' : 'pointer',
                fontSize: 'var(--slacksim-font-size-md)',
                fontWeight: 'var(--slacksim-font-weight-bold)',
                fontFamily: 'var(--slacksim-font-body)',
                opacity: saving ? 0.7 : 1,
                transition: 'background 0.1s ease',
              }}
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
            </button>
          </section>

          {/* Slash Commands */}
          <section ref={slashCommandsRef} style={card}>
            <h2 style={h2}>Slash Commands</h2>
            {!app.slashCommands || app.slashCommands.length === 0 ? (
              <p
                style={{
                  fontSize: 'var(--slacksim-font-size-sm)',
                  color: 'var(--slacksim-color-fg-muted)',
                  margin: 0,
                }}
              >
                No slash commands registered for this app. Add them to{' '}
                <code style={{ fontFamily: 'var(--slacksim-font-mono)' }}>
                  apps.json
                </code>{' '}
                under{' '}
                <code style={{ fontFamily: 'var(--slacksim-font-mono)' }}>
                  slashCommands
                </code>
                .
              </p>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '6px 12px 6px 0',
                          fontSize: 'var(--slacksim-font-size-sm)',
                          color: 'var(--slacksim-color-fg-muted)',
                          fontWeight: 'var(--slacksim-font-weight-bold)',
                          borderBottom:
                            '1px solid var(--slacksim-color-divider)',
                        }}
                      >
                        Command
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '6px 0',
                          fontSize: 'var(--slacksim-font-size-sm)',
                          color: 'var(--slacksim-color-fg-muted)',
                          fontWeight: 'var(--slacksim-font-weight-bold)',
                          borderBottom:
                            '1px solid var(--slacksim-color-divider)',
                        }}
                      >
                        Description
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '6px 0',
                          fontSize: 'var(--slacksim-font-size-sm)',
                          color: 'var(--slacksim-color-fg-muted)',
                          fontWeight: 'var(--slacksim-font-weight-bold)',
                          borderBottom:
                            '1px solid var(--slacksim-color-divider)',
                        }}
                      >
                        Usage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {app.slashCommands.map((sc) => (
                      <tr key={sc.command}>
                        <td
                          style={{
                            padding: '8px 12px 8px 0',
                            borderBottom:
                              '1px solid var(--slacksim-color-divider)',
                            verticalAlign: 'top',
                          }}
                        >
                          <code
                            style={{
                              fontSize: 'var(--slacksim-font-size-sm)',
                              fontFamily: 'var(--slacksim-font-mono)',
                              color: 'var(--slacksim-color-primary)',
                              fontWeight: 'var(--slacksim-font-weight-bold)',
                            }}
                          >
                            {sc.command}
                          </code>
                        </td>
                        <td
                          style={{
                            padding: '8px 0',
                            borderBottom:
                              '1px solid var(--slacksim-color-divider)',
                            fontSize: 'var(--slacksim-font-size-sm)',
                            color: 'var(--slacksim-color-fg)',
                            verticalAlign: 'top',
                          }}
                        >
                          {sc.description}
                        </td>
                        <td
                          style={{
                            padding: '8px 0',
                            borderBottom:
                              '1px solid var(--slacksim-color-divider)',
                            fontSize: 'var(--slacksim-font-size-sm)',
                            color: 'var(--slacksim-color-fg)',
                            verticalAlign: 'top',
                          }}
                        >
                          {sc.usage ? (
                            <code
                              style={{
                                fontFamily: 'var(--slacksim-font-mono)',
                                color: 'var(--slacksim-color-fg-muted)',
                              }}
                            >
                              {sc.usage}
                            </code>
                          ) : (
                            <span
                              style={{
                                color: 'var(--slacksim-color-fg-muted)',
                              }}
                            >
                              N/A
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p
                  style={{
                    marginTop: 'var(--slacksim-space-4)',
                    marginBottom: 0,
                    fontSize: 'var(--slacksim-font-size-sm)',
                    color: 'var(--slacksim-color-fg-muted)',
                  }}
                >
                  Type a command in any channel composer to trigger it. The
                  simulator routes it to this app.
                </p>
              </>
            )}
          </section>

          {/* Incoming Webhooks */}
          <section ref={incomingWebhooksRef} style={card}>
            <h2 style={h2}>Incoming Webhooks</h2>
            {!app.incomingWebhooks || app.incomingWebhooks.length === 0 ? (
              <p
                style={{
                  fontSize: 'var(--slacksim-font-size-sm)',
                  color: 'var(--slacksim-color-fg-muted)',
                  margin: 0,
                }}
              >
                No incoming webhooks configured. Add{' '}
                <code style={{ fontFamily: 'var(--slacksim-font-mono)' }}>
                  incomingWebhooks
                </code>{' '}
                to this app's entry in{' '}
                <code style={{ fontFamily: 'var(--slacksim-font-mono)' }}>
                  apps.json
                </code>{' '}
                and reset the workspace.
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--slacksim-space-4)',
                  }}
                >
                  {app.incomingWebhooks.map((wh) => {
                    const ch = channels.find((c) => c.id === wh.channelId);
                    const channelName = ch
                      ? `#${ch.name || wh.channelId}`
                      : `#${wh.channelId}`;
                    const url = `http://localhost:4500/hooks/${wh.token}`;
                    return (
                      <CopyField
                        key={wh.channelId}
                        label={channelName}
                        value={url}
                      />
                    );
                  })}
                </div>
                <div
                  style={{
                    marginTop: 'var(--slacksim-space-4)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--slacksim-font-size-sm)',
                      color: 'var(--slacksim-color-fg-muted)',
                      marginBottom: 'var(--slacksim-space-2)',
                    }}
                  >
                    Sending a request to the webhook URL will post a message as
                    this bot in the target channel.
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--slacksim-font-size-sm)',
                      color: 'var(--slacksim-color-fg-muted)',
                      marginBottom: 'var(--slacksim-space-2)',
                    }}
                  >
                    Example (cURL):
                  </div>
                  <pre
                    style={{
                      background: 'var(--slacksim-color-bg)',
                      border: '1px solid var(--slacksim-color-border)',
                      borderRadius: 'var(--slacksim-radius-sm)',
                      padding: 'var(--slacksim-space-4)',
                      fontSize: 12,
                      fontFamily: 'var(--slacksim-font-mono)',
                      color: 'var(--slacksim-color-fg)',
                      overflowX: 'auto',
                      lineHeight: 1.6,
                      margin: 0,
                      marginBottom: 'var(--slacksim-space-2)',
                    }}
                  >
                    {`curl -X POST http://localhost:4500/hooks/${app.incomingWebhooks[0].token} \\
  -H "Content-Type: application/json" \\
  -d '{"text": "hello"}'`}
                  </pre>
                  <div
                    style={{
                      fontSize: 'var(--slacksim-font-size-sm)',
                      color: 'var(--slacksim-color-fg-muted)',
                      marginBottom: 'var(--slacksim-space-2)',
                    }}
                  >
                    Example (PowerShell):
                  </div>
                  <pre
                    style={{
                      background: 'var(--slacksim-color-bg)',
                      border: '1px solid var(--slacksim-color-border)',
                      borderRadius: 'var(--slacksim-radius-sm)',
                      padding: 'var(--slacksim-space-4)',
                      fontSize: 12,
                      fontFamily: 'var(--slacksim-font-mono)',
                      color: 'var(--slacksim-color-fg)',
                      overflowX: 'auto',
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {`Invoke-RestMethod \`
-Uri "http://localhost:4500/hooks/9749e6e146d0bc5dbf46e69db6c9ac35" \`
-Method POST  \`
-ContentType "application/json"  \`
-Body '{"text":"hello random world"}'`}
                  </pre>
                </div>
              </>
            )}
          </section>

          {/* Unfurl Domains */}
          <section ref={unfurlDomainsRef} style={card}>
            <h2 style={h2}>Unfurl Domains</h2>
            {!app.unfurlDomains || app.unfurlDomains.length === 0 ? (
              <p
                style={{
                  fontSize: 'var(--slacksim-font-size-sm)',
                  color: 'var(--slacksim-color-fg-muted)',
                  margin: 0,
                }}
              >
                No unfurl domains registered. Add{' '}
                <code style={{ fontFamily: 'var(--slacksim-font-mono)' }}>
                  unfurlDomains
                </code>{' '}
                to this app's entry in{' '}
                <code style={{ fontFamily: 'var(--slacksim-font-mono)' }}>
                  apps.json
                </code>{' '}
                (e.g.{' '}
                <code style={{ fontFamily: 'var(--slacksim-font-mono)' }}>
                  ["giphy.com"]
                </code>
                ) and reset the workspace.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--slacksim-space-2)',
                }}
              >
                {app.unfurlDomains.map((domain) => (
                  <span
                    key={domain}
                    style={{
                      fontSize: 'var(--slacksim-font-size-sm)',
                      fontFamily: 'var(--slacksim-font-mono)',
                      background: 'var(--slacksim-color-bg-secondary)',
                      border: '1px solid var(--slacksim-color-border)',
                      borderRadius: 'var(--slacksim-radius-sm)',
                      padding: '2px 8px',
                      color: 'var(--slacksim-color-fg)',
                    }}
                  >
                    {domain}
                  </span>
                ))}
              </div>
            )}
            <p
              style={{
                marginTop: 'var(--slacksim-space-4)',
                marginBottom: 0,
                fontSize: 'var(--slacksim-font-size-sm)',
                color: 'var(--slacksim-color-fg-muted)',
              }}
            >
              When a message contains a URL matching one of these domains, a{' '}
              <code style={{ fontFamily: 'var(--slacksim-font-mono)' }}>
                link_shared
              </code>{' '}
              event is dispatched to this app. Respond with{' '}
              <code style={{ fontFamily: 'var(--slacksim-font-mono)' }}>
                chat.unfurl
              </code>{' '}
              to attach a preview. URLs from unregistered domains get an
              automatic Open Graph preview.
            </p>
          </section>

          {/* Quickstart */}
          <section
            ref={quickstartRef}
            style={{
              ...card,
              background: 'var(--slacksim-color-bg-secondary)',
            }}
          >
            <h2 style={h2}>Bolt Quickstart</h2>
            <pre
              style={{
                background: 'var(--slacksim-color-bg)',
                border: '1px solid var(--slacksim-color-border)',
                borderRadius: 'var(--slacksim-radius-sm)',
                padding: 'var(--slacksim-space-4)',
                fontSize: 12,
                fontFamily: 'var(--slacksim-font-mono)',
                color: 'var(--slacksim-color-fg)',
                overflowX: 'auto',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {`import { App } from '@slack/bolt'

const app = new App({
  token:         '${app.botToken}',
  socketMode:    ${socketMode},
${socketMode ? `  appToken:      '${app.appToken}',` : `  signingSecret: '${app.signingSecret}',`}
  clientOptions: { slackApiUrl: 'http://localhost:4500/api/' },
})

app.message('hello', async ({ say }) => {
  await say('Hi there! 👋')
})

await app.start(${socketMode ? '' : requestPort})
console.log('${app.name} connected to Slack Simulator')`}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
