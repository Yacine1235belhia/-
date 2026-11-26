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

export interface TeacherScheduleRow {
  key: string;
  period: 'morning' | 'afternoon';
  label: string;
  timeRange: string;
  timeKey: string;
  filterByTime: boolean;
}

function sortUniqueTimeRanges(ranges: string[]): Array<[string, string]> {
  const uniqueByKey = new Map<string, string>();
  ranges.forEach(raw => {
    const normalized = normalizeTimeString(raw);
    const key = compactTimeKey(normalized);
    if (normalized && key && !uniqueByKey.has(key)) {
      uniqueByKey.set(key, normalized);
    }
  });

  return Array.from(uniqueByKey.entries()).sort((a, b) => {
    const pA = parseTimeRangeToMinutes(a[1]);
    const pB = parseTimeRangeToMinutes(b[1]);
    if (pA && pB) {
      if (pA.start !== pB.start) return pA.start - pB.start;
      return pA.end - pB.end;
    }
    return a[1].localeCompare(b[1]);
  });
}

export function resolveSessionSlotLists(
  session: 'all' | 'first_second' | 'first' | 'second' | 'third',
  settings: Partial<SystemSettings> | null | undefined,
  sessionExams: Exam[] = []
): { morningSlots: string[]; afternoonSlots: string[] } {
  const c1 = getLevelConfigFromSettings(settings, 'first');

  if (!settings?.separateLevelTimings) {
    return {
      morningSlots: [c1.morningTime || '08:00 - 12:00'],
      afternoonSlots: [c1.afternoonTime || '13:00 - 17:00'],
    };
  }

  const targetLevels: LevelKey[] =
    session === 'first'
      ? ['first']
      : session === 'second'
      ? ['second']
      : session === 'third'
      ? ['third']
      : session === 'first_second'
      ? ['first', 'second']
      : ['first', 'second', 'third'];

  const examMorning: string[] = [];
  const examAfternoon: string[] = [];
  sessionExams.forEach(ex => {
    const eff = resolveExamEffectiveTimeRange(ex, settings);
    if (!eff) return;
    if (ex.period === 'afternoon') {
      examAfternoon.push(eff);
    } else {
      examMorning.push(eff);
    }
  });

  const cfgMorning: string[] = [];
  const cfgAfternoon: string[] = [];
  targetLevels.forEach(lvl => {
    const cfg = getLevelConfigFromSettings(settings, lvl);
    if (cfg.morningSlot1?.trim()) cfgMorning.push(cfg.morningSlot1);
    if (cfg.morningSlot2?.trim()) cfgMorning.push(cfg.morningSlot2);
    if (!cfg.morningSlot1?.trim() && !cfg.morningSlot2?.trim() && cfg.morningTime?.trim()) {
      cfgMorning.push(cfg.morningTime);
    }
    if (cfg.includeAfternoon && cfg.afternoonSlot?.trim()) {
      cfgAfternoon.push(cfg.afternoonSlot);
    } else if (cfg.afternoonTime?.trim()) {
      cfgAfternoon.push(cfg.afternoonTime);
    }
  });

  const morningSource = examMorning.length > 0 ? examMorning : cfgMorning;
  const afternoonSource = examAfternoon.length > 0 ? examAfternoon : cfgAfternoon;

  const morningSlots = sortUniqueTimeRanges(morningSource).map(([, tr]) => tr);
  const afternoonSlots = sortUniqueTimeRanges(afternoonSource).map(([, tr]) => tr);

  return {
    morningSlots: morningSlots.length > 0 ? morningSlots : [c1.morningTime || '08:00 - 12:00'],
    afternoonSlots: afternoonSlots.length > 0 ? afternoonSlots : [c1.afternoonTime || '13:00 - 17:00'],
  };
}

export function buildTeacherScheduleRows(
  items: Array<{ period: string; timeRange?: string }>,
  defaultMorningTime: string | string[],
  defaultAfternoonTime: string | string[]
): TeacherScheduleRow[] {
  const collectPeriodRows = (
    period: 'morning' | 'afternoon',
    label: string,
    baseSlots: string | string[],
    fallback: string
  ): TeacherScheduleRow[] => {
    const periodItems = items.filter(i => i.period === period);
    const seedSlots = Array.isArray(baseSlots)
      ? baseSlots
      : baseSlots.includes('|')
      ? []
      : [baseSlots];

    const combinedRanges = [
      ...seedSlots,
      ...periodItems.map(i => i.timeRange || ''),
    ].filter(Boolean);

    const sortedTimes = sortUniqueTimeRanges(combinedRanges);

    if (sortedTimes.length >= 2) {
      return sortedTimes.map(([timeKey, timeRange]) => ({
        key: `${period}_${timeKey}`,
        period,
        label,
        timeRange,
        timeKey,
        filterByTime: true,
      }));
    }

    if (sortedTimes.length === 1) {
      const [timeKey, timeRange] = sortedTimes[0];
      return [{
        key: `${period}_${timeKey}`,
        period,
        label,
        timeRange,
        timeKey,
        filterByTime: false,
      }];
    }

    return [{
      key: `${period}_default`,
      period,
      label,
      timeRange: normalizeTimeString(fallback),
      timeKey: '',
      filterByTime: false,
    }];
  };

  return [
    ...collectPeriodRows('morning', 'صباحي', defaultMorningTime, '08:00 - 12:00'),
    ...collectPeriodRows('afternoon', 'مسائي', defaultAfternoonTime, '13:00 - 17:00'),
  ];
}

export function getArabicDayName(dateStr: string): string {
  if (!dateStr) return 'الأحد';
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const daysArr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return daysArr[date.getDay()];
  }
  return 'الأحد';
}

export function formatLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface ScheduleTimeSlot {
  id: string;
  timeRange: string;
}

export interface ScheduleDayItem {
  date: string;
  dayName: string;
  timeSlots: ScheduleTimeSlot[];
  timeSlotsByLevel?: Partial<Record<LevelKey, ScheduleTimeSlot[]>>;
}

export function buildTimeSlotsForDay(
  settingsObj: Partial<SystemSettings> | null | undefined,
  prefix: string
): { timeSlots: ScheduleTimeSlot[]; timeSlotsByLevel: Record<LevelKey, ScheduleTimeSlot[]> } {
  const unifiedSlots = getScheduleTimeSlotsForLevel(
    { ...(settingsObj || {}), separateLevelTimings: false },
    'first'
  ).map((tr, idx) => ({ id: `${prefix}_u_${idx}`, timeRange: tr }));

  const timeSlotsByLevel: Record<LevelKey, ScheduleTimeSlot[]> = {
    first: getScheduleTimeSlotsForLevel(settingsObj, 'first').map((tr, idx) => ({
      id: `${prefix}_1_${idx}`,
      timeRange: tr,
    })),
    second: getScheduleTimeSlotsForLevel(settingsObj, 'second').map((tr, idx) => ({
      id: `${prefix}_2_${idx}`,
      timeRange: tr,
    })),
    third: getScheduleTimeSlotsForLevel(settingsObj, 'third').map((tr, idx) => ({
      id: `${prefix}_3_${idx}`,
      timeRange: tr,
    })),
  };

  return {
    timeSlots: settingsObj?.separateLevelTimings ? timeSlotsByLevel.first : unifiedSlots,
    timeSlotsByLevel,
  };
}

export function buildWorkingDaysFromStartDate(
  startDateStr: string,
  settingsObj: Partial<SystemSettings> | null | undefined,
  options?: { count?: number; endDateStr?: string }
): ScheduleDayItem[] {
  const parts = (startDateStr || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return [];

  const cur = new Date(parts[0], parts[1] - 1, parts[2]);
  const days: ScheduleDayItem[] = [];
  const targetCount = Math.max(1, Math.min(14, options?.count || 5));

  let endTime: number | null = null;
  if (options?.endDateStr) {
    const eParts = options.endDateStr.split('-').map(Number);
    if (eParts.length === 3 && !eParts.some(isNaN)) {
      const endD = new Date(eParts[0], eParts[1] - 1, eParts[2]);
      if (endD.getTime() >= cur.getTime()) {
        endTime = endD.getTime();
      }
    }
  }

  let guard = 0;
  while (guard < 45) {
    guard++;
    const dow = cur.getDay();
    if (dow !== 5 && dow !== 6) {
      const formatted = formatLocalDateStr(cur);
      const built = buildTimeSlotsForDay(settingsObj, `t_${days.length}_${Date.now()}`);
      days.push({
        date: formatted,
        dayName: getArabicDayName(formatted),
        timeSlots: built.timeSlots,
        timeSlotsByLevel: built.timeSlotsByLevel,
      });
    }
    if (endTime !== null) {
      if (cur.getTime() >= endTime || days.length >= 14) break;
    } else if (days.length >= targetCount) {
      break;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return days;
}

/**
 * Synchronize existing exams and local days schedule whenever timings or start date change in SettingsPage.
 */
export async function syncExamsAndScheduleWithSettings(
  nextSettings: Partial<SystemSettings>,
  options?: { syncDatesFromStart?: boolean }
): Promise<number> {
  let updatedCount = 0;
  const oldDateToNewDate = new Map<string, string>();

  try {
    // 1. Load or initialize localStorage hirasa_days_schedule
    let existingDays: ScheduleDayItem[] = [];
    const rawDays = localStorage.getItem('hirasa_days_schedule');
    if (rawDays) {
      try {
        const parsed = JSON.parse(rawDays);
        if (Array.isArray(parsed) && parsed.length > 0) {
          existingDays = parsed;
        }
      } catch {
        // Ignore malformed local schedule
      }
    }

    const startDate = (nextSettings.examStartDate || '').trim();
    const shouldSyncDates =
      Boolean(startDate) &&
      (options?.syncDatesFromStart === true ||
        existingDays.length === 0 ||
        (options?.syncDatesFromStart !== false && existingDays[0]?.date !== startDate));

    let baseDays: ScheduleDayItem[] = existingDays;

    if (shouldSyncDates && startDate) {
      const generatedDays = buildWorkingDaysFromStartDate(startDate, nextSettings, {
        count: existingDays.length > 0 ? existingDays.length : 5,
        endDateStr: nextSettings.examEndDate,
      });
      if (generatedDays.length > 0) {
        existingDays.forEach((oldDay, idx) => {
          if (oldDay?.date && generatedDays[idx]?.date && oldDay.date !== generatedDays[idx].date) {
            oldDateToNewDate.set(oldDay.date.trim(), generatedDays[idx].date.trim());
          }
        });
        baseDays = generatedDays;
      }
    }

    if (baseDays.length > 0) {
      const updatedDays = baseDays.map((day, dIdx) => {
        const built = buildTimeSlotsForDay(nextSettings, `t_${dIdx}_${Date.now()}`);
        return {
          ...day,
          dayName: day.dayName || getArabicDayName(day.date),
          timeSlots: built.timeSlots,
          timeSlotsByLevel: built.timeSlotsByLevel,
        };
      });
      localStorage.setItem('hirasa_days_schedule', JSON.stringify(updatedDays));
    }

    // 2. Sync existing exams' dates and timeRange to match the configured start date & per-level schedule
    const allExams = await api.get('/api/exams');
    if (Array.isArray(allExams) && allExams.length > 0) {
      // Fallback date mapping if existingDays was missing previously
      if (shouldSyncDates && oldDateToNewDate.size === 0 && baseDays.length > 0) {
        const uniqueOldDates = Array.from(
          new Set((allExams as Exam[]).map(e => (e?.date || '').trim()).filter(Boolean))
        ).sort();
        uniqueOldDates.forEach((oldD, idx) => {
          if (baseDays[idx]?.date && oldD !== baseDays[idx].date) {
            oldDateToNewDate.set(oldD, baseDays[idx].date);
          }
        });
      }

      const updatedExams: Exam[] = [];

      for (const ex of allExams as Exam[]) {
        if (!ex || !ex.id) {
          updatedExams.push(ex);
          continue;
        }

        const trimmedDate = (ex.date || '').trim();
        const targetDate = oldDateToNewDate.get(trimmedDate) || trimmedDate;

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

        const dateChanged = Boolean(targetDate) && targetDate !== trimmedDate;
        const timeChanged =
          Boolean(targetTimeRange) && compactTimeKey(targetTimeRange) !== compactTimeKey(ex.timeRange);

        if (dateChanged || timeChanged) {
          const nextEx: Exam = {
            ...ex,
            date: targetDate || ex.date,
            timeRange: targetTimeRange || ex.timeRange,
          };
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
