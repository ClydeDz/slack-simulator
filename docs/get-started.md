---
layout: base
title: Get Started
toc: true
---

# Get Started

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/clydedz/slack-simulator.git
cd slack-simulator
yarn install
```

Start the development server:

```bash
yarn dev
```

Open the simulator in your browser at http://localhost:5173.

---

## Initial Walkthrough

The simulator comes pre-seeded with a sample workspace, users, and channels so you can immediately start testing. When you first open the simulator, you'll see:

- **Channels**: Public and private channels where users can post messages and bots can respond
- **Direct Messages**: Private conversations between two or more users
- **Apps**: Private conversations between users and bots
- **Identity Switcher**: At the bottom-left of the screen, use this to switch between locally mocked users for testing multi-user scenarios. No email signup or external accounts are required.
- **Tabs**: At the top-center of the screen, navigation to switch between Workspace, API, Logs, and Database views
- **Theme Switcher**: At the top-right of the screen, use this to switch between Slack Light and Slack Dark themes
- **Reset workspace**: At the top-right of the screen, use this to reset the workspace to its initial state

---

## Customizing the Workspace

The `seed.json` config file in the `config/` folder contains the initial data that the workspace is seeded with. This can be customised to suit your needs.

> **Important**:
>
> 1. When making any changes to the `seed.json` file, you'll need to click on the **Reset workspace** button in the simulator for the changes to take effect.
> 2. `seed.schema.json` provides the schema validation for the `seed.json` file. You don't need to modify this file.

### The seed.json config file

This file defines your workspace structure:

- **workspace**: Name, domain, avatar, and supported emojis
- **users**: User accounts with names, emails, and avatars
- **channels**: Public and private channels
- **dms**: Direct message conversations
- **messages**: Pre-populated messages in channels and DMs

**Customization examples:**

Add more users:

```json
"users": [
  {
    "id": "U004",
    "username": "grace",
    "fullName": "Grace Hopper",
    "email": "grace@slacksim.test",
    "avatarSeed": "gracehopper",
    "avatarUrl": "/config/avatars/custom-avatar.png"
  }
]
```

Add more channels:

```json
"channels": [
  {
    "id": "C003",
    "name": "engineering",
    "type": "public",
    "topic": "Engineering team discussions"
  }
]
```

Add custom emojis:

```json
"supportedEmojis": [
  {
    "name": "rocket",
    "emoji": "🚀"
  }
]
```

Add custom avatars by placing PNG files in `config/avatars/` and referencing them in the `avatarUrl` field. You can set custom avatars for the workspace, users, and apps. The `seed.json` file already has example of different configurations.

---

## Configuring Your App

Now that the simulator is running, you'd want to connect your Slack App to it so you can develop seamlessly.

### The apps.json config file

This file defines the apps that can connect to the simulator. You can have a single app or multiple apps configured at the same time. The `apps.json` file comes with a few sample apps configured already. Below are the properties that can be configured for each app:

**Example configuration:**

```json
"apps": [
  {
    // Required: Unique app identifier
    "id": "A001",

    // Required: Unique bot user ID
    "botUserId": "B001",

    // Required: Bot username
    "botUserName": "my-bot",

    // Required: Display name for the app
    "name": "My Custom Bot",

    // Optional: Description of what the app does
    "description": "A bot that responds to greetings",

    // Required: Whether the app uses Socket Mode (true) or HTTP mode (false)
    "socketModeEnabled": true,

    // Required in http mode i.e. when socketModeEnabled is false
    // Your app's endpoint URL for receiving events
    "requestUrl": "http://localhost:4003/slack/events",

    // Required: Bot user token (starts with xoxb-)
    "botToken": "xoxb-slacksim-mybot",

    // Required in socket mode: App-level token for Socket Mode (starts with xapp-)
    "appToken": "xapp-slacksim-mybot",

    // Required in http mode: App signing secret for request verification
    "signingSecret": "slacksim-secret-mybot",

    // Optional: Events your app listens to
    "subscribedEvents": ["message", "app_mention"],

    // Optional: Custom slash commands your app handles
    "slashCommands": [
      {
        "command": "/help",
        "description": "Show help message",
        "usage": "[topic]"
      }
    ],

    // Optional: Channels where your app can post via webhooks (channel IDs from seed.json)
    "incomingWebhooks": ["C001"],

    // Optional: Custom avatar for the bot
    "avatarUrl": "/config/avatars/my-bot.png",

    // Optional: Domains to unfurl links from
    "unfurlDomains": ["giphy.com"]
  }
]
```

> **Important**:
>
> 1. When making any changes to the `apps.json` file, you'll need to click on the **Reset workspace** button in the simulator for the changes to take effect.
> 2. `apps.schema.json` provides the schema validation for apps.json if you want to reference it.

### Connecting Your App

1. Copy the tokens and secrets from your app's entry in `config/apps.json` as mentioned above.
2. Update your Bolt app configuration to uses those tokens and secrets. It may look something like this:

```javascript
import { App } from '@slack/bolt';

const app = new App({
  token: 'xoxb-slacksim-mybot', // From apps.json
  signingSecret: 'slacksim-secret-mybot', // From apps.json
  socketMode: true,
  appToken: 'xapp-slacksim-mybot', // From apps.json
  clientOptions: {
    slackApiUrl: 'http://localhost:4500/api/', // Critical: Point to simulator
  },
});

app.message('hello', async ({ message, say }) => {
  await say(`Hello, <@${message.user}>!`);
});

app.start();
```

3. Or if you're using the `@slack/web-api` directly, it may look something like this:

```javascript
import { WebClient } from '@slack/web-api';

const botToken = 'xoxb-slacksim-default'; // From apps.json

const slack = new WebClient(botToken, {
  slackApiUrl: 'http://localhost:4500/api/', // Critical: Point to simulator
});

const posted = await slack.chat.postMessage({
  channel: 'C001', // #general
  text: "Hey everyone! How's it going?",
});
```

> **Important**:
>
> 1. The `slackApiUrl` is critical - it tells your Bolt app to send requests to the simulator instead of real Slack.

Finally, start the simulator, then start your app. If you haven't already reset the workspace after updating the `apps.json` file, do so now. For the bolt app example above, if you send a "hello", your app should respond back. For the web API example above, the message should be posted to the #general channel.

---

## Sample Apps

The `apps.json` file comes with a few sample apps configured already. These apps correspond to the example apps in the [Slack Apps Showcase](https://github.com/) repository. Feel free to clone that repository and try it along with the simulator.
