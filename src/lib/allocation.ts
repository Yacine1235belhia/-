import { Teacher, Exam, Hall, Assignment } from '../types';
import { compactTimeKey, doTimeRangesOverlap } from './timings';

export interface AllocationResult {
  assignments: Omit<Assignment, 'id'>[];
  stats: Record<string, number>; // teacherId -> totalHours
}

export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '') // Remove tashkeel
    .replace(/[أإآ]/g, 'ا')         // Normalize Alef
    .replace(/ى/g, 'ي')             // Normalize Ya
    .replace(/ة/g, 'ه')             // Normalize Taa Marbouta
    .replace(/[\-_]/g, ' ')         // Punctuation
    .replace(/\s+/g, ' ');          // Collapse spaces
}

export function isSameSubject(specialty: string, subject: string): boolean {
  if (!specialty || !subject) return false;
  const s1 = normalizeArabic(specialty);
  const s2 = normalizeArabic(subject);

  if (!s1 || !s2) return false;
  if (s1 === s2) return true;

  // Substring match
  if (s1.includes(s2) || s2.includes(s1)) return true;

  // Strip 'ال' prefix
  const stripAl = (str: string) => str.split(' ').map(w => w.startsWith('ال') ? w.slice(2) : w).join(' ');
  const clean1 = stripAl(s1);
  const clean2 = stripAl(s2);

  if (clean1 === clean2) return true;
  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;

  // Key word overlap
  const words1 = clean1.split(' ').filter(w => w.length > 2);
  const words2 = clean2.split(' ').filter(w => w.length > 2);

  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2 || (w1.length > 3 && w2.length > 3 && (w1.includes(w2) || w2.includes(w1)))) {
        return true;
      }
    }
  }

  return false;
}

export interface AllocationOptions {
  proctorsPerHall?: number;
  reserveProctorsPerPeriod?: number; // عدد أساتذة الاحتياط في كل فترة (0، 1، 2، 3)
  maxOnePerDay?: boolean;
  avoidSpecialty?: boolean;
  exemptOnOwnSubjectDay?: boolean; // إعفاء الأستاذ فترة امتحان مادته لمرافقة تلاميذه
  oneDayOff?: boolean;
  separateLevelTimings?: boolean;
}

interface DutyPosition {
  id: string;
  date: string;
  period: 'morning' | 'afternoon';
  timeRange?: string;
  duration: number;
  hallId: string;
  targetExams: Exam[];
  periodSubjects: string[];
}

export function generateAssignments(
  teachers: Teacher[],
  exams: Exam[],
  halls: Hall[],
  options: AllocationOptions = {}
): AllocationResult {
  const {
    proctorsPerHall = 2,
    reserveProctorsPerPeriod = 1,
    maxOnePerDay = false,
    avoidSpecialty = true,
    exemptOnOwnSubjectDay = true,
    separateLevelTimings = false,
  } = options;

  const activeTeachers = teachers.filter(t => !t.isExempt);

  if (activeTeachers.length === 0 || exams.length === 0 || halls.length === 0) {
    const zeroStats: Record<string, number> = {};
    teachers.forEach(t => { if (t.id) zeroStats[t.id] = 0; });
    return { assignments: [], stats: zeroStats };
  }

  // 1. Construct discrete DutyPositions per period (and per time slot when level timings are separated)
  const dutyPositions: DutyPosition[] = [];

  // Group exams by period key
  const periodsMap = new Map<string, Exam[]>();
  exams.forEach(ex => {
    const timeKey = separateLevelTimings ? (compactTimeKey(ex.timeRange) || 'default') : 'unified';
    const key = `${ex.date}::${ex.period}::${timeKey}`;
    if (!periodsMap.has(key)) periodsMap.set(key, []);
    periodsMap.get(key)!.push(ex);
  });

  // Sort period keys chronologically
  const sortedPeriodKeys = Array.from(periodsMap.keys()).sort((a, b) => {
    const [dateA, periodA, timeA = ''] = a.split('::');
    const [dateB, periodB, timeB = ''] = b.split('::');
    const dComp = dateA.localeCompare(dateB);
    if (dComp !== 0) return dComp;
    if (periodA !== periodB) return periodA === 'morning' ? -1 : 1;
    return timeA.localeCompare(timeB);
  });

  let positionCounter = 1;

  for (const periodKey of sortedPeriodKeys) {
    const periodExams = periodsMap.get(periodKey) || [];
    if (periodExams.length === 0) continue;

    const examDate = periodExams[0].date;
    const examPeriod = periodExams[0].period;
    const periodSubjects = periodExams.map(e => e.subject);
    const representativeExam = periodExams[0];
    const effectiveTimeRange = separateLevelTimings ? representativeExam.timeRange : undefined;

    // Identify merged exam groups
    const isEngSubject = (sub: string) => isSameSubject('هندسة', sub) || sub.includes('هندسة');
    const isLangSubject = (sub: string) =>
      sub.includes('ألمانية') || sub.includes('إسبانية') || sub.includes('إيطالية') || sub.includes('لغات أجنبية');

    const engExams = periodExams.filter(e => isEngSubject(e.subject));
    const langExams = periodExams.filter(e => isLangSubject(e.subject));
    const normalExams = periodExams.filter(e => !isEngSubject(e.subject) && !isLangSubject(e.subject));

    let currentHallIdx = 0;
    const resolveHallProctorCount = (hall: Hall | undefined, fallbackCount: number): number => {
      const custom = Number(hall?.proctorsCount);
      return Number.isFinite(custom) && custom >= 1 ? custom : fallbackCount;
    };

    // A. Merged Engineering Duty Positions (All merged engineering exams in 1 hall)
    if (engExams.length > 0) {
      const mainEng = engExams[0];
      const targetHall = halls[currentHallIdx % halls.length] || halls[0];
      const countProctors = resolveHallProctorCount(targetHall, mainEng.proctorsPerHall || proctorsPerHall);
      currentHallIdx++;
      const duration = Math.max(...engExams.map(e => e.duration || 2));

      for (let p = 0; p < countProctors; p++) {
        dutyPositions.push({
          id: `pos_${positionCounter++}`,
          date: examDate,
          period: examPeriod,
          timeRange: effectiveTimeRange,
          duration,
          hallId: targetHall.id!,
          targetExams: engExams,
          periodSubjects
        });
      }
    }

    // B. Merged Foreign Languages Duty Positions (All merged language exams in 1 hall)
    if (langExams.length > 0) {
      const mainLang = langExams[0];
      const targetHall = halls[currentHallIdx % halls.length] || halls[0];
      const countProctors = resolveHallProctorCount(targetHall, mainLang.proctorsPerHall || proctorsPerHall);
      currentHallIdx++;
      const duration = Math.max(...langExams.map(e => e.duration || 2));

      for (let p = 0; p < countProctors; p++) {
        dutyPositions.push({
          id: `pos_${positionCounter++}`,
          date: examDate,
          period: examPeriod,
          timeRange: effectiveTimeRange,
          duration,
          hallId: targetHall.id!,
          targetExams: langExams,
          periodSubjects
        });
      }
    }

    // C. Normal Exams Duty Positions
    normalExams.forEach(ex => {
      const numHalls = ex.hallCount || 1;
      const defaultNumProctors = ex.proctorsPerHall || proctorsPerHall;
      const duration = ex.duration || 2;

      for (let h = 0; h < numHalls; h++) {
        const targetHall = halls[currentHallIdx % halls.length] || halls[0];
        const numProctors = resolveHallProctorCount(targetHall, defaultNumProctors);
        currentHallIdx++;

        for (let p = 0; p < numProctors; p++) {
          dutyPositions.push({
            id: `pos_${positionCounter++}`,
            date: examDate,
            period: examPeriod,
            timeRange: effectiveTimeRange,
            duration,
            hallId: targetHall.id!,
            targetExams: [ex],
            periodSubjects
          });
        }
      }
    });

    // D. Reserve Duty Positions (حراس الاحتياط)
    const reserveNeeded = reserveProctorsPerPeriod || 0;
    const maxDurationInPeriod = Math.max(...periodExams.map(e => e.duration || 2));
    for (let r = 0; r < reserveNeeded; r++) {
      dutyPositions.push({
        id: `pos_${positionCounter++}`,
        date: examDate,
        period: examPeriod,
        timeRange: effectiveTimeRange,
        duration: maxDurationInPeriod,
        hallId: 'reserve',
        targetExams: [representativeExam],
        periodSubjects
      });
    }
  }

  // 2. Greedy Initial Allocation prioritizing Teachers with Least Assigned Hours
  const assignedDutySlots = new Map<string, string>(); // positionId -> teacherId
  const teacherHours: Record<string, number> = {};
  const teacherSessions: Record<string, number> = {};
  const teacherAssignedPositions: Record<string, DutyPosition[]> = {};
  const teacherAssignedDates: Record<string, Set<string>> = {};

  activeTeachers.forEach(t => {
    teacherHours[t.id!] = 0;
    teacherSessions[t.id!] = 0;
    teacherAssignedPositions[t.id!] = [];
    teacherAssignedDates[t.id!] = new Set();
  });

  const positionsOverlap = (p1: DutyPosition, p2: DutyPosition): boolean => {
    if (p1.date !== p2.date || p1.period !== p2.period) return false;
    if (!separateLevelTimings) return true;
    return doTimeRangesOverlap(p1.timeRange, p2.timeRange);
  };

  const hasTeacherConflict = (teacherId: string, targetPos: DutyPosition): boolean => {
    const existing = teacherAssignedPositions[teacherId] || [];
    return existing.some(ep => positionsOverlap(ep, targetPos));
  };

  // Candidate eligibility checker
  const isCandidateEligible = (
    teacher: Teacher,
    pos: DutyPosition,
    respectMaxOnePerDay: boolean
  ) => {
    const tId = teacher.id!;
    const periodKey = `${pos.date}-${pos.period}`;

    // 1. Already assigned in overlapping slot
    if (hasTeacherConflict(tId, pos)) return false;

    // 2. Availability exception
    if (teacher.availabilityExceptions?.includes(periodKey)) return false;

    // 3. Specialty avoidance & own subject exemption
    if (
      (avoidSpecialty || exemptOnOwnSubjectDay) &&
      pos.periodSubjects.some(sub => isSameSubject(teacher.specialty, sub))
    ) {
      return false;
    }

    // 4. Max 1 period per day constraint
    if (respectMaxOnePerDay && maxOnePerDay && teacherAssignedDates[tId]?.has(pos.date)) {
      return false;
    }

    return true;
  };

  // Perform greedy assignment for each duty position
  dutyPositions.forEach(pos => {
    // Attempt 1: Strict rules (with maxOnePerDay)
    let candidates = activeTeachers.filter(t => isCandidateEligible(t, pos, true));

    // Attempt 2: Relax maxOnePerDay if not enough candidates
    if (candidates.length === 0 && maxOnePerDay) {
      candidates = activeTeachers.filter(t => isCandidateEligible(t, pos, false));
    }

    // Fallback: If still no candidates due to specialty exemption, relax specialty check
    if (candidates.length === 0) {
      candidates = activeTeachers.filter(t => {
        const periodKey = `${pos.date}-${pos.period}`;
        return !hasTeacherConflict(t.id!, pos) && !t.availabilityExceptions?.includes(periodKey);
      });
    }

    if (candidates.length === 0) return;

    // Shuffle to break ties randomly
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // SORT BY LEAST HOURS FIRST, THEN LEAST SESSIONS FIRST!
    candidates.sort((a, b) => {
      const hA = teacherHours[a.id!] || 0;
      const hB = teacherHours[b.id!] || 0;
      if (hA !== hB) return hA - hB;

      const sA = teacherSessions[a.id!] || 0;
      const sB = teacherSessions[b.id!] || 0;
      return sA - sB;
    });

    const chosen = candidates[0];
    const tId = chosen.id!;

    assignedDutySlots.set(pos.id, tId);
    teacherHours[tId] = (teacherHours[tId] || 0) + pos.duration;
    teacherSessions[tId] = (teacherSessions[tId] || 0) + 1;
    teacherAssignedPositions[tId].push(pos);
    teacherAssignedDates[tId].add(pos.date);
  });

  // 3. ULTRA EQUALIZATION PASS: Guarantee 100% IDENTICAL hours / sessions across all teachers
  let passesLeft = 300;
  let improved = true;

  while (improved && passesLeft > 0) {
    improved = false;
    passesLeft--;

    // Recalculate exact teacher hours & sessions from assignedDutySlots
    const curHours: Record<string, number> = {};
    const curSessions: Record<string, number> = {};
    activeTeachers.forEach(t => {
      curHours[t.id!] = 0;
      curSessions[t.id!] = 0;
    });

    assignedDutySlots.forEach((tId, posId) => {
      const pos = dutyPositions.find(p => p.id === posId);
      if (pos) {
        curHours[tId] = (curHours[tId] || 0) + pos.duration;
        curSessions[tId] = (curSessions[tId] || 0) + 1;
      }
    });

    // Check difference in total hours
    let maxH = -1;
    let minH = Infinity;

    activeTeachers.forEach(t => {
      const h = curHours[t.id!] || 0;
      if (h > maxH) maxH = h;
      if (h < minH) minH = h;
    });

    // If maxH - minH <= 1, we are at mathematical perfection!
    if (maxH - minH <= 1) break;

    const overworked = activeTeachers.filter(t => curHours[t.id!] === maxH);
    const underworked = activeTeachers.filter(t => curHours[t.id!] === minH);

    if (overworked.length === 0 || underworked.length === 0) break;

    let swapDone = false;

    const isBusyInPosition = (teacherId: string, targetPos: DutyPosition): boolean => {
      return Array.from(assignedDutySlots.entries()).some(([pId, assignedId]) => {
        if (assignedId !== teacherId) return false;
        const p = dutyPositions.find(dp => dp.id === pId);
        return p ? positionsOverlap(p, targetPos) : false;
      });
    };

    // Direct Transfer Pass (from Overworked to Underworked)
    for (const overT of overworked) {
      if (swapDone) break;

      // Find duty positions assigned to overT
      const overTPositions = dutyPositions.filter(p => assignedDutySlots.get(p.id) === overT.id!);

      for (const pos of overTPositions) {
        if (swapDone) break;
        const periodKey = `${pos.date}-${pos.period}`;

        for (const underT of underworked) {
          const underId = underT.id!;

          // Check if underT is free in this overlapping time slot
          if (isBusyInPosition(underId, pos)) continue;

          // Check availability exception
          if (underT.availabilityExceptions?.includes(periodKey)) continue;

          // Check specialty exemption if enabled
          if (
            (avoidSpecialty || exemptOnOwnSubjectDay) &&
            pos.periodSubjects.some(sub => isSameSubject(underT.specialty, sub))
          ) {
            continue;
          }

          // Transfer slot
          assignedDutySlots.set(pos.id, underId);
          swapDone = true;
          improved = true;
          break;
        }
      }
    }

    // 3-Way Cycle Swap Pass if direct transfer blocked by conflicts
    if (!swapDone) {
      for (const overT of overworked) {
        if (swapDone) break;
        const overTPositions = dutyPositions.filter(p => assignedDutySlots.get(p.id) === overT.id!);

        for (const posA of overTPositions) {
          if (swapDone) break;

          // Find a neutral candidate (midT) who can take posA
          for (const midT of activeTeachers) {
            if (swapDone) break;
            if (midT.id === overT.id || curHours[midT.id!] >= maxH) continue;
            const midId = midT.id!;

            if (isBusyInPosition(midId, posA)) continue;
            if (midT.availabilityExceptions?.includes(`${posA.date}-${posA.period}`)) continue;

            // Now see if underT can take any posB from midT
            const midTPositions = dutyPositions.filter(p => assignedDutySlots.get(p.id) === midId);

            for (const posB of midTPositions) {
              if (swapDone) break;

              for (const underT of underworked) {
                const underId = underT.id!;
                if (isBusyInPosition(underId, posB)) continue;
                if (underT.availabilityExceptions?.includes(`${posB.date}-${posB.period}`)) continue;

                // Perform 3-way swap: overT -> midT for posA, midT -> underT for posB
                assignedDutySlots.set(posA.id, midId);
                assignedDutySlots.set(posB.id, underId);
                swapDone = true;
                improved = true;
                break;
              }
            }
          }
        }
      }
    }

    // Pass 3: Specialty Relaxation Pass for Absolute Mathematical Equality (if difference > 1)
    if (!swapDone && (avoidSpecialty || exemptOnOwnSubjectDay)) {
      for (const overT of overworked) {
        if (swapDone) break;
        const overTPositions = dutyPositions.filter(p => assignedDutySlots.get(p.id) === overT.id!);

        for (const pos of overTPositions) {
          if (swapDone) break;
          const periodKey = `${pos.date}-${pos.period}`;

          for (const underT of underworked) {
            const underId = underT.id!;

            // Check if underT is free in this overlapping time slot
            if (isBusyInPosition(underId, pos)) continue;

            // Check availability exception (Must NEVER breach explicitly marked absence)
            if (underT.availabilityExceptions?.includes(periodKey)) continue;

            // Relax specialty check to guarantee 100% equal distribution of hours
            assignedDutySlots.set(pos.id, underId);
            swapDone = true;
            improved = true;
            break;
          }
        }
      }
    }
  }

  // 4. Construct final clean Assignment objects (1 per teacher per hall/reserve per period)
  const assignments: Omit<Assignment, 'id'>[] = [];
  const finalStats: Record<string, number> = {};

  teachers.forEach(t => (finalStats[t.id!] = 0));

  assignedDutySlots.forEach((tId, posId) => {
    const pos = dutyPositions.find(p => p.id === posId);
    if (!pos) return;

    // Push assignment for target exams
    pos.targetExams.forEach(ex => {
      assignments.push({
        examId: ex.id!,
        teacherId: tId,
        hallId: pos.hallId,
        period: pos.period,
        date: pos.date
      });
    });

    finalStats[tId] = (finalStats[tId] || 0) + pos.duration;
  });

  return { assignments, stats: finalStats };
}
