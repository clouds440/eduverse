# Capacitor & Android Implementation Plan

## Implementation Rules

Rule #1

Never modify desktop behavior unless necessary.

Rule #2

Scope native fixes.

Examples:

html.native-app
body.native-app

or:

const isNative = platform.isNative()

then apply:

keyboard fixes
viewport fixes
back button logic
file behavior

ONLY there.

Rule #3

Keep web as source-of-truth UX

Do NOT start redesigning components “for mobile”.

That’s how divergence begins.

Instead:

adapt behavior
not architecture

## 0. Second-Pass Architecture Audit Summary

This second pass changes the migration posture materially.

The previous plan treated `output: 'export'` as the default path because the frontend is mostly client-rendered with SWR. That assumption is **not verified as safe** for this codebase. The app has multiple private dynamic App Router pages, no `generateStaticParams`, `next/image` server optimization assumptions, Google font build-time network dependencies, and environment variables baked into the frontend bundle. Capacitor can still work, but the architecture decision must happen before implementation:

* **Recommended beta path:** Capacitor shell loads the hosted production/staging Next.js app remotely.
* **Recommended long-term path:** keep one frontend codebase, add a mobile abstraction layer, and only pursue packaged static export after dynamic routing and asset assumptions are intentionally refactored.
* **Do not begin by adding `output: 'export'` and hoping build errors are small.** In this repo, static export is a migration project, not a config toggle.

Verified during this audit:

* Frontend is Next.js App Router on Next `16.1.6`.
* No `app/api/**/route.ts`, middleware, server actions, or edge runtime usage were found.
* No `dynamic()` or direct `import()` usage was found in `app`, `components`, or `lib`.
* Static metadata exists and is fine.
* Ten dynamic App Router pages exist with no `generateStaticParams`.
* Auth is bearer JWT in `Authorization` headers, stored in `localStorage`; cookies are only used as a device-id fallback.
* Socket.IO uses a frontend singleton and backend JWT handshake auth.
* File/media flows include chat, mail, course materials, assessments, org logo, user avatars, image cropping, clipboard image paste, optimistic blob previews, and downloads.
* No Tiptap dependency was found. The editor risk is from the custom `MarkdownEditor` and the chat textarea/mention composer, not Tiptap itself.
* A normal `npm run build` currently fails in this sandbox because `next/font/google` cannot fetch `DM Sans` and `JetBrains Mono`. That is an environment/network failure, but it is still a real CI/reproducibility risk for mobile builds.

Assumptions still not verified:

* Real-device Android WebView behavior for file pickers, large Cloudinary uploads, keyboard resizing, Socket.IO background reconnects, and clipboard image paste.
* Production `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, Android network security config, and HTTPS/WSS certificate behavior.
* Whether Google Play distribution policy accepts a remote-first shell for the intended release channel.

---

## 1. Architecture Decision

### Option A: Packaged Static Export. This option will not be implemented.

Capacitor packages `out/` into Android assets. This gives the most app-like binary and avoids dependency on a live web host for first render.

Current fit: **not safe without refactor.**

Blockers:

* Dynamic routes under `frontend/app/(org)`:
  * `/attendance/[sectionId]`
  * `/cohorts/[id]`
  * `/course-materials/[id]`
  * `/sections/[id]`
  * `/sections/[id]/assessments/[assessmentId]`
  * `/students/edit/[id]`
  * `/students/[userId]`
  * `/teachers/edit/[id]`
  * `/teachers/[userId]`
  * `/teachers/[userId]/profile`
* No `generateStaticParams` exists. These IDs are private, tenant-specific, and unbounded, so pre-generating paths is not practical.
* `next/image` is used across auth, admin, chat, mail, brand, org logo, and data modals. Static export requires `images.unoptimized = true` and explicit image URL strategy.
* `next/font/google` creates a build-time external dependency. Mobile CI should self-host fonts or use system fonts.
* `NEXT_PUBLIC_API_URL` is baked at build time. A packaged app cannot switch backend targets without rebuilding unless a runtime config layer is added.
* Static export would not provide an SSR fallback for arbitrary deep links into private dynamic pages.

Mitigations if static export is still chosen:

* Convert private dynamic routes to static shell routes using query params or client-only route state, or create a top-level catch-all SPA entry and own client routing intentionally.
* Add `output: 'export'`, `images.unoptimized = true`, and remove `next/font/google` remote fetch dependency.
* Build a mobile runtime config file copied into public assets and loaded before app boot, or accept per-environment mobile binaries.
* Add a deep-link resolver that maps incoming URLs to routes that are guaranteed to exist in `out/`.

Tradeoff: best offline packaging, but highest frontend refactor cost and highest risk of breaking current web routing.

### Option B: Remote Hosted Next App. We use this option for now.

Capacitor uses a native Android shell and loads `https://app.example.com` through the WebView.

Current fit: **recommended for beta.**

Benefits:

* Preserves existing App Router dynamic routes.
* Keeps SSR/Next runtime available if the app adds server features later.
* Avoids duplicating private dynamic route generation.
* Lets web and Android receive frontend fixes together.

Costs:

* App needs network for normal operation.
* Mobile can silently break if frontend/backend releases are not compatible with installed shell versions.
* Native plugins must be exposed through a stable abstraction because the same frontend can run in browser and Capacitor.
* Store review and user trust can be affected if the binary behaves like only a thin wrapper.

### Recommendation

Use **remote hosted app for the Android beta**, with a small packaged fallback screen for offline/server-down states. Treat static export as a later, separately scoped project after the codebase has a mobile abstraction layer and route strategy.

---

## 2. Static Export Compatibility Report

### Compatible Areas

* No Next route handlers were found.
* No middleware was found.
* No server actions were found.
* No edge runtime declarations were found.
* Most authenticated data fetching is client-side through SWR and `frontend/lib/api.ts`.
* Metadata is static in `app/layout.tsx`, `app/admin/chat/page.tsx`, and `app/(org)/chat/page.tsx`.

### Blockers

| Area | Finding | Severity |
|---|---|---:|
| Dynamic routes | Ten private dynamic pages without `generateStaticParams` | P0 for static export |
| Build reproducibility | `next/font/google` fetch failed during `npm run build` in this environment | P0 for reliable mobile CI |
| Image optimization | `next/image` used widely; current `next.config.ts` does not set `unoptimized` | P0 for static export |
| Runtime config | `NEXT_PUBLIC_API_URL` and socket URL are build-time constants | P1 |
| Deep links | Private URL paths currently assume server/app-router handling | P1 |
| `router.refresh()` | Used in student assessment submission; not meaningful in static export | P2 |

### Mitigation Strategy

P0:

* Decide remote-hosted vs static-export before installing Capacitor.
* If remote-hosted, do not add `output: 'export'`.
* If static-export, first create a spike branch and prove `next build` with `output: 'export'` handles every current route.

P1:

* Self-host fonts or remove `next/font/google` from mobile builds.
* Add `images.unoptimized = true` only for static-export builds, not necessarily for hosted web.
* Add environment separation:
  * web: standard `NEXT_PUBLIC_API_URL`
  * mobile hosted: hosted app points to production API
  * mobile packaged: runtime config/bootstrap file or binary-per-environment

### Final Static Export Position

Static export is **not currently safe**. The dynamic routes are the decisive blocker. A remote hosted Capacitor shell is the practical path that preserves the single frontend codebase with the least architectural churn.

---

## 3. Authentication & Session Persistence Audit

### Current Architecture

Frontend:

* Login calls `api.auth.login()` and stores the JWT in `localStorage` under `token`.
* Requests use `Authorization: Bearer <token>`.
* Auth state is decoded from JWT on boot in `GlobalContext`.
* A global 401 handler clears the token, clears chat session state, disconnects Socket.IO, and redirects to `/login`.
* Device ID is generated in `frontend/lib/deviceUtils.ts`, stored in `localStorage`, with `document.cookie` fallback using `SameSite=Lax`.

Backend:

* JWT access token expiry is `1d`, or `30d` with remember-me.
* Session records are stored server-side when `deviceId` is provided.
* `JwtStrategy` requires the token to match an active session row.
* No refresh-token flow exists.
* CORS accepts `FRONTEND_URL` values or `*`; Socket.IO has separate CORS config with credentials.

### Android WebView Risks

P0:

* Backend CORS must include hosted origin and native origins used by Capacitor/live reload. For native WebView, plan for `capacitor://localhost`, `http://localhost`, and dev LAN origins.
* Socket.IO CORS must be updated independently from REST CORS.

P1:

* `localStorage` is usually persistent in Android WebView, but it is not a strong session store. A WebView data clear, app reinstall, or some OEM storage behavior will log users out.
* There is no refresh flow. A teacher who backgrounds the app overnight will hit a burst of 401s on foreground, SWR retries, socket reconnect failure, and then logout.
* Session token is rotated on password change, but Socket.IO singleton must reconnect with the new token immediately.
* `deviceUtils` browser/OS detection will call Capacitor WebView "Chrome on Android"; this is acceptable for audit logs but not for durable mobile device identity.

P2:

* Cookies are not central to auth, which is good. The device-id cookie has no `Secure`, but it is only a fallback and should not be treated as authentication.
* SWR `shouldRetryOnError` checks `err.status`, but `api.request()` throws plain `Error` without `status`. 401s can still retry in SWR until the unauthorized handler clears auth.

### Recommendation

Do not do a full auth redesign before beta. Do add a mobile-safe abstraction now:

* Create `frontend/lib/mobile/storage.ts` with `getToken`, `setToken`, `clearToken`, `getDeviceId`.
* Browser implementation can continue using `localStorage`.
* Native implementation should use a Capacitor storage wrapper. `@capacitor/preferences` is sufficient for persistence, but not secure storage. If token-at-rest security is required, evaluate a maintained secure-storage plugin separately.
* Keep all auth callers using the abstraction; do not call Capacitor APIs from `AuthContext`, `GlobalContext`, or `deviceUtils` directly.

Auth refactors:

* P0: CORS/native-origin support.
* P1: mobile storage abstraction and foreground session validation.
* P2: refresh-token architecture with short access token plus refresh token.
* P3: biometric unlock or secure enclave-style token protection.

---

## 4. File Upload & Media Handling Audit

### Current Upload Surfaces

* Chat attachments in `ChatLayout`: multi-file upload, optimistic markdown, blob previews, clipboard paste.
* Mail attachments in `NewMailModal` and `MailThread`.
* Assessment files in `AssessmentForm` and student submissions.
* Course materials in `CourseMaterials`.
* Org logo and user avatars through `PhotoUploadPicker` and `ImageCropperModal`.
* Chat avatar upload in `ChatSettingsModal`.

Backend:

* Generic `/files` upload accepts one `file` per request with Cloudinary storage.
* Images/text limited to 5 MB; other accepted docs/archives limited to 50 MB in controller logic.
* `FilesModule` uses Cloudinary storage but does not set Multer `limits`, so oversized files may stream to Cloudinary before controller rejection.
* Avatar/logo routes do set 5 MB Multer limits in `org.controller.ts`.

### Android/WebView Risks

P0:

* File picker and camera/gallery behavior must be verified on real Android. Browser `<input type="file">` should work, but `capture`, permissions, MIME filtering, and multiple selection are device-dependent.
* Downloads through blob/object URL need a native path. Current `downloadFile()` creates a blob URL and clicks an anchor; Android WebView may ignore this.

P1:

* Chat uploads use `Promise.all` for all staged files. Multiple 50 MB files can create memory pressure and poor progress UX.
* Optimistic attachment markdown creates blob URLs in `buildOptimisticAttachmentMarkdown`; those object URLs are not centrally tracked for revocation after replacement.
* Image cropper reads selected image as a full data URL, then draws to canvas. Large phone photos can consume substantial memory despite the 5 MB final image limit.
* Clipboard image paste in chat is desktop-oriented. Android keyboards and WebView clipboard APIs may not provide image `ClipboardItem`s reliably.
* Upload progress is not exposed. Users may think the app froze during Cloudinary/network uploads.

P2:

* `accept` filters differ across chat, mail, assessments, and avatars. Centralize allowed MIME rules.
* `image/svg+xml` is allowed by generic backend upload but explicitly rejected by `PhotoUploadPicker` and disabled in Next image config. Keep SVG policy consistent.

### Required Plugins

P0:

* `@capacitor/app`
* `@capacitor/browser` or an in-app/open-external-url wrapper for external links and file URLs that should leave the WebView.

P1:

* `@capacitor/filesystem` for downloads/save/share workflows.
* `@capacitor/share` if users must share downloaded files.
* `@capacitor/camera` only if native camera/gallery selection becomes a product requirement. Do not install it just to replace `<input type=file>` until real-device testing proves the need.

### Upload Architecture Improvements

P1 before beta:

* Add `frontend/lib/mobile/files.ts` with:
  * `pickFiles`
  * `downloadFile`
  * `openExternalUrl`
  * `canUseClipboardImages`
* Add upload queueing for chat and mail: limit concurrency to 1-2 files, surface progress or at least per-file pending state.
* Add backend Multer limits to generic `FilesModule` to reject oversized files before Cloudinary streaming.
* Add client-side size validation before upload.

P2:

* Downscale/compress camera images before upload.
* Add resumable upload only if real users upload large PDFs/videos. Current accepted file set does not justify it yet.

---

## 5. Mobile Runtime & Viewport Audit

### Current Findings

* `app/layout.tsx` uses `h-screen` and `overflow-hidden` on `<body>`.
* `DashboardLayout` uses full-height fixed/flex containers and its own scrolling.
* Auth pages use `h-screen` with centered forms.
* Modals use portals to `document.body`, `fixed inset-0`, `max-h-[85vh]`, and body `overflow = hidden`.
* Chat has a complex bottom composer, textarea auto-height, mention dropdown positioned `absolute bottom-full`, staged file rail, image preview modal, and long-press/touch handlers.
* The codebase does not use Tiptap or an emoji picker package. Mobile editor testing should focus on `MarkdownEditor`, mail reply focus behavior, and chat textarea/mention interactions.
* Many pages use fixed/sticky overlays, z-index classes, and nested scroll regions.

### Prioritized Risk List

P0:

* Keyboard overlap in chat composer and login/change-password forms. `h-screen` plus `overflow-hidden` can trap content under the Android keyboard.
* Modal body scroll lock can conflict with keyboard resize, especially cropper, mail compose, assessment submission, and settings/logo flows.
* Android back button currently has no app-level routing/modal close policy.

P1:

* Mention dropdown near the composer can be hidden by keyboard or clipped by parent overflow.
* Fixed sidebar/mobile overlay and portal z-index values must be tested together with notification dropdowns and modals.
* `100vh`/`h-screen` should be replaced with app-height CSS variables or `100dvh` where appropriate.
* Textarea focus after send (`ta?.focus()`) may reopen keyboard unexpectedly after upload/send on Android.

P2:

* Decorative blur/animation backgrounds may cost more GPU in WebView than desktop Chrome.
* Long-press message actions can conflict with Android text selection/context menu.

### Mitigation Roadmap

P0:

* Install `@capacitor/keyboard` and test resize modes on real devices.
* Add an app-level `useMobileRuntime()` listener for:
  * hardware back
  * keyboard show/hide
  * app foreground/background
* Define `--app-height` from `window.innerHeight` on native and use it for root dashboard/chat containers.
* Create a back-button policy:
  * close topmost modal/dropdown
  * close mobile sidebar
  * leave active chat/detail route
  * then `router.back()`
  * exit app only from safe top-level routes

P1:

* Refactor modal overlay sizing to account for keyboard height and safe-area insets.
* Move chat mention dropdown into a portal or ensure it is not clipped by composer overflow.
* Add real-device screenshots for chat, mail compose, assessment submission, settings logo cropper, login, and dashboard table pages.

Test checklist:

* Login with keyboard open, rotate device, submit invalid credentials.
* Chat send text, send image, send PDF, paste image where supported, mention user, open image preview, use back button.
* Open mail compose with attachments and reply editor focused.
* Open cropper, zoom/rotate, confirm image.
* Open nested modal/confirm dialog and press Android back.
* Switch app to background during upload and during socket-connected chat, then foreground.

---

## 6. Realtime & Backgrounding Audit

### Current Architecture

* `useSocket` keeps a module-level Socket.IO singleton.
* Socket auth uses `auth: { token }`.
* Reconnection is enabled with five attempts and 2 second delay.
* Multiple components subscribe to shared singleton events through a listener map.
* Chat reconciles incoming messages against optimistic temp messages.
* Chat, notification, and stats caches are mostly in-memory with SWR and custom stores.

### Risks

P0:

* Android backgrounding can pause the WebView and kill the socket. Current reconnect attempts may already be exhausted by the time the app foregrounds.
* Room joins are not centrally replayed on reconnect. Active chat room membership can be lost after reconnect unless the relevant effect runs.
* Native app lifecycle is not wired into SWR/cache recovery.

P1:

* Duplicate event handling is possible if listener cleanup misses a render path. The singleton map helps, but real foreground/reconnect churn must be tested.
* Message desync is likely after offline/background windows because missed messages rely on REST refetch, not socket replay.
* Read receipts can race with foreground refetch and mark-as-read calls.
* SWR focus revalidation may not fire predictably in Capacitor because browser focus semantics differ from native app foreground.

### Lifecycle Strategy

P0:

* Add a central mobile runtime module that emits `appBecameActive` and `appBecameInactive`.
* On foreground:
  * force socket reconnect if disconnected
  * replay identity rooms and active feature rooms
  * call SWR global `mutate` for chat list, unread counts, notifications, mail counts, and active detail page
  * run a lightweight `/auth/sessions` or profile validation request to detect revoked sessions before the UI acts on stale state

P1:

* Track active socket rooms in one module instead of scattering `joinRoom` calls.
* Add a "recovery fetch" for active chat: fetch latest page after foreground/reconnect and reconcile by message ID.
* Make event handlers idempotent by ID for messages, notifications, and announcements.

P2:

* Add offline state UI for send failures and retry queue.
* Persist unsent chat drafts in mobile storage if product value justifies it.

---

## 7. App Update & Versioning Strategy

This must exist before a remote-first Capacitor shell ships.

### Failure Modes

* Hosted frontend deploy expects newer native plugin wrappers than the installed Android binary has.
* Backend removes or changes API fields while older mobile shells still run.
* Web frontend starts using a route/plugin/capability that old Android shells do not support.
* Static packaged clients keep using an old `NEXT_PUBLIC_API_URL` or old API contract.
* Users background the app for days and resume into an incompatible frontend/API state.

### Required Strategy

P0:

* Add a `/version` or `/mobile/config` backend endpoint returning:
  * minimum supported Android app version
  * latest Android app version
  * API compatibility version
  * feature flags
  * force-update flag/message
* Add frontend startup check that blocks unsupported native app versions with a forced update screen.
* Version the Capacitor shell independently from the web frontend.

P1:

* Semantic versioning:
  * Android shell: `major.minor.patch`
  * API contract: explicit compatibility version, not just package version
  * frontend build: commit SHA/build number
* Maintain API backward compatibility for at least the oldest supported mobile version.
* Add feature flags for native-only features such as downloads, push, camera, and live updates.
* Create release channels:
  * internal/dev
  * beta/staging
  * production

P2:

* Add stale-client telemetry: app version, web build version, API version, platform, WebView version.
* Add server-side warnings when an old mobile app is near deprecation.

P3:

* Evaluate live updates only after the native abstraction is stable. Live updates increase rollback complexity and must respect store policy.

---

## 8. Deep Linking & Intent Architecture

### Current Routing Shape

Routes are role-based and often redirect from `AuthContext` after decoding the JWT. Notifications and announcements already carry `actionUrl` values such as `/settings#sessions`. Chat uses query params for message targeting.

### Risks

* Deep links into private dynamic routes fail before auth state loads or if the static export path does not exist.
* Role redirects can override intended links.
* Notification URLs are currently plain internal paths, not a typed route contract.
* External links and file URLs may open inside the WebView unless wrapped.

### Future-Ready Design

P1:

* Create `frontend/lib/mobile/navigation.ts`:
  * `normalizeInternalRoute(url)`
  * `openRouteFromIntent(intent)`
  * `openExternalUrl(url)`
  * `getPostLoginRedirect()`
* Store pending deep link while unauthenticated; after login, validate role/access and then navigate.
* Convert notification `actionUrl` values to a typed route registry where possible.
* Add Android intent filters for the chosen production host, for example:
  * `https://app.example.com/chat?chatId=...`
  * `https://app.example.com/students/:id`
  * custom scheme only for internal/testing if needed.

P2:

* Add notification-to-route mapping for push:
  * chat message -> `/chat?chatId=...&msgId=...`
  * mail -> `/mail?mailId=...`
  * assessment -> `/sections/:sectionId/assessments/:assessmentId`
  * security/session -> `/settings#sessions`

Do not implement deep links as ad hoc `router.push(payload.url)` scattered across notification UI, push handlers, and auth redirects.

---

## 9. Mobile Abstraction Layer

Add a dedicated layer before adding native features.

Proposed structure:

```text
frontend/lib/mobile/
  index.ts
  platform.ts
  appLifecycle.ts
  storage.ts
  files.ts
  navigation.ts
  config.ts
  capabilities.ts
```

Responsibilities:

* `platform.ts`: `isNative`, `isAndroid`, `isWeb`, WebView detection.
* `appLifecycle.ts`: foreground/background, back button, keyboard events.
* `storage.ts`: token, device id, small preferences.
* `files.ts`: pick/download/share/open file.
* `navigation.ts`: deep links, external links, post-login redirects.
* `config.ts`: mobile version, release channel, backend URL/runtime config.
* `capabilities.ts`: feature flags for camera, push, filesystem, share.

Modules that should **never** call Capacitor APIs directly:

* `AuthContext`
* `GlobalContext`
* `SWRProvider`
* `useSocket`
* `api.ts`
* page components under `app/**`
* generic UI components such as `Modal`, `Button`, `DataTable`

Allowed direct native boundary:

* only files inside `frontend/lib/mobile/**`
* one top-level provider/hook that wires mobile lifecycle into React

This prevents `Capacitor.isNativePlatform()` checks from spreading through the codebase.

---

## 10. Required Capacitor Plugins

P0:

* `@capacitor/core`
* `@capacitor/cli`
* `@capacitor/android`
* `@capacitor/app` for app lifecycle and Android back button.
* `@capacitor/keyboard` for keyboard resize behavior.

P1:

* `@capacitor/status-bar` for safe status-bar styling.
* `@capacitor/splash-screen` to avoid white flashes during remote load/bundle boot.
* `@capacitor/browser` for external links and hosted documents.
* `@capacitor/filesystem` for durable downloads.

P2:

* `@capacitor/share` for sharing downloaded files.
* `@capacitor/preferences` if used by `mobile/storage.ts`.
* `@capacitor/push-notifications` after app lifecycle/realtime recovery is stable.

P3:

* Camera/gallery plugin if native capture is required.
* Live update plugin after release/version safeguards exist.

Avoid installing plugins before the abstraction layer exists.

---

## 11. Implementation Roadmap By Priority

### P0: Critical Blockers

* Choose remote-hosted vs static-export architecture. Current recommendation: remote-hosted for beta.
* Add Capacitor baseline Android project only after architecture decision.
* Add CORS support for REST and Socket.IO native/dev origins.
* Add mobile abstraction skeleton under `frontend/lib/mobile/**`.
* Add app lifecycle handling for back button, foreground/background, and keyboard.
* Add version/config endpoint design and forced-update screen before external beta.
* Prove real-device login, REST calls, Socket.IO connect, chat route, and one upload.

### P1: Beta Readiness

* Implement mobile storage wrapper for token/device ID.
* Implement mobile file/download/open-external-url wrappers.
* Add foreground recovery: auth validation, socket reconnect, room replay, SWR/cache revalidation.
* Add upload queue/size validation and generic backend Multer upload limits.
* Fix root/chat/dashboard viewport sizing for keyboard and `h-screen`.
* Self-host fonts or otherwise make mobile CI builds reproducible.
* Add deep-link pending-route flow.
* Add release channels and app/API version headers or telemetry.

### P2: Production Hardening

* Add refresh-token flow or deliberate reauth UX.
* Add upload progress and image downscaling/compression.
* Add push notifications and notification-to-route mapping.
* Add stale-client telemetry and server-side deprecation warnings.
* Add automated Android smoke tests plus manual real-device checklist.
* Replace scattered external `<a target="_blank">` flows with `mobile/navigation`.

### P3: Future Scalability

* Static export refactor, if still desired.
* Offline read caches and retry queues.
* Native camera/gallery UX.
* Live updates.
* Biometric unlock/secure token storage.
* Tablet-specific layouts.

---

## 12. Build & Development Workflow

### Remote-Hosted Beta Workflow

* Capacitor config points to hosted staging/production URL.
* Android debug builds can still use live reload for local iteration.
* Backend `FRONTEND_URL` must include:
  * hosted app origin
  * `capacitor://localhost`
  * `http://localhost`
  * LAN dev origin used by live reload

### Static Export Workflow, If Later Chosen

Only after blockers are resolved:

```ts
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
```

Then prove:

* `next build` succeeds without network-only font fetches.
* `out/` includes every route needed at cold start/deep link.
* Dynamic private details still work after hard refresh and Android intent open.

### Android Studio

CLI builds are acceptable for development, but Android Studio remains useful for signing, manifest inspection, WebView/native crash debugging, and Play Store release validation.

---

## 13. Realistic Risk Assessment

Highest probability failures:

* Keyboard hides chat composer or modal form actions.
* Dynamic routes make static export fail or produce broken deep links.
* Socket.IO appears connected but misses events after background/foreground.
* Downloads and external file opens silently fail in WebView.
* Large image/PDF uploads feel frozen or fail without recoverable UI.

Highest maintenance burden:

* Keeping a remote-hosted frontend compatible with installed native shells.
* Preventing native checks from leaking into normal web components.
* Chat state reconciliation after optimistic sends, reconnects, reads, edits, deletes, and room membership changes.
* Version/feature-flag discipline after the app is in users' hands.

Most likely Android-specific pain points:

* Keyboard resize modes.
* File picker MIME quirks.
* WebView memory pressure from image cropper/data URLs/blob previews.
* Back button behavior with portals, dropdowns, drawers, and nested routes.
* App resume after the OS pauses or kills the WebView process.

Things the earlier plan overestimated:

* Static export viability.
* Reliability of HTML anchor downloads in WebView.
* Simplicity of auth persistence without a storage abstraction.
* Socket.IO reconnect being enough without cache recovery.
* Ability to defer versioning/update strategy.

Real-device-only areas:

* Keyboard behavior.
* Upload picker/camera/gallery behavior.
* Clipboard image paste.
* File downloads/opening.
* Background upload and socket lifecycle.
* Hardware back button with active modal/dropdown/sidebar/chat route.

Expected time sinks:

* Chat keyboard/composer layout.
* Dynamic route/static export decision if challenged late.
* Foreground recovery and duplicate-event prevention.
* File handling UX around downloads, uploads, and external viewers.
* Release/version safeguards that feel boring until they save the app.

---

## 14. Final Recommendation

Proceed with a **remote-hosted Capacitor Android beta**, not packaged static export. Preserve the single frontend codebase by adding a small, strict mobile abstraction layer and routing all native behavior through it. Revisit static export only after dynamic route strategy, fonts, images, runtime config, and deep links are deliberately redesigned.

Immediate next engineering move:

1. Add `frontend/lib/mobile/**` abstraction skeleton.
2. Add Capacitor Android shell configured for hosted staging.
3. Update backend REST and Socket.IO CORS for native/dev origins.
4. Implement lifecycle/back/keyboard hooks.
5. Run a real-device smoke test for login, chat, upload, download/open, background/foreground, and back button.
