import { VideosTab } from './library/VideosTab';

export function Videos() {
  return (
    <div className="page-container page-bottom-pad overflow-x-clip bg-[#050505] text-white">
      <div className="app-content-shell space-y-5 pt-4 sm:pt-5">
        <VideosTab />
      </div>
    </div>
  );
}
