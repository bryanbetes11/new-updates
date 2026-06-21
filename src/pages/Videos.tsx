import { VideosTab } from './library/VideosTab';

export function Videos() {
  return (
    <div className="page-container page-bottom-pad overflow-hidden bg-[#050505] text-white">
      <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">
        <VideosTab />
      </div>
    </div>
  );
}
