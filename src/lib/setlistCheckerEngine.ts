import type { ServiceFormat } from '../types';

export type CheckerLanguage = 'english' | 'tagalog_english';

export interface CheckerSong {
  id: string;
  song_id: string | null;
  title: string;
  artist: string;
  song_key: string;
  category: string;
  duration: string;
  youtube_url: string;
  position: number;
}

export interface SongAnalysisResult {
  score: number;
  category_fit: 'good' | 'ok' | 'poor';
  theological_flags: string[];
  placement_reason: string;
  what_works: string;
  what_to_adjust: string | null;
  emotional_tone: string;
  theological_theme: string;
  suggested_position: string | null;
  notes: string;
}

export interface SectionRequirement {
  category: string;
  label: string;
  required: boolean;
  present: boolean;
  count: number;
  recommendation: string;
}

export interface LiveGuidanceResult {
  overallScore: number;
  flowScore: number;
  contentScore: number;
  sections: SectionRequirement[];
  missingRequired: string[];
  missingSuggested: string[];
  flowIssues: string[];
  topSuggestion: string | null;
  health: 'excellent' | 'good' | 'fair' | 'poor';
  healthLabel: string;
  songAnalyses: SongAnalysisResult[];
  sequenceSuggestions: string[];
  structuralSuggestions: string[];
  fullAnalysisText: string;
}

export const SERVICE_FORMAT_LABELS: Record<ServiceFormat, string> = {
  sunday_full: 'Sunday Service — Full Flow',
  sunday_short: 'Sunday Service — Short Flow',
  special_event: 'Special Event',
  opening_closing_only: 'Opening + Closing Only',
  custom: 'Custom',
};

interface FormatSpec {
  label: string;
  required: string[];
  suggested: string[];
  description: string;
  descriptionTgl: string;
}

const FORMAT_SPECS: Record<ServiceFormat, FormatSpec> = {
  sunday_full: {
    label: 'Sunday Service — Full Flow',
    required: ['Opening', 'Praise', 'Worship', 'Closing'],
    suggested: ['Offering'],
    description: 'Full worship arc: gathering → praise → encounter → response → sendoff',
    descriptionTgl: 'Full worship arc: gathering → praise → encounter → response → sendoff',
  },
  sunday_short: {
    label: 'Sunday Service — Short Flow',
    required: ['Opening', 'Closing'],
    suggested: ['Praise', 'Worship'],
    description: 'Condensed flow: opener → 1–2 praise/worship songs → closing',
    descriptionTgl: 'Condensed flow: opener → 1–2 praise/worship songs → closing',
  },
  special_event: {
    label: 'Special Event',
    required: ['Opening'],
    suggested: ['Closing'],
    description: 'Theme-driven. Structure follows the event purpose, not a fixed worship arc.',
    descriptionTgl: 'Theme-driven. Yung structure nito follows the purpose ng event, hindi fixed worship arc.',
  },
  opening_closing_only: {
    label: 'Opening + Closing Only',
    required: ['Opening', 'Closing'],
    suggested: [],
    description: 'Brief two-song framework: one to open, one to close.',
    descriptionTgl: 'Dalawang song lang — isa para mag-open, isa para mag-close.',
  },
  custom: {
    label: 'Custom',
    required: [],
    suggested: ['Opening', 'Closing'],
    description: 'No fixed structure. Soft suggestions only.',
    descriptionTgl: 'Walang fixed structure. Soft suggestions lang ito.',
  },
};

const CATEGORY_ORDER: Record<string, number> = {
  Opening: 1, Praise: 2, Worship: 3, Offering: 4, Closing: 5, Special: 6, Others: 7,
};

const EMOTIONAL_PROFILE: Record<string, { tone: string; toneTgl: string; energy: 'high' | 'medium' | 'low' | 'intimate' }> = {
  Opening: {
    tone: 'Celebratory, inviting, communal declaration',
    toneTgl: 'Masaya, nakaka-invite, communal — pang-sama-sama',
    energy: 'high',
  },
  Praise: {
    tone: 'Joyful exaltation, proclamation, upbeat celebration',
    toneTgl: 'Masigla, proclamation, puro pag-celebrate ng kung sino ang Diyos',
    energy: 'high',
  },
  Worship: {
    tone: 'Intimate adoration, surrender, devotion, awe',
    toneTgl: 'Personal, tahimik na pag-abot sa Diyos — surrender, devotion, awe',
    energy: 'intimate',
  },
  Offering: {
    tone: 'Generosity, covenant, trust, stewardship',
    toneTgl: 'Generosity, tiwala, covenant — may connection sa giving at puso',
    energy: 'medium',
  },
  Closing: {
    tone: 'Sendoff, blessing, commissioning, peace',
    toneTgl: 'Pang-sendoff — blessing, mission, peace bago lumabas',
    energy: 'low',
  },
  Special: {
    tone: 'Contextual — tied to sermon theme or season',
    toneTgl: 'Contextual — depende sa theme ng sermon o season',
    energy: 'medium',
  },
  Others: {
    tone: 'Contextual or flexible role',
    toneTgl: 'Flexible — depende sa kung saan mo gustong i-place',
    energy: 'medium',
  },
};

const THEOLOGICAL_KEYWORDS: Record<string, {
  theme: string;
  themeTgl: string;
  goodFit: string[];
  caution: string | null;
  cautionTgl: string | null;
}> = {
  blood: {
    theme: 'Atonement / Sacrifice of Christ',
    themeTgl: 'Atonement / Sakripisyo ni Kristo',
    goodFit: ['Worship', 'Closing', 'Offering'],
    caution: 'Atonement themes work best in reflective Worship or Offering sections. Placing this in an upbeat Praise or Opening slot may feel theologically abrupt — the congregation needs a meditative space to receive this truth.',
    cautionTgl: 'Yung tema ng atonement mas ramdam sa Worship o Offering — doon mas handa ang puso para tanggapin ito. Kung ipo-place sa Opening o Praise, medyo biglaan — hindi pa naka-settle ang lahat, tapos bigla na agad yung heaviness ng sacrifice.',
  },
  cross: {
    theme: 'Crucifixion / Redemption',
    themeTgl: 'Krus / Redemption',
    goodFit: ['Worship', 'Closing', 'Offering'],
    caution: 'Cross-centered songs call for reverence and contemplation. They are most effective after the congregation has already entered a spirit of worship, not at the start when hearts are still settling.',
    cautionTgl: 'Yung mga kanta tungkol sa krus kailangan ng medyo pag-iisip at pagiging tahimik. Mas okay kung nasa Worship o Closing na siya — naka-enter na ang lahat sa worship mode, hindi sa simula pa lang na nagse-settle pa ang puso ng tao.',
  },
  sacrifice: {
    theme: 'Atonement / Surrender',
    themeTgl: 'Sakripisyo / Surrender',
    goodFit: ['Worship', 'Offering', 'Closing'],
    caution: 'Songs about sacrifice invite personal response and solemnity. Consider placing this deeper in the set after emotional engagement has been established.',
    cautionTgl: 'Yung mga kanta about sacrifice nag-iimbita ng personal na tugon — medyo serious yung feel nito. Better if later sa set, pagka-established na ng worship flow at nag-engage na ang puso ng tao.',
  },
  risen: {
    theme: 'Resurrection / Victory of Christ',
    themeTgl: 'Muling Pagkabuhay / Victory ni Kristo',
    goodFit: ['Opening', 'Praise', 'Closing'],
    caution: null,
    cautionTgl: null,
  },
  holy: {
    theme: 'Holiness / Reverence',
    themeTgl: 'Kabanalan / Paggalang sa Diyos',
    goodFit: ['Worship', 'Closing'],
    caution: null,
    cautionTgl: null,
  },
  hallelujah: {
    theme: 'Praise / Exaltation',
    themeTgl: 'Papuri / Pagdakila',
    goodFit: ['Opening', 'Praise'],
    caution: 'Hallelujah-themed songs carry an energy of joyful celebration. If placed in a Worship or Closing slot after a period of intimate reflection, it can disrupt the emotional descent into stillness.',
    cautionTgl: 'Yung Hallelujah-type songs masigla at puno ng celebration energy. Kung ipo-place sa Worship o Closing pagkatapos ng intimate reflection, baka magulo yung flow — parang biglang binalikan yung malakas na parte habang naka-settle na ang lahat sa tahimik na pagsamba.',
  },
  praise: {
    theme: 'Praise / Proclamation',
    themeTgl: 'Papuri / Proklamasyon',
    goodFit: ['Opening', 'Praise'],
    caution: 'High-praise songs placed in Worship slots can break the intimacy of a descent into adoration.',
    cautionTgl: 'Yung high-energy praise songs, kapag na-place sa Worship slot, baka magbalik yung lakas ng feeling — okay sana pero mas smooth kung nasa Opening o Praise na siya para hindi masira yung intimate descent ng set.',
  },
  rejoice: {
    theme: 'Celebration / Joy',
    themeTgl: 'Pagdiriwang / Kagalakan',
    goodFit: ['Opening', 'Praise', 'Closing'],
    caution: null,
    cautionTgl: null,
  },
  glory: {
    theme: 'Glory of God',
    themeTgl: 'Kaluwalhatian ng Diyos',
    goodFit: ['Praise', 'Worship', 'Opening'],
    caution: null,
    cautionTgl: null,
  },
  grace: {
    theme: 'Grace / Unmerited Favour',
    themeTgl: 'Grace / Walang-karapatang Pagmamahal ng Diyos',
    goodFit: ['Worship', 'Offering', 'Closing'],
    caution: null,
    cautionTgl: null,
  },
  mercy: {
    theme: 'Mercy / Forgiveness',
    themeTgl: 'Awa / Kapatawaran',
    goodFit: ['Worship', 'Closing', 'Offering'],
    caution: null,
    cautionTgl: null,
  },
  salvation: {
    theme: 'Salvation / Gospel',
    themeTgl: 'Kaligtasan / Gospel',
    goodFit: ['Praise', 'Closing', 'Special'],
    caution: null,
    cautionTgl: null,
  },
  spirit: {
    theme: 'Holy Spirit / Presence',
    themeTgl: 'Banal na Espiritu / Presensya ng Diyos',
    goodFit: ['Worship', 'Closing'],
    caution: null,
    cautionTgl: null,
  },
  fire: {
    theme: 'Revival / Passion / Refining',
    themeTgl: 'Revival / Sigasig / Paglilinis',
    goodFit: ['Praise', 'Opening', 'Special'],
    caution: null,
    cautionTgl: null,
  },
  worthy: {
    theme: 'Worthiness of God / Adoration',
    themeTgl: 'Pagiging Karapat-dapat ng Diyos / Pagsamba',
    goodFit: ['Worship', 'Closing'],
    caution: null,
    cautionTgl: null,
  },
  king: {
    theme: 'Lordship / Kingship of Christ',
    themeTgl: 'Paghahari ni Kristo / Panginoon',
    goodFit: ['Opening', 'Praise', 'Closing'],
    caution: null,
    cautionTgl: null,
  },
  love: {
    theme: 'Love of God / Responsive Love',
    themeTgl: 'Pagmamahal ng Diyos / Pagtugon ng Puso',
    goodFit: ['Worship', 'Closing', 'Offering'],
    caution: null,
    cautionTgl: null,
  },
  give: {
    theme: 'Generosity / Offering',
    themeTgl: 'Generosity / Pagbibigay',
    goodFit: ['Offering', 'Worship'],
    caution: null,
    cautionTgl: null,
  },
  send: {
    theme: 'Commissioning / Mission',
    themeTgl: 'Komisyon / Misyon',
    goodFit: ['Closing', 'Special'],
    caution: null,
    cautionTgl: null,
  },
  go: {
    theme: 'Commissioning / Sending',
    themeTgl: 'Pagiging Handa / Pag-alis na may Layunin',
    goodFit: ['Closing', 'Special'],
    caution: null,
    cautionTgl: null,
  },
  come: {
    theme: 'Invitation / Corporate Gathering',
    themeTgl: 'Paanyaya / Sama-samang Pagtitipon',
    goodFit: ['Opening', 'Praise'],
    caution: null,
    cautionTgl: null,
  },
};

function detectTheologicalTheme(title: string, language: CheckerLanguage): string {
  const lower = title.toLowerCase();
  const themes: string[] = [];
  for (const [keyword, data] of Object.entries(THEOLOGICAL_KEYWORDS)) {
    if (lower.includes(keyword)) {
      themes.push(language === 'tagalog_english' ? data.themeTgl : data.theme);
    }
  }
  if (themes.length === 0) {
    return language === 'tagalog_english' ? 'General worship / papuri' : 'General worship / praise';
  }
  return [...new Set(themes)].slice(0, 2).join(', ');
}

function analyzeSong(
  song: CheckerSong,
  index: number,
  totalSongs: number,
  allSongs: CheckerSong[],
  language: CheckerLanguage,
  format: ServiceFormat,
): SongAnalysisResult {
  const isTgl = language === 'tagalog_english';
  const titleLower = song.title.toLowerCase();
  const category = song.category;
  const profile = EMOTIONAL_PROFILE[category] ?? EMOTIONAL_PROFILE['Others'];
  const expectedOrder = CATEGORY_ORDER[category] ?? 6;
  const actualPosition = index + 1;
  const isInFirstHalf = index < totalSongs / 2;
  const isInSecondHalf = index >= totalSongs / 2;

  const theologicalTheme = detectTheologicalTheme(song.title, language);
  const flags: string[] = [];
  let what_to_adjust: string | null = null;
  let suggested_position: string | null = null;
  let positionScore = 100;

  const isHighEnergy = category === 'Opening' || category === 'Praise';
  const isIntimate = category === 'Worship' || category === 'Closing';
  const isMidSection = category === 'Offering';

  const suggestedPosTgl = 'I-move sa positions 1–3 — mas okay kung nasa unahan';
  const suggestedPosEn = 'Move to positions 1–3 (first half of the set)';
  const suggestedPosAfterOpenTgl = 'I-move sa position 3 pataas — pagkatapos ng Opening at Praise songs';
  const suggestedPosAfterOpenEn = 'Move to position 3 or later — after Opening/Praise songs';
  const suggestedPosAfterPraiseWTgl = 'I-move sa position 3 pataas — pagkatapos ng Praise at Worship songs';
  const suggestedPosAfterPraiseWEn = 'Move to position 3 or later — after Praise and Worship songs';

  if (isHighEnergy && isInSecondHalf && totalSongs > 3) {
    positionScore -= 20;
    flags.push(
      isTgl
        ? `"${song.title}" ay isang ${category} song pero nasa position ${actualPosition} na — medyo late na sa set. Mas okay kung nasa unahan ito, habang nag-eengage pa lang ang lahat.`
        : `"${song.title}" is a ${category} song at position ${actualPosition} — late in the set. ${category} songs work best early when the congregation is still gathering energy.`
    );
    suggested_position = isTgl ? suggestedPosTgl : suggestedPosEn;
  }

  if (isIntimate && isInFirstHalf && totalSongs > 3 && index < 2 && format !== 'custom') {
    positionScore -= 15;
    flags.push(
      isTgl
        ? `"${song.title}" (${category}) ay nasa simula pa lang ng set. Yung intimate worship songs mas malalim ang dating kapag may Opening at Praise muna bago pumunta doon — baka medyo biglaan kung diretso agad sa ganito.`
        : `"${song.title}" (${category}) is placed at the start. Intimate worship songs land deeper when the congregation has first been led through praise and celebration — jumping straight to intimacy can feel rushed.`
    );
    suggested_position = isTgl ? suggestedPosAfterOpenTgl : suggestedPosAfterOpenEn;
  }

  if (isMidSection && index === 0) {
    positionScore -= 25;
    flags.push(
      isTgl
        ? `"${song.title}" (Offering) ay una sa set. Yung Offering songs mas maganda kung nasa gitna o huling bahagi — doon na mas handa ang puso pagkatapos ng Praise at Worship.`
        : `"${song.title}" (Offering) is first in the set. Offering songs are designed for the middle or end — when hearts have been softened through praise and worship.`
    );
    suggested_position = isTgl ? suggestedPosAfterPraiseWTgl : suggestedPosAfterPraiseWEn;
  }

  for (const [keyword, data] of Object.entries(THEOLOGICAL_KEYWORDS)) {
    if (titleLower.includes(keyword) && data.caution && !data.goodFit.includes(category)) {
      positionScore -= 12;
      const cautionText = isTgl ? data.cautionTgl : data.caution;
      const themeLabel = isTgl ? data.themeTgl : data.theme;
      const goodFitStr = data.goodFit.join(isTgl ? ' o ' : ' or ');
      flags.push(
        isTgl
          ? `Theological note para sa "${song.title}": Yung tema ng ${themeLabel} mas fitting sa ${goodFitStr} section. ${cautionText}`
          : `Theological note for "${song.title}": The theme of ${themeLabel} is most effective in the ${goodFitStr} section. ${data.caution}`
      );
      if (!what_to_adjust) {
        what_to_adjust = isTgl
          ? `Better if i-move ito sa ${data.goodFit[0]} section — mas smooth yung theological flow ng set.`
          : `Consider moving this song to the ${data.goodFit[0]} section for a more appropriate theological flow.`;
      }
    }
  }

  const prevSong = index > 0 ? allSongs[index - 1] : null;
  if (prevSong) {
    const prevIsHighEnergy = prevSong.category === 'Opening' || prevSong.category === 'Praise';
    const currIsIntimate = category === 'Worship' || category === 'Closing';
    if (prevIsHighEnergy && currIsIntimate && index === 1 && totalSongs > 3) {
      positionScore -= 5;
      flags.push(
        isTgl
          ? `Medyo mabilis yung shift mula sa ${prevSong.category} papunta sa ${category} — okay na sana pero better if may transitional song sa pagitan para mas smooth yung emotional shift ng set.`
          : `Quick shift from ${prevSong.category} into ${category} — consider a transitional song between them to ease the emotional shift.`
      );
    }
  }

  const placementFit: 'good' | 'ok' | 'poor' =
    Math.abs(expectedOrder - actualPosition) <= 1 ? 'good'
    : Math.abs(expectedOrder - actualPosition) <= 2 ? 'ok'
    : 'poor';

  const score = Math.max(35, Math.min(100, positionScore));

  const emotionalTone = isTgl ? profile.toneTgl : profile.tone;

  const what_works = isTgl
    ? placementFit === 'good'
      ? `"${song.title}" bagay sa placement niya dito bilang ${category} song. Yung emotional tone nito — ${emotionalTone} — mas ramdam sa point na ito ng set.`
      : `"${song.title}" okay bilang ${category} song, pero yung current position niya (${actualPosition}) medyo nagse-create ng tension sa overall flow ng set.`
    : placementFit === 'good'
      ? `"${song.title}" is well-placed for a ${category} song. Its emotional tone — ${emotionalTone} — fits naturally at this point in the journey.`
      : `"${song.title}" has strong content as a ${category} song, but its current position (${actualPosition}) creates tension in the overall set flow.`;

  const placement_reason = isTgl
    ? `Yung ${category} songs, usually nasa position ${expectedOrder} sila sa set — may tone na ${emotionalTone}. Designed sila para sa ${
        isHighEnergy ? 'malakas at masayang simula ng worship' : isIntimate ? 'personal at malalim na bahagi ng set' : 'focused na moment sa gitna'
      }.`
    : `${category} songs are conventionally placed around position ${expectedOrder} in the set — characterized by ${emotionalTone}. The energy and emotion they carry is designed for ${
        isHighEnergy ? 'an open, high-energy opening' : isIntimate ? 'a deep, personal middle-to-close' : 'a focused, purposeful moment mid-set'
      }.`;

  return {
    score,
    category_fit: placementFit,
    theological_flags: flags,
    placement_reason,
    what_works,
    what_to_adjust: what_to_adjust || (flags.length > 0 ? flags[0] : null),
    emotional_tone: emotionalTone,
    theological_theme: theologicalTheme,
    suggested_position,
    notes: flags.length > 0 ? flags[0] : what_works,
  };
}

export function runLiveGuidance(
  songs: CheckerSong[],
  format: ServiceFormat,
  language: CheckerLanguage,
): LiveGuidanceResult {
  const isTgl = language === 'tagalog_english';
  const spec = FORMAT_SPECS[format];

  const categoryCounts: Record<string, number> = {};
  songs.forEach(s => { categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1; });

  const sections: SectionRequirement[] = [
    'Opening', 'Praise', 'Worship', 'Offering', 'Closing',
  ].map(cat => ({
    category: cat,
    label: cat,
    required: spec.required.includes(cat),
    present: (categoryCounts[cat] || 0) > 0,
    count: categoryCounts[cat] || 0,
    recommendation: getSectionRecommendation(cat, format, language),
  }));

  const missingRequired = spec.required.filter(cat => (categoryCounts[cat] || 0) === 0);
  const missingSuggested = spec.suggested.filter(cat => (categoryCounts[cat] || 0) === 0);

  const songAnalyses = songs.map((s, i) => analyzeSong(s, i, songs.length, songs, language, format));
  const allFlags = songAnalyses.flatMap(a => a.theological_flags);

  const flowIssues: string[] = [];
  const sequenceSuggestions: string[] = [];
  const structuralSuggestions: string[] = [];

  if (songs.length > 1) {
    const worshipIdx = songs.findIndex(s => s.category === 'Worship');
    const closingIdx = songs.findIndex(s => s.category === 'Closing');
    const praiseAfterWorship = songs.findIndex((s, i) => i > worshipIdx && worshipIdx !== -1 && (s.category === 'Praise' || s.category === 'Opening'));

    if (praiseAfterWorship !== -1) {
      flowIssues.push(
        isTgl
          ? `"${songs[praiseAfterWorship].title}" (${songs[praiseAfterWorship].category}) ay nasa tapos na ng Worship — pag-balik sa high energy pagkatapos ng intimate worship, medyo masira yung spiritual flow ng set.`
          : `"${songs[praiseAfterWorship].title}" (${songs[praiseAfterWorship].category}) appears after Worship — returning to high energy after intimate worship breaks spiritual flow.`
      );
    }

    if (closingIdx !== -1 && closingIdx < songs.length - 2) {
      flowIssues.push(
        isTgl
          ? `"${songs[closingIdx].title}" (Closing) ay nasa position ${closingIdx + 1} — hindi pa last sa set. Yung Closing song dapat nasa dulo o ikalawa mula sa dulo.`
          : `"${songs[closingIdx].title}" (Closing) is at position ${closingIdx + 1} — not at the end. Closing songs should be last or second-to-last.`
      );
    }

    if (format === 'sunday_full' || format === 'sunday_short') {
      const openingIdx = songs.findIndex(s => s.category === 'Opening');
      if (openingIdx > 0) {
        flowIssues.push(
          isTgl
            ? `Yung Opening song nasa position ${openingIdx + 1} — dapat una siya para ma-set yung tono at mapaghandaang sama-sama ang lahat.`
            : `Opening song is at position ${openingIdx + 1} — it should be first to gather the congregation.`
        );
      }
    }
  }

  missingRequired.forEach(cat => {
    sequenceSuggestions.push(getMissingCategoryGuidance(cat, format, language));
  });

  missingSuggested.forEach(cat => {
    structuralSuggestions.push(getMissingCategoryGuidance(cat, format, language));
  });

  const songScores = songAnalyses.map(a => a.score);
  const avgSongScore = songScores.length > 0
    ? Math.round(songScores.reduce((a, b) => a + b, 0) / songScores.length)
    : 100;

  const flowPenalty = flowIssues.length * 8 + missingRequired.length * 15;
  const flowScore = Math.max(0, Math.min(100, 100 - flowPenalty));

  const contentPenalty = allFlags.filter(f => f.toLowerCase().includes('theological note')).length * 10;
  const contentScore = Math.max(0, Math.min(100, 100 - contentPenalty));

  const overallScore = Math.round((avgSongScore * 0.5) + (flowScore * 0.3) + (contentScore * 0.2));

  const health: LiveGuidanceResult['health'] =
    overallScore >= 85 ? 'excellent'
    : overallScore >= 70 ? 'good'
    : overallScore >= 50 ? 'fair'
    : 'poor';

  const healthLabel = isTgl
    ? health === 'excellent' ? 'Flow maganda'
    : health === 'good' ? 'Okay yung flow'
    : health === 'fair' ? 'Kailangan pang i-improve'
    : 'May malalim na issues'
    : health === 'excellent' ? 'Excellent flow'
    : health === 'good' ? 'Good flow'
    : health === 'fair' ? 'Needs improvement'
    : 'Significant issues';

  const topSuggestion = getTopSuggestion(missingRequired, flowIssues, allFlags, format, songs, language);

  const fullAnalysisText = buildFullAnalysis(songs, songAnalyses, overallScore, flowScore, contentScore, sequenceSuggestions, structuralSuggestions, format, language);

  return {
    overallScore,
    flowScore,
    contentScore,
    sections,
    missingRequired,
    missingSuggested,
    flowIssues,
    topSuggestion,
    health,
    healthLabel,
    songAnalyses,
    sequenceSuggestions,
    structuralSuggestions,
    fullAnalysisText,
  };
}

function getSectionRecommendation(category: string, format: ServiceFormat, language: CheckerLanguage): string {
  const isTgl = language === 'tagalog_english';
  const map: Record<string, { en: string; tgl: string }> = {
    Opening: {
      en: 'High energy, communal, celebratory. Something the whole room can enter immediately.',
      tgl: 'High energy, pang-sama-sama, masaya. Yung tipong agad makakasali ang lahat.',
    },
    Praise: {
      en: 'Joyful proclamation. Bridges the gathering energy into engagement and exaltation.',
      tgl: 'Masayang proclamation. Tulay siya mula sa Opening papunta sa mas personal na worship.',
    },
    Worship: {
      en: 'Intimate and personal. Invites stillness, adoration, and encounter. The spiritual depth of the set.',
      tgl: 'Personal at tahimik. Ini-invite ang lahat na huminto at mahalin ang Diyos ng higit pa.',
    },
    Offering: {
      en: 'Connects generosity to gratitude. Songs about covenant, trust, and grace work well.',
      tgl: 'Kumokonekta ng generosity sa pasasalamat. Yung may tema ng trust, covenant, o grace bagay dito.',
    },
    Closing: {
      en: 'Sends the congregation with purpose. Mission, blessing, or steadfast faith.',
      tgl: 'Pang-sendoff — may mission, blessing, o matatag na faith declaration bago umuwi.',
    },
  };
  const entry = map[category];
  if (!entry) return '';
  const base = isTgl ? entry.tgl : entry.en;
  if (format === 'custom') return base + (isTgl ? ' (optional sa custom format)' : ' (optional in custom format)');
  return base;
}

function getMissingCategoryGuidance(cat: string, _format: ServiceFormat, language: CheckerLanguage): string {
  const isTgl = language === 'tagalog_english';
  const en: Record<string, string> = {
    Opening: `• No Opening song — the opening sets the tone and gathers the congregation's attention. Look for an upbeat, communal song that declares celebration or gathering.`,
    Praise: `• No Praise song — the Praise section bridges the Opening energy into personal worship. Without it, the set may jump too quickly from gathering into deep intimacy.`,
    Worship: `• No Worship song — the Worship section is the deepest part of the set, where the congregation is invited into personal, intimate encounter with God. Without it, the set lacks spiritual depth.`,
    Offering: `• No Offering song — consider adding a song that connects generosity to gratitude, covenant, or trust.`,
    Closing: `• No Closing song — the closing commissions the congregation with purpose and peace. Look for a song about mission, blessing, or steadfast faith.`,
  };
  const tgl: Record<string, string> = {
    Opening: `• Walang Opening song sa set. Important ito kasi siya yung nagtatakda ng tono at nagti-tipo ng energy ng lahat. Better if pumili ng masaya, pang-sama-samang kanta na magbubukas ng worship.`,
    Praise: `• Walang Praise song. Siya yung tulay mula sa Opening papunta sa mas malalim na worship. Kung wala ito, baka parang biglaan yung transition — okay na sana pero mas smooth kung may Praise muna.`,
    Worship: `• Walang Worship song sa set. Ito yung pinaka-malalim na parte — doon inaanyayahan ang bawat isa na personal na makalapit sa Diyos. Baka medyo mababaw yung set kung wala ito.`,
    Offering: `• Walang Offering song — okay sana pero better if may isang kanta na nag-co-connect ng giving sa pasasalamat, tiwala, o covenant.`,
    Closing: `• Walang Closing song. Important ito kasi ang closing ang nagse-send sa lahat na may purpose at peace. Better if pumili ng kanta na may sense of mission, blessing, o matatag na faith declaration.`,
  };
  return isTgl ? (tgl[cat] || `• Kulang: ${cat} song`) : (en[cat] || `• Missing ${cat} song — consider adding one for a complete flow.`);
}

function getTopSuggestion(
  missingRequired: string[],
  flowIssues: string[],
  allFlags: string[],
  _format: ServiceFormat,
  songs: CheckerSong[],
  language: CheckerLanguage,
): string | null {
  const isTgl = language === 'tagalog_english';
  if (missingRequired.length > 0) {
    const cat = missingRequired[0];
    return isTgl
      ? `Magdagdag ng ${cat} song — required ito sa format na ito.`
      : `Add a ${cat} song — it's required for this service format.`;
  }
  if (flowIssues.length > 0) {
    return flowIssues[0];
  }
  if (songs.length > 0 && allFlags.length > 0) {
    return isTgl
      ? 'I-review yung theological notes sa baba — may ilang songs na baka mas okay kung nasa ibang section.'
      : 'Review the theological notes below — some songs may be better placed in different sections.';
  }
  if (songs.length === 0) {
    return isTgl ? 'Magdagdag ng unang song para magsimula.' : 'Add your first song to get started.';
  }
  return null;
}

function buildFullAnalysis(
  songs: CheckerSong[],
  analyses: SongAnalysisResult[],
  overallScore: number,
  flowScore: number,
  contentScore: number,
  sequenceSuggestions: string[],
  structuralSuggestions: string[],
  format: ServiceFormat,
  language: CheckerLanguage,
): string {
  const isTgl = language === 'tagalog_english';
  const spec = FORMAT_SPECS[format];

  const ratingEn = overallScore >= 85 ? 'Excellent' : overallScore >= 70 ? 'Good' : overallScore >= 55 ? 'Needs Refinement' : 'Needs Significant Work';
  const ratingTgl = overallScore >= 85 ? 'Maganda ang set' : overallScore >= 70 ? 'Okay overall' : overallScore >= 55 ? 'Kailangan pang i-adjust' : 'May malalim na dapat baguhin';
  const rating = isTgl ? ratingTgl : ratingEn;

  const descriptionLine = isTgl ? spec.descriptionTgl : spec.description;

  let text = `**Overall: ${rating} (${overallScore}/100)** — Flow: ${flowScore}/100 · Content: ${contentScore}/100\n\n`;
  text += `**Format:** ${spec.label}\n${descriptionLine}\n\n`;

  text += isTgl ? `**Song Breakdown**\n` : `**Song Breakdown**\n`;

  songs.forEach((s, i) => {
    const a = analyses[i];
    text += `\n${i + 1}. ${s.title} (${s.category}) — Score: ${a.score}/100\n`;
    text += isTgl
      ? `   Theme: ${a.theological_theme}\n   Tone: ${a.emotional_tone}\n   Okay dito: ${a.what_works}\n`
      : `   Theme: ${a.theological_theme}\n   Tone: ${a.emotional_tone}\n   What works: ${a.what_works}\n`;
    if (a.what_to_adjust) {
      text += isTgl
        ? `   I-adjust: ${a.what_to_adjust}\n`
        : `   What to adjust: ${a.what_to_adjust}\n`;
    }
    if (a.suggested_position) {
      text += isTgl
        ? `   Suggested move: ${a.suggested_position}\n`
        : `   Suggested move: ${a.suggested_position}\n`;
    }
  });

  if (sequenceSuggestions.length > 0 || structuralSuggestions.length > 0) {
    text += isTgl
      ? `\n**Structure & Sequence Guide**\n`
      : `\n**Structure & Sequence Guidance**\n`;
    [...sequenceSuggestions, ...structuralSuggestions].forEach(s => { text += `${s}\n\n`; });
  }

  if (isTgl) {
    text += `\n**What to Look for When Choosing Songs**\n`;
    text += `• Opening: High energy, pang-lahat, masaya — yung tipong agad makakasali kahit sino sa room.\n`;
    text += `• Praise: Masayang proclamation ng kung sino ang Diyos. Build momentum mula sa Opening papunta sa mas personal na engagement.\n`;
    text += `• Worship: Personal, tahimik, reflective. Ini-invite ang lahat na huminto at lumapit sa Diyos — mas malalim kaysa sa celebration lang.\n`;
    text += `• Offering: Connecting yung pagbibigay sa pasasalamat. Yung may tema ng covenant, tiwala, o grace maganda dito.\n`;
    text += `• Closing: Nagse-send sa lahat na may layunin. Mission, blessing, o matatag na faith declaration bago umuwi.\n\n`;
    text += `_Advisory lang ito. Yung worship leader pa rin ang may final na desisyon._`;
  } else {
    text += `\n**What to Look for When Choosing Songs**\n`;
    text += `• Opening: High energy, corporate, celebratory — something everyone can enter immediately.\n`;
    text += `• Praise: Joyful proclamation of God's character. Build momentum from Opening into engagement.\n`;
    text += `• Worship: Intimate, personal, reflective. Invite stillness and adoration — go deeper than surface celebration.\n`;
    text += `• Offering: Connects generosity to gratitude. Songs about covenant, trust, and grace.\n`;
    text += `• Closing: Sends the congregation with purpose. Mission, blessing, or steadfast faith.\n\n`;
    text += `_This analysis is advisory. The worship leader has final authority._`;
  }

  return text;
}

export function inferServiceFormat(eventType: string): ServiceFormat {
  const lower = eventType.toLowerCase();
  if (lower.includes('sunday') && lower.includes('service')) return 'sunday_full';
  if (lower.includes('midweek') || lower.includes('lgtf')) return 'sunday_short';
  if (lower.includes('prayer')) return 'sunday_short';
  if (lower.includes('special') || lower.includes('occasion')) return 'special_event';
  if (lower.includes('devotion')) return 'opening_closing_only';
  return 'custom';
}

export { FORMAT_SPECS, CATEGORY_ORDER };
