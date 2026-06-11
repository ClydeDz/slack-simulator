import type { FastifyInstance } from "fastify";
import {
  getAppByWebhookToken,
  insertMessage,
  generateId,
  generateTs,
  getChannel,
  getApps,
} from "../db";
import { broadcast } from "../realtime";
import { dispatchEvent } from "../dispatcher";

export async function registerHooks(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { token: string } }>(
    "/hooks/:token",
    async (req, reply) => {
      const { token } = req.params;
      const result = getAppByWebhookToken(token);

      if (!result) {
        return reply.status(404).send("no_team");
      }

      const { app: botApp, channelId } = result;

      const channel = getChannel(channelId);
      if (!channel) {
        return reply.status(400).send("channel_not_found");
      }

      const body = req.body as Record<string, unknown>;
      const text = typeof body.text === "string" ? body.text : "";
      const blocks = Array.isArray(body.blocks) ? body.blocks : undefined;

      if (!text && !blocks) {
        return reply.status(400).send("no_text_or_blocks");
      }

      const ts = generateTs();
      const message = insertMessage({
        id: generateId("M"),
        channelId,
        userId: botApp.botUserId,
        text,
        ts,
        blocks,
      });

      broadcast({ type: "message_new", message });

      const hookChannelType =
        channel.type === "im"
          ? "im"
          : channel.type === "private"
            ? "group"
            : "channel";
      const hookMsgPayload: Record<string, unknown> = {
        subtype: "bot_message",
        bot_id: botApp.id,
        username: botApp.botUserName,
        channel: channelId,
        text,
        ts,
        event_ts: ts,
        channel_type: hookChannelType,
        ...(blocks?.length ? { blocks } : {}),
      };

      // Dispatch message event to all subscribed apps
      await dispatchEvent("message", hookMsgPayload);

      // app_mention: fire if any bot is @mentioned in this webhook message
      const allApps = getApps();
      for (const a of allApps) {
        if (
          text.includes(`@${a.botUserName}`) ||
          text.includes(`<@${a.botUserId}>`)
        ) {
          dispatchEvent("app_mention", hookMsgPayload).catch(() => {});
          break;
        }
      }

      // Real Slack returns the plain string "ok"
      reply.header("Content-Type", "text/plain");
      return reply.send("ok");
    },
  );
}
