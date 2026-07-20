# Chat and Mail E2EE Implementation Roadmap

## Purpose

This document defines a phase-based implementation plan for introducing end-to-end encryption for EduVerse Chat and Mail.

The goal is to keep encryption concerns bounded and incremental:

- Encrypted content is limited to Chat and Mail.
- Decryption happens only in UI components that actively render protected content.
- Notifications stay generic and never require decrypted message bodies or mail content.
- Messaging metadata remains usable without decryption.
- Authentication sessions, trusted encryption devices, encryption/decryption, messaging, notifications, sockets, attachments, and UI rendering stay separated.

This is the implementation roadmap and progress tracker. Phase 0 and Phase 1 can be delivered without enabling E2EE, changing schema, or adding migrations.

## Progress Tracker Notes

- Checked boxes mean implemented, designed, or verified for the current delivery slice.
- Unchecked boxes mean one of three things: future product work, manual QA that cannot be honestly completed without real browser/device testing, or automated test coverage still to be written.
- Phase sections can contain future follow-up work even when the core implementation for that phase is complete.

## Readiness Classification

Current readiness: **major architectural refactor required**.

Reason:

- Chat and Mail currently store protected content as plaintext.
- The backend currently uses message content for notification previews, push bodies, reply previews, mail subjects, mail search, socket payloads, and rendered responses.
- Current device tracking is session-oriented. It is not a trusted cryptographic-device model.
- Attachments currently pass through the backend in plaintext and are stored through Cloudinary with plaintext metadata.

## Core Boundaries

### Authentication Session

Authentication sessions prove that a user is signed in.

Current system:

- `Session` stores `deviceId`, device metadata, token, active state, and expiration.
- JWT is stored in an HTTP-only auth cookie and also used in frontend API calls after session restoration.
- Logout and session revocation invalidate auth sessions.

Future boundary:

- Auth sessions must not own encryption identity.
- Logging out must not automatically delete a trusted encryption device.
- Revoking a session must not necessarily revoke an encryption device.
- A signed-in session can request encryption-device actions, but those actions require their own trust rules.
- Password hashing, reset-token hashing, JWT/session validation, webhook HMAC verification, and file checksums remain authentication/backend-integrity concerns, not E2EE concerns.

### Trusted Encryption Device

A trusted encryption device is a browser/device that owns local private key material and can decrypt content for that user.

Future boundary:

- Stored separately from `Session`.
- Has public keys registered with the backend.
- Has revocation state independent from auth sessions.
- Can be approved, revoked, renamed, and inspected.
- May survive logout.
- Must be removable through explicit "remove trusted device" behavior.

### Device Approval and History Access

New trusted-device approval is a separate trust flow from login.

Future boundary:

- The first trusted device can be bootstrapped after strong authentication when the user has no existing trusted encryption devices.
- Every later device starts as pending and cannot decrypt protected history until approved by an already trusted device for the same user.
- The just-logged-in pending device cannot approve itself.
- Approval requests should appear in-app only on already trusted devices, with generic in-app and push notifications for UX.
- Approval notifications should be hidden from the pending device where device/session targeting allows it; backend approval enforcement must still reject self-approval even if a notification leaks through.
- Approval transfers only wrapped history keys or device trust material, never plaintext content or private keys.
- A user's newly approved device may recover that same user's encrypted history through history-key wrappers.
- Newly added chat/group members do not receive previous conversation history. They only receive keys for messages created after their membership becomes active.

### Chat History Keys

Chat history keys prevent new-device registration from requiring thousands of per-message device envelopes to be rewritten.

Future boundary:

- Use scoped history keys, not a broad global recovery key.
- The initial scope should be per user per chat, with key epochs when membership/access rules change.
- New messages can still include direct per-device envelopes for currently trusted devices.
- Each encrypted chat message should also include a history-key-wrapped content key for each eligible participant/scope so future approved devices can lazily decrypt history.
- When a new device is approved, an already trusted device wraps the relevant history keys to the new device. It does not transfer or rewrite every message key.
- The client unwraps message keys only for messages currently fetched/rendered, including additional pages loaded through "load earlier".
- Do not eagerly decrypt or unwrap all historical message keys in the background.

### User Cryptographic Identity

The user cryptographic identity represents the long-lived user-level public identity used to reason about device trust and key continuity.

Future boundary:

- Separate from role, auth password, and active login session.
- Should support key rotation and recovery policy.
- Must protect against server-side public-key replacement attacks through verification UX or device approval.

### Encryption and Decryption

Encryption and decryption must stay in a narrow frontend boundary.

Allowed:

- Encryption utilities used by send flows.
- Decryption hooks/components used only by protected Chat/Mail render surfaces.
- Device-key management UI and setup flows.

Not allowed:

- Global stores automatically decrypting messages.
- Notification code decrypting content.
- Search, analytics, audit, sockets, or routing depending on decrypted bodies.
- Backend receiving private keys or decrypted message bodies after E2EE is enabled.

### Crypto Dependency Strategy

Prefer proven, lightweight crypto libraries where they reduce implementation risk without bloating the app.

Guidelines:

- Use `libsodium-wrappers` as the preferred Phase 4 crypto dependency unless a build/bundle smoke test shows unacceptable cost.
- Prefer the standard `libsodium-wrappers` package, not `libsodium-wrappers-sumo`, unless Phase 4 proves a required primitive is missing.
- Use libsodium's XChaCha20-Poly1305 AEAD for Chat/Mail content encryption.
- Use libsodium device key pairs for sender/recipient device key agreement and authenticated per-device content-key wrapping.
- Continue using browser storage APIs and the existing `idb-keyval` dependency for local private-key persistence where appropriate.
- Evaluate bundle size, maintenance health, browser compatibility, and API clarity before adding a dependency.
- Avoid large protocol frameworks unless they clearly replace substantial product-owned complexity.
- Do not use a library for trivial glue code, metadata shaping, recipient resolution, or UI state.
- Keep the selected crypto wrapper behind the Phase 4 client crypto boundary so Chat, Mail, notifications, sockets, stores, and Copilot do not depend directly on library APIs.
- Treat dependency choice as replaceable: app code should depend on local crypto utilities, not directly on third-party package calls.
- Load libsodium lazily from the E2EE utility boundary, not in app/layout shells or broad stores.
- Do not replace existing server-side password hashing with libsodium just for dependency consolidation. `bcrypt` and Node `crypto` still serve non-E2EE auth/integrity needs, so using libsodium only for passwords would add migration risk without removing the current crypto surface.

### Messaging Services

Chat and Mail services remain responsible for:

- Permission checks.
- Recipient resolution.
- Membership and participant state.
- DM blocks.
- Mail status and routing.
- Unread counts.
- Timestamps.
- Read state.
- Delivery events.
- Storing ciphertext and key envelopes.

Messaging services should not need decrypted content.

### Notifications

Notifications must become generic for protected content.

Allowed examples:

- `New direct message`
- `New message in Algebra Section`
- `You were mentioned in a chat`
- `New reply in a mail thread`
- `Mail status updated`

Not allowed:

- Message body previews.
- Mail subject previews when subject is encrypted.
- Decrypting content to compose notification text.

### Sockets

Sockets transport delivery events and encrypted payloads.

Allowed:

- `chat:message` with ciphertext metadata.
- `mail:message` with ciphertext metadata.
- unread and read state events.
- participant/member update events.

Not allowed:

- Server-side decrypted content in socket payloads.
- Socket handlers requiring decrypted content to update delivery/read state.

### Attachments

Attachments are private Cloudinary files served only through authenticated backend endpoints. Chat and Mail message text remains E2EE.

### UI Rendering

Only render components decrypt.

Initial render boundaries:

- Chat message row/content renderer.
- Mail thread message renderer.
- Protected subject renderer once Mail subject encryption is introduced.

Other UI should use metadata:

- chat names
- participant names
- timestamps
- unread counts
- delivery/read state
- generic latest-message text
- generic notification text

### AI Copilot

AI Copilot currently retrieves Mail content for context. Under E2EE, that retrieval path must become an explicit protected-content handoff.

Allowed:

- Decrypt Mail content only from an active trusted device/session where the user is viewing or intentionally invoking Copilot for that Mail thread.
- Pass only the user-approved decrypted Mail body, subject, or selected excerpts to Copilot.
- Keep recipient resolution, permissions, unread counts, timestamps, routing, sockets, and notification generation independent from Copilot decryption.
- Treat Copilot context as a user-authorized plaintext export to the AI subsystem and document that behavior clearly.

Not allowed:

- Backend Mail services decrypting content for Copilot.
- Copilot workers fetching ciphertext and trying to decrypt it outside the narrow Mail rendering/Copilot handoff boundary.
- Notifications, sockets, stores, or global app shells decrypting Mail content just because Copilot may need it later.
- Sending decrypted content to Copilot automatically from list views, notifications, unread counters, or background refreshes.

## Protected vs Non-Protected Data

### Protected Content

These fields should eventually become encrypted or replaced by encrypted payloads:

- `ChatMessage.content`
- `MailMessage.content`
- `Mail.subject`
- attachment filenames when attachment E2EE is introduced
- attachment preview metadata when attachment E2EE is introduced

### Metadata That Remains Server-Readable

These should remain independent from decryption:

- user IDs
- chat IDs
- mail IDs
- sender IDs
- participant IDs
- timestamps
- message IDs
- reply-to message IDs
- read markers
- delivery state
- unread counters
- group membership
- DM block state
- mail category, priority, status, and routing where product policy allows
- mention target metadata, if sent explicitly as metadata

### Metadata To Review Carefully

These may leak sensitive information and need product decisions:

- group chat names
- mail subject
- file name
- file MIME type
- file size
- mention labels
- notification titles
- action URLs

## Phase 0 - Product and Security Decisions

Status: **implemented - initial policy decisions recorded**

### Goals

Define what E2EE means for EduVerse before implementation starts.

### Tasks

- [x] Decide whether E2EE is required for:
  - DMs
  - group chats
  - Mail messages
  - Mail subjects
  - attachments
- [x] Decide whether admins can ever access protected content.
- [x] Decide what happens for abuse reporting and school safety review.
- [x] Decide whether users can recover old messages on a new device.
- [x] Decide whether encryption is mandatory or opt-in during rollout.
- [x] Decide historical plaintext support policy.
- [x] Decide what metadata remains visible to the backend.
- [x] Define generic notification copy for Chat and Mail.
- [x] Define "unavailable encrypted content" UX for untrusted/new devices.

### Initial Decisions

- Delivery order is Chat E2EE first with DMs, message lifecycle, and groups implemented through one folded chat phase; Mail body third, Mail subject fourth, and attachments last.
- E2EE is designed as mandatory for protected content once each surface is enabled.
- Old plaintext Chat/Mail content is not supported after E2EE cutover. Do not build mixed-history rendering, reply, search, migration, or compatibility flows unless a separate product decision reopens that scope.
- Admins do not get plaintext access by default under true E2EE. Any abuse-reporting or school-safety review flow must be explicitly designed instead of relying on silent admin access.
- Backend-readable metadata remains limited to IDs, participants, membership, timestamps, read/delivery state, unread counts, DM block state, mail routing/status metadata, and explicit mention target metadata.
- Notifications must use generic copy and must not include message body, mail body, or encrypted mail subject text.
- Exact protected content is decrypted only in active Chat/Mail render surfaces.
- New chat/group members do not receive encrypted history from before they joined.
- A user's new device can receive that user's own history access only after approval from an already trusted device.
- Historical message keys are not eagerly unwrapped. The client only unwraps/decrypts the messages included in the current fetch window or an explicit "load earlier" page.
- Abuse/safety review requires an explicit user-submitted decrypted excerpt from an active trusted device; there is no silent admin plaintext access.
- Unavailable encrypted content uses protected-content render states such as "Message unavailable on this device" and "Encrypted message unavailable on this device." Phase 13 keeps clearer recovery guidance as UX polish.

### Dependencies

- Product/security approval.
- Agreement on recovery and admin-visibility expectations.

### Migration Considerations

- None yet.

### Testing Requirements

- Product acceptance checklist for behavior changes.
- Threat-model review checklist.

### Expected Outcome

A signed-off E2EE policy that prevents later implementation ambiguity.

## Phase 1 - Boundary Refactor Without Encryption

Status: **implemented**

### Goals

Prepare Chat and Mail so content-dependent behavior is isolated before ciphertext is introduced.

### Tasks

- [x] Replace message notification previews with generic text.
- [x] Replace mail notification subject previews with generic text or metadata-only text.
- [x] Replace chat latest-message previews with a helper that can return generic text.
- [x] Replace mail list subject dependency with a display abstraction that can later render encrypted subject state.
- [x] Ensure sockets do not require plaintext for UI refresh.
- [x] Ensure unread counts are timestamp/read-state based only.
- [x] Make reply preview rendering component-local.
- [x] Make edit UI read content only from active render state.
- [x] Ensure `ChatLayout` and Mail UI do not push decrypted content into broad/global stores.
- [x] Define `ProtectedContentDisplay` style boundaries for Chat and Mail renderers.

### Implemented Boundary Changes

- Chat push and mention notification bodies now use generic text from `chat-notification.utils.ts`.
- Mail notification bodies now use generic text from `mail-notification.utils.ts`.
- Chat latest-message preview now goes through a shared protected-content display helper instead of reading message body content in the chat list.
- Mail list and mail details headers now use a subject display helper so encrypted subject state can be represented without spreading decryption logic.
- Chat reply previews render through protected message components, and edit/copy actions use decrypted active-render state only when available on the device.
- Socket event names, room joins, unread updates, timestamps, delivery/read state flows, and user-status utilities were left unchanged.

### Dependencies

- Phase 0 notification and metadata decisions.

### Migration Considerations

- Current plaintext can continue to work during pre-E2EE boundary refactors, but no long-term legacy plaintext compatibility is part of the E2EE implementation.
- No DB migration required in this phase.

### Testing Requirements

- Chat notifications contain no message body.
- Mail notifications contain no subject/body if subject is considered protected.
- Chat list still works without body preview.
- Mail list still works with generic protected-subject placeholder.
- Current reply and edit flows still work before encrypted send paths are enabled.

### Expected Outcome

The app can tolerate missing plaintext content in most non-rendering surfaces.

## Phase 2 - Foundational Data Model

Status: **implemented**

### Goals

Add storage primitives for trusted devices and encrypted message payloads without enabling E2EE behavior.

### Tasks

- [x] Add user encryption identity model.
- [x] Add trusted encryption device model.
- [x] Add device public key fields.
- [x] Add device revocation fields.
- [x] Add key version fields.
- [x] Add encrypted message payload side table for Chat.
- [x] Add encrypted message payload side table for Mail and Mail subject using a shared envelope shape.
- [x] Add per-recipient-device wrapped key storage.
- [x] Add encryption version fields.
- [x] Add algorithm metadata fields.
- [x] Add nonce/IV storage.
- [x] Add optional associated-data metadata.
- [x] Add encrypted payload side table for the E2EE cutover.

### Implemented Data Model

- `UserEncryptionIdentity` stores user-level cryptographic identity and key-version metadata.
- `TrustedEncryptionDevice` stores trusted device public keys, device metadata, key version, and revocation metadata independently from auth sessions.
- `TrustedEncryptionDevice` now tracks explicit trust state: pending, trusted, or revoked. Later-device registration no longer implies trust.
- `E2EEDeviceApprovalRequest` records pending new-device approval requests and the already trusted device that approved them.
- `EncryptedContent` stores ciphertext, algorithm, nonce, optional auth tag, associated data, encryption version, and content-key version.
- `EncryptedContent` links to exactly one protected source: Chat message, Mail message, Mail subject, or File attachment.
- `E2EEKeyEnvelope` stores one wrapped content key per recipient trusted device, with optional nonce and associated data for authenticated key-wrap algorithms.
- `ChatHistoryKey`, `E2EEHistoryKeyDeviceEnvelope`, and `E2EEContentHistoryKeyEnvelope` define the history-key wrapper foundation for same-user new-device history access without rewriting every message envelope.
- The migration adds a Postgres check constraint so encrypted content source fields match `contentType`.

### Dependencies

- Phase 0 schema policy.
- Phase 1 content-boundary refactor.

### Migration Considerations

- No long-term legacy plaintext read path is required.
- Use `encryptionVersion` or equivalent to validate encrypted payload versions, not to support mixed plaintext/encrypted history.
- Avoid destructive migrations.

### Testing Requirements

- Prisma migration validation.
- API responses remain compatible enough for rollout phases before E2EE is enabled, but do not add permanent legacy plaintext compatibility.
- Existing Chat and Mail tests still pass.
- No encrypted behavior enabled yet.

### Expected Outcome

The database can store encryption metadata and key envelopes for the encrypted cutover.

## Phase 3 - Trusted Device Registration

Status: **implemented**

### Goals

Introduce cryptographic devices independent from login sessions.

### Tasks

- [x] Add backend endpoints for:
  - creating current device encryption registration
  - listing trusted devices
  - revoking a trusted device
  - renaming a trusted device
  - fetching recipient device public keys
- [x] Add frontend device setup flow.
- [x] Generate per-device key pairs in the browser.
- [x] Use libsodium device key pairs through the local E2EE crypto boundary.
- [x] Store private key material locally using IndexedDB via `idb-keyval`.
- [x] Store public keys on the backend.
- [x] Add explicit device trust state.
- [x] Add pending-device approval state.
- [x] Add backend approval enforcement so a pending device cannot approve itself.
- [x] Keep existing `device_id` as a convenience identifier only, not a cryptographic proof.
- [x] Ensure logout does not delete trusted-device keys.
- [x] Ensure "remove trusted device" deletes/revokes encryption-device state.

### Implemented Device Registration

- Added `/e2ee/devices/current`, `/e2ee/devices/me`, `/e2ee/devices/:deviceId`, and `/e2ee/recipient-devices`.
- Added `/e2ee/devices/:deviceId/approve` for approving pending devices from an already trusted device.
- Added a Security settings panel for trusting, listing, renaming, and revoking encryption devices.
- The Security settings panel now separates trusted devices from pending devices and disables self-approval on the pending device.
- Added a lazy-loaded `libsodium-wrappers` registration helper that generates identity/device key pairs and stores private keys in IndexedDB.
- The backend only receives public keys, fingerprints, algorithm labels, device metadata, and trust/revocation metadata.
- Recipient-device lookup now returns only approved trusted devices, not pending or revoked devices.

### Dependencies

- Phase 2 data model.

### Migration Considerations

- Existing users have no trusted devices at first.
- The first trusted device may be bootstrapped after strong authentication because there is no already trusted device to approve it.
- Later devices must remain pending until approved from an existing trusted device.
- E2EE features must be disabled or show setup UX until a trusted device exists.

### Testing Requirements

- Device registration persists after logout/login.
- Revoking auth session does not revoke encryption device.
- Revoking encryption device does not necessarily revoke auth session unless product chooses to.
- Private keys never leave browser.
- Public keys can be fetched for recipients.

### Expected Outcome

Users can establish trusted encryption devices without changing message sending yet.

## Phase 4 - Client Crypto Utilities

Status: **implemented**

### Goals

Build a narrow frontend crypto boundary used by send/render surfaces only.

### Tasks

- [x] Evaluate lightweight crypto dependencies before implementation:
  - preferred package: `libsodium-wrappers`
  - avoid `libsodium-wrappers-sumo` unless the standard package lacks a required primitive
  - lazy-load libsodium only from the protected E2EE utility boundary
  - reject packages that materially bloat the frontend or force broad app integration
- [x] Add libsodium-backed helpers for:
  - XChaCha20-Poly1305 content encryption
  - XChaCha20-Poly1305 content decryption
  - random nonce generation
  - per-message symmetric key generation
  - authenticated wrapping of message keys for recipient device public keys
  - unwrapping message keys with current device private key
- [x] Add serialization helpers for ciphertext payloads.
- [ ] Add strict nonce generation tests.
- [x] Hide any chosen third-party crypto package behind local utilities.
- [x] Add error types for:
  - no trusted device
  - no key envelope for current device
  - revoked device
  - corrupt ciphertext
  - unsupported encryption version
- [x] Keep utilities framework-agnostic and small.
- [x] Do not import crypto utilities into notification, socket, routing, or global app shells.
- [x] Do not import third-party crypto libraries outside the crypto utility boundary.

### Implemented Crypto Boundary

- `sodium.ts` lazy-loads `libsodium-wrappers` and owns base64/fingerprint/canonical associated-data helpers.
- `contentCrypto.ts` encrypts/decrypts string payloads with XChaCha20-Poly1305 combined mode.
- `keyEnvelopeCrypto.ts` wraps/unwraps content keys with authenticated per-device `crypto_box_easy` envelopes.
- `localDeviceKeys.ts` owns local trusted-device private-key storage helpers.
- `chatHistoryKeys.ts` owns Chat-specific history-key helpers for generating chat history keys, wrapping history keys to approved devices, and wrapping message content keys to chat history keys.
- `errors.ts` defines E2EE-specific error codes without leaking crypto-library errors across the app.
- `index.ts` exposes the supported E2EE boundary for future Chat/Mail send and render flows.

### Dependencies

- Phase 3 trusted-device storage.
- Lightweight dependency evaluation with bundle-size and browser-support notes.

### Migration Considerations

- No existing messages encrypted yet.

### Testing Requirements

- Unit test encrypt/decrypt round trip.
- Unit test wrong key fails.
- Unit test nonce uniqueness assumptions.
- Unit test key envelope unwrap.
- Browser compatibility smoke test.
- Bundle-size check if a new crypto dependency is added.
- Verify `libsodium-wrappers` loads lazily and does not enter the default app bundle.

### Expected Outcome

The frontend can encrypt/decrypt locally through a narrow API.

## Phase 5 - Encrypted Chat Messages, Lifecycle, and Groups

Status: **in progress - encrypted Chat send/edit/render, history-key epochs, and approval transfer implemented**

### Goals

Enable E2EE for Chat as one coherent implementation surface: DMs, message edit/delete lifecycle, replies, load-earlier history, and group chats.

This phase is folded because the encrypted message envelope, edit semantics, and group membership visibility rules depend on each other. Implementation should still be incremental inside the phase.

### Internal Delivery Order

1. Chat E2EE schema/API adjustments for pending devices, device approval, and history-key wrappers.
2. Encrypted DM send/read with generic previews and notifications.
3. Encrypted DM edit/delete/reply semantics.
4. Encrypted group send/read using the same envelope and lifecycle model.
5. Load-earlier history decryption and unavailable-content UX polish.

### Tasks

- Add pending trusted-device state and approval records if the existing Phase 3 device model is not enough.
- Add in-app trusted-device approval flow:
  - create approval request when a logged-in device registers after the first trusted device exists
  - notify already trusted devices with generic in-app and push notification text
  - hide approval notification from the pending device where possible
  - reject approval from the same pending device on the backend
  - require approver device to be an active trusted device for the same user
- Add scoped chat history-key storage if the Phase 2 per-device envelope model is not enough:
  - prefer per-user/per-chat history keys with epochs
  - avoid a broad global recovery key
  - store wrapped history keys for trusted devices
  - store history-key-wrapped content keys for messages
  - keep direct per-device envelopes for newly sent messages where useful for fast current-device delivery
- Resolve active participants before send.
- Resolve the two users in a DM.
- Resolve active group participants before group send.
- Fetch active trusted devices for eligible participants.
- Encrypt message content locally before API send.
- Use `crypto_aead_xchacha20poly1305_ietf` for message content.
- Wrap the message key for each active trusted recipient device, including sender devices where needed.
- Also wrap the message key to each eligible participant's scoped chat history key so future approved devices can decrypt history lazily.
- Use authenticated key wrapping with sender and recipient trusted-device keys; store the envelope nonce with each key envelope.
- Send ciphertext, encryption metadata, direct device envelopes, and history-key envelope metadata to the backend.
- Backend validates:
  - sender is participant
  - DM block state
  - group read-only state
  - message envelope shape
  - recipient users match eligible DM/group participants
  - key envelope target devices belong to eligible participants
  - history-key envelope targets belong to eligible participants and the correct chat epoch
  - pending/revoked devices do not receive new envelopes
- Backend stores ciphertext and envelopes without reading content.
- Socket emits encrypted payload only.
- Chat renderer decrypts only visible message content.
- Chat list displays generic latest-message text for encrypted content.
- Push and in-app notification bodies stay generic.
- Reply preview decrypts only inside active message rendering.
- Edit creates a new encrypted payload version or replacement payload using the original message visibility scope; it must not expand access to users who could not see the original message.
- Keep `deletedAt` and deleted-state metadata server-readable for delete state.
- Ensure edit permission remains sender-only.
- Re-encrypt edited content locally.
- Preserve the XChaCha20-Poly1305 content algorithm and authenticated key-envelope strategy.
- Replace or version key envelopes as needed for edited encrypted content.
- Ensure copy action uses decrypted render content only.
- Ensure removed/inactive group participants are not included for future messages.
- Do not share prior group/chat history with newly added members.
- Added group members receive keys only for messages created after their active membership epoch.
- Removed users may retain already-issued keys for content they previously received, but must not receive future keys.
- Keep mentions as metadata targets, not extracted from plaintext by backend.
- Keep mention notifications generic.
- Keep group membership, roles, and read-only mode independent from message content and decryption.
- For "load earlier", fetch only the requested page of encrypted messages and unwrap/decrypt only those visible/fetched messages.
- Do not eagerly unwrap every historical message key when a chat opens or when a new device is approved.

### Implemented Chat E2EE Foundation

- Backend `SendMessageDto` and `EditMessageDto` accept a shared encrypted Chat content payload.
- Backend validates encrypted message envelopes against active DM/group participants.
- Backend rejects envelopes for pending, revoked, or stale-key devices.
- Backend stores Chat ciphertext in `EncryptedContent` and direct per-device wrapped keys in `E2EEKeyEnvelope`.
- Backend send and edit use the same encrypted payload validation/storage path.
- Backend now requires encrypted content for user-authored Chat sends/edits.
- Backend edit validation preserves the original encrypted message recipient scope so edits cannot expand access to newly added members.
- Backend returns encrypted content and current-user key envelopes in message fetch responses.
- Backend emits `chat:message` and `chat:message:edit` through existing user rooms without changing socket event names.
- Backend exposes Chat E2EE context for active participants and current-user history-key device envelopes.
- Backend accepts registration of shared Chat history-key epochs wrapped to active participants' trusted devices.
- Backend exposes a pending-device approval context so an already trusted device can transfer the current user's existing Chat history-key access without fetching or rewriting messages.
- Backend validates approval-time history-key transfers against the approving trusted device and stores one wrapped history-key device envelope per transferred epoch for the newly approved device.
- Backend retires the current Chat history-key epoch when group membership changes, forcing future messages to use a fresh epoch for the new active roster.
- Frontend `chatMessageCrypto.ts` prepares encrypted Chat payloads for send and edit through the local E2EE utility boundary.
- Frontend creates or reuses a shared Chat history-key epoch and stores a history-key-wrapped content key with each encrypted message.
- Frontend can fall back from a direct device envelope to a history-key envelope when rendering an encrypted message.
- Frontend `deviceApprovalKeys.ts` transfers existing Chat history keys during trusted-device approval by unwrapping with the approving local device and rewrapping for the pending device.
- Frontend `ProtectedChatMessageContent` decrypts only inside active message rendering.
- Frontend copy/edit actions use active render-state decrypted text and refuse unavailable encrypted messages.
- Chat list/latest-message display continues using generic protected-content preview helpers.
- Pending device registration creates a generic approval notification with pending-device metadata, and the frontend notification store hides that approval prompt on the newly logged-in pending browser where client-device metadata is available.

### Remaining Chat E2EE Work

- Add explicit unavailable-content UX polish for approved devices missing history-key envelopes.
- Add device-targeted push subscription metadata if push notifications also need to be suppressed on the pending browser instead of only hidden in-app/client-side.
- Add focused tests for encrypted send, edit, fetch, socket delivery, and unavailable-device render states.

### Dependencies

- Phases 1-4.
- Product decision that new members do not receive past group history.
- Device approval UX and backend enforcement.
- History-key wrapper data model adjustment before encrypted Chat send is enabled.

### Migration Considerations

- No legacy plaintext DM or group rendering is required after cutover.
- Use `encryptionVersion` in API responses to validate encrypted payload compatibility.
- Phase 2's per-device envelope table may need a focused migration instead of over-generalizing `E2EEKeyEnvelope`.
- Prefer explicit models such as chat history keys, history-key device envelopes, and content-key history envelopes over stuffing every target type into one ambiguous table.
- Avoid rewriting existing message rows repeatedly for new-device approval. Approving a device should wrap scoped history keys, not thousands of message keys.
- No member-history reshare migration should be added.

### Testing Requirements

- First device can bootstrap trust when no trusted devices exist.
- Later device remains pending until approved from an already trusted device.
- Pending device cannot approve itself.
- Approval notification is delivered to existing trusted devices and not shown to the pending device where supported.
- Approved new device receives wrapped history keys, not thousands of rewritten message envelopes.
- Sender can read sent encrypted DM.
- Recipient can read encrypted DM.
- Sender can edit encrypted DM.
- Sender can delete encrypted DM.
- Reply to encrypted message works.
- Deleted encrypted message shows generic deleted state.
- No decrypted content appears in edit or send socket payloads.
- Untrusted/new unapproved device sees "message unavailable on this device" UX.
- Backend cannot produce message preview.
- DM block still prevents send.
- Read/unread counters still work.
- Socket delivery works with ciphertext only.
- Send encrypted message to group.
- Removed member cannot decrypt future messages.
- Added member can decrypt future messages only.
- Added member cannot decrypt group history from before they joined.
- "Load earlier" decrypts only the fetched page.
- Mention notifications work without plaintext preview.
- Role/related-scope mention targets notify deduped users without body text.
- Read-only mode still blocks non-admin sends.

### Expected Outcome

Chat E2EE works across DMs, edits/deletes, replies, and groups with one consistent envelope model, explicit device approval, lazy history access for the same user's approved devices, and no group-history sharing to newly added members.

## Phase 8/9 - Mail Body and Subject Encryption

Status: **in progress - encrypted Mail compose/reply/render foundation implemented**

### Goals

Introduce E2EE for Mail message bodies and subjects after Chat proves the envelope model.

### Tasks

- [x] Resolve Mail participants before persistence:
  - creator
  - assignee
  - assignees
  - target role recipients where applicable
  - platform/admin recipients where policy allows
- [x] Encrypt `MailMessage.content` locally.
- [x] Encrypt Mail subjects locally for user-composed Mail.
- [x] Use `crypto_aead_xchacha20poly1305_ietf` for Mail subject/body content.
- [x] Store encrypted Mail subject/body and direct trusted-device key envelopes.
- [x] Keep Mail status, category, priority, timestamps, and read state server-readable.
- [x] Replace reply notifications with generic text.
- [x] Render decrypted Mail messages only inside `MailThread`.
- [x] Add protected subject rendering in Mail list and details.
- [x] Remove protected subject/body from backend notifications by storing generic placeholders for encrypted Mail.
- [x] Ensure backend Copilot communication context does not fetch or receive protected Mail body content; encrypted subjects appear only as generic placeholders.
- [ ] Add a Mail-to-Copilot handoff that decrypts on the trusted client only when the user intentionally invokes Copilot for the active thread.
- [ ] Send Copilot only the minimum decrypted Mail body/excerpts needed for the requested action, with thread/message IDs kept as metadata.

### Implemented Mail E2EE Foundation

- Added Mail encrypted-content DTOs for subject/body payloads and trusted-device key envelopes.
- Added compose and thread E2EE context endpoints:
  - `POST /mail/e2ee-context`
  - `GET /mail/:id/e2ee-context`
- Backend validates Mail key envelopes against the resolved Mail access set and rejects pending, revoked, stale, or non-participant target devices.
- User-composed Mail stores generic plaintext placeholders plus `EncryptedContent` rows for subject and initial body.
- Mail replies store generic plaintext placeholders plus encrypted body content.
- Backend reads include current-user key envelopes for `subjectEncryptedContent` and `MailMessage.encryptedContent`.
- Frontend `mailMessageCrypto.ts` reuses the existing libsodium content/key-envelope primitives without depending on Chat history-key utilities.
- `NewMailModal` encrypts subject/body locally before creation.
- `MailDetailsModal` encrypts replies locally before sending.
- `ProtectedMailText` and `ProtectedMailMessage` decrypt only in Mail list/detail/thread render surfaces.
- Existing backend-generated operational Mail can still be created without browser-side ciphertext so admin/org workflows are not broken.

### Dependencies

- Phase 5 stable direct device envelope model.
- Product decision on role-targeted Mail recipient stability.

### Migration Considerations

- User-composed Mail is encrypted at creation/reply time.
- Existing backend-generated operational Mail remains plaintext until a server-side product alternative is designed, because the backend cannot perform user-device E2EE without browser private keys.
- Role-targeted Mail encrypts to the current resolved role users at send/reply time; future role members may see thread metadata by policy but will not receive old subject/body keys.
- Mail currently uses direct per-device envelopes, not Mail thread history keys. A future Mail-thread key can be added if approved new devices must read old Mail without per-content rewrapping.

### Testing Requirements

- [x] Create encrypted Mail thread.
- [x] Reply encrypted.
- [x] Assignees can decrypt when they have trusted devices.
- Non-participants cannot fetch/decrypt.
- [x] Mail unread counts still work.
- [x] Socket events carry encrypted payload and generic placeholders only.
- Copilot can use decrypted Mail body only through explicit active-thread handoff.
- [x] Copilot cannot retrieve or decrypt Mail body content from the backend independently.

### Expected Outcome

Mail subject/body privacy is supported with known search, new-device-history, backend-generated-mail, and explicit Copilot-handoff limitations.

## Phase 10 - File Privacy Boundary

Files use private Cloudinary storage plus authenticated backend download endpoints. Chat and Mail text encryption remains separate from file storage.

### Testing Requirements

- [ ] Upload Chat attachment.
- [ ] Upload Mail compose attachment.
- [ ] Upload Mail reply attachment.
- [ ] Download files through authenticated `/files/:id/download` endpoints.

### Expected Outcome

Attachments are protected with the same trusted-device envelope model as Chat/Mail content while keeping storage, sockets, notifications, and unread state metadata-only.

## Phase 11 - Search, Reporting, Recovery, and Copilot Context

### Goals

Rebuild or explicitly limit features that previously depended on backend-readable content.

### Tasks

- [x] Decide current search model:
  - no backend encrypted content search
  - backend may search metadata such as category, status, priority, sender, assignee, timestamps, and routing
  - client-side local search over actively decrypted visible content can be added later
  - encrypted local index remains a later feature, not part of this phase
- [x] Constrain backend Mail search so encrypted subjects are not searched.
- [x] Constrain AI entity/communication tools so encrypted Mail subjects are returned as generic placeholders and Mail bodies are not fetched.
- [x] Keep notifications, sockets, unread counts, timestamps, permissions, and delivery/read state independent from decryption.
- [x] Design abuse/reporting flow:
  - user explicitly submits decrypted excerpt from an active trusted device
  - include message ID, chat/mail ID, participant metadata, timestamps, and report reason
  - optionally include cryptographic proof later
  - no silent admin plaintext access
- [x] Design account recovery:
  - no recovery for encrypted history without trusted keys/envelopes
  - new devices need existing trusted-device approval
  - encrypted backup key may be added later as a separate product decision
- [x] Design key rotation:
  - new content uses new device keys after rotation
  - old content remains decryptable through existing envelopes/history keys where intended
  - no automatic broad history resharing to new devices
- [x] Design organization disable/delete behavior:
  - disable blocks access/UI/session capability without introducing server decryption
  - delete follows existing retention rules for ciphertext, metadata, and file blobs
- [x] Design student graduation/archive behavior:
  - archive metadata and ciphertext according to retention policy
  - do not unwrap or re-encrypt protected content just for archival state changes
- [x] Design AI Copilot context rules:
  - user-initiated only
  - active trusted device only
  - decrypted content handed off from active Mail rendering/Copilot bridge only
  - minimum necessary excerpts/body/subject only
  - no backend decryption or background retrieval
- [ ] Implement explicit client-side Mail-to-Copilot protected-content handoff UI.
- [ ] Implement abuse-report submission UI/API for user-selected decrypted excerpts.
- [ ] Implement key rotation UX and optional encrypted backup-key UX.

### Dependencies

- Phase 5 and Phases 8-10.

### Testing Requirements

- [x] Backend search limitations are enforced for encrypted Mail subject/body.
- [x] Backend Copilot tools do not receive protected Mail body content.
- [x] Encrypted Mail subjects in AI communication/entity context are generic placeholders.
- [ ] Reporting sends only intentional user-selected content.
- [ ] Lost-device UX is clear.
- [ ] Key rotation preserves encrypted-history decryptability where intended.
- [ ] Copilot does not receive decrypted Mail content unless the user explicitly invokes it from an active trusted context.

### Expected Outcome

E2EE does not silently leak protected content into backend search, reporting, recovery, or Copilot paths; the remaining plaintext-export flows are explicit future UX work.

## Phase 12 - Verification and Bug Fixes

### Goals

Harden the implemented E2EE paths against realistic failures before moving into new product work.

### Bugs Found and Fixed

- [x] Client-side sends could proceed when one or more intended recipients had no trusted encryption device.
  - Added reusable recipient-device coverage utilities in the frontend E2EE boundary.
  - Chat and Mail text encryption now fail early with a trusted-device error if any intended recipient has no trusted device.
- [x] Backend validation accepted encrypted Chat/Mail payloads that contained valid envelopes but skipped one or more intended recipients.
  - Chat message validation now requires direct envelopes for every active participant.
  - Mail subject/message validation now requires direct envelopes for every resolved Mail recipient.
- [x] Backend validation accepted partial device coverage for users with multiple trusted devices.
  - Chat and Mail validation now reject payloads missing envelopes for any currently trusted recipient device.
  - This catches stale recipient-device context and forces a refresh/retry instead of creating content that works on only one device.
- [x] Mail attachment authorization used generic file rules.
  - `MAIL_MESSAGE` files now use Mail participant/access resolution before returning metadata or downloads.
- [x] Chat file authorization checked organization before chat membership.
  - Chat and chat-avatar files now use active chat membership, which also supports platform/global chats more correctly.

### Verification Performed

- [x] Backend production build passes.
- [x] Frontend production build passes.
- [x] Type-level verification covers the new shared recipient-device utility and stricter backend validation paths.

### Remaining Manual QA

- [ ] Create a DM where both users have trusted devices, send text and attachment, then decrypt/download from both sides.
- [ ] Try sending to a user with no trusted devices and confirm the sender sees a clear blocking error.
- [ ] Add a second trusted device for a recipient, send new Chat/Mail content, and confirm both devices can decrypt.
- [ ] Approve a new device after earlier content exists and confirm old content without envelopes shows unavailable UX while new content works.
- [ ] Upload/download encrypted Mail attachments as creator, assignee, role-target recipient, and org/platform admin where applicable.
- [ ] Confirm removed/inactive chat participants cannot download new Chat attachments.
- [ ] Confirm attachment download failure states do not expose decrypted filenames/content in logs, toasts, or notifications.

### Expected Outcome

The current implementation is stricter and less likely to create undecryptable protected content. Remaining risk is mostly browser-level multi-device behavior and product UX for no-trusted-device recipients.

## Phase 13 - Performance, Code Quality, and UX Polish

### Goals

Optimize the E2EE implementation before broad manual QA and rollout, reduce duplicate work, keep crypto boundaries small, and make protected communication status visible without distracting from daily workflows.

### Implemented In This Pass

- [x] Added a one-line end-to-end encryption banner at the bottom of the Chat list.
- [x] Added a one-line end-to-end encryption banner at the bottom of the Mail inbox panel.
- [x] Fixed an unread Mail badge class typo that could break styling.
- [x] Updated Mail search placeholder text so it no longer implies encrypted subject/body search.
- [x] Reused Chat recipient-device context between attachment encryption and message encryption when sending attachments.
- [x] Updated the TDD/README with E2EE data model, security boundaries, notification rules, file behavior, and docs registry location.
- [x] Updated public docs for Communication, Chat, Mail, and Files with user-facing E2EE behavior.

### Performance Optimization Plan

- [ ] Replace repeated backend envelope coverage checks that use array `includes` with `Set` lookups in hot validation paths.
- [ ] Add lightweight timing around recipient-device context fetches, local encryption, attachment encryption, and decrypt-on-render failures during development builds only.
- [ ] Review Chat open/load-earlier behavior to confirm only fetched pages are decrypted and no background full-history unwrap happens.
- [ ] Add a short-lived per-chat recipient-device cache invalidation strategy tied to participant/device changes instead of only time-based caching.
- [ ] Avoid repeated `api.e2ee.getMyDevices` calls during a single render/decrypt burst by using a small in-memory current-device helper inside the E2EE boundary.
- [ ] Audit protected render components for repeated decrypt attempts on unchanged ciphertext and add memoized decrypted-state keys where safe.

### Code Optimization and Best Practices

- [ ] Keep all crypto primitives behind `frontend/lib/e2ee/*`; feature components should call intent-level helpers only.
- [ ] Keep backend validation helpers small and shared where possible across Chat and Mail.
- [ ] Add focused unit tests for recipient-device coverage, stale key-version rejection, missing envelope rejection, and generic notification copy.
- [ ] Add frontend unit tests for no-trusted-device error mapping and protected-content unavailable states.
- [ ] Add integration tests for Mail/Chat file download authorization.
- [ ] Ensure no protected content is written to persistent browser storage, logs, analytics, toasts, or notification payloads.
- [ ] Review error messages so users get helpful recovery guidance without revealing recipient identities unnecessarily.

### UX Polish

- [x] Chat list shows `Chats are end-to-end encrypted`.
- [x] Mail inbox shows `Mail is end-to-end encrypted`.
- [ ] Add a concise no-trusted-device send error with a link to trusted-device settings.
- [ ] Add a clearer unavailable-content state for new/untrusted devices.
- [ ] Decide whether the banner should include a tooltip or docs link after manual QA feedback.

### Bug-Hunt Notes

- [x] Fixed Mail unread badge class typo.
- [x] Removed one duplicate Chat recipient-device fetch for attachment sends.
- [ ] Manually verify the Chat/Mail banner placement on narrow mobile viewports and long list states.
- [ ] Manually verify Mail table/footer layout with pagination and the new encryption banner.

### Expected Outcome

E2EE remains secure by design, feels visible but quiet in the UI, and avoids obvious performance traps before multi-device manual testing begins.

## Cross-Phase Testing Matrix

Every E2EE phase must verify:

- Backend never receives private keys.
- Backend never requires decrypted protected content.
- Notifications remain generic.
- Socket payloads do not contain decrypted protected content.
- Unread counts work without decryption.
- Read state works without decryption.
- Permissions work without decryption.
- Recipient resolution is stable before encryption send.
- Revoked devices do not receive new key envelopes.
- Pending devices do not receive protected-content envelopes until approved.
- Pending devices cannot approve themselves.
- New-device approval wraps scoped history keys, not every historical message key.
- New trusted devices show unavailable-content UX when they do not have the required envelopes.
- Newly added chat/group members cannot decrypt messages from before their active membership epoch.
- "Load earlier" decrypts only the fetched page and never triggers full-history key unwrap.
- Multi-tab behavior does not corrupt local key state.
- Private browsing/storage eviction has clear UX.
- XSS-sensitive surfaces are minimized.

## Implementation Guardrails

- Do not create a broad app-wide decryption dependency.
- Do not decrypt inside stores, notification handlers, socket handlers, API clients, or layout shells.
- Do not store decrypted content in persistent browser storage.
- Do not include decrypted content in errors, logs, analytics, audit logs, or toast metadata.
- Do not let backend mention extraction depend on parsing encrypted body text.
- Do not let attachments ride inside plaintext markdown once attachment E2EE begins.
- Do not make auth sessions and encryption devices the same entity.
- Do not allow server-side public-key replacement without user-visible trust semantics.
- Do not add group/chat history sharing for newly added members.
- Do not perform full-history decryption or key unwrap during chat open, device approval, or background refresh.

## Recommended Initial Delivery Slice

The first implementation slice should be:

1. Phase 1 notification/content-boundary refactor.
2. Phase 2 data model foundations.
3. Phase 3 trusted device registration.
4. Phase 4 browser crypto utilities.
5. Phase 5 folded Chat E2EE foundation, starting with DMs and device-approval/history-key prep before groups.

This gives EduVerse a real E2EE foundation while keeping the blast radius small.
