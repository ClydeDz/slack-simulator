import React, { useState, useRef } from "react";
import ReactDOM from "react-dom";
import Avatar from "../Avatar";

export interface MentionChipProps {
  label: string;
  seed: string;
  fullName: string;
  username: string;
  url?: string;
  onClick?: () => void;
}

export default function MentionChip({ label, seed, fullName, username, url, onClick }: MentionChipProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  function handleMouseEnter() {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.top - 8, left: r.left + r.width / 2 });
  }

  return (
    <>
      <span
        ref={ref}
        className="ss-mention"
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setPos(null)}
        style={{ cursor: onClick ? "pointer" : "default" }}
      >
        {label}
      </span>
      {pos && ReactDOM.createPortal(
        <div
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            transform: "translate(-50%, -100%)",
            zIndex: 2000,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "var(--slacksim-color-modal-bg)",
              border: "1px solid var(--slacksim-color-modal-border)",
              borderRadius: "var(--slacksim-radius-md)",
              boxShadow: "var(--slacksim-shadow-md)",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: "var(--slacksim-space-3)",
              minWidth: 180,
            }}
          >
            <Avatar seed={seed} size={36} alt={fullName} url={url} />
            <div>
              <div
                style={{
                  fontWeight: "var(--slacksim-font-weight-bold)",
                  fontSize: "var(--slacksim-font-size-md)",
                  color: "var(--slacksim-color-fg)",
                  whiteSpace: "nowrap",
                }}
              >
                {fullName}
              </div>
              <div
                style={{
                  fontSize: "var(--slacksim-font-size-sm)",
                  color: "var(--slacksim-color-fg-muted)",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                }}
              >
                @{username}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
