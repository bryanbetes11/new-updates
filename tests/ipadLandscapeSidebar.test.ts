import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const layout = readFileSync(resolve(process.cwd(), 'src/components/Layout.tsx'), 'utf8');
const navigation = readFileSync(resolve(process.cwd(), 'src/components/Navigation.tsx'), 'utf8');

assert.match(layout, /collapsed \? 72 : 300/, 'the compact layout should reserve only 72px for the sidebar rail');
assert.match(navigation, /sidebarWidth = collapsed \? 72 : 300/, 'the rendered compact sidebar should match the 72px shell offset');
assert.match(navigation, /mx-auto flex h-11 w-11/, 'collapsed navigation highlights should be centered squares rather than full-width rows');
assert.match(navigation, /h-8 w-8 items-center justify-center overflow-visible/, 'collapsed badge anchors should remain visible outside the icon artwork');

assert.match(
  layout,
  /orientation: landscape/,
  'the compact sidebar breakpoint should require landscape orientation',
);
assert.match(
  layout,
  /dataset\.ipadLayout === "true"/,
  'the compact sidebar mode should be limited to iPad landscape layouts',
);
assert.match(
  layout,
  /setCollapsed\(nextValue\)/,
  'the sidebar should start collapsed when iPad landscape mode activates',
);
assert.match(
  layout,
  /collapseAfterNavigate=\{isIpadLandscapeSidebar\}/,
  'iPad landscape should ask navigation to collapse after choosing a destination',
);
assert.match(
  layout,
  /onClickCapture=\{\(\) => \{[\s\S]*?isIpadLandscapeSidebar && !collapsed[\s\S]*?setCollapsed\(true\)/,
  'tapping the main content should collapse an expanded iPad landscape sidebar',
);
assert.match(
  navigation,
  /if \(collapseAfterNavigate\) onCollapsedChange\(true\)/,
  'desktop navigation should collapse after route selection when tablet mode requests it',
);
assert.match(
  navigation,
  /onClickCapture=\{\(event\) => \{[\s\S]*?if \(!collapsed\) return;[\s\S]*?event\.stopPropagation\(\)[\s\S]*?onCollapsedChange\(false\)/,
  'the first tap on any collapsed desktop rail should expand it without selecting a destination',
);
assert.doesNotMatch(
  navigation,
  /if \(!collapseAfterNavigate \|\| !collapsed\) return;/,
  'expand-only first taps should not be limited to iPad mode',
);
