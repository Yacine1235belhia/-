import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import html2pdf from 'html2pdf.js';
import { api, markWorkspaceDirty } from '../lib/api';
import { Exam, LevelKey, SystemSettings } from '../types';
import {
  SETTINGS_CHANGE_EVENT,
  compactTimeKey,
  getLevelConfigFromSettings,
  getScheduleTimeSlotsForLevel,
  isMorningTimeRange,
  normalizeTimeString,
  syncExamsAndScheduleWithSettings
} from '../lib/timings';
import { SECONDARY_SUBJECTS, ALGERIAN_STREAMS, getOfficialSubjectsForStreamName } from '../lib/constants';
import { 
  Calendar as CalendarIcon, Clock, Trash2, Edit2, Plus, Users, 
  BookOpen, Upload, Download, Printer, CheckCircle, RefreshCw, 
  GraduationCap, Layers, Sparkles, X, Check, Save, FileSpreadsheet, Eye,
  CheckCircle2, AlertCircle, FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import ExcelImportModal from './ExcelImportModal';
import SubjectManagementModal from './SubjectManagementModal';
import { printHtmlDirectly, sanitizeOklchInClonedDoc, EXIT_PRINT_EVENT } from '../utils/printHelpers';

interface TimeSlot {
  id: string;
  timeRange: string; // e.g. "08:00 - 10:00"
}

interface DaySchedule {
  date: string;
  dayName: string;
  timeSlots: TimeSlot[];
  timeSlotsByLevel?: Partial<Record<LevelKey, TimeSlot[]>>;
}

const DEFAULT_DAYS: DaySchedule[] = [
  {
    date: '2025-12-07',
    dayName: 'الأحد',
    timeSlots: [
      { id: 't1', timeRange: '08:00 - 10:00' },
      { id: 't2', timeRange: '10:00 - 12:00' }
    ]
  },
  {
    date: '2025-12-08',
    dayName: 'الإثنين',
    timeSlots: [
      { id: 't3', timeRange: '08:00 - 10:00' },
      { id: 't4', timeRange: '10:00 - 12:00' }
    ]
  },
  {
    date: '2025-12-09',
    dayName: 'الثلاثاء',
    timeSlots: [
      { id: 't5', timeRange: '08:00 - 10:00' },
      { id: 't6', timeRange: '10:00 - 12:00' }
    ]
  },
  {
    date: '2025-12-10',
    dayName: 'الأربعاء',
    timeSlots: [
      { id: 't7', timeRange: '08:00 - 10:00' },
      { id: 't8', timeRange: '10:00 - 12:00' }
    ]
  },
  {
    date: '2025-12-11',
    dayName: 'الخميس',
    timeSlots: [
      { id: 't9', timeRange: '08:00 - 10:00' },
      { id: 't10', timeRange: '10:00 - 12:00' }
    ]
  }
];

export const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Active Level Tab: 'first' | 'second' | 'third'
  const [activeLevel, setActiveLevel] = useState<'first' | 'second' | 'third'>('first');
  
  // Start Date
  const [weekStartDate, setWeekStartDate] = useState<string>('2025-12-07');
  
  // Modals
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isAddExamModalOpen, setIsAddExamModalOpen] = useState(false);

  // Excel Import State
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Cell Subject Editing Modal State
  const [editingCell, setEditingCell] = useState<{
    date: string;
    period: 'morning' | 'afternoon';
    timeRange: string;
    stream: string;
    currentSubject: string;
  } | null>(null);

  const [applyToAllStreamsInLevel, setApplyToAllStreamsInLevel] = useState(false);
  const [customSubjectInput, setCustomSubjectInput] = useState('');

  // Days configuration with local storage persistence
  const [days, setDays] = useState<DaySchedule[]>(() => {
    const saved = localStorage.getItem('hirasa_days_schedule');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch(e) {}
    }
    return DEFAULT_DAYS;
  });

  // Institution settings for official print & synced level timings
  const [sysSettings, setSysSettings] = useState<SystemSettings | null>(null);
  const [institutionName, setInstitutionName] = useState('ثانوية محمد بلخير');
  const [wilaya, setWilaya] = useState('البيض');
  const [schoolYear, setSchoolYear] = useState('2025-2026');
  const [selectedTerm, setSelectedTerm] = useState('الفصل الثالث');

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printScope, setPrintScope] = useState<'current' | 'all'>('current');

  useEffect(() => {
    const handleExitPrint = () => {
      setIsPrintModalOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPrintModalOpen) {
        setIsPrintModalOpen(false);
      }
    };
    window.addEventListener(EXIT_PRINT_EVENT, handleExitPrint);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener(EXIT_PRINT_EVENT, handleExitPrint);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPrintModalOpen]);

  // Clear schedule confirmation modal state (replaces window.confirm blocked in sandboxed iframes)
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Editable Streams configuration per level
  const [levelStreams, setLevelStreams] = useState<Record<'first' | 'second' | 'third', { id: string; name: string; shortName: string }[]>>({
    first: [
      { id: '1_common_science', name: 'أولى جذع مشترك علوم وتكنولوجيا', shortName: 'ج م ع ت' },
      { id: '1_common_arts', name: 'أولى جذع مشترك آداب', shortName: 'ج م آ' }
    ],
    second: [
      { id: '2_exp_sciences', name: 'ثانية علوم تجريبية', shortName: 'علوم تجريبية' },
      { id: '2_math', name: 'ثانية رياضيات', shortName: 'رياضيات' },
      { id: '2_math_tech', name: 'ثانية تقني رياضي', shortName: 'تقني رياضي' },
      { id: '2_management', name: 'ثانية تسيير واقتصاد', shortName: 'تسيير واقتصاد' },
      { id: '2_arts_philo', name: 'ثانية آداب وفلسفة', shortName: 'آداب وفلسفة' },
      { id: '2_foreign_languages', name: 'ثانية لغات أجنبية', shortName: 'لغات أجنبية' },
      { id: '2_arts', name: 'ثانية فنون', shortName: 'فنون' }
    ],
    third: [
      { id: '3_exp_sciences', name: 'ثالثة علوم تجريبية', shortName: 'علوم تجريبية' },
      { id: '3_math', name: 'ثالثة رياضيات', shortName: 'رياضيات' },
      { id: '3_math_tech', name: 'ثالثة تقني رياضي', shortName: 'تقني رياضي' },
      { id: '3_management', name: 'ثالثة تسيير واقتصاد', shortName: 'تسيير واقتصاد' },
      { id: '3_arts_philo', name: 'ثالثة آداب وفلسفة', shortName: 'آداب وفلسفة' },
      { id: '3_foreign_languages', name: 'ثالثة لغات أجنبية', shortName: 'لغات أجنبية' },
      { id: '3_arts', name: 'ثالثة فنون', shortName: 'فنون' }
    ]
  });

  // Time Slot Editing State
  const [editingTimeSlot, setEditingTimeSlot] = useState<{ dayDate: string; timeSlotId: string; oldTimeRange: string } | null>(null);
  const [newTimeRangeInput, setNewTimeRangeInput] = useState('');

  // Deduplicate exam records per level + stream + subject
  const deduplicateExamsList = (rawList: Exam[]): Exam[] => {
    const seen = new Set<string>();
    const clean: Exam[] = [];
    const duplicateIds: string[] = [];

    rawList.forEach(e => {
      if (!e || !e.subject) return;
      const lvl = getLevelKey(e.targetLevel) || 'first';
      const st = e.stream ? e.stream.trim().toLowerCase() : 'all';
      const sub = e.subject.trim().toLowerCase();
      const key = `${lvl}::${st}::${sub}`;

      if (seen.has(key)) {
        if (e.id) duplicateIds.push(e.id);
      } else {
        seen.add(key);
        clean.push(e);
      }
    });

    if (duplicateIds.length > 0) {
      duplicateIds.forEach(id => {
        api.delete(`/api/exams/${id}`).catch(console.error);
      });
    }

    return clean;
  };

  const fetchExams = async () => {
    try {
      const data = await api.get('/api/exams');
      if (Array.isArray(data)) {
        const cleaned = deduplicateExamsList(data);
        setExams(cleaned);
        localStorage.setItem('hirasa_exams', JSON.stringify(cleaned));
      }
    } catch(e) {
      console.error(e);
      const saved = localStorage.getItem('hirasa_exams');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const cleaned = deduplicateExamsList(parsed);
          setExams(cleaned);
        } catch(err) {}
      }
    } finally {
      setLoading(false);
    }
  };

  const buildDaySlotsFromSettings = (
    settingsObj: Partial<SystemSettings> | null | undefined,
    prefix: string
  ): { timeSlots: TimeSlot[]; timeSlotsByLevel: Record<LevelKey, TimeSlot[]> } => {
    const unifiedSlots = getScheduleTimeSlotsForLevel(
      { ...(settingsObj || {}), separateLevelTimings: false },
      'first'
    ).map((tr, idx) => ({ id: `${prefix}_u_${idx}`, timeRange: tr }));

    const timeSlotsByLevel: Record<LevelKey, TimeSlot[]> = {
      first: getScheduleTimeSlotsForLevel(settingsObj, 'first').map((tr, idx) => ({
        id: `${prefix}_1_${idx}`,
        timeRange: tr
      })),
      second: getScheduleTimeSlotsForLevel(settingsObj, 'second').map((tr, idx) => ({
        id: `${prefix}_2_${idx}`,
        timeRange: tr
      })),
      third: getScheduleTimeSlotsForLevel(settingsObj, 'third').map((tr, idx) => ({
        id: `${prefix}_3_${idx}`,
        timeRange: tr
      }))
    };

    return {
      timeSlots: settingsObj?.separateLevelTimings ? timeSlotsByLevel.first : unifiedSlots,
      timeSlotsByLevel
    };
  };

  const getDayTimeSlotsForLevel = (day: DaySchedule, levelKey: LevelKey): TimeSlot[] => {
    if (sysSettings?.separateLevelTimings) {
      const lvlSlots = day.timeSlotsByLevel?.[levelKey];
      if (Array.isArray(lvlSlots) && lvlSlots.length > 0) {
        return lvlSlots;
      }
      return getScheduleTimeSlotsForLevel(sysSettings, levelKey).map((tr, idx) => ({
        id: `t_${day.date}_${levelKey}_${idx}`,
        timeRange: tr
      }));
    }
    return day.timeSlots;
  };

  const applySettingsSnapshot = (res: any) => {
    if (!res) return;
    setSysSettings(res);
    if (res.examStartDate) setWeekStartDate(res.examStartDate);
    if (res.institutionName) setInstitutionName(res.institutionName);
    if (res.wilaya) setWilaya(res.wilaya);
    if (res.schoolYear) setSchoolYear(res.schoolYear);
    if (res.selectedTerm) setSelectedTerm(res.selectedTerm);
  };

  useEffect(() => {
    let mounted = true;
    const initExamsAndSettings = async () => {
      try {
        const res = await api.get('/api/settings');
        if (res && mounted) {
          applySettingsSnapshot(res);
          const hasStoredDays = Boolean(localStorage.getItem('hirasa_days_schedule'));
          await syncExamsAndScheduleWithSettings(res, {
            syncDatesFromStart: !hasStoredDays,
          });
          const refreshedDays = localStorage.getItem('hirasa_days_schedule');
          if (refreshedDays && mounted) {
            try {
              const parsed = JSON.parse(refreshedDays);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setDays(parsed);
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) {
          fetchExams();
        }
      }
    };

    initExamsAndSettings();

    const onSettingsChanged = (ev: Event) => {
      const customEv = ev as CustomEvent<SystemSettings>;
      if (customEv.detail) {
        applySettingsSnapshot(customEv.detail);
      }
      const savedDays = localStorage.getItem('hirasa_days_schedule');
      if (savedDays) {
        try {
          const parsed = JSON.parse(savedDays);
          if (Array.isArray(parsed) && parsed.length > 0) setDays(parsed);
        } catch {}
      }
      fetchExams();
    };

    window.addEventListener(SETTINGS_CHANGE_EVENT, onSettingsChanged);
    return () => {
      mounted = false;
      window.removeEventListener(SETTINGS_CHANGE_EVENT, onSettingsChanged);
    };
  }, []);

  const getArabicDayName = (dateStr: string) => {
    if (!dateStr) return 'الأحد';
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      const daysArr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      return daysArr[date.getDay()];
    }
    return 'الأحد';
  };

  // Recalculate days and shift exams based on start date without UTC timezone bugs
  const handleStartDateChange = async (newStartDate: string) => {
    if (!newStartDate) return;
    setWeekStartDate(newStartDate);
    toast.loading('جاري ربط الأيام وتواريخ الاختبارات بالتاريخ الجديد...', { id: 'date-sync' });

    try {
      const updatedSettings: Partial<SystemSettings> = {
        ...(sysSettings || {}),
        examStartDate: newStartDate,
      };
      await api.post('/api/settings', { examStartDate: newStartDate });
      await syncExamsAndScheduleWithSettings(updatedSettings, { syncDatesFromStart: true });
      const savedDays = localStorage.getItem('hirasa_days_schedule');
      if (savedDays) {
        try {
          const parsed = JSON.parse(savedDays);
          if (Array.isArray(parsed) && parsed.length > 0) setDays(parsed);
        } catch {}
      }
      await fetchExams();
      markWorkspaceDirty();
      toast.success('تم ربط الأيام وتواريخ الاختبارات بالتاريخ الجديد بنجاح', { id: 'date-sync' });
    } catch (e) {
      console.error(e);
      toast.error('خطأ في مزامنة التواريخ', { id: 'date-sync' });
    }
  };

  // Edit specific day date directly
  const handleEditDayDate = (oldDate: string, newDateStr: string) => {
    if (!newDateStr || newDateStr === oldDate) return;
    const newDayName = getArabicDayName(newDateStr);
    const updatedDays = days.map(d => {
      if (d.date === oldDate) {
        return {
          ...d,
          date: newDateStr,
          dayName: newDayName
        };
      }
      return d;
    });
    setDays(updatedDays);
    localStorage.setItem('hirasa_days_schedule', JSON.stringify(updatedDays));

    // Update existing exams with oldDate
    const updatedExams = exams.map(e => e.date === oldDate ? { ...e, date: newDateStr } : e);
    setExams(updatedExams);
    localStorage.setItem('hirasa_exams', JSON.stringify(updatedExams));
    markWorkspaceDirty();
    toast.success(`تم تغيير التاريخ إلى ${newDayName} (${newDateStr})`);
  };

  // Active level label and streams
  const activeLevelLabel = activeLevel === 'third' ? 'ثالثة' : activeLevel === 'second' ? 'ثانية' : 'أولى';
  const streamsForActiveLevel = levelStreams[activeLevel];

  // Reorder Stream Columns Left / Right
  const handleMoveStream = (index: number, direction: 'left' | 'right') => {
    const list = [...levelStreams[activeLevel]];
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    setLevelStreams({ ...levelStreams, [activeLevel]: list });
    toast.success('تم إعادة ترتيب الشعبة');
  };

  // Edit Stream Header Title
  const handleEditStreamName = (streamId: string, oldName: string) => {
    const newName = window.prompt('تعديل اسم الشعبة / القسم:', oldName);
    if (newName && newName.trim() && newName !== oldName) {
      const list = levelStreams[activeLevel].map(s => s.id === streamId ? { ...s, name: newName.trim() } : s);
      setLevelStreams({ ...levelStreams, [activeLevel]: list });
      toast.success('تم تعديل اسم الشعبة');
    }
  };

  // Delete Stream Column from Matrix
  const handleDeleteStream = (streamId: string) => {
    if (levelStreams[activeLevel].length <= 1) {
      toast.error('يجب بقاء شعبة واحدة على الأقل بالجدول');
      return;
    }
    const list = levelStreams[activeLevel].filter(s => s.id !== streamId);
    setLevelStreams({ ...levelStreams, [activeLevel]: list });
    toast.success('تم حذف الشعبة من الجدول');
  };

  // Add Stream Column (+ قسم)
  const handleAddStreamColumn = () => {
    const name = window.prompt('إضافة شعبة / قسم جديد للرزنامة:');
    if (name && name.trim()) {
      const newStream = {
        id: `custom_st_${Date.now()}`,
        name: name.trim(),
        shortName: name.trim()
      };
      setLevelStreams({
        ...levelStreams,
        [activeLevel]: [...levelStreams[activeLevel], newStream]
      });
      toast.success('تم إضافة الشعبة للجدول');
    }
  };

  // Open Edit Time Slot Modal
  const handleOpenEditTimeSlot = (dayDate: string, timeSlotId: string, currentRange: string) => {
    setEditingTimeSlot({ dayDate, timeSlotId, oldTimeRange: currentRange });
    setNewTimeRangeInput(currentRange);
  };

  // Save Time Slot Edit
  const handleSaveTimeSlot = async () => {
    if (!editingTimeSlot || !newTimeRangeInput.trim()) return;
    const { dayDate, timeSlotId, oldTimeRange } = editingTimeSlot;
    const updatedRange = normalizeTimeString(newTimeRangeInput.trim());

    toast.loading('جاري تحديث التوقيت وتدوينه...', { id: 'ts-save' });

    try {
      const updatedDays = days.map(d => {
        if (d.date !== dayDate) return d;
        if (sysSettings?.separateLevelTimings) {
          const curLevelSlots = getDayTimeSlotsForLevel(d, activeLevel);
          const nextLevelSlots = curLevelSlots.map(ts =>
            ts.id === timeSlotId ? { ...ts, timeRange: updatedRange } : ts
          );
          const built = buildDaySlotsFromSettings(sysSettings, `ts_${Date.now()}`);
          const nextByLevel = {
            ...(d.timeSlotsByLevel || built.timeSlotsByLevel),
            [activeLevel]: nextLevelSlots
          };
          return {
            ...d,
            timeSlots: activeLevel === 'first' ? nextLevelSlots : d.timeSlots,
            timeSlotsByLevel: nextByLevel
          };
        }
        return {
          ...d,
          timeSlots: d.timeSlots.map(ts => ts.id === timeSlotId ? { ...ts, timeRange: updatedRange } : ts)
        };
      });
      setDays(updatedDays);
      localStorage.setItem('hirasa_days_schedule', JSON.stringify(updatedDays));
      markWorkspaceDirty();

      // Also update any existing exams with oldTimeRange on dayDate (scoped to activeLevel if separated)
      const examsToUpdate = exams.filter(e => {
        if (e.date !== dayDate) return false;
        if (compactTimeKey(e.timeRange) !== compactTimeKey(oldTimeRange)) return false;
        if (sysSettings?.separateLevelTimings) {
          return matchLevel(e.targetLevel, activeLevel) || getLevelKey(e.stream) === activeLevel;
        }
        return true;
      });
      for (const ex of examsToUpdate) {
        if (ex.id) {
          await api.put(`/api/exams/${ex.id}`, { ...ex, timeRange: updatedRange });
        }
      }

      setEditingTimeSlot(null);
      toast.success('تم تعديل التوقيت ومزامنة الرزنامة بنجاح!', { id: 'ts-save' });
      fetchExams();
    } catch (e) {
      toast.error('خطأ في حفظ التوقيت', { id: 'ts-save' });
    }
  };

  // Delete Time Slot
  const handleDeleteTimeSlot = (dayDate: string, timeSlotId: string) => {
    const updatedDays = days.map(d => {
      if (d.date !== dayDate) return d;
      if (sysSettings?.separateLevelTimings) {
        const curLevelSlots = getDayTimeSlotsForLevel(d, activeLevel);
        const filtered = curLevelSlots.filter(ts => ts.id !== timeSlotId);
        if (filtered.length === 0) return d;
        const built = buildDaySlotsFromSettings(sysSettings, `ts_${Date.now()}`);
        const nextByLevel = {
          ...(d.timeSlotsByLevel || built.timeSlotsByLevel),
          [activeLevel]: filtered
        };
        return {
          ...d,
          timeSlots: activeLevel === 'first' ? filtered : d.timeSlots,
          timeSlotsByLevel: nextByLevel
        };
      }
      return {
        ...d,
        timeSlots: d.timeSlots.filter(ts => ts.id !== timeSlotId)
      };
    }).filter(d => d.timeSlots.length > 0);
    setDays(updatedDays);
    localStorage.setItem('hirasa_days_schedule', JSON.stringify(updatedDays));
    markWorkspaceDirty();
    toast.success('تم حذف التوقيت');
  };

  // Delete Whole Day
  const handleDeleteDay = (dayDate: string) => {
    const updatedDays = days.filter(d => d.date !== dayDate);
    setDays(updatedDays);
    localStorage.setItem('hirasa_days_schedule', JSON.stringify(updatedDays));
    markWorkspaceDirty();
    toast.success('تم حذف اليوم من الرزنامة');
  };

  // Level key parser
  const getLevelKey = (str: string | undefined): 'first' | 'second' | 'third' | null => {
    if (!str) return null;
    const lower = str.trim().toLowerCase();
    if (lower === 'first' || lower.includes('أولى') || lower.includes('1ثا') || lower.includes('1_') || lower.includes('جذع مشترك')) return 'first';
    if (lower === 'second' || lower.includes('ثانية') || lower.includes('2ثا') || lower.includes('2_')) return 'second';
    if (lower === 'third' || lower.includes('ثالثة') || lower.includes('3ثا') || lower.includes('3_') || lower.includes('بكالوريا')) return 'third';
    return null;
  };

  const matchLevel = (examTargetLevel: string | undefined, currentLevelKey: 'first' | 'second' | 'third') => {
    if (!examTargetLevel) return true;
    if (examTargetLevel === currentLevelKey) return true;
    if (examTargetLevel === 'first_second' && currentLevelKey !== 'third') return true;
    return false;
  };

  // Robust Stream Matching Algorithm strictly enforcing Level Separation
  const matchStream = (examStream: string | undefined, cellStreamName: string) => {
    if (!examStream || !cellStreamName) return true;
    const ex = examStream.trim();
    const cell = cellStreamName.trim();

    if (ex === cell) return true;
    if (ex.includes('جميع') || ex.includes('الكل') || cell.includes('جميع') || cell.includes('الكل')) {
      return true;
    }

    // Strict Grade Level Separation
    const exLevel = getLevelKey(ex);
    const cellLevel = getLevelKey(cell);
    if (exLevel && cellLevel && exLevel !== cellLevel) {
      return false;
    }

    // Clean level prefixes
    const cleanEx = ex.replace(/^(أولى|ثانية|ثالثة|1ثا|2ثا|3ثا|سنة أولى|سنة ثانية|سنة ثالثة|1_|2_|_3_|3_)\s*/gi, '').trim().toLowerCase();
    const cleanCell = cell.replace(/^(أولى|ثانية|ثالثة|1ثا|2ثا|3ثا|سنة أولى|سنة ثانية|سنة ثالثة|1_|2_|_3_|3_)\s*/gi, '').trim().toLowerCase();

    if (cleanEx === cleanCell) return true;
    if (cleanEx && cleanCell && (cleanCell.includes(cleanEx) || cleanEx.includes(cleanCell))) return true;

    // Domain keywords matching ONLY within the same level
    if (cleanEx.includes('علوم وتكنولوجيا') && cleanCell.includes('علوم وتكنولوجيا')) return true;
    if (cleanEx.includes('جذع مشترك علوم') && cleanCell.includes('علوم')) return true;
    if (cleanEx.includes('جذع مشترك آداب') && cleanCell.includes('آداب')) return true;
    if (cleanEx.includes('تقني') && cleanCell.includes('تقني')) return true;
    if (cleanEx.includes('تسيير') && cleanCell.includes('تسيير')) return true;
    if (cleanEx.includes('تجريبية') && cleanCell.includes('تجريبية')) return true;
    if (cleanEx.includes('فلسفة') && cleanCell.includes('فلسفة')) return true;
    if (cleanEx.includes('لغات') && cleanCell.includes('لغات')) return true;
    if (cleanEx.includes('رياضيات') && cleanCell.includes('رياضيات') && !cleanEx.includes('تقني') && !cleanCell.includes('تقني')) return true;

    return false;
  };

  const normalizeTime = (t: string | undefined) => {
    if (!t) return '';
    return t.replace(/[\s–—]+/g, '').replace(/-/g, '-').trim();
  };

  // Find existing exam for cell matching date, timeRange, targetLevel and stream
  const getExamForCellInLevel = (date: string, timeRange: string, streamName: string, levelKey: 'first' | 'second' | 'third') => {
    return exams.find(e => {
      const matchDate = e.date.trim() === date.trim();
      const matchTime = e.timeRange ? (normalizeTime(e.timeRange) === normalizeTime(timeRange)) : true;
      const examLevelMatches = matchLevel(e.targetLevel, levelKey);
      const matchSt = matchStream(e.stream, streamName);
      return matchDate && matchTime && examLevelMatches && matchSt;
    });
  };

  const getExamForCell = (date: string, timeRange: string, streamName: string) => {
    return getExamForCellInLevel(date, timeRange, streamName, activeLevel);
  };

  // Get configured / default subjects for a stream
  const getSubjectsForStream = (streamName: string) => {
    const saved = localStorage.getItem('hirasa_stream_subjects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const matchingKey = Object.keys(parsed).find(key => {
          if (key.includes('common_science') && streamName.includes('علوم وتكنولوجيا')) return true;
          if (key.includes('common_arts') && streamName.includes('آداب') && streamName.includes('جذع')) return true;
          if (key.includes('exp_sciences') && streamName.includes('تجريبية')) return true;
          if (key.includes('math_tech') && streamName.includes('تقني')) return true;
          if (key.includes('management') && streamName.includes('تسيير')) return true;
          if (key.includes('arts_philo') && streamName.includes('فلسفة')) return true;
          if (key.includes('foreign_languages') && streamName.includes('لغات')) return true;
          if (key.includes('math') && streamName.includes('رياضيات') && !streamName.includes('تقني')) return true;
          if (key.includes('arts') && streamName.includes('فنون')) return true;
          return false;
        });
        if (matchingKey && parsed[matchingKey] && parsed[matchingKey].length > 0) {
          return parsed[matchingKey] as string[];
        }
      } catch (e) {
        console.error(e);
      }
    }

    return getOfficialSubjectsForStreamName(streamName);
  };

  // Save/Assign Subject to Cell
  const handleAssignSubjectToCell = async (subjectName: string) => {
    if (!editingCell) return;
    const { date, period, timeRange, stream } = editingCell;

    toast.loading('جاري كتابة المادة على الخانة...', { id: 'cell-save' });

    try {
      const targetLevelVal = activeLevel;
      const targetStreams = applyToAllStreamsInLevel 
        ? streamsForActiveLevel.map(s => s.name)
        : [stream];

      let updatedExams = [...exams];

      if (subjectName === '') {
        // Clear cells
        for (const st of targetStreams) {
          const existing = updatedExams.find(e => 
            e.date.trim() === date.trim() && 
            (e.timeRange ? normalizeTime(e.timeRange) === normalizeTime(timeRange) : e.period === period) && 
            matchLevel(e.targetLevel, activeLevel) &&
            matchStream(e.stream, st)
          );
          if (existing && existing.id) {
            try { await api.delete(`/api/exams/${existing.id}`); } catch(err) {}
            updatedExams = updatedExams.filter(e => e.id !== existing.id);
          }
        }
        toast.success('تم مسح المادة من الخانة', { id: 'cell-save' });
      } else {
        // Prevent duplicate insertion of the same subject in another cell for the same stream on the active schedule grid
        for (const st of targetStreams) {
          const isAlreadyOnActiveGrid = days.some(day => {
            return getDayTimeSlotsForLevel(day, activeLevel).some(slot => {
              const isSameCell = day.date === date && slot.timeRange === timeRange;
              if (isSameCell) return false;
              const exam = getExamForCellInLevel(day.date, slot.timeRange, st, activeLevel);
              return exam && exam.subject && exam.subject.trim().toLowerCase() === subjectName.trim().toLowerCase();
            });
          });

          if (isAlreadyOnActiveGrid) {
            toast.error(`مادة (${subjectName}) مدونة بالفعل لشعبة (${st}) على جدول هذا المستوى. لا يمكن تكرار المادة لنفس الشعبة!`, { id: 'cell-save' });
            return;
          }
        }

        // Save subject for target streams
        for (const st of targetStreams) {
          const existing = updatedExams.find(e => 
            e.date.trim() === date.trim() && 
            (e.timeRange ? normalizeTime(e.timeRange) === normalizeTime(timeRange) : e.period === period) && 
            matchLevel(e.targetLevel, activeLevel) &&
            matchStream(e.stream, st)
          );

          const newId = existing?.id || `ex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const examData: Exam = {
            id: newId,
            subject: subjectName,
            date,
            period,
            timeRange,
            duration: 2,
            hallCount: 1,
            proctorsPerHall: 2,
            targetLevel: targetLevelVal,
            stream: st
          };

          if (existing && existing.id) {
            try { await api.put(`/api/exams/${existing.id}`, examData); } catch(err) {}
            updatedExams = updatedExams.map(e => e.id === existing.id ? examData : e);
          } else {
            try { await api.post('/api/exams', examData); } catch(err) {}
            updatedExams.push(examData);
          }
        }
        toast.success(`تمت كتابة مادة (${subjectName}) في الخانة بنجاح!`, { id: 'cell-save' });
      }

      setExams([...updatedExams]);
      localStorage.setItem('hirasa_exams', JSON.stringify(updatedExams));
      setEditingCell(null);
      setCustomSubjectInput('');
      setApplyToAllStreamsInLevel(false);
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء حفظ المادة', { id: 'cell-save' });
    }
  };

  // Remove Subject from Cell directly
  const handleRemoveExamFromCell = async (examId: string) => {
    toast.loading('جاري مسح المادة وإعادتها لقائمة المواد المتاحة...', { id: 'remove-cell' });
    try {
      await api.delete(`/api/exams/${examId}`);
      setExams(exams.filter(e => e.id !== examId));
      toast.success('تم مسح المادة من الخانة وإعادتها للمواد المتاحة', { id: 'remove-cell' });
      await fetchExams();
    } catch (e) {
      toast.error('خطأ في مسح الخلية', { id: 'remove-cell' });
    }
  };

  // Add Exam Modal Submit
  const handleCreateExamFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const subject = (formData.get('subject') as string || '').trim();
    const date = formData.get('date') as string;
    const period = formData.get('period') as 'morning' | 'afternoon';
    const stream = formData.get('stream') as string;
    const rawTarget = (formData.get('targetLevel') || activeLevel) as 'first' | 'second' | 'first_second' | 'third';
    const targetLevel: 'first' | 'second' | 'first_second' | 'third' = rawTarget;
    const lvlForTiming: LevelKey = targetLevel === 'third' ? 'third' : targetLevel === 'second' ? 'second' : 'first';
    const lvlCfg = getLevelConfigFromSettings(sysSettings, lvlForTiming);
    const timeRange =
      period === 'morning'
        ? (lvlCfg.morningSlot1 || '08:00 - 10:00')
        : (lvlCfg.afternoonSlot || '13:30 - 15:30');

    if (!subject) {
      toast.error('يرجى كتابة أو اختيار اسم المادة');
      return;
    }

    // Check if subject is ALREADY assigned to this stream/level in any date/timeSlot
    const existingForStream = exams.find(e => {
      const sameLevel = matchLevel(e.targetLevel, targetLevel === 'third' ? 'third' : activeLevel);
      const sameStream = stream === 'جميع الشعب والجذوع المشتركة' ? true : matchStream(e.stream, stream);
      const sameSubject = e.subject.trim().toLowerCase() === subject.trim().toLowerCase();
      return sameLevel && sameStream && sameSubject;
    });

    if (existingForStream) {
      toast.error(`مادة (${subject}) مدونة بالفعل لهذا المستوى لشعبة (${stream}) بتاريخ (${existingForStream.date}). لا يمكن تكرار إدراج المادة مرتين!`);
      return;
    }

    toast.loading('جاري كتابة المادة الجديدة في الخانة...', { id: 'add-exam' });

    try {
      const newExam: Exam = {
        id: Date.now().toString() + Math.random().toString().slice(2, 6),
        subject,
        date,
        period,
        timeRange,
        duration: Number(formData.get('duration')) || 2,
        hallCount: Number(formData.get('hallCount')) || 1,
        proctorsPerHall: Number(formData.get('proctorsPerHall')) || 2,
        targetLevel,
        stream: stream || 'جميع الشعب والجذوع المشتركة'
      };

      await api.post('/api/exams', newExam);
      setExams([...exams, newExam]);
      toast.success(`تمت إضافة وتدوين مادة (${subject}) في الخانة!`, { id: 'add-exam' });
      setIsAddExamModalOpen(false);
      form.reset();
      await fetchExams();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إضافة المادة', { id: 'add-exam' });
    }
  };

  // Add Day to Schedule with proper local date handling (skipping Friday & Saturday)
  const handleAddDay = () => {
    const lastDay = days[days.length - 1];
    let nextDate = new Date();
    if (lastDay) {
      const [y, m, d] = lastDay.date.split('-').map(Number);
      nextDate = new Date(y, m - 1, d + 1);
    }
    const dayOfWeek = nextDate.getDay();
    if (dayOfWeek === 5) nextDate.setDate(nextDate.getDate() + 2); // Friday -> Sunday
    else if (dayOfWeek === 6) nextDate.setDate(nextDate.getDate() + 1); // Saturday -> Sunday

    const formatted = formatLocalDate(nextDate);
    const built = buildDaySlotsFromSettings(sysSettings, `t_${Date.now()}`);
    const newDay: DaySchedule = {
      date: formatted,
      dayName: getArabicDayName(formatted),
      timeSlots: built.timeSlots,
      timeSlotsByLevel: built.timeSlotsByLevel
    };
    const updated = [...days, newDay];
    setDays(updated);
    localStorage.setItem('hirasa_days_schedule', JSON.stringify(updated));
    markWorkspaceDirty();
    toast.success(`تم إضافة يوم ${newDay.dayName} (${formatted}) بنجاح`);
  };

  // Add Time Slot to Day
  const handleAddTimeSlot = (dayDate: string) => {
    const defaultNewSlot = getLevelConfigFromSettings(sysSettings, activeLevel).afternoonSlot || '13:30 - 15:30';
    const updated = days.map(d => {
      if (d.date !== dayDate) return d;
      if (sysSettings?.separateLevelTimings) {
        const curLevelSlots = getDayTimeSlotsForLevel(d, activeLevel);
        const nextLevelSlots = [
          ...curLevelSlots,
          { id: `ts_${Date.now()}`, timeRange: defaultNewSlot }
        ];
        const built = buildDaySlotsFromSettings(sysSettings, `ts_${Date.now()}`);
        const nextByLevel = {
          ...(d.timeSlotsByLevel || built.timeSlotsByLevel),
          [activeLevel]: nextLevelSlots
        };
        return {
          ...d,
          timeSlots: activeLevel === 'first' ? nextLevelSlots : d.timeSlots,
          timeSlotsByLevel: nextByLevel
        };
      }
      return {
        ...d,
        timeSlots: [
          ...d.timeSlots,
          { id: `ts_${Date.now()}`, timeRange: defaultNewSlot }
        ]
      };
    });
    setDays(updated);
    localStorage.setItem('hirasa_days_schedule', JSON.stringify(updated));
    markWorkspaceDirty();
    toast.success('تم إضافة توقيت جديد لليوم');
  };

  // Clear Matrix Schedule (All levels or Active Level)
  const handleExecuteClearMatrix = async (scope: 'all' | 'current') => {
    setIsClearModalOpen(false);
    toast.loading(scope === 'all' ? 'جاري مسح كل الجدول بالكامل...' : `جاري مسح جدول المستوى (${activeLevelLabel})...`, { id: 'clear-mat' });
    try {
      if (scope === 'all') {
        await api.delete('/api/exams/all');
        setExams([]);
        localStorage.setItem('hirasa_exams', '[]');
        toast.success('تم مسح كل الجدول بالكامل بنجاح!', { id: 'clear-mat' });
      } else {
        const toDelete = exams.filter(e => {
          const byTarget = matchLevel(e.targetLevel, activeLevel);
          const byStream = getLevelKey(e.stream) === activeLevel;
          return byTarget || byStream;
        });
        const idsToDelete = toDelete.map(e => String(e.id)).filter(Boolean);
        if (idsToDelete.length > 0) {
          await api.post('/api/exams/delete-many', { ids: idsToDelete });
        }
        const idSet = new Set(idsToDelete);
        const remainingExams = exams.filter(e => !idSet.has(String(e.id)));
        setExams(remainingExams);
        localStorage.setItem('hirasa_exams', JSON.stringify(remainingExams));
        toast.success(`تم مسح جميع مواد المستوى (${activeLevelLabel}) بنجاح!`, { id: 'clear-mat' });
      }
      await fetchExams();
    } catch (e) {
      console.error(e);
      toast.error('خطأ أثناء مسح الجدول', { id: 'clear-mat' });
    }
  };

  // Export Matrix to Excel matching user screenshot format (full styling, colors, borders, RTL, merged days)
  const handleExportExcel = () => {
    const minDate = days[0]?.date || weekStartDate;
    const maxDate = days[days.length - 1]?.date || weekStartDate;
    const totalCols = 4 + streamsForActiveLevel.length;

    // Stream column headers with generous width
    const streamHeadersHtml = streamsForActiveLevel
      .map(st => `<th style="background-color: #0099FF; color: #ffffff; border: 1.5px solid #000000; padding: 10px; font-size: 11pt; font-weight: bold; text-align: center; min-width: 220px;">${st.name}</th>`)
      .join('');

    let rowsHtml = '';
    days.forEach(d => {
      const levelSlots = getDayTimeSlotsForLevel(d, activeLevel);
      levelSlots.forEach((ts, sIdx) => {
        const isMorning = isMorningTimeRange(ts.timeRange);
        const bgCol = isMorning ? '#FEF3C7' : '#E9D5FF';
        const textCol = isMorning ? '#78350F' : '#581C87';
        const periodText = isMorning ? 'صباحية' : 'مسائية';

        const streamCellsHtml = streamsForActiveLevel.map(st => {
          const ex = getExamForCell(d.date, ts.timeRange, st.name);
          return `<td style="border: 1.5px solid #000000; padding: 10px; font-size: 10pt; font-weight: bold; text-align: center; vertical-align: middle;">${ex ? ex.subject : ''}</td>`;
        }).join('');

        const dayTd = sIdx === 0 ? `<td rowspan="${levelSlots.length}" style="border: 1.5px solid #000000; padding: 10px; font-size: 11pt; font-weight: bold; text-align: center; vertical-align: middle; background-color: #F8FAFC;">${d.dayName}</td>` : '';
        const dateTd = sIdx === 0 ? `<td rowspan="${levelSlots.length}" style="border: 1.5px solid #000000; padding: 10px; font-size: 10pt; font-weight: bold; text-align: center; vertical-align: middle; font-family: monospace;">${d.date}</td>` : '';

        rowsHtml += `
          <tr style="height: 35px;">
            ${dayTd}
            ${dateTd}
            <td style="border: 1.5px solid #000000; padding: 8px; font-size: 10pt; font-weight: bold; text-align: center; vertical-align: middle; background-color: ${bgCol}; color: ${textCol}; white-space: nowrap;">${periodText}</td>
            <td style="border: 1.5px solid #000000; padding: 8px 14px; font-size: 10pt; font-weight: bold; text-align: center; vertical-align: middle; background-color: ${bgCol}; color: ${textCol}; font-family: 'Courier New', monospace; white-space: nowrap; mso-number-format:'\\@';">${ts.timeRange}</td>
            ${streamCellsHtml}
          </tr>
        `;
      });
    });

    const rightSpan = Math.max(2, Math.floor(totalCols / 2));
    const leftSpan = totalCols - rightSpan;

    const htmlExcel = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>جدول الاختبارات</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft/>
                  <x:Print>
                    <x:ValidPrinterInfo/>
                  </x:Print>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; width: 100%; direction: rtl; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; }
          th, td { text-align: center; vertical-align: middle; }
        </style>
      </head>
      <body dir="rtl">
        <table dir="rtl" border="1" style="border-collapse: collapse; width: 100%;">
          <thead>
            <!-- Column Headers Row -->
            <tr style="height: 40px; background-color: #0099FF; color: #FFFFFF;">
              <th style="background-color: #0099FF; color: #FFFFFF; border: 1.5px solid #000000; padding: 10px; font-size: 11pt; font-weight: bold; text-align: center; width: 120px;">اليوم</th>
              <th style="background-color: #0099FF; color: #FFFFFF; border: 1.5px solid #000000; padding: 10px; font-size: 11pt; font-weight: bold; text-align: center; width: 130px;">التاريخ</th>
              <th style="background-color: #0099FF; color: #FFFFFF; border: 1.5px solid #000000; padding: 10px; font-size: 11pt; font-weight: bold; text-align: center; width: 110px;">الفترة</th>
              <th style="background-color: #0099FF; color: #FFFFFF; border: 1.5px solid #000000; padding: 10px; font-size: 11pt; font-weight: bold; text-align: center; width: 220px; min-width: 220px; white-space: nowrap;">التوقيت</th>
              ${streamHeadersHtml}
            </tr>
          </thead>
            ${rowsHtml}
            <!-- Empty Row before signatures -->
            <tr style="height: 25px;"><td colspan="${totalCols}" style="border: none;"></td></tr>
            <!-- Official Signatures Row -->
            <tr style="height: 55px;">
              <td colspan="${rightSpan}" style="border: none; text-align: right; font-size: 12pt; font-weight: bold; padding-right: 20px;">
                تأشيرة وتوقيع مدير المؤسسة
              </td>
              <td colspan="${leftSpan}" style="border: none; text-align: left; font-size: 12pt; font-weight: bold; padding-left: 20px;">
                تأشيرة وتوقيع الناظر
              </td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Download as formatted Excel spreadsheet file (.xls)
    const blob = new Blob(['\ufeff' + htmlExcel], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `جدول_اختبارات_المستوى_${activeLevelLabel}_${weekStartDate}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('تم تصدير الجدول بصيغة Excel منسقة بالألوان والدمج والختم بنجاح!');
  };

  // Auto Populate Standard Curriculum Timetable (respecting current start date & per-level timings)
  const handleAutoPopulateStandard = async () => {
    toast.loading('جاري تعبئة وكتابة الرزنامة الموحدة على الجدول...', { id: 'auto-pop' });
    try {
      await api.post('/api/exams/reset-standard', {});
      const latestSettings = sysSettings || (await api.get('/api/settings').catch(() => null)) || { examStartDate: weekStartDate };
      await syncExamsAndScheduleWithSettings(latestSettings, { syncDatesFromStart: true });
      const savedDays = localStorage.getItem('hirasa_days_schedule');
      if (savedDays) {
        try {
          const parsed = JSON.parse(savedDays);
          if (Array.isArray(parsed) && parsed.length > 0) setDays(parsed);
        } catch {}
      }
      toast.success('تم تدوين وكتابة الرزنامة الموحدة ومواءمة التوقيت والتاريخ بنجاح!', { id: 'auto-pop' });
      fetchExams();
    } catch (e) {
      toast.error('خطأ أثناء تعبئة الجدول', { id: 'auto-pop' });
    }
  };

  // Excel Upload Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (buffer) {
        setFileBuffer(buffer);
        setIsImportModalOpen(true);
      } else {
        toast.error('تعذر قراءة ملف الإكسل');
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async (mappedData: any[]) => {
    setIsImportModalOpen(false);
    toast.loading('جاري استيراد وتدوين الاختبارات على الجدول...', { id: 'import' });
    try {
      const validExams = mappedData
        .filter(row => row.subject && String(row.subject).trim() !== '')
        .map(row => {
          let parsedDate = row.date;
          if (typeof parsedDate === 'number') {
            const dateObj = new Date((parsedDate - (25567 + 2)) * 86400 * 1000);
            parsedDate = dateObj.toISOString().split('T')[0];
          }
          const levelStr = String(row.targetLevel || row.level || '').toLowerCase();
          const targetLevel = (levelStr.includes('ثالثة') || levelStr.includes('3') || levelStr.includes('third')) ? 'third' : 'first_second';

          return {
            id: Date.now().toString() + Math.random().toString().slice(2, 8),
            subject: String(row.subject).trim(),
            date: String(parsedDate || weekStartDate),
            period: (row.period === 'مسائي' || row.period === 'afternoon') ? 'afternoon' : 'morning',
            duration: Number(row.duration) || 2,
            hallCount: Number(row.hallCount) || 1,
            proctorsPerHall: Number(row.proctorsPerHall) || 2,
            targetLevel
          };
        });

      if (validExams.length > 0) {
        await api.post('/api/exams/bulk', { exams: validExams });
        toast.success(`تم استيراد ${validExams.length} اختبار وكتابتها على الجدول بنجاح!`, { id: 'import' });
        fetchExams();
      } else {
        toast.error('لم يتم العثور على اختبارات صالحة للاستيراد', { id: 'import' });
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء الاستيراد', { id: 'import' });
    }
  };

  // Direct print trigger using isolated iframe for immediate, reliable printing
  const handleDirectPrint = () => {
    let previewEl = document.getElementById('live-print-preview') || document.getElementById('printable-area');
    if (!previewEl) {
      setIsPrintModalOpen(true);
      setTimeout(() => {
        handleDirectPrint();
      }, 300);
      return;
    }

    const printCards = previewEl.querySelectorAll('.print-card');
    let content = '';
    if (printCards.length > 0) {
      printCards.forEach((card, idx) => {
        content += `<div class="print-card ${idx < printCards.length - 1 ? 'print-page-break' : ''}">${card.innerHTML}</div>`;
      });
    } else {
      content = previewEl.innerHTML;
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>جدول سير الاختبارات - ${institutionName}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 0.4cm 0.5cm;
          }
          * { 
            box-sizing: border-box; 
            letter-spacing: normal !important; 
            word-spacing: normal !important; 
          }
          html, body {
            font-family: 'Cairo', system-ui, -apple-system, 'Segoe UI', Roboto, Tahoma, Geneva, sans-serif !important;
            direction: rtl !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            letter-spacing: normal !important;
            word-spacing: normal !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            direction: rtl !important;
          }
          th, td {
            border: 1.5px solid #000000 !important;
            color: #000000 !important;
            text-align: center !important;
            vertical-align: middle !important;
            letter-spacing: normal !important;
            word-spacing: normal !important;
          }
          th {
            background-color: #0099FF !important;
            color: #ffffff !important;
            padding: 10px 8px !important;
            font-size: 12px !important;
            line-height: 1.5 !important;
            font-weight: 800 !important;
          }
          td {
            padding: 10px 8px !important;
            font-size: 12px !important;
            line-height: 1.6 !important;
            font-weight: 700 !important;
          }
          .header-banner-box {
            display: inline-block !important;
            margin-top: 10px !important;
            margin-bottom: 6px !important;
            padding: 8px 24px 10px 24px !important;
            border-radius: 10px !important;
            background-color: #0099FF !important;
            color: #ffffff !important;
            font-weight: 900 !important;
            font-size: 13px !important;
            line-height: 1.6 !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
          }
          .header-text-line {
            display: block !important;
            width: 100% !important;
            margin-bottom: 4px !important;
            line-height: 1.5 !important;
            text-align: center !important;
          }
          .print-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .print-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
        </style>
      </head>
      <body>
        <div style="padding: 0.2cm;">
          ${content}
        </div>
      </body>
      </html>
    `;

    printHtmlDirectly(fullHtml);
    toast.success('تم فتح نافذة الطباعة بنجاح!');
  };

  // Export printable document directly to PDF file using html2pdf from visible preview
  const handleExportPDF = () => {
    const previewEl = document.getElementById('live-print-preview');
    if (!previewEl) {
      toast.error('تعذر إيجاد وثيقة الطباعة');
      return;
    }

    const cardEl = previewEl.querySelector('.print-card') as HTMLElement || previewEl;

    toast.loading('جاري توليد ملف PDF عالي الجودة...', { id: 'pdf-gen' });

    const opt = {
      margin: [0.15, 0.15, 0.25, 0.15] as [number, number, number, number],
      filename: `جدول_اختبارات_${activeLevelLabel}_${weekStartDate}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollY: 0,
        scrollX: 0,
        onclone: (clonedDoc: Document) => {
          sanitizeOklchInClonedDoc(clonedDoc);
          if (clonedDoc.documentElement) clonedDoc.documentElement.style.backgroundColor = '#ffffff';
          if (clonedDoc.body) {
            clonedDoc.body.style.backgroundColor = '#ffffff';
            clonedDoc.body.style.margin = '0';
            clonedDoc.body.style.padding = '0';
          }
          const clonedPreview = clonedDoc.getElementById('live-print-preview');
          if (clonedPreview) {
            clonedPreview.style.backgroundColor = '#ffffff';
            clonedPreview.style.padding = '0';
            clonedPreview.style.margin = '0';
          }
        }
      },
      jsPDF: { unit: 'in' as const, format: 'a4' as const, orientation: 'landscape' as const }
    };

    html2pdf().set(opt).from(cardEl).save().then(() => {
      toast.success('تم تنزيل ملف PDF بنجاح!', { id: 'pdf-gen' });
    }).catch((err: any) => {
      console.error(err);
      toast.success('جاري فتح نافذة طباعة وحفظ PDF للمتصفح...', { id: 'pdf-gen' });
      handleDirectPrint();
    });
  };

  // Helper to check if a subject is ACTUALLY scheduled in any visible cell on the active matrix grid
  const isSubjectScheduledInActiveGrid = (subjectName: string, streamName: string) => {
    if (!subjectName || !streamName) return false;
    const normSub = subjectName.trim().toLowerCase();

    return days.some(day => {
      return getDayTimeSlotsForLevel(day, activeLevel).some(slot => {
        const exam = getExamForCellInLevel(day.date, slot.timeRange, streamName, activeLevel);
        return exam && exam.subject && exam.subject.trim().toLowerCase() === normSub;
      });
    });
  };

  // Compute assigned and available subjects for active editing cell
  const activeStreamSubjects = editingCell ? getSubjectsForStream(editingCell.stream) : SECONDARY_SUBJECTS;
  
  const assignedSubjectsForActiveStream = editingCell
    ? activeStreamSubjects.filter(sub => isSubjectScheduledInActiveGrid(sub, editingCell.stream))
    : [];

  const availableSubjectsForCell = activeStreamSubjects.filter(s => 
    !assignedSubjectsForActiveStream.includes(s) || s === editingCell?.currentSubject
  );

  const usedSubjectsForCell = activeStreamSubjects.filter(s => 
    assignedSubjectsForActiveStream.includes(s) && s !== editingCell?.currentSubject
  );

  return (
    <div className="space-y-6 text-slate-100">
      
      {/* Top Header Controls Bar matching Screenshot 2026-11-03_152445 */}
      <div className="bg-[#091021] border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shadow-2xl">
        
        {/* Right side: Title & Level Badge + Start Date */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0099FF]/20 border border-sky-500/40 text-sky-300 px-4 py-2 rounded-2xl shadow-inner">
            <GraduationCap size={22} className="text-[#0099FF]" />
            <span className="font-black text-sm sm:text-base text-white">
              جدول الاختبارات - المستوى: <span className="text-cyan-400 font-black">{activeLevelLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 bg-[#121E36] border border-slate-700/80 px-3 py-1.5 rounded-xl">
            <CalendarIcon size={16} className="text-cyan-400" />
            <input
              type="date"
              value={weekStartDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="bg-transparent text-white text-xs font-mono font-bold outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Left side: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsClearModalOpen(true)}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95"
            title="مسح كل الجدول أو جدول المستوى الحالي"
          >
            <Trash2 size={15} />
            مسح كل الجدول
          </button>

          <label className="flex items-center gap-1.5 border border-cyan-400/60 text-cyan-300 hover:bg-cyan-400/10 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer">
            <Upload size={15} />
            استيراد Excel
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            تصدير Excel
          </button>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#0099FF] hover:bg-sky-500 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer"
          >
            <Printer size={15} />
            معاينة وطباعة الرزنامة
          </button>
        </div>

      </div>

      {/* View Switcher Toolbar: Level Tabs (أولى | ثانية | ثالثة) & Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-[#0D162A] p-4 rounded-2xl border border-slate-800 shadow-xl">
        
        {/* Level Tabs */}
        <div className="flex items-center gap-2 bg-[#121E36] p-1.5 rounded-xl border border-slate-800">
          <span className="text-xs font-bold text-slate-400 px-2">اختر المستوى:</span>
          <button
            onClick={() => setActiveLevel('first')}
            className={`px-4 py-2 rounded-lg font-black text-xs transition-all cursor-pointer ${
              activeLevel === 'first' ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            السنة الأولى (1 ثا)
          </button>
          <button
            onClick={() => setActiveLevel('second')}
            className={`px-4 py-2 rounded-lg font-black text-xs transition-all cursor-pointer ${
              activeLevel === 'second' ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            السنة الثانية (2 ثا)
          </button>
          <button
            onClick={() => setActiveLevel('third')}
            className={`px-4 py-2 rounded-lg font-black text-xs transition-all cursor-pointer ${
              activeLevel === 'third' ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            السنة الثالثة (3 ثا)
          </button>
        </div>

        {/* Add Subject & Auto Populate Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoPopulateStandard}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-sm"
            title="تعبئة وتدوين جدول الحراسة الموحد تلقائياً حسب الرزنامة الرسمية"
          >
            <Sparkles size={15} />
            توليد مقترح جدول موحد
          </button>

          <button
            onClick={() => setIsAddExamModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer"
          >
            <Plus size={16} />
            إضافة مادة للجدول
          </button>

          <button
            onClick={() => setIsSubjectModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#0099FF] hover:bg-sky-500 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer"
          >
            <BookOpen size={15} />
            إدارة المواد
          </button>
        </div>

      </div>

      {/* Synced Level Timings Strip from SettingsPage */}
      {(() => {
        const activeLvlCfg = getLevelConfigFromSettings(sysSettings, activeLevel);
        const activeSlots = getScheduleTimeSlotsForLevel(sysSettings, activeLevel);
        return (
          <div className="bg-[#0D162A]/90 border border-cyan-500/25 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Clock size={15} className="text-cyan-400 shrink-0" />
              <span className="font-black text-slate-200">
                توقيت اختبارات ({activeLevelLabel}):
              </span>
              {activeSlots.map((slotStr, idx) => (
                <span
                  key={`${activeLevel}-${idx}`}
                  dir="ltr"
                  className="font-mono font-black px-2.5 py-0.5 rounded-lg bg-[#121E36] border border-cyan-500/30 text-cyan-300"
                >
                  {slotStr}
                </span>
              ))}
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
              sysSettings?.separateLevelTimings
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-[#121E36] text-slate-400 border-slate-700'
            }`}>
              {sysSettings?.separateLevelTimings
                ? `توقيت منفصل للمستويات (صباح: ${activeLvlCfg.morningTime})`
                : 'توقيت موحد من معلومات المؤسسة'}
            </span>
          </div>
        );
      })()}

      {/* HIRASA PRO TIMETABLE MATRIX TABLE (الجدول الموحد للشعب) */}
      <div className="bg-[#091021] border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl overflow-x-auto custom-scrollbar">
        
        <table className="w-full text-center border-collapse min-w-[1000px]">
          
          {/* Column Headers */}
          <thead>
            <tr className="border-b border-slate-800 text-xs">
              
              {/* Column 1: Date / Day */}
              <th className="p-3 bg-[#0D162A] text-slate-300 font-black border-l border-slate-800 w-36 rounded-tr-2xl">
                <div className="flex items-center justify-between gap-1">
                  <span>التاريخ / الأيام</span>
                  <button
                    onClick={handleAddDay}
                    className="flex items-center gap-1 bg-[#0099FF] hover:bg-sky-500 text-white text-[10px] font-black px-2 py-1 rounded-lg cursor-pointer transition-colors shadow-sm"
                    title="إضافة يوم جديد"
                  >
                    <Plus size={12} />
                    + يوم
                  </button>
                </div>
              </th>

              {/* Column 2: Time Range / Hours */}
              <th className="p-3 bg-[#0D162A] text-slate-300 font-black border-l border-slate-800 w-36">
                التوقيت / الساعات
              </th>

              {/* Stream Columns Header */}
              {streamsForActiveLevel.map((st, idx) => (
                <th key={st.id} className={`p-3 bg-[#121E36] text-white font-black border-l border-slate-800 relative group ${idx === streamsForActiveLevel.length - 1 ? 'rounded-tl-2xl' : ''}`}>
                  <div className="flex flex-col items-center gap-1.5">
                    
                    {/* Header Controls: Reorder arrows & Add Column */}
                    <div className="flex items-center justify-between w-full text-[10px] text-slate-400 px-1">
                      <div className="flex items-center gap-1">
                        {idx > 0 && (
                          <button
                            onClick={() => handleMoveStream(idx, 'left')}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-cyan-600 text-white rounded transition-colors cursor-pointer font-mono"
                            title="نقل للشمال"
                          >
                            &lt;
                          </button>
                        )}
                        {idx < streamsForActiveLevel.length - 1 && (
                          <button
                            onClick={() => handleMoveStream(idx, 'right')}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-cyan-600 text-white rounded transition-colors cursor-pointer font-mono"
                            title="نقل لليمين"
                          >
                            &gt;
                          </button>
                        )}
                      </div>

                      {idx === 0 && (
                        <button
                          onClick={handleAddStreamColumn}
                          className="bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 px-2 py-0.5 rounded font-black text-[10px] cursor-pointer transition-colors"
                        >
                          + قسم
                        </button>
                      )}
                    </div>

                    <div className="w-8 h-8 rounded-full bg-[#0099FF]/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                      <BookOpen size={16} />
                    </div>
                    
                    <span className="text-xs font-extrabold text-white text-center">{st.name}</span>

                    {/* Action icons: Edit stream name & Delete stream */}
                    <div className="flex items-center justify-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity mt-1">
                      <button
                        onClick={() => handleEditStreamName(st.id, st.name)}
                        className="p-1 text-slate-400 hover:text-cyan-300 rounded hover:bg-slate-800 cursor-pointer"
                        title="تعديل اسم الشعبة"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteStream(st.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer"
                        title="حذف الشعبة من الجدول"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                  </div>
                </th>
              ))}

            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-800/80 text-xs">
            {days.map((day) => {
              const levelSlots = getDayTimeSlotsForLevel(day, activeLevel);
              const rowSpan = levelSlots.length;

              return levelSlots.map((timeSlot, tsIdx) => {
                const isMorning = isMorningTimeRange(timeSlot.timeRange);
                const periodVal: 'morning' | 'afternoon' = isMorning ? 'morning' : 'afternoon';

                return (
                  <tr key={`${day.date}-${timeSlot.id}`} className="hover:bg-[#0D162A]/50 transition-colors">
                    
                    {/* Date Cell (rendered only on first timeSlot row) */}
                    {tsIdx === 0 && (
                      <td
                        rowSpan={rowSpan}
                        className="p-3 bg-[#0D162A] border-l border-slate-800 font-bold text-center align-middle"
                      >
                        <div className="text-sm font-black text-white mb-1">{day.dayName}</div>
                        <input
                          type="date"
                          value={day.date}
                          onChange={(e) => handleEditDayDate(day.date, e.target.value)}
                          className="text-[11px] font-mono text-cyan-300 bg-[#121E36] hover:bg-[#182643] px-2 py-0.5 rounded-lg border border-slate-700/80 hover:border-cyan-400 font-bold outline-none cursor-pointer text-center transition-colors"
                          title="تعديل تاريخ هذا اليوم"
                        />

                        <div className="mt-2.5 flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleAddTimeSlot(day.date)}
                            className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            title="إضافة توقيت جديد لليوم"
                          >
                            + توقيت
                          </button>

                          <button
                            onClick={() => handleDeleteDay(day.date)}
                            className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="حذف هذا اليوم بالكامل"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}

                    {/* Time Slot Cell matching Screenshot */}
                    <td className="p-3 bg-[#0D162A]/80 border-l border-slate-800 font-mono font-bold text-cyan-300 text-xs text-center align-middle">
                      <div className="flex flex-col items-center justify-center gap-1.5 bg-[#121E36] p-2.5 rounded-xl border border-slate-800">
                        
                        <div className="flex items-center gap-1 text-cyan-300 font-bold">
                          <Clock size={13} className="text-cyan-400 shrink-0" />
                          <span>{timeSlot.timeRange}</span>
                        </div>

                        {/* Action Buttons matching Screenshot: Edit Time Slot & Delete Time Slot */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60 w-full justify-center">
                          <button
                            onClick={() => handleOpenEditTimeSlot(day.date, timeSlot.id, timeSlot.timeRange)}
                            className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="تعديل التوقيت"
                          >
                            <Edit2 size={12} />
                          </button>

                          <button
                            onClick={() => handleDeleteTimeSlot(day.date, timeSlot.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="حذف هذا التوقيت"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                      </div>
                    </td>

                    {/* Stream Cells (Subject Card written directly inside the Cell Box) */}
                    {streamsForActiveLevel.map((st) => {
                      const examCell = getExamForCell(day.date, timeSlot.timeRange, st.name);

                      return (
                        <td
                          key={`${day.date}-${timeSlot.id}-${st.id}`}
                          className="p-2 border-l border-slate-800/80 align-middle"
                        >
                          {examCell ? (
                            <div
                              onClick={() => {
                                setEditingCell({
                                  date: day.date,
                                  period: periodVal,
                                  timeRange: timeSlot.timeRange,
                                  stream: st.name,
                                  currentSubject: examCell.subject
                                });
                                setCustomSubjectInput(examCell.subject);
                              }}
                              className="bg-[#121E36] hover:bg-[#182643] border border-cyan-400 p-3.5 rounded-2xl text-center cursor-pointer transition-all shadow-xl group relative border-2"
                            >
                              {/* Subject Name Written Directly in the Cell Box */}
                              <div className="flex items-center justify-center gap-1.5 text-white font-black text-sm mb-1">
                                <BookOpen size={16} className="text-cyan-400 shrink-0" />
                                <span>{examCell.subject}</span>
                              </div>
                              
                              <div className="flex items-center justify-center gap-1 text-[10px] text-cyan-300 font-bold">
                                <CheckCircle2 size={12} className="text-cyan-400" />
                                <span>مدونة في الخانة</span>
                              </div>

                              {/* Hover Edit & Delete Controls */}
                              <div className="absolute top-1.5 left-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCell({
                                      date: day.date,
                                      period: periodVal,
                                      timeRange: timeSlot.timeRange,
                                      stream: st.name,
                                      currentSubject: examCell.subject
                                    });
                                    setCustomSubjectInput(examCell.subject);
                                  }}
                                  className="p-1 bg-[#0099FF] text-white rounded-lg cursor-pointer shadow-md"
                                  title="تعديل المادة"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (examCell.id) handleRemoveExamFromCell(examCell.id);
                                  }}
                                  className="p-1 bg-rose-600 text-white rounded-lg cursor-pointer shadow-md"
                                  title="مسح المادة وإعادتها لقائمة المواد المتاحة"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingCell({
                                  date: day.date,
                                  period: periodVal,
                                  timeRange: timeSlot.timeRange,
                                  stream: st.name,
                                  currentSubject: ''
                                });
                                setCustomSubjectInput('');
                              }}
                              className="w-full py-4 px-3 rounded-2xl border border-dashed border-slate-700 hover:border-cyan-400 hover:bg-[#121E36] text-slate-400 hover:text-cyan-300 transition-all text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 bg-[#0D162A]/60 shadow-sm"
                            >
                              <Plus size={16} className="text-cyan-400" />
                              <span>+ إضافة مادة</span>
                            </button>
                          )}
                        </td>
                      );
                    })}

                  </tr>
                );
              });
            })}
          </tbody>

        </table>

      </div>

      {/* Cell Editing Subject Modal (Matching Image 1: c6817167.png) */}
      {editingCell && (() => {
        // Filter out subjects already scheduled in the active grid for this stream (unless it's currently in this editing cell)
        const availableSubjectsToDisplay = activeStreamSubjects.filter(sub => {
          const isScheduled = isSubjectScheduledInActiveGrid(sub, editingCell.stream);
          const isCurrentCellSub = sub.trim().toLowerCase() === editingCell.currentSubject.trim().toLowerCase();
          return !isScheduled || isCurrentCellSub;
        });

        const scheduledCount = activeStreamSubjects.length - availableSubjectsToDisplay.length + (editingCell.currentSubject ? 1 : 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md">
            <div className="bg-[#091021] border border-cyan-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100 flex flex-col max-h-[85vh]">
              
              {/* Header Bar matching Screenshot c6817167.png */}
              <div className="bg-[#0099FF] p-4 flex items-center justify-between text-white shadow-lg shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0">
                    <GraduationCap size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black leading-tight">اختر المادة</h3>
                    <p className="text-xs font-bold text-sky-100 opacity-90 mt-0.5">
                      {activeLevelLabel} • {editingCell.stream}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingCell(null)}
                  className="w-9 h-9 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 flex items-center justify-center transition-all cursor-pointer text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Sub-header counter matching Screenshot c6817167.png */}
              <div className="bg-[#0D162A] px-4 py-3 border-b border-slate-800 text-xs font-bold text-slate-300 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <AlertCircle size={15} className="text-cyan-400 shrink-0" />
                  <span>
                    المواد المتبقية: <strong className="text-cyan-400">{availableSubjectsToDisplay.length}</strong> من أصل <strong className="text-white">{activeStreamSubjects.length}</strong> {scheduledCount > 0 && <span className="text-slate-400 font-normal">({scheduledCount} مادة مجدولة)</span>}
                  </span>
                </div>
              </div>

              {/* Single Column Vertical Subject Card List matching Screenshot c6817167.png */}
              <div className="p-4 space-y-2.5 overflow-y-auto custom-scrollbar bg-[#091021] flex-1">
                {availableSubjectsToDisplay.length > 0 ? (
                  availableSubjectsToDisplay.map((sub) => {
                    const isCurrentCellSubject = sub.trim().toLowerCase() === editingCell.currentSubject.trim().toLowerCase();

                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setCustomSubjectInput(sub);
                          handleAssignSubjectToCell(sub);
                        }}
                        className={`w-full p-4 rounded-2xl transition-all cursor-pointer shadow-lg flex items-center justify-between group ${
                          isCurrentCellSubject
                            ? 'bg-[#0099FF] text-white border-2 border-white ring-2 ring-cyan-400/50'
                            : 'bg-[#121E36] text-white hover:bg-[#0099FF] border border-slate-800 hover:border-cyan-300'
                        }`}
                      >
                        <span className="text-sm font-extrabold group-hover:text-white">
                          {sub}
                        </span>

                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isCurrentCellSubject
                            ? 'bg-white/20 text-white'
                            : 'bg-[#182643] group-hover:bg-white/20 text-cyan-400 group-hover:text-white border border-slate-700/60'
                        }`}>
                          <BookOpen size={18} />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs font-bold space-y-2">
                    <CheckCircle2 size={32} className="mx-auto text-cyan-400" />
                    <p>جميع مواد هذه الشعبة مبرمجة على الجدول!</p>
                  </div>
                )}

                {/* Custom Subject Name Input Option */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <label className="block text-xs font-bold text-slate-300">أو اكتب اسم مادة مخصصة:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customSubjectInput}
                      onChange={(e) => setCustomSubjectInput(e.target.value)}
                      placeholder="مثال: العلوم الفيزيائية، الرياضيات..."
                      className="flex-1 p-3 bg-[#121E36] border border-slate-700 rounded-xl text-white font-bold text-xs outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleAssignSubjectToCell(customSubjectInput.trim())}
                      disabled={!customSubjectInput.trim()}
                      className="bg-[#0099FF] hover:bg-sky-500 text-white font-black px-4 py-3 rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-40"
                    >
                      حفظ وتدوين
                    </button>
                  </div>
                </div>

                {/* Option to apply to all streams in level */}
                <label className="flex items-center gap-2 p-3 bg-[#121E36] rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAllStreamsInLevel}
                    onChange={(e) => setApplyToAllStreamsInLevel(e.target.checked)}
                    className="w-4 h-4 text-sky-500 rounded border-slate-700"
                  />
                  <span className="text-xs font-bold text-slate-200">
                    تدوين المادة لجميع شعب مستوى ({activeLevelLabel}) في هذا التوقيت
                  </span>
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="p-3 bg-[#0D162A] border-t border-slate-800 flex justify-between items-center shrink-0">
                {editingCell.currentSubject ? (
                  <button
                    type="button"
                    onClick={() => handleAssignSubjectToCell('')}
                    className="bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/60 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    مسح المادة من الخلية
                  </button>
                ) : (
                  <div></div>
                )}
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Time Slot Editing Modal */}
      {editingTimeSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0D162A] border border-cyan-500/40 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl text-slate-100">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <Clock size={20} />
                <h3 className="text-lg font-black text-white">تعديل التوقيت / الساعات</h3>
              </div>
              <button
                onClick={() => setEditingTimeSlot(null)}
                className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                أدخل أو اختر التوقيت الجديد (مثال: 08:00 - 10:00 أو 10:15 - 12:15):
              </label>
              <input
                type="text"
                value={newTimeRangeInput}
                onChange={(e) => setNewTimeRangeInput(e.target.value)}
                placeholder="مثال: 08:00 - 10:00"
                className="w-full p-3 bg-[#121E36] border border-slate-700/80 rounded-xl text-white font-mono font-bold text-xs outline-none focus:border-cyan-400"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-bold block w-full mb-1">توقيتات جاهزة للمناظرات والامتحانات:</span>
                {['08:00 - 10:00', '10:00 - 12:00', '10:15 - 12:15', '13:30 - 15:30', '15:30 - 17:30', '15:30 - 16:30'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewTimeRangeInput(preset)}
                    className="px-2.5 py-1 bg-[#121E36] hover:bg-[#0099FF] text-slate-200 hover:text-white border border-slate-700/80 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingTimeSlot(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveTimeSlot}
                className="bg-[#0099FF] hover:bg-sky-500 text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-lg transition-all cursor-pointer"
              >
                حفظ التوقيت
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Direct Add Exam / Subject Modal */}
      {isAddExamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0D162A] border border-cyan-500/40 rounded-3xl w-full max-w-xl p-6 space-y-5 shadow-2xl text-slate-100">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#0099FF]/20 text-[#0099FF]">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">إضافة مادة وتدونيها في الخانة</h3>
                  <p className="text-xs text-slate-400 mt-0.5">قم بإدخال تفاصيل المادة لكتابتها مباشرة على الرزنامة</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddExamModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateExamFormSubmit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المادة *</label>
                <input
                  name="subject"
                  list="examSubjectsList"
                  required
                  placeholder="اختر أو اكتب اسم المادة (مثال: علوم الطبيعة والحياة)"
                  className="w-full p-3 bg-[#121E36] border border-slate-700/80 rounded-xl text-white font-bold text-xs outline-none focus:border-cyan-400"
                />
                <datalist id="examSubjectsList">
                  {SECONDARY_SUBJECTS.map(sub => <option key={sub} value={sub} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المستوى التعليمي</label>
                  <select
                    name="targetLevel"
                    defaultValue={activeLevel}
                    className="w-full p-3 bg-[#121E36] border border-slate-700/80 rounded-xl text-white font-bold text-xs outline-none focus:border-cyan-400"
                  >
                    <option value="first">السنة الأولى ثانوي (1 ثا)</option>
                    <option value="second">السنة الثانية ثانوي (2 ثا)</option>
                    <option value="first_second">السنوات الأولى والثانية (1 و 2 ثا)</option>
                    <option value="third">
                      {(selectedTerm.includes('الثالث') || selectedTerm.includes('3'))
                        ? 'السنة الثالثة (امتحان البكالوريا التجريبي)'
                        : `السنة الثالثة ثانوي (اختبارات ${selectedTerm})`}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الشعبة / التخصص</label>
                  <select
                    name="stream"
                    className="w-full p-3 bg-[#121E36] border border-slate-700/80 rounded-xl text-white font-bold text-xs outline-none focus:border-cyan-400"
                  >
                    <option value="جميع الشعب والجذوع المشتركة">جميع الشعب والجذوع المشتركة</option>
                    {streamsForActiveLevel.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">التاريخ *</label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={weekStartDate}
                    required
                    className="w-full p-3 bg-[#121E36] border border-slate-700/80 rounded-xl text-white font-mono font-bold text-xs outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الفترة</label>
                  {(() => {
                    const modalCfg = getLevelConfigFromSettings(sysSettings, activeLevel);
                    return (
                      <select
                        name="period"
                        className="w-full p-3 bg-[#121E36] border border-slate-700/80 rounded-xl text-white font-bold text-xs outline-none focus:border-cyan-400"
                      >
                        <option value="morning">صباحي ({modalCfg.morningSlot1 || modalCfg.morningTime})</option>
                        <option value="afternoon">مسائي ({modalCfg.afternoonSlot || modalCfg.afternoonTime})</option>
                      </select>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">المدة (ساعة)</label>
                  <input type="number" step="0.5" name="duration" defaultValue={2} required className="w-full p-2.5 bg-[#121E36] border border-slate-700/80 rounded-xl text-white font-bold text-xs text-center outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">عدد القاعات</label>
                  <input type="number" name="hallCount" defaultValue={1} required className="w-full p-2.5 bg-[#121E36] border border-slate-700/80 rounded-xl text-white font-bold text-xs text-center outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">حراس القاعة</label>
                  <input type="number" name="proctorsPerHall" defaultValue={2} required className="w-full p-2.5 bg-[#121E36] border border-slate-700/80 rounded-xl text-white font-bold text-xs text-center outline-none focus:border-cyan-400" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddExamModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-[#0099FF] hover:bg-sky-500 text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-lg shadow-sky-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={16} />
                  كتابة وتدوين في الخانة
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Subject Management Modal Component */}
      <SubjectManagementModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
      />

      {/* Excel Import Modal */}
      <ExcelImportModal 
        isOpen={isImportModalOpen}
        onClose={() => { setIsImportModalOpen(false); setFileBuffer(null); }}
        fileBuffer={fileBuffer}
        title="استيراد الاختبارات"
        expectedColumns={[
          { key: 'subject', label: 'المادة', required: true, aliases: ['المادة', 'مادة', 'subject'] },
          { key: 'date', label: 'التاريخ', aliases: ['التاريخ', 'تاريخ', 'date'] },
          { key: 'period', label: 'الفترة', aliases: ['الفترة', 'التوقيت', 'period'] },
          { key: 'duration', label: 'المدة (ساعة)', aliases: ['المدة', 'الساعات', 'duration'] },
          { key: 'hallCount', label: 'عدد القاعات', aliases: ['عدد القاعات', 'القاعات', 'halls'] },
          { key: 'proctorsPerHall', label: 'حراس القاعة', aliases: ['عدد الحراس', 'حراس القاعة', 'proctors'] }
        ]}
        onConfirm={handleConfirmImport}
      />

      {/* Screen Page Footer */}
      <div className="text-center text-xs text-slate-400 font-mono pt-4 pb-2 print:hidden">
        created by <span className="text-cyan-400 font-bold">prof belhia yacine</span>
      </div>

      {/* PRINT PREVIEW MODAL */}
      {isPrintModalOpen && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99990] flex items-center justify-center p-2 sm:p-5 pt-[max(0.75rem,env(safe-area-inset-top))] bg-black/85 backdrop-blur-md print:hidden">
          <div className="bg-[#091021] border border-cyan-500/50 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-slate-100">
            
            {/* Modal Header */}
            <div className="p-3 sm:p-4 bg-[#0099FF] flex flex-wrap items-center justify-between gap-3 text-white shadow-lg shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="w-10 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 border border-white/25 text-white flex items-center justify-center shadow-lg shadow-rose-900/30 transition-all cursor-pointer active:scale-95 shrink-0"
                  title="خروج من الطباعة والعودة إلى التطبيق"
                  aria-label="خروج من الطباعة والعودة إلى التطبيق"
                >
                  <X size={20} />
                </button>
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0">
                  <Printer size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black leading-tight">معاينة وطباعة جدول سير الاختبارات</h3>
                  <p className="text-xs font-bold text-sky-100 opacity-90 mt-0.5">
                    الرزنامة الرسمية للجمهورية الجزائرية الديمقراطية الشعبية - وزارة التربية الوطنية
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 py-2 rounded-xl text-xs shadow-lg transition-all cursor-pointer"
                >
                  <FileText size={16} />
                  <span>تصدير PDF</span>
                </button>

                <button
                  onClick={handleDirectPrint}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs shadow-lg transition-all cursor-pointer"
                >
                  <Printer size={16} />
                  <span>طباعة الآن (Print)</span>
                </button>

                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-2 rounded-xl text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
                  title="خروج وإغلاق نافذة الطباعة"
                >
                  <X size={18} />
                  <span>خروج والعودة للتطبيق</span>
                </button>
              </div>
            </div>

            {/* Print Settings Toolbar */}
            <div className="p-4 bg-[#0D162A] border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-400">نطاق الطباعة:</span>
                <div className="flex items-center bg-[#121E36] p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setPrintScope('current')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                      printScope === 'current' ? 'bg-[#0099FF] text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    المستوى الحالي ({activeLevelLabel})
                  </button>
                  <button
                    onClick={() => setPrintScope('all')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                      printScope === 'all' ? 'bg-[#0099FF] text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    جميع المستويات (1ثا + 2ثا + 3ثا)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-[#121E36] px-3.5 py-1.5 rounded-xl border border-slate-700/80 text-xs font-bold text-cyan-300">
                <span>المؤسسة: <strong className="text-white">{institutionName}</strong></span>
                <span className="text-slate-600">|</span>
                <span>الولاية: <strong className="text-white">{wilaya}</strong></span>
                <span className="text-slate-600">|</span>
                <span>الموسم: <strong className="text-white">{schoolYear}</strong></span>
                <span className="text-slate-600">|</span>
                <span className="text-amber-300 font-black">{selectedTerm}</span>
              </div>
            </div>

            {/* Live Paper Document Preview */}
            <div id="live-print-preview" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200 custom-scrollbar space-y-6">
              {printScope === 'all' ? (
                <>
                  {renderPrintableDocument('first', 'السنة الأولى ثانوي (1 ثا)', levelStreams.first)}
                  {renderPrintableDocument('second', 'السنة الثانية ثانوي (2 ثا)', levelStreams.second)}
                  {renderPrintableDocument('third', (selectedTerm.includes('الثالث') || selectedTerm.includes('3')) ? 'السنة الثالثة ثانوي (3 ثا) - امتحان البكالوريا التجريبي' : `السنة الثالثة ثانوي (3 ثا) - ${selectedTerm}`, levelStreams.third)}
                </>
              ) : (
                renderPrintableDocument(
                  activeLevel,
                  activeLevel === 'third' ? ((selectedTerm.includes('الثالث') || selectedTerm.includes('3')) ? 'السنة الثالثة ثانوي (3 ثا) - امتحان البكالوريا التجريبي' : `السنة الثالثة ثانوي (3 ثا) - ${selectedTerm}`) : activeLevel === 'second' ? `السنة الثانية ثانوي (2 ثا) - ${selectedTerm}` : `السنة الأولى ثانوي (1 ثا) - ${selectedTerm}`,
                  streamsForActiveLevel
                )
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#0D162A] border-t border-slate-800 flex justify-between items-center shrink-0">
              <span className="text-[11px] font-mono text-slate-400">
                نظام إدارة الاختبارات والحراسة - Hirasa Pro
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                >
                  <X size={15} />
                  <span>خروج من الطباعة</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <FileText size={15} />
                  تصدير PDF
                </button>
                <button
                  onClick={handleDirectPrint}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Printer size={15} />
                  طباعة الوثيقة
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* PRINT-ONLY DOCUMENT RENDERED WHEN USER CALLS NATIVE PRINT */}
      <div id="printable-area" className="hidden print:block font-sans text-black w-full" dir="rtl">
        {printScope === 'all' ? (
          <>
            <div className="print-card mb-8">
              {renderPrintableDocument('first', 'السنة الأولى ثانوي (1 ثا)', levelStreams.first)}
            </div>
            <div className="print-page-break print-card mb-8">
              {renderPrintableDocument('second', 'السنة الثانية ثانوي (2 ثا)', levelStreams.second)}
            </div>
            <div className="print-page-break print-card">
              {renderPrintableDocument('third', (selectedTerm.includes('الثالث') || selectedTerm.includes('3')) ? 'السنة الثالثة ثانوي (3 ثا) - امتحان البكالوريا التجريبي' : `السنة الثالثة ثانوي (3 ثا) - ${selectedTerm}`, levelStreams.third)}
            </div>
          </>
        ) : (
          <div className="print-card">
            {renderPrintableDocument(
              activeLevel,
              activeLevel === 'third' ? ((selectedTerm.includes('الثالث') || selectedTerm.includes('3')) ? 'السنة الثالثة ثانوي (3 ثا) - امتحان البكالوريا التجريبي' : `السنة الثالثة ثانوي (3 ثا) - ${selectedTerm}`) : activeLevel === 'second' ? `السنة الثانية ثانوي (2 ثا) - ${selectedTerm}` : `السنة الأولى ثانوي (1 ثا) - ${selectedTerm}`,
              streamsForActiveLevel
            )}
          </div>
        )}
      </div>

      {/* CLEAR SCHEDULE CONFIRMATION MODAL */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md print:hidden">
          <div className="bg-[#121E36] border border-rose-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100">
            <div className="p-4 bg-rose-600/20 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm text-white">مسح جدول سير الاختبارات</h4>
                  <p className="text-xs text-rose-200 font-bold mt-0.5">اختر نطاق المسح المطلوب</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed font-medium">
                يمكنك تفريغ <strong className="text-rose-300">كل الجدول بالكامل</strong> (جميع المستويات والشعب) أو مسح مواد المستوى المعروض حالياً فقط (<strong className="text-cyan-300">{activeLevelLabel}</strong>).
              </p>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleExecuteClearMatrix('all')}
                  className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-3 rounded-2xl text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <Trash2 size={16} />
                  <span>نعم، مسح كل الجدول بالكامل (جميع المستويات)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExecuteClearMatrix('current')}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-black px-4 py-2.5 rounded-2xl text-xs transition-all cursor-pointer"
                >
                  <Trash2 size={15} />
                  <span>مسح مواد المستوى الحالي ({activeLevelLabel}) فقط</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-[#091021] border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  // Official Printable Document Template matching user screenshot
  function renderPrintableDocument(
    levelKey: 'first' | 'second' | 'third',
    levelTitle: string,
    streams: { id: string; name: string }[]
  ) {
    const levelNameText = levelKey === 'third' ? 'السنة الثالثة ثانوي' : levelKey === 'second' ? 'السنة الثانية ثانوي' : 'السنة الأولى ثانوي';
    const isTerm3 = selectedTerm.includes('الثالث') || selectedTerm.includes('3');
    const isBacTrial = levelKey === 'third' && isTerm3;
    const bannerTitleText = isBacTrial
      ? `رزنامة سير امتحان البكالوريا التجريبي — ${institutionName} — المستوى: ${levelNameText} (${selectedTerm} - ${schoolYear})`
      : `رزنامة سير الاختبارات — ${institutionName} — المستوى: ${levelNameText} (${selectedTerm} - ${schoolYear})`;

    return (
      <div 
        className="p-4 sm:p-5 font-sans w-full max-w-5xl mx-auto rounded-lg shadow-md print:border-none print:shadow-none print:p-0 print:max-w-none print:m-0 print-card" 
        style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid #e5e7eb', pageBreakInside: 'avoid', breakInside: 'avoid' }}
        dir="rtl"
      >
        {/* Algerian Flag, Header & Ministry Titles */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: '#000000', marginBottom: '16px', borderBottom: '2px solid #000000', paddingBottom: '12px', width: '100%' }}>
          
          {/* Flag SVG centered */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', textAlign: 'center', width: '100%' }}>
            <svg width="44" height="28" viewBox="0 0 900 600" style={{ border: '1px solid #d1d5db', borderRadius: '3px', margin: '0 auto', display: 'block' }}>
              <rect width="450" height="600" fill="#006233"/>
              <rect x="450" width="450" height="600" fill="#ffffff"/>
              <circle cx="450" cy="300" r="180" fill="#d21034"/>
              <circle cx="500" cy="300" r="144" fill="#ffffff"/>
              <polygon points="480,300 575,269 516,350 516,250 575,331" fill="#d21034"/>
            </svg>
          </div>

          {/* Official Republic & Ministry Header */}
          <div className="header-text-line" style={{ fontSize: '13px', fontWeight: '900', color: '#111827', margin: '0 0 4px 0', lineHeight: '1.5', textAlign: 'center', width: '100%', display: 'block', letterSpacing: 'normal', wordSpacing: 'normal' }}>
            الجمهورية الجزائرية الديمقراطية الشعبية
          </div>
          <div className="header-text-line" style={{ fontSize: '12px', fontWeight: '800', color: '#1f2937', margin: '0 0 10px 0', lineHeight: '1.5', textAlign: 'center', width: '100%', display: 'block', letterSpacing: 'normal', wordSpacing: 'normal' }}>
            وزارة التربية الوطنية — مديرية التربية لولاية {wilaya}
          </div>

          {/* Main Title Banner Badge */}
          <div style={{ marginTop: '6px', textAlign: 'center', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <div className="header-banner-box" style={{ display: 'inline-block', backgroundColor: '#0099FF', color: '#ffffff', padding: '8px 24px 10px 24px', borderRadius: '10px', fontWeight: '900', fontSize: '13px', border: '1px solid #0077DD', lineHeight: '1.6', margin: '0 auto', boxSizing: 'border-box', verticalAlign: 'middle', letterSpacing: 'normal', wordSpacing: 'normal' }}>
              {bannerTitleText}
            </div>
          </div>

        </div>

        {/* Timetable Matrix matching Screenshot */}
        <table className="w-full text-center border-collapse text-xs print-table" style={{ border: '2px solid #000000', backgroundColor: '#ffffff', color: '#000000', width: '100%', direction: 'rtl', letterSpacing: 'normal', wordSpacing: 'normal' }}>
          <thead>
            <tr style={{ backgroundColor: '#0099FF', color: '#ffffff', fontWeight: 'bold' }}>
              <th style={{ border: '1.5px solid #000000', padding: '6px 5px', fontWeight: '900', width: '90px', fontSize: '11px', lineHeight: '1.4', backgroundColor: '#0099FF', color: '#ffffff', textAlign: 'center', letterSpacing: 'normal', wordSpacing: 'normal' }}>اليوم</th>
              <th style={{ border: '1.5px solid #000000', padding: '6px 5px', fontWeight: '900', width: '95px', fontSize: '11px', lineHeight: '1.4', backgroundColor: '#0099FF', color: '#ffffff', textAlign: 'center', letterSpacing: 'normal', wordSpacing: 'normal' }}>التاريخ</th>
              <th style={{ border: '1.5px solid #000000', padding: '6px 5px', fontWeight: '900', width: '75px', fontSize: '11px', lineHeight: '1.4', backgroundColor: '#0099FF', color: '#ffffff', textAlign: 'center', letterSpacing: 'normal', wordSpacing: 'normal' }}>الفترة</th>
              <th style={{ border: '1.5px solid #000000', padding: '6px 5px', fontWeight: '900', width: '115px', fontSize: '11px', lineHeight: '1.4', backgroundColor: '#0099FF', color: '#ffffff', textAlign: 'center', letterSpacing: 'normal', wordSpacing: 'normal' }}>التوقيت</th>
              {streams.map(st => (
                <th key={st.id} style={{ border: '1.5px solid #000000', padding: '6px 5px', fontWeight: '900', fontSize: '11px', lineHeight: '1.4', backgroundColor: '#0099FF', color: '#ffffff', textAlign: 'center', letterSpacing: 'normal', wordSpacing: 'normal' }}>
                  {st.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const levelSlots = getDayTimeSlotsForLevel(day, levelKey);
              return levelSlots.map((ts, sIdx) => {
                const isMorning = isMorningTimeRange(ts.timeRange);
                const cellBg = isMorning ? '#FEF3C7' : '#E9D5FF';
                const cellColor = isMorning ? '#78350F' : '#581C87';

                return (
                  <tr key={`print-row-${day.date}-${ts.id}`} style={{ borderBottom: '1px solid #000000' }}>
                    
                    {/* Day Column (Rowspan across timeSlots) */}
                    {sIdx === 0 && (
                      <td rowSpan={levelSlots.length} style={{ border: '1.5px solid #000000', padding: '6px 5px', fontWeight: '800', fontSize: '11.5px', lineHeight: '1.4', color: '#111827', backgroundColor: '#f8fafc', verticalAlign: 'middle', textAlign: 'center', letterSpacing: 'normal', wordSpacing: 'normal' }}>
                        {day.dayName}
                      </td>
                    )}

                    {/* Date Column (Rowspan across timeSlots) */}
                    {sIdx === 0 && (
                      <td rowSpan={levelSlots.length} style={{ border: '1.5px solid #000000', padding: '6px 5px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '10.5px', lineHeight: '1.4', color: '#1f2937', backgroundColor: '#f8fafc', verticalAlign: 'middle', textAlign: 'center', letterSpacing: 'normal', wordSpacing: 'normal' }}>
                        {day.date}
                      </td>
                    )}

                    {/* Period Cell */}
                    <td style={{ border: '1.5px solid #000000', padding: '6px 5px', fontWeight: 'bold', fontSize: '10.5px', lineHeight: '1.4', verticalAlign: 'middle', textAlign: 'center', backgroundColor: cellBg, color: cellColor, letterSpacing: 'normal', wordSpacing: 'normal' }}>
                      {isMorning ? 'صباحية' : 'مسائية'}
                    </td>

                    {/* Time Slot Cell */}
                    <td style={{ border: '1.5px solid #000000', padding: '6px 5px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '10.5px', lineHeight: '1.4', verticalAlign: 'middle', textAlign: 'center', backgroundColor: cellBg, color: cellColor, letterSpacing: 'normal', wordSpacing: 'normal' }}>
                      {ts.timeRange}
                    </td>

                    {/* Stream Subject Cells */}
                    {streams.map(st => {
                      const ex = getExamForCellInLevel(day.date, ts.timeRange, st.name, levelKey);
                      return (
                        <td key={`print-cell-${st.id}-${ts.id}`} style={{ border: '1.5px solid #000000', padding: '6px 5px', verticalAlign: 'middle', textAlign: 'center', fontWeight: '800', fontSize: '11px', lineHeight: '1.4', color: '#111827', backgroundColor: '#ffffff', letterSpacing: 'normal', wordSpacing: 'normal' }}>
                          {ex ? ex.subject : '-'}
                        </td>
                      );
                    })}

                  </tr>
                );
              });
            })}
          </tbody>
        </table>

        {/* Official Signatures Section using layout-safe HTML Table (Director on Right, Censor on Left) */}
        <table style={{ width: '100%', marginTop: '12px', marginBottom: '10px', border: 'none', borderTop: '1.5px solid #000000', paddingTop: '10px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <tbody>
            <tr>
              <td style={{ border: 'none', textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#000000', width: '50%', verticalAlign: 'top', paddingRight: '12px', letterSpacing: 'normal', wordSpacing: 'normal' }}>
                تأشيرة وتوقيع مدير المؤسسة
              </td>
              <td style={{ border: 'none', textAlign: 'left', fontWeight: 'bold', fontSize: '12px', color: '#000000', width: '50%', verticalAlign: 'top', paddingLeft: '12px', letterSpacing: 'normal', wordSpacing: 'normal' }}>
                تأشيرة وتوقيع الناظر
              </td>
            </tr>
          </tbody>
        </table>

      </div>
    );
  }
}
