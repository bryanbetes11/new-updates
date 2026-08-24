import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string };
const releaseNotes = JSON.parse(readFileSync(path.resolve(__dirname, 'release-notes.json'), 'utf8')) as {
  headline: string;
  highlights: string[];
};
const appVersion = packageJson.version;

function getGitBuildId() {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'local';
  }
}

function getGitBuildNumber() {
  try {
    return Number.parseInt(execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim(), 10) || 0;
  } catch {
    return 0;
  }
}

const appBuildId = (
  process.env.SERVESYNC_BUILD_ID
  || process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.COMMIT_REF
  || getGitBuildId()
).slice(0, 12);
const appBuildNumber = Number.parseInt(process.env.SERVESYNC_BUILD_NUMBER || '', 10) || getGitBuildNumber();
const appPublishedAt = process.env.SERVESYNC_PUBLISHED_AT || new Date().toISOString();
const minimumSupportedVersion = process.env.SERVESYNC_MINIMUM_VERSION || '0.0.0';

const versionManifest = {
  version: appVersion,
  buildId: appBuildId,
  buildNumber: appBuildNumber,
  cacheVersion: `${appVersion}-${appBuildId}`,
  publishedAt: appPublishedAt,
  minimumSupportedVersion,
  releaseHeadline: releaseNotes.headline,
  releaseHighlights: releaseNotes.highlights.slice(0, 3),
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'servesync-version-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: `${JSON.stringify(versionManifest, null, 2)}\n`,
        });
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
    __APP_BUILD_NUMBER__: JSON.stringify(appBuildNumber),
    __APP_PUBLISHED_AT__: JSON.stringify(appPublishedAt),
    __APP_MINIMUM_SUPPORTED_VERSION__: JSON.stringify(minimumSupportedVersion),
    __APP_RELEASE_HEADLINE__: JSON.stringify(releaseNotes.headline),
    __APP_RELEASE_HIGHLIGHTS__: JSON.stringify(releaseNotes.highlights.slice(0, 3)),
  },
  resolve: {
    alias: [
      {
        find: /^lucide-react$/,
        replacement: path.resolve(__dirname, 'src/lib/lucide-react-proxy.ts'),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-motion': ['framer-motion'],
          'vendor-dates': ['date-fns', 'date-fns-tz'],
          'vendor-chords': ['chordsheetjs'],
        },
      },
    },
  },
});
