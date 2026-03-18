# n8n-nodes-maxbridge

Verified-ready n8n community node package for the MAX Bot API.

Published package name: `n8n-nodes-maxbridge`.
Node display names in n8n remain `Max` and `Max Trigger`.

## Status

This repository is in phased development.

Current implementation:
- `Max` action node with `Message`, `Upload`, and `Raw API` resources
- `Max Trigger` with webhook subscription lifecycle and secret validation
- Shared MAX credentials, transport, upload, and error helpers
- Automatic `attachment.not.ready` retry/backoff for message operations that send attachments
- Message send/get outputs expose `messageId` from the live MAX `body.mid` field for easier chaining in n8n

Remaining release work:
- Publish the package to npm so it can be installed in n8n as a community node
- Run the published package scanner after the first npm release

## Installation

```bash
npm install n8n-nodes-maxbridge
```

For local development in this repository:

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run scan
```

## Credentials Setup

Create `MAX API` credentials in n8n and provide:
- `Access Token`: bot token from the MAX bot panel
- `Use Custom Base URL`: leave disabled unless you are targeting a non-default environment
- `Base URL`: advanced override, default is `https://platform-api.max.ru`

Important constraints:
- MAX authentication uses only the `Authorization` header
- Tokens are never sent in query parameters
- Trigger webhook secrets are configured on the `Max Trigger` node, not in shared credentials

## Operations Matrix

### Max

| Resource | Operations |
|---|---|
| Message | `send`, `get`, `edit`, `delete`, `answerCallback` |
| Upload | `getUploadUrl`, `uploadBinary`, `uploadAndReturnAttachment` |
| Raw API | arbitrary method, path, query, JSON body, optional full response |

### Max Trigger

| Capability | Support |
|---|---|
| Register webhook on activate | Yes |
| Unregister webhook on deactivate | Yes |
| Validate `X-Max-Bot-Api-Secret` | Yes |
| Filter `update_types` on registration | Yes |
| Normalize incoming `Update` payload | Yes |

## Example Workflows

### Send Message
- Add `Max`
- Choose `Resource = Message`
- Choose `Operation = Send`
- Select `Recipient Type = Chat` or `User`
- Provide the recipient ID and message text
- Use `{{$json.messageId}}` from the node output when you want to chain `Get`, `Edit`, or `Delete`

### Send Message with File
- Add a node that produces binary data
- Add `Max`
- Choose `Resource = Upload`
- Choose `Operation = Upload and Return Attachment`
- Set `Binary Property`
- Use the returned `attachment` object in a later message step or Raw API call
- If MAX responds with `attachment.not.ready` during the later message send, use the message-level attachment retry fields in `Additional Fields`

### MAX Trigger -> Branch by Update Type
- Add `Max Trigger`
- Configure `Webhook Secret`
- Optionally narrow `Update Types`
- Use an `IF` node on `{{$json.updateType}}`

### Raw API Call
- Add `Max`
- Choose `Resource = Raw API`
- Set `HTTP Method`, `Path`, `Query`, and `Body`
- Enable `Return Full Response` when you need response metadata

## Verified-Ready Constraints

This package is designed around the n8n verified community node requirements:
- TypeScript only
- No runtime dependencies
- n8n HTTP helpers for API traffic
- MIT license
- GitHub Actions release workflow with npm provenance
- Community node package metadata and local verification script

Local verification:
- `npm run scan` validates repository metadata and packaging prerequisites in this workspace
- `npm run scan` also verifies the compiled `dist` artifacts and release workflow provenance command
- `npm run scan:published` is reserved for the official `@n8n/scan-community-package` check after the package exists on npm

## Development Notes

The official `npm create @n8n/node@latest` bootstrap was unstable in this environment, so the project foundation was assembled manually to match n8n starter conventions. Local quality checks currently pass with:

```bash
npm run lint
npm run build
npm run test
npm run scan
```

Live smoke test status:
- Validated `GET /me` against MAX with a real bot token
- Switched the live webhook subscription to the production webhook URL
- Verified live `send -> get -> edit -> delete` against a test chat

Known limits:
- Callback answers have not been smoke-tested live because no real `callback_id` test fixture is available in this workspace
