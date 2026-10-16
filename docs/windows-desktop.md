# ServeSync for Windows

The Windows app uses Tauri 2 and bundles the existing Vite application. It connects to the same services as the website; installing it does not make shared data available offline. Desktop preferences and login storage are separate from the browser and Android app.

## Build prerequisites

Only the developer needs these tools:

1. Node.js/npm and the repository dependencies (`npm ci`).
2. Microsoft Visual Studio Build Tools with **Desktop development with C++**, including the MSVC compiler and Windows SDK.
3. Rust with the stable MSVC toolchain (`rustup default stable-msvc`).
4. Microsoft Edge WebView2 Runtime.

Official setup: https://tauri.app/start/prerequisites/

Restart the terminal after installing Rust so `cargo` is on PATH. Use `npm run desktop:info` to verify the environment. The existing Vite environment must provide its public backend configuration. Never put service-role keys or signing secrets in the frontend.

## Commands

Run from the repository root:

```powershell
npm run desktop:dev
npm run desktop:test
npm run desktop:build
```

Development uses `127.0.0.1:5175`, leaving the normal website preview on port 5174. Release builds first run the website production build and then bundle its files; no hosted page or development server is needed to open the app shell.

The installer is generated in `src-tauri/target/release/bundle/nsis/`. The desktop version is set in `src-tauri/tauri.conf.json`; keep the Cargo package version aligned. This is independent of Android and the website version. Commit the Cargo lockfile with intentional dependency updates.

## Installation and updates

- The NSIS `.exe` installs for the current Windows user with normal Windows uninstall support. It can download/install WebView2 when missing; that step requires internet and can require Windows approval.
- Users do not need Node, Rust, Visual Studio, or a separate browser tab.
- Version 1.4.19 adds automatic checks after startup and every four hours while visible/online. Installation happens only after the user clicks **Install and restart**. Save work first. The initial 1.4.18 build needs one manual installer upgrade. The website service worker is disabled inside Tauri, so website updates cannot replace bundled app files.
- This is a publicly distributed Windows preview with updater signatures. Windows publisher/Authenticode signing is not configured; updater signatures do not supply a verified Windows publisher identity.
- Password-reset links continue to use the existing hosted reset page. Windows deep-link handoff is not included.
- Windows alerts use the native notification plugin, enabled per account and church on this PC. A Test notification button checks local delivery. Alerts require the app to remain open or minimized, and Windows notification settings / Do not disturb can suppress them. No tray or closed-app delivery is implemented. Existing server push-channel rules remain respected.
- A separate caption webview supplies the theme-matched title bar. Its permissions are restricted to window controls. Scrollbar tracks are hidden only inside the desktop application; scrolling is preserved.

## Desktop boundaries

- Web routes remain inside the app. External HTTP(S), email, and telephone links are sent to their default applications; file and arbitrary custom-protocol links are denied.
- Remote pages cannot replace the main app window. Remote content receives no native capabilities. The bundled main view can check/install signed updates, restart, read its version, and request/show notifications. The caption view can only control the window. Neither view can access arbitrary filesystem or shell commands.
- A desktop content security policy limits scripts to bundled code, while permitting the existing HTTPS content, fonts, media, and secure service connections.
- WebView2 file inputs and downloads are used; native drag/drop interception is disabled to preserve the website's HTML drop behavior.

## Acceptance checks before public distribution

1. Install on a clean supported Windows x64 PC, launch, uninstall, and reinstall/upgrade.
2. Sign in with an authorized test account; verify sign-out, restart/session recovery, church boundaries, and password recovery through the website.
3. Check schedules, chat, setlists, images, uploads, file downloads, clipboard, and external links. Avoid sending test messages to real members.
4. Check disconnected startup and reconnect behavior, window resize, and the installed-app update message.
5. Verify executable/installer version and signatures after signing is configured. Confirm public download hashes only after publishing is authorized.

Build success alone does not prove these runtime checks. See the dated `work/PROGRESS.md` entry for actual results and outstanding checks.

## Signed update packaging

`npm run desktop:build` reads the updater key from `~/.tauri/servesync-windows/updater.key` (or `TAURI_SIGNING_PRIVATE_KEY`), builds the NSIS installer, and prepares installer, signature, `latest.json`, and SHA256 in `output/windows/<version>/`. Keep the private key outside Git, backed up securely; future upgrades must use the same key. Updater signatures are separate from Windows publisher/Authenticode signing.

The configured feed is the `latest.json` asset of the `windows-updates` GitHub release in this repository. No build command publishes it. Until publication is explicitly authorized and completed, checks report that the feed cannot be reached. Publish versioned installer and signature assets before the manifest; retain old installer assets for clients that already read an older manifest.

Validate prepared files with `cargo run --release --manifest-path src-tauri/Cargo.toml --example verify_update -- output/windows/1.4.19/latest.json`. This verifies the actual signature, its version binding, and rejection of modified bytes; it does not replace an end-to-end installed-app upgrade test.

## Published Windows preview

Windows 1.4.19 was published on 2026-10-10 (Asia/Manila) at https://github.com/bryanbetes11/new-updates/releases/tag/windows-updates as a prerelease, without changing the repository main branch. The public installer is 11,735,687 bytes with SHA256 `a38f585509a093b47f5b29cc9c3d42baac0e44df3852869353af1fcf64d44f83`. Installer, `.sig`, `latest.json`, and hash file were downloaded anonymously and matched the local artifacts. The downloaded installer passed signature/version verification and tampered-byte rejection. The installed 1.4.19 app read the live feed and displayed that it is up to date. A future-version automatic download/install/restart still needs end-to-end runtime verification.

On 2026-10-10, Windows 1.4.20 was published to the same feed as a version-only verification release with the same features as 1.4.19. Its installer is 11,735,675 bytes with SHA256 `b8ebd70ccb008b7f0e47e17aec8c485f47af41d81801d0d2da1b462ddec5d4f9`. The anonymous public feed and installer passed signature, signed-version, tampered-byte rejection, and hash checks. Bryan's normal installation at `C:/Users/Bryan/AppData/Local/ServeSync/servesync-desktop.exe` remained on 1.4.19; clicking **Check for Updates** displayed **ServeSync 1.4.20 is available** and **Install and Restart**. The actual detection screenshot and text are saved in `output/windows/1.4.20/`. Installation/restart and the scheduled four-hour check were not exercised in this detection test. Previous versioned assets remain available.
