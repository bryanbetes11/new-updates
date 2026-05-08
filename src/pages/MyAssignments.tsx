import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isAfter, parseISO, startOfToday } from 'date-fns';
import { Music, AlertCircle, CheckCircle, Clock, Calendar, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PageLoader } from '../components/LoadingSpinner';
import { formatTime12Hour } from '../lib/timeFormat';
import type { EventAssignment } from '../types';

export function MyAssignments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'pending' | 'declined'>(
    (searchParams.get('status') as any) || 'all'
  );

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const today = startOfToday().toISOString().split('T')[0];

      const { data } = await supabase
        .from('event_assignments')
        .select('*, events(*), roles(*)')
        .eq('user_id', user.id)
        .gte('events.event_date', today)
        .order('created_at', { ascending: false });

      const assignmentsList = (data || []) as EventAssignment[];
      // Filter upcoming assignments and sort by event date
      const upcomingAssignments = assignmentsList.filter(a =>
        a.events && isAfter(parseISO(a.events.event_date), startOfToday())
      );
      upcomingAssignments.sort((a, b) =>
        parseISO(a.events!.event_date).getTime() - parseISO(b.events!.event_date).getTime()
      );

      setAssignments(upcomingAssignments);
      setLoading(false);
    };

    load();
  }, [user]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status && ['all', 'confirmed', 'pending', 'declined'].includes(status)) {
      setFilter(status as any);
    }
  }, [searchParams]);

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    if (newFilter === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ status: newFilter });
    }
  };

  const filteredAssignments = filter === 'all'
    ? assignments
    : assignments.filter(a => a.status === filter);

  if (loading) return <PageLoader />;

  const stats = {
    total: assignments.length,
    confirmed: assignments.filter(a => a.status === 'confirmed').length,
    pending: assignments.filter(a => a.status === 'pending').length,
    declined: assignments.filter(a => a.status === 'declined').length,
  };

  return (
    <div className="page-container page-bottom-pad">
      <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-5">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              My Assignments
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              View and manage your upcoming event assignments
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 animate-slide-up">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => handleFilterChange('confirmed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
              filter === 'confirmed'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Confirmed ({stats.confirmed})
          </button>
          <button
            onClick={() => handleFilterChange('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
              filter === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Pending ({stats.pending})
          </button>
          {stats.declined > 0 && (
            <button
              onClick={() => handleFilterChange('declined')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                filter === 'declined'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <X className="h-3.5 w-3.5" />
              Declined ({stats.declined})
            </button>
          )}
        </div>

        {/* Assignments List */}
        <div className="card animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <Music className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {filter === 'all' ? 'All Assignments' :
               filter === 'confirmed' ? 'Confirmed Assignments' :
               filter === 'pending' ? 'Pending Assignments' : 'Declined Assignments'}
            </h2>
            <span className="badge-gray ml-auto">{filteredAssignments.length}</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredAssignments.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Music className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No {filter !== 'all' ? filter : ''} assignments found
                </p>
              </div>
            ) : (
              filteredAssignments.map(a => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/events/${a.event_id}`)}
                  className="flex items-start gap-4 px-5 py-4 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center h-14 w-14 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 shrink-0">
                    <span className="text-xs font-medium leading-none">
                      {a.events?.event_date && format(parseISO(a.events.event_date), 'MMM')}
                    </span>
                    <span className="text-xl font-bold leading-none mt-0.5">
                      {a.events?.event_date && format(parseISO(a.events.event_date), 'd')}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {a.events?.title}
                      </p>
                      {a.status !== 'confirmed' && (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-0.5">
                      {a.roles?.name}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {a.events?.event_date && format(parseISO(a.events.event_date), 'EEEE, MMM d, yyyy')}
                      </span>
                      {a.events?.start_time && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime12Hour(a.events.start_time)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        {a.events?.event_type}
                      </span>
                    </div>

                    {a.status === 'declined' && a.decline_reason && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2 italic">
                        Reason: {a.decline_reason}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    <span className={`badge ${
                      a.status === 'confirmed' ? 'badge-green' :
                      a.status === 'declined' ? 'badge-red' : 'badge-yellow'
                    }`}>
                      {a.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
