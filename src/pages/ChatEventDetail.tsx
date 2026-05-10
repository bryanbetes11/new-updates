import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, Music, ExternalLink, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PageLoader } from '../components/LoadingSpinner';
import { format, parseISO } from 'date-fns';
import { formatTime12Hour } from '../lib/timeFormat';

type Song = { id: string; title: string; artist: string | null; performed_key: string | null; song_key: string | null };

type EventData = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  event_type: string | null;
  description: string | null;
};

export function ChatEventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      const [{ data: eventData }, { data: setlistData }, { data: convData }] = await Promise.all([
        supabase.from('events').select('id, title, event_date, start_time, event_type, description').eq('id', id).maybeSingle(),
        supabase.from('setlists').select('id, setlist_songs(id, position, performed_key, songs(id, title, artist, song_key))').eq('event_id', id).maybeSingle(),
        supabase.from('conversations').select('id').eq('event_id', id).eq('type', 'event').maybeSingle(),
      ]);

      if (cancelled) return;

      setEvent(eventData as EventData | null);

      const rawSongs = ((setlistData as any)?.setlist_songs || [])
        .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
        .map((item: any) => ({
          id: item.songs?.id || item.id,
          title: item.songs?.title || 'Untitled',
          artist: item.songs?.artist || null,
          performed_key: item.performed_key || null,
          song_key: item.songs?.song_key || null,
        }));
      setSongs(rawSongs);
      setConversationId((convData as any)?.id || null);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <PageLoader />;
  if (!event) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-gray-400">
      <p>Event not found.</p>
      <button onClick={() => navigate(-1)} className="mt-3 text-emerald-500 text-sm">Go back</button>
    </div>
  );

  const displayKey = (song: Song) => song.performed_key || song.song_key || null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0f]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-white/80 dark:bg-[#0d0d0f]/80 backdrop-blur-md border-b border-gray-200/60 dark:border-white/[0.06]">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[14px] font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-[14px] font-bold text-gray-900 dark:text-white truncate max-w-[50%] text-center">Event Info</span>
        <button
          onClick={() => navigate(`/events/${event.id}`)}
          className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[13px] font-semibold shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Full Event
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Event info card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.06] overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.05]">
            <div className="flex items-start gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold text-gray-900 dark:text-white leading-tight">{event.title}</p>
                {event.event_type && (
                  <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                    {event.event_type}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-white/55">
              <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-white/25" />
              {format(parseISO(event.event_date), 'EEEE, MMMM d, yyyy')}
            </div>
            {event.start_time && (
              <div className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-white/55">
                <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-white/25" />
                {formatTime12Hour(event.start_time)}
              </div>
            )}
          </div>
          {event.description && (
            <div className="px-5 pb-4 text-[13px] text-gray-500 dark:text-white/40 leading-relaxed border-t border-gray-100 dark:border-white/[0.05] pt-3">
              {event.description}
            </div>
          )}
        </motion.div>

        {/* Setlist card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.06] overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.05]">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-emerald-500" />
              <span className="text-[14px] font-bold text-gray-900 dark:text-white">Setlist</span>
            </div>
            <span className="text-[12px] text-gray-400 dark:text-white/30">{songs.length} songs</span>
          </div>

          {songs.length === 0 ? (
            <div className="py-8 text-center">
              <Music className="h-8 w-8 text-gray-200 dark:text-white/10 mx-auto mb-2" />
              <p className="text-[13px] text-gray-400 dark:text-white/25">No setlist yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {songs.map((song, i) => (
                <div key={song.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-[12px] font-bold text-gray-300 dark:text-white/20 w-5 text-right shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">{song.title}</p>
                    {song.artist && (
                      <p className="text-[12px] text-gray-400 dark:text-white/30 truncate">{song.artist}</p>
                    )}
                  </div>
                  {displayKey(song) && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.06] text-[11px] font-bold text-gray-500 dark:text-white/40">
                      {displayKey(song)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Go to chat button */}
        {conversationId && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => navigate(`/messages/${conversationId}`)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-semibold transition-colors shadow-md shadow-emerald-500/20"
          >
            <MessageCircle className="h-4 w-4" />
            Open Group Chat
          </motion.button>
        )}
      </div>
    </div>
  );
}
