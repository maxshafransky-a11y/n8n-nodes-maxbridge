# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - Unreleased

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
