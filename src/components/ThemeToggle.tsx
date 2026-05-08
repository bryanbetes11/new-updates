import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-all duration-200"
      aria-label="Toggle theme"
    >
      <div className="relative h-5 w-5">
        <Sun className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${theme === 'dark' ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`} />
        <Moon className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`} />
      </div>
    </button>
  );
}
