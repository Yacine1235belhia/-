import { Exam, LevelKey, LevelTimingConfig, SystemSettings } from '../types';
import { api } from './api';

export const SETTINGS_CHANGE_EVENT = 'hirasa:settings-change';

export const DEFAULT_LEVEL_TIMING: LevelTimingConfig = {
  morningSlot1: '08:00 - 10:00',
  morningSlot2: '10:00 - 12:00',
  includeAfternoon: false,
  afternoonSlot: '13:30 - 15:30',
  morningTime: '08:00 - 12:00',
  afternoonTime: '13:00 - 17:00',
};

export function createDefaultLevelTimings(): {
  first: LevelTimingConfig;
  second: LevelTimingConfig;
  third: LevelTimingConfig;
} {
  return {
    first: { ...DEFAULT_LEVEL_TIMING },
    second: { ...DEFAULT_LEVEL_TIMING },
    third: { ...DEFAULT_LEVEL_TIMING },
  };
}

export function normalizeTimeString(str?: string): string {
  if (!str) return '';
  return str.replace(/[–—]/g, '-').replace(/\s*-\s*/g, ' - ').trim();
}

export function compactTimeKey(str?: string): string {
  if (!str) return '';
  return str.replace(/[\s–—]+/g, '').trim();
}

export function parseTimeToMinutes(hhmm: string): number | null {
  const m = hhmm.trim().match(/^(\d{1,2})\s*[:.]\s*(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function parseTimeRangeToMinutes(range?: string): { start: number; end: number } | null {
  if (!range) return null;
  const normalized = range.replace(/[–—]/g, '-');
  const parts = normalized.split('-');
  if (parts.length !== 2) return null;
  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  if (start === null || end === null) return null;
  return { start, end };
}

export function doTimeRangesOverlap(r1?: string, r2?: string): boolean {
  const p1 = parseTimeRangeToMinutes(r1);
  const p2 = parseTimeRangeToMinutes(r2);
  if (!p1 || !p2) {
    // If either has unparseable/missing timeRange, be conservative and treat matching strings (or missing) as overlapping
    const k1 = compactTimeKey(r1);
    const k2 = compactTimeKey(r2);
    if (!k1 || !k2) return true;
    return k1 === k2;
  }
  return p1.start < p2.end && p2.start < p1.end;
}

export function isMorningTimeRange(range?: string): boolean {
  if (!range) return true;
  const parsed = parseTimeRangeToMinutes(range);
  if (parsed) {
    return parsed.start < 13 * 60;
  }
  const startHour = parseInt(range.split(':')[0] || '8', 10);
  return isNaN(startHour) ? true : startHour < 13;
}

export function deriveMorningPeriodFromSlots(slot1?: string, slot2?: string, fallback = '08:00 - 12:00'): string {
  const s1 = normalizeTimeString(slot1);
  const s2 = normalizeTimeString(slot2);

  if (s1 && s2) {
    const p1 = s1.split('-').map(p => p.trim());
    const p2 = s2.split('-').map(p => p.trim());
    if (p1[0] && p2[p2.length - 1]) {
      return `${p1[0]} - ${p2[p2.length - 1]}`;
    }
    return s1;
  }
  if (s1) return s1;
  if (s2) return s2;
  return fallback;
}

export function getLevelConfigFromSettings(
  settings: Partial<SystemSettings> | null | undefined,
  level: LevelKey
): LevelTimingConfig {
  const unifiedSlot1 = normalizeTimeString(settings?.morningSlot1) || DEFAULT_LEVEL_TIMING.morningSlot1;
  const unifiedSlot2 =
    settings?.morningSlot2 !== undefined
      ? normalizeTimeString(settings.morningSlot2)
      : DEFAULT_LEVEL_TIMING.morningSlot2 || '';
  const unifiedIncludeAfternoon = Boolean(settings?.includeAfternoon);
  const unifiedAfternoonSlot = normalizeTimeString(settings?.afternoonSlot) || DEFAULT_LEVEL_TIMING.afternoonSlot || '13:30 - 15:30';
  const unifiedMorningTime =
    normalizeTimeString(settings?.morningTime) ||
    deriveMorningPeriodFromSlots(unifiedSlot1, unifiedSlot2, DEFAULT_LEVEL_TIMING.morningTime);
  const unifiedAfternoonTime =
    normalizeTimeString(settings?.afternoonTime) ||
    DEFAULT_LEVEL_TIMING.afternoonTime;

  if (settings?.separateLevelTimings && settings.levelTimings?.[level]) {
    const raw = settings.levelTimings[level];
    const m1 = raw.morningSlot1 !== undefined ? normalizeTimeString(raw.morningSlot1) : unifiedSlot1;
    const m2 = raw.morningSlot2 !== undefined ? normalizeTimeString(raw.morningSlot2) : '';
    const incAft = Boolean(raw.includeAfternoon);
    const aftSlot = normalizeTimeString(raw.afternoonSlot) || unifiedAfternoonSlot;
    const mTime =
      normalizeTimeString(raw.morningTime) ||
      deriveMorningPeriodFromSlots(m1, m2, unifiedMorningTime);
    const aTime =
      normalizeTimeString(raw.afternoonTime) ||
      (incAft ? aftSlot : unifiedAfternoonTime);

    return {
      morningSlot1: m1,
      morningSlot2: m2,
      includeAfternoon: incAft,
      afternoonSlot: aftSlot,
      morningTime: mTime,
      afternoonTime: aTime,
    };
  }

  return {
    morningSlot1: unifiedSlot1,
    morningSlot2: unifiedSlot2,
    includeAfternoon: unifiedIncludeAfternoon,
    afternoonSlot: unifiedAfternoonSlot,
    morningTime: unifiedMorningTime,
    afternoonTime: unifiedAfternoonTime,
  };
}

export function getScheduleTimeSlotsForLevel(
  settings: Partial<SystemSettings> | null | undefined,
  level: LevelKey
): string[] {
  const cfg = getLevelConfigFromSettings(settings, level);
  const slots: string[] = [];
  if (cfg.morningSlot1?.trim()) slots.push(normalizeTimeString(cfg.morningSlot1));
  if (cfg.morningSlot2?.trim()) {
    const s2 = normalizeTimeString(cfg.morningSlot2);
    if (!slots.some(s => compactTimeKey(s) === compactTimeKey(s2))) {
      slots.push(s2);
    }
  }
  if (cfg.includeAfternoon && cfg.afternoonSlot?.trim()) {
    const aft = normalizeTimeString(cfg.afternoonSlot);
    if (!slots.some(s => compactTimeKey(s) === compactTimeKey(aft))) {
      slots.push(aft);
    }
  }
  if (slots.length === 0) {
    slots.push('08:00 - 10:00');
  }
  return slots;
}

export function resolveExamLevelKey(exam?: Partial<Exam> | null): LevelKey {
  if (!exam) return 'first';
  if (exam.targetLevel === 'first') return 'first';
  if (exam.targetLevel === 'second') return 'second';
  if (exam.targetLevel === 'third') return 'third';

  const streamStr = String(exam.stream || '').toLowerCase();
  if (streamStr.includes('ثالثة') || streamStr.includes('بكالوريا') || streamStr.includes('3ثا')) return 'third';
  if (streamStr.includes('ثانية') || streamStr.includes('2ثا')) return 'second';
  return 'first';
}

export function resolveExamEffectiveTimeRange(
  exam: Partial<Exam> | undefined,
  settings: Partial<SystemSettings> | null | undefined
): string {
  if (!exam) {
    return normalizeTimeString(settings?.morningTime) || '08:00 - 12:00';
  }

  const lvl = resolveExamLevelKey(exam);
  const cfg = getLevelConfigFromSettings(settings, lvl);
  const isMorning = exam.period !== 'afternoon';

  if (settings?.separateLevelTimings) {
    if (isMorning) {
      const mSlots = [cfg.morningSlot1, cfg.morningSlot2].filter(Boolean).map(normalizeTimeString);
      const exTimeKey = compactTimeKey(exam.timeRange);
      if (exTimeKey && mSlots.some(s => compactTimeKey(s) === exTimeKey)) {
        return normalizeTimeString(exam.timeRange);
      }
      if (mSlots.length === 1) {
        return mSlots[0];
      }
      return normalizeTimeString(exam.timeRange) || cfg.morningTime;
    }
    return cfg.includeAfternoon && cfg.afternoonSlot
      ? normalizeTimeString(cfg.afternoonSlot)
      : normalizeTimeString(exam.timeRange) || cfg.afternoonTime;
  }

  if (exam.timeRange?.trim()) {
    return normalizeTimeString(exam.timeRange);
  }
  return isMorning ? cfg.morningTime : cfg.afternoonTime;
}

export function resolveProctoringPeriodHeaders(
  session: 'all' | 'first_second' | 'first' | 'second' | 'third',
  settings: Partial<SystemSettings> | null | undefined
): { morningTime: string; afternoonTime: string } {
  const c1 = getLevelConfigFromSettings(settings, 'first');
  const c2 = getLevelConfigFromSettings(settings, 'second');
  const c3 = getLevelConfigFromSettings(settings, 'third');

  if (!settings?.separateLevelTimings) {
    return {
      morningTime: c1.morningTime || '08:00 - 12:00',
      afternoonTime: c1.afternoonTime || '13:00 - 17:00',
    };
  }

  if (session === 'first') return { morningTime: c1.morningTime, afternoonTime: c1.afternoonTime };
  if (session === 'second') return { morningTime: c2.morningTime, afternoonTime: c2.afternoonTime };
  if (session === 'third') return { morningTime: c3.morningTime, afternoonTime: c3.afternoonTime };

  const formatCombined = (vals: { label: string; time: string }[]) => {
    const groups = new Map<string, string[]>();
    vals.forEach(({ label, time }) => {
      const t = normalizeTimeString(time);
      if (!t) return;
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t)!.push(label);
    });

    if (groups.size <= 1) {
      return Array.from(groups.keys())[0] || '08:00 - 12:00';
    }

    return Array.from(groups.entries())
      .map(([t, labels]) => `${labels.join(' و')}: ${t}`)
      .join(' | ');
  };

  if (session === 'first_second') {
    return {
      morningTime: formatCombined([
        { label: '1ثا', time: c1.morningTime },
        { label: '2ثا', time: c2.morningTime },
      ]),
      afternoonTime: formatCombined([
        { label: '1ثا', time: c1.afternoonTime },
        { label: '2ثا', time: c2.afternoonTime },
      ]),
    };
  }

  return {
    morningTime: formatCombined([
      { label: '1ثا', time: c1.morningTime },
      { label: '2ثا', time: c2.morningTime },
      { label: '3ثا', time: c3.morningTime },
    ]),
    afternoonTime: formatCombined([
      { label: '1ثا', time: c1.afternoonTime },
      { label: '2ثا', time: c2.afternoonTime },
      { label: '3ثا', time: c3.afternoonTime },
    ]),
  };
}

/**
 * Synchronize existing exams and local days schedule whenever timings change in SettingsPage.
 */
export async function syncExamsAndScheduleWithSettings(nextSettings: Partial<SystemSettings>): Promise<number> {
  let updatedCount = 0;

  try {
    // 1. Update localStorage hirasa_days_schedule to hold per-level timeSlots + unified timeSlots
    const rawDays = localStorage.getItem('hirasa_days_schedule');
    if (rawDays) {
      try {
        const parsedDays = JSON.parse(rawDays);
        if (Array.isArray(parsedDays) && parsedDays.length > 0) {
          const updatedDays = parsedDays.map((day: any, dIdx: number) => {
            const unifiedSlots = getScheduleTimeSlotsForLevel(
              { ...nextSettings, separateLevelTimings: false },
              'first'
            ).map((tr, sIdx) => ({
              id: `t_${dIdx}_${sIdx}_${Date.now()}`,
              timeRange: tr,
            }));

            const timeSlotsByLevel = {
              first: getScheduleTimeSlotsForLevel(nextSettings, 'first').map((tr, sIdx) => ({
                id: `t_${dIdx}_1_${sIdx}_${Date.now()}`,
                timeRange: tr,
              })),
              second: getScheduleTimeSlotsForLevel(nextSettings, 'second').map((tr, sIdx) => ({
                id: `t_${dIdx}_2_${sIdx}_${Date.now()}`,
                timeRange: tr,
              })),
              third: getScheduleTimeSlotsForLevel(nextSettings, 'third').map((tr, sIdx) => ({
                id: `t_${dIdx}_3_${sIdx}_${Date.now()}`,
                timeRange: tr,
              })),
            };

            return {
              ...day,
              timeSlots: nextSettings.separateLevelTimings ? timeSlotsByLevel.first : unifiedSlots,
              timeSlotsByLevel,
            };
          });
          localStorage.setItem('hirasa_days_schedule', JSON.stringify(updatedDays));
        }
      } catch {
        // Ignore malformed local schedule
      }
    }

    // 2. Sync existing exams' timeRange to match the level's configured schedule
    const allExams = await api.get('/api/exams');
    if (Array.isArray(allExams) && allExams.length > 0) {
      const updatedExams: Exam[] = [];

      for (const ex of allExams as Exam[]) {
        if (!ex || !ex.id) {
          updatedExams.push(ex);
          continue;
        }

        const lvl = resolveExamLevelKey(ex);
        const cfg = getLevelConfigFromSettings(nextSettings, lvl);
        const morningSlots = [cfg.morningSlot1, cfg.morningSlot2]
          .filter(Boolean)
          .map(normalizeTimeString);
        const isMorning = ex.period !== 'afternoon';

        let targetTimeRange = normalizeTimeString(ex.timeRange);

        if (isMorning && morningSlots.length > 0) {
          const alreadyMatches =
            targetTimeRange &&
            morningSlots.some(s => compactTimeKey(s) === compactTimeKey(targetTimeRange));

          if (!alreadyMatches) {
            if (morningSlots.length === 1) {
              targetTimeRange = morningSlots[0];
            } else {
              // Heuristic: if old start hour >= 10, map to slot 2, else slot 1
              const parsedOld = parseTimeRangeToMinutes(targetTimeRange);
              targetTimeRange =
                parsedOld && parsedOld.start >= 10 * 60 ? morningSlots[1] : morningSlots[0];
            }
          }
        } else if (!isMorning) {
          const aftTarget = normalizeTimeString(cfg.afternoonSlot || cfg.afternoonTime);
          if (aftTarget) {
            targetTimeRange = aftTarget;
          }
        }

        if (targetTimeRange && compactTimeKey(targetTimeRange) !== compactTimeKey(ex.timeRange)) {
          const nextEx: Exam = { ...ex, timeRange: targetTimeRange };
          updatedExams.push(nextEx);
          updatedCount++;
          await api.put(`/api/exams/${ex.id}`, nextEx).catch(() => {});
        } else {
          updatedExams.push(ex);
        }
      }

      localStorage.setItem('hirasa_exams', JSON.stringify(updatedExams));
    }
  } catch (err) {
    console.error('Error syncing schedule & exams with settings:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT, { detail: nextSettings }));
  }

  return updatedCount;
}
