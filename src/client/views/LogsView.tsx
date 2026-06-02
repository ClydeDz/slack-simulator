import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { controlApi } from '../lib/api'
import type { LogEntry } from '@shared/types'

function badge(entry: LogEntry) {
  if (entry.direction === 'inbound') return { label: 'IN', bg: 'var(--slacksim-color-accent)', color: '#fff' }
  if (entry.error) return { label: 'ERR', bg: '#E01E5A', color: '#fff' }
  return { label: 'OUT', bg: 'var(--slacksim-color-primary)', color: '#fff' }
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const b = badge(entry)

  return (
    <div style={{
      borderBottom: '1px solid var(--slacksim-color-border)',
      fontFamily: 'var(--slacksim-font-mono)',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--slacksim-space-3)',
          width: '100%', padding: '8px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Direction badge */}
        <span style={{
          flexShrink: 0, width: 32, textAlign: 'center',
          padding: '1px 4px', borderRadius: 'var(--slacksim-radius-sm)',
          fontSize: 10, fontWeight: 'var(--slacksim-font-weight-bold)',
          background: b.bg, color: b.color,
        }}>
          {b.label}
        </span>

        {/* Transport */}
        <span style={{
          flexShrink: 0, width: 80,
          fontSize: 'var(--slacksim-font-size-sm)',
          color: 'var(--slacksim-color-fg-muted)',
        }}>
          {entry.transport}
        </span>

        {/* Event type */}
        <span style={{
          flex: 1, fontSize: 'var(--slacksim-font-size-sm)',
          color: 'var(--slacksim-color-fg)',
          fontWeight: 'var(--slacksim-font-weight-bold)',
        }}>
          {entry.eventType}
        </span>

        {/* Status */}
        {entry.status !== undefined && (
          <span style={{
            flexShrink: 0,
            fontSize: 'var(--slacksim-font-size-sm)',
            color: entry.error ? '#E01E5A' : 'var(--slacksim-color-primary)',
          }}>
            {entry.status || 'no_conn'}
          </span>
        )}

        {/* Duration */}
        {entry.durationMs !== undefined && (
          <span style={{ flexShrink: 0, fontSize: 'var(--slacksim-font-size-sm)', color: 'var(--slacksim-color-fg-muted)', width: 60, textAlign: 'right' }}>
            {entry.durationMs}ms
          </span>
        )}

        {/* Time */}
        <span style={{ flexShrink: 0, fontSize: 'var(--slacksim-font-size-sm)', color: 'var(--slacksim-color-fg-muted)', width: 80, textAlign: 'right' }}>
          {formatTime(entry.ts)}
        </span>

        {/* Expand chevron */}
        <span style={{ flexShrink: 0, fontSize: 10, color: 'var(--slacksim-color-fg-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>▶</span>
      </button>

      {expanded && (
        <pre style={{
          margin: 0, padding: '12px 16px 12px 56px',
          background: 'var(--slacksim-color-bg-secondary)',
          fontSize: 11, lineHeight: 1.5,
          fontFamily: 'var(--slacksim-font-mono)',
          color: 'var(--slacksim-color-fg)',
          overflowX: 'auto',
          borderTop: '1px solid var(--slacksim-color-border)',
        }}>
          {JSON.stringify(entry.payload, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function LogsView() {
  const { logs, setLogs } = useStore()
  const [filter, setFilter] = useState<'all' | 'outbound' | 'inbound' | 'errors' | 'bot_offline'>('all')

  // Initial fetch on mount
  useEffect(() => {
    controlApi.getLogs().then(setLogs).catch(() => {})
  }, [])

  const filtered = logs.filter(e => {
    if (filter === 'outbound') return e.direction === 'outbound'
    if (filter === 'inbound') return e.direction === 'inbound'
    if (filter === 'errors') return !!e.error
    if (filter === 'bot_offline') return e.direction === 'outbound' && e.status === 0
    return true
  })

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    background: active ? 'var(--slacksim-color-accent)' : 'transparent',
    color: active ? '#fff' : 'var(--slacksim-color-fg-muted)',
    border: '1px solid ' + (active ? 'var(--slacksim-color-accent)' : 'var(--slacksim-color-border)'),
    borderRadius: 'var(--slacksim-radius-sm)',
    cursor: 'pointer',
    fontSize: 'var(--slacksim-font-size-sm)',
    fontFamily: 'var(--slacksim-font-body)',
    transition: 'background 0.1s ease',
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--slacksim-color-bg)' }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--slacksim-space-2)',
        padding: '10px 16px',
        borderBottom: '1px solid var(--slacksim-color-border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--slacksim-font-size-md)', fontWeight: 'var(--slacksim-font-weight-bold)', color: 'var(--slacksim-color-fg)', marginRight: 8 }}>
          Logs
        </span>
        {([
          { key: 'all', label: 'all' },
          { key: 'outbound', label: 'outbound' },
          { key: 'inbound', label: 'inbound' },
          { key: 'errors', label: 'errors' },
          { key: 'bot_offline', label: 'bot offline' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)} style={btnStyle(filter === key)}>
            {label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 'var(--slacksim-font-size-sm)', color: 'var(--slacksim-color-fg-muted)' }}>
          {filtered.length} entries · live
        </span>
        <button
          onClick={() => controlApi.getLogs().then(setLogs).catch(() => {})}
          style={{ ...btnStyle(false), padding: '4px 10px' }}
        >
          ↺ Refresh
        </button>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--slacksim-space-3)',
        padding: '4px 16px',
        background: 'var(--slacksim-color-bg-secondary)',
        borderBottom: '1px solid var(--slacksim-color-border)',
        fontSize: 11, color: 'var(--slacksim-color-fg-muted)',
        fontFamily: 'var(--slacksim-font-mono)',
        flexShrink: 0,
      }}>
        <span style={{ width: 32 }}>dir</span>
        <span style={{ width: 80 }}>transport</span>
        <span style={{ flex: 1 }}>event</span>
        <span style={{ width: 60 }}>status</span>
        <span style={{ width: 60, textAlign: 'right' }}>ms</span>
        <span style={{ width: 80, textAlign: 'right' }}>time</span>
        <span style={{ width: 16 }} />
      </div>

      {/* Log rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 200, color: 'var(--slacksim-color-fg-muted)',
            fontSize: 'var(--slacksim-font-size-md)',
          }}>
            No log entries yet. Send a message or call the API.
          </div>
        ) : (
          filtered.map(entry => <LogRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  )
}
