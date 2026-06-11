import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import path from "path";
import fs from "fs";
import { getDb } from "./db";
import { seedDatabase } from "./seed";
import { initRealtimeServer } from "./realtime";
import { initSocketModeServer } from "./socketModeServer";
import { registerSlackApi } from "./routes/slackApi";
import { registerControl } from "./routes/control";
import { registerHooks } from "./routes/hooks";
import { registerResponseUrlRoute } from "./slashCommands";

const PORT = 4500;
export const SIMULATOR_BASE_URL =
  process.env.SIMULATOR_BASE_URL ?? `http://localhost:${PORT}`;

async function main() {
  // Ensure .slack-simulator dir exists
  const dir = path.join(process.cwd(), ".slack-simulator");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Init DB
  const db = getDb();

  // Seed if workspace table is empty
  const ws = db.prepare("SELECT * FROM workspace LIMIT 1").get();
  if (!ws) await seedDatabase();

  const app = Fastify({ logger: { level: "info" } });

  await app.register(fastifyCors, { origin: true });

  // Parse bodies
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (req, body, done) => {
      const parsed = Object.fromEntries(new URLSearchParams(body as string));
      done(null, parsed);
    },
  );

  // Routes
  await registerSlackApi(app);
  await registerControl(app);
  await registerHooks(app);
  registerResponseUrlRoute(app);

  // Serve bot avatar images from ./config/avatars/ (always, dev + prod)
  const avatarsDir = path.join(process.cwd(), "config/avatars");
  if (fs.existsSync(avatarsDir)) {
    await app.register(fastifyStatic, {
      root: avatarsDir,
      prefix: "/config/avatars/",
      decorateReply: false,
    });
  }

  // Serve built client in production
  if (process.env.NODE_ENV === "production") {
    await app.register(fastifyStatic, {
      root: path.join(process.cwd(), "dist/client"),
      prefix: "/",
      decorateReply: false,
    });
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });

  // Print credentials from seeded apps
  const appsRaw: {
    apps: Array<{
      name: string;
      botToken: string;
      signingSecret: string;
      appToken: string;
    }>;
  } = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "config/apps.json"), "utf8"),
  );
  console.log("\n=== Slack Simulator credentials ===");
  console.log(`  SLACK_API_URL=http://localhost:${PORT}/api/`);
  appsRaw.apps.forEach((a) => {
    console.log(`\n  [${a.name}]`);
    console.log(`  SLACK_BOT_TOKEN=${a.botToken}`);
    console.log(`  SLACK_SIGNING_SECRET=${a.signingSecret}`);
    console.log(`  SLACK_APP_TOKEN=${a.appToken}`);
  });
  console.log(
    `\nCredentials also written to .slack-simulator/credentials.json\n`,
  );
  console.log("\n=== Slack Simulator credentials written ===");

  // Init realtime WS + Socket Mode WS (both share the same HTTP server)
  initSocketModeServer((app as any).server);
  initRealtimeServer((app as any).server);
}

main().catch(console.error);
