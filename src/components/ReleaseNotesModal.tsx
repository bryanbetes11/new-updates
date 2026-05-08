import { useState } from 'react';
import { Sparkles, Bell, UserX, Circle, ChevronLeft, ChevronRight, Timer } from 'lucide-react';
import { Modal } from './Modal';

interface ReleaseNotesModalProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  {
    icon: Timer,
    iconColor: 'text-brand-600 dark:text-brand-400',
    iconBg: 'bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-900/40 dark:to-brand-800/40',
    title: 'Live Attendance Countdown',
    description: 'See a beautiful animated countdown timer showing exactly when attendance opens. Watch hours, minutes, and seconds tick down in real-time!',
    highlight: (
      <div className="space-y-3">
        <div className="p-4 bg-gradient-to-r from-brand-50 to-emerald-50 dark:from-brand-950/50 dark:to-emerald-950/50 rounded-lg border-2 border-brand-300 dark:border-brand-700 shadow-sm">
          <div className="flex items-center justify-center gap-2">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-md">
                <span className="text-sm font-bold text-white">02</span>
              </div>
              <span className="text-[8px] text-gray-500 dark:text-gray-400 mt-1 uppercase">Hours</span>
            </div>
            <div className="flex flex-col gap-1 pb-4">
              <div className="w-1 h-1 rounded-full bg-brand-400"></div>
              <div className="w-1 h-1 rounded-full bg-brand-400"></div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-md">
                <span className="text-sm font-bold text-white">45</span>
              </div>
              <span className="text-[8px] text-gray-500 dark:text-gray-400 mt-1 uppercase">Minutes</span>
            </div>
            <div className="flex flex-col gap-1 pb-4">
              <div className="w-1 h-1 rounded-full bg-brand-400"></div>
              <div className="w-1 h-1 rounded-full bg-brand-400"></div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-md">
                <span className="text-sm font-bold text-white">30</span>
              </div>
              <span className="text-[8px] text-gray-500 dark:text-gray-400 mt-1 uppercase">Seconds</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
          Attendance opens 30 minutes before each event
        </div>
      </div>
    ),
  },
  {
    icon: Bell,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/40',
    title: 'Smart Due Date Reminders',
    description: 'Get timely notifications for event proposals - on the due date, 3 days before, and when deadlines approach. Never miss a deadline!',
    highlight: (
      <div className="space-y-2">
        <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 rounded-lg border-2 border-amber-300 dark:border-amber-700 shadow-sm">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Proposal Deadline Approaching</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Sunday Service proposal due in 3 days</p>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
          Reminders sent on-time, 3 days before, and as deadlines approach
        </div>
      </div>
    ),
  },
  {
    icon: UserX,
    iconColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-900/40 dark:to-rose-800/40',
    title: 'Unavailable Members Tracking',
    description: 'See who is unavailable in both list view and calendar view. Plus a new dashboard card shows all unavailable members at a glance.',
    highlight: (
      <div className="space-y-2">
        <div className="p-3 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/50 dark:to-pink-950/50 rounded-lg border-2 border-rose-300 dark:border-rose-700 shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <span className="text-xs font-semibold text-gray-900 dark:text-white">Unavailable Members</span>
            </div>
            <div className="flex items-center gap-2 pl-6">
              <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              <div className="text-xs text-gray-700 dark:text-gray-300">John - March 10</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
          Available on dashboard, list view, and calendar
        </div>
      </div>
    ),
  },
  {
    icon: Circle,
    iconColor: 'text-gray-600 dark:text-gray-400',
    iconBg: 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900/40 dark:to-gray-800/40',
    title: 'Status Indicator Colors Explained',
    description: 'Color-coded dots help you quickly understand assignment and availability status at a glance.',
    highlight: (
      <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Green</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Setlist has been approved and ready</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-amber-500"></div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Orange</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Setlist is almost due</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-rose-500"></div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Red</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Setlist is already overdue</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export function ReleaseNotesModal({ open, onClose }: ReleaseNotesModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < features.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentFeature = features[currentIndex];
  const Icon = currentFeature.icon;

  return (
    <Modal open={open} onClose={onClose} title="" size="lg" hideHeader>
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-3 px-2">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 rounded-full blur-lg opacity-50 animate-pulse"></div>
            <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white animate-pulse" />
            </div>
          </div>
          <div className="text-left">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
              What's New & Exciting!
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Check out these awesome new features
            </p>
          </div>
        </div>

        <div className="relative">
          <div
            key={currentIndex}
            className="animate-slide-up"
          >
            <div className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800/50">
              <div className="text-center mb-3">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
                  {currentFeature.title}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 max-w-sm mx-auto mb-3">
                  {currentFeature.description}
                </p>
              </div>

              {currentFeature.highlight}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-3">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1 ${
              currentIndex === 0
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <ChevronLeft className="h-3 w-3" />
            Previous
          </button>

          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {currentIndex + 1} / {features.length}
          </div>

          <button
            onClick={currentIndex === features.length - 1 ? onClose : handleNext}
            className="px-3 py-1.5 rounded-lg font-medium text-xs bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700 transition-all flex items-center gap-1 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            {currentIndex === features.length - 1 ? 'Got it!' : 'Next'}
            {currentIndex < features.length - 1 && <ChevronRight className="h-3 w-3" />}
          </button>
        </div>

      </div>
    </Modal>
  );
}
