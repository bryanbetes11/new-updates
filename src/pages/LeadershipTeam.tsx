import { ClipboardCheck, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LeadershipHeroCard } from '../components/LeadershipHeroCard';
import { Accountability } from './Accountability';
import { TeamManage } from './TeamManage';

type TeamWorkspaceView = 'roster' | 'accountability';

export function LeadershipTeam() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const activeView: TeamWorkspaceView = params.get('section') === 'roster' || params.has('search')
    ? 'roster'
    : 'accountability';

  const selectView = (view: TeamWorkspaceView) => {
    if (view === 'roster') {
      navigate('/leadership/team?section=roster');
      return;
    }
    navigate('/leadership/team?section=accountability&tab=attendance');
  };

  return (
    <div className="page-container page-bottom-pad">
      <div className="app-content-shell relative pb-6 pt-4 sm:pt-5">
        <div className="space-y-5 sm:space-y-6">
          <LeadershipHeroCard
            tone="emerald"
            icon={Users}
            eyebrow="People & Care"
            title="Team"
            description="Manage the roster, ministry access, attendance follow-up, and conduct records from one leadership workspace."
          />

          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-gray-200 bg-gray-100/80 p-1 dark:border-white/[0.08] dark:bg-white/[0.035]" role="tablist" aria-label="Team workspace views">
            {([
              { id: 'accountability' as const, label: 'Accountability', icon: ClipboardCheck },
              { id: 'roster' as const, label: 'Roster', icon: Users },
            ]).map(({ id, label, icon: Icon }) => {
              const isActive = activeView === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => selectView(id)}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-all ${isActive ? 'bg-white text-gray-900 shadow-sm dark:bg-white/[0.08] dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-white/45 dark:hover:text-white/75'}`}
                >
                  <Icon className={`h-4 w-4 ${id === 'roster' ? 'text-emerald-500' : 'text-amber-500'}`} />
                  {label}
                </button>
              );
            })}
          </div>

          {activeView === 'roster' ? <TeamManage embedded /> : <Accountability embedded />}
        </div>
      </div>
    </div>
  );
}
