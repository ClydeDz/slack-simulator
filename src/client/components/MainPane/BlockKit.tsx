import React from "react";
import type {
  Block,
  TextObject,
  ButtonElement,
  ImageElement,
  StaticSelectElement,
  SectionBlock,
  HeaderBlock,
  ContextBlock,
  ImageBlock,
  ActionsBlock,
  User,
  Channel,
  App,
} from "@shared/types";
import { useStore } from "../../store";
import { controlApi } from "../../lib/api";
import MentionChip from "./MentionChip";
import ChannelChip from "./ChannelChip";

// ── mrkdwn inline renderer ────────────────────────────────────────────────────

function renderMrkdwn(
  text: string,
  users: User[],
  apps: App[],
  channels: Channel[],
  onChannelClick: (id: string) => void,
): React.ReactNode[] {
  // Pre-process blockquotes: lines starting with "> " become a quoted block
  const lines = text.split("\n");
  const processedLines: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("> ") || line === ">") {
      // Collect consecutive blockquote lines
      const quoteLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i].startsWith("> ") || lines[i] === ">")
      ) {
        quoteLines.push(lines[i].startsWith("> ") ? lines[i].slice(2) : "");
        i++;
      }
      processedLines.push(
        <div
          key={`bq-${i}`}
          style={{
            borderLeft: "3px solid var(--slacksim-color-divider)",
            paddingLeft: "var(--slacksim-space-3)",
            color: "var(--slacksim-color-fg-muted)",
            margin: "2px 0",
          }}
        >
          {quoteLines.map((ql, qi) => (
            <div key={qi}>
              {renderMrkdwn(ql, users, apps, channels, onChannelClick)}
            </div>
          ))}
        </div>,
      );
    } else {
      if (processedLines.length > 0)
        processedLines.push(<br key={`nl-${i}`} />);
      processedLines.push(
        ...renderMrkdwnLine(lines[i], users, apps, channels, onChannelClick, i),
      );
      i++;
    }
  }
  return processedLines;
}

function renderMrkdwnLine(
  text: string,
  users: User[],
  apps: App[],
  channels: Channel[],
  onChannelClick: (id: string) => void,
  baseKey: number,
): React.ReactNode[] {
  const parts = text.split(
    /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`|<[^>]+>|:[a-z0-9_+\-]+:)/g,
  );
  return parts.map((part, i) => {
    const key = `${baseKey}-${i}`;
    if (/^\*[^*]+\*$/.test(part))
      return (
        <strong key={key}>
          {renderMrkdwnLine(
            part.slice(1, -1),
            users,
            apps,
            channels,
            onChannelClick,
            baseKey * 1000 + i,
          )}
        </strong>
      );
    if (/^_[^_]+_$/.test(part))
      return (
        <em key={key}>
          {renderMrkdwnLine(
            part.slice(1, -1),
            users,
            apps,
            channels,
            onChannelClick,
            baseKey * 1000 + i,
          )}
        </em>
      );
    if (/^~[^~]+~$/.test(part))
      return (
        <del key={key}>
          {renderMrkdwnLine(
            part.slice(1, -1),
            users,
            apps,
            channels,
            onChannelClick,
            baseKey * 1000 + i,
          )}
        </del>
      );
    if (/^`[^`]+`$/.test(part))
      return (
        <code
          key={key}
          style={{
            fontFamily: "var(--slacksim-font-mono)",
            fontSize: "0.875em",
            background: "var(--slacksim-color-bg-secondary)",
            border: "1px solid var(--slacksim-color-border)",
            borderRadius: "var(--slacksim-radius-sm)",
            padding: "0 3px",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    if (/^:[a-z0-9_+\-]+:$/.test(part)) {
      const name = part.slice(1, -1);
      const emojiMap = useStore.getState().workspace?.emojiMap ?? {};
      const char = emojiMap[name];
      if (char)
        return (
          <span key={key} title={part}>
            {char}
          </span>
        );
      return (
        <span
          key={key}
          style={{
            fontFamily: "var(--slacksim-font-mono)",
            fontSize: "0.85em",
            background: "var(--slacksim-color-bg-secondary)",
            border: "1px solid var(--slacksim-color-border)",
            borderRadius: "var(--slacksim-radius-sm)",
            padding: "1px 4px",
            color: "var(--slacksim-color-fg-muted)",
          }}
        >
          {part}
        </span>
      );
    }
    if (/^<[^>]+>$/.test(part)) {
      const inner = part.slice(1, -1);

      // Broadcast mentions: <!here>, <!channel>, <!everyone>
      if (inner === "!here" || inner === "!channel" || inner === "!everyone") {
        return (
          <span key={key} className="ss-mention">
            @{inner.slice(1)}
          </span>
        );
      }

      const pipeIdx = inner.indexOf("|");
      const ref = pipeIdx >= 0 ? inner.slice(0, pipeIdx) : inner;
      const explicitLabel = pipeIdx >= 0 ? inner.slice(pipeIdx + 1) : null;

      // User mention: <@U001> or <@U001|username>
      if (ref.startsWith("@")) {
        const uid = ref.slice(1);
        const user = users.find((u) => u.id === uid);
        const bot = !user ? apps.find((a) => a.botUserId === uid) : undefined;
        if (user) {
          return (
            <MentionChip
              key={key}
              label={`@${user.username}`}
              seed={user.avatarSeed}
              fullName={user.fullName}
              username={user.username}
              url={user.avatarUrl}
            />
          );
        }
        if (bot) {
          return (
            <MentionChip
              key={key}
              label={`@${bot.botUserName}`}
              seed={bot.botUserName}
              fullName={bot.name}
              username={bot.botUserName}
              url={bot.avatarUrl}
            />
          );
        }
        return (
          <span key={key} className="ss-mention">
            {explicitLabel ? `@${explicitLabel}` : `@${uid}`}
          </span>
        );
      }

      // Channel mention: <#C001> or <#C001|general>
      if (ref.startsWith("#")) {
        const cid = ref.slice(1);
        const channel = channels.find((c) => c.id === cid);
        const label = channel
          ? `#${channel.name}`
          : explicitLabel
            ? `#${explicitLabel}`
            : part;
        if (channel) {
          return (
            <ChannelChip
              key={key}
              label={label}
              channel={channel}
              users={users}
              onClick={() => onChannelClick(cid)}
            />
          );
        }
        return (
          <span key={key} className="ss-mention" style={{ cursor: "default" }}>
            {label}
          </span>
        );
      }

      // URL link: <https://...> or <https://...|label>
      if (ref.startsWith("http") || ref.startsWith("mailto")) {
        return (
          <a
            key={key}
            href={ref}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "var(--slacksim-color-accent)",
              textDecoration: "none",
            }}
          >
            {explicitLabel ?? ref}
          </a>
        );
      }
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

function TextEl({
  obj,
  users,
  apps,
  channels,
  onChannelClick,
}: {
  obj: TextObject;
  users: User[];
  apps: App[];
  channels: Channel[];
  onChannelClick: (id: string) => void;
}) {
  // Both mrkdwn and plain_text go through renderMrkdwn so <@U001> mentions resolve
  return <>{renderMrkdwn(obj.text, users, apps, channels, onChannelClick)}</>;
}

// ── Internal context (avoids prop-drilling users/apps/channels) ───────────────

interface BKCtx {
  users: User[];
  apps: App[];
  channels: Channel[];
  onChannelClick: (id: string) => void;
  channelId: string;
  messageTs: string;
  appId: string;
  viewId: string; // set when BlockKit is rendered inside a modal
}
const Ctx = React.createContext<BKCtx>({
  users: [],
  apps: [],
  channels: [],
  onChannelClick: () => {},
  channelId: "",
  messageTs: "",
  appId: "",
  viewId: "",
});

// ── Element renderers ─────────────────────────────────────────────────────────

function ImageEl({ el, size = 20 }: { el: ImageElement; size?: number }) {
  return (
    <img
      src={el.image_url}
      alt={el.alt_text}
      style={{
        width: size,
        height: size,
        objectFit: "cover",
        borderRadius: "var(--slacksim-radius-sm)",
        flexShrink: 0,
      }}
    />
  );
}

function Button({ el, blockId }: { el: ButtonElement; blockId?: string }) {
  const {
    users,
    apps,
    channels,
    onChannelClick,
    channelId,
    messageTs,
    appId,
    viewId,
  } = React.useContext(Ctx);
  const isPrimary = el.style === "primary";
  const isDanger = el.style === "danger";
  const isInteractive = !!appId && !!el.action_id;

  function handleClick() {
    if (!isInteractive) return;
    // block_id is optional — use undefined (not '') so the server check !blockId doesn't fire
    const resolvedBlockId = blockId ?? el.block_id ?? undefined;
    if (viewId) {
      controlApi
        .postModalBlockAction(
          viewId,
          resolvedBlockId ?? "",
          el.action_id!,
          el.value,
          appId,
        )
        .catch(() => {
          /* silent */
        });
    } else {
      controlApi
        .postBlockAction(
          channelId,
          messageTs,
          resolvedBlockId ?? "",
          el.action_id!,
          el.value,
          appId,
        )
        .catch(() => {
          /* silent */
        });
    }
  }

  return (
    <button
      onClick={isInteractive ? handleClick : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 12px",
        border: `1px solid ${isPrimary ? "var(--slacksim-color-primary)" : isDanger ? "var(--slacksim-color-sidebar-badge-bg)" : "var(--slacksim-color-border)"}`,
        borderRadius: "var(--slacksim-radius-sm)",
        background: isPrimary
          ? "var(--slacksim-color-primary)"
          : isDanger
            ? "var(--slacksim-color-sidebar-badge-bg)"
            : "transparent",
        color:
          isPrimary || isDanger
            ? "var(--slacksim-color-sidebar-fg-active)"
            : "var(--slacksim-color-fg)",
        fontSize: "var(--slacksim-font-size-sm)",
        fontFamily: "var(--slacksim-font-body)",
        fontWeight: "var(--slacksim-font-weight-bold)",
        cursor: isInteractive ? "pointer" : "default",
        whiteSpace: "nowrap",
      }}
    >
      <TextEl
        obj={el.text}
        users={users}
        apps={apps}
        channels={channels}
        onChannelClick={onChannelClick}
      />
    </button>
  );
}

// ── Block renderers ───────────────────────────────────────────────────────────

function Section({ block }: { block: SectionBlock }) {
  const { users, apps, channels, onChannelClick } = React.useContext(Ctx);
  const hasAccessory = !!block.accessory;
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--slacksim-space-4)",
        alignItems: "flex-start",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {block.text && (
          <div
            style={{
              fontSize: "var(--slacksim-font-size-md)",
              color: "var(--slacksim-color-fg)",
              lineHeight: 1.5,
              marginBottom: block.fields ? "var(--slacksim-space-2)" : 0,
            }}
          >
            <TextEl
              obj={block.text}
              users={users}
              apps={apps}
              channels={channels}
              onChannelClick={onChannelClick}
            />
          </div>
        )}
        {block.fields && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--slacksim-space-2)",
              marginTop: block.text ? "var(--slacksim-space-2)" : 0,
            }}
          >
            {block.fields.map((field, i) => (
              <div
                key={i}
                style={{
                  fontSize: "var(--slacksim-font-size-sm)",
                  color: "var(--slacksim-color-fg)",
                  lineHeight: 1.4,
                }}
              >
                <TextEl
                  obj={field}
                  users={users}
                  apps={apps}
                  channels={channels}
                  onChannelClick={onChannelClick}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {hasAccessory && block.accessory && (
        <div style={{ flexShrink: 0 }}>
          {block.accessory.type === "image" ? (
            <ImageEl el={block.accessory as ImageElement} size={72} />
          ) : block.accessory.type === "button" ? (
            <Button el={block.accessory as ButtonElement} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function Header({ block }: { block: HeaderBlock }) {
  const { users, apps, channels, onChannelClick } = React.useContext(Ctx);
  return (
    <div
      style={{
        fontSize: 18,
        fontWeight: "var(--slacksim-font-weight-bold)",
        color: "var(--slacksim-color-fg)",
        lineHeight: 1.3,
      }}
    >
      <TextEl
        obj={block.text}
        users={users}
        apps={apps}
        channels={channels}
        onChannelClick={onChannelClick}
      />
    </div>
  );
}

function Divider() {
  return (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid var(--slacksim-color-border)",
        margin: 0,
      }}
    />
  );
}

function Context({ block }: { block: ContextBlock }) {
  const { users, apps, channels, onChannelClick } = React.useContext(Ctx);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--slacksim-space-2)",
      }}
    >
      {block.elements.map((el, i) => {
        if (el.type === "image") {
          return <ImageEl key={i} el={el as ImageElement} size={18} />;
        }
        return (
          <span
            key={i}
            style={{
              fontSize: "var(--slacksim-font-size-sm)",
              color: "var(--slacksim-color-fg-muted)",
              lineHeight: 1.4,
            }}
          >
            <TextEl
              obj={el as TextObject}
              users={users}
              apps={apps}
              channels={channels}
              onChannelClick={onChannelClick}
            />
          </span>
        );
      })}
    </div>
  );
}

function ImageBlockEl({ block }: { block: ImageBlock }) {
  const { users, apps, channels, onChannelClick } = React.useContext(Ctx);
  return (
    <div>
      {block.title && (
        <div
          style={{
            fontSize: "var(--slacksim-font-size-sm)",
            fontWeight: "var(--slacksim-font-weight-bold)",
            color: "var(--slacksim-color-fg)",
            marginBottom: "var(--slacksim-space-1)",
          }}
        >
          <TextEl
            obj={block.title}
            users={users}
            apps={apps}
            channels={channels}
            onChannelClick={onChannelClick}
          />
        </div>
      )}
      <img
        src={block.image_url}
        alt={block.alt_text}
        style={{
          maxWidth: "100%",
          maxHeight: 360,
          objectFit: "contain",
          borderRadius: "var(--slacksim-radius-md)",
          display: "block",
        }}
      />
      <div
        style={{
          fontSize: "var(--slacksim-font-size-sm)",
          color: "var(--slacksim-color-fg-muted)",
          marginTop: "var(--slacksim-space-1)",
        }}
      >
        {block.alt_text}
      </div>
    </div>
  );
}

function StaticSelect({
  el,
  blockId,
}: {
  el: StaticSelectElement;
  blockId?: string;
}) {
  const { channelId, messageTs, appId, viewId } = React.useContext(Ctx);
  const isInteractive = !!appId && !!el.action_id;

  const initialValue = el.initial_option?.value ?? "";
  const [selected, setSelected] = React.useState(initialValue);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelected(val);
    if (!isInteractive) return;
    const opt = el.options.find((o) => o.value === val);
    if (!opt) return;
    const resolvedBlockId = blockId ?? "";
    const selectedOption = {
      text: { type: opt.text.type, text: opt.text.text },
      value: opt.value,
    };
    if (viewId) {
      controlApi
        .postModalBlockAction(
          viewId,
          resolvedBlockId,
          el.action_id!,
          val,
          appId,
          selectedOption,
        )
        .catch(() => {
          /* silent */
        });
    } else {
      controlApi
        .postBlockAction(
          channelId,
          messageTs,
          resolvedBlockId,
          el.action_id!,
          val,
          appId,
          selectedOption,
        )
        .catch(() => {
          /* silent */
        });
    }
  }

  return (
    <select
      value={selected}
      onChange={handleChange}
      style={{
        padding: "5px 10px",
        border: "1px solid var(--slacksim-color-border)",
        borderRadius: "var(--slacksim-radius-sm)",
        background: "var(--slacksim-color-bg)",
        color: selected
          ? "var(--slacksim-color-fg)"
          : "var(--slacksim-color-fg-placeholder)",
        fontSize: "var(--slacksim-font-size-sm)",
        fontFamily: "var(--slacksim-font-body)",
        cursor: isInteractive ? "pointer" : "default",
        outline: "none",
        minWidth: 120,
      }}
    >
      {!selected && el.placeholder && (
        <option value="" disabled>
          {el.placeholder.text}
        </option>
      )}
      {el.options.map((opt, i) => (
        <option key={i} value={opt.value}>
          {opt.text.text}
        </option>
      ))}
    </select>
  );
}

function Actions({ block }: { block: ActionsBlock }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--slacksim-space-2)",
      }}
    >
      {block.elements.map((el, i) => {
        if (el.type === "static_select") {
          return (
            <StaticSelect
              key={i}
              el={el as StaticSelectElement}
              blockId={block.block_id}
            />
          );
        }
        return (
          <Button key={i} el={el as ButtonElement} blockId={block.block_id} />
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface BlockKitProps {
  blocks: Block[];
  channelId?: string;
  messageTs?: string;
  appId?: string;
  viewId?: string;
}

export default function BlockKit({
  blocks,
  channelId = "",
  messageTs = "",
  appId = "",
  viewId = "",
}: BlockKitProps) {
  const { users, apps, channels, setActiveChannel } = useStore((s) => ({
    users: s.users,
    apps: s.apps,
    channels: s.channels,
    setActiveChannel: s.setActiveChannel,
  }));
  return (
    <Ctx.Provider
      value={{
        users,
        apps,
        channels,
        onChannelClick: setActiveChannel,
        channelId,
        messageTs,
        appId,
        viewId,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--slacksim-space-2)",
        }}
      >
        {blocks.map((block, i) => {
          switch (block.type) {
            case "section":
              return <Section key={i} block={block} />;
            case "header":
              return <Header key={i} block={block} />;
            case "divider":
              return <Divider key={i} />;
            case "context":
              return <Context key={i} block={block} />;
            case "image":
              return <ImageBlockEl key={i} block={block} />;
            case "actions":
              return <Actions key={i} block={block} />;
            default:
              return null;
          }
        })}
      </div>
    </Ctx.Provider>
  );
}
