import React, { useState, useRef, useEffect } from 'react';
import TabSwitcher from './TabSwitcher';
import { controlApi } from '../../lib/api';
import { useStore } from '../../store';

export default function ControlBar() {
  const { theme, setTheme } = useStore();
  const [themeOpen, setThemeOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const themeRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  const themes = ['Slack Light', 'Slack Dark'] as const;

  const handleReset = async () => {
    if (confirm('Reset workspace to seed data?')) {
      await controlApi.resetWorkspace();
      window.location.reload();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!themeOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setThemeOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev < themes.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : themes.length - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) {
          setTheme(themes[focusedIndex]);
          setThemeOpen(false);
          setFocusedIndex(-1);
          triggerRef.current?.focus();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setThemeOpen(false);
        setFocusedIndex(-1);
        triggerRef.current?.focus();
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        themeRef.current &&
        !themeRef.current.contains(event.target as Node)
      ) {
        setThemeOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus the first item when dropdown opens
  useEffect(() => {
    if (themeOpen && focusedIndex >= 0) {
      itemsRef.current[focusedIndex]?.focus();
    }
  }, [themeOpen, focusedIndex]);

  return (
    <div
      style={{
        height: 'var(--slacksim-control-bar-height)',
        background: 'var(--slacksim-color-control-bar-bg)',
        borderBottom: '1px solid var(--slacksim-color-bar-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px 0 16px',
        flexShrink: 0,
      }}
    >
      {/* Left */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--slacksim-space-2)',
        }}
      >
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
          aria-hidden="true"
          style={{
            color: 'var(--slacksim-color-sidebar-fg-active)',
            flexShrink: 0,
          }}
        >
          <path d="M10 12h4" />
          <path d="M10 8h4" />
          <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
          <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
          <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
        </svg>
        <span
          style={{
            fontSize: 'var(--slacksim-font-size-md)',
            fontWeight: 'var(--slacksim-font-weight-bold)',
            color: 'var(--slacksim-color-sidebar-fg-active)',
            letterSpacing: '0.01em',
          }}
        >
          Slack Simulator
        </span>
      </div>

      {/* Center */}
      <TabSwitcher />

      {/* Right */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 'var(--slacksim-space-2)',
        }}
      >
        {/* Theme switcher */}
        <div ref={themeRef} style={{ position: 'relative' }}>
          <button
            ref={triggerRef}
            onClick={() => setThemeOpen(!themeOpen)}
            onKeyDown={handleKeyDown}
            className="ss-toolbar-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--slacksim-space-2)',
              border: 'none',
              color: 'var(--slacksim-color-sidebar-fg)',
              cursor: 'pointer',
              borderRadius: 'var(--slacksim-radius-sm)',
              padding: '6px 10px',
              fontSize: 'var(--slacksim-font-size-sm)',
              width: '130px',
              justifyContent: 'flex-start',
            }}
            aria-haspopup="true"
            aria-expanded={themeOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="M10 2v2" />
              <path d="M14 2v4" />
              <path d="M17 2a1 1 0 0 1 1 1v9H6V3a1 1 0 0 1 1-1z" />
              <path d="M6 12a1 1 0 0 0-1 1v1a2 2 0 0 0 2 2h2a1 1 0 0 1 1 1v2.9a2 2 0 1 0 4 0V17a1 1 0 0 1 1-1h2a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1" />
            </svg>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                textAlign: 'left',
              }}
            >
              {theme}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                flexShrink: 0,
                transform: themeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {themeOpen && (
            <div
              role="menu"
              onKeyDown={handleKeyDown}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: 'var(--slacksim-color-bg)',
                border: '1px solid var(--slacksim-color-border)',
                borderRadius: 'var(--slacksim-radius-sm)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                minWidth: '160px',
                zIndex: 1000,
              }}
            >
              {themes.map((themeOption, index) => (
                <div
                  key={themeOption}
                  ref={(el) => (itemsRef.current[index] = el)}
                  role="menuitem"
                  tabIndex={focusedIndex === index ? 0 : -1}
                  onClick={() => {
                    setTheme(themeOption);
                    setThemeOpen(false);
                    setFocusedIndex(-1);
                    triggerRef.current?.focus();
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 'var(--slacksim-font-size-sm)',
                    color: 'var(--slacksim-color-fg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background:
                      focusedIndex === index
                        ? 'var(--slacksim-color-bg-secondary)'
                        : 'transparent',
                  }}
                  onMouseEnter={() => setFocusedIndex(index)}
                  onMouseLeave={() => setFocusedIndex(-1)}
                >
                  <span>{themeOption}</span>
                  {theme === themeOption && (
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
                      style={{ color: 'var(--slacksim-color-accent)' }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <a
          href="https://buymeacoffee.com/clydedsouza"
          target="_blank"
          rel="noreferrer"
          className="ss-toolbar-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--slacksim-space-2)',
            border: 'none',
            color: 'var(--slacksim-color-sidebar-fg)',
            cursor: 'pointer',
            borderRadius: 'var(--slacksim-radius-sm)',
            padding: '6px 10px',
            fontSize: 'var(--slacksim-font-size-sm)',
            textDecoration: 'none',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 2v2" />
            <path d="M14 2v2" />
            <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
            <path d="M6 2v2" />
          </svg>
          Buy me a coffee
        </a>
        <button
          onClick={handleReset}
          className="ss-toolbar-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--slacksim-space-2)',
            border: 'none',
            color: 'var(--slacksim-color-sidebar-fg)',
            cursor: 'pointer',
            borderRadius: 'var(--slacksim-radius-sm)',
            padding: '6px 10px',
            fontSize: 'var(--slacksim-font-size-sm)',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v10" />
            <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
          </svg>
          Reset workspace
        </button>
      </div>
    </div>
  );
}
