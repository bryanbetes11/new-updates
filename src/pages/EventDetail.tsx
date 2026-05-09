import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInDays, startOfDay, subWeeks, previousSunday, addDays, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, Users, Plus, Check, X, Music, Send, ThumbsUp, AlertCircle, Trash2, CheckCircle, AlertTriangle, CreditCard as Edit, ClipboardCheck, Timer, Sparkles, ChevronDown, ChevronUp, ChevronRight, LayoutPanelLeft, ListMusic, Search, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { PageLoader } from '../components/LoadingSpinner';
import { RoleBadge } from '../components/RoleBadge';
import { formatTime12Hour } from '../lib/timeFormat';
import { Avatar } from '../components/Avatar';
import { dispatchBadgeCountsRefresh } from '../lib/realtimeSignals';

import type { Event, EventAssignment, Setlist, SetlistSong, Song, SetlistCheckerSong, ServiceFormat } from '../types';
import { SetlistChecker } from '../components/SetlistChecker';
import { LiveSetlistGuidance } from '../components/LiveSetlistGuidance';
import { inferServiceFormat, SERVICE_FORMAT_LABELS, type CheckerSong } from '../lib/setlistCheckerEngine';

interface EventAttendance {
  id: string;
  event_id: string;
  user_id: string;
  status: 'present' | 'late' | 'absent';
  checked_in_at: string | null;
  is_assigned: boolean;
  profiles?: { first_name: string; last_name: string; avatar_url: string | null };
}

const MANILA_TIMEZONE = 'Asia/Manila';

function getManilaTodayKey(date = new Date()) {
  return formatInTimeZone(date, MANILA_TIMEZONE, 'yyyy-MM-dd');
}

function getManilaEventDateTime(eventDate: string, timeValue: string) {
  return new Date(`${eventDate}T${timeValue}+08:00`);
}

export function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user, roles, userRoles, isLeader, isProductionDirector } = useAuth();
  const { toast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [members, setMembers] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [memberRoles, setMemberRoles] = useState<{ user_id: string; role_id: string }[]>([]);
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [setlistSongs, setSetlistSongs] = useState<SetlistSong[]>([]);
  const [linkedSetlist, setLinkedSetlist] = useState<Setlist | null>(null);
  const [linkedSetlistSongs, setLinkedSetlistSongs] = useState<SetlistSong[]>([]);
  const [linkedServiceEvent, setLinkedServiceEvent] = useState<Event | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [showSetlist, setShowSetlist] = useState(false);
  const [songSearch, setSongSearch] = useState('');
  const [showAddSong, setShowAddSong] = useState(false);
  const [showSongConfig, setShowSongConfig] = useState(false);
  const [selectedSongForConfig, setSelectedSongForConfig] = useState<string | null>(null);
  const [songConfig, setSongConfig] = useState({ category: '', youtube_url: '', performed_key: '' });
  const [assignForm, setAssignForm] = useState({ user_id: '', role_id: '' });
  const [newSong, setNewSong] = useState({ title: '', artist: '', song_key: '', duration: '', youtube_url: '' });
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState<string | null>(null);
  const [showDeleteEvent, setShowDeleteEvent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRevisionRequest, setShowRevisionRequest] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editSongForm, setEditSongForm] = useState({ category: '', youtube_url: '', performed_key: '' });
  const [songUsage, setSongUsage] = useState<Record<string, { lastDate: string; days: number }>>({});
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', event_type: '', event_date: '', start_time: '', end_time: '', song_leader_id: '', linked_event_id: '' });
  const [sundayServices, setSundayServices] = useState<Event[]>([]);
  const [attendance, setAttendance] = useState<EventAttendance | null>(null);
  const [allAttendance, setAllAttendance] = useState<EventAttendance[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [showChecker, setShowChecker] = useState(false);
  const [countdownParts, setCountdownParts] = useState<{ hours: number; minutes: number; seconds: number }>({ hours: 0, minutes: 0, seconds: 0 });
  const [serviceFormat, setServiceFormat] = useState<ServiceFormat | null>(null);
  const [setlistTab, setSetlistTab] = useState<'songs' | 'guidance' | 'notes'>('songs');
  const [guidanceLanguage, setGuidanceLanguage] = useState<'english' | 'tagalog_english'>('english');
  const [isReordering, setIsReordering] = useState(false);
  const [reorderSongs, setReorderSongs] = useState<SetlistSong[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);


  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      const [eventRes, assignRes, membersRes, memberRolesRes, setlistRes, songsRes, allSetlistsRes, sundayServicesRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).maybeSingle(),
        supabase.from('event_assignments').select('*, profiles(first_name, last_name, avatar_url), roles(name)').eq('event_id', id),
        supabase.from('profiles').select('id, first_name, last_name'),
        supabase.from('user_roles').select('user_id, role_id'),
        supabase.from('setlists').select('*, setlist_songs(*, songs(*))').eq('event_id', id).maybeSingle(),
        supabase.from('songs').select('*').order('title'),
        supabase.from('setlists').select('id, status, event_id, events(event_date), setlist_songs(song_id)').eq('status', 'approved'),
        supabase.from('events').select('*').eq('event_type', 'Sunday Service').gte('event_date', new Date().toISOString().split('T')[0]).order('event_date'),
      ]);
      setEvent(eventRes.data);
      setAssignments(assignRes.data || []);
      setMembers(membersRes.data || []);
      setMemberRoles(memberRolesRes.data || []);
      if (setlistRes.data) {
        setSetlist(setlistRes.data);
        setSetlistSongs(setlistRes.data.setlist_songs || []);
      } else {
        setSetlist(null);
        setSetlistSongs([]);
      }
      setLinkedSetlist(null);
      setLinkedSetlistSongs([]);
      setLinkedServiceEvent(null);

      if (eventRes.data?.event_type === 'Rehearsals' && eventRes.data.linked_event_id) {
        const [linkedEventRes, linkedSetlistRes] = await Promise.all([
          supabase.from('events').select('*').eq('id', eventRes.data.linked_event_id).maybeSingle(),
          supabase.from('setlists').select('*').eq('event_id', eventRes.data.linked_event_id).maybeSingle(),
        ]);
        setLinkedServiceEvent(linkedEventRes.data || null);
        if (linkedSetlistRes.data) {
          setLinkedSetlist(linkedSetlistRes.data);
          const { data: linkedSongsData } = await supabase
            .from('setlist_songs')
            .select('*, songs(*)')
            .eq('setlist_id', linkedSetlistRes.data.id)
            .order('position');
          setLinkedSetlistSongs((linkedSongsData || []) as SetlistSong[]);
        }
      }
      setSongs(songsRes.data || []);
      setSundayServices(sundayServicesRes.data || []);

      const usage: Record<string, { lastDate: string; days: number }> = {};
      (allSetlistsRes.data || []).forEach((sl: any) => {
        if (sl.event_id === id) return;
        const eventDate = sl.events?.event_date;
        if (!eventDate) return;
        (sl.setlist_songs || []).forEach((ss: any) => {
          if (!usage[ss.song_id] || eventDate > usage[ss.song_id].lastDate) {
            usage[ss.song_id] = { lastDate: eventDate, days: differenceInDays(new Date(), parseISO(eventDate)) };
          }
        });
      });
      setSongUsage(usage);

      if (setlistRes.data?.service_format) {
        setServiceFormat(setlistRes.data.service_format as ServiceFormat);
      } else if (eventRes.data?.event_type) {
        setServiceFormat(inferServiceFormat(eventRes.data.event_type));
      }
    } catch (error) {
      console.error('Failed to load event detail', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchAttendance = useCallback(async () => {
    if (!id || !user) return;
    const [myAttRes, allAttRes] = await Promise.all([
      supabase.from('event_attendance').select('*').eq('event_id', id).eq('user_id', user.id).maybeSingle(),
      isLeader
        ? supabase.from('event_attendance').select('*, profiles(first_name, last_name, avatar_url)').eq('event_id', id)
        : Promise.resolve({ data: [] }),
    ]);
    setAttendance(myAttRes.data);
    setAllAttendance(allAttRes.data || []);
  }, [id, user, isLeader]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const getAttendanceStatus = useCallback(() => {
    if (!event) return { canMark: false, reason: 'No event', windowOpen: false, isClosed: false };

    const now = new Date();
    const eventDate = parseISO(event.event_date);
    const today = parseISO(getManilaTodayKey(now));
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    const daysDiff = Math.floor((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 0) {
      return { canMark: false, reason: 'Event is in the future', windowOpen: false, isClosed: false };
    }

    if (daysDiff < -1) {
      return { canMark: false, reason: 'Attendance closed', windowOpen: false, isClosed: true };
    }

    if (event.start_time && daysDiff === 0) {
      const eventStartTime = getManilaEventDateTime(event.event_date, event.start_time);
      const windowOpenTime = new Date(eventStartTime.getTime() - 30 * 60 * 1000);

      if (now < windowOpenTime) {
        const diffMs = windowOpenTime.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const countdown = diffHours > 0 ? `${diffHours}h ${diffMins}m` : `${diffMins}m`;
        return { canMark: false, reason: `Opens in ${countdown}`, windowOpen: false, isClosed: false, countdown };
      }
    }

    return { canMark: true, reason: '', windowOpen: true, isClosed: false };
  }, [event]);

  useEffect(() => {
    if (!event || !event.start_time) return;

    const calculateCountdown = () => {
      const now = new Date();
      const eventDate = parseISO(event.event_date);
      const today = parseISO(getManilaTodayKey(now));
      const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const daysDiff = Math.floor((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff !== 0) {
        setCountdownParts({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const eventStartTime = getManilaEventDateTime(event.event_date, event.start_time!);
      const windowOpenTime = new Date(eventStartTime.getTime() - 30 * 60 * 1000);

      const diffMs = windowOpenTime.getTime() - now.getTime();
      if (diffMs <= 0) {
        setCountdownParts({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

      setCountdownParts({ hours: diffHours, minutes: diffMins, seconds: diffSecs });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event]);

  const handleMarkAttendance = async (markAs: 'present' | 'absent') => {
    if (!id || !user || !event) return;
    setAttendanceLoading(true);

    let status: 'present' | 'late' | 'absent' = markAs;

    if (markAs === 'present') {
      const now = new Date();
      const eventDate = parseISO(event.event_date);
      const today = parseISO(getManilaTodayKey(now));
      const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const daysDiff = Math.floor((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff < 0) {
        status = 'late';
      } else if (event.start_time) {
        const eventStartTime = getManilaEventDateTime(event.event_date, event.start_time);
        const graceTime = new Date(eventStartTime.getTime() + 5 * 60 * 1000);
        if (now > graceTime) {
          status = 'late';
        }
      }
    }

    const isAssigned = assignments.some(a => a.user_id === user.id);

    const { error } = await supabase.from('event_attendance').upsert({
      event_id: id,
      user_id: user.id,
      status,
      checked_in_at: new Date().toISOString(),
      is_assigned: isAssigned,
    }, { onConflict: 'event_id,user_id' });

    setAttendanceLoading(false);

    if (error) {
      toast('error', 'Failed to submit attendance');
      return;
    }

    if (status === 'late') {
      toast('info', 'You have been marked as late');
    } else if (status === 'present') {
      toast('success', 'Attendance marked as present');
    } else {
      toast('info', 'Attendance marked as absent');
    }

    fetchAttendance();
  };


  const handleAssign = async () => {
    if (!id) return;

    const existingAssignment = assignments.find(
      a => a.user_id === assignForm.user_id && a.role_id === assignForm.role_id
    );

    if (existingAssignment) {
      toast('info', 'Member already assigned to this role');
      setShowAssign(false);
      setAssignForm({ user_id: '', role_id: '' });
      return;
    }

    const { error } = await supabase.from('event_assignments').insert({
      event_id: id, user_id: assignForm.user_id, role_id: assignForm.role_id,
    });
    if (error) { toast('error', error.message); return; }
    toast('success', 'Member assigned');
    setShowAssign(false);
    setAssignForm({ user_id: '', role_id: '' });
    fetchAll();
  };

  const handleConfirm = async (assignmentId: string) => {
    await supabase.from('event_assignments').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', assignmentId);
    dispatchBadgeCountsRefresh();
    toast('success', 'Assignment confirmed');
    fetchAll();
  };

  const handleDecline = async (assignmentId: string) => {
    await supabase.from('event_assignments').update({ status: 'declined', decline_reason: declineReason }).eq('id', assignmentId);
    dispatchBadgeCountsRefresh();
    toast('info', 'Assignment declined');
    setShowDecline(null);
    setDeclineReason('');
    fetchAll();
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    await supabase.from('event_assignments').delete().eq('id', assignmentId);
    toast('info', 'Assignment removed');
    fetchAll();
  };

  const handleCreateSetlist = async () => {
    if (!id || !user) return;
    const fmt = serviceFormat || (event ? inferServiceFormat(event.event_type) : 'custom');
    const { error } = await supabase.from('setlists').insert({ event_id: id, created_by: user.id, service_format: fmt });
    if (error) { toast('error', error.message); return; }
    toast('success', 'Setlist created');
    fetchAll();
  };

  const handleServiceFormatChange = async (fmt: ServiceFormat) => {
    setServiceFormat(fmt);
    if (setlist) {
      await supabase.from('setlists').update({ service_format: fmt }).eq('id', setlist.id);
    }
  };

  const enterReorderMode = () => {
    const sorted = [...setlistSongs].sort((a, b) => a.position - b.position);
    setReorderSongs(sorted);
    setIsReordering(true);
  };

  const cancelReorder = () => {
    setIsReordering(false);
    setReorderSongs([]);
    setDragIndex(null);
  };

  const saveReorder = async () => {
    setSavingOrder(true);
    const updates = reorderSongs.map((s, i) => supabase.from('setlist_songs').update({ position: i + 1 }).eq('id', s.id));
    await Promise.all(updates);
    setSetlistSongs(reorderSongs.map((s, i) => ({ ...s, position: i + 1 })));
    setIsReordering(false);
    setReorderSongs([]);
    setDragIndex(null);
    setSavingOrder(false);
    toast('success', 'Song order saved');
  };

  const moveReorderSong = (from: number, to: number) => {
    if (to < 0 || to >= reorderSongs.length) return;
    const arr = [...reorderSongs];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setReorderSongs(arr);
  };

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    moveReorderSong(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => setDragIndex(null);

  const handleAddSongToSetlist = async (songId: string, category: string, youtubeUrl: string, performedKey: string) => {
    if (!setlist) return;
    const { error } = await supabase.from('setlist_songs').insert({
      setlist_id: setlist.id, song_id: songId, position: setlistSongs.length + 1, song_category: category, youtube_url: youtubeUrl, performed_key: performedKey,
    });
    if (error) { toast('error', error.message); return; }
    toast('success', 'Song added');
    fetchAll();
  };

  const openSongConfig = (songId: string) => {
    const song = songs.find(s => s.id === songId);
    setSelectedSongForConfig(songId);
    setSongConfig({ category: '', youtube_url: '', performed_key: song?.song_key || '' });
    setShowSongConfig(true);
    setShowSetlist(false);
  };

  const confirmAddSong = async () => {
    if (!selectedSongForConfig) return;
    await handleAddSongToSetlist(selectedSongForConfig, songConfig.category, songConfig.youtube_url, songConfig.performed_key);
    setShowSongConfig(false);
    setSelectedSongForConfig(null);
    setSongConfig({ category: '', youtube_url: '', performed_key: '' });
  };

  const handleRemoveSongFromSetlist = async (slSongId: string) => {
    await supabase.from('setlist_songs').delete().eq('id', slSongId);
    fetchAll();
  };

  const openEditSong = (ss: SetlistSong) => {
    setEditingSongId(ss.id);
    setEditSongForm({
      category: ss.song_category || '',
      youtube_url: ss.youtube_url || '',
      performed_key: ss.performed_key || ss.songs?.song_key || '',
    });
  };

  const handleUpdateSetlistSong = async () => {
    if (!editingSongId) return;
    const { error } = await supabase.from('setlist_songs').update({
      song_category: editSongForm.category,
      youtube_url: editSongForm.youtube_url,
      performed_key: editSongForm.performed_key,
    }).eq('id', editingSongId);
    if (error) { toast('error', error.message); return; }
    toast('success', 'Song updated');
    setEditingSongId(null);
    fetchAll();
  };

  const handleCreateSong = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('songs').insert({ ...newSong, created_by: user.id }).select().maybeSingle();
    if (error || !data) { toast('error', 'Failed to create song'); return; }
    toast('success', 'Song created');
    setNewSong({ title: '', artist: '', song_key: '', duration: '', youtube_url: '' });
    setShowAddSong(false);
    fetchAll();
    if (setlist) openSongConfig(data.id);
  };

  const handleSetlistAction = async (action: 'pending_review' | 'approved' | 'revision_requested' | 'rejected' | 'draft', notes?: string) => {
    if (!setlist) return;
    const now = new Date().toISOString();
    const update: Record<string, string | null> = { status: action };
    const isReviewDecision = action === 'approved' || action === 'revision_requested' || action === 'rejected';
    if (action === 'approved' && user) update.approved_by = user.id;
    if (action === 'pending_review') update.submitted_at = now;
    if (isReviewDecision && user) { update.reviewed_at = now; update.reviewed_by = user.id; }
    if (notes && isReviewDecision) update.review_note = notes;
    if (action === 'revision_requested' && notes) update.approval_notes = notes;
    const { error } = await supabase.from('setlists').update(update).eq('id', setlist.id);
    if (error) { toast('error', 'Failed to update setlist'); return; }

    setSetlist({ ...setlist, status: action, review_note: (isReviewDecision && notes) ? notes : setlist.review_note, approval_notes: action === 'revision_requested' && notes ? notes : setlist.approval_notes, approved_by: action === 'approved' && user ? user.id : setlist.approved_by } as Setlist);

    if (action === 'approved' && event) {
      const notifRecipients = assignments
        .filter(a => a.user_id !== user?.id)
        .map(a => ({
          user_id: a.user_id,
          type: 'setlist_approved',
          title: 'Setlist Approved',
          body: `The setlist for "${event.title}" has been approved.`,
          data: { event_id: event.id, setlist_id: setlist.id },
        }));
      if (notifRecipients.length > 0) {
        await supabase.from('notifications').insert(notifRecipients);
      }
    }

    if (action === 'revision_requested') {
      const songLeaderAssignment = assignments.find(a => a.roles?.name === 'Song Leader');
      if (songLeaderAssignment && event) {
        await supabase.from('notifications').insert({
          user_id: songLeaderAssignment.user_id,
          type: 'setlist_revision',
          title: 'Setlist Revision Requested',
          body: `The setlist for "${event.title}" needs revision. Reason: ${notes || 'No reason provided'}`,
          data: { event_id: event.id, setlist_id: setlist.id },
        });
      }
    }

    if (action === 'rejected') {
      const songLeaderAssignment = assignments.find(a => a.roles?.name === 'Song Leader');
      if (songLeaderAssignment && event) {
        await supabase.from('notifications').insert({
          user_id: songLeaderAssignment.user_id,
          type: 'setlist_rejected',
          title: 'Setlist Rejected',
          body: `The setlist for "${event.title}" was not approved. Reason: ${notes || 'No reason provided'}`,
          data: { event_id: event.id, setlist_id: setlist.id },
        });
      }
    }

    const label: Record<string, string> = {
      approved: 'Setlist approved',
      pending_review: 'Submitted for review',
      revision_requested: 'Revision requested',
      rejected: 'Setlist rejected',
      draft: 'Reverted to draft',
    };
    toast(action === 'approved' ? 'success' : action === 'rejected' ? 'error' : 'info', label[action] || 'Setlist updated');
    fetchAll();
  };

  const handleRevisionRequest = async () => {
    await handleSetlistAction('revision_requested', revisionReason);
    setShowRevisionRequest(false);
    setRevisionReason('');
  };

  const handleReject = async () => {
    await handleSetlistAction('rejected', rejectReason);
    setShowRejectModal(false);
    setRejectReason('');
  };

  const handleDeleteEvent = async () => {
    if (!id) return;
    setDeleting(true);
    const { error } = await supabase.from('events').delete().eq('id', id);
    setDeleting(false);
    if (error) { toast('error', 'Failed to delete event'); return; }
    toast('success', 'Event deleted');
    navigate('/events');
  };

  const calculateProposalDueDate = (eventDate: string, eventType: string): string | null => {
    if (!eventDate) return null;
    const date = parseISO(eventDate);

    if (eventType === 'Sunday Service') {
      const dueDate = subWeeks(date, 3);
      return `${format(dueDate, 'yyyy-MM-dd')}T15:59:00Z`;
    } else if (eventType === 'LGTF (Midweek)' || eventType === 'Prayer Meeting') {
      let sunday = previousSunday(date);
      if (sunday.getTime() === date.getTime()) {
        sunday = addDays(sunday, -7);
      }
      return `${format(sunday, 'yyyy-MM-dd')}T15:59:00Z`;
    } else if (eventType === 'Youth Recharge') {
      const dueDate = subDays(date, 7);
      return `${format(dueDate, 'yyyy-MM-dd')}T15:59:00Z`;
    }
    return null;
  };

  const getDefaultTimes = (eventType: string): { start: string; end: string } => {
    switch (eventType) {
      case 'Sunday Service':
        return { start: '07:30', end: '11:30' };
      case 'LGTF (Midweek)':
        return { start: '19:30', end: '21:00' };
      case 'Prayer Meeting':
        return { start: '18:30', end: '19:30' };
      case 'Online Devotion':
        return { start: '21:00', end: '22:00' };
      case 'Equipping':
        return { start: '19:30', end: '21:00' };
      case 'Youth Recharge':
        return { start: '16:00', end: '18:00' };
      default:
        return { start: '', end: '' };
    }
  };

  const openEditEvent = () => {
    if (!event) return;
    setEditForm({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      event_date: event.event_date,
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      song_leader_id: event.song_leader_id || '',
      linked_event_id: event.linked_event_id || '',
    });
    setShowEditEvent(true);
  };

  const handleEditEventTypeChange = (newType: string) => {
    const times = getDefaultTimes(newType);
    setEditForm(prev => ({
      ...prev,
      event_type: newType,
      start_time: times.start,
      end_time: times.end,
      song_leader_id: '',
      linked_event_id: '',
    }));
  };

  const getSongLeaders = () => {
    const songLeaderRole = roles.find(r => r.name === 'Song Leader');
    if (!songLeaderRole) return [];
    const songLeaderUserIds = memberRoles.filter(ur => ur.role_id === songLeaderRole.id).map(ur => ur.user_id);
    return members.filter(m => songLeaderUserIds.includes(m.id));
  };

  const generateEventTitle = async (songLeaderId: string | null | undefined, eventType: string): Promise<string> => {
    if (songLeaderId && songLeaderId.trim() !== '') {
      const songLeader = members.find(m => m.id === songLeaderId);
      if (songLeader) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', songLeaderId)
          .maybeSingle();

        const prefix = profileData?.gender === 'male' ? 'Bro.' : profileData?.gender === 'female' ? 'Sis.' : '';
        return prefix ? `${prefix} ${songLeader.first_name} ${songLeader.last_name}` : `${songLeader.first_name} ${songLeader.last_name}`;
      }
    }
    return eventType;
  };

  const handleEditEvent = async () => {
    if (!id) return;
    const title = await generateEventTitle(editForm.song_leader_id, editForm.event_type);
    const proposalDueDate = calculateProposalDueDate(editForm.event_date, editForm.event_type);

    const { error } = await supabase.from('events').update({
      title,
      description: editForm.description || null,
      event_type: editForm.event_type,
      event_date: editForm.event_date,
      start_time: editForm.start_time || null,
      end_time: editForm.end_time || null,
      song_leader_id: editForm.song_leader_id || null,
      linked_event_id: editForm.linked_event_id || null,
      proposal_due_date: proposalDueDate,
    }).eq('id', id);
    if (error) { toast('error', 'Failed to update event'); return; }
    toast('success', 'Event updated');
    setShowEditEvent(false);
    fetchAll();
  };

  if (loading) return <PageLoader />;
  if (!event) return <div className="page-container p-8 text-center text-gray-500">Event not found</div>;

  const myAssignment = assignments.find(a => a.user_id === user?.id);
  const confirmedCount = assignments.filter(a => a.status === 'confirmed').length;
  const songLeaderAssignment = assignments.find(a => a.roles?.name === 'Song Leader');
  const songLeaderName = songLeaderAssignment?.profiles
    ? `${songLeaderAssignment.profiles.first_name} ${songLeaderAssignment.profiles.last_name}`.trim()
    : members.find(m => m.id === event.song_leader_id)
      ? `${members.find(m => m.id === event.song_leader_id)!.first_name} ${members.find(m => m.id === event.song_leader_id)!.last_name}`.trim()
      : '';
  const isSongLeader = assignments.some(a => a.user_id === user?.id && a.roles?.name === 'Song Leader');
  const userIsSongLeaderRole = userRoles.some(ur => ur.roles?.name === 'Song Leader');
  const canManageSetlist = isLeader || isSongLeader || userIsSongLeaderRole;
  const canEditSetlist = isLeader || isProductionDirector;
  const canEditEvent = isLeader || isProductionDirector;

  const isSetlistCreator = setlist ? setlist.created_by === user?.id : false;
  const canReviewSetlist = isLeader || userRoles.some(ur => ['Admin', 'Production Director', 'Music Director', 'Setlist Coordinator'].includes(ur.roles?.name || ''));
  const canSubmitSetlist = isSetlistCreator || canManageSetlist;

  const statusColors: Record<string, string> = {
    draft: 'badge-blue',
    pending_review: 'badge-yellow',
    approved: 'badge-green',
    revision_requested: 'badge-red',
    rejected: 'badge-red',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending_review: 'Submitted',
    approved: 'Approved',
    revision_requested: 'Revision Requested',
    rejected: 'Rejected',
  };

  const statusDescriptions: Record<string, string> = {
    draft: 'Draft — not yet submitted for review',
    pending_review: 'Submitted — awaiting leader review',
    approved: 'Approved — accepted for use',
    revision_requested: 'Revision Requested — update and resubmit',
    rejected: 'Rejected — not approved',
  };

  // Visual urgency state for hero card (mirrors Events list logic)
  const heroIsPast = parseISO(event.event_date) < startOfDay(new Date());
  const heroProposalDue = event.proposal_due_date ? parseISO(event.proposal_due_date) : null;
  const heroDaysUntilDue = heroProposalDue ? differenceInDays(heroProposalDue, new Date()) : null;
  const heroHasApprovedSetlist = setlist?.status === 'approved';
  const heroIsOverdue = heroDaysUntilDue !== null && heroDaysUntilDue < 0 && !heroHasApprovedSetlist && !heroIsPast;
  const heroIsDueSoon = heroDaysUntilDue !== null && heroDaysUntilDue >= 0 && heroDaysUntilDue <= 3 && !heroHasApprovedSetlist && !heroIsPast;
  const showLinkedSetlistReference = !setlist && event.event_type === 'Rehearsals' && !!event.linked_event_id && !!linkedSetlist;
  const linkedSetlistStatus = linkedSetlist?.status || 'draft';
  let linkedServiceDateLabel = '';
  if (linkedServiceEvent?.event_date) {
    try {
      linkedServiceDateLabel = format(parseISO(linkedServiceEvent.event_date), 'MMM d, yyyy');
    } catch {
      linkedServiceDateLabel = '';
    }
  }
  const linkedReferenceSongs = linkedSetlistSongs
    .filter((song): song is SetlistSong => !!song && typeof song === 'object')
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  const heroChipGradient = heroIsPast
    ? null
    : heroIsOverdue
    ? 'linear-gradient(145deg,#ef4444,#b91c1c)'
    : heroIsDueSoon
    ? 'linear-gradient(145deg,#f59e0b,#b45309)'
    : 'linear-gradient(145deg,#16a34a,#15803d)';

  const heroChipShadow = heroIsPast
    ? undefined
    : heroIsOverdue
    ? '0 4px 14px rgba(220,38,38,0.45)'
    : heroIsDueSoon
    ? 'rgba(245,158,11,0.45)'
    : '0 3px 10px rgba(22,163,74,0.3)';

  const heroCardTint = heroIsPast
    ? undefined
    : heroIsOverdue
    ? 'linear-gradient(135deg, rgba(239,68,68,0.13), rgba(239,68,68,0.04) 45%, transparent 75%)'
    : heroIsDueSoon
    ? 'linear-gradient(135deg, rgba(245,158,11,0.13), rgba(245,158,11,0.04) 45%, transparent 75%)'
    : 'linear-gradient(135deg, rgba(34,197,94,0.09), rgba(34,197,94,0.025) 45%, transparent 75%)';

  const heroEyebrow = heroIsPast
    ? 'text-gray-400 dark:text-white/30'
    : heroIsOverdue
    ? 'text-red-600 dark:text-red-400'
    : heroIsDueSoon
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400/80';

  return (
    <div className="page-container page-bottom-pad">
      <div className="max-w-3xl mx-auto px-4 sm:px-5 lg:px-6 pt-6 sm:pt-8 space-y-5">

        {/* ── Back ─────────────────────────────────────── */}
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => navigate('/events')}
          className="inline-flex items-center gap-1.5 pl-2 pr-3.5 h-8 rounded-full text-[12px] font-semibold text-gray-600 dark:text-white/55 bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] backdrop-blur-md hover:bg-white dark:hover:bg-white/[0.07] active:scale-[0.97] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Events
        </motion.button>

        {/* ── Hero Card ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06]"
          style={{
            backgroundImage: heroCardTint,
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)',
            opacity: heroIsPast ? 0.85 : 1,
          }}
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

          <div className="relative px-5 sm:px-7 pt-6 pb-5">
            <div className="flex items-start gap-4">
              {/* Date chip — gradient encodes urgency */}
              <div
                className={`relative flex flex-col items-center justify-center h-[68px] w-14 rounded-2xl shrink-0 ${heroIsPast ? 'bg-gray-100 dark:bg-white/[0.05]' : ''}`}
                style={heroIsPast ? {} : { background: heroChipGradient!, boxShadow: heroChipShadow }}
              >
                <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${heroIsPast ? 'text-gray-400 dark:text-white/25' : 'text-white/65'}`}>
                  {format(parseISO(event.event_date), 'MMM')}
                </span>
                <span className={`text-[28px] font-black leading-none mt-1 ${heroIsPast ? 'text-gray-500 dark:text-white/35' : 'text-white'}`} style={{ letterSpacing: '-0.05em' }}>
                  {format(parseISO(event.event_date), 'd')}
                </span>
                <span className={`text-[9px] font-bold leading-none mt-0.5 ${heroIsPast ? 'text-gray-400 dark:text-white/20' : 'text-white/55'}`}>
                  {format(parseISO(event.event_date), 'EEE')}
                </span>
                {heroHasApprovedSetlist && !heroIsPast && (
                  <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-[#0d0d0f]" style={{ background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.6)' }} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* Eyebrow */}
                <p className={`text-[10px] font-mono font-medium uppercase tracking-[0.22em] mb-1 ${heroEyebrow}`}>
                  {heroIsPast ? 'Past event' : heroIsOverdue ? 'Setlist overdue' : heroIsDueSoon ? `Due in ${heroDaysUntilDue}d` : heroHasApprovedSetlist ? 'Setlist approved' : 'Schedule'}
                </p>

                {/* Title */}
                <h1 className="text-[1.5rem] sm:text-[1.75rem] font-black text-gray-900 dark:text-white leading-[1.1]" style={{ letterSpacing: '-0.03em' }}>
                  {event.title}
                </h1>

                {/* Type badge */}
                <div className="mt-2">
                  <span className="badge-blue text-[10px]">{event.event_type}</span>
                </div>
              </div>
            </div>

            {/* Meta row */}
            <div className="mt-5 pt-5 border-t border-black/[0.05] dark:border-white/[0.05] grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  icon: Calendar,
                  label: 'Date',
                  value: format(parseISO(event.event_date), 'EEEE'),
                  detail: format(parseISO(event.event_date), 'MMM d, yyyy'),
                },
                {
                  icon: Clock,
                  label: 'Time',
                  value: formatTime12Hour(event.start_time || '') || 'Time not set',
                  detail: event.end_time ? `Ends ${formatTime12Hour(event.end_time)}` : 'End time not set',
                },
                {
                  icon: Music,
                  label: 'Song Leader',
                  value: songLeaderName || 'Not assigned',
                  detail: songLeaderAssignment?.status
                    ? songLeaderAssignment.status === 'confirmed' ? 'Confirmed assignment' : `${songLeaderAssignment.status} assignment`
                    : 'No song leader assignment',
                },
                {
                  icon: Users,
                  label: 'Team',
                  value: `${confirmedCount}/${assignments.length} confirmed`,
                  detail: assignments.length === 1 ? '1 assigned member' : `${assignments.length} assigned members`,
                },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-white/65 dark:bg-white/[0.035] border border-black/[0.06] dark:border-white/[0.07] px-3.5 py-3.5 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/45">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/30">{item.label}</span>
                      <span className="block text-[14px] sm:text-[15px] font-black text-gray-900 dark:text-white truncate leading-tight mt-0.5">{item.value}</span>
                      <span className="block text-[11px] text-gray-500 dark:text-white/45 truncate mt-0.5">{item.detail}</span>
                    </span>
                  </div>
                );
              })}
              {event.proposal_due_date && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <AlertCircle className={`h-3.5 w-3.5 shrink-0 ${heroIsOverdue ? 'text-red-500' : heroIsDueSoon ? 'text-amber-500' : 'text-gray-400 dark:text-white/30'}`} />
                  <span className={`text-[11px] font-mono ${heroIsOverdue ? 'text-red-600 dark:text-red-400' : heroIsDueSoon ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-white/45'}`}>
                    <span className="font-bold uppercase tracking-wide">Due:</span> {formatInTimeZone(parseISO(event.proposal_due_date), 'Asia/Manila', "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
              )}
              {event.description && (
                <p className="sm:col-span-2 text-[12px] text-gray-600 dark:text-white/55 leading-relaxed">{event.description}</p>
              )}
            </div>

            {/* Action buttons */}
            {(isLeader || canEditEvent) && (
              <div className="mt-5 pt-5 border-t border-black/[0.05] dark:border-white/[0.05] flex items-center gap-2">
                {isLeader && (
                  <button
                    onClick={() => setShowAssign(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-full text-[12px] font-semibold text-white flex-1 transition-all active:scale-[0.97]"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Assign Member
                  </button>
                )}
                {canEditEvent && (
                  <button
                    onClick={openEditEvent}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full text-gray-600 dark:text-white/55 bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] backdrop-blur-md hover:bg-white dark:hover:bg-white/[0.07] active:scale-[0.95] transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                )}
                {isLeader && (
                  <button
                    onClick={() => setShowDeleteEvent(true)}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/[0.1] border border-red-200 dark:border-red-500/25 hover:bg-red-100 dark:hover:bg-red-500/[0.18] active:scale-[0.95] transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Pending Assignment Banner ────────────────── */}
        {myAssignment && myAssignment.status === 'pending' && (
          <motion.div
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-3xl overflow-hidden border border-amber-200 dark:border-amber-500/25 bg-white dark:bg-[#120b05]"
            style={{
              backgroundImage: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.04) 50%, transparent 80%)',
              boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(245,158,11,0.20)',
            }}
          >
            <div className="absolute inset-0 dark:bg-white/[0.025]" />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 dark:via-amber-400/30 to-transparent" />

            <div className="relative px-5 py-4 flex items-start gap-3.5">
              <div
                className="relative flex items-center justify-center h-10 w-10 rounded-2xl shrink-0"
                style={{ background: 'linear-gradient(145deg, #f59e0b, #d97706)', boxShadow: '0 3px 10px rgba(245,158,11,0.4)' }}
              >
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-mono font-medium uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400 mb-0.5">
                  Action required
                </p>
                <p className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
                  You have a pending assignment
                </p>
                <p className="text-[12px] text-gray-600 dark:text-white/55 mt-0.5">
                  Role: <span className="font-semibold text-gray-800 dark:text-white/80">{myAssignment.roles?.name}</span>
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleConfirm(myAssignment.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold text-white transition-all active:scale-[0.97]"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 3px 10px rgba(22,163,74,0.3)' }}
                  >
                    <Check className="h-3.5 w-3.5" /> Confirm
                  </button>
                  <button
                    onClick={() => setShowDecline(myAssignment.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/[0.12] border border-red-200 dark:border-red-500/25 hover:bg-red-100 dark:hover:bg-red-500/[0.18] active:scale-[0.97] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {(() => {
          const attendanceStatus = getAttendanceStatus();
          const isAssigned = assignments.some(a => a.user_id === user?.id);
          const showAttendance = attendanceStatus.windowOpen || attendanceStatus.isClosed || attendanceStatus.countdown;

          if (!showAttendance) return null;

          return (
            <div className="card animate-slide-up" style={{ animationDelay: '100ms' }}>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Attendance
                  </h2>
                  {attendance && (
                    <span className={`badge ${attendance.status === 'present' ? 'badge-green' : attendance.status === 'late' ? 'badge-yellow' : 'badge-red'}`}>
                      {attendance.status === 'present' ? 'Present' : attendance.status === 'late' ? 'Late' : 'Absent'}
                    </span>
                  )}
                </div>

                {attendanceStatus.isClosed ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Attendance is closed</p>
                    {attendance ? (
                      <p className="text-xs text-gray-400 mt-1">
                        You were marked as <span className={attendance.status === 'present' ? 'text-green-600' : attendance.status === 'late' ? 'text-amber-600' : 'text-red-600'}>{attendance.status}</span>
                        {attendance.checked_in_at && ` at ${format(parseISO(attendance.checked_in_at), 'h:mm a')}`}
                      </p>
                    ) : (
                      <p className="text-xs text-red-500 mt-1">You were marked absent (no attendance submitted)</p>
                    )}
                  </div>
                ) : attendanceStatus.countdown ? (
                  <div className="py-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      {countdownParts.hours > 0 && (
                        <div className="flex flex-col items-center">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
                              <span className="text-2xl font-bold text-white tabular-nums">{String(countdownParts.hours).padStart(2, '0')}</span>
                            </div>
                            <div className="absolute -inset-1 rounded-2xl bg-brand-500/20 dark:bg-brand-400/10 blur-sm -z-10 animate-pulse"></div>
                          </div>
                          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-1.5 uppercase tracking-wider">Hours</span>
                        </div>
                      )}
                      {countdownParts.hours > 0 && (
                        <div className="flex flex-col gap-1.5 pb-5">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                        </div>
                      )}
                      <div className="flex flex-col items-center">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
                            <span className="text-2xl font-bold text-white tabular-nums">{String(countdownParts.minutes).padStart(2, '0')}</span>
                          </div>
                          <div className="absolute -inset-1 rounded-2xl bg-brand-500/20 dark:bg-brand-400/10 blur-sm -z-10 animate-pulse"></div>
                        </div>
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-1.5 uppercase tracking-wider">Minutes</span>
                      </div>
                      <div className="flex flex-col gap-1.5 pb-5">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20 overflow-hidden">
                            <span className="text-2xl font-bold text-white tabular-nums transition-all duration-300">{String(countdownParts.seconds).padStart(2, '0')}</span>
                          </div>
                          <div className="absolute -inset-1 rounded-2xl bg-brand-500/20 dark:bg-brand-400/10 blur-sm -z-10 animate-pulse"></div>
                        </div>
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-1.5 uppercase tracking-wider">Seconds</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-brand-600 dark:text-brand-400">
                      <Timer className="h-4 w-4 animate-pulse" />
                      <p className="text-sm font-medium">Attendance opens soon</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">30 minutes before the event</p>
                  </div>
                ) : attendance ? (
                  <div className="py-4 text-center">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                      attendance.status === 'present' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                      attendance.status === 'late' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' :
                      'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}>
                      {attendance.status === 'present' ? <CheckCircle className="h-5 w-5" /> : attendance.status === 'late' ? <Clock className="h-5 w-5" /> : <X className="h-5 w-5" />}
                      <span className="font-medium">
                        {attendance.status === 'present' ? 'Present' : attendance.status === 'late' ? 'Late' : 'Absent'}
                      </span>
                    </div>
                    {attendance.checked_in_at && (
                      <p className="text-xs text-gray-400 mt-2">Checked in at {format(parseISO(attendance.checked_in_at), 'h:mm a')}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      {isAssigned ? 'Mark your attendance for this event' : 'Log your attendance (optional)'}
                    </p>
                    <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Please mark your attendance only when you are already at church.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => handleMarkAttendance('present')}
                        disabled={attendanceLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> Present
                      </button>
                      <button
                        onClick={() => handleMarkAttendance('absent')}
                        disabled={attendanceLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <X className="h-4 w-4" /> Absent
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 text-center">
                      {event?.start_time && `Event starts at ${formatTime12Hour(event.start_time)}. 5-minute grace period applies.`}
                    </p>
                  </div>
                )}

                {isLeader && allAttendance.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Team Attendance</p>
                    <div className="space-y-2">
                      {allAttendance.map(att => (
                        <div key={att.id} className="flex items-center gap-3">
                          <Avatar
                            src={att.profiles?.avatar_url}
                            firstName={att.profiles?.first_name || '?'}
                            lastName={att.profiles?.last_name}
                            size="sm"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                            {att.profiles?.first_name} {att.profiles?.last_name}
                          </span>
                          <span className={`badge ${att.status === 'present' ? 'badge-green' : att.status === 'late' ? 'badge-yellow' : 'badge-red'}`}>
                            {att.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div className="card animate-slide-up" style={{ animationDelay: '115ms' }}>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Team Members
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">{confirmedCount}/{assignments.length} confirmed</span>
            </div>
            {assignments.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No team members assigned yet</p>
            ) : (
              <div className="space-y-3">
                {[...assignments]
                  .sort((a, b) => {
                    const aIsSongLeader = a.roles?.name === 'Song Leader';
                    const bIsSongLeader = b.roles?.name === 'Song Leader';
                    if (aIsSongLeader && !bIsSongLeader) return -1;
                    if (!aIsSongLeader && bIsSongLeader) return 1;
                    return 0;
                  })
                  .map(a => {
                    const isSongLeaderRole = a.roles?.name === 'Song Leader';
                    return (
                      <div key={a.id}>
                        <div className={`flex items-center gap-3 ${isSongLeaderRole ? 'p-3 rounded-lg bg-gradient-to-r from-brand-50 to-blue-50 dark:from-brand-900/20 dark:to-blue-900/20 border border-brand-200 dark:border-brand-800' : ''}`}>
                          <Avatar
                            src={a.profiles?.avatar_url}
                            firstName={a.profiles?.first_name || '?'}
                            lastName={a.profiles?.last_name}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{a.profiles?.first_name} {a.profiles?.last_name}</p>
                            {a.roles && <RoleBadge role={a.roles} size="sm" />}
                          </div>
                          <span className={`badge ${a.status === 'confirmed' ? 'badge-green' : a.status === 'declined' ? 'badge-red' : 'badge-yellow'}`}>{a.status}</span>
                          {isLeader && (
                            <button onClick={() => handleRemoveAssignment(a.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {a.status === 'declined' && a.decline_reason && (
                          <div className="ml-12 mt-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/10 text-xs text-red-600 dark:text-red-400">
                            Reason: {a.decline_reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {setlist && setlist.status === 'revision_requested' && (
          <div className="card p-4 bg-amber-50 dark:bg-amber-900/20 ring-amber-200 dark:ring-amber-800 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/40 shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Revision Requested</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{setlist.review_note || setlist.approval_notes || 'Please review and make necessary changes to the setlist.'}</p>
                {canSubmitSetlist && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Make your changes and use Resubmit when ready.</p>}
              </div>
            </div>
          </div>
        )}

        {setlist && setlist.status === 'rejected' && (
          <div className="card p-4 bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-800 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/40 shrink-0">
                <X className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-900 dark:text-red-100">Setlist Rejected</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{setlist.review_note || 'This setlist was not approved.'}</p>
                {canSubmitSetlist && <p className="text-xs text-red-600 dark:text-red-400 mt-2">You can reset it to Draft and rework it if needed.</p>}
              </div>
            </div>
          </div>
        )}

        {!setlist ? (
          showLinkedSetlistReference ? (
            <div className="card overflow-hidden animate-slide-up" style={{ animationDelay: '125ms' }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-amber-50/60 dark:bg-amber-500/[0.06]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Sunday Service Setlist</h2>
                    <span className={statusColors[linkedSetlistStatus] || 'badge-blue'}>{statusLabels[linkedSetlistStatus] || linkedSetlistStatus}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                    Reference only from {linkedServiceEvent?.title || 'linked Sunday Service'}
                    {linkedServiceDateLabel ? ` · ${linkedServiceDateLabel}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/events/${event.linked_event_id}`)}
                  className="btn-secondary text-xs shrink-0"
                >
                  Open Main Event <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {linkedReferenceSongs.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-400">The linked setlist has no songs yet</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {linkedReferenceSongs.map((ss, i) => {
                    const song = Array.isArray(ss.songs) ? ss.songs[0] : ss.songs;
                    const displayKey = ss.performed_key || song?.song_key || '';
                    const keyChanged = ss.performed_key && song?.song_key && ss.performed_key !== song.song_key;
                    return (
                      <div key={ss.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{song?.title || 'Untitled song'}</p>
                              {displayKey && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${keyChanged ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                                  {displayKey}
                                </span>
                              )}
                              {ss.song_category && <span className="badge-blue text-[10px]">{ss.song_category}</span>}
                            </div>
                            {song?.artist && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{song.artist}</p>}
                          </div>
                          {ss.youtube_url && (
                            <a href={ss.youtube_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors shrink-0">
                              <Music className="h-3 w-3" /> Video
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  This rehearsal is linked to the Sunday service setlist for reference. No separate rehearsal setlist is created in the library.
                </p>
              </div>
            </div>
          ) : (
          <div className="card animate-slide-up" style={{ animationDelay: '125ms' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Music className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Setlist
              </h2>
            </div>
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-400 mb-4">No setlist created for this event</p>
              {canManageSetlist && (
                <div className="space-y-3">
                  <div className="max-w-xs mx-auto">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Service Format</p>
                    <select
                      value={serviceFormat || inferServiceFormat(event.event_type)}
                      onChange={e => setServiceFormat(e.target.value as ServiceFormat)}
                      className="w-full input-field text-sm"
                    >
                      {(Object.keys(SERVICE_FORMAT_LABELS) as ServiceFormat[]).map(k => (
                        <option key={k} value={k}>{SERVICE_FORMAT_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={handleCreateSetlist} className="btn-primary">
                    <Plus className="h-4 w-4" /> Create Setlist
                  </button>
                </div>
              )}
            </div>
          </div>
          )
        ) : (
          <div className="animate-slide-up" style={{ animationDelay: '125ms' }}>
            <div className="card overflow-hidden">
              {/* Header */}
              <div className="border-b border-gray-100 dark:border-gray-800">
                {/* Mobile: stacked two-row layout */}
                <div className="flex flex-col gap-2 px-4 py-3 lg:hidden">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Setlist</h2>
                    <span className={statusColors[setlist.status] || 'badge-blue'}>{statusLabels[setlist.status] || setlist.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageSetlist && (
                      <select
                        value={serviceFormat || 'sunday_full'}
                        onChange={e => handleServiceFormatChange(e.target.value as ServiceFormat)}
                        className="text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg px-2 py-1 border-none outline-none focus:ring-1 focus:ring-brand-500 flex-1 min-w-0"
                        title="Service Format"
                      >
                        {(Object.keys(SERVICE_FORMAT_LABELS) as ServiceFormat[]).map(k => (
                          <option key={k} value={k}>{SERVICE_FORMAT_LABELS[k]}</option>
                        ))}
                      </select>
                    )}
                    {(canManageSetlist || canEditSetlist) && setlistSongs.length > 1 && !isReordering && (
                      <button
                        onClick={enterReorderMode}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0"
                        title="Reorder Songs"
                      >
                        <GripVertical className="h-3.5 w-3.5" /> Reorder
                      </button>
                    )}
                  </div>
                </div>
                {/* Desktop: single-row layout */}
                <div className="hidden lg:flex lg:items-center lg:justify-between lg:px-5 lg:py-3.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Music className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Setlist</h2>
                    <span className={statusColors[setlist.status] || 'badge-blue'}>{statusLabels[setlist.status] || setlist.status}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(canManageSetlist || canEditSetlist) && setlistSongs.length > 1 && !isReordering && (
                      <button
                        onClick={enterReorderMode}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                        title="Reorder Songs"
                      >
                        <GripVertical className="h-3.5 w-3.5" /> Reorder
                      </button>
                    )}
                    {canManageSetlist && (
                      <select
                        value={serviceFormat || 'sunday_full'}
                        onChange={e => handleServiceFormatChange(e.target.value as ServiceFormat)}
                        className="text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg px-2 py-1 border-none outline-none focus:ring-1 focus:ring-brand-500 max-w-[140px]"
                        title="Service Format"
                      >
                        {(Object.keys(SERVICE_FORMAT_LABELS) as ServiceFormat[]).map(k => (
                          <option key={k} value={k}>{SERVICE_FORMAT_LABELS[k]}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex border-b border-gray-100 dark:border-gray-800 lg:hidden">
                {(['songs', 'guidance', 'notes'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSetlistTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
                      setlistTab === tab
                        ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400 bg-brand-50/50 dark:bg-brand-900/10'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab === 'songs' ? <ListMusic className="h-3.5 w-3.5 inline mr-1" /> : tab === 'guidance' ? <Sparkles className="h-3.5 w-3.5 inline mr-1" /> : <LayoutPanelLeft className="h-3.5 w-3.5 inline mr-1" />}
                    {tab}
                  </button>
                ))}
              </div>

              <div className="lg:flex lg:divide-x lg:divide-gray-100 lg:dark:divide-gray-800">
                <div className={`lg:flex-1 lg:min-w-0 ${setlistTab !== 'songs' ? 'hidden lg:block' : ''}`}>
                  {isReordering ? (
                    <div>
                      <div className="px-4 py-2.5 bg-brand-50 dark:bg-brand-900/20 border-b border-brand-100 dark:border-brand-800 flex items-center justify-between">
                        <p className="text-xs text-brand-700 dark:text-brand-300 font-medium">Drag to reorder, or use arrows on mobile</p>
                        <div className="flex items-center gap-2">
                          <button onClick={cancelReorder} disabled={savingOrder} className="btn-ghost text-xs py-1 px-2">Cancel</button>
                          <button onClick={saveReorder} disabled={savingOrder} className="btn-primary text-xs py-1 px-2">
                            {savingOrder ? 'Saving...' : 'Save Order'}
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {reorderSongs.map((ss, i) => (
                          <div
                            key={ss.id}
                            draggable
                            onDragStart={() => handleDragStart(i)}
                            onDragOver={e => handleDragOver(e, i)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-3 px-4 py-3 cursor-grab active:cursor-grabbing select-none transition-colors ${dragIndex === i ? 'bg-brand-50 dark:bg-brand-900/20' : 'bg-white dark:bg-gray-900'}`}
                          >
                            <GripVertical className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
                            <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ss.songs?.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{ss.songs?.artist}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => moveReorderSong(i, i - 1)}
                                disabled={i === 0}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => moveReorderSong(i, i + 1)}
                                disabled={i === reorderSongs.length - 1}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : setlistSongs.length === 0 ? (
                    <p className="px-5 py-6 text-center text-sm text-gray-400">No songs added yet</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {setlistSongs.sort((a, b) => a.position - b.position).map((ss, i) => {
                        const usage = songUsage[ss.song_id];
                        const isSafe = !usage || usage.days >= 90;
                        const displayKey = ss.performed_key || ss.songs?.song_key || '';
                        const keyChanged = ss.performed_key && ss.songs?.song_key && ss.performed_key !== ss.songs.song_key;
                        return (
                          <div key={ss.id} className="px-4 py-2.5">
                            {/* Desktop: original single-row layout */}
                            <div className="hidden lg:flex lg:items-center lg:gap-3">
                              <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{i + 1}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{ss.songs?.title}</p>
                                  {ss.song_category && <span className="badge-blue text-[10px]">{ss.song_category}</span>}
                                  {displayKey && (
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${keyChanged ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                                      {displayKey}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{ss.songs?.artist}</p>
                              </div>
                              {ss.youtube_url && (
                                <a href={ss.youtube_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors shrink-0">
                                  <Music className="h-3 w-3" /> Video
                                </a>
                              )}
                              {usage ? (
                                <span className={`inline-flex items-center gap-1 text-xs font-medium shrink-0 ${isSafe ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {isSafe ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                  {usage.days}d
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 shrink-0">
                                  <CheckCircle className="h-4 w-4" /> New
                                </span>
                              )}
                              {canEditSetlist && (
                                <button onClick={() => openEditSong(ss)} className="p-1 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                                  <Edit className="h-4 w-4" />
                                </button>
                              )}
                              {(canManageSetlist && !['approved', 'pending_review'].includes(setlist.status)) || (canEditSetlist) ? (
                                <button onClick={() => handleRemoveSongFromSetlist(ss.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>

                            {/* Mobile: stacked layout */}
                            <div className="lg:hidden">
                              {/* Line 1: number + title + action icons */}
                              <div className="flex items-start gap-2.5">
                                <span className="flex items-center justify-center h-6 w-6 rounded-md bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0 mt-0.5">{i + 1}</span>
                                <p className="text-sm font-medium text-gray-900 dark:text-white flex-1 min-w-0 leading-snug">{ss.songs?.title}</p>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {canEditSetlist && (
                                    <button onClick={() => openEditSong(ss)} className="p-1.5 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                                      <Edit className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {(canManageSetlist && !['approved', 'pending_review'].includes(setlist.status)) || (canEditSetlist) ? (
                                    <button onClick={() => handleRemoveSongFromSetlist(ss.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {/* Line 2: artist */}
                              {ss.songs?.artist && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-[34px] leading-none">{ss.songs.artist}</p>
                              )}
                              {/* Line 3: key + category + usage + video */}
                              <div className="flex items-center flex-wrap gap-1.5 mt-1 ml-[34px]">
                                {displayKey && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${keyChanged ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                                    {displayKey}
                                  </span>
                                )}
                                {ss.song_category && <span className="badge-blue text-[10px]">{ss.song_category}</span>}
                                {usage ? (
                                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${isSafe ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {isSafe ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                    {usage.days}d
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-400">
                                    <CheckCircle className="h-3 w-3" /> New
                                  </span>
                                )}
                                {ss.youtube_url && (
                                  <a href={ss.youtube_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors">
                                    <Music className="h-2.5 w-2.5" /> Video
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="px-4 py-3.5 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2.5">{statusDescriptions[setlist.status]}</p>
                    <div className="flex flex-wrap gap-2">
                      {/* Song editing — creator/editor when not finalized */}
                      {(canManageSetlist && !['approved', 'rejected'].includes(setlist.status)) || (canEditSetlist && setlist.status === 'approved') ? (
                        <>
                          <button onClick={() => setShowSetlist(true)} className="btn-secondary text-xs">
                            <Plus className="h-3.5 w-3.5" /> Add Song
                          </button>
                          <button onClick={() => setShowAddSong(true)} className="btn-ghost text-xs">
                            <Plus className="h-3.5 w-3.5" /> New Song
                          </button>
                        </>
                      ) : null}

                      {/* CREATOR ACTIONS */}
                      {canSubmitSetlist && setlist.status === 'draft' && (
                        <button onClick={() => handleSetlistAction('pending_review')} className="btn-primary text-xs ml-auto">
                          <Send className="h-3.5 w-3.5" /> Submit Proposal
                        </button>
                      )}
                      {canSubmitSetlist && setlist.status === 'revision_requested' && (
                        <button onClick={() => handleSetlistAction('pending_review')} className="btn-primary text-xs ml-auto">
                          <Send className="h-3.5 w-3.5" /> Resubmit
                        </button>
                      )}
                      {canSubmitSetlist && setlist.status === 'rejected' && (
                        <button onClick={() => handleSetlistAction('draft')} className="btn-secondary text-xs ml-auto">
                          <CheckCircle className="h-3.5 w-3.5" /> Reset to Draft
                        </button>
                      )}

                      {/* REVIEWER ACTIONS — only shown when status is pending_review */}
                      {canReviewSetlist && setlist.status === 'pending_review' && (
                        <>
                          <div className="w-full border-t border-gray-100 dark:border-gray-800 my-1" />
                          <p className="w-full text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leader Review</p>
                          <button onClick={() => handleSetlistAction('approved')} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors">
                            <ThumbsUp className="h-3.5 w-3.5" /> Approve Setlist
                          </button>
                          <button onClick={() => setShowRevisionRequest(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors">
                            <AlertCircle className="h-3.5 w-3.5" /> Request Revision
                          </button>
                          <button onClick={() => setShowRejectModal(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors">
                            <X className="h-3.5 w-3.5" /> Reject Setlist
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {(setlist.review_note || setlist.approval_notes) && !['revision_requested', 'rejected'].includes(setlist.status) && (
                    <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{setlist.review_note || setlist.approval_notes}</p>
                    </div>
                  )}
                </div>

                <div className={`lg:w-80 xl:w-96 shrink-0 ${setlistTab !== 'guidance' ? 'hidden lg:block' : ''}`}>
                  <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-brand-500" /> Live Guidance
                      </p>
                      <button
                        onClick={() => setGuidanceLanguage(l => l === 'english' ? 'tagalog_english' : 'english')}
                        className="text-[10px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        {guidanceLanguage === 'english' ? 'EN' : 'TGL-EN'}
                      </button>
                    </div>
                    <LiveSetlistGuidance
                      songs={setlistSongs.sort((a, b) => a.position - b.position).map((ss, i): CheckerSong => ({
                        id: ss.id,
                        song_id: ss.song_id,
                        title: ss.songs?.title || '',
                        artist: ss.songs?.artist || '',
                        song_key: ss.performed_key || ss.songs?.song_key || '',
                        category: ss.song_category || 'Worship',
                        duration: ss.songs?.duration || '',
                        youtube_url: ss.youtube_url || ss.songs?.youtube_url || '',
                        position: i + 1,
                      }))}
                      serviceFormat={serviceFormat || 'sunday_full'}
                      language={guidanceLanguage}
                    />
                  </div>
                </div>

                {setlistTab === 'notes' && (
                  <div className="lg:hidden px-5 py-4">
                    {(setlist.review_note || setlist.approval_notes) ? (
                      <div className={`rounded-xl p-4 ${
                        setlist.status === 'revision_requested' ? 'bg-amber-50 dark:bg-amber-900/20'
                        : setlist.status === 'rejected' ? 'bg-red-50 dark:bg-red-900/20'
                        : 'bg-gray-50 dark:bg-gray-800/50'
                      }`}>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {setlist.status === 'revision_requested' ? 'Revision Notes'
                          : setlist.status === 'rejected' ? 'Rejection Reason'
                          : 'Notes'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{setlist.review_note || setlist.approval_notes}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">No notes yet</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(canManageSetlist || canReviewSetlist) && (
              <div className="card mt-3 overflow-hidden">
                <button
                  onClick={() => setShowChecker(s => !s)}
                  className="w-full flex items-center justify-between px-5 py-4"
                >
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Full Setlist Analysis
                  </h2>
                  {showChecker ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                {showChecker && (
                  <div className="px-3 sm:px-5 pb-4 sm:pb-5 border-t border-gray-100 dark:border-gray-800 pt-4">
                    <SetlistChecker
                      setlistId={setlist.id}
                      setlistStatus={setlist.status}
                      serviceFormat={serviceFormat || 'sunday_full'}
                      initialSongs={setlistSongs.sort((a, b) => a.position - b.position).map((ss, i): SetlistCheckerSong => ({
                        id: ss.id,
                        song_id: ss.song_id,
                        title: ss.songs?.title || '',
                        artist: ss.songs?.artist || '',
                        song_key: ss.performed_key || ss.songs?.song_key || '',
                        category: ss.song_category || 'Worship',
                        duration: ss.songs?.duration || '',
                        youtube_url: ss.youtube_url || ss.songs?.youtube_url || '',
                        position: i + 1,
                      }))}
                      onDecision={(decision, notes) => {
                        if (decision === 'approve') handleSetlistAction('approved', notes);
                        else if (decision === 'revision') handleSetlistAction('revision_requested', notes);
                        else if (decision === 'reject') handleSetlistAction('rejected', notes);
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign Team Member">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
              <Select
                value={assignForm.role_id}
                onChange={v => setAssignForm({ role_id: v, user_id: '' })}
                options={roles.filter(r => !r.is_leadership).map(r => ({ value: r.id, label: r.name }))}
                placeholder="Select role"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Member</label>
              <Select
                value={assignForm.user_id}
                onChange={v => setAssignForm({ ...assignForm, user_id: v })}
                options={(() => {
                  const eligible = assignForm.role_id
                    ? members.filter(m => memberRoles.some(ur => ur.user_id === m.id && ur.role_id === assignForm.role_id))
                    : members;
                  return eligible
                    .filter(m => !assignments.some(a => a.user_id === m.id && a.role_id === assignForm.role_id))
                    .map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }));
                })()}
                placeholder={assignForm.role_id ? 'Select member' : 'Pick role first'}
              />
              {assignForm.role_id && (() => {
                const eligible = members.filter(m => memberRoles.some(ur => ur.user_id === m.id && ur.role_id === assignForm.role_id));
                return eligible.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No members have this role in their profile yet.</p>
                ) : null;
              })()}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowAssign(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleAssign} disabled={!assignForm.user_id || !assignForm.role_id} className="btn-primary">Assign</button>
            </div>
          </div>
        </Modal>

        <Modal open={showSetlist} onClose={() => { setShowSetlist(false); setSongSearch(''); }} title="Add Song to Setlist">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={songSearch}
                onChange={e => setSongSearch(e.target.value)}
                placeholder="Search songs..."
                className="input-field pl-9 py-2 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1 h-72 overflow-y-auto">
              {songs
                .filter(s => !setlistSongs.some(ss => ss.song_id === s.id))
                .filter(s => {
                  const q = songSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    s.title.toLowerCase().includes(q) ||
                    (s.artist && s.artist.toLowerCase().includes(q)) ||
                    (s.song_key && s.song_key.toLowerCase().includes(q))
                  );
                })
                .map(song => {
                  const usage = songUsage[song.id];
                  const isSafe = !usage || usage.days >= 90;
                  return (
                    <button
                      key={song.id}
                      onClick={() => openSongConfig(song.id)}
                      className="flex items-center gap-3 w-full p-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{song.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{song.artist}{song.song_key && ` -- ${song.song_key}`}</p>
                      </div>
                      {usage ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium shrink-0 ${isSafe ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isSafe ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                          {usage.days}d
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 shrink-0">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <Plus className="h-4 w-4 text-gray-400 shrink-0" />
                    </button>
                  );
                })}
              {songs
                .filter(s => !setlistSongs.some(ss => ss.song_id === s.id))
                .filter(s => {
                  const q = songSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    s.title.toLowerCase().includes(q) ||
                    (s.artist && s.artist.toLowerCase().includes(q)) ||
                    (s.song_key && s.song_key.toLowerCase().includes(q))
                  );
                }).length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">
                  {songSearch.trim() ? 'No songs found' : 'No more songs available'}
                </p>
              )}
            </div>
          </div>
        </Modal>

        <Modal open={showAddSong} onClose={() => setShowAddSong(false)} title="Create New Song">
          <form onSubmit={e => { e.preventDefault(); handleCreateSong(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
              <input type="text" value={newSong.title} onChange={e => setNewSong({ ...newSong, title: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Artist</label>
              <input type="text" value={newSong.artist} onChange={e => setNewSong({ ...newSong, artist: e.target.value })} className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Key</label>
                <input type="text" value={newSong.song_key} onChange={e => setNewSong({ ...newSong, song_key: e.target.value })} className="input-field" placeholder="e.g., G" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Duration</label>
                <input type="text" value={newSong.duration} onChange={e => setNewSong({ ...newSong, duration: e.target.value })} className="input-field" placeholder="e.g., 4:30" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">YouTube Link (optional)</label>
              <input
                type="url"
                value={newSong.youtube_url}
                onChange={e => setNewSong({ ...newSong, youtube_url: e.target.value })}
                className="input-field"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddSong(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create & Add</button>
            </div>
          </form>
        </Modal>

        <Modal open={showSongConfig} onClose={() => setShowSongConfig(false)} title="Configure Song">
          <div className="space-y-4">
            {selectedSongForConfig && (() => {
              const song = songs.find(s => s.id === selectedSongForConfig);
              return song ? (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{song.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{song.artist}{song.song_key && ` -- Default Key: ${song.song_key}`}</p>
                </div>
              ) : null;
            })()}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Key</label>
              <Select
                value={songConfig.performed_key}
                onChange={v => setSongConfig({ ...songConfig, performed_key: v })}
                options={['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
                  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm'].map(k => ({ value: k, label: k }))}
                placeholder="Select key"
              />
              {selectedSongForConfig && (() => {
                const song = songs.find(s => s.id === selectedSongForConfig);
                return song?.song_key && songConfig.performed_key && songConfig.performed_key !== song.song_key ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Different from library default ({song.song_key})</p>
                ) : null;
              })()}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
              <Select
                value={songConfig.category}
                onChange={v => setSongConfig({ ...songConfig, category: v })}
                options={[
                  { value: 'Opening', label: 'Opening' },
                  { value: 'Praise', label: 'Praise' },
                  { value: 'Worship', label: 'Worship' },
                  { value: 'Offering', label: 'Offering' },
                  { value: 'Closing', label: 'Closing' },
                  { value: 'Others', label: 'Others' },
                ]}
                placeholder="Select category"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">YouTube Link (optional)</label>
              <input
                type="url"
                value={songConfig.youtube_url}
                onChange={e => setSongConfig({ ...songConfig, youtube_url: e.target.value })}
                className="input-field"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowSongConfig(false)} className="btn-secondary">Cancel</button>
              <button onClick={confirmAddSong} disabled={!songConfig.category} className="btn-primary">Add to Setlist</button>
            </div>
          </div>
        </Modal>

        <Modal open={!!editingSongId} onClose={() => setEditingSongId(null)} title="Edit Song">
          <div className="space-y-4">
            {editingSongId && (() => {
              const ss = setlistSongs.find(s => s.id === editingSongId);
              return ss?.songs ? (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{ss.songs.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{ss.songs.artist}{ss.songs.song_key && ` -- Default Key: ${ss.songs.song_key}`}</p>
                </div>
              ) : null;
            })()}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Key</label>
              <Select
                value={editSongForm.performed_key}
                onChange={v => setEditSongForm({ ...editSongForm, performed_key: v })}
                options={['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
                  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm'].map(k => ({ value: k, label: k }))}
                placeholder="Select key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
              <Select
                value={editSongForm.category}
                onChange={v => setEditSongForm({ ...editSongForm, category: v })}
                options={[
                  { value: 'Opening', label: 'Opening' },
                  { value: 'Praise', label: 'Praise' },
                  { value: 'Worship', label: 'Worship' },
                  { value: 'Offering', label: 'Offering' },
                  { value: 'Closing', label: 'Closing' },
                  { value: 'Others', label: 'Others' },
                ]}
                placeholder="Select category"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">YouTube Link (optional)</label>
              <input
                type="url"
                value={editSongForm.youtube_url}
                onChange={e => setEditSongForm({ ...editSongForm, youtube_url: e.target.value })}
                className="input-field"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditingSongId(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleUpdateSetlistSong} className="btn-primary">Save Changes</button>
            </div>
          </div>
        </Modal>

        <Modal open={!!showDecline} onClose={() => setShowDecline(null)} title="Decline Assignment" size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason (optional)</label>
              <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} className="input-field h-20 resize-none" placeholder="Why are you declining?" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDecline(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => showDecline && handleDecline(showDecline)} className="btn-danger">Decline</button>
            </div>
          </div>
        </Modal>

        <Modal open={showDeleteEvent} onClose={() => setShowDeleteEvent(false)} title="Delete Event" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <strong>{event.title}</strong>? This will also remove all assignments, setlists, and the event discussion. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteEvent(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleDeleteEvent} disabled={deleting} className="btn-danger">
                {deleting ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={showRevisionRequest} onClose={() => setShowRevisionRequest(false)} title="Request Setlist Revision" size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason for revision</label>
              <textarea
                value={revisionReason}
                onChange={e => setRevisionReason(e.target.value)}
                className="input-field h-24 resize-none"
                placeholder="Explain what needs to be revised..."
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The song leader will be notified and can see this reason.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRevisionRequest(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleRevisionRequest} disabled={!revisionReason.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-colors">
                <AlertCircle className="h-4 w-4" /> Request Revision
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Setlist" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">This setlist will be marked as Rejected. The song leader will be notified.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason (optional)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="input-field h-20 resize-none"
                placeholder="Explain why this setlist is rejected..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRejectModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleReject} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                <X className="h-4 w-4" /> Reject Setlist
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={showEditEvent} onClose={() => setShowEditEvent(false)} title="Edit Event">
          <form onSubmit={e => { e.preventDefault(); handleEditEvent(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Event Type</label>
                <Select
                  value={editForm.event_type}
                  onChange={handleEditEventTypeChange}
                  options={[
                    { value: 'Sunday Service', label: 'Sunday Service' },
                    { value: 'Prayer Meeting', label: 'Prayer Meeting' },
                    { value: 'LGTF (Midweek)', label: 'LGTF (Midweek)' },
                    { value: 'Rehearsals', label: 'Rehearsals' },
                    { value: 'Online Devotion', label: 'Online Devotion' },
                    { value: 'Equipping', label: 'Equipping' },
                    { value: 'Revamp Session', label: 'Revamp Session' },
                    { value: 'Youth Recharge', label: 'Youth Recharge' },
                  ]}
                  placeholder="Select event type"
                />
              </div>

              {['Sunday Service', 'LGTF (Midweek)', 'Prayer Meeting', 'Youth Recharge'].includes(editForm.event_type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Song Leader</label>
                  <Select
                    value={editForm.song_leader_id}
                    onChange={v => setEditForm({ ...editForm, song_leader_id: v })}
                    options={getSongLeaders().map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))}
                    placeholder="Select song leader"
                  />
                </div>
              )}

              {editForm.event_type === 'Rehearsals' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">For Sunday Service</label>
                  <Select
                    value={editForm.linked_event_id}
                    onChange={v => setEditForm({ ...editForm, linked_event_id: v })}
                    options={sundayServices.map(e => ({
                      value: e.id,
                      label: `${format(parseISO(e.event_date), 'MMM d, yyyy')} - ${e.title}`
                    }))}
                    placeholder="Select Sunday Service"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date</label>
                <input type="date" value={editForm.event_date} onChange={e => setEditForm({ ...editForm, event_date: e.target.value })} className="input-field" required />
              </div>
              {['Rehearsals', 'Revamp Session'].includes(editForm.event_type) ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Time</label>
                    <input type="time" value={editForm.start_time} onChange={e => setEditForm({ ...editForm, start_time: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Time</label>
                    <input type="time" value={editForm.end_time} onChange={e => setEditForm({ ...editForm, end_time: e.target.value })} className="input-field" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Time</label>
                    <input type="text" value={editForm.start_time ? formatTime12Hour(editForm.start_time) : 'Auto-filled'} className="input-field bg-gray-50 dark:bg-gray-800" disabled />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Time</label>
                    <input type="text" value={editForm.end_time ? formatTime12Hour(editForm.end_time) : 'Auto-filled'} className="input-field bg-gray-50 dark:bg-gray-800" disabled />
                  </div>
                </div>
              )}

              {editForm.event_date && ['Sunday Service', 'LGTF (Midweek)', 'Prayer Meeting', 'Youth Recharge'].includes(editForm.event_type) && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Proposal Due Date:</strong> {formatInTimeZone(parseISO(calculateProposalDueDate(editForm.event_date, editForm.event_type) || ''), 'Asia/Manila', "MMMM d, yyyy \'at\' h:mm a")}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optional)</label>
                <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="input-field h-20 resize-none" />
              </div>

            <div className="flex justify-end gap-3 pt-4 mt-6">
              <button type="button" onClick={() => setShowEditEvent(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
          </form>
        </Modal>

      </div>
    </div>
  );
}
