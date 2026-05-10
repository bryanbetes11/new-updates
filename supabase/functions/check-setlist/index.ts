import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SongInput {
  title: string;
  artist: string;
  lyrics?: string;
  slot: 'Opening' | 'Praise' | 'Worship' | 'Closing' | 'Offering' | 'Special' | 'Others';
}

type QResult = 'Pass' | 'Needs Revision' | 'Fail';
type SongDecision = 'APPROVED' | 'APPROVED_WITH_CAUTION' | 'NEEDS_LEADER_REVIEW' | 'REJECTED';
type Verdict = 'APPROVE' | 'REVISE' | 'REJECT';
type PriorityTier = 'gospel_core' | 'god_centered' | 'experience_focused';

interface TheologicalFlag {
  songTitle: string;
  lyricExcerpt: string;
  flagType: string;
  concern: string;
  recommendation: string;
}

interface SlotCheck {
  title: string;
  artist: string;
  slot: string;
  fits: boolean;
  reason: string;
  action: SongDecision;
  priorityTier: PriorityTier;
}

interface FiveQTest {
  title: string;
  artist: string;
  slot: string;
  q1: { result: QResult; reason: string };
  q2: { result: QResult; reason: string };
  q3: { result: QResult; reason: string };
  q4: { result: QResult; reason: string };
  q5: { result: QResult; reason: string };
  passedQuestions: number;
  flaggedQuestions: number;
  decision: SongDecision;
  leaderNote: string;
}

interface GospelCheck {
  question: string;
  passed: boolean;
  explanation: string;
}

interface SetlistCheckReport {
  verdict: Verdict;
  rating: number;
  verdictExplanation: string;
  flowCheck: {
    ok: boolean;
    issues: string[];
    actsSummary: { act: string; purpose: string; songTitles: string[] }[];
  };
  slotFitCheck: SlotCheck[];
  suggestedFlowCorrection?: {
    orderedSongs: { title: string; slot: string }[];
    fixes: string[];
  };
  themeAlignment: {
    theme: string;
    skipped?: boolean;
    summary?: string;
    strengths: { title: string; reason: string }[];
    mismatches: { title: string; reason: string }[];
  };
  gospelCenteredness: {
    checks: GospelCheck[];
    allPassed: boolean;
  };
  theologicalFlags: TheologicalFlag[];
  fiveQuestionTest: FiveQTest[];
  actionPlan: string[];
  discordText: string;
  analyzedAt: string;
  language: string;
  songsWithLyrics: { title: string; artist: string; slot: string; lyricsSource: 'provided' | 'fetched' | 'unavailable' }[];
}

// Internal song type with resolved lyrics
interface Song extends SongInput {
  lyrics: string;
}

// ---------------------------------------------------------------------------
// Keyword Lists
// ---------------------------------------------------------------------------

const GOSPEL_KW = ['cross', 'blood', 'sacrifice', 'grace', 'mercy', 'forgiveness', 'savior', 'redeemer', 'jesus', 'christ', 'salvation', 'resurrection', 'died', 'risen', 'atoned', 'atonement'];
const SELF_FOCUS_KW = ['i will', 'i can', 'i must', 'my strength', 'my power'];
const EXPERIENCE_KW = ['change the atmosphere', 'feel his presence', 'touch from heaven', 'feel the spirit', 'encounter'];
const MANIPULATION_KW = ['our praise brings god down', 'change the atmosphere', 'shift the atmosphere', 'invite his presence down'];
const PROSPERITY_KW = ['god will bless me if', 'give me success', 'bless me'];
const CHARISMATIC_EXCESS_KW = ['breakthrough', 'open heaven', 'release'];
const MORALISM_KW = ['try harder', 'be holy', 'surrender all'];
const CHRIST_NAME_KW = ['jesus', 'christ', 'savior', 'lord', 'redeemer'];
const GOD_CHARACTER_KW = ['holy', 'faithful', 'king', 'sovereign', 'great', 'mighty', 'worthy', 'majesty', 'glory', 'awesome', 'good', 'wonderful', 'gracious', 'glorious', 'eternal', 'everlasting', 'compassion', 'goodness', 'steadfast', 'righteous', 'love', 'powerful', 'name'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasAny(text: string, kws: string[]): boolean {
  const lower = text.toLowerCase();
  return kws.some(kw => lower.includes(kw));
}

function firstMatch(text: string, kws: string[]): string | null {
  const lower = text.toLowerCase();
  const lines = text.split('\n');
  for (const kw of kws) {
    if (lower.includes(kw)) {
      for (const line of lines) {
        if (line.toLowerCase().includes(kw)) {
          return line.trim().slice(0, 100);
        }
      }
    }
  }
  return null;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

// ---------------------------------------------------------------------------
// Lyrics Fetching
// ---------------------------------------------------------------------------

async function fetchLyrics(artist: string, title: string): Promise<{ lyrics: string; source: 'fetched' | 'unavailable' }> {
  // Strip parenthetical suffixes like "(Lakewood)", "(Live)", "(feat. ...)"
  const cleanTitle = title.replace(/\s*\([^)]*\)\s*/g, '').trim();
  const titlesToTry = cleanTitle && cleanTitle !== title ? [cleanTitle, title] : [title];

  for (const t of titlesToTry) {
    try {
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(t)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (data.lyrics && typeof data.lyrics === 'string' && data.lyrics.trim().length > 20) {
            return { lyrics: data.lyrics.trim().slice(0, 2000), source: 'fetched' };
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (_e) {
      // try next title variant
    }
  }
  return {
    lyrics: `[Lyrics for "${title}" by ${artist} could not be automatically retrieved. Please add them manually.]`,
    source: 'unavailable',
  };
}

// ---------------------------------------------------------------------------
// Slot Inference
// ---------------------------------------------------------------------------

function inferSlot(song: SongInput, index: number, total: number): SongInput['slot'] {
  const lyrics = song.lyrics ?? '';
  if (index === 0) return 'Opening';
  if (index === total - 1) {
    return hasAny(lyrics, ['send', 'go', 'rest', 'grace']) ? 'Closing' : 'Worship';
  }
  if (hasAny(lyrics, GOSPEL_KW)) return 'Worship';
  if (hasAny((song.title + ' ' + lyrics), ['praise', 'joy', 'celebrate', 'rejoice'])) return 'Praise';
  return 'Praise';
}

// ---------------------------------------------------------------------------
// Priority Tier
// ---------------------------------------------------------------------------

function getPriorityTier(lyrics: string): PriorityTier {
  // When lyrics couldn't be fetched, give benefit of the doubt
  if (lyrics.startsWith('[Lyrics for')) return 'god_centered';
  if (hasAny(lyrics, GOSPEL_KW)) return 'gospel_core';
  if (hasAny(lyrics, [...GOD_CHARACTER_KW, ...CHRIST_NAME_KW])) return 'god_centered';
  return 'experience_focused';
}

// ---------------------------------------------------------------------------
// Language Helper
// ---------------------------------------------------------------------------

function makeTranslator(language: 'english' | 'taglish') {
  return function t(en: string, tgl: string): string {
    return language === 'taglish' ? tgl : en;
  };
}

// ---------------------------------------------------------------------------
// Slot Fit Check
// ---------------------------------------------------------------------------

function checkSlotFit(song: Song, priorityTier: PriorityTier, t: ReturnType<typeof makeTranslator>): Omit<SlotCheck, 'title' | 'artist' | 'priorityTier'> {
  const lyrics = song.lyrics;
  const slot = song.slot;

  switch (slot) {
    case 'Opening': {
      const hasGodChar = hasAny(lyrics, GOD_CHARACTER_KW);
      const hasGospelProclamation = hasAny(lyrics, ['cross', 'blood', 'sacrifice', 'atonement']);
      if (hasGodChar) {
        return {
          slot,
          fits: true,
          reason: t(
            'Establishes who God is — appropriate Call to Worship',
            'Nagtatayo ng sino ang Diyos — angkop na Call to Worship'
          ),
          action: 'APPROVED',
        };
      } else if (hasGospelProclamation && !hasGodChar) {
        return {
          slot,
          fits: false,
          reason: t(
            'Gospel proclamation language (cross/blood) belongs in the Worship slot, not the opening call to worship',
            'Ang language ng Gospel proclamation (cross/blood) ay dapat nasa Worship slot, hindi sa opening call to worship'
          ),
          action: 'APPROVED_WITH_CAUTION',
        };
      } else if (priorityTier === 'experience_focused') {
        return {
          slot,
          fits: false,
          reason: t(
            'Experience-heavy opening — needs more God-centered language to properly gather the congregation',
            'Experience-heavy ang opening — kailangan ng mas God-centered na language para ma-gather nang maayos ang congregation'
          ),
          action: 'NEEDS_LEADER_REVIEW',
        };
      } else {
        return {
          slot,
          fits: true,
          reason: t(
            'Acceptable opening — no major concerns detected',
            'Okay ang opening — walang major concerns na nakita'
          ),
          action: 'APPROVED',
        };
      }
    }

    case 'Praise': {
      const hasStrongGospel = hasAny(lyrics, ['cross', 'blood', 'sacrifice', 'atonement', 'died', 'risen', 'resurrection']);
      const hasSelfFocusNoGospel = hasAny(lyrics, SELF_FOCUS_KW) && !hasAny(lyrics, GOSPEL_KW) && !hasAny(lyrics, GOD_CHARACTER_KW);
      const hasManipulation = hasAny(lyrics, MANIPULATION_KW);
      if (hasManipulation) {
        return {
          slot,
          fits: false,
          reason: t(
            'Contains manipulation-of-presence language — not appropriate for congregational worship',
            'May manipulation-of-presence language — hindi angkop para sa congregational worship'
          ),
          action: 'NEEDS_LEADER_REVIEW',
        };
      } else if (hasSelfFocusNoGospel) {
        return {
          slot,
          fits: false,
          reason: t(
            'Self-focused language without God-centered grounding — not appropriate for Praise slot',
            'Self-focused ang language nang walang God-centered grounding — hindi angkop sa Praise slot'
          ),
          action: 'NEEDS_LEADER_REVIEW',
        };
      } else if (hasStrongGospel) {
        return {
          slot,
          fits: false,
          reason: t(
            'Strong Gospel proclamation language — this song belongs in the Worship slot for maximum impact',
            'Malakas ang Gospel proclamation language — dapat ito nasa Worship slot para mas maimpact'
          ),
          action: 'APPROVED_WITH_CAUTION',
        };
      } else if (priorityTier === 'god_centered' || priorityTier === 'gospel_core') {
        return {
          slot,
          fits: true,
          reason: t(
            'God-centered or Gospel-core content fits the Praise slot well',
            'God-centered o Gospel-core ang content — angkop sa Praise slot'
          ),
          action: 'APPROVED',
        };
      } else {
        return {
          slot,
          fits: true,
          reason: t(
            'Celebratory song in Praise slot — verify it genuinely praises God and does not merely create emotional atmosphere',
            'Celebratory song sa Praise slot — siguraduhing talagang nagpupuri sa Diyos at hindi lang lumilikha ng emotional atmosphere'
          ),
          action: 'APPROVED_WITH_CAUTION',
        };
      }
    }

    case 'Worship': {
      const hasGospelLang = hasAny(lyrics, GOSPEL_KW);
      const isExperienceHeavy = hasAny(lyrics, EXPERIENCE_KW) && !hasGospelLang;
      const hasSelfEffort = hasAny(lyrics, SELF_FOCUS_KW) && hasGospelLang;
      if (!hasGospelLang) {
        return {
          slot,
          fits: false,
          reason: t(
            'This slot requires explicit Gospel proclamation — no Gospel language found',
            'Ang slot na ito ay nangangailangan ng explicit Gospel proclamation — walang Gospel language na nakita'
          ),
          action: isExperienceHeavy ? 'APPROVED_WITH_CAUTION' : 'NEEDS_LEADER_REVIEW',
        };
      } else if (hasSelfEffort) {
        return {
          slot,
          fits: true,
          reason: t(
            'Gospel language present but mixed with self-effort themes — review carefully',
            'May Gospel language pero halo ng self-effort themes — i-review nang mabuti'
          ),
          action: 'APPROVED_WITH_CAUTION',
        };
      } else {
        return {
          slot,
          fits: true,
          reason: t(
            'Gospel language present — appropriate for the Worship slot',
            'May Gospel language — angkop sa Worship slot'
          ),
          action: 'APPROVED',
        };
      }
    }

    case 'Closing': {
      const hasSendingLang = hasAny(lyrics, ['send', 'go', 'rest', 'faith', 'trust', 'surrender', 'grace', 'mercy']);
      const hasMoralismNoGrace = hasAny(lyrics, MORALISM_KW) && !hasAny(lyrics, ['grace', 'christ', 'jesus']);
      const isExperienceHeavy = hasAny(lyrics, EXPERIENCE_KW) && !hasAny(lyrics, GOSPEL_KW);
      if (hasMoralismNoGrace) {
        return {
          slot,
          fits: false,
          reason: t(
            'Closes on human effort without Gospel grounding — moralism without grace',
            'Nagtatapos sa human effort nang walang Gospel grounding — moralism nang walang grace'
          ),
          action: 'NEEDS_LEADER_REVIEW',
        };
      } else if (isExperienceHeavy) {
        return {
          slot,
          fits: false,
          reason: t(
            'Closing should anchor in grace, not atmosphere — experience-heavy language detected',
            'Ang Closing ay dapat naka-anchor sa grace, hindi sa atmosphere — experience-heavy ang language nito'
          ),
          action: 'NEEDS_LEADER_REVIEW',
        };
      } else if (hasSendingLang) {
        return {
          slot,
          fits: true,
          reason: t(
            'Contains sending/grace language — appropriate for the Closing slot',
            'May sending/grace language — angkop sa Closing slot'
          ),
          action: 'APPROVED',
        };
      } else {
        return {
          slot,
          fits: false,
          reason: t(
            'Closing song lacks clear grace-anchored or sending language',
            'Ang Closing song ay walang malinaw na grace-anchored o sending language'
          ),
          action: 'APPROVED_WITH_CAUTION',
        };
      }
    }

    case 'Offering':
    case 'Special':
    case 'Others':
    default:
      return {
        slot,
        fits: true,
        reason: t(
          'Flexible slot — verify theological content fits service context',
          'Flexible slot — i-verify na ang theological content ay angkop sa service context'
        ),
        action: 'APPROVED_WITH_CAUTION',
      };
  }
}

// ---------------------------------------------------------------------------
// Flow Check
// ---------------------------------------------------------------------------

function runFlowCheck(
  songs: Song[],
  t: ReturnType<typeof makeTranslator>
): SetlistCheckReport['flowCheck'] {
  const issues: string[] = [];

  const openingSlots = ['Opening', 'Praise'];
  const worshipSlots = ['Worship'];
  const closingSlots = ['Closing'];

  const act1Songs = songs.filter(s => openingSlots.includes(s.slot));
  const act2Songs = songs.filter(s => worshipSlots.includes(s.slot));
  const act3Songs = songs.filter(s => closingSlots.includes(s.slot));

  const actsSummary = [
    {
      act: t('Act 1 — Call to Worship', 'Act 1 — Call to Worship'),
      purpose: t('Gather and engage the congregation through praise and exaltation of God', 'I-gather at i-engage ang congregation sa pamamagitan ng papuri at pagdadakila sa Diyos'),
      songTitles: act1Songs.map(s => s.title),
    },
    {
      act: t('Act 2 — Gospel Proclamation', 'Act 2 — Gospel Proclamation'),
      purpose: t('Proclaim the finished work of Christ — the cross, grace, and redemption', 'Ipahayag ang natapos na gawa ni Cristo — ang krus, grace, at pagtutubos'),
      songTitles: act2Songs.map(s => s.title),
    },
    {
      act: t('Act 3 — Response', 'Act 3 — Response'),
      purpose: t('Anchor the response in grace and send the congregation out in faith', 'I-anchor ang response sa grace at ipadala ang congregation nang may pananampalataya'),
      songTitles: act3Songs.map(s => s.title),
    },
  ];

  // Check 1: No Worship songs
  if (act2Songs.length === 0) {
    issues.push(t(
      'No Gospel Proclamation song — the congregation never hears the Gospel proclaimed. This is the most critical gap.',
      'Walang Gospel Proclamation song — hindi naririnig ng congregation ang Gospel na ipinahayag. Ito ang pinaka-kritikal na problema.'
    ));
  }

  // Check 2: No Closing songs
  if (act3Songs.length === 0) {
    issues.push(t(
      'No Closing/Response song — the set ends without a grace-anchored response or sending.',
      'Walang Closing/Response song — ang set ay nagtatapos nang walang grace-anchored response o sending.'
    ));
  }

  // Check 3: First song is not Opening
  if (songs.length > 0 && songs[0].slot !== 'Opening') {
    issues.push(t(
      'First song is not a Call to Worship — the congregation is not properly gathered before proclamation.',
      'Ang unang kanta ay hindi isang Call to Worship — hindi nang maayos na naka-gather ang congregation bago ang proclamation.'
    ));
  }

  // Check 4: Last song is not Closing
  if (songs.length > 0 && songs[songs.length - 1].slot !== 'Closing') {
    issues.push(t(
      'Last song is not a Closing/Response — the set ends on proclamation or celebration instead of a grace-anchored response.',
      'Ang huling kanta ay hindi isang Closing/Response — ang set ay nagtatapos sa proclamation o celebration sa halip na isang grace-anchored response.'
    ));
  }

  // Check 5: Worship appears before all Praise songs
  const lastPraiseIdx = songs.reduce((acc, s, i) => s.slot === 'Praise' ? i : acc, -1);
  const firstWorshipIdx = songs.findIndex(s => s.slot === 'Worship');
  if (firstWorshipIdx !== -1 && lastPraiseIdx !== -1 && firstWorshipIdx < lastPraiseIdx) {
    issues.push(t(
      'Worship (Gospel Proclamation) appears before Praise songs — the congregation needs time to be engaged before receiving the Gospel.',
      'Ang Worship (Gospel Proclamation) ay lumabas bago ang Praise songs — kailangan ng congregation ng oras para ma-engage bago matanggap ang Gospel.'
    ));
  }

  return { ok: issues.length === 0, issues, actsSummary };
}

// ---------------------------------------------------------------------------
// Gospel-Centeredness
// ---------------------------------------------------------------------------

function runGospelCenteredness(
  songs: Song[],
  t: ReturnType<typeof makeTranslator>
): SetlistCheckReport['gospelCenteredness'] {
  const combined = songs.map(s => s.lyrics).join('\n');

  const check1Passed = hasAny(combined, ['jesus', 'christ', 'savior', 'redeemer']);
  const check2Passed = hasAny(combined, ['grace', 'mercy', 'forgiveness']);
  const check3Passed = hasAny(combined, ['faith', 'trust']) && hasAny(combined, ['cross', 'blood']);

  const checks: GospelCheck[] = [
    {
      question: t(
        "Is Christ's person and work clearly proclaimed?",
        'Malinaw bang ipinahayag ang pagkatao at gawa ni Cristo?'
      ),
      passed: check1Passed,
      explanation: check1Passed
        ? t(
          "Christ's person and work are clearly proclaimed in the setlist.",
          'Malinaw na ipinahayag ang pagkatao at gawa ni Cristo sa setlist.'
        )
        : t(
          "The setlist lacks clear proclamation of Christ's person and work. Songs reference God in general terms without specific focus on Jesus and His redemptive work. This risks promoting generic spirituality rather than biblical Christianity.",
          'Kulang ang setlist ng malinaw na pahayag ng pagkatao at gawa ni Cristo. Ang mga kanta ay nagre-refer sa Diyos sa pangkalahatang paraan nang walang specific na focus kay Jesus at sa Kanyang redemptive work. Ito ay nagbibigay-panganib na mag-promote ng generic spirituality kaysa biblical Christianity.'
        ),
    },
    {
      question: t(
        'Is grace emphasized over self-effort?',
        'Binibigyang-diin ba ang grace kaysa self-effort?'
      ),
      passed: check2Passed,
      explanation: check2Passed
        ? t(
          'Grace is clearly emphasized over self-effort in the setlist.',
          'Malinaw na binibigyang-diin ang grace kaysa self-effort sa setlist.'
        )
        : t(
          "The setlist leans toward moralism and self-effort rather than grace. Without clear emphasis on God's unmerited favor through Christ, these songs risk promoting a works-based approach that contradicts the Gospel.",
          'Ang setlist ay mas nagtutulak sa moralism at self-effort kaysa grace. Nang walang malinaw na emphasis sa unmerited favor ng Diyos sa pamamagitan ni Cristo, ang mga kantang ito ay nanganganib na mag-promote ng works-based na approach na salungat sa Gospel.'
        ),
    },
    {
      question: t(
        "Is the response rooted in Christ's finished work?",
        "Ang response ba ay nakaugat sa natapos na gawa ni Cristo?"
      ),
      passed: check3Passed,
      explanation: check3Passed
        ? t(
          "The response is rooted in Christ's finished work.",
          "Ang response ay nakaugat sa natapos na gawa ni Cristo."
        )
        : t(
          "The response songs lack clear connection to Christ's finished work. Faith and trust must flow from what Christ has accomplished, not from human resolve. Without this foundation, we promote decisional Christianity rather than Gospel-centered faith.",
          "Ang mga response songs ay kulang ng malinaw na koneksyon sa natapos na gawa ni Cristo. Ang pananampalataya at tiwala ay dapat manggaling sa ginawa ni Cristo, hindi sa human resolve. Nang walang pundasyon na ito, nag-promote tayo ng decisional Christianity kaysa Gospel-centered faith."
        ),
    },
  ];

  return { checks, allPassed: checks.every(c => c.passed) };
}

// ---------------------------------------------------------------------------
// Theological Flags
// ---------------------------------------------------------------------------

function runTheologicalFlags(
  songs: Song[],
  t: ReturnType<typeof makeTranslator>
): TheologicalFlag[] {
  const flags: TheologicalFlag[] = [];

  for (const song of songs) {
    const lyrics = song.lyrics;
    const wc = wordCount(lyrics);

    // Flag 1 — Manipulation
    if (hasAny(lyrics, MANIPULATION_KW)) {
      const excerpt = firstMatch(lyrics, MANIPULATION_KW) ?? '';
      flags.push({
        songTitle: song.title,
        lyricExcerpt: excerpt,
        flagType: t('Manipulation', 'Manipulation'),
        concern: t(
          "This language suggests manipulative worship — treating praise as a tool to invoke God's presence or change spiritual conditions. Our guidelines warn against this approach.",
          "Ang language na ito ay nagmumungkahi ng manipulative worship — ginagamit ang papuri bilang tool para isinvoke ang presensya ng Diyos o baguhin ang spiritual conditions. Binababalaan tayo ng aming mga guidelines laban sa ganitong approach."
        ),
        recommendation: t(
          "REPLACE — Find a song that worships God for who He is, not as a technique to produce an outcome.",
          "PALITAN — Hanapin ng kanta na sumasamba sa Diyos dahil sa kung sino Siya, hindi bilang teknik para makagawa ng resulta."
        ),
      });
    }

    // Flag 2 — Prosperity
    if (hasAny(lyrics, PROSPERITY_KW)) {
      const excerpt = firstMatch(lyrics, PROSPERITY_KW) ?? '';
      flags.push({
        songTitle: song.title,
        lyricExcerpt: excerpt,
        flagType: t('Prosperity Gospel', 'Prosperity Gospel'),
        concern: t(
          'This language suggests a transactional, prosperity-focused approach to God rather than worship rooted in His character and grace.',
          'Ang language na ito ay nagmumungkahi ng isang transactional, prosperity-focused na approach sa Diyos kaysa worship na nakaugat sa Kanyang character at grace.'
        ),
        recommendation: t(
          "REPLACE — Find a song that focuses on God's character and completed work rather than requesting personal benefits.",
          "PALITAN — Hanapin ng kanta na nagfo-focus sa character ng Diyos at Kanyang natapos na gawa kaysa humingi ng personal na benepisyo."
        ),
      });
    }

    // Flag 3 — Moralism
    if (hasAny(lyrics, SELF_FOCUS_KW) && !hasAny(lyrics, ['grace', 'christ', 'jesus', 'cross', 'blood'])) {
      const excerpt = firstMatch(lyrics, SELF_FOCUS_KW) ?? '';
      flags.push({
        songTitle: song.title,
        lyricExcerpt: excerpt,
        flagType: t('Moralism', 'Moralism'),
        concern: t(
          "This represents moralism — focusing on human commitment and effort without grounding it in God's grace and Christ's enabling power.",
          "Ito ay kumakatawan sa moralism — nagfo-focus sa human commitment at pagsisikap nang hindi ito inuugat sa grace ng Diyos at enabling power ni Cristo."
        ),
        recommendation: t(
          "MOVE to later in set with pastoral note, or REPLACE if grace foundation is absent.",
          "ILIPAT sa later na bahagi ng set na may pastoral note, o PALITAN kung wala ang grace foundation."
        ),
      });
    }

    // Flag 4 — Charismatic excess
    if (hasAny(lyrics, CHARISMATIC_EXCESS_KW) && !hasAny(lyrics, GOSPEL_KW)) {
      const excerpt = firstMatch(lyrics, CHARISMATIC_EXCESS_KW) ?? '';
      flags.push({
        songTitle: song.title,
        lyricExcerpt: excerpt,
        flagType: t('Charismatic Excess', 'Charismatic Excess'),
        concern: t(
          "Language about 'breakthrough' or 'open heaven' without biblical grounding can promote a transactional view of worship.",
          "Ang language tungkol sa 'breakthrough' o 'open heaven' nang walang biblical grounding ay maaaring mag-promote ng transactional view ng worship."
        ),
        recommendation: t(
          'REVIEW with leader — ensure the song is grounded in Scripture and Gospel, not formula.',
          'I-REVIEW kasama ang leader — tiyakin na ang kanta ay nakaugat sa Scripture at Gospel, hindi formula.'
        ),
      });
    }

    // Flag 5 — Experience-heavy
    if (hasAny(lyrics, EXPERIENCE_KW) && !hasAny(lyrics, GOSPEL_KW)) {
      const excerpt = firstMatch(lyrics, EXPERIENCE_KW) ?? '';
      flags.push({
        songTitle: song.title,
        lyricExcerpt: excerpt,
        flagType: t('Experience-Heavy', 'Experience-Heavy'),
        concern: t(
          'This song focuses primarily on experience or atmosphere without Gospel grounding. Per MCJC guidelines, experience-focused songs must be anchored by stronger Gospel-rich songs.',
          'Ang kantang ito ay pangunahing nagfo-focus sa experience o atmosphere nang walang Gospel grounding. Ayon sa MCJC guidelines, ang mga experience-focused na kanta ay dapat na-anchor ng mas malakas na Gospel-rich na mga kanta.'
        ),
        recommendation: t(
          'USE SPARINGLY — only if surrounded by Gospel-rich songs in the set.',
          'GAMITIN NANG KONTI — tanging kung napapalibutan ng Gospel-rich na mga kanta sa set.'
        ),
      });
    }

    // Flag 6 — No Christ, no Gospel
    if (!hasAny(lyrics, CHRIST_NAME_KW) && !hasAny(lyrics, GOSPEL_KW) && wc > 30) {
      const firstLine = lyrics.split('\n').find(l => l.trim().length > 0)?.trim().slice(0, 100) ?? '';
      flags.push({
        songTitle: song.title,
        lyricExcerpt: firstLine,
        flagType: t('No Christ, No Gospel', 'Walang Cristo, Walang Gospel'),
        concern: t(
          'This song has no mention of Christ and no clear Gospel language. It risks generic spirituality that could apply to any religion.',
          'Ang kantang ito ay walang binanggit na Cristo at walang malinaw na Gospel language. Nanganganib itong maging generic spirituality na maaaring ilapat sa kahit anong relihiyon.'
        ),
        recommendation: t(
          'NEEDS LEADER REVIEW — verify this song has clear Christian meaning in context.',
          'KAILANGAN NG LEADER REVIEW — i-verify na ang kantang ito ay may malinaw na Christian meaning sa konteksto.'
        ),
      });
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Five-Question Test
// ---------------------------------------------------------------------------

function runFiveQuestionTest(
  songs: Song[],
  t: ReturnType<typeof makeTranslator>
): FiveQTest[] {
  return songs.map(song => {
    const lyrics = song.lyrics;
    const wc = wordCount(lyrics);

    // Q1 — Christ-exalting?
    const q1HasChrist = hasAny(lyrics, ['jesus', 'christ', 'savior', 'lord', 'redeemer']);
    const q1SelfFocusNoGospel = hasAny(lyrics, SELF_FOCUS_KW) && !hasAny(lyrics, GOSPEL_KW);
    let q1Result: QResult;
    let q1Reason: string;
    if (q1HasChrist) {
      q1Result = 'Pass';
      q1Reason = t('Contains explicit Christ-centered language', 'May explicit na Christ-centered language');
    } else if (q1SelfFocusNoGospel) {
      q1Result = 'Fail';
      q1Reason = t('Self-focused language without Gospel grounding', 'Self-focused ang language nang walang Gospel grounding');
    } else {
      q1Result = 'Needs Revision';
      q1Reason = t('Minimal or no Christ-centered language', 'Minimal o walang Christ-centered language');
    }

    // Q2 — Biblical truth?
    const q2HasBiblical = hasAny(lyrics, [...CHRIST_NAME_KW, ...GOSPEL_KW]) || wc > 50;
    let q2Result: QResult;
    let q2Reason: string;
    if (q2HasBiblical) {
      q2Result = 'Pass';
      q2Reason = t('Contains sufficient Christ/Gospel language or substantial lyric content', 'May sapat na Christ/Gospel language o substantial na lyric content');
    } else {
      q2Result = 'Needs Revision';
      q2Reason = t('Short or vague lyrics with no clear biblical anchor', 'Maikli o malabo ang lyrics nang walang malinaw na biblical anchor');
    }

    // Q3 — Gospel clarity?
    const q3HasGospel = hasAny(lyrics, ['cross', 'grace', 'blood', 'mercy', 'forgiveness', 'sacrifice', 'atonement']);
    let q3Result: QResult;
    let q3Reason: string;
    if (q3HasGospel) {
      q3Result = 'Pass';
      q3Reason = t('Explicit Gospel language present', 'May explicit na Gospel language');
    } else {
      q3Result = 'Needs Revision';
      q3Reason = t('No clear Gospel proclamation language', 'Walang malinaw na Gospel proclamation language');
    }

    // Q4 — Theologically sound?
    const q4ProsperityManipulation = hasAny(lyrics, [...PROSPERITY_KW, ...MANIPULATION_KW]);
    const q4MoralismNoGospel = hasAny(lyrics, SELF_FOCUS_KW) && !hasAny(lyrics, GOSPEL_KW);
    let q4Result: QResult;
    let q4Reason: string;
    if (q4ProsperityManipulation) {
      q4Result = 'Fail';
      q4Reason = t('Prosperity or manipulation language detected — theological concern', 'May nadetect na prosperity o manipulation language — may theological concern');
    } else if (q4MoralismNoGospel) {
      q4Result = 'Needs Revision';
      q4Reason = t('Moralistic or self-focused language detected without Gospel grounding', 'May nadetect na moralistic o self-focused language nang walang Gospel grounding');
    } else {
      q4Result = 'Pass';
      q4Reason = t('No theological concerns detected', 'Walang theological concerns na nadetect');
    }

    // Q5 — Clear to unbelievers?
    const q5Pass = q1Result === 'Pass' && q3Result === 'Pass';
    const q5Result: QResult = q5Pass ? 'Pass' : 'Needs Revision';
    const q5Reason = q5Pass
      ? t('Clear Christ-centered Gospel language accessible to unbelievers', 'Malinaw na Christ-centered Gospel language na naiintindihan ng mga hindi pa naniniwala')
      : t("Language too generic or insider-focused; the Gospel may not be clear to someone unfamiliar with Christian faith", "Ang language ay masyadong generic o insider-focused; maaaring hindi malinaw ang Gospel sa isang taong hindi pamilyar sa Christian faith");

    const results = [q1Result, q2Result, q3Result, q4Result, q5Result];
    const flaggedQuestions = results.filter(result => result !== 'Pass').length;
    const passedQuestions = results.length - flaggedQuestions;

    // Decision
    let decision: SongDecision;
    if (passedQuestions === 5) {
      decision = 'APPROVED';
    } else if (passedQuestions === 0) {
      decision = 'NEEDS_LEADER_REVIEW';
    } else {
      decision = 'APPROVED_WITH_CAUTION';
    }

    const leaderNote = (() => {
      switch (decision) {
        case 'APPROVED':
          return t(
            'All five questions passed. Safe for use in our ministry context and aligned with Gospel-centered standards.',
            'Pumasa ang lahat ng limang tanong. Ligtas gamitin sa ating ministry context at naaayon sa Gospel-centered standards.'
          );
        case 'REJECTED':
          return t(
            'Unsafe for our context; violates core theological guidelines.',
            'Hindi ligtas para sa ating context; lumalabag sa core theological guidelines.'
          );
        case 'NEEDS_LEADER_REVIEW':
          return t(
            'None of the five questions passed. The leader needs to review this song before it is used.',
            'Walang pumasa sa limang tanong. Kailangang i-review ito ng leader bago gamitin ang kantang ito.'
          );
        case 'APPROVED_WITH_CAUTION':
          return t(
            'Not all five questions passed. This song can stay with caution if the surrounding songs carry the missing emphasis.',
            'Hindi pumasa ang lahat ng limang tanong. Maaaring manatili ang kantang ito nang may pag-iingat kung sinasalo ng ibang kanta ang kulang na emphasis.'
          );
      }
    })();

    return {
      title: song.title,
      artist: song.artist,
      slot: song.slot,
      q1: { result: q1Result, reason: q1Reason },
      q2: { result: q2Result, reason: q2Reason },
      q3: { result: q3Result, reason: q3Reason },
      q4: { result: q4Result, reason: q4Reason },
      q5: { result: q5Result, reason: q5Reason },
      passedQuestions,
      flaggedQuestions,
      decision,
      leaderNote,
    };
  });
}

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

function computeRating(
  songs: Song[],
  slotFitCheck: SlotCheck[],
  flowCheck: SetlistCheckReport['flowCheck']
): number {
  let rating = 5.0;

  const mainSlotSongs = songs.filter(s => ['Opening', 'Praise', 'Worship', 'Closing'].includes(s.slot));
  const gospelSongs = mainSlotSongs.filter(s => hasAny(s.lyrics, GOSPEL_KW));
  const gospelRatio = mainSlotSongs.length > 0 ? gospelSongs.length / mainSlotSongs.length : 0;
  const selfFocusedCount = mainSlotSongs.filter(s => hasAny(s.lyrics, SELF_FOCUS_KW) && !hasAny(s.lyrics, GOSPEL_KW)).length;
  const badSlotCount = slotFitCheck.filter(s => !s.fits).length;

  if (gospelRatio < 0.4) rating -= (0.4 - gospelRatio) * 1.2;
  if (selfFocusedCount > 1) rating -= (selfFocusedCount - 1) * 0.25;
  if (!flowCheck.ok) rating -= 0.5;
  if (badSlotCount > 1) rating -= (badSlotCount - 1) * 0.15;

  return Math.max(2.5, Math.min(5.0, Math.round(rating * 10) / 10));
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

function computeVerdict(
  rating: number,
  slotFitCheck: SlotCheck[],
  t: ReturnType<typeof makeTranslator>
): { verdict: Verdict; verdictExplanation: string } {
  let verdict: Verdict;
  let base: string;

  if (rating >= 4.0) {
    verdict = 'APPROVE';
    base = t(
      "Strong Gospel-centeredness, clear proclamation of Christ's finished work, and sound theological flow.",
      "Malakas ang Gospel-centeredness, malinaw ang proclamation ng natapos na gawa ni Cristo, at maayos ang theological flow."
    );
  } else if (rating >= 3.0) {
    verdict = 'REVISE';
    base = t(
      'Good foundation but some issues need addressing before this setlist is ready for use.',
      'Magandang pundasyon pero may ilang isyung kailangang ayusin bago maging handa ang setlist na ito para gamitin.'
    );
  } else {
    verdict = 'REJECT';
    base = t(
      'Major revisions required. Gospel clarity and theological precision are inadequate for ministry use.',
      'Kailangan ng major revisions. Ang Gospel clarity at theological precision ay hindi sapat para sa ministry use.'
    );
  }

  const goodSlots = slotFitCheck.filter(s => s.fits).length;
  const totalSlots = slotFitCheck.length;
  const fitRatio = totalSlots > 0 ? goodSlots / totalSlots : 0;

  let verdictExplanation = base;
  if (fitRatio >= 0.65) {
    verdictExplanation += ' ' + t(
      'The overall set is strong — borderline songs noted above should be reviewed but do not undermine the set\'s Gospel integrity.',
      'Ang overall set ay malakas — ang mga borderline songs na nabanggit sa itaas ay dapat i-review pero hindi nito sinisira ang Gospel integrity ng set.'
    );
  }

  return { verdict, verdictExplanation };
}

// ---------------------------------------------------------------------------
// Theme Alignment
// ---------------------------------------------------------------------------

function runThemeAlignment(
  theme: string,
  songs: Song[],
  t: ReturnType<typeof makeTranslator>
): SetlistCheckReport['themeAlignment'] {
  const normalizedTheme = theme.trim();
  if (!normalizedTheme) {
    return {
      theme: '',
      skipped: true,
      summary: t(
        'No service theme was provided, so theme alignment was not evaluated.',
        'Walang service theme na ibinigay, kaya hindi sinuri ang theme alignment.'
      ),
      strengths: [],
      mismatches: [],
    };
  }

  const themeKeywords = normalizedTheme.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (themeKeywords.length === 0) {
    return {
      theme: normalizedTheme,
      skipped: true,
      summary: t(
        'The service theme is too short to evaluate by keywords. Add a clearer theme statement if you want this checked.',
        'Masyadong maikli ang service theme para ma-check gamit ang keywords. Maglagay ng mas malinaw na theme statement kung gusto mo itong masuri.'
      ),
      strengths: [],
      mismatches: [],
    };
  }
  const strengths: { title: string; reason: string }[] = [];
  const mismatches: { title: string; reason: string }[] = [];

  for (const song of songs) {
    const combined = (song.lyrics + ' ' + song.title).toLowerCase();
    const matchedWords = themeKeywords.filter(kw => combined.includes(kw));
    const matchCount = matchedWords.length;

    if (matchCount >= 2) {
      strengths.push({
        title: song.title,
        reason: t(
          `Contains ${matchCount} theme keywords (${matchedWords.join(', ')}) — reinforces the service theme.`,
          `May ${matchCount} theme keywords (${matchedWords.join(', ')}) — nagpapatibay ng service theme.`
        ),
      });
    } else if (matchCount === 0) {
      mismatches.push({
        title: song.title,
        reason: t(
          `No theme keywords found in lyrics — may feel disconnected from "${normalizedTheme}".`,
          `Walang theme keywords na nakita sa lyrics — maaaring hindi konektado sa "${normalizedTheme}".`
        ),
      });
    }
  }

  return {
    theme: normalizedTheme,
    summary: strengths.length === 0 && mismatches.length === 0
      ? t(
        'All songs appear aligned with the stated service theme.',
        'Mukhang naka-align ang lahat ng kanta sa ibinigay na service theme.'
      )
      : undefined,
    strengths,
    mismatches,
  };
}

// ---------------------------------------------------------------------------
// Suggested Flow Correction
// ---------------------------------------------------------------------------

function buildSuggestedFlowCorrection(
  songs: Song[],
  slotFitCheck: SlotCheck[],
  flowCheck: SetlistCheckReport['flowCheck'],
  t: ReturnType<typeof makeTranslator>
): SetlistCheckReport['suggestedFlowCorrection'] | undefined {
  if (flowCheck.ok) return undefined;

  const slotOrder: SongInput['slot'][] = ['Opening', 'Praise', 'Worship', 'Closing', 'Offering', 'Special', 'Others'];
  const orderedSongs = [...songs].sort((a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot));

  const fixes: string[] = [];

  const hasOpening = songs.some(s => s.slot === 'Opening');
  const hasWorshipSong = songs.some(s => s.slot === 'Worship');
  const hasClosing = songs.some(s => s.slot === 'Closing');

  if (!hasOpening) {
    fixes.push(t(
      "Add an Opening song that establishes who God is — focus on His holiness, greatness, and majesty.",
      "Magdagdag ng Opening song na nagtatayo kung sino ang Diyos — mag-focus sa Kanyang kabanalan, kadakilaan, at majesty."
    ));
  }
  if (!hasWorshipSong) {
    fixes.push(t(
      "Add a Worship song that clearly proclaims the Gospel — the cross, grace, and Christ's finished work.",
      "Magdagdag ng Worship song na malinaw na nagpapahayag ng Gospel — ang krus, grace, at natapos na gawa ni Cristo."
    ));
  }
  if (!hasClosing) {
    fixes.push(t(
      "Add a Closing song that anchors the response in grace and sends people out in faith.",
      "Magdagdag ng Closing song na nag-a-anchor ng response sa grace at nagpapadala sa mga tao nang may pananampalataya."
    ));
  }

  for (const check of slotFitCheck) {
    if (check.action === 'NEEDS_LEADER_REVIEW') {
      fixes.push(t(
        `Move '${check.title}' to a more appropriate slot based on its lyrical content.`,
        `Ilipat ang '${check.title}' sa mas angkop na slot batay sa lyrical content nito.`
      ));
    } else if (check.action === 'APPROVED_WITH_CAUTION') {
      // Suggest a slot based on priority tier
      const suggestedSlot = check.priorityTier === 'gospel_core' ? 'Worship' : check.priorityTier === 'god_centered' ? 'Praise' : 'Others';
      fixes.push(t(
        `Review '${check.title}' placement — consider moving to ${suggestedSlot}.`,
        `I-review ang placement ng '${check.title}' — pag-isipang ilipat sa ${suggestedSlot}.`
      ));
    }
  }

  return {
    orderedSongs: orderedSongs.map(s => ({ title: s.title, slot: s.slot })),
    fixes,
  };
}

// ---------------------------------------------------------------------------
// Action Plan
// ---------------------------------------------------------------------------

function buildActionPlan(
  verdict: Verdict,
  flowCheck: SetlistCheckReport['flowCheck'],
  songs: Song[],
  t: ReturnType<typeof makeTranslator>
): string[] {
  const plan: string[] = [];

  const mainSlotSongs = songs.filter(s => ['Opening', 'Praise', 'Worship', 'Closing'].includes(s.slot));
  const gospelSongs = mainSlotSongs.filter(s => hasAny(s.lyrics, GOSPEL_KW));
  const gospelRatio = mainSlotSongs.length > 0 ? gospelSongs.length / mainSlotSongs.length : 0;
  const selfFocusedCount = mainSlotSongs.filter(s => hasAny(s.lyrics, SELF_FOCUS_KW) && !hasAny(s.lyrics, GOSPEL_KW)).length;

  switch (verdict) {
    case 'APPROVE':
      plan.push(t(
        'Final Review — Conduct a final pastoral review to confirm theological soundness and pray through the setlist before service.',
        'Final Review — Magsagawa ng final pastoral review para kumpirmahin ang theological soundness at ipanalangin ang setlist bago ang service.'
      ));
      plan.push(t(
        'Team Preparation — Brief the worship team on the theme and ensure they understand the theological emphasis of each song.',
        'Team Preparation — I-brief ang worship team tungkol sa theme at tiyakin na naiintindihan nila ang theological emphasis ng bawat kanta.'
      ));
      break;

    case 'REVISE':
      if (!flowCheck.ok && flowCheck.issues.length > 0) {
        plan.push(t(
          `Fix Flow Structure — ${flowCheck.issues[0]}`,
          `Ayusin ang Flow Structure — ${flowCheck.issues[0]}`
        ));
      }
      if (gospelRatio < 0.6) {
        plan.push(t(
          "Strengthen Gospel Content — Add or replace 1–2 songs that explicitly proclaim Christ's finished work — His death, resurrection, and the grace available through faith.",
          "Palakasin ang Gospel Content — Magdagdag o pumalit ng 1–2 mga kanta na explicitly nagpapahayag ng natapos na gawa ni Cristo — ang Kanyang kamatayan, muling pagkabuhay, at ang grace na available sa pamamagitan ng pananampalataya."
        ));
      }
      if (selfFocusedCount > 0) {
        plan.push(t(
          'Address Self-Focused Language — Replace or reorder songs with moralistic or self-focused themes. Place any borderline songs later in the set after the Gospel is clearly established.',
          'Tugunan ang Self-Focused Language — Palitan o i-reorder ang mga kanta na may moralistic o self-focused themes. Ilagay ang anumang borderline songs sa later na bahagi ng set pagkatapos malinaw na naitatag ang Gospel.'
        ));
      }
      plan.push(t(
        'Approval Conditions — This setlist can be approved once Gospel clarity is strengthened and any flagged songs are addressed per the recommendations above.',
        'Approval Conditions — Ang setlist na ito ay maaaring aprubahan kapag napalakas na ang Gospel clarity at natutukan na ang mga flagged songs ayon sa mga rekomendasyon sa itaas.'
      ));
      break;

    case 'REJECT':
      plan.push(t(
        'Rebuild from Guidelines — This setlist requires reconstruction. Return to the worship ministry guidelines and select songs that clearly exalt Christ, proclaim the Gospel, and avoid moralism or prosperity language.',
        'Itayo Muli Mula sa Guidelines — Ang setlist na ito ay nangangailangan ng muling pagtatayo. Bumalik sa worship ministry guidelines at pumili ng mga kanta na malinaw na nagdadakila kay Cristo, nagpapahayag ng Gospel, at umiiwas sa moralism o prosperity language.'
      ));
      plan.push(t(
        'Focus on Core Gospel — Choose at least 3–4 songs that explicitly reference Christ\'s person, His cross, grace, or the Gospel. Avoid vague spirituality.',
        'Focus sa Core Gospel — Pumili ng kahit 3–4 na mga kanta na explicitly nagre-refer sa pagkatao ni Cristo, ang Kanyang krus, grace, o ang Gospel. Iwasan ang vague spirituality.'
      ));
      plan.push(t(
        'Remove Problem Songs — Eliminate any songs flagged for theological concerns. Do not use songs with prosperity, manipulation, or moralistic themes.',
        'Alisin ang Mga Problematikong Kanta — Alisin ang anumang mga kanta na na-flag para sa theological concerns. Huwag gumamit ng mga kanta na may prosperity, manipulation, o moralistic themes.'
      ));
      plan.push(t(
        'Resubmit for Review — After rebuilding the setlist according to guidelines, resubmit for another review before proceeding to rehearsal.',
        'Mag-resubmit para sa Review — Pagkatapos itayo muli ang setlist ayon sa guidelines, mag-resubmit para sa isa pang review bago magpatuloy sa rehearsal.'
      ));
      break;
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Discord Text
// ---------------------------------------------------------------------------

function buildDiscordText(
  verdict: Verdict,
  rating: number,
  songs: Song[],
  slotFitCheck: SlotCheck[],
  actionPlan: string[],
  theme: string
): string {
  const verdictEmoji = verdict === 'APPROVE' ? '✅' : verdict === 'REVISE' ? '⚠️' : '❌';
  const ratingStars = '⭐'.repeat(Math.round(rating));

  const songLines = songs.map(s => {
    const check = slotFitCheck.find(sc => sc.title === s.title);
    const action = check?.action ?? 'APPROVED';
    const emoji = action === 'APPROVED' ? '✅' : action === 'APPROVED_WITH_CAUTION' ? '⚠️' : action === 'NEEDS_LEADER_REVIEW' ? '🔍' : '❌';
    return `${emoji} **${s.title}** (${s.slot}) — ${action}`;
  });

  const actionLines = actionPlan.slice(0, 3).map(a => `• ${a}`);

  const lines = [
    `${verdictEmoji} **SETLIST REVIEW** — ${verdict}`,
    `📋 **Theme:** ${theme}`,
    `${ratingStars} **Rating:** ${rating}/5.0`,
    '',
    '**Songs:**',
    ...songLines,
    '',
    '**Action Plan:**',
    ...actionLines,
  ];

  let result = lines.join('\n');
  if (result.length > 1800) {
    result = result.slice(0, 1795) + '...';
  }
  return result;
}

// ---------------------------------------------------------------------------
// CORS Headers
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as { theme: string; songs: SongInput[]; language: 'english' | 'taglish' };
    const { theme, language } = body;
    const rawSongs: SongInput[] = body.songs ?? [];

    const t = makeTranslator(language ?? 'english');

    // Step 1: Resolve lyrics for all songs
    const songsWithLyricsInfo: SetlistCheckReport['songsWithLyrics'] = [];
    const resolvedSongs: Song[] = [];

    for (let i = 0; i < rawSongs.length; i++) {
      const raw = rawSongs[i];

      // Infer slot if missing
      let slot = raw.slot;
      if (!slot) {
        slot = inferSlot(raw, i, rawSongs.length);
      }

      let lyricsSource: 'provided' | 'fetched' | 'unavailable';
      let lyrics: string;

      if (raw.lyrics && raw.lyrics.trim().length > 0) {
        lyrics = raw.lyrics.trim().slice(0, 2000);
        lyricsSource = 'provided';
      } else {
        const result = await fetchLyrics(raw.artist, raw.title);
        lyrics = result.lyrics;
        lyricsSource = result.source;
      }

      resolvedSongs.push({ ...raw, slot, lyrics });
      songsWithLyricsInfo.push({ title: raw.title, artist: raw.artist, slot, lyricsSource });
    }

    // Step 2: Build priority tiers and slot fit checks
    const slotFitCheck: SlotCheck[] = resolvedSongs.map(song => {
      const priorityTier = getPriorityTier(song.lyrics);
      const fit = checkSlotFit(song, priorityTier, t);
      return {
        title: song.title,
        artist: song.artist,
        priorityTier,
        ...fit,
      };
    });

    // Step 3: Flow check
    const flowCheck = runFlowCheck(resolvedSongs, t);

    // Step 4: Gospel-centeredness
    const gospelCenteredness = runGospelCenteredness(resolvedSongs, t);

    // Step 5: Theological flags
    const theologicalFlags = runTheologicalFlags(resolvedSongs, t);

    // Step 6: Five-question test
    const fiveQuestionTest = runFiveQuestionTest(resolvedSongs, t);

    // Step 7: Rating
    const rating = computeRating(resolvedSongs, slotFitCheck, flowCheck);

    // Step 8: Verdict
    const { verdict, verdictExplanation } = computeVerdict(rating, slotFitCheck, t);

    // Step 9: Theme alignment
    const themeAlignment = runThemeAlignment(theme, resolvedSongs, t);

    // Step 10: Suggested flow correction
    const suggestedFlowCorrection = buildSuggestedFlowCorrection(resolvedSongs, slotFitCheck, flowCheck, t);

    // Step 11: Action plan
    const actionPlan = buildActionPlan(verdict, flowCheck, resolvedSongs, t);

    // Step 12: Discord text
    const discordText = buildDiscordText(verdict, rating, resolvedSongs, slotFitCheck, actionPlan, theme);

    const report: SetlistCheckReport = {
      verdict,
      rating,
      verdictExplanation,
      flowCheck,
      slotFitCheck,
      suggestedFlowCorrection,
      themeAlignment,
      gospelCenteredness,
      theologicalFlags,
      fiveQuestionTest,
      actionPlan,
      discordText,
      analyzedAt: new Date().toISOString(),
      language: language ?? 'english',
      songsWithLyrics: songsWithLyricsInfo,
    };

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
