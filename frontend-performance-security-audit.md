# Frontend Performance And Security Audit

Date: 2026-05-04

Scope: `frontend/` source, current `package-lock.json`, current build/lint artifacts, and frontend runtime configuration. Dependency audit was run with `npm audit --json` and `npm audit --omit=dev --json`; both returned `0` known vulnerabilities at the time of this audit.

This document is written for implementation agents. Each finding includes recognition signals, why it matters, and the least risky fix sequence.

## Implementation Status After Master Pull

Updated: 2026-05-04 after re-validating the pulled frontend tree.

Applied:

1. `SEC-02`: fixed the `getStudentFinalGrades` argument order so the JWT is no longer sent in the URL path.
2. `SEC-03`: hardened markdown by escaping raw HTML before parsing, rejecting unsafe link/image URLs, and cleaning image error listeners.
3. `SEC-04`: disabled `dangerouslyAllowSVG` and removed SVG from client-side avatar/chat image upload paths.
4. `SEC-05`: added `frontend/lib/safeUrl.ts` and applied it to markdown links/images, external assessment/submission links, notification/announcement action URLs, schemas, downloads, and public URL handling.
5. `SEC-07`: changed socket token updates to reconnect with fresh auth and prevented duplicate listener reattachment.
6. `PERF-01`: removed global SWR polling while leaving per-page polling available.
7. `PERF-03`: revoked preview object URLs in avatar/chat preview flows and removed inline object URL creation during chat render.
8. `PERF-05`: fixed the socket listener duplication path.
9. `PERF-06`: reduced markdown renderer global mutation/listener leaks as part of the XSS hardening.
10. `PERF-07`: removed unnecessary `unoptimized` from saved avatar/logo images; kept it only where blob/data previews require it.
11. `PERF-08`: cleaned up the read-only banner `ResizeObserver`.
12. `PERF-09`: memoized the SWR fetcher and config object.
13. `SEC-08`: added low-risk baseline browser security headers (`nosniff`, strict referrer policy, frame denial, and narrow permissions policy). Full CSP remains deferred until deployment origins are confirmed.
14. `SEC-10`: hardened the client device ID by preferring `crypto.randomUUID()`, falling back to `crypto.getRandomValues()`, validating stored IDs before reuse, URL-encoding the cookie value, and adding `Secure` when running on HTTPS.
15. `PERF-10`: added `prefers-reduced-motion` handling for global decorative animation classes.
16. `SEC-01` phase 1: moved session persistence from `localStorage` to an HttpOnly backend cookie, added cookie-backed `/auth/session` hydration, removed persisted bearer tokens from the offline queue, and kept access tokens in memory only for compatibility with existing request/socket call sites.

Skipped or partially skipped:

1. `SEC-01` was skipped because moving JWT storage from `localStorage` to `HttpOnly` cookies requires backend/session endpoint changes and would break login/API auth if done frontend-only.
2. `SEC-04`/full CSP hardening remains skipped because the current deployment origins, socket origins, iframe/video policy, and image hosts need confirmation; an incorrect CSP can silently break chat, uploads, videos, and remote images.
3. `SEC-06` was only partially addressed for chat/avatar SVG rejection. A full upload policy was skipped because backend upload limits and accepted file contracts are not visible from the frontend and strict frontend-only limits could break existing assessment/material/mail workflows.
4. `SEC-07` backend room authorization was skipped because it must be enforced and tested in the backend socket gateway; frontend changes cannot prove room access control.
5. `SEC-09`/`PERF-02` no longer need implementation in the current tree because `frontend/lib/chatStore.ts` now keeps message/composer state in memory only and `saveToStorage()` is a no-op.
6. Server-trusted device/session hardening remains skipped for `SEC-10`; the frontend now only hardens the soft client-generated metadata.
7. `PERF-02` deeper IndexedDB/sessionStorage redesign remains skipped because the current memory-only chat session avoids synchronous large `localStorage` writes.
8. `PERF-04` was skipped because replacing eager `limit: 1000` fetches with remote search changes modal/form UX and requires backend search/pagination contracts for each selector.
9. `PERF-08` scroll throttling was skipped because chat scrolling/read receipts are delicate; the observer leak was fixed, but scroll behavior should be profiled before changing read-state timing.
10. `PERF-10` full visual redesign remains skipped because global background visuals are design-facing and should be changed with visual QA; reduced-motion handling was implemented as a low-risk accessibility/performance improvement.

## SEC-01 Next Phase: Full HttpOnly Request Mode

Current state after phase 1:

- The durable browser session is the HttpOnly `eduverse_access_token` cookie set by the backend.
- The frontend no longer reads or writes `localStorage.token`.
- `/auth/session` validates the cookie and returns a short-lived in-memory access token so existing `api.*(token)` calls, socket auth, and route guards keep working.
- Offline mutation replay no longer stores bearer tokens in IndexedDB.

Remaining work to fully remove JS-readable bearer tokens:

1. Change `frontend/lib/api.ts` and all API wrappers so authenticated requests rely on `credentials: 'include'` by default instead of passing a `token` argument.
2. Replace `useAuth().token` as a data-fetch enable flag with an `isAuthenticated` boolean/session state so pages do not need the raw token to decide whether to fetch.
3. Update SWR provider keys/fetchers to use cookie-backed requests and remove token parameters from fetcher closures.
4. Update Socket.IO authentication to use cookie-backed handshake auth or a backend-issued short-lived socket ticket endpoint, then stop passing the access token through `socket.auth`.
5. Update upload helpers, notification helpers, chat/mail stores, and offline replay to call cookie-authenticated endpoints only.
6. Remove `access_token` from `/auth/session` responses once no frontend path needs it; return only server-trusted user/session data.
7. Stop returning `access_token` from login/change-password responses after all immediate post-login flows consume server-returned user/session data instead.
8. Add CSRF protection before relying exclusively on cookie auth for mutating requests if the auth cookie ever needs `SameSite=None` for cross-site deployments.
9. Verify login, reload session restore, logout, revoked sessions, password change, registration logo upload, sockets, push notifications, file uploads, offline replay, and 401 redirects.

Verification after implementation:

1. `npm audit --json`: passed with `0` vulnerabilities.
2. `npm audit --omit=dev --json`: passed with `0` vulnerabilities.
3. `npm run build`: passed after running outside the sandbox because the sandboxed build hit `spawn EPERM`.
4. `npm run lint`: still fails on pulled-code React Compiler lint errors unrelated to these fixes:
   - `frontend/app/(org)/mail/page.tsx`
   - `frontend/app/admin/mail/page.tsx`
   - `frontend/components/ui/CustomMultiSelect.tsx`
   - `frontend/components/ui/CustomSelect.tsx`
   - `frontend/components/ui/SearchBar.tsx`

## Priority Map

Fix in this order:

1. `SEC-02` token-in-URL bug.
2. `SEC-03` markdown XSS.
3. `SEC-01` token storage/session model.
4. `SEC-04` SVG handling and CSP.
5. `SEC-05` unsafe URL schemes.
6. `PERF-01`, `PERF-02`, `PERF-03` request and memory pressure.
7. Remaining medium/low performance cleanups.

## Security Findings

### SEC-01: JWT access token is stored in `localStorage`

Severity: High

Evidence:

- `frontend/context/AuthContext.tsx:68` writes `token` to `localStorage`.
- `frontend/context/GlobalContext.tsx:247` restores the token from `localStorage`.
- `frontend/context/AuthContext.tsx:45-69` and `frontend/context/GlobalContext.tsx:247-279` decode JWT payloads client-side and use the decoded role/user fields for routing state.

Why it matters:

Any XSS in this app can read `localStorage.token` and exfiltrate the bearer token. The markdown renderer currently has an XSS path, which makes this higher risk. Decoding the JWT in the browser is fine for display, but it must not be treated as a trusted authorization boundary.

Agent recognition:

- Search for `localStorage.setItem('token'`.
- Search for `localStorage.getItem('token'`.
- Search for `atob(base64)` in auth/session code.

Least-risk fix approach:

1. First fix `SEC-03` to reduce immediate XSS token theft risk.
2. Move the frontend request model toward a same-origin session endpoint or Next route-handler proxy.
3. Store refresh/session state in a backend-set `HttpOnly; Secure; SameSite=Lax/Strict` cookie.
4. Keep access tokens in memory only if the backend still needs bearer auth during the transition.
5. Add `/auth/me` or `/session` hydration and treat server-returned user data as the source of truth.
6. Remove `localStorage` token persistence after cookie-backed auth is working.
7. Verify refresh, logout, first-login redirect, multi-tab logout, and 401 handling.

### SEC-02: Student final grades fetch passes the JWT as a URL path parameter

Severity: Critical

Evidence:

- API signature: `frontend/lib/api.ts:275` defines `getStudentFinalGrades(studentId, token, sectionId?)`.
- Fetcher call: `frontend/components/providers/SWRProvider.tsx:142` calls `api.org.getStudentFinalGrades(token, args[0] as string)`.

Why it matters:

This reverses `studentId` and `token`, causing the JWT to be placed in the request URL path. URLs are commonly logged by browsers, proxies, servers, APM tools, and error trackers. This leaks bearer credentials outside the intended `Authorization` header.

Agent recognition:

- Search for `getStudentFinalGrades(token`.
- Confirm the API method parameter order in `frontend/lib/api.ts`.

Least-risk fix approach:

1. Change `frontend/components/providers/SWRProvider.tsx:142` to `api.org.getStudentFinalGrades(args[0] as string, token)`.
2. Add a focused test or type-level wrapper that prevents token/student ID argument reversal.
3. Search the repo for other API calls where the first argument is `token` but the API method expects an ID first.
4. Rotate any tokens used in environments where this route has been exercised.
5. Review server/proxy logs for JWT-looking path segments and purge or restrict access where possible.

### SEC-03: Markdown rendering allows XSS through raw HTML

Severity: Critical

Evidence:

- `frontend/components/ui/MarkdownRenderer.tsx:95` returns `marked.parse(...)`.
- `frontend/components/ui/MarkdownRenderer.tsx:131` injects the result with `dangerouslySetInnerHTML`.
- `marked` does not sanitize HTML by itself.
- Renderer overrides escape some image/link attributes, but raw HTML and link text can still flow into the generated HTML.

Why it matters:

Chat messages and mail messages use `MarkdownRenderer`. A malicious message can inject scripts/event handlers or dangerous HTML. Combined with `localStorage` token storage, this can become account takeover.

Agent recognition:

- Search for `dangerouslySetInnerHTML`.
- Search for `marked.parse`.
- Look for user-controlled content passed to `MarkdownRenderer`, especially chat and mail messages.

Least-risk fix approach:

1. Add a sanitizer such as `isomorphic-dompurify` or replace the renderer with `react-markdown` plus `rehype-sanitize`.
2. Configure an explicit allowlist for tags and attributes needed by chat/mail: `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, `code`, `pre`, `blockquote`, `a`, `img`.
3. For links and images, allow only `http:`, `https:`, `mailto:`, `tel:`, and approved internal paths.
4. Forbid inline event attributes, `style`, `srcdoc`, `iframe`, `script`, `object`, and `embed`.
5. Add tests with payloads like `<img src=x onerror=alert(1)>`, `<svg onload=alert(1)>`, `[x](javascript:alert(1))`, and raw `<a onclick=...>`.
6. Keep `rel="noopener noreferrer"` for external links.

### SEC-04: SVGs are allowed in image optimization and upload pickers

Severity: High

Evidence:

- `frontend/next.config.ts:26` sets `images.dangerouslyAllowSVG: true`.
- `frontend/components/ui/PhotoUploadPicker.tsx:132` accepts `image/svg+xml`.
- `frontend/components/chat/ChatLayout.tsx:959` includes `image/svg+xml` in allowed chat attachment types.

Why it matters:

SVG can contain scriptable content. If user-uploaded SVG is served inline or rendered in permissive contexts, it can become XSS. Next warns that `dangerouslyAllowSVG` should be paired with strict content disposition and CSP if it must be enabled.

Agent recognition:

- Search for `dangerouslyAllowSVG`.
- Search for `image/svg+xml`.
- Search for `accept="image/*"` where user uploads are allowed.

Least-risk fix approach:

1. Remove SVG from client upload accept lists unless the product explicitly requires it.
2. Set `dangerouslyAllowSVG: false` in `next.config.ts` if SVG uploads are not required.
3. If SVG support is required, serve uploaded SVG as attachments from the backend with `Content-Disposition: attachment` and a restrictive `Content-Security-Policy`.
4. Add Next image config hardening if SVG remains enabled:
   - `contentDispositionType: 'attachment'`
   - `contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"`
5. Add backend validation and SVG sanitization. Frontend validation is only a convenience layer.

### SEC-05: External URLs are rendered without a central safe-URL policy

Severity: High

Evidence:

- `frontend/lib/utils.ts:16` returns any path starting with `http`.
- `frontend/lib/schemas.ts:163` uses `z.string().url(...)` for `externalLink`, which does not encode the app's allowed schemes/hosts.
- `frontend/components/forms/SubmissionForm.tsx:15` accepts any URL-shaped `fileUrl`.
- `frontend/app/(org)/sections/[id]/assessments/[assessmentId]/page.tsx:110`, `:178`, and `:221` render/open submitted URLs.
- `frontend/components/announcements/AnnouncementDropdown.tsx:233` and `frontend/components/notifications/NotificationDropdown.tsx:160` route to stored action URLs.

Why it matters:

Stored URLs may point to `javascript:`, `data:`, phishing domains, unexpected deep links, or tracking URLs. Even where React blocks some script cases, inconsistent validation creates security and user-safety gaps.

Agent recognition:

- Search for `href={...externalLink}`, `href={...fileUrl}`, `window.open(`, `actionUrl`, and `z.string().url`.
- Search for `path.startsWith('http')`.

Least-risk fix approach:

1. Create `frontend/lib/safeUrl.ts` with `parseSafeUrl(value, options)`.
2. Allow only `https:` by default. Allow `http:` only for localhost/dev if needed.
3. For internal app navigation, allow only relative URLs beginning with `/` and reject `//`.
4. For user-submitted resource links, optionally allow known education/file hosts if the product wants a stricter policy.
5. Replace raw `href`, `Link href`, `window.open`, markdown link rendering, and `getPublicUrl` external handling with this helper.
6. Add tests for `javascript:alert(1)`, `data:text/html,...`, `//evil.com`, malformed URLs, and valid internal paths.

### SEC-06: File upload validation is incomplete and inconsistent

Severity: Medium

Evidence:

- `frontend/components/mail/NewMailModal.tsx:260-268` checks only MIME category and allows up to 5 files.
- `frontend/components/mail/MailThread.tsx:171-178` checks only images/PDF and slices to 3 files.
- `frontend/components/forms/AssessmentForm.tsx:246-250` accepts many extensions with no size check.
- `frontend/components/sections/CourseMaterials.tsx` UI says max 50MB, but the component does not enforce it before upload.
- `frontend/components/ui/PhotoUploadPicker.tsx:46-52` reads the whole file as a data URL before validation.

Why it matters:

The browser can be asked to preview or upload very large files, causing memory pressure and slow UI. Client-side MIME checks are bypassable, so backend validation is still required.

Agent recognition:

- Search for `type="file"`, `accept=`, `FileReader`, and `uploadFile`.
- Check whether file size, count, MIME, extension, and dimensions are validated before preview/upload.

Least-risk fix approach:

1. Add a shared `validateUploadFile(file, policy)` helper.
2. Define policies by feature: avatar/logo, chat attachment, mail attachment, assessment material, submission.
3. Enforce file count, max bytes, allowed MIME, allowed extension, and image dimensions before preview.
4. Show a toast/error for rejected files and do not store them in React state.
5. Mirror the same policies in backend upload endpoints. Treat frontend checks as UX only.
6. Add tests for oversize files, renamed extensions, empty MIME type, SVG, and too many files.

### SEC-07: Socket room joins are client-controlled and token refresh is incomplete

Severity: Medium

Evidence:

- `frontend/hooks/useSocket.ts:88-90` emits `joinRoom` for user, role, and org rooms.
- `frontend/hooks/useSocket.ts:109-114` exposes generic `joinRoom` and `leaveRoom` helpers.
- `frontend/hooks/useSocket.ts:68-75` updates `socketSingleton.auth` when a token changes but does not reconnect.

Why it matters:

If the backend trusts `joinRoom` without server-side authorization, a modified client can subscribe to unauthorized rooms. Updating socket auth without reconnect can leave a socket authenticated with stale credentials.

Agent recognition:

- Search for `emit('joinRoom'`.
- Search for generic `joinRoom(room: string)`.
- Search for `socketSingleton.auth = { token }`.

Least-risk fix approach:

1. Confirm backend authorizes every room join based on server-validated token claims.
2. Restrict frontend `joinRoom` to typed helpers such as `joinChatRoom(chatId)` where the backend validates membership.
3. On token change, disconnect and reconnect the socket with new auth.
4. On logout, keep calling `disconnectSocket()`.
5. Add integration tests that a user cannot join another user's `user:*`, `org:*`, or `chat:*` room.

### SEC-08: Security headers and CSP are missing from frontend config

Severity: Medium

Evidence:

- `frontend/next.config.ts` has no `headers()` configuration.
- `frontend/next.config.ts` currently enables SVG handling without CSP hardening.

Why it matters:

A good CSP limits XSS blast radius. Other headers reduce clickjacking, MIME sniffing, referrer leakage, and overly broad browser permissions.

Agent recognition:

- Search `next.config.ts` for `headers()`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`.

Least-risk fix approach:

1. Add headers in `next.config.ts` or at the deployment edge.
2. Start with report-only CSP if the app has unknown inline style/script needs.
3. Target headers:
   - `Content-Security-Policy`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`
   - `Permissions-Policy` with minimal permissions
4. Include approved image/connect origins from `NEXT_PUBLIC_API_URL`, socket URL, and Cloudinary.
5. Verify login, chat sockets, images, uploads, markdown images, and embedded videos after rollout.

### SEC-09: Sensitive chat content is persisted in `localStorage`

Severity: Medium

Evidence:

- `frontend/lib/chatStore.ts:17-19` stores `messagesByChat`, `composerStates`, and `lastReadByChat`.
- `frontend/lib/chatStore.ts:37` reads `chat_session_store` from `localStorage`.
- `frontend/lib/chatStore.ts:56` writes the whole session store to `localStorage`.

Why it matters:

Messages and drafts can persist after browser close and are readable by any script running on the origin. This increases privacy impact if XSS occurs and can expose sensitive student/staff conversations on shared devices.

Agent recognition:

- Search for `chat_session_store`.
- Search for `messagesByChat` in storage code.

Least-risk fix approach:

1. Stop persisting full messages to `localStorage`.
2. Keep only minimal non-sensitive state such as `lastReadByChat`, or move drafts to `sessionStorage`.
3. If offline persistence is required, use IndexedDB with size caps and clear-on-logout behavior.
4. Add a migration that removes existing `chat_session_store` keys.
5. Cap retained message count per chat in memory.
6. Verify logout clears all sensitive client caches.

### SEC-10: Device ID cookie is client-generated and not hardened

Severity: Low

Evidence:

- `frontend/lib/deviceUtils.ts:16` writes `device_id` without `Secure`.
- `frontend/lib/deviceUtils.ts:48-54` generates IDs with `Math.random()`.
- The ID is duplicated in `localStorage` and a readable cookie.

Why it matters:

This is acceptable only as a soft device label. It should not be trusted for authentication, fraud detection, or session binding because users/scripts can modify it.

Agent recognition:

- Search for `DEVICE_ID_KEY`, `document.cookie`, and `Math.random()`.

Least-risk fix approach:

1. Treat device ID as display metadata only.
2. Generate server-side opaque session/device IDs if they affect security decisions.
3. If keeping the client cookie, add `Secure` in HTTPS environments.
4. Prefer `crypto.randomUUID()` over the current `Math.random()` template.

## Performance Findings

### PERF-01: Global SWR polling refreshes all SWR resources every 30 seconds

Severity: High

Evidence:

- `frontend/components/providers/SWRProvider.tsx:186` sets `refreshInterval: 30000` globally.
- `frontend/components/providers/SWRProvider.tsx:187` also enables `revalidateOnFocus`.

Why it matters:

Every mounted SWR key polls, including tables and detail views that do not need live refresh. The app already uses sockets for chat/notifications, so global polling wastes network, battery, and backend capacity.

Agent recognition:

- Search for `refreshInterval` in `SWRProvider`.
- Open pages with multiple `useSWR` keys and count requests in DevTools.

Least-risk fix approach:

1. Remove global `refreshInterval`.
2. Keep `revalidateOnFocus` if desired, or disable it for heavy pages.
3. Add per-hook refresh only where required, such as live dashboard counters.
4. Use socket events to call `mutate(key)` for chat, notifications, mail, and announcements.
5. Verify with DevTools that idle pages stop polling.

### PERF-02: Chat store synchronously serializes large message state to `localStorage`

Severity: High

Evidence:

- `frontend/lib/chatStore.ts:56` calls `localStorage.setItem(... JSON.stringify(cache.session))`.
- `frontend/lib/chatStore.ts:165-170` writes full message arrays.
- `frontend/components/chat/ChatLayout.tsx:385` syncs messages to cache whenever messages change.

Why it matters:

`localStorage` is synchronous and blocks the main thread. Serializing large chat histories on every message update can cause jank and can exceed browser quota.

Agent recognition:

- Search for `setCachedMessages`.
- Watch performance timeline during active chat usage.

Least-risk fix approach:

1. Stop persisting full messages to `localStorage` as described in `SEC-09`.
2. Keep message cache in memory with a per-chat cap, for example latest 50 messages.
3. Persist drafts separately with debounce and size limits.
4. If durable cache is required, use IndexedDB and async writes.
5. Verify typing, sending, retry, chat switching, and logout.

### PERF-03: Object URLs and data URLs leak memory in upload previews

Severity: High

Evidence:

- `frontend/components/ui/PhotoUploadPicker.tsx:46-52` reads selected images as data URLs.
- `frontend/components/ui/PhotoUploadPicker.tsx:63` creates an object URL and never revokes it.
- `frontend/components/chat/ChatLayout.tsx:1832` creates `URL.createObjectURL(file)` during render.

Why it matters:

Data URLs duplicate the file in memory. Object URLs created during render can multiply on every render and keep blobs alive until revoked.

Agent recognition:

- Search for `FileReader`, `readAsDataURL`, and `URL.createObjectURL`.
- Check whether every created object URL has a cleanup with `URL.revokeObjectURL`.

Least-risk fix approach:

1. For previews, prefer object URLs over data URLs.
2. Create object URLs in `useMemo` or `useEffect`, not inline JSX render.
3. Revoke object URLs in cleanup when the file changes or the component unmounts.
4. For cropping, validate size/dimensions before loading into canvas.
5. Test repeated select/remove/select flows and watch memory usage.

### PERF-04: Large eager list fetches use `limit: 1000` or unbounded requests

Severity: Medium

Evidence:

- `frontend/components/chat/NewChatModal.tsx:122-128` fetches teachers, students, and managers with `limit: 1000`.
- `frontend/app/(org)/sections/page.tsx:43` and `frontend/app/(org)/sections/create/page.tsx:32` fetch courses with `limit: 1000`.
- `frontend/app/(org)/sections/page.tsx:115` calls `api.org.getStudents(token)` without pagination params.
- `frontend/components/forms/TeacherForm.tsx:178` and `frontend/components/forms/StudentForm.tsx:190` fetch all sections without explicit limits.

Why it matters:

Large schools can produce slow modals, high memory use, and expensive backend queries. The chat modal is especially risky because it can fetch multiple 1000-row lists.

Agent recognition:

- Search for `limit: 1000`.
- Search for `getStudents(token)` and `getSections(token)` with no params.

Least-risk fix approach:

1. Replace eager full-list loading with server-side search and pagination.
2. Fetch the first page only when a modal opens.
3. Debounce search input and request `limit: 25` or `50`.
4. For selected existing values, fetch by IDs separately so forms can show labels without loading everything.
5. Add loading and empty states for remote search.

### PERF-05: Socket listener attachment can duplicate callbacks

Severity: Medium

Evidence:

- `frontend/hooks/useSocket.ts:82-83` reattaches every stored listener to the socket.
- `frontend/hooks/useSocket.ts:99-101` also attaches each listener when `subscribe` is called.

Why it matters:

When socket options change or components remount, the same callbacks can be attached more than once. This causes duplicate event handling, repeated state updates, and extra renders.

Agent recognition:

- Search for `listenersSingleton.forEach`.
- Log event callback counts during navigation between chat/notification pages.

Least-risk fix approach:

1. Remove the blanket reattach loop or track attached callback identity per socket instance.
2. Ensure `subscribe` is the only path that attaches callbacks.
3. On socket reconnect, Socket.IO keeps registered handlers on the same socket object; if a new socket object is created, reattach once.
4. Add a small unit test around subscribe/unsubscribe behavior.
5. Verify notification, announcement, presence, typing, and chat events fire once.

### PERF-06: MarkdownRenderer does expensive global work and leaks image error listeners

Severity: Medium

Evidence:

- `frontend/components/ui/MarkdownRenderer.tsx:20` creates a renderer per content render.
- `frontend/components/ui/MarkdownRenderer.tsx:80` calls `marked.setOptions` globally inside render memo.
- `frontend/components/ui/MarkdownRenderer.tsx:122-123` returns cleanup inside a `forEach`, which React ignores.
- `frontend/components/ui/MarkdownRenderer.tsx:148` injects global CSS at module runtime.

Why it matters:

Chat pages can render many markdown messages. Repeated parser setup, global mutation, and listener leaks add overhead.

Agent recognition:

- Search for `marked.setOptions` inside a component.
- Search for `forEach` where the callback returns a cleanup function.

Least-risk fix approach:

1. Create a module-level configured parser or a pure `renderMarkdown(content)` helper.
2. Pair the security fix with sanitizer integration from `SEC-03`.
3. Replace per-image error listeners with event delegation on the container or React-rendered image components.
4. Move markdown CSS to `globals.css` or a component CSS module.
5. Measure chat thread render before/after with React Profiler.

### PERF-07: Several images bypass Next optimization

Severity: Medium

Evidence:

- `frontend/components/ui/PhotoUploadPicker.tsx:100` and `:108` use `unoptimized`.
- `frontend/components/chat/ChatLayout.tsx:1832` and `:2080` use `unoptimized`.
- `frontend/lint_output.txt` reports multiple `@next/next/no-img-element` warnings in login, register, home, chat, and brand components.

Why it matters:

Unoptimized images and raw `<img>` can increase LCP, bandwidth, memory, and layout instability.

Agent recognition:

- Search for `unoptimized`.
- Search for `<img`.
- Run `npm run lint` and check `@next/next/no-img-element`.

Least-risk fix approach:

1. Keep `unoptimized` only for `blob:` or `data:` previews where Next optimization cannot apply.
2. Use optimized `next/image` for saved remote/static images.
3. Add exact `width`/`height` or stable `fill` containers with `sizes`.
4. Update `remotePatterns` narrowly for backend upload hosts.
5. Re-run lint and visually verify avatar/logo/chat image rendering.

### PERF-08: Chat scroll and ResizeObserver work is not throttled/cleaned consistently

Severity: Medium

Evidence:

- `frontend/components/chat/ChatLayout.tsx:200-213` updates state directly in `handleScroll`.
- `frontend/components/chat/ChatLayout.tsx:1619` attaches `handleScroll` to the message container.
- `frontend/components/chat/ChatLayout.tsx:250-257` creates a `ResizeObserver` for the read-only banner without storing/disconnecting it.

Why it matters:

Scroll can fire many times per second, causing repeated state updates. Leaked observers can retain DOM nodes across UI mode changes.

Agent recognition:

- Search for `onScroll={handleScroll}`.
- Search for `new ResizeObserver` and check cleanup.

Least-risk fix approach:

1. Throttle scroll state updates with `requestAnimationFrame`.
2. Only call `setState` when derived values actually change.
3. Store the read-only banner observer in a ref and disconnect it on cleanup/node change.
4. Test long chat history scrolling on low-end mobile throttling.

### PERF-09: SWR fetcher is recreated on every provider render

Severity: Low

Evidence:

- `frontend/components/providers/SWRProvider.tsx:180` calls `createFetcher(token)` directly in render.

Why it matters:

Changing the `SWRConfig` value object can cause unnecessary downstream work. This is lower impact than global polling but easy to avoid.

Agent recognition:

- Search for `const fetcher = createFetcher(token)`.

Least-risk fix approach:

1. Wrap fetcher creation in `useMemo(() => createFetcher(token), [token])`.
2. Wrap the SWR config object in `useMemo`.
3. Verify SWR still refetches correctly after login/logout token changes.

### PERF-10: Large animated blur backgrounds are mounted globally

Severity: Low

Evidence:

- `frontend/app/layout.tsx` mounts multiple large fixed blurred animated elements on every page.

Why it matters:

Large animated `filter: blur(...)` layers can increase GPU/compositing cost, especially on mobile and while dashboard tables/chats are active.

Agent recognition:

- Inspect `frontend/app/layout.tsx` background elements.
- Profile paint/composite costs in Chrome Performance panel.

Least-risk fix approach:

1. Disable or simplify animated blur layers on authenticated dashboard routes.
2. Respect `prefers-reduced-motion`.
3. Use static backgrounds for data-heavy pages.
4. Verify no visual regressions on public landing pages.

## Cross-Cutting Fix Helpers To Add

### Safe URL helper

Recommended file: `frontend/lib/safeUrl.ts`

Responsibilities:

- Parse unknown URLs safely.
- Allow relative internal paths beginning with `/` but reject `//`.
- Allow `https:` by default.
- Allow `http:` only for localhost/dev.
- Return `null` for unsafe URLs so UI can hide or disable links.

### Upload policy helper

Recommended file: `frontend/lib/uploadPolicy.ts`

Responsibilities:

- Centralize allowed MIME types/extensions.
- Enforce max size and max count.
- Validate image dimensions for avatars/logos.
- Produce user-friendly error messages.
- Keep policies mirrored with backend upload validation.

### Session hydration helper

Recommended direction:

- Add a server-backed `/auth/me` or `/session` call.
- Make frontend auth state come from the server.
- Treat JWT decoding as a temporary display optimization only.

## Verification Checklist

After fixes, run:

1. `npm audit --json`
2. `npm audit --omit=dev --json`
3. `npm run lint`
4. `npm run build`

Manual checks:

1. Login, logout, expired session, and 401 redirect.
2. Chat send/edit/delete, markdown preview, image attachments, and file download.
3. Mail compose/reply with attachments and markdown.
4. Assessment external links, submissions, and grading detail.
5. Avatar/logo upload and crop flow.
6. Notification and announcement links.
7. Idle dashboard network tab for unwanted polling.
8. Browser memory while repeatedly selecting/removing upload previews.
