import { VideosTab } from './library/VideosTab';

export function Videos() {
  return (
    <div className="page-container page-bottom-pad overflow-x-clip bg-[#050505] text-white">
      <div className="mx-auto max-w-2xl space-y-5 px-4 pt-4 sm:max-w-3xl sm:px-6 sm:pt-6 lg:max-w-5xl lg:px-8 xl:max-w-7xl 2xl:max-w-[1680px]">
        <VideosTab />
      </div>
    </div>
  );
}
