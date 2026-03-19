# n8n-nodes-maxbridge

Verified-ready n8n community node package for the MAX Bot API.

Published package name: `n8n-nodes-maxbridge`.
Main node names in n8n:
- `Max`
- `Max Trigger`
- `Max Tool` (the AI tool variant of `Max` for AI Agent workflows)

## What This Package Does

This package gives n8n a simple way to work with a MAX bot.

In plain language:
- `Max` sends requests to the MAX Bot API
- `Max Trigger` listens for incoming MAX webhook events
- `Max Tool` lets an n8n AI Agent call the same MAX actions as a tool

You can use it to:
- send messages to chats or users
- get, edit, and delete messages
- answer callback events
- upload files and turn them into MAX attachments
- call raw MAX API endpoints that do not have a dedicated UI yet
- receive incoming updates from MAX through a webhook

## Current Status

Current working release line: `0.1.5+`.

What is already implemented:
- `Max` action node with `Message`, `Upload`, and `Raw API`
- `Max Trigger` with webhook subscription lifecycle
- MAX credential support through n8n credentials
- Attachment upload flow
- Attachment retry handling for `attachment.not.ready`
- Normalized output fields such as `messageId`
- Local quality gates: `lint`, `typecheck`, `test`, `build`, `scan`

Important recent fixes:
- `0.1.3`: renamed the AI tool wrapper to `Max Tool` so it is clearly different from the normal `Max` node
- `0.1.4`: stopped exposing `Max Trigger` as an AI tool
- `0.1.5`: fixed the transport layer so all MAX requests bind the n8n execution context correctly; this removed the runtime error `this.getNode is not a function`

## How It Works

### 1. Credentials

Create `MAX API` credentials in n8n and fill in:
- `Access Token`: your bot token from MAX
- `Use Custom Base URL`: keep off unless you really need a non-default environment
- `Base URL`: advanced override, default is `https://platform-api.max.ru`

Security rules in this package:
- the token is sent only in the `Authorization` header
- the token is never sent in query parameters
- the trigger secret is stored on the `Max Trigger` node, not in shared credentials

### 2. Max

`Max` is the regular action node.

It supports three resources.

#### Message

Operations:
- `send`
- `get`
- `edit`
- `delete`
- `answerCallback`

Typical use:
- send a text message to a chat
- fetch a message by ID
- edit an existing message
- delete a message
- answer an interactive callback from MAX

Useful output fields:
- `messageId`
- `text`
- `chatId`
- `chatType`
- `senderId`

#### Upload

Operations:
- `getUploadUrl`
- `uploadBinary`
- `uploadAndReturnAttachment`

Typical use:
1. another n8n node produces binary data
2. `Max -> Upload -> uploadAndReturnAttachment` uploads the file
3. the node returns an `attachment` object
4. you pass that attachment into a later message call

#### Raw API

Use this when the MAX endpoint you need is not covered by the dedicated UI yet.

You can set:
- HTTP method
- path
- query JSON
- body JSON
- optional full response mode

### 3. Max Tool

`Max Tool` is not a separate codebase.
It is the AI-tool presentation of the `Max` node.

Use it only when:
- you are building an n8n AI Agent workflow
- the agent must call MAX as a tool

Do not use `Max Tool` for regular workflows.
For normal automation, use `Max`.

### 4. Max Trigger

`Max Trigger` is the incoming side.

What it does:
- registers a webhook subscription on activation
- removes the subscription on deactivation
- validates `X-Max-Bot-Api-Secret`
- optionally filters by `update_types`
- normalizes the incoming update payload

Supported update filters in the current UI:
- `bot_started`
- `message_callback`
- `message_created`

Important:
- `Max Trigger` is intentionally not exposed as an AI tool
- for testing, use `Test this trigger`
- do not use `Execute step` to simulate trigger behavior

## Installation

### Option 1. Install Through n8n Community Nodes UI

In self-hosted n8n:
1. Open `Settings -> Community Nodes`
2. Install package `n8n-nodes-maxbridge`
3. Restart n8n if your environment requires it

### Option 2. Install Manually in Self-Hosted n8n

```bash
npm install n8n-nodes-maxbridge
```

### Option 3. Install in Docker

If your n8n runs in Docker, install the package inside the node directory used by n8n and restart the containers.

Generic example:

```bash
docker exec -it <n8n-container> sh -lc "cd /home/node/.n8n/nodes && npm install n8n-nodes-maxbridge@latest"
docker restart <n8n-container>
```

If you run queue mode, restart both the main container and the worker.

### Beget Docker Example

If your setup looks like Beget's `/opt/beget/n8n` layout:

```bash
cd /opt/beget/n8n
docker compose exec -u node n8n sh -lc "mkdir -p /home/node/.n8n/nodes && cd /home/node/.n8n/nodes && npm install n8n-nodes-maxbridge@0.1.5"
docker compose exec -u node n8n-worker sh -lc "mkdir -p /home/node/.n8n/nodes && cd /home/node/.n8n/nodes && npm install n8n-nodes-maxbridge@0.1.5"
docker compose restart n8n n8n-worker
```

Then verify:

```bash
cd /opt/beget/n8n
docker compose exec -u node n8n sh -lc "cd /home/node/.n8n/nodes && npm ls n8n-nodes-maxbridge"
docker compose exec -u node n8n-worker sh -lc "cd /home/node/.n8n/nodes && npm ls n8n-nodes-maxbridge"
```

## Quick Start

### Send a Simple Message

1. Add `Max`
2. Set `Resource = Message`
3. Set `Operation = Send`
4. Set `Recipient Type = Chat` or `User`
5. Fill in the ID
6. Fill in the text
7. Run the node

### Send a File

1. Add a node that produces binary data
2. Add `Max`
3. Set `Resource = Upload`
4. Set `Operation = Upload and Return Attachment`
5. Fill in `Binary Property`
6. Use the returned `attachment` value in a later message step

### Receive Incoming Messages

1. Add `Max Trigger`
2. Set `Webhook Secret`
3. Optionally choose `Update Types`
4. Activate the workflow
5. Send an event to the bot in MAX
6. Branch on `{{$json.updateType}}` if needed

### Call a MAX Endpoint Not Yet Covered by UI

1. Add `Max`
2. Set `Resource = Raw API`
3. Fill in method, path, query, and body
4. Turn on `Return Full Response` if you need status or headers

## Typical Workflow Patterns

### Pattern 1. Trigger -> Filter -> Reply

Use:
- `Max Trigger`
- `IF` or `Switch`
- `Max`

Good when:
- you want to react to incoming user messages
- you want different behavior for different update types

### Pattern 2. Upload -> Send

Use:
- a file-producing node
- `Max -> Upload`
- `Max -> Message`

Good when:
- you need to send images, videos, audio, or files

### Pattern 3. AI Agent -> Max Tool

Use:
- AI Agent root node
- `Max Tool`

Good when:
- the AI agent must decide when to send or fetch MAX data

## Troubleshooting

### `this.getNode is not a function`

If you still see this error:
- update to `0.1.5` or later
- restart both `n8n` and `n8n-worker` if you use queue mode
- hard refresh the browser with `Ctrl+F5`
- recreate old broken nodes if they were created before the fix

Why this happened:
- older versions called n8n request helpers without binding the execution context correctly
- older partial execution paths could also mask the original error while trying to build `NodeApiError`

### Trigger Activates But Events Do Not Arrive

Check:
- the workflow is active
- the webhook URL is reachable from the internet
- the secret in MAX matches `Webhook Secret`
- you are testing with `Test this trigger`, not `Execute step`
- there are no duplicate MAX subscriptions pointing to old URLs

### `npm install` in Docker Prints `yallist_1.Yallist is not a constructor`

On some servers this npm error appears even when the package is already written to disk.

Do this after install:

```bash
npm ls n8n-nodes-maxbridge
```

If the right version is shown, restart n8n and verify behavior.
If the version is not shown, repeat the install or clean the npm state inside the container.

### Community Node Installed But UI Still Looks Old

Do this:
- restart n8n
- restart workers too if queue mode is enabled
- hard refresh the browser
- remove and recreate stale nodes in the workflow if necessary

## Development

Local commands:

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run scan
```

Published-package verification:

```bash
npm run scan:published
```

## Project Rules

This package follows these rules:
- TypeScript only
- zero runtime dependencies
- n8n HTTP helpers for API traffic
- centralized transport layer
- no token leakage in query parameters
- user-facing errors go through `NodeApiError` or `NodeOperationError`

## Important Files

Main source files:
- `credentials/MaxApi.credentials.ts`
- `nodes/Max/Max.node.ts`
- `nodes/Max/actions/message.ts`
- `nodes/Max/actions/rawApi.ts`
- `nodes/Max/actions/upload.ts`
- `nodes/Max/transport/maxApiRequest.ts`
- `nodes/Max/maxNodeContext.ts`
- `nodes/MaxTrigger/MaxTrigger.node.ts`
- `nodes/MaxTrigger/triggerHelpers.ts`

Main tests:
- `tests/unit/transport.test.cjs`
- `tests/unit/message-helpers.test.cjs`
- `tests/unit/message-retry.test.cjs`
- `tests/unit/action-execution.test.cjs`
- `tests/integration/maxTrigger.test.cjs`

## License

MIT.