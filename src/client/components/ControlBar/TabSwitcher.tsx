import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store';

const TABS = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'admin', label: 'Apps' },
  { id: 'logs', label: 'Logs' },
  { id: 'database', label: 'Database' },
] as const;

export default function TabSwitcher() {
  const { activeTab, setActiveTab } = useStore();
  const idx = TABS.findIndex((t) => t.id === activeTab);

  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState({ left: 3, width: 0 });

  // Measure the actual rendered button position after every idx change
  useEffect(() => {
    const btn = btnRefs.current[idx];
    const container = containerRef.current;
    if (!btn || !container) return;

    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();

    setThumb({
      left: bRect.left - cRect.left,
      width: bRect.width,
    });
  }, [idx]);

  // Also re-measure on window resize
  useEffect(() => {
    const onResize = () => {
      const btn = btnRefs.current[idx];
      const container = containerRef.current;
      if (!btn || !container) return;
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setThumb({ left: bRect.left - cRect.left, width: bRect.width });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [idx]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex', // size to content, not stretch
        background: 'var(--slacksim-color-tab-container-bg)',
        borderRadius: 'var(--slacksim-radius-pill)',
        padding: '3px',
        gap: 0,
      }}
    >
      {/* Sliding filled pill — positioned from measured pixel values */}
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: thumb.left,
          width: thumb.width,
          height: 'calc(100% - 6px)',
          background: 'var(--slacksim-color-tab-active-bg)',
          borderRadius: 'var(--slacksim-radius-pill)',
          transition: 'left 0.18s ease, width 0.18s ease',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {TABS.map((tab, i) => (
        <button
          key={tab.id}
          ref={(el) => {
            btnRefs.current[i] = el;
          }}
          onClick={() => setActiveTab(tab.id)}
          className="ss-tab-btn"
          style={{
            position: 'relative',
            zIndex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            cursor: 'pointer',
            padding: '4px 18px',
            borderRadius: 'var(--slacksim-radius-pill)',
            fontSize: 'var(--slacksim-font-size-sm)',
            fontWeight:
              activeTab === tab.id
                ? 'var(--slacksim-font-weight-bold)'
                : 'var(--slacksim-font-weight-normal)',
            color:
              activeTab === tab.id
                ? 'var(--slacksim-color-tab-fg-active)'
                : 'var(--slacksim-color-tab-fg)',
            whiteSpace: 'nowrap',
            transition: 'color 0.15s ease',
            letterSpacing: '0.01em',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
