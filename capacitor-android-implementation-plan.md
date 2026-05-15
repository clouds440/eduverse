# Capacitor & Android Implementation Plan

## 1. Architecture Overview

### How Capacitor Integrates
Capacitor acts as a native bridge and web view wrapper for your Next.js application. Instead of running in a mobile browser, your Next.js app runs inside an Android `WebView` controlled by Capacitor. Capacitor injects JavaScript APIs that allow your web code to communicate with native Android features (like the filesystem, push notifications, and hardware back button) via a message bridge.

### Next.js Export Interaction
Capacitor requires static HTML/JS/CSS. Because your Next.js app is heavily CSR-oriented (using SWR and `use client`), we will use Next.js's `output: 'export'` feature. This generates a static `out/` directory. Capacitor's CLI will copy this `out/` directory into the Android native project's assets folder during the build process.

### Backend Communication
Your NestJS API and WebSockets will remain entirely unchanged. The mobile app will communicate with the NestJS backend over standard HTTPS and WSS protocols, exactly as the web browser does. You will simply point your SWR fetcher and Socket.io client to your production backend URL instead of relative paths.

### Shared vs. Platform-Specific
*   **Shared (95%):** All UI components, state management (SWR), forms, Tailwind styling, and business logic.
*   **Platform-Specific (5%):** File downloads (must use Capacitor Filesystem API instead of HTML5 `<a>` downloads), Push Notifications (APNS/FCM instead of Web Push), Status Bar styling, and Android hardware back button interception.

---

## 2. Installation & Environment Setup

### Required Software & Tools
*   **Node.js & npm:** (Current versions you are using are fine).
*   **Java Development Kit (JDK) 17:** Required for compiling Android apps.
*   **Android SDK & Command Line Tools:** Required to build APKs.
*   **Android Studio (Can we avoid it?):** **Yes, for local development and live reload.** You can use the Capacitor CLI and Android SDK command-line tools (`gradlew`) to build and deploy APKs to a physical device without ever opening the Android Studio GUI. However, for compiling the final signed release APK/AAB or debugging deep native Java/Kotlin crashes, having it installed (even if running in the background) is highly recommended.

### Exact Installation Commands

```bash
# 1. Install Capacitor CLI and Core
npm install @capacitor/cli @capacitor/core

# 2. Initialize Capacitor (Run in frontend/ directory)
npx cap init "School Management" "com.zigron.schoolmanagement" --web-dir out

# 3. Install Android Platform
npm install @capacitor/android
npx cap add android
```

### Next.js Configuration (`next.config.ts`)
Update your Next.js config to enable static exports and disable features that require a Node.js server.

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Required for Capacitor
  reactCompiler: true,
  images: {
    unoptimized: true, // Required because 'next export' does not support Next.js Image Optimization API
  },
};
export default nextConfig;
```

### Build & Sync Workflow
Add these scripts to your `package.json`:
```json
"scripts": {
  "build:mobile": "next build && npx cap sync android",
  "dev:mobile": "npx cap run android -l --external"
}
```

---

## 3. Step-by-Step Integration Roadmap

### Phase 1: Static Export Preparation (Days 1-2)
*   **Goal:** Successfully run `next build` with `output: 'export'`.
*   **Files:** `next.config.ts`, `package.json`, any dynamic server-side logic.
*   **Risks:** `next/image` requires `unoptimized: true`. Cloudinary handles your optimization, so this is safe, but local images won't be optimized.

### Phase 2: Capacitor Initialization (Day 3)
*   **Goal:** Generate the Android project folder and sync the web assets.
*   **Files:** `capacitor.config.ts`, `android/` directory.
*   **Action:** Run `npx cap init` and `npx cap add android`.

### Phase 3: Hardware & Viewport Tuning (Days 4-5)
*   **Goal:** Handle the Android hardware back button and status bar.
*   **Action:** Implement a global hook listening to `@capacitor/app` `backButton` event to trigger `router.back()`. Use `@capacitor/status-bar` to set the status bar color to your theme's background.
*   **Risks:** Without back button handling, pressing back on Android will immediately close the app.

### Phase 4: File System & Downloads Refactor (Days 6-8)
*   **Goal:** Fix attachment downloads in the chat.
*   **Files:** `AttachmentPreviewCard.tsx`, `lib/utils.ts`.
*   **Action:** Replace `<a>` tag `blob:` downloads with `@capacitor/filesystem`. You must download the base64/blob data and write it directly to the Android `Directory.Documents`.

### Phase 5: Keyboard & Realtime Stability (Days 9-11)
*   **Goal:** Prevent UI jumps when the Tiptap keyboard opens and maintain Socket.io connections.
*   **Action:** Use `@capacitor/keyboard` to set `setResizeMode(KeyboardResize.None)` if the default viewport shrinking breaks your flexbox chat layouts. Add `@capacitor/app` listeners for `appStateChange`. When `isActive` becomes true (app foregrounded), force Socket.io to reconnect and trigger an SWR revalidation (`mutate()`).

---

## 4. Real Android Device Testing Workflow

### Avoiding Android Studio GUI
You can test entirely via CLI using Capacitor's Live Reload feature. This serves your Next.js app locally and points the Android app to your machine's local IP address.

1.  **USB Debugging:** Enable Developer Options on your Android device. Enable "USB Debugging". Connect to your PC.
2.  **Verify Device:** Run `adb devices`. You should see your phone listed.
3.  **Start Live Reload:** 
    ```bash
    npx cap run android -l --external
    ```
    *This command compiles the APK via Gradle CLI, installs it on your phone, and proxies the WebView to your Next.js dev server (`http://192.168.x.x:3000`). Hot Module Replacement (HMR) will work instantly on your phone.*

### Network Requirements
Both your PC and your phone **must** be on the same Wi-Fi network. The NestJS backend must also be running and accessible via your PC's local IP address (update your frontend `.env` to point to `http://192.168.x.x:PORT` instead of `localhost`).

### Remote Chrome Debugging
To inspect the DOM or view console logs on the physical device:
1. Open Google Chrome on your PC.
2. Navigate to `chrome://inspect/#devices`.
3. You will see your WebView listed under your device. Click "Inspect" to open the standard Chrome DevTools for your mobile app.

---

## 5. Required Capacitor Plugins

> [!IMPORTANT]  
> Only install plugins when absolutely necessary to keep the Android binary size small and reduce dependency hell.

### Immediately Required
*   **`@capacitor/app`**: Essential for handling the Android hardware back button and detecting background/foreground state (crucial for Socket.io reconnects).
*   **`@capacitor/status-bar`**: Required to prevent the Android status bar from being a harsh black/white box. Sets it to match your "Crypto Blue" theme.
*   **`@capacitor/keyboard`**: Crucial for tuning the Chat Composer. Mobile keyboards often ruin `100vh` flexbox layouts.
*   **`@capacitor/filesystem`**: **Critical.** HTML5 `<a>` tag downloads do not work in Android WebViews. You must use this plugin to save chat attachments.

### Needed Later (Phase 2)
*   **`@capacitor/push-notifications`**: Integrates with Firebase Cloud Messaging (FCM) for Android push notifications.
*   **`@capacitor/splash-screen`**: To hide the brief white flash while the Next.js JS bundle evaluates.

### Avoid For Now
*   **`@capacitor/device` or `@capacitor/preferences`**: Since your app already works well with standard JWTs and cookies/SWR, avoid migrating to native storage until you encounter a specific persistence issue.

---

## 6. Codebase Compatibility Audit

> [!WARNING]  
> The following areas of your current Next.js codebase require immediate attention for Capacitor compatibility.

1.  **`next/image`**
    *   **Risk:** `next/image` relies on a Node.js server to resize images on the fly. Capacitor runs statically on the device.
    *   **Mitigation:** You must set `unoptimized: true` in `next.config.ts`. Because you use Cloudinary, update your image URLs to request specific sizes directly from Cloudinary (e.g., adding `w_400,c_fill` to the URL string).
2.  **File Downloads (`AttachmentPreviewCard.tsx`)**
    *   **Risk:** Clicking an attachment currently creates a blob and triggers an `<a>` tag click. Android WebViews will silently swallow this action; no file will download.
    *   **Mitigation:** Detect if running in Capacitor (`Capacitor.isNativePlatform()`). If true, use `@capacitor/filesystem` `Filesystem.writeFile()` to save the file to `Directory.Documents`.
3.  **Viewport Units (`100vh`)**
    *   **Risk:** Mobile browsers include the address bar in `100vh`. While Capacitor doesn't have an address bar, the virtual keyboard *will* alter the viewport.
    *   **Mitigation:** Use `dvh` (dynamic viewport height) or rely on flex-grow containers instead of hardcoded `vh` units for your Chat Layout.
4.  **Socket.io Backgrounding**
    *   **Risk:** Android OS aggressively pauses WebViews when the app is backgrounded. Sockets will die.
    *   **Mitigation:** Listen to `App.addListener('appStateChange')`. When `isActive` is true, forcefully call `socket.connect()` and invalidate SWR caches to fetch missed messages.

---

## 7. Mobile UX Hardening Checklist

*   [ ] **Touch Targets:** Ensure all `Toggle`, `Button`, and dropdown menu items have a minimum hit area of `44x44px`.
*   [ ] **Overscroll Behavior:** Add `overscroll-y-none` to your `<body>` to prevent the entire app from having a "rubber band" effect when dragging at the top/bottom of the screen.
*   [ ] **Select Text Highlight:** Add `user-select-none` (Tailwind: `select-none`) to buttons and tabs to prevent ugly blue highlighting when users long-press navigation items.
*   [ ] **Safe Areas:** Utilize CSS environment variables (`padding-top: env(safe-area-inset-top)`) for your top navigation bar to prevent the Android status bar or notch from covering your UI.
*   [ ] **Back Button:** Implement `@capacitor/app` `backButton` listener to map Android's hardware back swipe/button to Next.js `router.back()`.

---

## 8. Build & Deployment Pipeline

### APK Generation
While you can use Android Studio to click "Build APK", you can easily automate this.
In your `android/` directory:
```bash
./gradlew assembleDebug # Generates testing APK
./gradlew bundleRelease # Generates Android App Bundle (AAB) for Play Store
```

### Recommended CI/CD (GitHub Actions)
1.  **Trigger:** On push to `main`.
2.  **Web Build:** Run `npm run build:mobile` (generates `out/` and syncs).
3.  **Android Build:** Navigate to `android/` and execute `./gradlew assembleDebug`.
4.  **Artifact:** Upload the `.apk` as a GitHub Actions artifact so stakeholders can download and install it on their phones immediately without compiling.

### Release Strategy
Keep your API backwards compatible. Because the mobile app is a compiled binary sitting on a user's phone, you cannot force them to update immediately. Your NestJS API must support both the newest web version and older mobile versions simultaneously.

---

## 9. Future Maintenance Plan

*   **Avoiding Divergence:** **Never** create mobile-specific pages unless absolutely necessary. Use `Capacitor.isNativePlatform()` to conditionally render mobile-specific UI components (like a native share sheet vs a web modal) within the exact same Next.js files.
*   **Capacitor Updates:** Update Capacitor strictly via their official migration guides. Do not haphazardly update `@capacitor/core` without updating `@capacitor/android` to the exact same version.
*   **Live Updates:** In the future, look into **Capacitor Live Update** (or Microsoft CodePush). This allows you to push Next.js JS/CSS changes directly to the app without going through Google Play Store review.

---

## 10. Risk Assessment

*   **Highest Risk - The Chat Interface:** Chat interfaces are notoriously difficult in WebViews due to keyboard overlap. The keyboard will either push your header off the screen or hide the text input. You will spend 50% of your mobile optimization time tuning `@capacitor/keyboard` and CSS flexboxes to make the chat feel perfect.
*   **Highest Risk - Socket Desyncs:** Users locking their phones while in a chat will pause the WebView. Handling the reconnection sequence elegantly without showing duplicate messages or crashing is complex.
*   **Hidden Complexity - CORS:** The Android app will run under the `http://localhost` or `capacitor://localhost` origin natively. Your NestJS backend MUST be updated to accept CORS requests from these origins, otherwise all API calls will fail on device.

---

## 11. Final Recommendation

### Implementation Order
1.  **Immediate:** Add `output: 'export'` to Next.js. Fix the resulting build errors (specifically `next/image` optimization). Ensure the web app still works flawlessly.
2.  **Next:** Initialize Capacitor and add the Android platform. Run the app on a physical device using `npx cap run android -l --external`. 
3.  **Then:** Fix CORS on NestJS, implement the Hardware Back Button, and refactor File Downloads.
4.  **Delayed:** Do NOT worry about Push Notifications, offline mode, or iOS deployment until Android is stable, tested, and feeling native.

### What to Absolutely Avoid
Do not attempt to use `localStorage` for massive amounts of data (like caching thousands of chat messages). Android WebViews can arbitrarily clear `localStorage` if device memory gets low. Rely on SWR's in-memory cache for session speed, and refetch from the API on mount.
