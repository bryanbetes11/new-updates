export type SetlistCreationState = {
  status?: string | null;
  setlist_songs?: unknown[] | null;
};

export function isSetlistMeaningfullyCreated(setlist: SetlistCreationState | null | undefined) {
  if (!setlist) return false;
  if (setlist.status && setlist.status !== 'draft') return true;
  return (setlist.setlist_songs?.length || 0) > 0;
}
