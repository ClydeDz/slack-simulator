import React from "react";
import TabSwitcher from "./TabSwitcher";
import { controlApi } from "../../lib/api";

export default function ControlBar() {
  const handleReset = async () => {
    if (confirm("Reset workspace to seed data?")) {
      await controlApi.resetWorkspace();
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        height: "var(--slacksim-control-bar-height)",
        background: "var(--slacksim-color-control-bar-bg)",
        borderBottom: "1px solid var(--slacksim-color-bar-border)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px 0 16px",
        flexShrink: 0,
      }}
    >
      {/* Left */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "var(--slacksim-space-2)" }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--slacksim-color-sidebar-fg-active)", flexShrink: 0 }}><path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/></svg>
        <span style={{
          fontSize: "var(--slacksim-font-size-md)",
          fontWeight: "var(--slacksim-font-weight-bold)",
          color: "var(--slacksim-color-sidebar-fg-active)",
          letterSpacing: "0.01em",
        }}>
          Slack Simulator
        </span>
      </div>

      {/* Center */}
      <TabSwitcher />

      {/* Right */}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--slacksim-space-2)" }}>
        <a
          href="https://buymeacoffee.com/clydedsouza"
          target="_blank"
          rel="noreferrer"
          className="ss-toolbar-btn"
          style={{
            display: "flex", alignItems: "center", gap: "var(--slacksim-space-2)",
            border: "none",
            color: "var(--slacksim-color-sidebar-fg)",
            cursor: "pointer",
            borderRadius: "var(--slacksim-radius-sm)",
            padding: "6px 10px",
            fontSize: "var(--slacksim-font-size-sm)",
            textDecoration: "none",
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg>
          Buy me a coffee
        </a>
        <button
          onClick={handleReset}
          className="ss-toolbar-btn"
          style={{
            display: "flex", alignItems: "center", gap: "var(--slacksim-space-2)",
            border: "none",
            color: "var(--slacksim-color-sidebar-fg)",
            cursor: "pointer",
            borderRadius: "var(--slacksim-radius-sm)",
            padding: "6px 10px",
            fontSize: "var(--slacksim-font-size-sm)",
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/></svg>
          Reset workspace
        </button>
      </div>
    </div>
  );
}
