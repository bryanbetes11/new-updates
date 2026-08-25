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
    const isShallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() === 'true';

    if (!isShallow) {
      const commitCount = Number.parseInt(execFileSync('git', ['rev-list', '--count', 'HEAD'], {
        cwd: __dirname,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim(), 10);
      if (commitCount > 0) return commitCount;
    }

    // Deployment providers commonly use shallow clones, where rev-list can
    // return the same count for every build. The commit timestamp remains
    // available and changes monotonically with normal main-branch releases.
    return Number.parseInt(execFileSync('git', ['show', '-s', '--format=%ct', 'HEAD'], {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function humanizeReleaseHighlight(subject: string) {
  const cleaned = subject
    .replace(/^(feat|fix|refactor|perf|style|chore)(\([^)]*\))?!?:\s*/i, '')
    .trim()
    .replace(/[.!?]+$/, '');
  return cleaned ? `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}.` : '';
}

function getGitReleaseHighlight() {
  try {
    const subject = execFileSync('git', ['show', '-s', '--format=%s', 'HEAD'], {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return humanizeReleaseHighlight(subject);
  } catch {
    return '';
  }
}

const appBuildId = (
  process.env.SERVESYNC_BUILD_ID
  || process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.COMMIT_REF
  || getGitBuildId()
).slice(0, 12);
const appPublishedAt = process.env.SERVESYNC_PUBLISHED_AT || new Date().toISOString();
const appBuildNumber = Number.parseInt(process.env.SERVESYNC_BUILD_NUMBER || '', 10)
  || getGitBuildNumber()
  || Math.floor(new Date(appPublishedAt).getTime() / 1000);
const minimumSupportedVersion = process.env.SERVESYNC_MINIMUM_VERSION || '0.0.0';
const latestReleaseHighlight = humanizeReleaseHighlight(
  process.env.SERVESYNC_RELEASE_HIGHLIGHT
  || process.env.VERCEL_GIT_COMMIT_MESSAGE
  || process.env.COMMIT_MESSAGE
  || getGitReleaseHighlight(),
);
const appReleaseHighlights = [latestReleaseHighlight, ...releaseNotes.highlights]
  .filter((item, index, items) => item && items.indexOf(item) === index)
  .slice(0, 6);

const versionManifest = {
  version: appVersion,
  buildId: appBuildId,
  buildNumber: appBuildNumber,
  cacheVersion: `${appVersion}-${appBuildId}`,
  publishedAt: appPublishedAt,
  minimumSupportedVersion,
  releaseHeadline: releaseNotes.headline,
  releaseHighlights: appReleaseHighlights,
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
    __APP_RELEASE_HIGHLIGHTS__: JSON.stringify(appReleaseHighlights),
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
