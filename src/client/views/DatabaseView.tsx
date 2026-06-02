import React, { useState, useEffect, useCallback } from 'react'
import { controlApi } from '../lib/api'

interface ColumnMeta {
  name: string
  type: string
  pk: boolean
  notnull: boolean
}

interface FkMap {
  [col: string]: { table: string; col: string }
}

interface TableMeta {
  name: string
  rowCount: number
  columns: ColumnMeta[]
  fks: FkMap
}

interface TableData {
  rows: Record<string, unknown>[]
  total: number
  columns: string[]
}

const PAGE_SIZE = 50

// ── Helpers ────────────────────────────────────────────────────

function isJsonString(val: unknown): val is string {
  if (typeof val !== 'string') return false
  const s = val.trim()
  return (s.startsWith('{') || s.startsWith('['))
}

function CellValue({
  value,
  onExpand,
}: {
  value: unknown
  onExpand: (v: string) => void
}) {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--slacksim-color-fg-muted)', fontStyle: 'italic' }}>null</span>
  }
  if (isJsonString(value)) {
    return (
      <span
        onClick={() => onExpand(value as string)}
        style={{
          cursor: 'pointer',
          color: 'var(--slacksim-color-accent)',
          textDecoration: 'underline dotted',
          fontFamily: 'var(--slacksim-font-mono)',
          fontSize: 11,
        }}
        title="Click to expand JSON"
      >
        {(value as string).length > 40 ? (value as string).slice(0, 40) + '…' : value as string}
      </span>
    )
  }
  const str = String(value)
  return (
    <span style={{ fontFamily: 'var(--slacksim-font-mono)', fontSize: 11 }}>
      {str.length > 60 ? str.slice(0, 60) + '…' : str}
    </span>
  )
}

// ── JSON expand modal ──────────────────────────────────────────

function JsonModal({ value, onClose }: { value: string; onClose: () => void }) {
  let pretty = value
  try { pretty = JSON.stringify(JSON.parse(value), null, 2) } catch { /* keep raw */ }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--slacksim-color-bg)',
          border: '1px solid var(--slacksim-color-border)',
          borderRadius: 'var(--slacksim-radius-md)',
          boxShadow: 'var(--slacksim-shadow-lg)',
          width: 560, maxHeight: '70vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--slacksim-color-border)',
        }}>
          <span style={{ fontSize: 'var(--slacksim-font-size-sm)', fontWeight: 'var(--slacksim-font-weight-bold)', color: 'var(--slacksim-color-fg)' }}>
            JSON value
          </span>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--slacksim-color-fg-muted)' }}
          >×</button>
        </div>
        <pre style={{
          margin: 0, padding: '12px 16px',
          overflowY: 'auto', flex: 1,
          fontSize: 12, lineHeight: 1.6,
          fontFamily: 'var(--slacksim-font-mono)',
          color: 'var(--slacksim-color-fg)',
          background: 'var(--slacksim-color-bg-secondary)',
        }}>
          {pretty}
        </pre>
      </div>
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────

export default function DatabaseView() {
  const [tables, setTables] = useState<TableMeta[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableData, setTableData] = useState<TableData | null>(null)
  const [loading, setLoading] = useState(false)
  const [orderBy, setOrderBy] = useState<string | undefined>(undefined)
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [offset, setOffset] = useState(0)
  const [expandedJson, setExpandedJson] = useState<string | null>(null)
  const [tablesLoading, setTablesLoading] = useState(true)
  const [tablesError, setTablesError] = useState<string | null>(null)

  // Fetch table list
  const fetchTables = useCallback(async () => {
    setTablesLoading(true)
    setTablesError(null)
    try {
      const data = await controlApi.getDbTables()
      setTables(data.tables)
      if (!selectedTable && data.tables.length > 0) {
        setSelectedTable(data.tables[0].name)
      }
    } catch (err) {
      setTablesError(err instanceof Error ? err.message : 'Failed to load tables')
    } finally {
      setTablesLoading(false)
    }
  }, [selectedTable])

  useEffect(() => { fetchTables() }, [])

  // Fetch rows when selection/sort/page changes
  const fetchRows = useCallback(async (tableName: string) => {
    setLoading(true)
    try {
      const data = await controlApi.getDbTableRows(tableName, { limit: PAGE_SIZE, offset, orderBy, order })
      setTableData(data)
    } finally {
      setLoading(false)
    }
  }, [offset, orderBy, order])

  useEffect(() => {
    if (selectedTable) fetchRows(selectedTable)
  }, [selectedTable, fetchRows])

  // Reset pagination when table changes
  function selectTable(name: string) {
    if (name === selectedTable) return
    setSelectedTable(name)
    setOffset(0)
    setOrderBy(undefined)
    setOrder('asc')
    setTableData(null)
  }

  function toggleSort(col: string) {
    if (orderBy === col) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setOrderBy(col)
      setOrder('asc')
    }
    setOffset(0)
  }

  const selectedMeta = tables.find(t => t.name === selectedTable)
  const totalPages = tableData ? Math.ceil(tableData.total / PAGE_SIZE) : 0
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  const sidebarStyle: React.CSSProperties = {
    width: 200,
    flexShrink: 0,
    borderRight: '1px solid var(--slacksim-color-border)',
    overflowY: 'auto',
    background: 'var(--slacksim-color-bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
  }

  const thStyle = (col: string): React.CSSProperties => ({
    padding: '6px 12px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 'var(--slacksim-font-weight-bold)',
    color: 'var(--slacksim-color-fg-muted)',
    background: 'var(--slacksim-color-bg-secondary)',
    borderBottom: '2px solid var(--slacksim-color-border)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    fontFamily: 'var(--slacksim-font-mono)',
  })

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--slacksim-color-bg)' }}>

      {/* Left rail — table list */}
      <div style={sidebarStyle}>
        <div style={{
          padding: '10px 12px 6px',
          fontSize: 'var(--slacksim-font-size-sm)',
          fontWeight: 'var(--slacksim-font-weight-bold)',
          color: 'var(--slacksim-color-fg-muted)',
          borderBottom: '1px solid var(--slacksim-color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Tables</span>
          <button
            onClick={fetchTables}
            title="Refresh table list"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--slacksim-color-fg-muted)', padding: '0 2px',
              lineHeight: 1,
            }}
          ><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
        </div>

        {tablesLoading ? (
          <div style={{ padding: 12, fontSize: 'var(--slacksim-font-size-sm)', color: 'var(--slacksim-color-fg-muted)' }}>
            Loading…
          </div>
        ) : tablesError ? (
          <div style={{ padding: 12, fontSize: 'var(--slacksim-font-size-sm)', color: 'var(--slacksim-color-danger, #e8283b)', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 'var(--slacksim-font-weight-bold)', marginBottom: 4 }}>Error loading tables</div>
            <div style={{ color: 'var(--slacksim-color-fg-muted)' }}>{tablesError}</div>
            <div style={{ marginTop: 8, color: 'var(--slacksim-color-fg-muted)' }}>Try restarting the dev server.</div>
          </div>
        ) : (
          tables.map(t => (
            <button
              key={t.name}
              onClick={() => selectTable(t.name)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '8px 12px',
                background: selectedTable === t.name ? 'var(--slacksim-color-bg)' : 'transparent',
                border: 'none',
                borderLeft: selectedTable === t.name ? '2px solid var(--slacksim-color-accent)' : '2px solid transparent',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 'var(--slacksim-font-size-sm)',
                color: selectedTable === t.name ? 'var(--slacksim-color-fg)' : 'var(--slacksim-color-fg-muted)',
                fontWeight: selectedTable === t.name ? 'var(--slacksim-font-weight-bold)' : 'var(--slacksim-font-weight-normal)',
                fontFamily: 'var(--slacksim-font-mono)',
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
                {t.name}
              </span>
              <span style={{
                fontSize: 10, color: 'var(--slacksim-color-fg-muted)',
                background: 'var(--slacksim-color-border)',
                borderRadius: 'var(--slacksim-radius-pill)',
                padding: '1px 6px', flexShrink: 0,
              }}>
                {t.rowCount}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Right pane — table data */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {!selectedTable ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slacksim-color-fg-muted)' }}>
            Select a table
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--slacksim-color-border)',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontWeight: 'var(--slacksim-font-weight-bold)', color: 'var(--slacksim-color-fg)', fontFamily: 'var(--slacksim-font-mono)' }}>
                {selectedTable}
              </span>
              {tableData && (
                <span style={{ fontSize: 'var(--slacksim-font-size-sm)', color: 'var(--slacksim-color-fg-muted)' }}>
                  {tableData.total} rows
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 'var(--slacksim-font-size-sm)', color: 'var(--slacksim-color-fg-muted)' }}>
                Read-only
              </span>
              <button
                onClick={() => selectedTable && fetchRows(selectedTable)}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '3px 10px',
                  background: 'transparent',
                  border: '1px solid var(--slacksim-color-border)',
                  borderRadius: 'var(--slacksim-radius-sm)',
                  cursor: 'pointer',
                  fontSize: 'var(--slacksim-font-size-sm)',
                  color: 'var(--slacksim-color-fg-muted)',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>Refresh
              </button>
            </div>

            {/* Schema strip */}
            {selectedMeta && (
              <div style={{
                padding: '6px 16px',
                borderBottom: '1px solid var(--slacksim-color-border)',
                flexShrink: 0,
                display: 'flex', flexWrap: 'wrap', gap: 6,
                background: 'var(--slacksim-color-bg-secondary)',
              }}>
                {selectedMeta.columns.map(col => (
                  <span
                    key={col.name}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontFamily: 'var(--slacksim-font-mono)',
                      padding: '2px 8px',
                      background: 'var(--slacksim-color-bg)',
                      border: '1px solid var(--slacksim-color-border)',
                      borderRadius: 'var(--slacksim-radius-sm)',
                      color: 'var(--slacksim-color-fg)',
                    }}
                  >
                    {col.pk && <span style={{ color: '#F5C518', fontSize: 9 }}>PK</span>}
                    {col.notnull && !col.pk && <span style={{ color: 'var(--slacksim-color-fg-muted)', fontSize: 9 }}>NN</span>}
                    {selectedMeta.fks[col.name] && (
                      <span style={{ color: 'var(--slacksim-color-accent)', fontSize: 9 }}>FK</span>
                    )}
                    <span>{col.name}</span>
                    <span style={{ color: 'var(--slacksim-color-fg-muted)' }}>{col.type || 'TEXT'}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Grid */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
              {loading ? (
                <div style={{ padding: 24, color: 'var(--slacksim-color-fg-muted)', fontSize: 'var(--slacksim-font-size-sm)' }}>
                  Loading…
                </div>
              ) : !tableData || tableData.rows.length === 0 ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 120, color: 'var(--slacksim-color-fg-muted)',
                  fontSize: 'var(--slacksim-font-size-md)',
                }}>
                  No rows in {selectedTable}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {tableData.columns.map(col => (
                        <th
                          key={col}
                          style={thStyle(col)}
                          onClick={() => toggleSort(col)}
                        >
                          {col}
                          {orderBy === col && (
                            <span style={{ marginLeft: 4 }}>{order === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        style={{ background: ri % 2 === 0 ? 'var(--slacksim-color-bg)' : 'var(--slacksim-color-bg-secondary)' }}
                      >
                        {tableData.columns.map(col => (
                          <td
                            key={col}
                            style={{
                              padding: '5px 12px',
                              borderBottom: '1px solid var(--slacksim-color-border)',
                              maxWidth: 280,
                              overflow: 'hidden',
                              verticalAlign: 'top',
                            }}
                          >
                            <CellValue value={row[col]} onExpand={setExpandedJson} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {tableData && tableData.total > PAGE_SIZE && (
              <div style={{
                padding: '8px 16px',
                borderTop: '1px solid var(--slacksim-color-border)',
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--slacksim-color-bg-secondary)',
              }}>
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  style={{
                    padding: '3px 10px', cursor: offset === 0 ? 'default' : 'pointer',
                    opacity: offset === 0 ? 0.4 : 1,
                    background: 'transparent',
                    border: '1px solid var(--slacksim-color-border)',
                    borderRadius: 'var(--slacksim-radius-sm)',
                    fontSize: 'var(--slacksim-font-size-sm)',
                    color: 'var(--slacksim-color-fg)',
                  }}
                >← Prev</button>
                <span style={{ fontSize: 'var(--slacksim-font-size-sm)', color: 'var(--slacksim-color-fg-muted)' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={offset + PAGE_SIZE >= tableData.total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  style={{
                    padding: '3px 10px', cursor: offset + PAGE_SIZE >= tableData.total ? 'default' : 'pointer',
                    opacity: offset + PAGE_SIZE >= tableData.total ? 0.4 : 1,
                    background: 'transparent',
                    border: '1px solid var(--slacksim-color-border)',
                    borderRadius: 'var(--slacksim-radius-sm)',
                    fontSize: 'var(--slacksim-font-size-sm)',
                    color: 'var(--slacksim-color-fg)',
                  }}
                >Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* JSON expand modal */}
      {expandedJson && (
        <JsonModal value={expandedJson} onClose={() => setExpandedJson(null)} />
      )}
    </div>
  )
}
