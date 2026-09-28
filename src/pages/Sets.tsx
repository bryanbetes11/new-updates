import { SetlistsTab } from './library/SetlistsTab';
import { DesktopPageHeading } from '../components/DesktopPageHeading';

export function Sets() {
  return (
    <div className="desktop-library-page theme-adaptive-page page-container page-bottom-pad overflow-x-clip bg-[#f6f8fb] text-slate-900 dark:bg-[#050505] dark:text-white">
      <div className="app-content-shell space-y-5 pt-4 sm:pt-5">
        <DesktopPageHeading eyebrow="Ministry library" title="Setlists" description="Browse approved worship sets and their songs." />
        <SetlistsTab fixedView="setlists" />
      </div>
    </div>
  );
}
