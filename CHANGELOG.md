# Changelog

All notable changes to this project will be documented in this file.

## [0.1.5] - Unreleased

- Fixed MAX transport helpers to bind the n8n execution context correctly when calling `httpRequestWithAuthentication`
- Stopped action-node error handling from masking the original runtime error when `getNode()` is unavailable in n8n partial execution contexts

## [0.1.4] - Unreleased

- Disabled AI tool exposure for `Max Trigger` so n8n activates and publishes it through the normal trigger lifecycle

## [0.1.3] - 2026-03-19

- Renamed the AI tool wrapper generated from `Max` to `Max Tool` so it is visually distinct from the regular action node in n8n

## [0.1.2] - 2026-03-19

- Fixed Max Trigger error handling so missing getNode() in n8n trigger contexts no longer crashes manual testing with the message this.getNode is not a function

## [0.1.1] - 2026-03-18

- Replaced the attachment retry delay helper with n8n-workflow sleep so the published package passes n8n community scan security checks

## [0.1.0] - 2026-03-18

- Foundation scaffold created for `n8n-nodes-maxbridge`
- Project plan, package metadata, CI workflow stubs, and node skeletons added
- MAX credentials, transport helpers, upload helpers, and API error parsing implemented
- Message, Upload, Raw API, and Trigger execution flows implemented for the initial project scope
- Automatic `attachment.not.ready` retry/backoff added for message operations with attachments
- Message responses now expose a top-level `messageId` alias based on the live MAX `body.mid` field
- Local package verification script added for unpublished workspace checks
- Release workflow extended with published package scanning after npm publish
- Package renamed to `n8n-nodes-maxbridge` for npm availability
- Real GitHub repository metadata configured for release packaging