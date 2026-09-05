import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ChartNavigationProps { disabled?: boolean; currentLabel: string; nextSongTitle?: string; canGoPrevious: boolean; canGoNext: boolean; onPrevious?: () => void; onNext?: () => void; }

export function ChartNavigation(footerNavigation: ChartNavigationProps) {
  return (<div
                className="service-mode-chart-footer flex flex-col gap-2 md:flex-row md:items-center md:gap-4"
                onPointerDown={event => event.stopPropagation()}
              >
                <div className="min-w-0 md:w-1/3">
                  <p className="text-[11px] font-bold text-gray-500 dark:text-white/50">{footerNavigation.currentLabel}</p>
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{footerNavigation.canGoNext ? `Next Song: ${footerNavigation.nextSongTitle || 'Untitled song'}` : 'End of setlist'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 md:flex-1">
                  <button
                    type="button"
                    onClick={footerNavigation.onPrevious}
                    disabled={footerNavigation.disabled || !footerNavigation.canGoPrevious}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-black/[0.07] bg-gray-100 px-4 text-sm font-black text-gray-700 shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:active:scale-100 dark:border-white/[0.08] dark:bg-white/[0.08] dark:text-white/70 dark:disabled:bg-white/[0.07] dark:disabled:text-white/35"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={footerNavigation.onNext}
                    disabled={footerNavigation.disabled || !footerNavigation.canGoNext}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow-lg shadow-emerald-600/25 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:active:scale-100 dark:disabled:bg-white/[0.07] dark:disabled:text-white/30"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>);
}
