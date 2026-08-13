import { SetlistsTab } from './library/SetlistsTab';

export function Sets() {
  return (
    <div className="page-container page-bottom-pad overflow-x-clip bg-[#050505] text-white">
      <div className="app-content-shell space-y-5 pt-4 sm:pt-5">
        <SetlistsTab fixedView="setlists" />
      </div>
    </div>
  );
}
