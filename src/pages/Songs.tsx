import { SetlistsTab } from './library/SetlistsTab';
import { DesktopPageHeading } from '../components/DesktopPageHeading';

export function Songs() {
  return (
    <div className="desktop-library-page page-container page-bottom-pad overflow-x-clip">
      <div className="app-content-shell space-y-5 pt-4 sm:pt-5">
        <DesktopPageHeading eyebrow="Ministry library" title="Songs" description="Find lyrics, chord charts, and songs used in worship sets." />
        <SetlistsTab fixedView="songs" />
      </div>
    </div>
  );
}
