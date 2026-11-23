import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2pdf from 'html2pdf.js';
import { api } from '../lib/api';
import { Teacher, Exam, Hall, Assignment, SystemSettings } from '../types';
import { generateAssignments } from '../lib/allocation';
import {
  SETTINGS_CHANGE_EVENT,
  doTimeRangesOverlap,
  resolveExamEffectiveTimeRange,
  resolveProctoringPeriodHeaders
} from '../lib/timings';
import { 
  Wand2, Download, Printer, Calendar, User, DoorOpen, X, 
  Filter, Search, BookOpen, Table, LayoutGrid, AlertCircle, Scissors, Eye, CheckCircle2,
  Sliders, UserCheck, UserX, RefreshCw, FileText, CheckSquare, Layers, ShieldCheck, Sparkles, FileUp,
  Users, Trash2, Ban, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import ExcelImportModal from './ExcelImportModal';
import { 
  generateConvocationsHtml, 
  generateHallTimetableHtml, 
  generateMasterGridHtml, 
  generateDailySignSheetHtml,
  getArabicDayName,
  printHtmlDirectly,
  sanitizeOklchInClonedDoc,
  EXIT_PRINT_EVENT
} from '../utils/printHelpers';
import { isDemoTeacher } from '../lib/constants';

const normalizeTeacherList = (list: any[]): Teacher[] =>
  (list || []).map((t: any) => {
    let exceptions: string[] = [];
    if (Array.isArray(t.availabilityExceptions)) {
      exceptions = t.availabilityExceptions;
    } else if (typeof t.availabilityExceptions === 'string') {
      try {
        const parsed = JSON.parse(t.availabilityExceptions);
        exceptions = Array.isArray(parsed) ? parsed : [];
      } catch {
        exceptions = [];
      }
    }
    return {
      ...t,
      availabilityExceptions: exceptions,
      totalHours: Number(t.totalHours) || 0,
      seniority: Number(t.seniority) || 0,
      isExempt: Boolean(t.isExempt),
      exemptReason: t.exemptReason ? String(t.exemptReason) : ''
    };
  });

const parseExemptFromExcel = (statusVal: any, reasonVal: any): { isExempt: boolean; exemptReason: string } => {
  const statusStr = String(statusVal ?? '').trim().toLowerCase();
  const reasonStr = String(reasonVal ?? '').trim();
  const negativeValues = ['لا', 'no', 'false', '0', 'غير معفى', 'متاح', 'حاضر', 'يعمل', '-'];
  const positiveKeywords = ['معفى', 'معفي', 'غائب', 'غياب', 'حجة', 'مبرر', 'عطلة', 'مرض', 'مرضية', 'نعم', 'yes', 'true', '1', 'x', '✓', 'exempt', 'absent'];

  const hasStatusPositive =
    statusStr !== '' &&
    !negativeValues.includes(statusStr) &&
    positiveKeywords.some((kw) => statusStr.includes(kw));

  const hasValidReason = reasonStr !== '' && !negativeValues.includes(reasonStr.toLowerCase());
  const isExempt = hasStatusPositive || hasValidReason;

  return {
    isExempt,
    exemptReason: isExempt ? (reasonStr || (hasStatusPositive ? String(statusVal).trim() : 'غائب / لديه حجة')) : ''
  };
};

type GradeLevelKey = 'first' | 'second' | 'third';
type SessionTab = 'all' | 'first_second' | 'first' | 'second' | 'third';

export default function AllocationPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Active Cohort Tab
  const [activeSession, setActiveSession] = useState<SessionTab>('all');
  const [filterAssignedOnly, setFilterAssignedOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // User-Selectable Generation Scope: exam grade levels & selected teachers
  const [generationLevels, setGenerationLevels] = useState<GradeLevelKey[]>(['first', 'second', 'third']);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const knownTeacherIdsRef = useRef<Set<string>>(new Set());
  const prevExemptIdsRef = useRef<Set<string>>(new Set());
  const [showClearAssignmentsConfirm, setShowClearAssignmentsConfirm] = useState(false);
  
  // View Format in UI: 'grid' (بطاقات الأساتذة) | 'master_grid' (الجدول العام الملون) | 'halls_matrix' (جدول القاعات) | 'table' (قائمة التكليفات)
  const [viewFormat, setViewFormat] = useState<'grid' | 'master_grid' | 'halls_matrix' | 'table'>('grid');

  // Allocation Smart Rules Parameters
  const [defaultProctorsPerHall, setDefaultProctorsPerHall] = useState<number>(2);
  const [reserveProctorsPerPeriod, setReserveProctorsPerPeriod] = useState<number>(1);
  const [maxOnePerDay, setMaxOnePerDay] = useState<boolean>(true);
  const [avoidSpecialty, setAvoidSpecialty] = useState<boolean>(true);
  const [exemptOnOwnSubjectDay, setExemptOnOwnSubjectDay] = useState<boolean>(true);
  const [oneDayOff, setOneDayOff] = useState<boolean>(true);
  const [showRulesPanel, setShowRulesPanel] = useState<boolean>(false);

  // Print & synced timing settings
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [institutionName, setInstitutionName] = useState('ثانوية محمد بلخير');
  const [wilaya, setWilaya] = useState('البيض');
  const [schoolYear, setSchoolYear] = useState('2025-2026');
  const [selectedTerm, setSelectedTerm] = useState('الفصل الثالث');
  const [morningTime, setMorningTime] = useState('08:00 - 12:00');
  const [afternoonTime, setAfternoonTime] = useState('13:00 - 17:00');
  const [examStartDate, setExamStartDate] = useState('');
  const [examEndDate, setExamEndDate] = useState('');
  
  // Print Modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showLivePrintPreview, setShowLivePrintPreview] = useState(false);
  const [previewHtmlContent, setPreviewHtmlContent] = useState('');
  const [docType, setDocType] = useState<'convocations' | 'halls' | 'master' | 'daily_sign'>('convocations');
  const [selectedLevels, setSelectedLevels] = useState<string[]>(['level1', 'level2', 'level3']);
  const [customExamTitle, setCustomExamTitle] = useState('');
  const [printOnlyAssigned, setPrintOnlyAssigned] = useState(true);
  const [selectedExamForSign, setSelectedExamForSign] = useState<string>('');

  // Teacher Preview List Modal State & Dedicated Imported Teachers Section
  const [showTeacherListModal, setShowTeacherListModal] = useState(false);
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [showTeachersSection, setShowTeachersSection] = useState(false);
  const [teacherSectionFilter, setTeacherSectionFilter] = useState<'all' | 'active' | 'exempt'>('all');
  const [teacherSectionSearch, setTeacherSectionSearch] = useState('');
  const [exemptTargetTeacher, setExemptTargetTeacher] = useState<Teacher | null>(null);
  const [exemptReasonInput, setExemptReasonInput] = useState('غائب / لديه حجة');

  // Keep selectedTeacherIds synchronized cleanly whenever teachers load/change
  useEffect(() => {
    const activeIds = new Set(teachers.filter(t => t.id && !t.isExempt).map(t => String(t.id)));
    const exemptIds = new Set(teachers.filter(t => t.id && t.isExempt).map(t => String(t.id)));

    setSelectedTeacherIds(prev => {
      const next = prev.filter(id => activeIds.has(id));
      const nextSet = new Set(next);

      teachers.forEach(t => {
        if (!t.id || t.isExempt) return;
        const id = String(t.id);
        const isNewTeacher = !knownTeacherIdsRef.current.has(id);
        const wasPreviouslyExempt = prevExemptIdsRef.current.has(id);
        if ((isNewTeacher || wasPreviouslyExempt) && !nextSet.has(id)) {
          next.push(id);
          nextSet.add(id);
        }
      });

      return next;
    });

    knownTeacherIdsRef.current = new Set(teachers.filter(t => t.id).map(t => String(t.id)));
    prevExemptIdsRef.current = exemptIds;
  }, [teachers]);

  useEffect(() => {
    const handleExitPrint = () => {
      setShowLivePrintPreview(false);
      setShowPrintModal(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (showLivePrintPreview || showPrintModal)) {
        handleExitPrint();
      }
    };
    window.addEventListener(EXIT_PRINT_EVENT, handleExitPrint);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener(EXIT_PRINT_EVENT, handleExitPrint);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showLivePrintPreview, showPrintModal]);

  const handleDeleteTeacherFromAllocation = async (teacherId: string) => {
    try {
      await api.delete(`/api/teachers/${teacherId}`);
      const freshTeachers = teachers.filter(t => String(t.id) !== String(teacherId));
      setTeachers(freshTeachers);
      const remainingAssignments = assignments.filter(a => String(a.teacherId) !== String(teacherId));
      if (remainingAssignments.length !== assignments.length) {
        await api.post('/api/assignments/replace', { assignments: remainingAssignments, stats: {} });
        setAssignments(remainingAssignments);
      }
      toast.success('تم حذف الأستاذ من القائمة');
    } catch (e) {
      toast.error('حدث خطأ أثناء حذف الأستاذ');
    }
  };

  const handleToggleTeacherExemption = async (teacher: Teacher, makeExempt: boolean, reason?: string) => {
    if (!teacher.id) return;
    const finalReason = makeExempt ? (reason?.trim() || 'غائب / لديه حجة') : '';
    try {
      await api.put(`/api/teachers/${teacher.id}`, {
        isExempt: makeExempt ? 1 : 0,
        exemptReason: finalReason
      });

      const updatedTeachers = teachers.map(t =>
        String(t.id) === String(teacher.id)
          ? { ...t, isExempt: makeExempt, exemptReason: finalReason }
          : t
      );
      setTeachers(updatedTeachers);

      if (makeExempt) {
        const remainingAssignments = assignments.filter(a => String(a.teacherId) !== String(teacher.id));
        if (remainingAssignments.length !== assignments.length) {
          await recalculateAndSaveAssignments(remainingAssignments);
        }
        toast.success(`تم إعفاء الأستاذ(ة) "${teacher.name}" (${finalReason}) واستبعاده من الحراسة`);
      } else {
        toast.success(`تم إلغاء الإعفاء وإعادة تفعيل الأستاذ(ة) "${teacher.name}" للحراسة`);
      }
      setExemptTargetTeacher(null);
      setExemptReasonInput('غائب / لديه حجة');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء تحديث حالة الإعفاء');
    }
  };

  const handleClearDemoTeachers = async () => {
    toast.loading('جاري حذف الأساتذة التجريبيين...', { id: 'clean-demo' });
    try {
      await api.delete('/api/teachers/demo');
      const freshTeachers = await api.get('/api/teachers');
      setTeachers(normalizeTeacherList(freshTeachers));
      toast.success('تم حذف جميع الأساتذة التجريبيين بنجاح', { id: 'clean-demo' });
    } catch (e) {
      toast.error('حدث خطأ أثناء حذف الأساتذة التجريبيين', { id: 'clean-demo' });
    }
  };

  const handleClearAllTeachers = async () => {
    toast.loading('جاري مسح قائمة الأساتذة...', { id: 'clean-all' });
    try {
      await api.delete('/api/teachers/all');
      setTeachers([]);
      toast.success('تم مسح قائمة الأساتذة بنجاح', { id: 'clean-all' });
    } catch (e) {
      toast.error('حدث خطأ أثناء مسح القائمة', { id: 'clean-all' });
    }
  };

  // Teacher Excel Import State
  const [teacherFileBuffer, setTeacherFileBuffer] = useState<ArrayBuffer | null>(null);
  const [isTeacherImportModalOpen, setIsTeacherImportModalOpen] = useState(false);

  const handleTeacherFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (buffer) {
        setTeacherFileBuffer(buffer);
        setIsTeacherImportModalOpen(true);
      } else {
        toast.error('تعذر قراءة ملف الإكسل');
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmTeacherImport = async (mappedData: any[]) => {
    setIsTeacherImportModalOpen(false);
    toast.loading('جاري استيراد قائمة الأساتذة...', { id: 'teacher-import' });
    try {
      const timestamp = Date.now();
      const validTeachers = mappedData
        .filter(row => {
          const fullName = row.name || `${row.lastName || ''} ${row.firstName || ''}`.trim();
          return fullName && String(fullName).trim() !== '';
        })
        .map((row, idx) => {
          const fullName = String(row.name || `${row.lastName || ''} ${row.firstName || ''}`).trim();
          const customId = (row.num || row.id || row.code) 
            ? String(row.num || row.id || row.code).trim() 
            : `t_${timestamp}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
          const { isExempt, exemptReason } = parseExemptFromExcel(row.exemptStatus, row.exemptReason);
            
          return {
            id: customId,
            name: fullName,
            specialty: row.specialty && String(row.specialty).trim() !== '' ? String(row.specialty).trim() : 'عام',
            seniority: Number(row.seniority) || 0,
            email: "",
            totalHours: 0,
            availabilityExceptions: "[]",
            isExempt,
            exemptReason
          };
        });

      if (validTeachers.length > 0) {
        // Exclude/replace any demo teachers so only the uploaded real teachers exist
        await api.post('/api/teachers/bulk', { teachers: validTeachers, replaceExisting: true });
        const freshTeachers = await api.get('/api/teachers');
        const normalizedFresh = normalizeTeacherList(freshTeachers);
        knownTeacherIdsRef.current = new Set();
        setTeachers(normalizedFresh);
        setSelectedTeacherIds(normalizedFresh.filter(t => !t.isExempt && t.id).map(t => String(t.id)));
        setShowTeachersSection(true);
        setTeacherSectionFilter('all');
        setTeacherSectionSearch('');
        const exemptCount = validTeachers.filter(t => t.isExempt).length;
        toast.success(
          exemptCount > 0
            ? `تم استيراد ${validTeachers.length} أستاذ (منهم ${exemptCount} معفى) وعرضهم في الخانة المخصصة!`
            : `تم استيراد ${validTeachers.length} أستاذ بنجاح وعرضهم في الخانة المخصصة!`,
          { id: 'teacher-import' }
        );
      } else {
        toast.error('لم يتم العثور على أسماء أساتذة صالحة للاستيراد', { id: 'teacher-import' });
      }
    } catch(e) {
      console.error(e);
      toast.error('حدث خطأ أثناء استيراد الأساتذة', { id: 'teacher-import' });
    }
  };

  // Detailed Cell Adjustment Modal: edit assigned proctor, swap, toggle reserve, change hall, delete
  const [cellTarget, setCellTarget] = useState<{
    assignment: Assignment;
    teacher: Teacher;
    exam: Exam;
    hall?: Hall;
    isReserve: boolean;
  } | null>(null);

  // Modal for assigning an empty slot manually
  const [assignEmptyTarget, setAssignEmptyTarget] = useState<{
    exam: Exam;
    date: string;
    period: 'morning' | 'afternoon';
    hall?: Hall;
    teacher?: Teacher;
  } | null>(null);

  const [selectedHallForAssign, setSelectedHallForAssign] = useState<string>('reserve');
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState<string>('');

  const modalBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      api.get('/api/teachers'),
      api.get('/api/exams'),
      api.get('/api/halls'),
      api.get('/api/settings'),
      api.get('/api/assignments')
    ]).then(async ([tData, eData, hData, sData, aData]) => {
      const normalized = normalizeTeacherList(tData);
      setTeachers(normalized);
      if (normalized.length > 0) {
        setShowTeachersSection(true);
      }
      setExams(eData || []);
      setHalls(hData || []);
      if (sData) {
        setSystemSettings(sData);
        if (sData.institutionName) setInstitutionName(sData.institutionName);
        if (sData.wilaya) setWilaya(sData.wilaya);
        if (sData.schoolYear) setSchoolYear(sData.schoolYear);
        if (sData.selectedTerm) setSelectedTerm(sData.selectedTerm);
        if (sData.proctorRatio && Number(sData.proctorRatio) > 0) {
          setDefaultProctorsPerHall(Number(sData.proctorRatio));
        }
        if (sData.morningTime) setMorningTime(sData.morningTime);
        if (sData.afternoonTime) setAfternoonTime(sData.afternoonTime);
        if (sData.examStartDate) setExamStartDate(sData.examStartDate);
        if (sData.examEndDate) setExamEndDate(sData.examEndDate);

        // Sync selected grade levels and default cohort tab with chosen term
        const termStr = String(sData.selectedTerm || 'الفصل الثالث');
        const loadedIsThird = termStr.includes('الثالث') || termStr.includes('3');

        let mappedGenLevels: GradeLevelKey[] = ['first', 'second', 'third'];
        if (Array.isArray(sData.selectedLevels) && sData.selectedLevels.length > 0) {
          const parsed: GradeLevelKey[] = [];
          if (sData.selectedLevels.includes('1ثا')) parsed.push('first');
          if (sData.selectedLevels.includes('2ثا')) parsed.push('second');
          if (sData.selectedLevels.includes('3ثا')) parsed.push('third');
          if (parsed.length > 0) mappedGenLevels = parsed;
        }
        setGenerationLevels(mappedGenLevels);

        const mappedPrintLevels: string[] = [];
        if (mappedGenLevels.includes('first')) mappedPrintLevels.push('level1');
        if (mappedGenLevels.includes('second')) mappedPrintLevels.push('level2');
        if (mappedGenLevels.includes('third')) mappedPrintLevels.push('level3');
        if (mappedPrintLevels.length > 0) setSelectedLevels(mappedPrintLevels);

        if (!loadedIsThird) {
          if (mappedGenLevels.length === 1) {
            setActiveSession(mappedGenLevels[0]);
          } else if (mappedGenLevels.length === 2 && !mappedGenLevels.includes('third')) {
            setActiveSession('first_second');
          } else {
            setActiveSession('all');
          }
        } else {
          if (mappedGenLevels.length === 1) {
            setActiveSession(mappedGenLevels[0]);
          } else {
            setActiveSession('first_second');
          }
        }
      }
      setAssignments(aData || []);
      if (eData && eData.length > 0) {
        setSelectedExamForSign(String(eData[0].id));
      }
      setLoading(false);
    }).catch(console.error);

    const onSettingsChanged = (ev: Event) => {
      const customEv = ev as CustomEvent<SystemSettings>;
      const nextSettings = customEv.detail;
      if (nextSettings) {
        setSystemSettings(nextSettings);
        if (nextSettings.institutionName) setInstitutionName(nextSettings.institutionName);
        if (nextSettings.wilaya) setWilaya(nextSettings.wilaya);
        if (nextSettings.schoolYear) setSchoolYear(nextSettings.schoolYear);
        if (nextSettings.selectedTerm) setSelectedTerm(nextSettings.selectedTerm);
        if (nextSettings.morningTime) setMorningTime(nextSettings.morningTime);
        if (nextSettings.afternoonTime) setAfternoonTime(nextSettings.afternoonTime);
      }
      api.get('/api/exams').then((freshExams) => {
        if (Array.isArray(freshExams)) setExams(freshExams);
      }).catch(console.error);
    };

    window.addEventListener(SETTINGS_CHANGE_EVENT, onSettingsChanged);
    return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, onSettingsChanged);
  }, []);

  const isThirdTerm = selectedTerm.includes('الثالث') || selectedTerm.includes('3');

  // Determine canonical grade level of an exam ('first' | 'second' | 'third' | 'first_second')
  const getExamGradeLevel = (exam?: Exam): 'first' | 'second' | 'third' | 'first_second' => {
    if (!exam) return 'first_second';
    if (exam.targetLevel === 'first') return 'first';
    if (exam.targetLevel === 'second') return 'second';
    if (exam.targetLevel === 'third') return 'third';

    const streamStr = String(exam.stream || '').toLowerCase();
    if (streamStr.includes('ثالثة') || streamStr.includes('بكالوريا') || streamStr.includes('3ثا')) return 'third';
    if (streamStr.includes('ثانية') || streamStr.includes('2ثا')) return 'second';
    if (streamStr.includes('أولى') || streamStr.includes('جذع مشترك') || streamStr.includes('ج م') || streamStr.includes('1ثا')) return 'first';

    return exam.targetLevel === 'first_second' ? 'first_second' : 'first_second';
  };

  const doesExamMatchSession = (exam: Exam, session: SessionTab): boolean => {
    if (session === 'all') return true;
    const lvl = getExamGradeLevel(exam);
    if (session === 'first_second') return lvl === 'first' || lvl === 'second' || lvl === 'first_second';
    if (session === 'first') return lvl === 'first' || lvl === 'first_second';
    if (session === 'second') return lvl === 'second' || lvl === 'first_second';
    return lvl === 'third';
  };

  const doesExamMatchGenerationLevels = (exam: Exam, levels: GradeLevelKey[]): boolean => {
    if (levels.length === 0) return false;
    const lvl = getExamGradeLevel(exam);
    if (lvl === 'first_second') {
      return levels.includes('first') || levels.includes('second');
    }
    return levels.includes(lvl);
  };

  // Helper to get exams for a session
  const getSessionExams = (session: SessionTab) => {
    return exams.filter(e => doesExamMatchSession(e, session));
  };

  const firstExams = getSessionExams('first');
  const secondExams = getSessionExams('second');
  const firstSecondExams = getSessionExams('first_second');
  const thirdExams = getSessionExams('third');

  const activeExams = activeSession === 'all'
    ? exams
    : getSessionExams(activeSession);

  // Available teachers pool (excluding demo teachers when real teachers exist, and always excluding exempt teachers)
  const realTeachers = teachers.filter(t => !isDemoTeacher(t));
  const baseTeacherPool = realTeachers.length > 0 ? realTeachers : teachers;
  const availableTeachers = baseTeacherPool.filter(t => !t.isExempt);
  const selectedTeachersForGen = availableTeachers.filter(t => t.id && selectedTeacherIds.includes(String(t.id)));
  const selectedExamsForGen = exams.filter(ex => doesExamMatchGenerationLevels(ex, generationLevels));

  const getExamCountForLevel = (lvl: GradeLevelKey) =>
    exams.filter(ex => doesExamMatchGenerationLevels(ex, [lvl])).length;

  const toggleGenerationLevel = (lvl: GradeLevelKey) => {
    setGenerationLevels(prev =>
      prev.includes(lvl) ? prev.filter(item => item !== lvl) : [...prev, lvl]
    );
  };

  // Compute dates for a session
  const getWeekDatesForSession = (session: SessionTab): string[] => {
    const sExams = getSessionExams(session);
    if (sExams.length > 0) {
      const datesList = sExams.map(e => String(e.date));
      const sortedDates = datesList.filter((d, i) => datesList.indexOf(d) === i).sort();
      return sortedDates;
    }

    const parseLocalDate = (str: string) => {
      if (!str) return new Date();
      const parts = str.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
      return new Date();
    };

    const formatLocalDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    let startDate = examStartDate ? parseLocalDate(examStartDate) : new Date();
    let endDate = examEndDate ? parseLocalDate(examEndDate) : null;

    const dates: string[] = [];
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

    // In Algeria, the school week starts on Sunday (day 0). Rewind if needed.
    if (!examStartDate && cur.getDay() !== 0) {
      cur.setDate(cur.getDate() - cur.getDay());
    }

    while (dates.length < 5) {
      const dayOfWeek = cur.getDay();
      if (dayOfWeek !== 5 && dayOfWeek !== 6) {
        dates.push(formatLocalDate(cur));
        if (endDate && cur >= endDate) break;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const exportToExcel = () => {
    if (assignments.length === 0) {
      toast.error('لا يوجد جدول حراسة للتحميل');
      return;
    }

    const data = assignments.map((a, index) => {
      const exam = exams.find(e => String(e.id) === String(a.examId));
      const teacher = teachers.find(t => String(t.id) === String(a.teacherId));
      const hall = halls.find(h => String(h.id) === String(a.hallId));
      const gradeLvl = getExamGradeLevel(exam);
      const levelLabel =
        gradeLvl === 'third'
          ? (isThirdTerm ? 'السنة الثالثة (بكالوريا تجريبي)' : `السنة الثالثة (${selectedTerm})`)
          : gradeLvl === 'first'
          ? 'السنة الأولى ثانوي'
          : gradeLvl === 'second'
          ? 'السنة الثانية ثانوي'
          : 'السنوات الأولى والثانية';

      const resolvedPeriodHeaders = resolveProctoringPeriodHeaders(activeSession, systemSettings);

      return {
        'الرقم': index + 1,
        'الأستاذ': teacher?.name || 'محذوف',
        'التخصص': teacher?.specialty || 'غير محدد',
        'المادة المكلف بحراستها': exam?.subject || 'محذوفة',
        'المستوى': levelLabel,
        'اليوم': getArabicDayName(a.date),
        'التاريخ': a.date,
        'الفترة': a.period === 'morning' ? 'صباحي' : 'مسائي',
        'التوقيت': exam
          ? resolveExamEffectiveTimeRange(exam, systemSettings)
          : (a.period === 'morning' ? resolvedPeriodHeaders.morningTime : resolvedPeriodHeaders.afternoonTime),
        'القاعة': hall?.name || 'محذوفة',
        'المدة (ساعات)': exam?.duration || 2
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'جدول_الحراسة_الكامل');
    XLSX.writeFile(workbook, `جدول_حراسة_الأساتذة_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('تم تحميل جدول الحراسة بنجاح كملف Excel');
  };

  const handleGenerate = async () => {
    if (generationLevels.length === 0) {
      toast.error('يرجى تحديد سنة دراسية واحدة على الأقل لاختبارات التوليد');
      return;
    }

    if (selectedExamsForGen.length === 0) {
      toast.error('لا توجد اختبارات مبرمجة للسنوات المختارة حالياً');
      return;
    }

    if (selectedTeachersForGen.length === 0) {
      toast.error('يرجى اختيار أستاذ واحد متاح على الأقل من قائمة الأساتذة المعنيين بالتوليد');
      setShowTeachersSection(true);
      return;
    }

    if (halls.length === 0) {
      toast.error('يرجى إضافة القاعات أولاً');
      return;
    }

    if (realTeachers.length === 0 && teachers.length > 0) {
      toast('تنبيه: يتم التوليد بالبيانات التجريبية لعدم إدراج قائمة أساتذة حقيقية بعد. يرجى استيراد قائمتكم الرسمية.', { icon: '⚠️' });
    }

    setGenerating(true);
    try {
      const examsForGeneration = selectedExamsForGen.map(ex => ({
        ...ex,
        timeRange: resolveExamEffectiveTimeRange(ex, systemSettings)
      }));

      const result = generateAssignments(selectedTeachersForGen, examsForGeneration, halls, {
        proctorsPerHall: defaultProctorsPerHall,
        reserveProctorsPerPeriod,
        maxOnePerDay,
        avoidSpecialty,
        exemptOnOwnSubjectDay,
        oneDayOff,
        separateLevelTimings: Boolean(systemSettings?.separateLevelTimings)
      });
      
      const newAssignmentsWithIds = result.assignments.map((a, idx) => ({
        ...a,
        id: `assign_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 9)}`
      }));

      await api.post('/api/assignments/replace', { 
        assignments: newAssignmentsWithIds, 
        stats: result.stats 
      });
      
      const newAssignments = await api.get('/api/assignments');
      const newTeachers = await api.get('/api/teachers');
      setAssignments(newAssignments);
      setTeachers(normalizeTeacherList(newTeachers));

      // Align active tab with what user chose to generate
      if (generationLevels.length === 1) {
        setActiveSession(generationLevels[0]);
      } else if (generationLevels.length === 2 && !generationLevels.includes('third')) {
        setActiveSession('first_second');
      } else {
        setActiveSession('all');
      }

      toast.success(
        `تم توليد جدول الحراسة بنجاح (${newAssignmentsWithIds.length} تكليف لـ ${selectedTeachersForGen.length} أستاذ على ${selectedExamsForGen.length} اختبار)`
      );
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء التوليد');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenPrintModal = async () => {
    try {
      const sData = await api.get('/api/settings');
      if (sData) {
        setSystemSettings(sData);
        if (sData.institutionName) setInstitutionName(sData.institutionName);
        if (sData.wilaya) setWilaya(sData.wilaya);
        if (sData.schoolYear) setSchoolYear(sData.schoolYear);
        if (sData.selectedTerm) setSelectedTerm(sData.selectedTerm);
        if (sData.morningTime) setMorningTime(sData.morningTime);
        if (sData.afternoonTime) setAfternoonTime(sData.afternoonTime);
        if (sData.examStartDate) setExamStartDate(sData.examStartDate);
        if (sData.examEndDate) setExamEndDate(sData.examEndDate);
      }
    } catch (e) {}
    setShowPrintModal(true);
  };

  const handleClearAssignments = async () => {
    try {
      await api.post('/api/assignments/replace', { assignments: [], stats: {} });
      const newTeachers = await api.get('/api/teachers');
      setAssignments([]);
      setTeachers(normalizeTeacherList(newTeachers));
      setShowClearAssignmentsConfirm(false);
      toast.success('تم تفريغ جدول الحراسة بنجاح');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء تفريغ الجدول');
    }
  };

  // Helper to compile enriched assignment objects for a teacher
  const getTeacherEnrichedAssignments = (teacherId: string, sessionFilter: SessionTab) => {
    const tAssignments = assignments.filter(a => String(a.teacherId) === String(teacherId));
    
    const enriched = tAssignments.map(a => {
      const exam = exams.find(e => String(e.id) === String(a.examId));
      const hall = halls.find(h => String(h.id) === String(a.hallId));
      const gradeLevel = getExamGradeLevel(exam);
      const levelLabel =
        gradeLevel === 'third'
          ? '3 ثا'
          : gradeLevel === 'first'
          ? '1 ثا'
          : gradeLevel === 'second'
          ? '2 ثا'
          : '1-2 ثا';
      const hallName = a.hallId === 'reserve' 
        ? 'حارس احتياط' 
        : (hall?.name ? (hall.name.includes('قاعة') ? hall.name : `قاعة ${hall.name}`) : 'غير محددة');
      const timeRange = exam
        ? resolveExamEffectiveTimeRange(exam, systemSettings)
        : (a.period === 'morning' ? morningTime : afternoonTime);

      return {
        ...a,
        examObj: exam,
        subject: exam?.subject || 'مادة غير محددة',
        duration: exam?.duration || 2,
        targetLevel: gradeLevel,
        levelLabel,
        hallName,
        timeRange,
        dayName: getArabicDayName(a.date)
      };
    });

    const filtered = enriched.filter(item => {
      if (sessionFilter === 'all') return true;
      if (!item.examObj) return false;
      return doesExamMatchSession(item.examObj, sessionFilter);
    });

    return filtered.sort((a, b) => {
      const dComp = a.date.localeCompare(b.date);
      if (dComp !== 0) return dComp;
      return a.period === 'morning' ? -1 : 1;
    });
  };

  // Helper to format readable term+level title for convocations
  const buildConvocationTitle = (session: SessionTab): string => {
    if (customExamTitle.trim() !== '') return customExamTitle.trim();

    if (session === 'third') {
      return isThirdTerm
        ? `اختبارات ${selectedTerm} (البكالوريا التجريبي) - السنة الثالثة ثانوي`
        : `اختبارات ${selectedTerm} - السنة الثالثة ثانوي`;
    }
    if (session === 'first') return `اختبارات ${selectedTerm} - السنة الأولى ثانوي`;
    if (session === 'second') return `اختبارات ${selectedTerm} - السنة الثانية ثانوي`;
    if (session === 'first_second') {
      if (selectedLevels.includes('level1') && !selectedLevels.includes('level2')) {
        return `اختبارات ${selectedTerm} - السنة الأولى ثانوي`;
      }
      if (!selectedLevels.includes('level1') && selectedLevels.includes('level2')) {
        return `اختبارات ${selectedTerm} - السنة الثانية ثانوي`;
      }
      return `اختبارات ${selectedTerm} - السنوات الأولى والثانية ثانوي`;
    }

    const parts: string[] = [];
    if (selectedLevels.includes('level1')) parts.push('الأولى');
    if (selectedLevels.includes('level2')) parts.push('الثانية');
    if (selectedLevels.includes('level3')) parts.push('الثالثة');
    if (parts.length === 0 || parts.length === 3) {
      return `اختبارات ${selectedTerm} - السنوات الأولى والثانية والثالثة ثانوي`;
    }
    return `اختبارات ${selectedTerm} - السنوات ${parts.join(' و')} ثانوي`;
  };

  // Cards to render in convocations print view (strictly one unified table per teacher)
  const getPrintCards = () => {
    const cards: Array<{
      teacher: Teacher;
      sessionTitle: string;
      assignedSubjects: ReturnType<typeof getTeacherEnrichedAssignments>;
      weekDates: string[];
    }> = [];

    const includeFirst = selectedLevels.includes('level1');
    const includeSecond = selectedLevels.includes('level2');
    const includeThird = selectedLevels.includes('level3');
    const includeFirstSecond = includeFirst || includeSecond;

    let sessionKey: SessionTab = activeSession;
    if (activeSession === 'all') {
      if (includeFirstSecond && includeThird) {
        sessionKey = 'all';
      } else if (includeThird) {
        sessionKey = 'third';
      } else if (includeFirst && includeSecond) {
        sessionKey = 'first_second';
      } else if (includeFirst) {
        sessionKey = 'first';
      } else if (includeSecond) {
        sessionKey = 'second';
      }
    }

    teachers.forEach(teacher => {
      if (teacher.isExempt) return;

      const assigned = getTeacherEnrichedAssignments(String(teacher.id), sessionKey);
      if (printOnlyAssigned && assigned.length === 0) return;

      cards.push({
        teacher,
        sessionTitle: buildConvocationTitle(sessionKey),
        assignedSubjects: assigned,
        weekDates: getWeekDatesForSession(sessionKey)
      });
    });

    return cards;
  };

  const extractPrintBodyHtml = (htmlStr: string) => {
    if (!htmlStr) return '';
    const styleMatches = (htmlStr.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).join('\n');
    const bodyMatch = htmlStr.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch && bodyMatch[1] ? bodyMatch[1] : htmlStr;
    return `${styleMatches}\n${bodyContent}`;
  };

  const handleExportPDFFromPreview = () => {
    const docEl = document.getElementById('allocation-print-document');
    if (!docEl) {
      toast.error('تعذر إيجاد وثيقة الطباعة');
      return;
    }

    toast.loading('جاري توليد ملف PDF عالي الجودة...', { id: 'pdf-gen' });

    const isLandscape = docType === 'halls' || docType === 'master';

    const docFileName = docType === 'convocations' 
      ? `استدعاءات_حراسة_الأساتذة_${schoolYear}.pdf`
      : docType === 'halls'
      ? `جدول_حراسة_القاعات_${schoolYear}.pdf`
      : docType === 'master'
      ? `الجدول_العام_الملون_${schoolYear}.pdf`
      : `محضر_حضور_وحراسة_${schoolYear}.pdf`;

    const opt = {
      margin: [0.15, 0.15, 0.25, 0.15] as [number, number, number, number],
      filename: docFileName,
      pagebreak: { mode: ['css', 'legacy'] },
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollY: 0,
        scrollX: 0,
        onclone: (clonedDoc: Document) => {
          sanitizeOklchInClonedDoc(clonedDoc);
        }
      },
      jsPDF: { unit: 'in' as const, format: 'a4' as const, orientation: isLandscape ? ('landscape' as const) : ('portrait' as const) }
    };

    html2pdf().set(opt).from(docEl).save().then(() => {
      toast.success('تم تنزيل ملف PDF بنجاح!', { id: 'pdf-gen' });
    }).catch((err: any) => {
      console.error('PDF generation error:', err);
      toast.success('جاري تفعيل المعاينة والطباعة لـ PDF...', { id: 'pdf-gen' });
      handleDirectPrintFromPreview();
    });
  };

  const handleDownloadHtmlFile = () => {
    if (!previewHtmlContent) return;
    const blob = new Blob([previewHtmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `وثيقة_حراسة_${docType}_${schoolYear}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('تم تنزيل الوثيقة كملف إلكتروني مستقل بنجاح!');
  };

  const handleDirectPrintFromPreview = () => {
    if (previewHtmlContent) {
      printHtmlDirectly(previewHtmlContent);
    } else {
      const docEl = document.getElementById('allocation-print-document');
      if (docEl) {
        printHtmlDirectly(docEl.outerHTML);
      } else {
        window.print();
      }
    }
  };

  const executePrint = () => {
    setShowPrintModal(false);
    const resolvedHeaders = resolveProctoringPeriodHeaders(activeSession, systemSettings);
    const settings = {
      institutionName,
      wilaya,
      schoolYear,
      selectedTerm,
      morningTime: systemSettings?.separateLevelTimings ? resolvedHeaders.morningTime : (systemSettings?.morningTime || morningTime),
      afternoonTime: systemSettings?.separateLevelTimings ? resolvedHeaders.afternoonTime : (systemSettings?.afternoonTime || afternoonTime),
      customExamTitle,
      separateLevelTimings: Boolean(systemSettings?.separateLevelTimings)
    };

    const resolvedActiveExams = activeExams.map(ex => ({
      ...ex,
      timeRange: resolveExamEffectiveTimeRange(ex, systemSettings)
    }));

    let html = '';
    if (docType === 'convocations') {
      const cards = getPrintCards();
      if (cards.length === 0) {
        toast.error('لا توجد استدعاءات مطابقة للطباعة');
        return;
      }
      html = generateConvocationsHtml(cards, settings);
    } else if (docType === 'halls') {
      html = generateHallTimetableHtml(halls, resolvedActiveExams, assignments, teachers, settings);
    } else if (docType === 'master') {
      html = generateMasterGridHtml(teachers, resolvedActiveExams, assignments, halls, settings);
    } else if (docType === 'daily_sign') {
      const exam = exams.find(e => String(e.id) === String(selectedExamForSign)) || activeExams[0];
      if (!exam) {
        toast.error('يرجى اختيار مادة الاختبار المراد طباعة محضر حضورها');
        return;
      }
      const resolvedExam = {
        ...exam,
        timeRange: resolveExamEffectiveTimeRange(exam, systemSettings)
      };
      html = generateDailySignSheetHtml(resolvedExam, assignments, teachers, halls, settings);
    }

    if (!html) return;

    // Set preview HTML and show Live Print Modal directly on screen
    setPreviewHtmlContent(html);
    setShowLivePrintPreview(true);

    // Trigger iframe print dialog directly
    printHtmlDirectly(html);

    toast.success('تم تجهيز المعاينة والطباعة المباشرة بنجاح!', { icon: '🖨️' });
  };

  // Central Save & Rebalance Helper
  const recalculateAndSaveAssignments = async (newAssignments: Assignment[]) => {
    const stats: Record<string, number> = {};
    teachers.forEach(t => (stats[t.id!] = 0));
    newAssignments.forEach(a => {
      const ex = exams.find(e => String(e.id) === String(a.examId));
      if (ex && stats[a.teacherId] !== undefined) {
        stats[a.teacherId] += ex.duration || 2;
      }
    });

    await api.post('/api/assignments/replace', {
      assignments: newAssignments,
      stats
    });

    const [freshAssignments, freshTeachers] = await Promise.all([
      api.get('/api/assignments'),
      api.get('/api/teachers')
    ]);

    setAssignments(freshAssignments);
    setTeachers(normalizeTeacherList(freshTeachers));
  };

  // 1. Swap teacher on cell
  const handleSwapTeacher = async (newTeacherId: string) => {
    if (!cellTarget) return;
    try {
      const updated = assignments.map(a => {
        if (a.id === cellTarget.assignment.id) {
          return { ...a, teacherId: newTeacherId };
        }
        return a;
      });
      await recalculateAndSaveAssignments(updated);
      setCellTarget(null);
      toast.success('تم استبدال الأستاذ بنجاح وتحديث الجدول');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء استبدال الأستاذ');
    }
  };

  // 2. Change hall or toggle reserve
  const handleChangeHall = async (newHallId: string) => {
    if (!cellTarget) return;
    try {
      const updated = assignments.map(a => {
        if (a.id === cellTarget.assignment.id) {
          return { ...a, hallId: newHallId };
        }
        return a;
      });
      await recalculateAndSaveAssignments(updated);
      setCellTarget(null);
      toast.success(newHallId === 'reserve' ? 'تم تحويل الأستاذ إلى حارس احتياط بنجاح' : 'تم تغيير القاعة بنجاح');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء تعديل القاعة أو التكليف');
    }
  };

  // 3. Delete assignment
  const handleDeleteAssignment = async () => {
    if (!cellTarget) return;
    try {
      const updated = assignments.filter(a => a.id !== cellTarget.assignment.id);
      await recalculateAndSaveAssignments(updated);
      setCellTarget(null);
      toast.success('تم إلغاء التكليف وتفريغ الخانة بنجاح');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء إلغاء التكليف');
    }
  };

  // 4. Manual Assign to Empty Cell
  const handleAssignEmpty = async (teacherId: string, hallId: string) => {
    if (!assignEmptyTarget) return;
    try {
      const newAssign: Assignment = {
        id: `assign_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        examId: String(assignEmptyTarget.exam.id),
        teacherId,
        hallId,
        period: assignEmptyTarget.period,
        date: assignEmptyTarget.date
      };

      const updated = [...assignments, newAssign];
      await recalculateAndSaveAssignments(updated);
      setAssignEmptyTarget(null);
      toast.success(hallId === 'reserve' ? 'تم إسناد الأستاذ كحارس احتياط' : 'تم إسناد الحراسة بنجاح');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء إسناد الحراسة');
    }
  };

  // Filtered Teachers
  const filteredTeachers = teachers.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.specialty.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterAssignedOnly) {
      const tAssignments = getTeacherEnrichedAssignments(String(t.id), activeSession);
      return tAssignments.length > 0;
    }

    return true;
  });

  const totalAssignedInActiveView = teachers.reduce((acc, t) => {
    const list = getTeacherEnrichedAssignments(String(t.id), activeSession);
    return acc + (list.length > 0 ? 1 : 0);
  }, 0);

  // Fairness & Workload Metrics
  const activeAssignments = activeSession === 'all'
    ? assignments
    : assignments.filter(a => {
        const ex = exams.find(e => String(e.id) === String(a.examId));
        return ex ? doesExamMatchSession(ex, activeSession) : false;
      });

  const coveragePercent = teachers.length > 0 ? Math.round((totalAssignedInActiveView / teachers.length) * 100) : 0;
  const hallProctorsCount = activeAssignments.filter(a => a.hallId !== 'reserve').length;
  const reserveProctorsCount = activeAssignments.filter(a => a.hallId === 'reserve').length;

  const teacherSessionsList = teachers.map(t => getTeacherEnrichedAssignments(String(t.id), activeSession).length).filter(c => c > 0);
  const avgSessions = teacherSessionsList.length > 0 
    ? (teacherSessionsList.reduce((a, b) => a + b, 0) / teacherSessionsList.length).toFixed(1) 
    : '0';
  const minSessions = teacherSessionsList.length > 0 ? Math.min(...teacherSessionsList) : 0;
  const maxSessions = teacherSessionsList.length > 0 ? Math.max(...teacherSessionsList) : 0;

  const activePeriodHeaders = resolveProctoringPeriodHeaders(activeSession, systemSettings);
  const displayMorningHeader = systemSettings?.separateLevelTimings
    ? activePeriodHeaders.morningTime
    : (systemSettings?.morningTime || morningTime);
  const displayAfternoonHeader = systemSettings?.separateLevelTimings
    ? activePeriodHeaders.afternoonTime
    : (systemSettings?.afternoonTime || afternoonTime);

  const printCards = getPrintCards();

  return (
    <div className="space-y-4 lg:space-y-6 print:space-y-0 print:m-0">
      {/* Top Banner Actions Card - Hirasa Pro Sleek Theme */}
      <div className="flex flex-col gap-5 bg-[#121E36] p-5 lg:p-6 rounded-3xl border border-slate-800 shadow-xl print:hidden">
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-3.5 bg-[#0099FF] rounded-2xl text-white shadow-lg shadow-sky-500/30 shrink-0 ring-4 ring-sky-500/20">
            <LayoutGrid size={28} className="lg:w-8 lg:h-8" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl lg:text-2xl font-black text-white leading-tight flex flex-wrap items-center gap-2">
              <span>ضبط جداول حراسة الأساتذة</span>
              <span className="text-xs bg-[#0099FF]/20 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/30 font-bold">Hirasa Pro v4</span>
            </h3>
            <p className="text-xs lg:text-sm text-slate-400 mt-1 font-medium">
              توزيع ذكي وعادل لمواد وقاعات الامتحان مع تحكم كامل بشروط الحراسة والطباعة المباشرة السريعة.
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-800/80">
          <button 
            onClick={() => setShowRulesPanel(!showRulesPanel)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs lg:text-sm transition-all border cursor-pointer whitespace-nowrap shrink-0 ${
              showRulesPanel 
                ? 'bg-[#0099FF]/20 text-cyan-300 border-sky-500/50 ring-2 ring-sky-500/20' 
                : 'bg-[#182643] text-slate-300 border-slate-700 hover:bg-[#1f3054] hover:text-white'
            }`}
            title="شروط التوزيع الذكي"
          >
            <Sliders size={17} />
            <span>شروط وضوابط التوزيع</span>
          </button>

          <button 
            onClick={handleOpenPrintModal}
            className="flex items-center justify-center gap-2 bg-[#0099FF] hover:bg-sky-600 text-white px-5 py-2.5 rounded-2xl transition-all font-black text-xs lg:text-sm shadow-lg shadow-sky-500/30 active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            title="طباعة مباشرة للوثائق (الاستدعاءات، جدول القاعات، الجدول الملون، كشف الإمضاء)"
          >
            <Printer size={17} />
            <span>طباعة الوثائق فوراً</span>
          </button>

          <button 
            onClick={() => setShowTeachersSection(!showTeachersSection)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl cursor-pointer transition-all font-bold text-xs lg:text-sm shadow-sm border whitespace-nowrap shrink-0 ${
              showTeachersSection
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50 ring-2 ring-cyan-500/20'
                : 'bg-[#182643] text-cyan-300 border-cyan-500/30 hover:bg-[#1f3054]'
            }`}
            title="إظهار أو إخفاء خانة قائمة الأساتذة وإدارة الإعفاءات"
          >
            <Users size={17} />
            <span>قائمة الأساتذة ({teachers.length})</span>
            {teachers.filter(t => t.isExempt).length > 0 && (
              <span className="bg-rose-500/25 text-rose-200 border border-rose-500/40 text-[10px] px-2 py-0.5 rounded-full font-black">
                {teachers.filter(t => t.isExempt).length} معفى
              </span>
            )}
          </button>

          <label 
            className="flex items-center justify-center gap-2 bg-[#182643] text-emerald-300 border border-emerald-500/30 hover:bg-[#1f3054] px-4 py-2.5 rounded-2xl cursor-pointer transition-all font-bold text-xs lg:text-sm whitespace-nowrap shrink-0"
            title="استيراد قائمة الأساتذة من ملف إكسل"
          >
            <FileUp size={17} />
            <span>استيراد الأساتذة</span>
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleTeacherFileUpload} />
          </label>

          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2.5 rounded-2xl hover:bg-emerald-500/20 transition-all font-bold border border-emerald-500/30 text-xs lg:text-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download size={17} />
            <span>Excel</span>
          </button>

          {assignments.length > 0 && (
            <button 
              onClick={() => setShowClearAssignmentsConfirm(true)}
              className="flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-3.5 py-2.5 rounded-2xl transition-all font-bold border border-rose-500/30 text-xs lg:text-sm cursor-pointer whitespace-nowrap shrink-0"
              title="تفريغ جدول الحراسة بالكامل للبدء من جديد"
            >
              <X size={16} />
              <span>تفريغ الجدول</span>
            </button>
          )}

          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-2xl transition-all font-black shadow-lg shadow-purple-500/30 active:scale-95 disabled:opacity-50 text-xs lg:text-sm cursor-pointer whitespace-nowrap shrink-0 w-full sm:w-auto lg:mr-auto"
          >
            {generating ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Wand2 size={17} />}
            <span>توليد التوزيع الذكي</span>
          </button>
        </div>
      </div>

      {/* Smart Rules Options Settings Panel */}
      {showRulesPanel && (
        <div className="bg-[#121E36] p-5 rounded-3xl border border-sky-500/30 shadow-xl space-y-4 print:hidden animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <ShieldCheck size={20} />
              <span>ضوابط وقواعد التوزيع الآلي للحراسة (وفق معايير Hirasa Pro):</span>
            </div>
            <button 
              onClick={() => setShowRulesPanel(false)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              إخفاء النافذة ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-[#182643] p-3.5 rounded-2xl border border-slate-700 space-y-1">
              <label className="text-xs font-bold text-slate-300 block">عدد الحراس في كل قاعة:</label>
              <select
                value={defaultProctorsPerHall}
                onChange={(e) => setDefaultProctorsPerHall(Number(e.target.value))}
                className="w-full text-xs font-bold rounded-xl border border-slate-600 p-2 bg-[#091021] text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value={1}>حارس واحد لكل قاعة (1)</option>
                <option value={2}>حارسان لكل قاعة (2 - افتراضي)</option>
                <option value={3}>ثلاثة حراس لكل قاعة (3)</option>
              </select>
            </div>

            <div className="bg-[#182643] p-3.5 rounded-2xl border border-slate-700 space-y-1">
              <label className="text-xs font-bold text-amber-300 block">حراس الاحتياط لكل فترة (صباح/مساء):</label>
              <select
                value={reserveProctorsPerPeriod}
                onChange={(e) => setReserveProctorsPerPeriod(Number(e.target.value))}
                className="w-full text-xs font-bold rounded-xl border border-slate-600 p-2 bg-[#091021] text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value={0}>بدون حراس احتياط (0)</option>
                <option value={1}>حارس احتياط واحد (1 - موصى به)</option>
                <option value={2}>حارسان احتياط لكل فترة (2)</option>
                <option value={3}>ثلاثة حراس احتياط لكل فترة (3)</option>
              </select>
            </div>

            <label className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 bg-[#182643] ${
              maxOnePerDay ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-700'
            }`}>
              <input 
                type="checkbox"
                checked={maxOnePerDay}
                onChange={(e) => setMaxOnePerDay(e.target.checked)}
                className="w-4 h-4 text-sky-500 rounded border-slate-600 focus:ring-sky-500 mt-0.5 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold block text-white">فترة واحدة يومياً</span>
                <span className="text-[11px] text-slate-400 block">منع حراسة فترتين في نفس اليوم للأستاذ</span>
              </div>
            </label>

            <label className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 bg-[#182643] ${
              avoidSpecialty ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-700'
            }`}>
              <input 
                type="checkbox"
                checked={avoidSpecialty}
                onChange={(e) => setAvoidSpecialty(e.target.checked)}
                className="w-4 h-4 text-sky-500 rounded border-slate-600 focus:ring-sky-500 mt-0.5 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold block text-white">تجنب مادة التخصص</span>
                <span className="text-[11px] text-slate-400 block">عدم تكليف أستاذ الرياضيات بحراسة الرياضيات</span>
              </div>
            </label>

            <label className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 bg-[#182643] ${
              exemptOnOwnSubjectDay ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-700'
            }`}>
              <input 
                type="checkbox"
                checked={exemptOnOwnSubjectDay}
                onChange={(e) => setExemptOnOwnSubjectDay(e.target.checked)}
                className="w-4 h-4 text-sky-500 rounded border-slate-600 focus:ring-sky-500 mt-0.5 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold block text-white">إعفاء فترة امتحان المادة</span>
                <span className="text-[11px] text-slate-400 block">إعفاء تام للأستاذ أثناء امتحان مادته لمرافقة تلاميذه</span>
              </div>
            </label>

            <label className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 bg-[#182643] ${
              oneDayOff ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-700'
            }`}>
              <input 
                type="checkbox"
                checked={oneDayOff}
                onChange={(e) => setOneDayOff(e.target.checked)}
                className="w-4 h-4 text-sky-500 rounded border-slate-600 focus:ring-sky-500 mt-0.5 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold block text-white">يوم راحة للأستاذ</span>
                <span className="text-[11px] text-slate-400 block">منح الأستاذ يوماً واحداً بدون حراسة إن أمكن</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Dedicated Imported Teachers & Exemptions Panel (خانة قائمة الأساتذة المستوردة وإدارة الإعفاءات) */}
      {showTeachersSection && (
        <div className="bg-[#121E36] p-5 rounded-3xl border border-cyan-500/30 shadow-xl space-y-4 print:hidden animate-in fade-in duration-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#0099FF]/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <Users size={20} />
              </div>
              <div>
                <h4 className="font-black text-base text-white flex items-center gap-2 flex-wrap">
                  <span>خانة قائمة الأساتذة المستوردة وإدارة الإعفاءات</span>
                  <span className="text-[11px] bg-[#0099FF]/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    الإجمالي: {teachers.length}
                  </span>
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    متاح للحراسة: {teachers.filter(t => !t.isExempt).length}
                  </span>
                  <span className="text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    معفى: {teachers.filter(t => t.isExempt).length}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  تُعرض هنا قائمة الأساتذة المدرجة تلقائياً مع إمكانية تحديد الأستاذ <strong className="text-rose-300">المعفى</strong> (غائب أو لديه حجة) لاستثنائه من التوزيع والاستدعاءات.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {teachers.some(t => isDemoTeacher(t)) && (
                <button
                  onClick={handleClearDemoTeachers}
                  className="flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>حذف التجريبيين</span>
                </button>
              )}

              {teachers.length > 0 && (
                <button
                  onClick={handleClearAllTeachers}
                  className="flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>مسح القائمة</span>
                </button>
              )}

              <label className="flex items-center gap-1.5 bg-[#0099FF] hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md">
                <FileUp size={14} />
                <span>استيراد إكسل جديد</span>
                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleTeacherFileUpload} />
              </label>

              <button
                onClick={() => setShowTeacherListModal(true)}
                className="flex items-center gap-1.5 bg-[#182643] hover:bg-[#1f3054] text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="فتح في نافذة مكبرة"
              >
                <Eye size={14} />
                <span>تكبير</span>
              </button>

              <button
                onClick={() => setShowTeachersSection(false)}
                className="flex items-center gap-1 bg-[#091021] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="طي الخانة"
              >
                <ChevronUp size={15} />
                <span>إخفاء</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs & Search inside Dedicated Teachers Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="بحث في قائمة الأساتذة (الاسم، التخصص، الرقم، سبب الإعفاء)..."
                value={teacherSectionSearch}
                onChange={(e) => setTeacherSectionSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-[#091021] border border-slate-700/80 rounded-xl text-white outline-none focus:border-cyan-400 text-xs font-bold"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#091021] p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
              <button
                onClick={() => setTeacherSectionFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  teacherSectionFilter === 'all' ? 'bg-[#0099FF] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                الكل ({teachers.length})
              </button>
              <button
                onClick={() => setTeacherSectionFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  teacherSectionFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                متاح ({teachers.filter(t => !t.isExempt).length})
              </button>
              <button
                onClick={() => setTeacherSectionFilter('exempt')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  teacherSectionFilter === 'exempt' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                معفى ({teachers.filter(t => t.isExempt).length})
              </button>
            </div>
          </div>

          {/* Dedicated Teachers Table */}
          {(() => {
            const q = teacherSectionSearch.trim().toLowerCase();
            const list = teachers.filter(t => {
              if (teacherSectionFilter === 'active' && t.isExempt) return false;
              if (teacherSectionFilter === 'exempt' && !t.isExempt) return false;
              if (!q) return true;
              return (
                t.name.toLowerCase().includes(q) ||
                t.specialty.toLowerCase().includes(q) ||
                (t.id && String(t.id).toLowerCase().includes(q)) ||
                (t.exemptReason && t.exemptReason.toLowerCase().includes(q))
              );
            });

            if (list.length === 0) {
              return (
                <div className="p-8 text-center bg-[#091021]/60 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                  <Users size={34} className="mx-auto text-slate-500 opacity-60" />
                  <p className="text-sm font-bold text-slate-300">
                    {teachers.length === 0
                      ? 'لا يوجد أساتذة مدرجون حالياً — اضغط على "استيراد إكسل جديد" لإدراج القائمة'
                      : 'لا توجد نتائج مطابقة للبحث أو الفلتر المحدد'}
                  </p>
                </div>
              );
            }

            return (
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-[#091021]/70">
                <div className="max-h-[420px] overflow-auto custom-scrollbar">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-[#182643] border-b border-slate-700 text-slate-300">
                      <tr>
                        <th className="p-3 w-12 text-center font-black">
                          {(() => {
                            const selectableVisible = list.filter(
                              t => t.id && !t.isExempt && (realTeachers.length === 0 || !isDemoTeacher(t))
                            );
                            const allSelected =
                              selectableVisible.length > 0 &&
                              selectableVisible.every(t => selectedTeacherIds.includes(String(t.id)));
                            return (
                              <input
                                type="checkbox"
                                checked={allSelected}
                                disabled={selectableVisible.length === 0}
                                onChange={(e) => {
                                  const ids = selectableVisible.map(t => String(t.id));
                                  if (e.target.checked) {
                                    setSelectedTeacherIds(prev => Array.from(new Set([...prev, ...ids])));
                                  } else {
                                    setSelectedTeacherIds(prev => prev.filter(id => !ids.includes(id)));
                                  }
                                }}
                                title="تحديد / إلغاء تحديد الأساتذة الظاهرين للتوليد"
                                className="w-4 h-4 text-sky-500 rounded border-slate-500 focus:ring-sky-500 cursor-pointer"
                              />
                            );
                          })()}
                        </th>
                        <th className="p-3 w-12 text-center font-black">#</th>
                        <th className="p-3 font-black">المعرف / الرقم</th>
                        <th className="p-3 font-black">اسم ولقب الأستاذ</th>
                        <th className="p-3 font-black">المادة / التخصص</th>
                        <th className="p-3 text-center font-black">الأقدمية</th>
                        <th className="p-3 font-black">الحالة في الحراسة</th>
                        <th className="p-3 text-left font-black">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {list.map((t, idx) => {
                        const isDemo = isDemoTeacher(t);
                        const canSelect = Boolean(t.id && !t.isExempt && (realTeachers.length === 0 || !isDemo));
                        const isSelectedForGen = Boolean(t.id && canSelect && selectedTeacherIds.includes(String(t.id)));
                        return (
                          <tr
                            key={t.id || idx}
                            className={`transition-colors ${
                              t.isExempt
                                ? 'bg-rose-950/20 hover:bg-rose-950/30'
                                : isDemo
                                ? 'bg-amber-950/10 hover:bg-[#182643]/60'
                                : isSelectedForGen
                                ? 'bg-[#0099FF]/5 hover:bg-[#182643]/60'
                                : 'opacity-70 hover:bg-[#182643]/60'
                            }`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelectedForGen}
                                disabled={!canSelect}
                                onChange={(e) => {
                                  if (!t.id || !canSelect) return;
                                  const id = String(t.id);
                                  setSelectedTeacherIds(prev =>
                                    e.target.checked
                                      ? Array.from(new Set([...prev, id]))
                                      : prev.filter(x => x !== id)
                                  );
                                }}
                                title={
                                  t.isExempt
                                    ? 'أستاذ معفى — مستبعد من التوليد'
                                    : !canSelect
                                    ? 'بيانات تجريبية مستبعدة لوجود أساتذة رسميين'
                                    : 'مشاركة الأستاذ في توليد الحراسة'
                                }
                                className="w-4 h-4 text-sky-500 rounded border-slate-600 focus:ring-sky-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              />
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-400 bg-slate-950/40">{idx + 1}</td>
                            <td className="p-3 font-mono text-cyan-400 font-bold">{t.id || '-'}</td>
                            <td className="p-3 font-black text-white">
                              <span className={t.isExempt ? 'line-through text-slate-400' : ''}>{t.name}</span>
                              {isDemo && (
                                <span className="mr-2 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                                  بيانات تجريبية
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="bg-[#0099FF]/15 text-cyan-300 border border-cyan-500/30 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                                {t.specialty}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-300">{t.seniority || 0}</td>
                            <td className="p-3">
                              {t.isExempt ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-black text-[11px]">
                                    <Ban size={12} />
                                    معفى
                                  </span>
                                  <span className="text-[11px] text-rose-200/90 font-bold">
                                    ({t.exemptReason || 'غائب / لديه حجة'})
                                  </span>
                                </div>
                              ) : isSelectedForGen ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                                  <CheckCircle2 size={12} />
                                  محدد للتوليد
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                                  غير محدد للتوليد
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-left">
                              <div className="flex items-center justify-end gap-1.5">
                                {t.isExempt ? (
                                  <button
                                    onClick={() => handleToggleTeacherExemption(t, false)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] transition-all cursor-pointer"
                                    title="إلغاء الإعفاء وإعادته للحراسة"
                                  >
                                    <UserCheck size={13} />
                                    <span>إلغاء الإعفاء</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setExemptTargetTeacher(t);
                                      setExemptReasonInput(t.exemptReason || 'غائب');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-[11px] transition-all cursor-pointer"
                                    title="تحديد الأستاذ كمعفى بسبب الغياب أو وجود حجة"
                                  >
                                    <UserX size={13} />
                                    <span>إعفاء</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteTeacherFromAllocation(t.id!)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                  title="حذف الأستاذ"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Generation Scope Selector Card (اختيار السنوات والأساتذة المعنيين بالتوليد حسب الفصل المختار) */}
      <div className="bg-[#121E36] p-4 lg:p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <CheckSquare size={17} />
            </div>
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                <span>تخصيص نطاق توليد الحراسة</span>
                <span className="text-[11px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  {selectedTerm}
                </span>
                <span className="text-[11px] text-cyan-300 font-bold">
                  {isThirdTerm ? '• السنة الثالثة = البكالوريا التجريبي' : '• اختبارات السنوات 1 و 2 و 3'}
                </span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                اختر اختبارات السنوات المعنية والأساتذة المشاركين ليتم توليد التوزيع على هذا الأساس
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="px-3 py-1 rounded-xl bg-[#091021] border border-slate-700 text-slate-300">
              الاختبارات المختارة: <strong className="text-cyan-300">{selectedExamsForGen.length}</strong>
            </span>
            <span className="px-3 py-1 rounded-xl bg-[#091021] border border-slate-700 text-slate-300">
              الأساتذة المختارون: <strong className="text-emerald-300">{selectedTeachersForGen.length}</strong> / {availableTeachers.length}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Exam Years Selection */}
          <div className="lg:col-span-7 bg-[#091021]/70 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black text-slate-200">1. اختبارات السنوات المعنية بالتوليد:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setGenerationLevels(['first', 'second', 'third'])}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#182643] hover:bg-[#1f3054] text-cyan-300 border border-slate-700 cursor-pointer"
                >
                  كل السنوات
                </button>
                {isThirdTerm && (
                  <>
                    <button
                      type="button"
                      onClick={() => setGenerationLevels(['first', 'second'])}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#182643] hover:bg-[#1f3054] text-sky-300 border border-slate-700 cursor-pointer"
                    >
                      1 و 2 ثا فقط
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenerationLevels(['third'])}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#182643] hover:bg-[#1f3054] text-purple-300 border border-slate-700 cursor-pointer"
                    >
                      التجريبي فقط
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                {
                  key: 'first' as GradeLevelKey,
                  title: 'السنة الأولى (1 ثا)',
                  subtitle: `اختبارات ${selectedTerm}`,
                  count: getExamCountForLevel('first')
                },
                {
                  key: 'second' as GradeLevelKey,
                  title: 'السنة الثانية (2 ثا)',
                  subtitle: `اختبارات ${selectedTerm}`,
                  count: getExamCountForLevel('second')
                },
                {
                  key: 'third' as GradeLevelKey,
                  title: 'السنة الثالثة (3 ثا)',
                  subtitle: isThirdTerm ? 'امتحان البكالوريا التجريبي' : `اختبارات ${selectedTerm}`,
                  count: getExamCountForLevel('third')
                }
              ]).map((item) => {
                const isChecked = generationLevels.includes(item.key);
                const isBacCard = item.key === 'third' && isThirdTerm;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleGenerationLevel(item.key)}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      isChecked
                        ? isBacCard
                          ? 'bg-purple-600/20 border-purple-400 text-white shadow-sm'
                          : 'bg-[#0099FF]/20 border-cyan-400 text-white shadow-sm'
                        : 'bg-[#121E36] border-slate-700/80 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border text-[10px] font-black ${
                          isChecked
                            ? isBacCard
                              ? 'bg-purple-500 border-purple-400 text-white'
                              : 'bg-[#0099FF] border-cyan-400 text-white'
                            : 'border-slate-600 bg-[#091021]'
                        }`}
                      >
                        {isChecked ? '✓' : ''}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate">{item.title}</div>
                        <div className={`text-[10px] truncate ${isBacCard ? 'text-purple-300 font-bold' : 'text-slate-400'}`}>
                          {item.subtitle}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      isChecked ? 'bg-white/15 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Teachers Selection Controls */}
          <div className="lg:col-span-5 bg-[#091021]/70 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-200">2. الأساتذة المعنيون بالحراسة:</span>
              {teachers.filter(t => t.isExempt).length > 0 && (
                <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                  {teachers.filter(t => t.isExempt).length} معفى مستبعد تلقائياً
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedTeacherIds(availableTeachers.filter(t => t.id).map(t => String(t.id)))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                <UserCheck size={14} />
                <span>تحديد كل المتاحين ({availableTeachers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTeacherIds([])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                <X size={14} />
                <span>إلغاء التحديد</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowTeachersSection(true);
                  setTeacherSectionFilter('active');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0099FF]/20 hover:bg-[#0099FF]/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                <Users size={14} />
                <span>انتقاء من القائمة</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Control Toolbar: Term-Aware Cohort Tabs, View Mode, Search & Filters */}
      <div className="bg-[#121E36] p-4 lg:p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-4 print:hidden">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          {/* Cohort Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-[#091021] rounded-2xl flex-wrap border border-slate-800">
            {!isThirdTerm ? (
              <>
                <button
                  onClick={() => setActiveSession('all')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs lg:text-sm transition-all cursor-pointer ${
                    activeSession === 'all'
                      ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <BookOpen size={15} className={activeSession === 'all' ? 'text-white' : 'text-slate-400'} />
                  <span>📘 اختبارات {selectedTerm} (السنوات 1 و 2 و 3)</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeSession === 'all' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {exams.length} اختبار
                  </span>
                </button>

                <button
                  onClick={() => setActiveSession('first')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs lg:text-sm transition-all cursor-pointer ${
                    activeSession === 'first'
                      ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar size={14} />
                  <span>السنة الأولى (1 ثا)</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeSession === 'first' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {firstExams.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveSession('second')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs lg:text-sm transition-all cursor-pointer ${
                    activeSession === 'second'
                      ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar size={14} />
                  <span>السنة الثانية (2 ثا)</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeSession === 'second' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {secondExams.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveSession('third')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs lg:text-sm transition-all cursor-pointer ${
                    activeSession === 'third'
                      ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar size={14} />
                  <span>السنة الثالثة (3 ثا)</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeSession === 'third' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {thirdExams.length}
                  </span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveSession('first_second')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs lg:text-sm transition-all cursor-pointer ${
                    activeSession === 'first_second'
                      ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar size={15} className={activeSession === 'first_second' ? 'text-white' : 'text-slate-400'} />
                  <span>📘 اختبارات {selectedTerm} (السنوات 1 و 2)</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeSession === 'first_second' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {firstSecondExams.length} اختبار
                  </span>
                </button>

                <button
                  onClick={() => setActiveSession('third')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs lg:text-sm transition-all cursor-pointer ${
                    activeSession === 'third'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar size={15} className={activeSession === 'third' ? 'text-white' : 'text-slate-400'} />
                  <span>🎓 امتحان البكالوريا التجريبي (السنة 3)</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeSession === 'third' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {thirdExams.length} اختبار
                  </span>
                </button>

                {(activeSession === 'first' || activeSession === 'second') && (
                  <>
                    <button
                      onClick={() => setActiveSession('first')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeSession === 'first' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>1 ثا ({firstExams.length})</span>
                    </button>
                    <button
                      onClick={() => setActiveSession('second')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeSession === 'second' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>2 ثا ({secondExams.length})</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => setActiveSession('all')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs lg:text-sm transition-all cursor-pointer ${
                    activeSession === 'all'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <BookOpen size={15} className={activeSession === 'all' ? 'text-cyan-400' : 'text-slate-400'} />
                  <span>شامل (كلا الطورين)</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeSession === 'all' ? 'bg-[#0099FF]/20 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                    {exams.length}
                  </span>
                </button>
              </>
            )}
          </div>

          {/* View Format Switcher */}
          <div className="flex items-center gap-1 bg-[#091021] p-1.5 rounded-2xl border border-slate-800 flex-wrap self-start lg:self-auto">
            <span className="text-xs font-bold text-slate-400 ml-1">نمط العرض:</span>
            
            <button
              onClick={() => setViewFormat('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewFormat === 'grid' ? 'bg-[#0099FF] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={14} />
              <span>بطاقات الأساتذة</span>
            </button>

            <button
              onClick={() => setViewFormat('master_grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewFormat === 'master_grid' ? 'bg-[#0099FF] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers size={14} />
              <span>الجدول العام الملون</span>
            </button>

            <button
              onClick={() => setViewFormat('halls_matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewFormat === 'halls_matrix' ? 'bg-[#0099FF] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <DoorOpen size={14} />
              <span>جدول القاعات</span>
            </button>

            <button
              onClick={() => setViewFormat('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewFormat === 'table' ? 'bg-[#0099FF] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table size={14} />
              <span>قائمة التكليفات</span>
            </button>
          </div>
        </div>

        {/* Search & Assigned Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3.5 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="البحث باسم الأستاذ أو مادة التخصص..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 text-xs lg:text-sm bg-[#091021] border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-white placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer bg-[#091021] border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-[#182643] transition-colors">
              <input
                type="checkbox"
                checked={filterAssignedOnly}
                onChange={(e) => setFilterAssignedOnly(e.target.checked)}
                className="w-4 h-4 text-sky-500 rounded border-slate-600 focus:ring-sky-500"
              />
              <Filter size={14} className="text-slate-400" />
              <span>إظهار الأساتذة المكلفين فقط ({totalAssignedInActiveView} من {teachers.length})</span>
            </label>
          </div>
        </div>
      </div>

      {/* Main Print Modal */}
      {showPrintModal && createPortal(
        <div className="fixed inset-0 z-[99990] flex items-center justify-center p-2 sm:p-5 bg-black/70 backdrop-blur-md print:hidden">
          <div className="bg-[#121E36] rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-slate-800 text-slate-100">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center shrink-0 bg-[#091021]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#0099FF] text-white flex items-center justify-center shadow-lg shadow-sky-500/20">
                  <Printer size={22} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                    مركز طباعة وثائق الحراسة المعتمدة (Hirasa Pro v4)
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                    اختر نوع الوثيقة الإدارية المراد طباعتها فوراً
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95 shrink-0"
                title="إغلاق والعودة للتطبيق"
                aria-label="إغلاق والعودة للتطبيق"
              >
                <X size={20} />
              </button>
            </div>

            {/* Document Types Tabs Selection */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#091021]/80 p-3 border-b border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setDocType('convocations')}
                className={`p-3 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                  docType === 'convocations'
                    ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/30'
                    : 'bg-[#182643] text-slate-400 hover:text-white'
                }`}
              >
                <FileText size={18} />
                <span>1. استدعاءات الأساتذة</span>
                <span className="text-[10px] opacity-80 font-normal">4 بالورقة (A4)</span>
              </button>

              <button
                type="button"
                onClick={() => setDocType('halls')}
                className={`p-3 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                  docType === 'halls'
                    ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/30'
                    : 'bg-[#182643] text-slate-400 hover:text-white'
                }`}
              >
                <DoorOpen size={18} />
                <span>2. جدول القاعات</span>
                <span className="text-[10px] opacity-80 font-normal">عرض أفقي (A4)</span>
              </button>

              <button
                type="button"
                onClick={() => setDocType('master')}
                className={`p-3 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                  docType === 'master'
                    ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/30'
                    : 'bg-[#182643] text-slate-400 hover:text-white'
                }`}
              >
                <Layers size={18} />
                <span>3. الجدول الملون العام</span>
                <span className="text-[10px] opacity-80 font-normal">شبكي (A4)</span>
              </button>

              <button
                type="button"
                onClick={() => setDocType('daily_sign')}
                className={`p-3 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                  docType === 'daily_sign'
                    ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/30'
                    : 'bg-[#182643] text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck size={18} />
                <span>4. محضر الإمضاء اليومي</span>
                <span className="text-[10px] opacity-80 font-normal">كشف التوقيعات</span>
              </button>
            </div>
            
            {/* Modal Body */}
            <div ref={modalBodyRef} className="p-5 overflow-y-auto flex-1 min-h-0 text-sm space-y-4 bg-[#121E36]">
              {/* Centralized Institution Information Status Bar */}
              <div className="bg-[#182643] border border-cyan-500/30 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">المؤسسة التعليمية:</span>
                  <span className="font-extrabold text-white">{institutionName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">مديرية التربية لولاية:</span>
                  <span className="font-extrabold text-white">{wilaya}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">الموسم:</span>
                  <span className="font-mono font-extrabold text-cyan-300">{schoolYear}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">الفصل:</span>
                  <span className="font-extrabold text-amber-300">{selectedTerm}</span>
                </div>
              </div>

              {/* Specific Options based on document type */}
              {docType === 'convocations' && (
                <div className="bg-[#182643] border border-slate-700 p-3.5 rounded-2xl space-y-2">
                  <span className="text-xs font-bold text-cyan-300 block">تأكيد خيارات استدعاءات الأساتذة:</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input 
                      type="checkbox"
                      checked={printOnlyAssigned}
                      onChange={(e) => setPrintOnlyAssigned(e.target.checked)}
                      className="w-4 h-4 text-sky-500 rounded border-slate-600 focus:ring-sky-500"
                    />
                    <span>طباعة الأساتذة المكلفين فقط ({printCards.length} استدعاء / {Math.ceil(printCards.length / 4)} صفحة A4)</span>
                  </label>
                </div>
              )}

              {docType === 'daily_sign' && (
                <div className="bg-[#182643] border border-slate-700 p-3.5 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-purple-300 block">اختر مادة الاختبار لطباعة محضر إمضاء حراسها:</label>
                  <select
                    value={selectedExamForSign}
                    onChange={(e) => setSelectedExamForSign(e.target.value)}
                    className="w-full text-xs font-bold rounded-xl border border-slate-700 p-2.5 bg-[#091021] text-white"
                  >
                    {activeExams.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.subject} - {getArabicDayName(ex.date)} {ex.date} ({ex.period === 'morning' ? 'صباح' : 'مساء'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Sticky Modal Footer */}
            <div className="p-4 bg-[#091021] flex justify-between items-center rounded-b-3xl shrink-0 border-t border-slate-800">
              <button 
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-xl font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-xs"
              >
                إلغاء
              </button>
              <button 
                onClick={executePrint}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl font-black bg-[#0099FF] hover:bg-sky-600 text-white transition-all shadow-lg shadow-sky-500/30 text-xs active:scale-95 cursor-pointer"
              >
                <Printer size={16} />
                <span>بدء الطباعة المباشرة الآن</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Replacement / Swap Modal */}
      {/* Detailed Cell Adjustment Modal: Swap, Hall/Reserve Change, Unassign */}
      {cellTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md print:hidden animate-in fade-in duration-200">
          <div className="bg-[#121E36] rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-700 text-slate-100">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-[#091021]">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-md ${
                  cellTarget.isReserve ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-[#0099FF]/20 text-cyan-300 border border-cyan-500/30'
                }`}>
                  {cellTarget.isReserve ? <ShieldCheck size={20} /> : <DoorOpen size={20} />}
                </div>
                <div>
                  <h3 className="font-black text-base text-white">ضبط وتعديل تكليف الحراسة (Hirasa Pro)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {cellTarget.exam.subject} | {getArabicDayName(cellTarget.exam.date)} {cellTarget.exam.date} ({cellTarget.exam.period === 'morning' ? 'صباح' : 'مساء'})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setCellTarget(null)} 
                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs bg-[#121E36] flex-1">
              {/* Current assignment summary card */}
              <div className="bg-[#182643] p-4 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">الأستاذ المكلف حالياً:</span>
                  <span className="text-sm font-black text-white">{cellTarget.teacher.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">التخصص:</span>
                  <span className="text-cyan-300 font-bold">{cellTarget.teacher.specialty}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-700/60">
                  <span className="text-slate-400 font-bold">المهمة المسندة:</span>
                  <span className={`px-2.5 py-1 rounded-xl font-black ${
                    cellTarget.isReserve ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {cellTarget.isReserve ? '🛡️ حارس احتياط' : (cellTarget.hall?.name ? (cellTarget.hall.name.includes('قاعة') ? cellTarget.hall.name : `قاعة ${cellTarget.hall.name}`) : 'قاعة غير محددة')}
                  </span>
                </div>
              </div>

              {/* Action 1: Change Hall or Set Reserve */}
              <div className="bg-[#182643] p-4 rounded-2xl border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">تغيير القاعة أو المهمة:</span>
                  <button
                    onClick={() => handleChangeHall(cellTarget.isReserve ? (halls[0]?.id || 'hall_1') : 'reserve')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all border cursor-pointer ${
                      cellTarget.isReserve 
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30' 
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    }`}
                  >
                    {cellTarget.isReserve ? '🏫 نقل إلى قاعة امتحان' : '🛡️ تحويل إلى حارس احتياط'}
                  </button>
                </div>

                {!cellTarget.isReserve && (
                  <div className="flex items-center gap-2">
                    <label className="text-slate-400 whitespace-nowrap font-bold">اختر قاعة أخرى:</label>
                    <select
                      value={cellTarget.assignment.hallId}
                      onChange={(e) => handleChangeHall(e.target.value)}
                      className="flex-1 bg-[#091021] border border-slate-600 rounded-xl p-2 text-white font-bold"
                    >
                      {halls.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.name.includes('قاعة') ? h.name : `قاعة ${h.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Action 2: Swap with another available teacher */}
              <div className="bg-[#182643] p-4 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="font-bold text-slate-200 flex items-center justify-between">
                  <span>استبدال بأستاذ متاح آخر (غير مشغول في هذه الفترة):</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {teachers.filter(t => {
                    if (t.id === cellTarget.teacher.id || t.isExempt) return false;
                    const targetTimeRange = resolveExamEffectiveTimeRange(cellTarget.exam, systemSettings);
                    const isBusy = assignments.some(a => {
                      if (a.teacherId !== t.id || a.date !== cellTarget.exam.date || a.period !== cellTarget.exam.period) return false;
                      if (!systemSettings?.separateLevelTimings) return true;
                      const assignedEx = exams.find(e => String(e.id) === String(a.examId));
                      const assignedTime = resolveExamEffectiveTimeRange(assignedEx, systemSettings);
                      return doTimeRangesOverlap(assignedTime, targetTimeRange);
                    });
                    return !isBusy;
                  }).map(candidate => {
                    const candidateAssignments = assignments.filter(a => String(a.teacherId) === String(candidate.id));
                    const isSameSub = candidate.specialty === cellTarget.exam.subject || cellTarget.exam.subject.includes(candidate.specialty);
                    return (
                      <div 
                        key={candidate.id}
                        onClick={() => handleSwapTeacher(String(candidate.id))}
                        className="p-2.5 bg-[#091021] border border-slate-700 rounded-xl hover:border-purple-500 hover:bg-purple-900/20 cursor-pointer transition-all flex justify-between items-center group"
                      >
                        <div>
                          <div className="font-bold text-white group-hover:text-cyan-300">{candidate.name}</div>
                          <div className="text-[11px] text-slate-400">
                            تخصص: {candidate.specialty}
                            {isSameSub && <span className="text-amber-400 mr-1.5">(نفس مادة الاختبار)</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-purple-300 bg-purple-500/20 px-2.5 py-1 rounded-xl border border-purple-500/30">
                            {candidateAssignments.length} حراسات
                          </span>
                          <span className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded-lg font-bold">
                            استبدال
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action 3: Delete / Unassign */}
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={handleDeleteAssignment}
                  className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-bold p-2 hover:bg-rose-500/10 rounded-xl transition-all border border-rose-500/30 cursor-pointer"
                >
                  <X size={15} />
                  <span>إلغاء التكليف وتفريغ الخانة</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-[#091021] border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setCellTarget(null)} 
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Assign Empty Cell Modal */}
      {assignEmptyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md print:hidden animate-in fade-in duration-200">
          <div className="bg-[#121E36] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-slate-700 text-slate-100">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-[#091021]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#0099FF]/20 text-cyan-300 flex items-center justify-center font-bold border border-cyan-500/30">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">إسناد تكليف حراسة جديد</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {assignEmptyTarget.exam.subject} | {getArabicDayName(assignEmptyTarget.date)} {assignEmptyTarget.date} ({assignEmptyTarget.period === 'morning' ? 'صباحي' : 'مسائي'})
                  </p>
                </div>
              </div>
              <button onClick={() => setAssignEmptyTarget(null)} className="text-slate-400 hover:text-white p-2 rounded-full cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs bg-[#121E36]">
              {/* Teacher Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">الأستاذ المراد تكليفه:</label>
                {assignEmptyTarget.teacher ? (
                  <div className="bg-[#182643] p-3 rounded-xl border border-slate-700 font-bold text-white flex justify-between items-center">
                    <span>{assignEmptyTarget.teacher.name}</span>
                    <span className="text-cyan-400 text-xs">({assignEmptyTarget.teacher.specialty})</span>
                  </div>
                ) : (
                  <select
                    value={selectedTeacherForAssign}
                    onChange={(e) => setSelectedTeacherForAssign(e.target.value)}
                    className="w-full bg-[#091021] border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                  >
                    <option value="">-- اختر أستاذاً متاحاً --</option>
                    {teachers.filter(t => {
                      if (t.isExempt) return false;
                      const targetTimeRange = resolveExamEffectiveTimeRange(assignEmptyTarget.exam, systemSettings);
                      const isBusy = assignments.some(a => {
                        if (a.teacherId !== t.id || a.date !== assignEmptyTarget.date || a.period !== assignEmptyTarget.period) return false;
                        if (!systemSettings?.separateLevelTimings) return true;
                        const assignedEx = exams.find(e => String(e.id) === String(a.examId));
                        const assignedTime = resolveExamEffectiveTimeRange(assignedEx, systemSettings);
                        return doTimeRangesOverlap(assignedTime, targetTimeRange);
                      });
                      return !isBusy;
                    }).map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.specialty})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Hall or Reserve Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">نوع التكليف أو القاعة المسندة:</label>
                {assignEmptyTarget.hall ? (
                  <div className="bg-[#182643] p-3 rounded-xl border border-slate-700 font-bold text-emerald-400">
                    {assignEmptyTarget.hall.name.includes('قاعة') ? assignEmptyTarget.hall.name : `قاعة ${assignEmptyTarget.hall.name}`}
                  </div>
                ) : (
                  <select
                    value={selectedHallForAssign}
                    onChange={(e) => setSelectedHallForAssign(e.target.value)}
                    className="w-full bg-[#091021] border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                  >
                    <option value="reserve">🛡️ حارس احتياط لهذه الفترة</option>
                    {halls.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name.includes('قاعة') ? h.name : `قاعة ${h.name}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="p-4 bg-[#091021] border-t border-slate-800 flex justify-between items-center">
              <button 
                onClick={() => setAssignEmptyTarget(null)} 
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  const tId = assignEmptyTarget.teacher ? String(assignEmptyTarget.teacher.id) : selectedTeacherForAssign;
                  const hId = assignEmptyTarget.hall ? String(assignEmptyTarget.hall.id) : selectedHallForAssign;
                  if (!tId) {
                    toast.error('يرجى تحديد الأستاذ');
                    return;
                  }
                  handleAssignEmpty(tId, hId);
                }}
                className="px-6 py-2.5 bg-[#0099FF] hover:bg-sky-600 text-white font-black rounded-xl text-xs shadow-lg shadow-sky-500/30 cursor-pointer"
              >
                تأكيد الإسناد الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fairness & Workload Metrics Ribbon */}
      {assignments.length > 0 && (
        <div className="bg-[#121E36] p-4 lg:p-5 rounded-3xl border border-slate-800 shadow-xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
          <div className="bg-[#182643] p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[11px] font-bold text-slate-400">إجمالي الأساتذة</div>
            <div className="text-xl font-black text-white mt-1 flex items-baseline gap-1">
              <span>{teachers.length}</span>
              <span className="text-[10px] text-slate-400 font-normal">أستاذ</span>
            </div>
          </div>

          <div className="bg-[#182643] p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[11px] font-bold text-slate-400">المكلفون بالحراسة</div>
            <div className="text-xl font-black text-emerald-400 mt-1 flex items-baseline gap-1">
              <span>{totalAssignedInActiveView}</span>
              <span className="text-[10px] text-emerald-300 font-normal">({coveragePercent}%)</span>
            </div>
          </div>

          <div className="bg-[#182643] p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[11px] font-bold text-slate-400">حراس القاعات</div>
            <div className="text-xl font-black text-cyan-400 mt-1 flex items-baseline gap-1">
              <span>{hallProctorsCount}</span>
              <span className="text-[10px] text-slate-400 font-normal">تكليف</span>
            </div>
          </div>

          <div className="bg-[#182643] p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[11px] font-bold text-slate-400">حراس الاحتياط</div>
            <div className="text-xl font-black text-amber-400 mt-1 flex items-baseline gap-1">
              <span>{reserveProctorsCount}</span>
              <span className="text-[10px] text-amber-300 font-normal">احتياط</span>
            </div>
          </div>

          <div className="bg-[#182643] p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[11px] font-bold text-slate-400">متوسط الحراسات</div>
            <div className="text-xl font-black text-purple-400 mt-1 flex items-baseline gap-1">
              <span>{avgSessions}</span>
              <span className="text-[10px] text-slate-400 font-normal">فترة / أستاذ</span>
            </div>
          </div>

          <div className="bg-[#182643] p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[11px] font-bold text-slate-400">مؤشر التكافؤ (Min / Max)</div>
            <div className="text-xl font-black text-white mt-1 flex items-baseline gap-1">
              <span className="text-sky-400">{minSessions}</span>
              <span className="text-slate-500 font-normal">/</span>
              <span className="text-purple-400">{maxSessions}</span>
              <span className="text-[10px] text-slate-400 font-normal">فترات</span>
            </div>
          </div>
        </div>
      )}

      {/* Screen Views: Cards, Master Grid, Hall Matrix, or Table */}
      <div className="space-y-4 print:hidden">
        {assignments.length === 0 && !loading && (
          <div className="p-10 lg:p-16 text-center bg-[#121E36] rounded-3xl border border-slate-800 shadow-xl mt-4">
            <div className="w-16 h-16 bg-[#0099FF]/20 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/30">
              <Wand2 size={30} />
            </div>
            <h4 className="text-lg font-bold text-white mb-1">لم يتم توليد أي جدول حراسة بعد</h4>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
              اضغط على زر "توليد التوزيع الذكي" لتوزيع حراسة جميع المواد وحراس الاحتياط على الأساتذة وفق الشروط المحددة.
            </p>
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 bg-[#0099FF] text-white px-6 py-2.5 rounded-2xl font-black shadow-lg shadow-sky-500/30 hover:bg-sky-600 transition-all text-sm cursor-pointer"
            >
              <Wand2 size={16} />
              توليد التوزيع الذكي الآن
            </button>
          </div>
        )}

        {/* 1. Grid of Teacher Cards (Hirasa Pro Card Style) */}
        {viewFormat === 'grid' && assignments.length > 0 && (
          <div className="space-y-4">
            {filteredTeachers.map((teacher) => {
              const assignedSubjectsActive = getTeacherEnrichedAssignments(String(teacher.id), activeSession);
              const totalHours = assignedSubjectsActive.reduce((sum, item) => sum + item.duration, 0);

              const sessionsToRender: SessionTab[] = [activeSession];

              return (
                <div 
                  key={teacher.id} 
                  className="bg-[#121E36] rounded-3xl border border-slate-800 shadow-xl p-5 lg:p-6 transition-all hover:border-slate-700 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#0099FF]/20 text-cyan-400 flex items-center justify-center font-bold text-sm border border-cyan-500/30">
                        <User size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base lg:text-lg font-bold text-white">{teacher.name}</h4>
                          <span className="text-xs px-2.5 py-0.5 rounded-xl bg-[#182643] text-slate-300 font-medium border border-slate-700">
                            {teacher.specialty}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {teacher.isExempt
                            ? `معفى من الحراسة (${teacher.exemptReason || 'غائب / لديه حجة'})`
                            : assignedSubjectsActive.length > 0 
                            ? `كُلّف بحراسة ${assignedSubjectsActive.length} فترة (${totalHours} ساعة إجمالاً)`
                            : 'غير مكلف بأي حراسة في هذا الطور'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {teacher.isExempt ? (
                        <>
                          <span className="text-xs px-3.5 py-1 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            معفى ({teacher.exemptReason || 'غائب / لديه حجة'})
                          </span>
                          <button
                            onClick={() => handleToggleTeacherExemption(teacher, false)}
                            className="text-xs px-3 py-1 rounded-xl font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
                          >
                            إلغاء الإعفاء
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`text-xs px-3.5 py-1 rounded-full font-bold ${
                            assignedSubjectsActive.length > 0 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {assignedSubjectsActive.length > 0 ? `${assignedSubjectsActive.length} حراسات مسندة` : 'غير مكلف في هذا الطور'}
                          </span>
                          <button
                            onClick={() => {
                              setExemptTargetTeacher(teacher);
                              setExemptReasonInput('غائب');
                            }}
                            className="text-xs px-3 py-1 rounded-xl font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
                            title="إعفاء الأستاذ بسبب الغياب أو وجود حجة"
                          >
                            إعفاء
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Matrix Table */}
                  <div className="space-y-4">
                    {sessionsToRender.map((sessionKey) => {
                      const weekDates = getWeekDatesForSession(sessionKey);
                      const sessionAssigned = getTeacherEnrichedAssignments(String(teacher.id), sessionKey);

                      return (
                        <div key={`${teacher.id}-${sessionKey}`} className="space-y-1.5 overflow-x-auto">
                          <table className="w-full text-center border-collapse border border-slate-800 text-xs">
                            <thead>
                              <tr className="bg-[#091021] text-slate-300 font-bold">
                                <th className="border border-slate-800 p-2.5 font-bold w-28">الفترة والتوقيت</th>
                                {weekDates.map((date) => (
                                  <th key={date} className="border border-slate-800 p-2 font-bold min-w-[120px]">
                                    <div className="text-sm font-bold text-white">{getArabicDayName(date)}</div>
                                    <div className="text-[11px] text-slate-400 font-normal mt-0.5 font-mono">{date}</div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {/* Morning Row */}
                              <tr className="hover:bg-[#182643]/50">
                                <td className="border border-slate-800 p-2 font-bold bg-[#091021] text-slate-300">
                                  <div>صباحي</div>
                                  <div className="text-[10px] font-mono text-cyan-300/90 mt-0.5 leading-snug" dir="auto">{displayMorningHeader}</div>
                                </td>
                                {weekDates.map(date => {
                                  const mornings = sessionAssigned.filter(a => a.date === date && a.period === 'morning');
                                  return (
                                    <td key={`screen-m-${date}`} className="border border-slate-800 p-2 h-16 align-middle">
                                      {mornings.length > 0 ? (
                                        <div className="flex flex-col gap-1 items-center">
                                          {mornings.map(m => {
                                            const exam = exams.find(e => String(e.id) === String(m.examId));
                                            const hall = halls.find(h => String(h.id) === String(m.hallId));
                                            const isReserve = m.hallId === 'reserve';
                                            return (
                                              <div 
                                                key={m.id}
                                                onClick={() => exam && setCellTarget({ assignment: m, teacher, exam, hall, isReserve })}
                                                className={`w-full p-2 rounded-xl border cursor-pointer transition-all group text-center ${
                                                  isReserve 
                                                    ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300' 
                                                    : 'bg-[#0099FF]/20 hover:bg-purple-600/30 border-sky-500/30 text-cyan-300'
                                                }`}
                                                title="انقر لتعديل التكليف، استبدال الأستاذ، أو تغيير القاعة والاحتياط"
                                              >
                                                <div className="font-extrabold text-[11px]">
                                                  {isReserve ? '🛡️ حارس احتياط' : m.hallName}
                                                </div>
                                                <div className="text-[11px] font-bold text-white">{m.subject}</div>
                                                {(systemSettings?.separateLevelTimings || mornings.length > 1) && (
                                                  <div className="text-[10px] font-mono font-bold text-cyan-200/90 mt-0.5" dir="ltr">
                                                    {m.timeRange} ({m.levelLabel})
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            const ex = activeExams.find(e => e.date === date && e.period === 'morning') || exams.find(e => e.date === date && e.period === 'morning');
                                            if (ex) {
                                              setAssignEmptyTarget({ exam: ex, date, period: 'morning', teacher });
                                            } else {
                                              toast.error('لا يوجد اختبار مبرمج في هذه الفترة');
                                            }
                                          }}
                                          className="text-slate-600 hover:text-cyan-400 hover:bg-[#182643] p-1.5 rounded-lg border border-transparent hover:border-slate-700 font-bold transition-all text-xs cursor-pointer"
                                          title="انقر لإسناد تكليف يدوي"
                                        >
                                          -
                                        </button>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* Afternoon Row */}
                              <tr className="hover:bg-[#182643]/50">
                                <td className="border border-slate-800 p-2 font-bold bg-[#091021] text-slate-300">
                                  <div>مسائي</div>
                                  <div className="text-[10px] font-mono text-purple-300/90 mt-0.5 leading-snug" dir="auto">{displayAfternoonHeader}</div>
                                </td>
                                {weekDates.map(date => {
                                  const afternoons = sessionAssigned.filter(a => a.date === date && a.period === 'afternoon');
                                  return (
                                    <td key={`screen-a-${date}`} className="border border-slate-800 p-2 h-16 align-middle">
                                      {afternoons.length > 0 ? (
                                        <div className="flex flex-col gap-1 items-center">
                                          {afternoons.map(af => {
                                            const exam = exams.find(e => String(e.id) === String(af.examId));
                                            const hall = halls.find(h => String(h.id) === String(af.hallId));
                                            const isReserve = af.hallId === 'reserve';
                                            return (
                                              <div 
                                                key={af.id}
                                                onClick={() => exam && setCellTarget({ assignment: af, teacher, exam, hall, isReserve })}
                                                className={`w-full p-2 rounded-xl border cursor-pointer transition-all group text-center ${
                                                  isReserve 
                                                    ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300' 
                                                    : 'bg-purple-500/20 hover:bg-purple-600/40 border-purple-500/30 text-purple-200'
                                                }`}
                                                title="انقر لتعديل التكليف، استبدال الأستاذ، أو تغيير القاعة والاحتياط"
                                              >
                                                <div className="font-extrabold text-[11px]">
                                                  {isReserve ? '🛡️ حارس احتياط' : af.hallName}
                                                </div>
                                                <div className="text-[11px] font-bold text-white">{af.subject}</div>
                                                {(systemSettings?.separateLevelTimings || afternoons.length > 1) && (
                                                  <div className="text-[10px] font-mono font-bold text-purple-200/90 mt-0.5" dir="ltr">
                                                    {af.timeRange} ({af.levelLabel})
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            const ex = activeExams.find(e => e.date === date && e.period === 'afternoon') || exams.find(e => e.date === date && e.period === 'afternoon');
                                            if (ex) {
                                              setAssignEmptyTarget({ exam: ex, date, period: 'afternoon', teacher });
                                            } else {
                                              toast.error('لا يوجد اختبار مبرمج في هذه الفترة');
                                            }
                                          }}
                                          className="text-slate-600 hover:text-cyan-400 hover:bg-[#182643] p-1.5 rounded-lg border border-transparent hover:border-slate-700 font-bold transition-all text-xs cursor-pointer"
                                          title="انقر لإسناد تكليف يدوي"
                                        >
                                          -
                                        </button>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. Color-Coded Master Timetable Grid */}
        {viewFormat === 'master_grid' && assignments.length > 0 && (
          <div className="bg-[#121E36] rounded-3xl border border-slate-800 shadow-xl p-5 overflow-x-auto space-y-3">
            <h4 className="font-bold text-base text-white">الجدول العام الملون لجميع الأساتذة مع إبراز حراس الاحتياط</h4>
            <table className="w-full text-center border-collapse border border-slate-800 text-xs">
              <thead>
                <tr className="bg-[#091021] text-slate-300 font-bold">
                  <th className="border border-slate-800 p-2 w-10">#</th>
                  <th className="border border-slate-800 p-2 text-right w-44">اسم ولقب الأستاذ</th>
                  <th className="border border-slate-800 p-2 text-right w-32">التخصص</th>
                  {activeExams.map(ex => (
                    <th key={ex.id} className="border border-slate-800 p-2 min-w-[115px]">
                      <div className="font-bold text-white">{ex.subject}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{ex.date} ({ex.period === 'morning' ? 'صباح' : 'مساء'})</div>
                      <div className="text-[10px] text-cyan-300 font-mono mt-0.5" dir="ltr">{resolveExamEffectiveTimeRange(ex, systemSettings)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-[#182643]">
                    <td className="border border-slate-800 p-2 font-bold bg-[#091021] text-slate-400">{idx + 1}</td>
                    <td className="border border-slate-800 p-2 text-right font-bold text-white">{t.name}</td>
                    <td className="border border-slate-800 p-2 text-right text-slate-400">{t.specialty}</td>
                    {activeExams.map(ex => {
                      const assign = assignments.find(a => String(a.teacherId) === String(t.id) && String(a.examId) === String(ex.id));
                      if (!assign) {
                        return (
                          <td key={ex.id} className="border border-slate-800 p-1 align-middle">
                            <button
                              onClick={() => setAssignEmptyTarget({ exam: ex, date: ex.date, period: ex.period, teacher: t })}
                              className="w-full p-1.5 rounded-xl text-slate-600 hover:text-cyan-400 hover:bg-[#182643] border border-transparent hover:border-slate-700 transition-all font-mono font-bold text-xs cursor-pointer"
                              title="انقر لإسناد هذا الأستاذ لحراسة هذا الاختبار"
                            >
                              -
                            </button>
                          </td>
                        );
                      }
                      
                      const isReserve = assign.hallId === 'reserve';
                      const hall = halls.find(h => String(h.id) === String(assign.hallId));
                      const hallName = isReserve 
                        ? '🛡️ احتياط' 
                        : (hall ? (hall.name.includes('قاعة') ? hall.name : `قاعة ${hall.name}`) : 'قاعة محذوفة');

                      return (
                        <td key={ex.id} className="border border-slate-800 p-1 align-middle">
                          <button
                            onClick={() => setCellTarget({ assignment: assign, teacher: t, exam: ex, hall, isReserve })}
                            className={`w-full p-1.5 rounded-xl font-bold text-[11px] transition-all border cursor-pointer ${
                              isReserve 
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30' 
                                : 'bg-[#0099FF]/20 text-cyan-300 border-cyan-500/30 hover:bg-purple-600/40'
                            }`}
                            title="اضغط للتعديل أو الاستبدال أو تغيير القاعة"
                          >
                            {hallName}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Halls Matrix View */}
        {viewFormat === 'halls_matrix' && assignments.length > 0 && (
          <div className="bg-[#121E36] rounded-3xl border border-slate-800 shadow-xl p-5 overflow-x-auto space-y-3">
            <h4 className="font-bold text-base text-white">جدول توزيع الأساتذة الحراس حسب القاعات وحراس الاحتياط</h4>
            <table className="w-full text-center border-collapse border border-slate-800 text-xs">
              <thead>
                <tr className="bg-[#091021] text-slate-300 font-bold">
                  <th className="border border-slate-800 p-2 w-36 bg-[#0d162d]">القاعة / الاختبار</th>
                  {activeExams.map(ex => (
                    <th key={ex.id} className="border border-slate-800 p-2 min-w-[140px]">
                      <div className="font-bold text-white">{ex.subject}</div>
                      <div className="text-[10px] text-slate-400">{getArabicDayName(ex.date)} {ex.date}</div>
                      <div className="text-[10px] text-cyan-300 font-mono mt-0.5" dir="ltr">{resolveExamEffectiveTimeRange(ex, systemSettings)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {halls.map(hall => (
                  <tr key={hall.id} className="hover:bg-[#182643]">
                    <td className="border border-slate-800 p-2 font-bold bg-[#091021] text-cyan-400">
                      {hall.name.includes('قاعة') ? hall.name : `قاعة ${hall.name}`}
                    </td>
                    {activeExams.map(ex => {
                      const hallAssigns = assignments.filter(a => String(a.hallId) === String(hall.id) && String(a.examId) === String(ex.id));
                      return (
                        <td key={ex.id} className="border border-slate-800 p-2 align-middle">
                          {hallAssigns.length > 0 ? (
                            <div className="space-y-1">
                              {hallAssigns.map(a => {
                                const t = teachers.find(teacher => String(teacher.id) === String(a.teacherId));
                                return (
                                  <div 
                                    key={a.id}
                                    onClick={() => t && setCellTarget({ assignment: a, teacher: t, exam: ex, hall, isReserve: false })}
                                    className="bg-[#182643] hover:bg-purple-900/40 text-slate-200 p-1.5 rounded-xl font-bold text-[11px] cursor-pointer transition-all border border-slate-700"
                                    title="اضغط للتعديل أو الاستبدال"
                                  >
                                    {t?.name || 'محذوف'}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssignEmptyTarget({ exam: ex, date: ex.date, period: ex.period, hall })}
                              className="text-slate-600 hover:text-cyan-400 hover:bg-[#182643] p-1.5 rounded-lg border border-transparent hover:border-slate-700 font-bold transition-all text-xs cursor-pointer"
                              title="إسناد حارس لهذه القاعة"
                            >
                              -
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Dedicated Reserve Proctors Row in Hall Matrix */}
                <tr className="bg-[#fef3c7]/5 border-t-2 border-amber-500/50">
                  <td className="border border-slate-800 p-2 font-bold bg-[#182643] text-amber-300">
                    🛡️ حراس الاحتياط
                  </td>
                  {activeExams.map(ex => {
                    const reserveAssigns = assignments.filter(a => a.hallId === 'reserve' && String(a.examId) === String(ex.id));
                    return (
                      <td key={ex.id} className="border border-slate-800 p-2 align-middle bg-amber-500/5">
                        <div className="space-y-1">
                          {reserveAssigns.map(a => {
                            const t = teachers.find(teacher => String(teacher.id) === String(a.teacherId));
                            return (
                              <div
                                key={a.id}
                                onClick={() => t && setCellTarget({ assignment: a, teacher: t, exam: ex, isReserve: true })}
                                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 p-1.5 rounded-xl font-bold text-[11px] cursor-pointer transition-all border border-amber-500/30 text-center"
                                title="حارس احتياط - اضغط للتعديل"
                              >
                                {t?.name || 'محذوف'}
                              </div>
                            );
                          })}
                          <button
                            onClick={() => setAssignEmptyTarget({ exam: ex, date: ex.date, period: ex.period, isReserve: true })}
                            className="w-full text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/20 p-1 rounded-lg border border-dashed border-amber-500/30 font-bold transition-all text-[10px] cursor-pointer"
                            title="إضافة أستاذ احتياط لهذه الفترة"
                          >
                            + احتياط
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Table List of Assignments */}
        {viewFormat === 'table' && assignments.length > 0 && (
          <div className="bg-[#121E36] rounded-3xl border border-slate-800 shadow-xl p-5 overflow-x-auto">
            <table className="w-full text-right text-xs lg:text-sm border-collapse">
              <thead>
                <tr className="bg-[#091021] text-slate-300 border-y border-slate-800">
                  <th className="p-3 font-bold text-center w-12">#</th>
                  <th className="p-3 font-bold">الأستاذ الحارس</th>
                  <th className="p-3 font-bold">التخصص</th>
                  <th className="p-3 font-bold">مادة الاختبار</th>
                  <th className="p-3 font-bold">اليوم والتاريخ</th>
                  <th className="p-3 font-bold">الفترة</th>
                  <th className="p-3 font-bold">المهمة / القاعة المسندة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {assignments.map((item, idx) => {
                  const teacher = teachers.find(t => String(t.id) === String(item.teacherId));
                  const exam = exams.find(e => String(e.id) === String(item.examId));
                  const isReserve = item.hallId === 'reserve';
                  const hall = halls.find(h => String(h.id) === String(item.hallId));

                  return (
                    <tr 
                      key={item.id || idx} 
                      onClick={() => teacher && exam && setCellTarget({ assignment: item, teacher, exam, hall, isReserve })}
                      className="hover:bg-[#182643] transition-colors cursor-pointer"
                      title="انقر لتعديل هذا التكليف"
                    >
                      <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-bold text-white">{teacher?.name || 'محذوف'}</td>
                      <td className="p-3 text-slate-400">{teacher?.specialty || 'غير محدد'}</td>
                      <td className="p-3 font-bold text-cyan-400">{exam?.subject || 'محذوف'}</td>
                      <td className="p-3 font-bold text-slate-200">{getArabicDayName(item.date)} ({item.date})</td>
                      <td className="p-3 text-slate-300">
                        <div>{item.period === 'morning' ? 'صباحي' : 'مسائي'}</div>
                        <div className="text-[11px] font-mono text-cyan-300" dir="ltr">
                          {exam ? resolveExamEffectiveTimeRange(exam, systemSettings) : (item.period === 'morning' ? displayMorningHeader : displayAfternoonHeader)}
                        </div>
                      </td>
                      <td className="p-3 font-bold">
                        {isReserve ? (
                          <span className="text-amber-400 flex items-center gap-1">
                            <ShieldCheck size={14} className="text-amber-400" />
                            حارس احتياط
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <DoorOpen size={14} className="text-emerald-400" />
                            {hall?.name ? (hall.name.includes('قاعة') ? hall.name : `قاعة ${hall.name}`) : 'محذوفة'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Print Preview Modal Overlay */}
      {showLivePrintPreview && previewHtmlContent && createPortal(
        <div className="fixed inset-0 z-[99990] bg-slate-950/95 backdrop-blur-lg flex flex-col animate-in fade-in duration-200">
          {/* Top Bar - Hidden during printing */}
          <div className="bg-[#091021] text-white p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-slate-800 flex flex-wrap justify-between items-center gap-3 print:hidden shrink-0 shadow-xl">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowLivePrintPreview(false)}
                className="w-10 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95 shrink-0"
                title="خروج من الطباعة والعودة إلى التطبيق"
                aria-label="خروج من الطباعة والعودة إلى التطبيق"
              >
                <X size={20} />
              </button>
              <div className="w-9 h-9 rounded-xl bg-[#0099FF] text-white flex items-center justify-center font-bold shadow-lg shadow-sky-500/20 shrink-0">
                <Printer size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">معاينة وطباعة الوثيقة الرسمية</h3>
                <p className="text-[11px] text-slate-400">يمكنك الطباعة فوراً أو تنزيل الوثيقة كملف PDF عالي الجودة بنقرة واحدة</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDirectPrintFromPreview}
                className="flex items-center gap-1.5 bg-[#0099FF] hover:bg-sky-600 text-white font-black px-4 py-2 rounded-xl text-xs transition-all shadow-lg shadow-sky-500/30 cursor-pointer active:scale-95"
              >
                <Printer size={16} />
                <span>🖨️ طباعة الآن (System Print)</span>
              </button>

              <button
                onClick={handleExportPDFFromPreview}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/30 cursor-pointer active:scale-95"
              >
                <Download size={16} />
                <span>📥 تنزيل كملف PDF مباشر</span>
              </button>

              <button
                onClick={handleDownloadHtmlFile}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 rounded-xl text-xs transition-all shadow-lg shadow-purple-500/30 cursor-pointer active:scale-95"
                title="تحميل وثيقة الطباعة الرسمية كملف إلكتروني مستقل"
              >
                <FileText size={16} />
                <span>📄 تنزيل الوثيقة كملف إلكتروني (.html)</span>
              </button>

              <button
                onClick={() => setShowLivePrintPreview(false)}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-2 rounded-xl text-xs transition-all shadow-lg shadow-rose-600/30 cursor-pointer active:scale-95"
                title="خروج وإغلاق نافذة المعاينة والطباعة"
              >
                <X size={18} />
                <span>خروج والعودة للتطبيق</span>
              </button>
            </div>
          </div>

          {/* Printable Document Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200 flex justify-center custom-scrollbar">
            <div
              id="allocation-print-document"
              dir="rtl"
              className="bg-white text-black shadow-2xl p-4 sm:p-6 rounded-lg w-full max-w-5xl my-auto print:shadow-none print:p-0 print:m-0 print:max-w-none"
              dangerouslySetInnerHTML={{ __html: extractPrintBodyHtml(previewHtmlContent) }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Print Specific CSS to isolate printable document on system window.print() */}
      <style>{`
        @media print {
          .print\\:hidden, nav, header, footer {
            display: none !important;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
          }
          #allocation-print-document {
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            }
        }
      `}</style>

      {/* Teacher Excel Import Modal */}
      <ExcelImportModal 
        isOpen={isTeacherImportModalOpen}
        onClose={() => { setIsTeacherImportModalOpen(false); setTeacherFileBuffer(null); }}
        fileBuffer={teacherFileBuffer}
        title="استيراد قائمة الأساتذة"
        expectedColumns={[
          { 
            key: 'num', 
            label: 'رقم الأستاذ / المعرف',
            aliases: ['رقم الأستاذ', 'رقم الاستاذ', 'رقم التسجيل', 'الرقم', 'رقم', 'رمز', 'معرف', 'id', 'num', 'code', 'number']
          },
          { 
            key: 'name', 
            label: 'الاسم واللقب الكامل', 
            required: true,
            aliases: ['الاسم واللقب', 'الاسم و اللقب', 'الاسم واللقب الكامل', 'الاسم الكامل', 'الأستاذ', 'اسم الأستاذ', 'أستاذ', 'اسم ولقب الأستاذ', 'اسم الأستاذ ولقبه', 'name', 'full name', 'teacher']
          },
          { 
            key: 'lastName', 
            label: 'اللقب (في حالة وجود عمود منفصل)',
            aliases: ['اللقب', 'لقب', 'لقب الأستاذ', 'last name', 'lastname', 'family name']
          },
          { 
            key: 'firstName', 
            label: 'الاسم (في حالة وجود عمود منفصل)',
            aliases: ['الاسم', 'اسم', 'اسم الأستاذ الشخصي', 'first name', 'firstname', 'given name']
          },
          { 
            key: 'specialty', 
            label: 'المادة / التخصص', 
            required: true,
            aliases: ['المادة التي يدرسها', 'المادة المدرّسة', 'المادة', 'التخصص', 'تخصص', 'تخصص الأستاذ', 'المادة التخصصية', 'المادة المبرمجة', 'مادة', 'تخصص الأستاد', 'specialty', 'subject']
          },
          { 
            key: 'seniority', 
            label: 'الأقدمية',
            aliases: ['الأقدمية', 'اقدمية', 'الدرجة', 'سنوات الخدمة', 'seniority']
          },
          { 
            key: 'exemptStatus', 
            label: 'الحالة / معفى (اختياري)',
            aliases: ['معفى', 'معفي', 'الحالة', 'الغياب', 'غائب', 'حالة', 'الإعفاء', 'exempt', 'status', 'absent']
          },
          { 
            key: 'exemptReason', 
            label: 'سبب الإعفاء / الحجة (اختياري)',
            aliases: ['السبب', 'سبب الإعفاء', 'سبب الغياب', 'الحجة', 'المبرر', 'مبرر', 'ملاحظات', 'ملاحظة', 'reason', 'note', 'excuse']
          }
        ]}
        onConfirm={handleConfirmTeacherImport}
      />

      {/* Teacher List Preview Modal (معاينة قائمة الأساتذة) */}
      {showTeacherListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
          <div className="bg-[#091021] border border-cyan-500/40 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-slate-100">
            
            {/* Modal Header */}
            <div className="p-4 bg-[#0099FF] flex items-center justify-between text-white shadow-md shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
                  <Users size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black leading-tight">معاينة وتدقيق قائمة الأساتذة المدرجة</h3>
                  <p className="text-xs text-sky-100 opacity-90 mt-0.5 font-bold">
                    إجمالي الأساتذة المعتمدين لحساب وتوزيع الحراسة: {teachers.length} أستاذ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTeacherListModal(false)}
                className="p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Controls Bar: Search & Actions */}
            <div className="p-4 bg-[#0D162A] border-b border-slate-800 flex flex-col gap-3 shrink-0">
              {teachers.some(t => isDemoTeacher(t)) && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-300 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={18} className="text-amber-400 shrink-0" />
                    <span>تنبيه: تحتوي القائمة على أساتذة مدرجين كبيانات تجريبية. سيتم استبعادهم تلقائياً عند استيراد قائمتكم الرسمية، أو يمكنكم حذفهم الآن.</span>
                  </div>
                  <button
                    onClick={handleClearDemoTeachers}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3.5 py-1.5 rounded-xl transition-all shadow-md shrink-0 cursor-pointer text-xs"
                  >
                    حذف الأساتذة التجريبيين
                  </button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="بحث عن أستاذ أو مادة تخصص..."
                    value={teacherSearchTerm}
                    onChange={(e) => setTeacherSearchTerm(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 bg-[#121E36] border border-slate-700/80 rounded-xl text-white outline-none focus:border-cyan-400 text-xs font-bold"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {teachers.some(t => isDemoTeacher(t)) && (
                    <button
                      onClick={handleClearDemoTeachers}
                      className="flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      title="حذف جميع الأساتذة التجريبيين فقط"
                    >
                      <Trash2 size={14} />
                      <span>حذف التجريبيين</span>
                    </button>
                  )}

                  {teachers.length > 0 && (
                    <button
                      onClick={handleClearAllTeachers}
                      className="flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      title="مسح كامل قائمة الأساتذة"
                    >
                      <Trash2 size={14} />
                      <span>مسح الكل</span>
                    </button>
                  )}

                  <label 
                    className="flex items-center justify-center gap-2 bg-[#0099FF] hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shrink-0"
                    title="استيراد قائمة الأساتذة من ملف إكسل واستبدال التجريبيين"
                  >
                    <FileUp size={15} />
                    <span>إضافة / استيراد إكسل</span>
                    <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleTeacherFileUpload} />
                  </label>
                </div>
              </div>
            </div>

            {/* Teachers Table View */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {teachers.filter(t => 
                t.name.toLowerCase().includes(teacherSearchTerm.toLowerCase()) || 
                t.specialty.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
                (t.id && t.id.toLowerCase().includes(teacherSearchTerm.toLowerCase()))
              ).length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-3">
                  <AlertCircle size={40} className="mx-auto text-amber-400 opacity-60" />
                  <p className="font-bold text-sm text-slate-300">لم يتم العثور على أساتذة مطابقة للبحث أو أن القائمة فارغة</p>
                  <p className="text-xs text-slate-400">يرجى الضغط على "إضافة / استيراد إكسل" لإدراج الأساتذة المعتمدين.</p>
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-[#121E36]">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#182643] border-b border-slate-700 text-slate-300">
                        <th className="p-3 w-12 text-center font-black">#</th>
                        <th className="p-3 font-black">المعرف / الرقم</th>
                        <th className="p-3 font-black">اسم ولقب الأستاذ</th>
                        <th className="p-3 font-black">المادة / التخصص</th>
                        <th className="p-3 text-center font-black">الأقدمية</th>
                        <th className="p-3 text-center font-black">ساعات الحراسة المسندة</th>
                        <th className="p-3 font-black">الحالة / الإعفاء</th>
                        <th className="p-3 text-left font-black">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {teachers
                        .filter(t => 
                          t.name.toLowerCase().includes(teacherSearchTerm.toLowerCase()) || 
                          t.specialty.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
                          (t.id && t.id.toLowerCase().includes(teacherSearchTerm.toLowerCase()))
                        )
                        .map((t, idx) => {
                          const isDemo = isDemoTeacher(t);
                          return (
                            <tr key={t.id || idx} className={`hover:bg-slate-800/50 transition-colors ${t.isExempt ? 'bg-rose-950/20' : isDemo ? 'bg-amber-950/10' : ''}`}>
                              <td className="p-3 text-center font-mono font-bold text-slate-400 bg-slate-900/50">{idx + 1}</td>
                              <td className="p-3 font-mono text-cyan-400 font-bold">{t.id || `-`}</td>
                              <td className="p-3 font-black text-white">
                                <span className={`align-middle ${t.isExempt ? 'line-through text-slate-400' : ''}`}>{t.name}</span>
                                {isDemo && (
                                  <span className="mr-2 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                                    بيانات تجريبية
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <span className="bg-[#0099FF]/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                                  {t.specialty}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-slate-300">{t.seniority || 0}</td>
                              <td className="p-3 text-center font-mono font-black text-emerald-400">
                                {t.totalHours || 0} س
                              </td>
                              <td className="p-3">
                                {t.isExempt ? (
                                  <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold text-[11px]">
                                    <Ban size={11} />
                                    معفى ({t.exemptReason || 'غائب / لديه حجة'})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold text-[11px]">
                                    متاح
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-left">
                                <div className="flex items-center justify-end gap-1.5">
                                  {t.isExempt ? (
                                    <button
                                      onClick={() => handleToggleTeacherExemption(t, false)}
                                      className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-[11px] cursor-pointer"
                                    >
                                      إلغاء الإعفاء
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setExemptTargetTeacher(t);
                                        setExemptReasonInput('غائب');
                                      }}
                                      className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-[11px] cursor-pointer"
                                    >
                                      إعفاء
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteTeacherFromAllocation(t.id!)}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                    title="حذف الأستاذ من القائمة"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#0D162A] border-t border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                <span>إجمالي الأساتذة: <strong className="text-cyan-400">{teachers.length}</strong></span>
                {teachers.some(t => isDemoTeacher(t)) && (
                  <span className="text-amber-400 font-bold">
                    (منهم {teachers.filter(t => isDemoTeacher(t)).length} تجريبي)
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowTeacherListModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Quick Teacher Exemption Modal */}
      {exemptTargetTeacher && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md print:hidden">
          <div className="bg-[#121E36] border border-rose-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100">
            <div className="p-4 bg-rose-600/20 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center">
                  <UserX size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm text-white">إعفاء أستاذ من الحراسة</h4>
                  <p className="text-xs text-rose-200 font-bold mt-0.5">{exemptTargetTeacher.name}</p>
                </div>
              </div>
              <button
                onClick={() => setExemptTargetTeacher(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed font-medium">
                عند تفعيل خاصية <strong className="text-rose-300">معفى</strong>، يتم استبعاد الأستاذ تلقائياً من جداول التوزيع الذكي ومن استدعاءات الطباعة وإزالة أي تكليفات حالية مسندة إليه.
              </p>

              <div className="space-y-2">
                <label className="block font-bold text-slate-200">اختر سبب الإعفاء السريع:</label>
                <div className="flex flex-wrap gap-1.5">
                  {['غائب', 'عطلة مرضية', 'لديه حجة / مبرر إداري', 'تكوين / تربص', 'إعفاء إداري'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setExemptReasonInput(preset)}
                      className={`px-3 py-1.5 rounded-xl border font-bold text-[11px] transition-all cursor-pointer ${
                        exemptReasonInput === preset
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-[#091021] text-slate-300 border-slate-700 hover:border-rose-400'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-200">أو اكتب السبب / الحجة بالتفصيل:</label>
                <input
                  type="text"
                  value={exemptReasonInput}
                  onChange={(e) => setExemptReasonInput(e.target.value)}
                  placeholder="مثال: عطلة مرضية من 10 إلى 15..."
                  className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl text-white outline-none focus:border-rose-400 text-xs font-bold"
                />
              </div>
            </div>

            <div className="p-4 bg-[#091021] border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setExemptTargetTeacher(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleToggleTeacherExemption(exemptTargetTeacher, true, exemptReasonInput)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <UserX size={15} />
                <span>تأكيد الإعفاء الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Assignments Confirmation Modal (replaces window.confirm blocked in iframes) */}
      {showClearAssignmentsConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md print:hidden">
          <div className="bg-[#121E36] border border-rose-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100">
            <div className="p-4 bg-rose-600/20 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm text-white">تأكيد تفريغ جدول الحراسة</h4>
                  <p className="text-xs text-rose-200 mt-0.5">سيتم حذف جميع التكليفات المسندة حالياً</p>
                </div>
              </div>
              <button
                onClick={() => setShowClearAssignmentsConfirm(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 text-xs text-slate-300 leading-relaxed">
              هل أنت متأكد من رغبتك في تفريغ جدول الحراسة بالكامل للبدء بتوزيع جديد؟ لن تتأثر قوائم الأساتذة أو القاعات أو الاختبارات.
            </div>
            <div className="p-4 bg-[#091021] border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowClearAssignmentsConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleClearAssignments}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <Trash2 size={15} />
                <span>نعم، تفريغ الجدول</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
