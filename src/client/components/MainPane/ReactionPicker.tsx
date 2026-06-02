import React from "react";
import { useStore } from "../../store";

interface Props {
  onSelect: (name: string) => void;
  onClose: () => void;
}

export default function ReactionPicker({ onSelect, onClose }: Props) {
  const emojiMap = useStore((state) => state.workspace?.emojiMap ?? {});
  const entries = Object.entries(emojiMap);

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        right: 0,
        background: "var(--slacksim-color-modal-bg)",
        border: "1px solid var(--slacksim-color-modal-border)",
        borderRadius: "var(--slacksim-radius-md)",
        boxShadow: "var(--slacksim-shadow-md)",
        padding: "var(--slacksim-space-2)",
        display: "grid",
        gridTemplateColumns: "repeat(6, 36px)",
        gap: "var(--slacksim-space-1)",
        width: "max-content",
        zIndex: 1000,
      }}
    >
      {entries.map(([name, char]) => (
        <button
          key={name}
          onClick={() => {
            onSelect(name);
            onClose();
          }}
          className="ss-emoji-btn"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            padding: "4px",
            borderRadius: "var(--slacksim-radius-sm)",
            lineHeight: 1,
            textAlign: "center",
            transition: "transform 0.1s ease",
          }}
          title={`:${name}:`}
        >
          {char}
        </button>
      ))}
    </div>
  );
}
