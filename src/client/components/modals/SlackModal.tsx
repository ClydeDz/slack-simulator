import React, { useState, useEffect } from 'react'
import type { ModalView, InputBlock, PlainTextInputElement, StaticSelectElement, Block } from '@shared/types'
import { useStore } from '../../store'
import { controlApi } from '../../lib/api'
import BlockKit from '../MainPane/BlockKit'

// ── Input block renderer ──────────────────────────────────────────────────────

interface InputState {
  [blockId: string]: {
    [actionId: string]: string
  }
}

function PlainTextInput({ el, value, onChange }: {
  el: PlainTextInputElement
  value: string
  onChange: (v: string) => void
}) {
  return el.multiline ? (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={el.placeholder?.text ?? ''}
      rows={4}
      style={{
        width: '100%',
        padding: '8px 10px',
        border: '1px solid var(--slacksim-color-composer-border)',
        borderRadius: 'var(--slacksim-radius-sm)',
        fontFamily: 'var(--slacksim-font-body)',
        fontSize: 'var(--slacksim-font-size-md)',
        color: 'var(--slacksim-color-fg)',
        background: 'var(--slacksim-color-bg)',
        resize: 'vertical',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  ) : (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={el.placeholder?.text ?? ''}
      style={{
        width: '100%',
        padding: '8px 10px',
        border: '1px solid var(--slacksim-color-composer-border)',
        borderRadius: 'var(--slacksim-radius-sm)',
        fontFamily: 'var(--slacksim-font-body)',
        fontSize: 'var(--slacksim-font-size-md)',
        color: 'var(--slacksim-color-fg)',
        background: 'var(--slacksim-color-bg)',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}

function StaticSelectInput({ el, value, onChange }: {
  el: StaticSelectElement
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 10px',
        border: '1px solid var(--slacksim-color-composer-border)',
        borderRadius: 'var(--slacksim-radius-sm)',
        fontFamily: 'var(--slacksim-font-body)',
        fontSize: 'var(--slacksim-font-size-md)',
        color: value ? 'var(--slacksim-color-fg)' : 'var(--slacksim-color-fg-placeholder)',
        background: 'var(--slacksim-color-bg)',
        outline: 'none',
        boxSizing: 'border-box',
        cursor: 'pointer',
      }}
    >
      {!value && el.placeholder && (
        <option value="" disabled>{el.placeholder.text}</option>
      )}
      {el.options.map((opt, i) => (
        <option key={i} value={opt.value}>{opt.text.text}</option>
      ))}
    </select>
  )
}

function InputBlockEl({ block, inputState, setInputState }: {
  block: InputBlock
  inputState: InputState
  setInputState: React.Dispatch<React.SetStateAction<InputState>>
}) {
  const blockId = block.block_id ?? block.element.action_id ?? 'block'
  const actionId = block.element.action_id ?? 'value'
  const el = block.element
  const initialValue = el.type === 'plain_text_input' ? (el.initial_value ?? '') : (el.initial_option?.value ?? '')
  const currentValue = inputState[blockId]?.[actionId] ?? initialValue

  return (
    <div style={{ marginBottom: 'var(--slacksim-space-4)' }}>
      <label style={{
        display: 'block',
        marginBottom: 'var(--slacksim-space-2)',
        fontWeight: 'var(--slacksim-font-weight-bold)',
        fontSize: 'var(--slacksim-font-size-md)',
        color: 'var(--slacksim-color-fg)',
      }}>
        {block.label.text}
        {!block.optional && <span style={{ color: 'var(--slacksim-color-sidebar-badge-bg)', marginLeft: 4 }}>*</span>}
      </label>
      {el.type === 'plain_text_input' && (
        <PlainTextInput
          el={el}
          value={currentValue}
          onChange={v => setInputState(prev => ({
            ...prev,
            [blockId]: { ...(prev[blockId] ?? {}), [actionId]: v },
          }))}
        />
      )}
      {el.type === 'static_select' && (
        <StaticSelectInput
          el={el}
          value={currentValue}
          onChange={v => setInputState(prev => ({
            ...prev,
            [blockId]: { ...(prev[blockId] ?? {}), [actionId]: v },
          }))}
        />
      )}
      {block.hint && (
        <div style={{
          marginTop: 'var(--slacksim-space-1)',
          fontSize: 'var(--slacksim-font-size-sm)',
          color: 'var(--slacksim-color-fg-muted)',
        }}>
          {block.hint.text}
        </div>
      )}
    </div>
  )
}

// ── Modal component ───────────────────────────────────────────────────────────

interface Props {
  view: ModalView
  appId: string
  stackDepth?: number
}

export default function SlackModal({ view, appId, stackDepth = 1 }: Props) {
  const { closeModal, closeAllModals } = useStore()
  const [inputState, setInputState] = useState<InputState>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // When the active view changes (e.g. views.push swaps in a new modal), reset
  // all local state so the new view starts clean and buttons are not disabled.
  useEffect(() => {
    setInputState({})
    setErrors({})
    setIsSubmitting(false)
  }, [view.id])

  const submitLabel = view.submit?.text ?? 'Submit'
  const closeLabel = view.close?.text ?? 'Cancel'
  const hasSubmit = !!view.submit

  // Separate display blocks (non-input) from input blocks
  const displayBlocks: Block[] = []
  const inputBlocks: InputBlock[] = []

  for (const block of view.blocks) {
    if ((block as InputBlock).type === 'input') {
      inputBlocks.push(block as InputBlock)
    } else {
      displayBlocks.push(block as Block)
    }
  }

  async function handleSubmit() {
    // Build values map: { [blockId]: { [actionId]: { type, value } } }
    const values: Record<string, Record<string, { type: string; value: string }>> = {}
    for (const block of inputBlocks) {
      const blockId = block.block_id ?? block.element.action_id ?? 'block'
      const actionId = block.element.action_id ?? 'value'
      const el = block.element
      const initialValue = el.type === 'plain_text_input' ? (el.initial_value ?? '') : (el.initial_option?.value ?? '')
      const rawValue = inputState[blockId]?.[actionId] ?? initialValue
      values[blockId] = {
        [actionId]: { type: el.type, value: rawValue },
      }
    }

    setIsSubmitting(true)
    setErrors({})
    try {
      const result = await controlApi.submitView(view.id, values)
      if (result?.errors && Object.keys(result.errors).length > 0) {
        setErrors(result.errors as Record<string, string>)
        return
      }
      // keepOpen = server pushed/updated a new view — don't close
      if (!result?.keepOpen) {
        closeAllModals()
      }
    } catch (_) {
      // silent
    } finally {
      setIsSubmitting(false)
    }
  }

  // Back ← : pop just the top view, no bot notification
  function handleBack() {
    closeModal()
  }

  // X / Cancel: close the entire stack; fire view_closed only if notify_on_close
  async function handleDismiss() {
    if (view.notify_on_close) {
      try { await controlApi.closeView(view.id) } catch (_) { /* silent */ }
    }
    closeAllModals()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--slacksim-color-modal-overlay)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleDismiss() }}
    >
      <div style={{
        background: 'var(--slacksim-color-modal-bg)',
        borderRadius: 'var(--slacksim-radius-lg)',
        boxShadow: 'var(--slacksim-shadow-lg)',
        width: 520,
        maxWidth: '90vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--slacksim-space-5)',
          borderBottom: '1px solid var(--slacksim-color-border)',
          gap: 'var(--slacksim-space-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--slacksim-space-2)', minWidth: 0 }}>
            {stackDepth > 1 && (
              <button
                onClick={handleBack}
                title="Back"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--slacksim-color-fg-muted)',
                  padding: 'var(--slacksim-space-1)',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
            )}
            <h2 style={{
              fontSize: 'var(--slacksim-font-size-xl)',
              fontWeight: 'var(--slacksim-font-weight-bold)',
              color: 'var(--slacksim-color-fg)',
              margin: 0,
            }}>
              {view.title.text}
            </h2>
          </div>
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--slacksim-font-size-xl)',
              color: 'var(--slacksim-color-fg-muted)',
              lineHeight: 1,
              padding: 'var(--slacksim-space-1)',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--slacksim-space-5)' }}>
          {/* Non-input blocks */}
          {displayBlocks.length > 0 && (
            <div style={{ marginBottom: inputBlocks.length > 0 ? 'var(--slacksim-space-4)' : 0 }}>
              <BlockKit blocks={displayBlocks} viewId={view.id} appId={appId} />
            </div>
          )}

          {/* Input blocks */}
          {inputBlocks.map((block, i) => {
            const blockId = block.block_id ?? block.element.action_id ?? 'block'
            return (
              <div key={i}>
                <InputBlockEl block={block} inputState={inputState} setInputState={setInputState} />
                {errors[blockId] && (
                  <div style={{
                    marginTop: 'calc(-1 * var(--slacksim-space-3))',
                    marginBottom: 'var(--slacksim-space-3)',
                    fontSize: 'var(--slacksim-font-size-sm)',
                    color: 'var(--slacksim-color-sidebar-badge-bg)',
                  }}>
                    {errors[blockId]}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {(hasSubmit || view.close) && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--slacksim-space-3)',
            padding: 'var(--slacksim-space-4) var(--slacksim-space-5)',
            borderTop: '1px solid var(--slacksim-color-border)',
          }}>
            {view.close && (
              <button
                type="button"
                onClick={handleDismiss}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--slacksim-color-border)',
                  borderRadius: 'var(--slacksim-radius-sm)',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: 'var(--slacksim-font-size-md)',
                  color: 'var(--slacksim-color-fg)',
                  fontFamily: 'var(--slacksim-font-body)',
                }}
              >
                {closeLabel}
              </button>
            )}
            {hasSubmit && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="ss-btn-primary"
                style={{
                  background: 'var(--slacksim-color-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--slacksim-radius-sm)',
                  padding: '8px 16px',
                  cursor: isSubmitting ? 'default' : 'pointer',
                  fontSize: 'var(--slacksim-font-size-md)',
                  fontWeight: 'var(--slacksim-font-weight-bold)',
                  fontFamily: 'var(--slacksim-font-body)',
                  transition: 'background 0.1s ease',
                }}
              >
                {isSubmitting ? 'Submitting…' : submitLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
