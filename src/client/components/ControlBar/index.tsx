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
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'relative',
            top: '1px',
            width: '20px',
          }}
        >
          <path
            d="M4.34718 2.0159C5.94118 2.01593 7.52107 2.02855 9.10055 2.00886C9.62361 2.00233 10.1464 2.43708 10.1449 3.05707C10.1394 5.25535 10.1406 7.45365 10.1441 9.65194C10.1452 10.3066 9.59655 10.7087 9.08821 10.7054C6.89 10.6914 4.6916 10.6907 2.49341 10.7058C1.96732 10.7094 1.44547 10.256 1.44928 9.67452C1.46376 7.46205 1.46387 5.24937 1.44924 3.0369C1.44529 2.4389 1.98262 1.98716 2.47749 2.00933C3.09482 2.03698 3.71433 2.01593 4.34718 2.0159Z"
            fill="white"
          />
          <path
            d="M14.0154 20.2233C13.6664 20.0383 13.5094 19.7611 13.5118 19.3719C13.5193 18.1343 13.5192 16.8967 13.5117 15.6592C13.5095 15.2861 13.6657 15.0224 13.9799 14.8392C14.7278 14.4029 15.4756 13.9665 16.2234 13.5301C16.5439 13.343 16.8648 13.1567 17.1847 12.9687C17.4957 12.7859 17.8062 12.7855 18.1174 12.967C19.1816 13.5878 20.2447 14.2109 21.3109 14.8284C21.6436 15.0212 21.8 15.2992 21.7986 15.6835C21.7939 16.9163 21.7946 18.1491 21.7982 19.3819C21.7992 19.75 21.6462 20.0188 21.3293 20.2031C20.26 20.8248 19.1915 21.448 18.1241 22.0729C17.8066 22.2588 17.4967 22.2565 17.1796 22.0707C16.1288 21.4549 15.0761 20.8427 14.0154 20.2233Z"
            fill="white"
          />
          <path
            d="M19.4712 2.40005C20.8083 3.05442 21.6534 4.09666 21.9234 5.54929C22.3651 7.92564 20.8578 10.1445 18.499 10.6251C17.9333 10.7403 17.3553 10.7637 16.8022 10.6302C15.0086 10.1971 13.8521 9.08928 13.4013 7.28022C13.2674 6.74313 13.2576 6.19102 13.3531 5.65666C13.694 3.74813 15.0731 2.43703 16.7877 2.09161C17.7018 1.90744 18.6041 1.99637 19.4712 2.40005Z"
            fill="white"
          />
          <path
            d="M10.5052 17.2562C10.6619 17.5629 10.5705 17.8329 10.2677 17.9747C9.68214 18.2487 9.09528 18.5201 8.50966 18.7942C7.86074 19.0979 7.37655 19.5657 7.07608 20.2219C6.80889 20.8054 6.53142 21.3842 6.26116 21.9663C6.1946 22.1096 6.10884 22.2304 5.95384 22.285C5.70811 22.3716 5.4767 22.2756 5.35338 22.0261C5.2228 21.7619 5.10202 21.4929 4.97671 21.2261C4.80289 20.8561 4.634 20.4836 4.45373 20.1167C4.15209 19.5028 3.67236 19.0717 3.05694 18.7851C2.47944 18.5161 1.90174 18.2476 1.32399 17.9792C1.14986 17.8983 1.02242 17.7796 1.00309 17.5769C0.981152 17.3469 1.07566 17.184 1.30079 17.0765C1.72985 16.8717 2.16467 16.6787 2.59019 16.4669C2.94676 16.2894 3.30932 16.1161 3.64047 15.8974C4.03674 15.6357 4.30686 15.2511 4.50766 14.8215C4.77943 14.2401 5.05129 13.6587 5.31833 13.0751C5.41401 12.8661 5.55951 12.7289 5.7956 12.7304C6.02535 12.7319 6.16786 12.8673 6.26136 13.0705C6.52363 13.6406 6.7935 14.2072 7.05521 14.7775C7.36121 15.4443 7.83816 15.936 8.50876 16.2426C9.09246 16.5094 9.67172 16.7861 10.2499 17.0646C10.3412 17.1086 10.4165 17.1855 10.5052 17.2562Z"
            fill="white"
          />
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
              height: '28px',
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
            height: '28px',
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
