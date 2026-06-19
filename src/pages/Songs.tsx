import { SetlistsTab } from './library/SetlistsTab';

export function Songs() {
  return (
    <div className="page-container page-bottom-pad overflow-hidden">
      <div className="mx-auto max-w-2xl space-y-5 px-4 pt-5 sm:px-6 sm:pt-6 lg:max-w-5xl lg:px-8 xl:max-w-7xl 2xl:max-w-[1680px]">
        <SetlistsTab fixedView="songs" />
      </div>
    </div>
  );
}
