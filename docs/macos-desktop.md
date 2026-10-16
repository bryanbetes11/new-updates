# ServeSync personal Mac build

The first Mac installer targets Apple M-series Macs (`aarch64-apple-darwin`), macOS 12 or newer. It bundles the website, uses standard Mac window controls and the ServeSync `.icns` icon, and keeps browser service-worker updates disabled inside the desktop app. Mac and Windows share the desktop version, currently 1.4.21; the website/Android versions are independent.

This is an ad-hoc signed personal test build without Apple Developer ID signing or notarization. macOS may block the first launch. Review the app under System Settings > Privacy & Security; only approve opening if you trust the build. Do not disable Gatekeeper or other security protections.

## Build on a Mac

1. Install Node.js 22, Rust 1.90 or newer, and Xcode Command Line Tools (`xcode-select --install`).
2. Install the Apple Silicon Rust target: `rustup target add aarch64-apple-darwin`.
3. Run `npm ci` in this repository. Configure the existing public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a local `.env` or build environment. Never supply a service-role/secret key.
4. Run `npm run desktop:build:mac`.
5. Find the installer, checksum, installation instructions, and verification report in `output/macos/<version>/`.

`tauri.macos.conf.json` is automatically merged by Tauri on Mac. It selects DMG packaging, the Mac icon, an ad-hoc signing identity, and disables updater archives. No Windows signing private key is needed.

The build script checks the app version, arm64 architecture, signature integrity, icon, disk-image integrity, the actual mounted app executable, and the Applications shortcut. These checks do not prove installation, login, notifications, or other runtime behavior on a physical Mac.

## Prepared GitHub build

`.github/workflows/macos-test-build.yml` builds on `macos-15` when the `desktop/macos-dmg-test` branch is pushed. It requires the two existing public client values as repository secrets. It saves the verified installer as a GitHub Actions artifact for 14 days; it does not publish a release or update the Windows feed. GitHub source upload and build execution require Bryan's approval before being performed.

After an authorized run succeeds, download `ServeSync-Mac-Apple-Silicon` from its Actions run, extract the archive, and open the DMG. Drag ServeSync into Applications, then launch it from Applications. End users need none of the development tools above.

## Updates and notifications

This first personal Mac build upgrades manually: download a newer DMG, quit ServeSync, and replace the application in Applications. The Mac UI does not request the Windows update feed, and Mac capabilities do not grant updater/install access. Signed automatic Mac updates can be added in a later release with a dedicated Mac feed and update packages.

Native notifications reuse the existing account/church-scoped desktop delivery. macOS permission, notification settings, and Focus determine presentation; delivery requires ServeSync to stay open or minimized. Test actual delivery on Bryan's Mac before calling it verified.

## Current verification state

See `work/PROGRESS.md` for actual checks. No DMG or Mac runtime result exists until the Apple-host build has succeeded. Do not rename a Windows installer or a ZIP to `.dmg`.
