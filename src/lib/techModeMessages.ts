export const TECH_MESSAGE_GROUPS = ['song_leader', 'guitar', 'bass', 'keys', 'drums', 'lead_vocals', 'backup_vocals', 'other'] as const;
export type TechMessageGroup = typeof TECH_MESSAGE_GROUPS[number];
export type TechModeMessages = Record<TechMessageGroup, string[]>;

export const DEFAULT_TECH_MODE_MESSAGES: TechModeMessages = {
  guitar: ['Turn Amp Down', 'Turn Amp Up', 'Check Cable', 'Mute / Unmute'],
  bass: ['Turn Amp Down', 'Turn Amp Up', 'Check Cable', 'Mute / Unmute'],
  keys: ['Keys Down', 'Keys Up', 'Check Output', 'Change Patch'],
  drums: ['Play Softer', 'Play Stronger', 'Check Mic Position', 'Ready?'],
  lead_vocals: ['Move Closer to Mic', 'Move Back from Mic', 'Check Mic', 'Ready?'],
  backup_vocals: ['Move Closer to Mic', 'Move Back from Mic', 'Check Mic', 'Ready?'],
  song_leader: ['Start Soundcheck', 'Hold Please', 'Next Song', 'Ready to Start?'],
  other: ['Lower Volume', 'Turn Up Slightly', 'Check Cable', 'Ready?'],
};

export const DEFAULT_STAGE_REQUEST_MESSAGES: TechModeMessages = {
  guitar: ['Signal Issue', 'Check DI / Cable', 'Amp Mic Issue', 'Need Tech Help'],
  bass: ['Signal Issue', 'Check DI / Cable', 'Amp Mic Issue', 'Need Tech Help'],
  keys: ['No Keys Signal', 'Check DI', 'Monitor Issue', 'Need Tech Help'],
  drums: ['Drum Mic Issue', 'Monitor Issue', 'Click Issue', 'Need Tech Help'],
  lead_vocals: ['More Monitor', 'Less Monitor', 'More Reverb', 'Mic Issue'],
  backup_vocals: ['More Monitor', 'Less Monitor', 'More Reverb', 'Mic Issue'],
  song_leader: ['Start Soundcheck', 'Hold Please', 'Stage Ready', 'Need Tech Help'],
  other: ['Signal Issue', 'Monitor Issue', 'Check Cable', 'Need Tech Help'],
};

export const TECH_MESSAGE_GROUP_LABELS: Record<TechMessageGroup, string> = {
  song_leader: 'Song Leader', guitar: 'Guitar', bass: 'Bass', keys: 'Keys', drums: 'Drums', lead_vocals: 'Lead Vocals', backup_vocals: 'Backup Vocals', other: 'Other stage roles',
};

export function getTechMessageGroup(roleName: string): TechMessageGroup {
  const role = roleName.toLowerCase();
  if (role.includes('song leader') || role.includes('worship leader')) return 'song_leader';
  if (role.includes('backup vocal') || role.includes('background vocal')) return 'backup_vocals';
  if (role.includes('vocal') || role.includes('singer')) return 'lead_vocals';
  if (role.includes('key') || role.includes('piano')) return 'keys';
  if (role.includes('drum')) return 'drums';
  if (role.includes('bass')) return 'bass';
  if (role.includes('guitar')) return 'guitar';
  return 'other';
}

const storageKey = (orgId: string) => `servesync:tech-mode-messages:${orgId}`;
const stageStorageKey = (orgId: string) => `servesync:stage-request-messages:${orgId}`;

function loadMessages(key: string, defaults: TechModeMessages): TechModeMessages {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}') as Partial<TechModeMessages>;
    return Object.fromEntries(TECH_MESSAGE_GROUPS.map(group => [group, Array.from({ length: 4 }, (_, index) => saved[group]?.[index]?.trim() || defaults[group][index])])) as TechModeMessages;
  } catch { return defaults; }
}

export function loadTechModeMessages(orgId?: string | null): TechModeMessages {
  if (!orgId || typeof window === 'undefined') return DEFAULT_TECH_MODE_MESSAGES;
  return loadMessages(storageKey(orgId), DEFAULT_TECH_MODE_MESSAGES);
}

export function loadStageRequestMessages(orgId?: string | null): TechModeMessages {
  if (!orgId || typeof window === 'undefined') return DEFAULT_STAGE_REQUEST_MESSAGES;
  return loadMessages(stageStorageKey(orgId), DEFAULT_STAGE_REQUEST_MESSAGES);
}

export function saveTechModeMessages(orgId: string, messages: TechModeMessages) {
  try { localStorage.setItem(storageKey(orgId), JSON.stringify(messages)); } catch { /* Shared settings remain canonical. */ }
  window.dispatchEvent(new CustomEvent('servesync:tech-mode-messages-updated', { detail: { orgId, messages } }));
}

export function saveStageRequestMessages(orgId: string, messages: TechModeMessages) {
  try { localStorage.setItem(stageStorageKey(orgId), JSON.stringify(messages)); } catch { /* Shared settings remain canonical. */ }
  window.dispatchEvent(new CustomEvent('servesync:stage-request-messages-updated', { detail: { orgId, messages } }));
}
