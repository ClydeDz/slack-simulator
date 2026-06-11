import React, { useState } from "react";
import { useStore } from "../../store";
import { controlApi } from "../../lib/api";

interface Props {
  onClose: () => void;
}

export default function CreateChannelModal({ onClose }: Props) {
  const { users, setActiveChannel } = useStore();
  const [name, setName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    users.map((u) => u.id),
  );
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    setName(raw);
  }

  function toggleMember(userId: string) {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Channel name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const channel = await controlApi.createChannel(
        name.trim(),
        selectedMembers,
        isPrivate,
      );
      setActiveChannel(channel.id);
      onClose();
    } catch (err) {
      setError("Failed to create channel. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--slacksim-color-modal-overlay)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--slacksim-color-modal-bg)",
          borderRadius: "var(--slacksim-radius-lg)",
          boxShadow: "var(--slacksim-shadow-lg)",
          width: 480,
          maxWidth: "90vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--slacksim-space-5)",
            borderBottom: "1px solid var(--slacksim-color-border)",
          }}
        >
          <h2
            style={{
              fontSize: "var(--slacksim-font-size-xl)",
              fontWeight: "var(--slacksim-font-weight-bold)",
              color: "var(--slacksim-color-fg)",
            }}
          >
            Create a channel
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "var(--slacksim-font-size-xl)",
              color: "var(--slacksim-color-fg-muted)",
              lineHeight: 1,
              padding: "var(--slacksim-space-1)",
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal body */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--slacksim-space-5)",
          }}
        >
          {/* Channel name */}
          <div style={{ marginBottom: "var(--slacksim-space-5)" }}>
            <label
              style={{
                display: "block",
                marginBottom: "var(--slacksim-space-2)",
                fontWeight: "var(--slacksim-font-weight-bold)",
                fontSize: "var(--slacksim-font-size-md)",
                color: "var(--slacksim-color-fg)",
              }}
            >
              Channel name
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid var(--slacksim-color-composer-border)",
                borderRadius: "var(--slacksim-radius-sm)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  width: 40,
                  padding: "8px 0",
                  color: "var(--slacksim-color-fg-muted)",
                  fontSize: "var(--slacksim-font-size-md)",
                  borderRight: "1px solid var(--slacksim-color-border)",
                  background: "var(--slacksim-color-bg-secondary)",
                }}
              >
                {isPrivate ? (
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
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                ) : (
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
                  >
                    <line x1="4" x2="20" y1="9" y2="9" />
                    <line x1="4" x2="20" y1="15" y2="15" />
                    <line x1="10" x2="8" y1="3" y2="21" />
                    <line x1="16" x2="14" y1="3" y2="21" />
                  </svg>
                )}
              </span>
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. announcements"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  padding: "8px 12px",
                  fontFamily: "var(--slacksim-font-body)",
                  fontSize: "var(--slacksim-font-size-md)",
                  color: "var(--slacksim-color-fg)",
                  background: "transparent",
                }}
              />
            </div>
            <div
              style={{
                marginTop: "var(--slacksim-space-1)",
                fontSize: "var(--slacksim-font-size-sm)",
                color: "var(--slacksim-color-fg-muted)",
              }}
            >
              Lowercase letters, numbers, and hyphens only.
            </div>
          </div>

          {/* Members */}
          <div style={{ marginBottom: "var(--slacksim-space-5)" }}>
            <label
              style={{
                display: "block",
                marginBottom: "var(--slacksim-space-2)",
                fontWeight: "var(--slacksim-font-weight-bold)",
                fontSize: "var(--slacksim-font-size-md)",
                color: "var(--slacksim-color-fg)",
              }}
            >
              Members
            </label>
            <div
              style={{
                border: "1px solid var(--slacksim-color-border)",
                borderRadius: "var(--slacksim-radius-sm)",
                overflow: "hidden",
              }}
            >
              {users.map((user, i) => (
                <label
                  key={user.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--slacksim-space-3)",
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderTop:
                      i > 0 ? "1px solid var(--slacksim-color-border)" : "none",
                    background: selectedMembers.includes(user.id)
                      ? "var(--slacksim-color-bg-secondary)"
                      : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(user.id)}
                    onChange={() => toggleMember(user.id)}
                    style={{ cursor: "pointer" }}
                  />
                  <span
                    style={{
                      fontSize: "var(--slacksim-font-size-md)",
                      color: "var(--slacksim-color-fg)",
                    }}
                  >
                    {user.fullName}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--slacksim-font-size-sm)",
                      color: "var(--slacksim-color-fg-muted)",
                    }}
                  >
                    @{user.username}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Private toggle */}
          <div style={{ marginBottom: "var(--slacksim-space-5)" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--slacksim-space-3)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <div>
                <div
                  style={{
                    fontWeight: "var(--slacksim-font-weight-bold)",
                    fontSize: "var(--slacksim-font-size-md)",
                    color: "var(--slacksim-color-fg)",
                  }}
                >
                  Make private
                </div>
                <div
                  style={{
                    fontSize: "var(--slacksim-font-size-sm)",
                    color: "var(--slacksim-color-fg-muted)",
                  }}
                >
                  Only invited members can view this channel
                </div>
              </div>
            </label>
          </div>

          {error && (
            <div
              style={{
                padding: "var(--slacksim-space-3)",
                marginBottom: "var(--slacksim-space-4)",
                background: "var(--slacksim-color-mention-bg)",
                border: "1px solid var(--slacksim-color-mention-border)",
                borderRadius: "var(--slacksim-radius-sm)",
                fontSize: "var(--slacksim-font-size-sm)",
                color: "var(--slacksim-color-fg)",
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--slacksim-space-3)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid var(--slacksim-color-border)",
                borderRadius: "var(--slacksim-radius-sm)",
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: "var(--slacksim-font-size-md)",
                color: "var(--slacksim-color-fg)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="ss-btn-primary"
              style={{
                background: name.trim()
                  ? "var(--slacksim-color-primary)"
                  : "var(--slacksim-color-primary-disabled)",
                color: name.trim() ? "#fff" : "#888",
                border: "none",
                borderRadius: "var(--slacksim-radius-sm)",
                padding: "8px 16px",
                cursor: name.trim() ? "pointer" : "default",
                fontSize: "var(--slacksim-font-size-md)",
                fontWeight: "var(--slacksim-font-weight-bold)",
                fontFamily: "var(--slacksim-font-body)",
                transition: "background 0.1s ease",
              }}
            >
              {isSubmitting ? "Creating…" : "Create Channel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
