import { SetlistsTab } from './library/SetlistsTab';

export function Songs() {
  return (
    <div className="page-container page-bottom-pad overflow-x-clip">
      <div className="app-content-shell space-y-5 pt-4 sm:pt-5">
        <SetlistsTab fixedView="songs" />
      </div>
    </div>
  );
}
