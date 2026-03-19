# Context Project

## Purpose

This file records the current technical context of `n8n-nodes-maxbridge`.
It explains what the project contains now, what was changed recently, what was added, and why the latest fixes were necessary.

It is meant for:
- future maintenance
- debugging regressions
- onboarding into the repository
- reusing the same approach for future n8n community nodes

## Current State

Project name:
- `n8n-nodes-maxbridge`

Current working release line:
- `0.1.5+`

Current outcome:
- published npm package
- working self-hosted n8n community node package
- two main node types: `Max` and `Max Trigger`
- one AI tool presentation: `Max Tool`
- zero runtime dependencies
- TypeScript-only implementation
- shared transport, upload, and error layers
- automated local verification through lint, typecheck, test, build, and scan

## What Exists In The Project

### Node types

- `Max`
  - regular action node for MAX API operations
- `Max Trigger`
  - incoming webhook trigger for MAX updates
- `Max Tool`
  - AI-tool presentation of `Max` for n8n AI Agent workflows

### Resources and operations

`Max -> Message`
- `send`
- `get`
- `edit`
- `delete`
- `answerCallback`

`Max -> Upload`
- `getUploadUrl`
- `uploadBinary`
- `uploadAndReturnAttachment`

`Max -> Raw API`
- arbitrary HTTP method, path, query JSON, body JSON, optional full response

`Max Trigger`
- webhook registration on activation
- webhook removal on deactivation
- secret validation through `X-Max-Bot-Api-Secret`
- optional filtering by update type
- normalized output payload

## Important Architecture Decisions

### 1. Zero runtime dependencies

The runtime package stays minimal.
All logic is built with TypeScript and n8n/native APIs.

### 2. Shared transport first

All MAX HTTP traffic goes through a centralized helper.
This keeps auth, base URL, query normalization, and request behavior in one place.

Main file:
- [maxApiRequest.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/transport/maxApiRequest.ts)

### 3. Shared upload and error layers

Uploads and error normalization are not duplicated across operations.

Main files:
- [maxUpload.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/uploads/maxUpload.ts)
- [maxApiError.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/errors/maxApiError.ts)

### 4. Trigger is not an AI tool

`Max Trigger` is a real n8n trigger.
It must be activated and published through the normal trigger lifecycle.
It is intentionally not exposed as an AI tool.

Main file:
- [MaxTrigger.node.ts](/M:/боты/codex/Учебный%20проект/nodes/MaxTrigger/MaxTrigger.node.ts)

### 5. Action node can also be used as an AI tool

The `Max` action node exposes an AI-tool variant named `Max Tool`.
This keeps the normal action node and the AI-tool presentation separate in the UI.

Main file:
- [Max.node.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/Max.node.ts)

## What Was Added Recently

### Added

- `Max Tool` naming and AI-tool presentation for the action node
- fallback node context helper for action-node error handling
- regression tests for execution-context binding and missing `getNode()` paths
- troubleshooting knowledge for self-hosted Docker installs

New shared helper file:
- [maxNodeContext.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/maxNodeContext.ts)

### Changed

- action-node transport now binds n8n execution context correctly when calling `httpRequestWithAuthentication`
- action-node error wrapping no longer masks the original error if `getNode()` is unavailable
- trigger metadata no longer exposes `Max Trigger` as an AI tool
- README and context documentation now reflect the real runtime behavior and deployment steps

### Fixed

- `this.getNode is not a function` during action-node execution
- `this.getNode is not a function` during trigger activation/publish paths
- confusion between the normal `Max` node and its AI-tool variant

## Recent Version History

### `0.1.2`

Fix introduced:
- trigger-side fallback handling for contexts where `getNode()` was missing

Result:
- manual trigger-related crashes were reduced
- but the deeper action-node runtime issue still existed

### `0.1.3`

Fix introduced:
- AI-tool presentation renamed from generic `Max` to `Max Tool`

Reason:
- users could accidentally pick the AI-tool version instead of the regular action node

### `0.1.4`

Fix introduced:
- `Max Trigger` stopped exposing itself as an AI tool

Reason:
- trigger nodes should be activated through the normal trigger lifecycle, not treated as AI tools

### `0.1.5`

Fix introduced:
- transport helper now calls `httpRequestWithAuthentication` with `.call(context, ...)`
- action-node fallback error wrapping now uses a safe node fallback

Reason:
- all nodes were failing with the same runtime error because the n8n request helper requires the execution context to be bound correctly
- on top of that, older action-node catch blocks could replace the original error with another `getNode()` failure

Main fixed files:
- [maxApiRequest.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/transport/maxApiRequest.ts)
- [message.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/actions/message.ts)
- [rawApi.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/actions/rawApi.ts)
- [upload.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/actions/upload.ts)
- [Max.node.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/Max.node.ts)
- [maxNodeContext.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/maxNodeContext.ts)

## Why The `this.getNode is not a function` Error Happened

There were two layers.

### Layer 1. Trigger/tool metadata issues

Earlier versions allowed paths where trigger behavior and AI-tool behavior could overlap in the UI/runtime.
That created activation and publish problems for `Max Trigger`.

### Layer 2. Transport helper binding bug

This was the main root cause across all nodes.

The MAX transport helper was calling:
- `context.helpers.httpRequestWithAuthentication(...)`

But n8n expects:
- `context.helpers.httpRequestWithAuthentication.call(context, ...)`

Without the proper bind, the internal helper loses the n8n execution context.
That leads to helper-internal failures such as:
- `this.getNode is not a function`

This was the key bug that made action nodes and trigger-related requests fail in the same way.

## Tests That Now Protect This

Main test files:
- [transport.test.cjs](/M:/боты/codex/Учебный%20проект/tests/unit/transport.test.cjs)
- [action-execution.test.cjs](/M:/боты/codex/Учебный%20проект/tests/unit/action-execution.test.cjs)
- [maxTrigger.test.cjs](/M:/боты/codex/Учебный%20проект/tests/integration/maxTrigger.test.cjs)

What they now cover:
- request helper is called with the correct bound context
- action nodes preserve the original runtime error even if `getNode()` is unavailable
- trigger node is not exposed as an AI tool
- trigger error handling still works when `getNode()` is missing

## Deployment Notes

### Self-hosted Docker

If n8n runs in Docker:
- install the package inside the n8n node directory
- restart the main service
- restart workers too if queue mode is enabled

### Beget-specific note

In Beget's ready-made n8n deployment:
- the compose files live in `/opt/beget/n8n`
- queue mode usually means both `n8n` and `n8n-worker` must be updated and restarted

### npm install quirk

On some containers `npm install` may print:
- `yallist_1.Yallist is not a constructor`

That does not always mean the package failed to land on disk.
The correct follow-up check is:
- `npm ls n8n-nodes-maxbridge`

If the version is present, restart n8n and verify behavior.

## Current Quality Gate

Standard local verification commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run scan
```

Published-package verification when needed:

```bash
npm run scan:published
```

Current local state at the time of this context update:
- `lint` passes
- `typecheck` passes
- `test` passes

## Important Files

### Credentials
- [MaxApi.credentials.ts](/M:/боты/codex/Учебный%20проект/credentials/MaxApi.credentials.ts)

### Max action node
- [Max.node.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/Max.node.ts)
- [message.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/actions/message.ts)
- [rawApi.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/actions/rawApi.ts)
- [upload.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/actions/upload.ts)
- [messageHelpers.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/actions/messageHelpers.ts)
- [maxApiRequest.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/transport/maxApiRequest.ts)
- [maxApiError.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/errors/maxApiError.ts)
- [maxUpload.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/uploads/maxUpload.ts)
- [maxNodeContext.ts](/M:/боты/codex/Учебный%20проект/nodes/Max/maxNodeContext.ts)

### Trigger node
- [MaxTrigger.node.ts](/M:/боты/codex/Учебный%20проект/nodes/MaxTrigger/MaxTrigger.node.ts)
- [triggerHelpers.ts](/M:/боты/codex/Учебный%20проект/nodes/MaxTrigger/triggerHelpers.ts)

### Tests
- [transport.test.cjs](/M:/боты/codex/Учебный%20проект/tests/unit/transport.test.cjs)
- [message-helpers.test.cjs](/M:/боты/codex/Учебный%20проект/tests/unit/message-helpers.test.cjs)
- [message-retry.test.cjs](/M:/боты/codex/Учебный%20проект/tests/unit/message-retry.test.cjs)
- [action-execution.test.cjs](/M:/боты/codex/Учебный%20проект/tests/unit/action-execution.test.cjs)
- [maxTrigger.test.cjs](/M:/боты/codex/Учебный%20проект/tests/integration/maxTrigger.test.cjs)

## Reuse Guidance For Future n8n Nodes

If another n8n node package is built from this repository pattern, keep this order:
1. define constraints first
2. build credentials, transport, uploads, and errors before UI-heavy features
3. test helpers early
4. separate action, trigger, transport, upload, and error logic from the start
5. verify behavior locally before publishing
6. test the published package in real n8n, not only in local mocks
7. when a helper depends on n8n execution context, bind it explicitly

## Summary

The project is no longer just a scaffold.
It is a published and working MAX integration package for self-hosted n8n.

The most important technical lesson from the latest debugging cycle is this:
- for n8n request helpers, execution context binding matters just as much as the request options themselves