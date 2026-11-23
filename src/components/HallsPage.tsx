import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Hall, Student, ExamGroup, Exam } from '../types';
import { 
  DoorOpen, Trash2, Edit2, Plus, Info, RefreshCw, Upload, Download, 
  Users, UserCheck, Shuffle, ArrowRightLeft, FileSpreadsheet, Printer, 
  CheckCircle2, Sparkles, Filter, Search, Layers, Calendar, GraduationCap,
  BookOpen, Eye, X, Check, FileText, ShieldCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import ExcelImportModal from './ExcelImportModal';
import { printHtmlDirectly } from '../utils/printHelpers';

type CanonicalLevel = 'first' | 'second' | 'third';

const LEVEL_ORDER: Record<CanonicalLevel, number> = {
  first: 1,
  second: 2,
  third: 3,
};

const LEVEL_AR_PREFIX: Record<CanonicalLevel, string> = {
  first: 'أولى',
  second: 'ثانية',
  third: 'ثالثة',
};

const LEVEL_SHORT_TAG: Record<CanonicalLevel, string> = {
  first: '1ثا',
  second: '2ثا',
  third: '3ثا',
};

function normalizeDigitsAndSpace(val?: string): string {
  return String(val || '')
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeArabicKey(val?: string): string {
  return normalizeDigitsAndSpace(val)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

function detectLevelFromText(raw?: string, allowBareDigit: boolean = false): CanonicalLevel | null {
  const n = normalizeArabicKey(raw);
  if (!n) return null;

  if (
    n === 'third' ||
    n.includes('ثالثه') ||
    n.includes('بكالوريا') ||
    n.includes('باك') ||
    n.includes('3ثا') ||
    n.includes('3 ثا') ||
    n.includes('3as') ||
    n.includes('3 as') ||
    /(?:السنه|سنه|ثانوي)\s*3(?:\s|$)/.test(n) ||
    /^3(?:\s*[-_/]?\s*[\u0600-\u06FFa-z])/i.test(n) ||
    (allowBareDigit && /^3$/.test(n))
  ) {
    return 'third';
  }

  if (
    n === 'second' ||
    n.includes('ثانيه') ||
    n.includes('2ثا') ||
    n.includes('2 ثا') ||
    n.includes('2as') ||
    n.includes('2 as') ||
    /(?:السنه|سنه|ثانوي)\s*2(?:\s|$)/.test(n) ||
    /^2(?:\s*[-_/]?\s*[\u0600-\u06FFa-z])/i.test(n) ||
    (allowBareDigit && /^2$/.test(n))
  ) {
    return 'second';
  }

  if (
    n === 'first' ||
    n.includes('اولي') ||
    n.includes('جذع') ||
    n.includes('1ثا') ||
    n.includes('1 ثا') ||
    n.includes('1as') ||
    n.includes('1 as') ||
    /(?:السنه|سنه|ثانوي)\s*1(?:\s|$)/.test(n) ||
    /^1(?:\s*[-_/]?\s*[\u0600-\u06FFa-z])/i.test(n) ||
    (allowBareDigit && /^1$/.test(n))
  ) {
    return 'first';
  }

  return null;
}

function resolveStudentLevel(st: { level?: string; stream?: string; classGroup?: string }): CanonicalLevel {
  const rawLevelKey = normalizeArabicKey(st.level);
  const isEnumLevel = rawLevelKey === 'first' || rawLevelKey === 'second' || rawLevelKey === 'third';

  const fromExplicitLevelText = !isEnumLevel ? detectLevelFromText(st.level, true) : null;
  const fromClass = detectLevelFromText(st.classGroup, false);
  const fromStream = detectLevelFromText(st.stream, false);

  if (fromExplicitLevelText) return fromExplicitLevelText;
  if (fromClass) return fromClass;
  if (fromStream) return fromStream;
  if (isEnumLevel) return rawLevelKey as CanonicalLevel;
  return 'first';
}

function inferBaseStreamFromText(raw?: string): string | null {
  const n = normalizeArabicKey(raw);
  if (!n) return null;

  if (
    n.includes('تقني رياضي') ||
    n.includes('تقني') ||
    n.includes('هندسه') ||
    n.includes('ميكانيك') ||
    n.includes('كهربائ') ||
    n.includes('مدنيه') ||
    n.includes('طرائق') ||
    /(?:^|\s|[123])ت\s*\.?\s*ر(?:\s|$|\d)/.test(n)
  ) {
    return 'تقني رياضي';
  }
  if (
    n.includes('لغات اجنبيه') ||
    n.includes('لغات') ||
    n.includes('المانيه') ||
    n.includes('اسبانيه') ||
    n.includes('ايطاليه') ||
    /(?:^|\s|[123])ل\s*\.?\s*ا(?:\s|$|\d)/.test(n)
  ) {
    return 'لغات أجنبية';
  }
  if (
    n.includes('جذع مشترك علوم') ||
    (n.includes('ع ت') && n.includes('ج')) ||
    /(?:^|\s|[123])ج\s*\.?\s*م\s*\.?\s*ع(?:\s*\.?\s*ت)?(?:\s|$|\d)/.test(n)
  ) {
    return 'جذع مشترك علوم وتكنولوجيا';
  }
  if (
    n.includes('جذع مشترك اداب') ||
    /(?:^|\s|[123])ج\s*\.?\s*م\s*\.?\s*ا(?:\s|$|\d)/.test(n)
  ) {
    return 'جذع مشترك آداب';
  }
  if (
    n.includes('علوم تجريبيه') ||
    /(?:^|\s|[123])ع\s*\.?\s*ت(?:\s|$|\d)/.test(n)
  ) {
    return 'علوم تجريبية';
  }
  if (
    n.includes('تسيير واقتصاد') ||
    n.includes('تسيير') ||
    /(?:^|\s|[123])ت\s*\.?\s*ا(?:\s|$|\d)/.test(n)
  ) {
    return 'تسيير واقتصاد';
  }
  if (
    n.includes('اداب وفلسفه') ||
    n.includes('فلسفه') ||
    /(?:^|\s|[123])ا\s*\.?\s*ف(?:\s|$|\d)/.test(n)
  ) {
    return 'آداب وفلسفة';
  }
  if (n.includes('رياضيات') || /(?:^|\s|[23])ر(?:\s|$|\d)/.test(n)) {
    return 'رياضيات';
  }
  if (n.includes('فنون')) {
    return 'فنون';
  }
  return null;
}

function resolveStudentStream(
  st: { stream?: string; classGroup?: string; subSpecialty?: string },
  level: CanonicalLevel
): string {
  const cleanStream = normalizeDigitsAndSpace(st.stream);
  const nStream = normalizeArabicKey(cleanStream);
  const levelPrefix = LEVEL_AR_PREFIX[level];
  const inferredFromClass = inferBaseStreamFromText(st.classGroup);
  const streamLevel = detectLevelFromText(cleanStream, false);

  if (cleanStream && !(streamLevel && streamLevel !== level && inferredFromClass)) {
    const hasLevelWord =
      nStream.includes('اولي') ||
      nStream.includes('ثانيه') ||
      nStream.includes('ثالثه') ||
      /^[123]/.test(nStream) ||
      nStream.includes('جذع');
    return hasLevelWord ? cleanStream : `${levelPrefix} ${cleanStream}`;
  }

  const inferred = inferredFromClass || inferBaseStreamFromText(st.subSpecialty);
  if (inferred) {
    return `${levelPrefix} ${inferred}`;
  }

  if (level === 'third') return 'ثالثة علوم تجريبية';
  if (level === 'second') return 'ثانية علوم تجريبية';
  return 'أولى جذع مشترك علوم وتكنولوجيا';
}

function resolveStudentClassGroup(st: { classGroup?: string }, canonicalStream: string): string {
  const cleanClass = normalizeDigitsAndSpace(st.classGroup);
  return cleanClass || canonicalStream;
}

function isTechMathStudent(st: { stream?: string; subSpecialty?: string; classGroup?: string }): boolean {
  const combined = `${normalizeArabicKey(st.stream)} ${normalizeArabicKey(st.subSpecialty)} ${normalizeArabicKey(st.classGroup)}`;
  return (
    combined.includes('تقني رياضي') ||
    combined.includes('تقني') ||
    combined.includes('هندسه') ||
    combined.includes('ميكانيك') ||
    combined.includes('كهربائ') ||
    combined.includes('مدنيه') ||
    combined.includes('طرائق') ||
    /(?:^|\s|\d)ت\s*\.?\s*ر(?:\s|$|\d)/.test(combined)
  );
}

function isLanguagesStudent(st: { stream?: string; subSpecialty?: string; classGroup?: string }): boolean {
  const combined = `${normalizeArabicKey(st.stream)} ${normalizeArabicKey(st.subSpecialty)} ${normalizeArabicKey(st.classGroup)}`;
  return (
    combined.includes('لغات اجنبيه') ||
    combined.includes('لغات') ||
    combined.includes('المانيه') ||
    combined.includes('اسبانيه') ||
    combined.includes('ايطاليه') ||
    /(?:^|\s|\d)ل\s*\.?\s*ا(?:\s|$|\d)/.test(combined)
  );
}

export default function HallsPage() {
  const [activeTab, setActiveTab] = useState<'halls' | 'students' | 'cohorts' | 'calling_lists' | 'timetables'>('halls');
  
  // Data states
  const [halls, setHalls] = useState<Hall[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examGroups, setExamGroups] = useState<ExamGroup[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  // Institution settings for official print
  const [institutionName, setInstitutionName] = useState('ثانوية محمد بلخير');
  const [wilaya, setWilaya] = useState('البيض');
  const [schoolYear, setSchoolYear] = useState('2025-2026');
  const [selectedTerm, setSelectedTerm] = useState('الفصل الثالث');

  // Halls UI states
  const [showHallForm, setShowHallForm] = useState(false);
  const [editingHall, setEditingHall] = useState<Hall | null>(null);

  // Excel Import State
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [importTarget, setImportTarget] = useState<'halls' | 'students'>('halls');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Student filter and search states
  const [studentSearch, setStudentSearch] = useState('');
  const [studentLevelFilter, setStudentLevelFilter] = useState<'all' | 'first' | 'second' | 'third'>('all');
  const [studentStreamFilter, setStudentStreamFilter] = useState<string>('all');

  // Cohort settings & Print selection
  const [groupCapacity, setGroupCapacity] = useState<number>(30);
  const [mergeTechMath, setMergeTechMath] = useState<boolean>(false);
  const [mergeLanguages, setMergeLanguages] = useState<boolean>(false);
  const [selectedHallForCallingList, setSelectedHallForCallingList] = useState<string>('all');
  const [callingDocType, setCallingDocType] = useState<'calling_list' | 'door_poster' | 'desk_stickers'>('calling_list');

  // In-app confirmation modals (replaces window.confirm blocked in sandboxed iframes)
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [isClearStudentsModalOpen, setIsClearStudentsModalOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  // Load all initial data
  const fetchData = async () => {
    try {
      const [hallsData, studentsData, groupsData, examsData, settingsData] = await Promise.all([
        api.get('/api/halls').catch(() => []),
        api.get('/api/students').catch(() => []),
        api.get('/api/exam_groups').catch(() => []),
        api.get('/api/exams').catch(() => []),
        api.get('/api/settings').catch(() => null)
      ]);

      if (Array.isArray(hallsData)) setHalls(hallsData);
      if (Array.isArray(studentsData)) setStudents(studentsData);
      if (Array.isArray(groupsData)) {
        setExamGroups(groupsData);
        setMergeTechMath(groupsData.some((g: ExamGroup) => (g.name || '').includes('الهندسات المدمجة') || (g.name || '').includes('الفروع المدمجة')));
        setMergeLanguages(groupsData.some((g: ExamGroup) => (g.name || '').includes('لغات أجنبية') && (g.name || '').includes('مدمجة')));
      }
      if (Array.isArray(examsData)) setExams(examsData);
      
      if (settingsData) {
        if (settingsData.institutionName) setInstitutionName(settingsData.institutionName);
        if (settingsData.wilaya) setWilaya(settingsData.wilaya);
        if (settingsData.schoolYear) setSchoolYear(settingsData.schoolYear);
        if (settingsData.selectedTerm) setSelectedTerm(settingsData.selectedTerm);
      }
    } catch (e) {
      console.error(e);
      toast.error('خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 1. QUICK ADD 20 HALLS (FEATURE 1 FROM VIDEO)
  const handleQuickAdd20Halls = async () => {
    toast.loading('جاري إضافة 20 قاعة بضغطة واحدة...', { id: 'quick-halls' });
    try {
      await api.post('/api/halls/quick-generate', { count: 20, capacity: 30 });
      toast.success('تمت إضافة 20 قاعة بسعة 30 تلميذاً بنجاح!', { id: 'quick-halls' });
      fetchData();
    } catch (e) {
      toast.error('حدث خطأ أثناء الإضافة السريعة', { id: 'quick-halls' });
    }
  };

  // Comprehensive default halls initialization (26 halls + 6 labs + library)
  const handleInitDefaultHalls = () => {
    setConfirmModal({
      title: 'إعادة تهيئة القاعات الافتراضية',
      description: 'هل تريد إعادة تهيئة القاعات الافتراضية للمؤسسة (26 قاعة + 6 مخابر + مكتبة)؟ سيتم استبدال قائمة القاعات الحالية.',
      confirmLabel: 'نعم، تهيئة القاعات',
      onConfirm: async () => {
        try {
          toast.loading('جاري تهيئة القاعات...', { id: 'init-halls' });
          await api.delete('/api/halls/all');
          const defaultHalls: Hall[] = [];
          for (let i = 1; i <= 26; i++) {
            defaultHalls.push({ id: `hall_${i}`, name: `القاعة ${String(i).padStart(2, '0')}`, capacity: 30 });
          }
          for (let i = 1; i <= 6; i++) {
            defaultHalls.push({ id: `lab_${i}`, name: `مخبر العلوم والفيزياء ${i}`, capacity: 24 });
          }
          defaultHalls.push({ id: `lib_1`, name: `المكتبة المدرسية`, capacity: 40 });

          await api.post('/api/halls/bulk', { halls: defaultHalls });
          toast.success('تمت تهيئة 26 قاعة و 6 مخابر والمكتبة بنجاح!', { id: 'init-halls' });
          await fetchData();
        } catch (e) {
          toast.error('حدث خطأ أثناء التهيئة', { id: 'init-halls' });
        }
      }
    });
  };

  // Add/Edit Single Hall
  const handleSaveHall = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const hallData = {
      name: (formData.get('name') as string).trim(),
      capacity: Number(formData.get('capacity')) || 30,
    };

    try {
      if (editingHall && editingHall.id) {
        await api.put(`/api/halls/${editingHall.id}`, hallData);
        toast.success('تم تحديث بيانات القاعة');
      } else {
        await api.post('/api/halls', { ...hallData, id: `hall_${Date.now()}` });
        toast.success('تمت إضافة القاعة بنجاح');
      }
      setShowHallForm(false);
      setEditingHall(null);
      e.currentTarget.reset();
      fetchData();
    } catch (error) {
      toast.error('خطأ في حفظ القاعة');
    }
  };

  const handleDeleteHall = (id: string) => {
    setConfirmModal({
      title: 'حذف القاعة',
      description: 'هل أنت متأكد من حذف هذه القاعة من القائمة؟',
      confirmLabel: 'تأكيد الحذف',
      onConfirm: async () => {
        try {
          await api.delete(`/api/halls/${id}`);
          toast.success('تم حذف القاعة');
          await fetchData();
        } catch (error) {
          toast.error('حدث خطأ أثناء الحذف');
        }
      }
    });
  };

  const handleClearAllHalls = () => {
    setConfirmModal({
      title: 'مسح جميع القاعات',
      description: 'هل أنت متأكد من مسح جميع القاعات المضافة حالياً؟',
      confirmLabel: 'نعم، مسح جميع القاعات',
      onConfirm: async () => {
        try {
          await api.delete('/api/halls/all');
          setHalls([]);
          toast.success('تم مسح جميع القاعات');
          await fetchData();
        } catch (e) {
          toast.error('خطأ أثناء المسح');
        }
      }
    });
  };

  // 2. EXCEL IMPORT HANDLING (FEATURE 2 FROM VIDEO)
  const handleOpenFileUpload = (target: 'halls' | 'students') => {
    setImportTarget(target);
    const input = document.getElementById('hidden-file-input') as HTMLInputElement;
    if (input) input.click();
  };

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

    if (importTarget === 'halls') {
      toast.loading('جاري استيراد القاعات...', { id: 'import' });
      try {
        const validHalls = mappedData
          .filter(row => row.name && String(row.name).trim() !== '')
          .map((row, idx) => ({
            id: `hall_${Date.now()}_${idx}`,
            name: String(row.name).trim(),
            capacity: Number(row.capacity) || 30,
          }));

        if (validHalls.length > 0) {
          await api.post('/api/halls/bulk', { halls: validHalls });
          toast.success(`تم استيراد ${validHalls.length} قاعة بنجاح`, { id: 'import' });
          fetchData();
        } else {
          toast.error('لم يتم العثور على قاعات صالحة للاستيراد', { id: 'import' });
        }
      } catch (error) {
        toast.error('حدث خطأ أثناء الاستيراد', { id: 'import' });
      }
    } else {
      // Import Students
      toast.loading('جاري استيراد وتدوين قائمة التلاميذ...', { id: 'import' });
      try {
        const validStudents: Student[] = mappedData
          .map((row, idx) => {
            // Combine name if given as separate fields or raw string
            let nameVal = String(row.name || '').trim();
            if (!nameVal && (row.lastName || row.firstName)) {
              nameVal = `${row.lastName || ''} ${row.firstName || ''}`.trim();
            }
            if (!nameVal) {
              // Fallback to any string property in row
              const anyStr = Object.values(row).find(v => typeof v === 'string' && v.trim().length > 1);
              if (anyStr) nameVal = String(anyStr).trim();
            }

            if (!nameVal) return null;

            const rawGender = String(row.gender || '').trim();
            const parsedGender = (rawGender.includes('أنثى') || rawGender.toLowerCase() === 'f' || rawGender.includes('بنت') || rawGender.includes('فتاة')) ? 'أنثى' : 'ذكر';

            const rawSubSpecialty = normalizeDigitsAndSpace(row.subSpecialty);
            const rawClassGroup = normalizeDigitsAndSpace(row.classGroup);
            const rawStream = normalizeDigitsAndSpace(row.stream);
            const rawLevel = normalizeDigitsAndSpace(row.level);

            const parsedLevel = resolveStudentLevel({
              level: rawLevel,
              stream: rawStream,
              classGroup: rawClassGroup,
            });
            const streamVal = resolveStudentStream(
              { stream: rawStream, classGroup: rawClassGroup, subSpecialty: rawSubSpecialty },
              parsedLevel
            );
            const classVal = resolveStudentClassGroup({ classGroup: rawClassGroup }, streamVal);

            return {
              id: `st_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              matricule: String(row.matricule || `REG-${2025000 + idx}`).trim(),
              name: nameVal,
              gender: parsedGender,
              level: parsedLevel,
              stream: streamVal,
              subSpecialty: rawSubSpecialty,
              classGroup: classVal,
              seatNumber: idx + 1
            };
          })
          .filter(Boolean) as Student[];

        if (validStudents.length > 0) {
          await api.post('/api/students/bulk', { students: validStudents });
          toast.success(`تم استيراد ${validStudents.length} تلميذ بنجاح!`, { id: 'import' });
          fetchData();
        } else {
          toast.error('لم يتم العثور على أسماء تلاميذ صالحة في الملف المرفوع', { id: 'import' });
        }
      } catch (e: any) {
        console.error('Student import failed:', e);
        const errMsg = e.response?.data?.error || e.message || 'خطأ في استيراد التلاميذ';
        toast.error(`خطأ في استيراد التلاميذ: ${errMsg}`, { id: 'import' });
      }
    }
  };

  // Seed Dummy Students for Demo / Testing
  const handleSeedDummyStudents = async () => {
    toast.loading('جاري توليد قائمة تلاميذ تجريبية مطابقة للنظام الجزائري...', { id: 'seed-st' });
    try {
      const streamsList = [
        { level: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا', group: '1 ج م ع ت 1' },
        { level: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا', group: '1 ج م ع ت 2' },
        { level: 'first', stream: 'أولى جذع مشترك آداب', group: '1 ج م آ 1' },
        { level: 'second', stream: 'ثانية علوم تجريبية', group: '2 ع ت 1' },
        { level: 'second', stream: 'ثانية تقني رياضي', group: '2 ت ر 1', sub: 'هندسة ميكانيكية' },
        { level: 'second', stream: 'ثانية تقني رياضي', group: '2 ت ر 1', sub: 'هندسة كهربائية' },
        { level: 'second', stream: 'ثانية تقني رياضي', group: '2 ت ر 1', sub: 'هندسة مدنية' },
        { level: 'second', stream: 'ثانية لغات أجنبية', group: '2 ل أ 1', sub: 'لغة ألمانية' },
        { level: 'second', stream: 'ثانية لغات أجنبية', group: '2 ل أ 1', sub: 'لغة إسبانية' },
        { level: 'third', stream: 'ثالثة علوم تجريبية', group: '3 ع ت 1' },
        { level: 'third', stream: 'ثالثة آداب وفلسفة', group: '3 آ ف 1' }
      ];

      const firstNamesMale = ['محمد', 'أحمد', 'ياسين', 'أيمن', 'عبد الرحمن', 'أسامة', 'وليد', 'إسلام', 'يونس', 'خالد', 'أمين', 'بلال'];
      const firstNamesFemale = ['سارة', 'مريم', 'إيمان', 'فاطمة', 'هدى', 'خديجة', 'زينب', 'شيماء', 'ياسمين', 'نورهان', 'أمينة', 'ريان'];
      const lastNames = ['براهيمي', 'بن علي', 'منصوري', 'علوي', 'قاسمي', 'بلحاج', 'بوداود', 'طاهري', 'مباركي', 'سعيدي', 'حداد', 'دحماني'];

      const generated: Student[] = [];
      let counter = 1;

      streamsList.forEach(item => {
        const count = item.sub ? 6 : 12; // sub-specialties smaller counts
        for (let i = 0; i < count; i++) {
          const isFemale = i % 2 === 1;
          const firstName = isFemale ? firstNamesFemale[i % firstNamesFemale.length] : firstNamesMale[i % firstNamesMale.length];
          const lastName = lastNames[(counter + i) % lastNames.length];
          generated.push({
            id: `st_demo_${counter}`,
            matricule: `2025/${String(counter).padStart(4, '0')}`,
            name: `${lastName} ${firstName}`,
            gender: isFemale ? 'أنثى' : 'ذكر',
            level: item.level,
            stream: item.stream,
            subSpecialty: item.sub || '',
            classGroup: item.group,
            seatNumber: (counter % 30) + 1
          });
          counter++;
        }
      });

      await api.delete('/api/students/all');
      await api.post('/api/students/bulk', { students: generated });
      toast.success(`تم إنشاء وتدوين ${generated.length} تلميذ بنجاح!`, { id: 'seed-st' });
      fetchData();
    } catch (e) {
      toast.error('حدث خطأ أثناء توليد التلاميذ', { id: 'seed-st' });
    }
  };

  // Download Excel Student Template
  const handleDownloadStudentTemplate = () => {
    const templateData = [
      { 'رقم التسجيل': '2025/0001', 'اللقب والاسم': 'منصوري أحمد', 'الجنس': 'ذكر', 'المستوى': 'أولى', 'الشعبة': 'أولى جذع مشترك علوم وتكنولوجيا', 'القسم': '1 ج م ع ت 1', 'التخصص الفرعي': '' },
      { 'رقم التسجيل': '2025/0002', 'اللقب والاسم': 'براهيمي مريم', 'الجنس': 'أنثى', 'المستوى': 'أولى', 'الشعبة': 'أولى جذع مشترك علوم وتكنولوجيا', 'القسم': '1 ج م ع ت 1', 'التخصص الفرعي': '' },
      { 'رقم التسجيل': '2025/0003', 'اللقب والاسم': 'قاسمي وليد', 'الجنس': 'ذكر', 'المستوى': 'ثانية', 'الشعبة': 'ثانية تقني رياضي', 'القسم': '2 ت ر 1', 'التخصص الفرعي': 'هندسة ميكانيكية' },
      { 'رقم التسجيل': '2025/0004', 'اللقب والاسم': 'علوي إيمان', 'الجنس': 'أنثى', 'المستوى': 'ثانية', 'الشعبة': 'ثانية تقني رياضي', 'القسم': '2 ت ر 1', 'التخصص الفرعي': 'هندسة كهربائية' },
      { 'رقم التسجيل': '2025/0005', 'اللقب والاسم': 'حداد ياسين', 'الجنس': 'ذكر', 'المستوى': 'ثانية', 'الشعبة': 'ثانية لغات أجنبية', 'القسم': '2 ل أ 1', 'التخصص الفرعي': 'لغة ألمانية' },
      { 'رقم التسجيل': '2025/0006', 'اللقب والاسم': 'طاهري سارة', 'الجنس': 'أنثى', 'المستوى': 'ثالثة', 'الشعبة': 'ثالثة علوم تجريبية', 'القسم': '3 ع ت 1', 'التخصص الفرعي': '' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'قالب_التلاميذ');
    XLSX.writeFile(workbook, 'نموذج_استيراد_التلاميذ_Hirasa_Pro.xlsx');
    toast.success('تم تنزيل نموذج الإكسل بنجاح');
  };

  const handleClearAllStudents = () => {
    setIsClearStudentsModalOpen(true);
  };

  const executeClearStudents = async (scope: 'all' | 'filtered') => {
    setClearBusy(true);
    toast.loading('جاري مسح بيانات التلاميذ...', { id: 'clear-students' });
    try {
      if (scope === 'all') {
        await api.delete('/api/students/all');
        await api.delete('/api/exam_groups/all');
        localStorage.removeItem('hirasa_db_students');
        localStorage.removeItem('hirasa_db_exam_groups');
        setStudents([]);
        setExamGroups([]);
        setStudentSearch('');
        setStudentLevelFilter('all');
        setStudentStreamFilter('all');
        toast.success('تم مسح جميع التلاميذ والأفواج بنجاح', { id: 'clear-students' });
      } else {
        const idsToDelete = filteredStudents.map(s => s.id).filter(Boolean) as string[];
        if (idsToDelete.length > 0) {
          await api.post('/api/students/delete-many', { ids: idsToDelete });
          const deletedSet = new Set(idsToDelete.map(String));
          setStudents(prev => prev.filter(s => !deletedSet.has(String(s.id))));
          toast.success(`تم مسح ${idsToDelete.length} تلميذ من القائمة بنجاح`, { id: 'clear-students' });
        }
      }
      setIsClearStudentsModalOpen(false);
      await fetchData();
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء المسح', { id: 'clear-students' });
    } finally {
      setClearBusy(false);
    }
  };

  const handleDeleteSingleStudent = async (studentId: string) => {
    try {
      await api.delete(`/api/students/${studentId}`);
      setStudents(prev => prev.filter(s => String(s.id) !== String(studentId)));
      toast.success('تم حذف التلميذ من القائمة');
    } catch (e) {
      toast.error('حدث خطأ أثناء حذف التلميذ');
    }
  };

  // 3. UNIFIED COHORTS BUILDER: STRICT LEVEL + STREAM + CLASS ISOLATION WITH OPTIONAL LEVEL-SAFE MERGE
  const buildCohorts = async (options: {
    techMerged: boolean;
    langMerged: boolean;
    toastId: string;
    loadingMessage: string;
    successMessage: (groupCount: number) => string;
  }) => {
    const { techMerged, langMerged, toastId, loadingMessage, successMessage } = options;

    if (students.length === 0) {
      toast.error('يرجى رفع أو توليد بيانات التلاميذ أولاً لإجراء التفويج');
      return;
    }
    if (halls.length === 0) {
      toast.error('يرجى إضافة القاعات أولاً لربط الأفواج بها');
      return;
    }

    toast.loading(loadingMessage, { id: toastId });

    try {
      interface CohortBucket {
        level: CanonicalLevel;
        streamName: string;
        classLabel: string;
        mergeKind: 'none' | 'tech' | 'lang';
        students: Student[];
      }

      const bucketMap = new Map<string, CohortBucket>();
      const normalizedStudentMeta = new Map<string, { level: CanonicalLevel; stream: string; classGroup: string }>();

      students.forEach((st, idx) => {
        const canonicalLevel = resolveStudentLevel(st);
        const canonicalStream = resolveStudentStream(st, canonicalLevel);
        const canonicalClass = resolveStudentClassGroup(st, canonicalStream);

        const stKey = st.id || `__idx_${idx}`;
        normalizedStudentMeta.set(stKey, {
          level: canonicalLevel,
          stream: canonicalStream,
          classGroup: canonicalClass,
        });

        const levelPrefix = LEVEL_AR_PREFIX[canonicalLevel];
        const isTech = techMerged && isTechMathStudent({ stream: canonicalStream, subSpecialty: st.subSpecialty, classGroup: canonicalClass });
        const isLang = !isTech && langMerged && isLanguagesStudent({ stream: canonicalStream, subSpecialty: st.subSpecialty, classGroup: canonicalClass });

        let key: string;
        let bucketStream: string;
        let bucketClass: string;
        let mergeKind: 'none' | 'tech' | 'lang' = 'none';

        if (isTech) {
          key = `${canonicalLevel}__MERGED_TECH`;
          bucketStream = `${levelPrefix} تقني رياضي`;
          bucketClass = 'تقني رياضي (الهندسات المدمجة)';
          mergeKind = 'tech';
        } else if (isLang) {
          key = `${canonicalLevel}__MERGED_LANG`;
          bucketStream = `${levelPrefix} لغات أجنبية`;
          bucketClass = 'لغات أجنبية (مدمجة)';
          mergeKind = 'lang';
        } else {
          // Strict separation by (level, stream, classGroup) — zero cross-level or cross-section mixing
          key = `${canonicalLevel}__${normalizeArabicKey(canonicalStream)}__${normalizeArabicKey(canonicalClass)}`;
          bucketStream = canonicalStream;
          bucketClass = canonicalClass;
        }

        if (!bucketMap.has(key)) {
          bucketMap.set(key, {
            level: canonicalLevel,
            streamName: bucketStream,
            classLabel: bucketClass,
            mergeKind,
            students: [],
          });
        }
        bucketMap.get(key)!.students.push(st);
      });

      // Deterministic ordering: Level (1ثا -> 2ثا -> 3ثا), then Stream, then ClassGroup
      const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => {
        const lvlDiff = (LEVEL_ORDER[a.level] || 99) - (LEVEL_ORDER[b.level] || 99);
        if (lvlDiff !== 0) return lvlDiff;
        const streamDiff = a.streamName.localeCompare(b.streamName, 'ar', { numeric: true });
        if (streamDiff !== 0) return streamDiff;
        return a.classLabel.localeCompare(b.classLabel, 'ar', { numeric: true });
      });

      const generatedGroups: ExamGroup[] = [];
      const studentAssignments = new Map<string, { examGroupId: string; examHallId: string; seatNumber: number }>();
      const cap = Math.max(1, Number(groupCapacity) || 30);
      let hallIndex = 0;

      sortedBuckets.forEach((bucket) => {
        // Sort students alphabetically inside their exact class/merged bucket before splitting
        const sortedStudents = [...bucket.students].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', 'ar')
        );

        const total = sortedStudents.length;
        const numberOfGroups = Math.max(1, Math.ceil(total / cap));
        const baseSize = Math.floor(total / numberOfGroups);
        const remainder = total % numberOfGroups;
        const levelTag = LEVEL_SHORT_TAG[bucket.level];

        let baseDisplayTitle: string;
        if (bucket.mergeKind !== 'none') {
          baseDisplayTitle = `[${levelTag}] ${bucket.classLabel}`;
        } else if (normalizeArabicKey(bucket.classLabel) === normalizeArabicKey(bucket.streamName)) {
          baseDisplayTitle = `[${levelTag}] ${bucket.streamName}`;
        } else if (/^\d+$/.test(normalizeDigitsAndSpace(bucket.classLabel))) {
          baseDisplayTitle = `[${levelTag}] ${bucket.streamName} - قسم ${bucket.classLabel}`;
        } else {
          baseDisplayTitle = `[${levelTag}] ${bucket.classLabel}`;
        }

        let offset = 0;
        for (let g = 0; g < numberOfGroups; g++) {
          const thisSize = baseSize + (g < remainder ? 1 : 0);
          const chunk = sortedStudents.slice(offset, offset + thisSize);
          offset += thisSize;

          const assignedHall = halls[hallIndex % halls.length];
          hallIndex++;

          const groupId = `grp_${bucket.level}_${Date.now()}_${hallIndex}_${Math.random().toString(36).slice(2, 6)}`;
          const groupName = numberOfGroups > 1
            ? `${baseDisplayTitle} - فوج ${String(g + 1).padStart(2, '0')}`
            : baseDisplayTitle;

          generatedGroups.push({
            id: groupId,
            name: groupName,
            level: bucket.level,
            stream: bucket.streamName,
            hallId: assignedHall ? assignedHall.id : '',
            hallName: assignedHall ? assignedHall.name : `القاعة ${hallIndex}`,
            studentCount: chunk.length,
          });

          chunk.forEach((st, seatIdx) => {
            if (st.id) {
              studentAssignments.set(st.id, {
                examGroupId: groupId,
                examHallId: assignedHall ? assignedHall.id || '' : '',
                seatNumber: seatIdx + 1,
              });
            }
          });
        }
      });

      const updatedStudents: Student[] = students.map((st, idx) => {
        const stKey = st.id || `__idx_${idx}`;
        const meta = normalizedStudentMeta.get(stKey);
        const assign = st.id ? studentAssignments.get(st.id) : undefined;
        return {
          ...st,
          level: meta ? meta.level : st.level,
          stream: meta ? meta.stream : st.stream,
          classGroup: meta ? meta.classGroup : st.classGroup,
          examGroupId: assign ? assign.examGroupId : st.examGroupId,
          examHallId: assign ? assign.examHallId : st.examHallId,
          seatNumber: assign ? assign.seatNumber : st.seatNumber,
        };
      });

      await api.delete('/api/exam_groups/all');
      await api.post('/api/exam_groups/bulk', { groups: generatedGroups });
      await api.delete('/api/students/all');
      await api.post('/api/students/bulk', { students: updatedStudents });

      setMergeTechMath(techMerged);
      setMergeLanguages(langMerged);
      setExamGroups(generatedGroups);
      setStudents(updatedStudents);

      if (generatedGroups.length > halls.length) {
        toast.success(
          `${successMessage(generatedGroups.length)} (تنبيه: عدد الأفواج ${generatedGroups.length} يفوق عدد القاعات المتاحة ${halls.length})`,
          { id: toastId, duration: 5000 }
        );
      } else {
        toast.success(successMessage(generatedGroups.length), { id: toastId });
      }
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء تنفيذ التفويج وتوزيع القاعات', { id: toastId });
    }
  };

  // Auto Cohort Button — respects active merges while keeping levels and sections strictly separated
  const handleAutoCohort = async () => {
    await buildCohorts({
      techMerged: mergeTechMath,
      langMerged: mergeLanguages,
      toastId: 'cohort',
      loadingMessage: 'جاري تقسيم الأقسام إلى أفواج متوازنة وتخصيص القاعات بدقة...',
      successMessage: (cnt) => `تم بنجاح تشكيل ${cnt} فوج امتحاني وتوزيعها على القاعات بدون خلط!`,
    });
  };

  // FEATURE 4: MERGE TECHNICAL MATH SPECIALTIES WITHIN EACH LEVEL (preserves فصل المستويات)
  const handleMergeTechMath = async () => {
    const techStudents = students.filter(st => {
      const lvl = resolveStudentLevel(st);
      const stream = resolveStudentStream(st, lvl);
      const cls = resolveStudentClassGroup(st, stream);
      return isTechMathStudent({ stream, subSpecialty: st.subSpecialty, classGroup: cls });
    });

    if (techStudents.length === 0) {
      toast.error('لم يتم العثور على تلاميذ تقني رياضي للدمج');
      return;
    }

    const nextTechMerged = !mergeTechMath;
    await buildCohorts({
      techMerged: nextTechMerged,
      langMerged: mergeLanguages,
      toastId: 'merge-tm',
      loadingMessage: nextTechMerged
        ? 'جاري دمج فروع التقني رياضي داخل كل مستوى مع الحفاظ التام على فصل المستويات...'
        : 'جاري إلغاء دمج الهندسات وإعادة فصل الأقسام تماماً...',
      successMessage: (cnt) =>
        nextTechMerged
          ? `تم دمج فروع التقني رياضي (${techStudents.length} تلميذ) داخل كل مستوى مع بقاء فصل المستويات تماماً (${cnt} فوج)!`
          : `تم إلغاء دمج الهندسات وإعادة فصل جميع الأقسام والمستويات (${cnt} فوج)!`,
    });
  };

  // FEATURE 4: MERGE FOREIGN LANGUAGES WITHIN EACH LEVEL (preserves فصل المستويات)
  const handleMergeLanguages = async () => {
    const langStudents = students.filter(st => {
      const lvl = resolveStudentLevel(st);
      const stream = resolveStudentStream(st, lvl);
      const cls = resolveStudentClassGroup(st, stream);
      return isLanguagesStudent({ stream, subSpecialty: st.subSpecialty, classGroup: cls });
    });

    if (langStudents.length === 0) {
      toast.error('لم يتم العثور على تلاميذ لغات أجنبية للدمج');
      return;
    }

    const nextLangMerged = !mergeLanguages;
    await buildCohorts({
      techMerged: mergeTechMath,
      langMerged: nextLangMerged,
      toastId: 'merge-lang',
      loadingMessage: nextLangMerged
        ? 'جاري دمج اللغات الأجنبية داخل كل مستوى مع الحفاظ التام على فصل المستويات...'
        : 'جاري إلغاء دمج اللغات وإعادة فصل الأقسام تماماً...',
      successMessage: (cnt) =>
        nextLangMerged
          ? `تم دمج اللغات الأجنبية (${langStudents.length} تلميذ) داخل كل مستوى مع بقاء فصل المستويات تماماً (${cnt} فوج)!`
          : `تم إلغاء دمج اللغات وإعادة فصل جميع الأقسام والمستويات (${cnt} فوج)!`,
    });
  };

  // FEATURE 6: ALTERNATE SEATING BY GENDER (ذكر - أنثى - ذكر - أنثى)
  const handleAlternateSeating = async () => {
    toast.loading('جاري إعادة ترتيب المقاعد بالتناوب حسب الجنس (ذكر / أنثى) لمنع الغش...', { id: 'seating' });
    try {
      const updatedStudents = [...students];

      // Process each group independently
      examGroups.forEach(grp => {
        const groupStudents = updatedStudents.filter(s => s.examGroupId === grp.id);
        const males = groupStudents.filter(s => s.gender === 'ذكر');
        const females = groupStudents.filter(s => s.gender === 'أنثى');

        const alternated: Student[] = [];
        const maxLen = Math.max(males.length, females.length);
        for (let i = 0; i < maxLen; i++) {
          if (males[i]) alternated.push(males[i]);
          if (females[i]) alternated.push(females[i]);
        }

        alternated.forEach((st, seatIdx) => {
          const idx = updatedStudents.findIndex(s => s.id === st.id);
          if (idx !== -1) {
            updatedStudents[idx] = {
              ...updatedStudents[idx],
              seatNumber: seatIdx + 1
            };
          }
        });
      });

      await api.delete('/api/students/all');
      await api.post('/api/students/bulk', { students: updatedStudents });

      toast.success('تم إعادة ترتيب جلوس التلاميذ بالتناوب (ذكر / أنثى) بنجاح!', { id: 'seating' });
      fetchData();
    } catch (e) {
      toast.error('خطأ أثناء إعادة الترتيب', { id: 'seating' });
    }
  };

  // Sort Alphabetically
  const handleSortAlphabetically = async () => {
    toast.loading('جاري ترتيب التلاميذ ألفبائياً...', { id: 'sort-alpha' });
    try {
      const updatedStudents = [...students];
      examGroups.forEach(grp => {
        const groupStudents = updatedStudents
          .filter(s => s.examGroupId === grp.id)
          .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

        groupStudents.forEach((st, seatIdx) => {
          const idx = updatedStudents.findIndex(s => s.id === st.id);
          if (idx !== -1) {
            updatedStudents[idx] = {
              ...updatedStudents[idx],
              seatNumber: seatIdx + 1
            };
          }
        });
      });

      await api.delete('/api/students/all');
      await api.post('/api/students/bulk', { students: updatedStudents });
      toast.success('تم الترتيب الألفبائي وترقيم المقاعد بنجاح', { id: 'sort-alpha' });
      fetchData();
    } catch (e) {
      toast.error('خطأ أثناء الترتيب', { id: 'sort-alpha' });
    }
  };

  // FEATURE: STRICT UNMIXED COHORTS / فصل المستويات تماماً (1ثا / 2ثا / 3ثا) - قراءة الشعبة والقسم والمستوى بدقة وعدم الخلط
  const handleSeparateCohortsByLevel = async () => {
    await buildCohorts({
      techMerged: false,
      langMerged: false,
      toastId: 'cohort-sep',
      loadingMessage: 'جاري قراءة المستوى والشعبة والقسم وفصل جميع المستويات والأقسام تماماً...',
      successMessage: (cnt) => `تم بنجاح تشكيل ${cnt} فوج مستقل وفق (المستوى + الشعبة + القسم) وفصل جميع المستويات تماماً!`,
    });
  };

  // Export Cohorts & Halls Allocation to Formatted Excel Spreadsheet
  const handleExportHallsExcel = () => {
    if (students.length === 0) {
      toast.error('لا توجد بيانات تلاميذ لتصديرها');
      return;
    }

    const rows: any[] = [];
    halls.forEach(hall => {
      const hallStudents = students
        .filter(s => s.examHallId === hall.id)
        .sort((a, b) => {
          const classA = (a.classGroup || a.stream || '').trim();
          const classB = (b.classGroup || b.stream || '').trim();
          const cComp = classA.localeCompare(classB, 'ar', { numeric: true });
          if (cComp !== 0) return cComp;

          const seatA = a.seatNumber || 0;
          const seatB = b.seatNumber || 0;
          if (seatA !== seatB) return seatA - seatB;
          return (a.name || '').localeCompare(b.name || '', 'ar');
        });

      const group = examGroups.find(g => g.hallId === hall.id);

      hallStudents.forEach(st => {
        rows.push({
          'القاعة': hall.name,
          'رقم المقعد': st.seatNumber || '-',
          'رقم التسجيل': st.matricule || '-',
          'اللقب والاسم': st.name,
          'الجنس': st.gender,
          'المستوى': st.level === 'third' ? 'ثالثة ثانوي' : st.level === 'second' ? 'ثانية ثانوي' : 'أولى ثانوي',
          'الشعبة': st.stream,
          'التخصص الفرعي': st.subSpecialty || '-',
          'القسم الأصلي': st.classGroup || '-',
          'الفوج الامتحاني': group ? group.name : '-'
        });
      });
    });

    if (rows.length === 0) {
      students.forEach(st => {
        rows.push({
          'رقم التسجيل': st.matricule || '-',
          'اللقب والاسم': st.name,
          'الجنس': st.gender,
          'المستوى': st.level === 'third' ? 'ثالثة ثانوي' : st.level === 'second' ? 'ثانية ثانوي' : 'أولى ثانوي',
          'الشعبة': st.stream,
          'التخصص الفرعي': st.subSpecialty || '-',
          'القسم الأصلي': st.classGroup || '-'
        });
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'توزيع_القاعات_والأفواج');
    XLSX.writeFile(workbook, `توزيع_القاعات_والأفواج_${institutionName}_${schoolYear}.xlsx`);
    toast.success('تم تصدير ملف الإكسل بنجاح!');
  };

  // Move student to another group
  const handleMoveStudentGroup = async (studentId: string, targetGroupId: string) => {
    try {
      const targetGroup = examGroups.find(g => g.id === targetGroupId);
      const student = students.find(s => s.id === studentId);
      if (!student || !targetGroup) return;

      const updated = {
        ...student,
        examGroupId: targetGroupId,
        examHallId: targetGroup.hallId || ''
      };

      await api.put(`/api/students/${studentId}`, updated);
      toast.success(`تم نقل التلميذ إلى (${targetGroup.name})`);
      fetchData();
    } catch (e) {
      toast.error('خطأ في نقل التلميذ');
    }
  };

  // 4. PRINTING CALLING LISTS WITH SIGNATURES (FEATURE 7 FROM VIDEO)
  const handlePrintCallingLists = (targetHallId: string = 'all') => {
    const previewEl = document.getElementById('calling-lists-printable');
    if (!previewEl) {
      toast.error('تعذر إيجاد وثيقة القوائم للطباعة');
      return;
    }

    const docTitle = callingDocType === 'door_poster' 
      ? `ملصقات أبواب قاعات الامتحان - ${institutionName}`
      : callingDocType === 'desk_stickers'
      ? `ملصقات طاولات ومقاعد الامتحان - ${institutionName}`
      : `قوائم المناداة وإمضاء حضور التلاميذ - ${institutionName}`;

    const isStickers = callingDocType === 'desk_stickers';

    const fullHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${docTitle}</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap">
        <style>
          @page {
            size: A4 portrait;
            margin: ${isStickers ? '0.3cm' : '0.5cm'};
          }
          * { box-sizing: border-box; }
          html, body {
            font-family: 'Cairo', Tahoma, sans-serif !important;
            direction: rtl !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
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
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: 800 !important;
          }
          .print-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          .print-card {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
        </style>
      </head>
      <body>
        <div style="padding: 0.2cm;">
          ${previewEl.innerHTML}
        </div>
      </body>
      </html>
    `;

    printHtmlDirectly(fullHtml);
    toast.success('تم تفعيل المعاينة والطباعة المباشرة بنجاح!');
  };

  const handlePrintHallTimetables = () => {
    let htmlContent = `
      <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 10px;">
    `;

    halls.forEach((hall) => {
      const assignedGroups = examGroups.filter(g => g.hallId === hall.id);
      htmlContent += `
        <div style="page-break-after: always; break-after: page; border: 2px solid #000; padding: 20px; margin-bottom: 20px; background: #fff; color: #000;">
          <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
            <h2 style="margin:0; font-size:16px;">الجمهورية الجزائرية الديمقراطية الشعبية - وزارة التربية الوطنية</h2>
            <h3 style="margin:4px 0; font-size:14px;">مديرية التربية لولاية ${wilaya} | ${institutionName}</h3>
            <h1 style="margin:10px 0; font-size:18px; text-decoration: underline;">جدول سير امتحانات القاعة: ${hall.name}</h1>
            <p style="margin:2px 0; font-size:12px;">السنة الدراسية: ${schoolYear} | ${selectedTerm}</p>
          </div>

          <div style="margin-bottom: 15px; font-weight: bold; font-size: 13px;">
            <p style="margin: 4px 0;">الأفواج والشعب المعنية بهذا القاعة:</p>
            <ul style="margin: 4px 0; padding-right: 20px;">
              ${assignedGroups.length > 0 
                ? assignedGroups.map(g => `<li>${g.name} (${g.studentCount || 0} طالب)</li>`).join('') 
                : '<li>جميع الشعب المعنية</li>'}
            </ul>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px; margin-top: 15px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="border: 1px solid #000; padding: 8px;">اليوم والتاريخ</th>
                <th style="border: 1px solid #000; padding: 8px;">الفترة والتوقيت</th>
                <th style="border: 1px solid #000; padding: 8px;">المادة المبرمجة</th>
                <th style="border: 1px solid #000; padding: 8px;">المدة</th>
              </tr>
            </thead>
            <tbody>
              ${exams.length > 0 ? exams.map(e => `
                <tr>
                  <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">${e.date}</td>
                  <td style="border: 1px solid #000; padding: 8px;">${e.period === 'morning' ? 'صباحاً' : 'مساءً'} (${e.timeRange || '08:00 - 10:00'})</td>
                  <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">${e.subject}</td>
                  <td style="border: 1px solid #000; padding: 8px;">${e.duration || 2} سا</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="4" style="border: 1px solid #000; padding: 15px;">لا توجد امتحانات مبرمجة بعد</td>
                </tr>
              `}
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; margin-top: 30px; font-weight: bold; font-size: 12px;">
            <div>تأشيرة وتوقيع مدير المؤسسة</div>
            <div>تأشيرة وتوقيع الناظر</div>
          </div>
        </div>
      `;
    });

    htmlContent += `</div>`;

    const fullHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>جداول سير الامتحانات بالقاعات - ${institutionName}</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap">
        <style>
          @page { size: portrait; margin: 1cm; }
          * { box-sizing: border-box; }
          body { font-family: 'Cairo', sans-serif !important; direction: rtl !important; background: #fff !important; color: #000 !important; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    printHtmlDirectly(fullHtml);
    toast.success('تم فتح نافذة الطباعة المباشرة لجداول القاعات!');
  };

  // Student Filter Calculations
  const filteredStudents = students.filter(st => {
    const matchSearch = studentSearch === '' || 
      st.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
      (st.matricule && st.matricule.includes(studentSearch));
    
    const matchLevel = studentLevelFilter === 'all' || st.level === studentLevelFilter;
    const matchStream = studentStreamFilter === 'all' || st.stream === studentStreamFilter;

    return matchSearch && matchLevel && matchStream;
  });

  // Unique streams for filter
  const uniqueStreams = Array.from(new Set(students.map(s => s.stream)));

  // Statistics
  const totalStudents = students.length;
  const maleCount = students.filter(s => s.gender === 'ذكر').length;
  const femaleCount = students.filter(s => s.gender === 'أنثى').length;
  const malePct = totalStudents > 0 ? Math.round((maleCount / totalStudents) * 100) : 0;
  const femalePct = totalStudents > 0 ? Math.round((femaleCount / totalStudents) * 100) : 0;
  
  const firstYearCount = students.filter(s => resolveStudentLevel(s) === 'first').length;
  const secondYearCount = students.filter(s => resolveStudentLevel(s) === 'second').length;
  const thirdYearCount = students.filter(s => resolveStudentLevel(s) === 'third').length;
  const requiredHallsEstimate = Math.ceil(totalStudents / (groupCapacity || 30));

  return (
    <div className="space-y-6 text-slate-100">
      
      {/* Hidden File Input for Excel Imports */}
      <input 
        id="hidden-file-input"
        type="file" 
        className="hidden" 
        accept=".xlsx, .xls" 
        onChange={handleFileUpload} 
      />

      {/* Top Header Card matching Hirasa Pro Episode 04 */}
      <div className="bg-[#091021] border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        
        <div className="flex items-center gap-3">
          <div className="bg-[#0099FF]/20 text-cyan-400 p-3.5 rounded-2xl border border-cyan-500/40 shadow-inner">
            <DoorOpen size={28} className="text-[#0099FF]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              إعداد قاعات الامتحان وتوزيع الأفواج
              <span className="text-xs bg-sky-500/20 text-cyan-300 border border-sky-500/40 px-2.5 py-0.5 rounded-full font-bold">
                Hirasa Pro
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              إدارة القاعات، رفع قوائم التلاميذ، التفويج المتوازن، دمج الشعب، وطباعة قوائم المناداة والتعليق
            </p>
          </div>
        </div>

        {/* Quick Actions in Header */}
        <div className="flex flex-wrap items-center gap-2">
          {/* FEATURE 1: 20 HALLS WITH 1 CLICK */}
          <button
            onClick={handleQuickAdd20Halls}
            className="flex items-center gap-1.5 bg-[#0099FF] hover:bg-sky-500 text-white font-black px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
            title="إضافة 20 قاعة بسعة 30 طالباً بضغطة زر واحدة"
          >
            <Sparkles size={16} />
            إضافة سريعة: 20 قاعة
          </button>

          <button
            onClick={handleInitDefaultHalls}
            className="flex items-center gap-1.5 bg-[#121E36] hover:bg-[#182643] text-amber-300 border border-amber-500/30 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            title="تهيئة 26 قاعة + 6 مخابر + مكتبة"
          >
            <RefreshCw size={14} />
            تهيئة شاملة
          </button>

          <button
            onClick={() => handleOpenFileUpload('halls')}
            className="flex items-center gap-1.5 bg-[#121E36] hover:bg-[#182643] text-emerald-300 border border-emerald-500/30 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            <Upload size={14} />
            استيراد قاعات
          </button>
        </div>

      </div>

      {/* Navigation Tabs matching the 5 pillars from Hirasa Pro Video */}
      <div className="flex flex-wrap items-center gap-2 bg-[#0D162A] p-2 rounded-2xl border border-slate-800 shadow-xl">
        <button
          onClick={() => setActiveTab('halls')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'halls' 
              ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-[#121E36]'
          }`}
        >
          <DoorOpen size={16} />
          <span>1. قاعات الامتحان ({halls.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'students' 
              ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-[#121E36]'
          }`}
        >
          <Users size={16} />
          <span>2. رفع التلاميذ والإحصائيات ({students.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cohorts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'cohorts' 
              ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-[#121E36]'
          }`}
        >
          <Shuffle size={16} />
          <span>3. التفويج ودمج الشعب ({examGroups.length} فوج)</span>
        </button>

        <button
          onClick={() => setActiveTab('calling_lists')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'calling_lists' 
              ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-[#121E36]'
          }`}
        >
          <Printer size={16} />
          <span>4. طباعة قوائم المناداة والتعليق</span>
        </button>

        <button
          onClick={() => setActiveTab('timetables')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'timetables' 
              ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-[#121E36]'
          }`}
        >
          <Calendar size={16} />
          <span>5. جداول سير الامتحانات بالقاعات</span>
        </button>
      </div>

      {/* TAB 1: HALLS MANAGEMENT */}
      {activeTab === 'halls' && (
        <div className="space-y-6">
          {/* Total Capacity Overview Bar */}
          {(() => {
            const totalCap = halls.reduce((sum, h) => sum + (h.capacity || 0), 0);
            const totalSt = students.length;
            const isSufficient = totalCap >= totalSt;
            const capPercentage = totalCap > 0 ? Math.min(100, Math.round((totalSt / totalCap) * 100)) : 0;

            return (
              <div className="bg-[#0D162A] p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shadow-xl">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">قائمة القاعات والمخابر المعتمدة</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${isSufficient ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                      {isSufficient ? '✓ الطاقة الاستيعابية كافية' : '⚠️ تنبيه: سعة القاعات أقل من عدد التلاميذ'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    إجمالي سعة القاعات: <strong className="text-cyan-300 font-mono">{totalCap} مقعد</strong> | إجمالي التلاميذ المسجلين: <strong className="text-white font-mono">{totalSt} تلميذ</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-36 bg-[#121E36] h-3 rounded-full overflow-hidden border border-slate-700/80 p-0.5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${capPercentage >= 100 ? 'bg-rose-500' : capPercentage > 85 ? 'bg-amber-400' : 'bg-[#0099FF]'}`} 
                      style={{ width: `${capPercentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-300">{capPercentage}% مستغل</span>

                  <button
                    onClick={() => { setEditingHall(null); setShowHallForm(!showHallForm); }}
                    className="flex items-center gap-1.5 bg-[#0099FF] hover:bg-sky-500 text-white font-black px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-md"
                  >
                    <Plus size={16} />
                    {showHallForm ? 'إلغاء' : 'إضافة قاعة يدوياً'}
                  </button>

                  <button
                    onClick={handleClearAllHalls}
                    className="flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    <Trash2 size={14} />
                    مسح الكل
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Add/Edit Hall Form */}
          <AnimatePresence>
            {(showHallForm || editingHall) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <form onSubmit={handleSaveHall} className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 bg-[#121E36] rounded-2xl border border-slate-700 shadow-xl">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">اسم القاعة *</label>
                    <input 
                      name="name" 
                      defaultValue={editingHall?.name || ''} 
                      placeholder="مثال: القاعة 01 أو مخبر 1" 
                      required 
                      className="w-full p-2.5 bg-[#182643] border border-slate-700 rounded-xl text-white font-bold outline-none focus:border-cyan-400 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">السعة الاستيعابية (طالب) *</label>
                    <input 
                      type="number" 
                      name="capacity" 
                      defaultValue={editingHall?.capacity || 30} 
                      required 
                      className="w-full p-2.5 bg-[#182643] border border-slate-700 rounded-xl text-white font-bold outline-none focus:border-cyan-400 text-xs" 
                    />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="w-full bg-[#0099FF] text-white font-black py-2.5 rounded-xl hover:bg-sky-500 transition-all text-xs cursor-pointer shadow-md">
                      {editingHall ? 'حفظ التعديلات' : 'إضافة القاعة'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Halls Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {halls.map((hall, idx) => {
              const assignedCount = students.filter(s => s.examHallId === hall.id).length;
              const assignedGroups = examGroups.filter(g => g.hallId === hall.id);

              return (
                <div key={hall.id || idx} className="bg-[#0D162A] p-5 rounded-2xl border border-slate-800 hover:border-cyan-500/50 transition-all group shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#121E36] text-cyan-400 flex items-center justify-center border border-slate-700/80">
                        <DoorOpen size={20} />
                      </div>
                      <div className="flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditingHall(hall); setShowHallForm(true); }} 
                          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="تعديل"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => hall.id && handleDeleteHall(hall.id)} 
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-extrabold text-white text-sm mb-1">{hall.name}</h4>
                    
                    <div className="space-y-1.5 text-xs text-slate-400 mt-2 font-medium">
                      <div className="flex items-center justify-between">
                        <span>السعة:</span>
                        <span className="font-bold text-white">{hall.capacity || 30} طالب</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>المشغول حالياً:</span>
                        <span className={`font-bold ${assignedCount > (hall.capacity || 30) ? 'text-rose-400' : assignedCount > 0 ? 'text-cyan-300' : 'text-slate-500'}`}>
                          {assignedCount} طالب
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    {assignedGroups.length > 0 ? (
                      <div className="text-[11px] font-bold text-cyan-400 truncate" title={assignedGroups.map(g => g.name).join(' | ')}>
                        {assignedGroups[0].name}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-bold">شاغرة / غير مخصصة</span>
                    )}
                  </div>
                </div>
              );
            })}

            {halls.length === 0 && !loading && (
              <div className="col-span-full py-16 text-center text-slate-400 bg-[#0D162A] rounded-3xl border border-slate-800">
                <DoorOpen size={40} className="mx-auto mb-3 text-slate-600" />
                <h4 className="text-base font-bold text-white">لا توجد قاعات مضافة حالياً</h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">اضغط على زر الإضافة السريعة لإضافة 20 قاعة بضغطة واحدة</p>
                <button
                  onClick={handleQuickAdd20Halls}
                  className="bg-[#0099FF] text-white font-black px-5 py-2.5 rounded-xl text-xs hover:bg-sky-500 cursor-pointer shadow-lg inline-flex items-center gap-2"
                >
                  <Sparkles size={16} />
                  إضافة سريعة: 20 قاعة
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STUDENTS & REAL-TIME STATISTICS (FEATURE 2 FROM VIDEO) */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          
          {/* Action Toolbar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0D162A] p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-base font-black text-white">قائمة وبيانات التلاميذ المسجلين</h3>
              <p className="text-xs text-slate-400 mt-0.5">رفع قوائم التلاميذ من الرقمنة وعرض الإحصائيات الشاملة حسب الشعب</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenFileUpload('students')}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-md"
              >
                <Upload size={14} />
                رفع ملف التلاميذ (Excel)
              </button>

              <button
                onClick={handleDownloadStudentTemplate}
                className="flex items-center gap-1.5 bg-[#121E36] hover:bg-[#182643] text-cyan-300 border border-cyan-500/30 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                title="تنزيل قالب إكسل فارغ لملء بيانات التلاميذ"
              >
                <Download size={14} />
                قالب إكسل
              </button>

              <button
                onClick={handleSeedDummyStudents}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                title="توليد قائمة تلاميذ تجريبية مطابقة للشعب الجزائرية"
              >
                <Sparkles size={14} />
                توليد عينة تلاميذ
              </button>

              {students.length > 0 && (
                <button
                  onClick={handleClearAllStudents}
                  className="flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  <Trash2 size={14} />
                  مسح الكل
                </button>
              )}
            </div>
          </div>

          {/* Real-time Statistics Grid matching video */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-[#0D162A] p-4 rounded-2xl border border-slate-800 shadow-lg text-center">
              <span className="text-[11px] text-slate-400 font-bold">إجمالي التلاميذ</span>
              <div className="text-2xl font-black text-white mt-1">{totalStudents}</div>
              <span className="text-[10px] text-cyan-400 font-bold">تلميذ مسجل</span>
            </div>

            <div className="bg-[#0D162A] p-4 rounded-2xl border border-slate-800 shadow-lg text-center">
              <span className="text-[11px] text-slate-400 font-bold">الذكور</span>
              <div className="text-2xl font-black text-sky-400 mt-1">{maleCount}</div>
              <span className="text-[10px] text-slate-400 font-bold">نسبة {malePct}%</span>
            </div>

            <div className="bg-[#0D162A] p-4 rounded-2xl border border-slate-800 shadow-lg text-center">
              <span className="text-[11px] text-slate-400 font-bold">الإناث</span>
              <div className="text-2xl font-black text-pink-400 mt-1">{femaleCount}</div>
              <span className="text-[10px] text-slate-400 font-bold">نسبة {femalePct}%</span>
            </div>

            <div className="bg-[#0D162A] p-4 rounded-2xl border border-slate-800 shadow-lg text-center">
              <span className="text-[11px] text-slate-400 font-bold">السنة الأولى (1 ثا)</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">{firstYearCount}</div>
              <span className="text-[10px] text-slate-400 font-bold">تلميذ</span>
            </div>

            <div className="bg-[#0D162A] p-4 rounded-2xl border border-slate-800 shadow-lg text-center">
              <span className="text-[11px] text-slate-400 font-bold">السنة الثانية (2 ثا)</span>
              <div className="text-2xl font-black text-amber-400 mt-1">{secondYearCount}</div>
              <span className="text-[10px] text-slate-400 font-bold">تلميذ</span>
            </div>

            <div className="bg-[#0D162A] p-4 rounded-2xl border border-slate-800 shadow-lg text-center">
              <span className="text-[11px] text-slate-400 font-bold">السنة الثالثة (3 ثا)</span>
              <div className="text-2xl font-black text-violet-400 mt-1">{thirdYearCount}</div>
              <span className="text-[10px] text-slate-400 font-bold">تلميذ</span>
            </div>

            <div className="bg-[#0D162A] p-4 rounded-2xl border border-slate-800 shadow-lg text-center">
              <span className="text-[11px] text-slate-400 font-bold">القاعات المطلوبة</span>
              <div className="text-2xl font-black text-cyan-400 mt-1">{requiredHallsEstimate}</div>
              <span className="text-[10px] text-slate-400 font-bold">سعة {groupCapacity} طالب</span>
            </div>
          </div>

          {/* Filter Bar & Student Table */}
          <div className="bg-[#0D162A] p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="ابحث برقم التسجيل أو اسم التلميذ..."
                  className="w-full pr-10 pl-4 py-2.5 bg-[#121E36] border border-slate-700 rounded-xl text-white font-bold text-xs outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={studentLevelFilter}
                  onChange={(e) => setStudentLevelFilter(e.target.value as any)}
                  className="p-2.5 bg-[#121E36] border border-slate-700 rounded-xl text-white font-bold text-xs outline-none"
                >
                  <option value="all">جميع المستويات</option>
                  <option value="first">السنة الأولى</option>
                  <option value="second">السنة الثانية</option>
                  <option value="third">السنة الثالثة</option>
                </select>

                <select
                  value={studentStreamFilter}
                  onChange={(e) => setStudentStreamFilter(e.target.value)}
                  className="p-2.5 bg-[#121E36] border border-slate-700 rounded-xl text-white font-bold text-xs outline-none max-w-[200px]"
                >
                  <option value="all">جميع الشعب</option>
                  {uniqueStreams.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-[#121E36] text-slate-300 font-extrabold border-b border-slate-800">
                    <th className="p-3">رقم التسجيل</th>
                    <th className="p-3">اللقب والاسم</th>
                    <th className="p-3">الجنس</th>
                    <th className="p-3">المستوى</th>
                    <th className="p-3">الشعبة</th>
                    <th className="p-3">التخصص الفرعي</th>
                    <th className="p-3">الفوج الامتحاني</th>
                    <th className="p-3">رقم المقعد</th>
                    <th className="p-3 w-14">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredStudents.map((st) => {
                    const group = examGroups.find(g => g.id === st.examGroupId);

                    return (
                      <tr key={st.id} className="hover:bg-[#121E36]/50 transition-colors">
                        <td className="p-3 font-mono text-cyan-300 font-bold">{st.matricule || '-'}</td>
                        <td className="p-3 font-extrabold text-white">{st.name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${st.gender === 'أنثى' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'}`}>
                            {st.gender}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-300">
                          {st.level === 'third' ? 'ثالثة ثانوي' : st.level === 'second' ? 'ثانية ثانوي' : 'أولى ثانوي'}
                        </td>
                        <td className="p-3 text-slate-200 font-bold">{st.stream}</td>
                        <td className="p-3 text-amber-300 font-bold">{st.subSpecialty || '-'}</td>
                        <td className="p-3 font-bold text-cyan-400">
                          {group ? group.name : <span className="text-slate-500">غير مفوج</span>}
                        </td>
                        <td className="p-3 font-mono font-black text-white">
                          {st.seatNumber ? `#${st.seatNumber}` : '-'}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => st.id && handleDeleteSingleStudent(st.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="حذف التلميذ"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredStudents.length === 0 && (
                <div className="py-12 text-center text-slate-400 font-bold text-xs">
                  لا توجد نتائج مطابقة لبحثك
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* TAB 3: EXAM COHORTS & MERGING (FEATURES 3, 4, 5, 6 FROM VIDEO) */}
      {activeTab === 'cohorts' && (
        <div className="space-y-6">
          
          {/* Controls Bar */}
          <div className="bg-[#0D162A] p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h3 className="text-base font-black text-white">إعدادات التفويج وتقسيم الأقسام</h3>
                <p className="text-xs text-slate-400 mt-0.5">تقسيم متوازن للأفواج، دمج الهندسات، والترتيب بالتناوب حسب الجنس</p>
              </div>

              {/* Action Buttons matching Hirasa Pro Video */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-[#121E36] px-3 py-1.5 rounded-xl border border-slate-700">
                  <span className="text-xs font-bold text-slate-300">سعة القاعة:</span>
                  <input
                    type="number"
                    value={groupCapacity}
                    onChange={(e) => setGroupCapacity(Number(e.target.value) || 30)}
                    className="w-14 bg-[#182643] border border-slate-600 rounded-lg p-1 text-center font-bold text-white text-xs outline-none"
                  />
                  <span className="text-xs text-slate-400">طالب</span>
                </div>

                {/* Main Auto Cohort Button */}
                <button
                  onClick={handleAutoCohort}
                  className="flex items-center gap-1.5 bg-[#0099FF] hover:bg-sky-500 text-white font-black px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
                  title="تقسيم التلاميذ تلقائياً إلى أفواج متوازنة وربطها بالقاعات"
                >
                  <Shuffle size={16} />
                  تفويج تلقائي متوازن
                </button>

                {/* FEATURE 4: Merge Technical Math (within each level, keeps فصل المستويات) */}
                <button
                  onClick={handleMergeTechMath}
                  className={`flex items-center gap-1.5 font-black px-4 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer ${
                    mergeTechMath
                      ? 'bg-purple-500 ring-2 ring-purple-300 text-white'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}
                  title="دمج فروع الهندسة (تقني رياضي) داخل كل مستوى مع الحفاظ على فصل المستويات"
                >
                  <Layers size={16} />
                  <span>دمج الهندسات (تقني رياضي)</span>
                  {mergeTechMath && <Check size={14} />}
                </button>

                {/* FEATURE 4: Merge Foreign Languages (within each level, keeps فصل المستويات) */}
                <button
                  onClick={handleMergeLanguages}
                  className={`flex items-center gap-1.5 font-black px-4 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer ${
                    mergeLanguages
                      ? 'bg-teal-500 ring-2 ring-teal-300 text-white'
                      : 'bg-teal-600 hover:bg-teal-500 text-white'
                  }`}
                  title="دمج خيارات اللغات الأجنبية داخل كل مستوى مع الحفاظ على فصل المستويات"
                >
                  <BookOpen size={16} />
                  <span>دمج اللغات الأجنبية</span>
                  {mergeLanguages && <Check size={14} />}
                </button>

                {/* FEATURE 6: Alternate Seating (ذكر / أنثى) */}
                <button
                  onClick={handleAlternateSeating}
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-black px-4 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer"
                  title="إعادة ترتيب جلوس التلاميذ في كل قاعة ليتناوب الذكور والإناث"
                >
                  <UserCheck size={16} />
                  ترتيب بالتناوب (ذكر / أنثى)
                </button>

                <button
                  onClick={handleSeparateCohortsByLevel}
                  className={`flex items-center gap-1.5 font-black px-4 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer ${
                    !mergeTechMath && !mergeLanguages
                      ? 'bg-emerald-500 ring-2 ring-emerald-300 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  title="فصل المستويات والأقسام تماماً بدون خلط (المستوى + الشعبة + القسم)"
                >
                  <ShieldCheck size={16} />
                  <span>فصل المستويات تماماً (عدم الخلط)</span>
                </button>

                <button
                  onClick={handleSortAlphabetically}
                  className="flex items-center gap-1.5 bg-[#121E36] hover:bg-[#182643] text-slate-200 border border-slate-700 font-bold px-3.5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  ترتيب ألفبائي
                </button>

                <button
                  onClick={handleExportHallsExcel}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer"
                  title="تصدير توزيع القاعات والأفواج في ملف Excel"
                >
                  <FileSpreadsheet size={16} />
                  تصدير Excel
                </button>
              </div>
            </div>
          </div>

          {/* Exam Groups List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {examGroups.map((grp) => {
              const groupStudents = students
                .filter(s => s.examGroupId === grp.id)
                .sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0));

              const maleCnt = groupStudents.filter(s => s.gender === 'ذكر').length;
              const femaleCnt = groupStudents.filter(s => s.gender === 'أنثى').length;

              return (
                <div key={grp.id} className="bg-[#0D162A] rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#0099FF]/20 text-cyan-400 rounded-xl">
                          <Users size={18} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-white text-sm">{grp.name}</h4>
                          <span className="text-[11px] text-slate-400 font-bold">{grp.stream}</span>
                        </div>
                      </div>
                      
                      {/* Hall Selector */}
                      <select
                        value={grp.hallId || ''}
                        onChange={async (e) => {
                          const newHallId = e.target.value;
                          const hallObj = halls.find(h => h.id === newHallId);
                          const updatedGroup = { ...grp, hallId: newHallId, hallName: hallObj ? hallObj.name : '' };
                          await api.put(`/api/exam_groups/${grp.id}`, updatedGroup);
                          
                          // Also update students examHallId
                          const updatedStudents = students.map(s => s.examGroupId === grp.id ? { ...s, examHallId: newHallId } : s);
                          await api.delete('/api/students/all');
                          await api.post('/api/students/bulk', { students: updatedStudents });
                          fetchData();
                        }}
                        className="p-1.5 bg-[#121E36] border border-slate-700 rounded-lg text-cyan-300 font-bold text-xs outline-none"
                      >
                        <option value="">اختر القاعة...</option>
                        {halls.map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Group Badges */}
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 mt-2">
                      <span className="bg-[#121E36] px-2 py-1 rounded-md border border-slate-800">
                        العدد: <strong className="text-white">{groupStudents.length}</strong> طالب
                      </span>
                      <span className="bg-sky-950/40 text-sky-300 px-2 py-1 rounded-md border border-sky-800/40">
                        {maleCnt} ذكور
                      </span>
                      <span className="bg-pink-950/40 text-pink-300 px-2 py-1 rounded-md border border-pink-800/40">
                        {femaleCnt} إناث
                      </span>
                    </div>

                    {/* Students list snippet with seat numbers */}
                    <div className="mt-3 max-h-48 overflow-y-auto custom-scrollbar divide-y divide-slate-800/50 bg-[#121E36]/40 p-2 rounded-xl border border-slate-800 text-xs">
                      {groupStudents.map((st) => (
                        <div key={st.id} className="py-1.5 px-2 flex justify-between items-center text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-cyan-400 w-6">#{st.seatNumber || '-'}</span>
                            <span className="font-bold text-white truncate max-w-[150px]">{st.name}</span>
                            {st.subSpecialty && <span className="text-[9px] text-amber-300 font-bold">({st.subSpecialty})</span>}
                          </div>
                          
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${st.gender === 'أنثى' ? 'text-pink-400' : 'text-sky-400'}`}>
                            {st.gender}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold text-[11px]">
                      القاعة: <strong className="text-white">{grp.hallName || 'لم تعين بعد'}</strong>
                    </span>
                    <button
                      onClick={() => {
                        setSelectedHallForCallingList(grp.hallId || 'all');
                        setActiveTab('calling_lists');
                      }}
                      className="text-cyan-400 hover:text-cyan-300 font-bold text-[11px] cursor-pointer"
                    >
                      معاينة قائمة المناداة ←
                    </button>
                  </div>
                </div>
              );
            })}

            {examGroups.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 bg-[#0D162A] rounded-3xl border border-slate-800">
                <Shuffle size={40} className="mx-auto mb-3 text-slate-600" />
                <h4 className="text-base font-bold text-white">لم يتم إنشاء وتفويج الأقسام بعد</h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">اضغط على زر "تفويج تلقائي متوازن" لتقسيم التلاميذ وتوزيعهم على القاعات</p>
                <button
                  onClick={handleAutoCohort}
                  className="bg-[#0099FF] text-white font-black px-5 py-2.5 rounded-xl text-xs hover:bg-sky-500 cursor-pointer shadow-lg inline-flex items-center gap-2"
                >
                  <Shuffle size={16} />
                  تفويج تلقائي متوازن
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 4: PRINTABLE CALLING LISTS & DOOR POSTERS (FEATURE 7 FROM VIDEO) */}
      {activeTab === 'calling_lists' && (
        <div className="space-y-6">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0D162A] p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-base font-black text-white">وثائق القاعات المطبوعة (قوائم المناداة وملصقات الأبواب)</h3>
              <p className="text-xs text-slate-400 mt-0.5">وثائق رسمية مقاس A4 لتعليقها على باب كل قاعة وتسليمها للأساتذة الحراس</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Document Type Selector Toggle */}
              <div className="flex items-center bg-[#121E36] p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setCallingDocType('calling_list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    callingDocType === 'calling_list' ? 'bg-[#0099FF] text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  قائمة المناداة والإمضاء
                </button>
                <button
                  onClick={() => setCallingDocType('door_poster')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    callingDocType === 'door_poster' ? 'bg-[#0099FF] text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ملصق باب القاعة (A4)
                </button>
                <button
                  onClick={() => setCallingDocType('desk_stickers')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    callingDocType === 'desk_stickers' ? 'bg-[#0099FF] text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ملصقات المقاعد والطاولات
                </button>
              </div>

              <select
                value={selectedHallForCallingList}
                onChange={(e) => setSelectedHallForCallingList(e.target.value)}
                className="p-2 bg-[#121E36] border border-slate-700 rounded-xl text-white font-bold text-xs outline-none"
              >
                <option value="all">جميع القاعات دفعة واحدة</option>
                {halls.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>

              <button
                onClick={handleExportHallsExcel}
                className="flex items-center gap-1.5 bg-[#121E36] hover:bg-[#182643] text-emerald-300 border border-emerald-500/30 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                title="تصدير القوائم إلى Excel"
              >
                <FileSpreadsheet size={15} />
                <span>تصدير Excel</span>
              </button>

              <button
                onClick={() => handlePrintCallingLists(selectedHallForCallingList)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-lg transition-all cursor-pointer"
              >
                <Printer size={16} />
                <span>طباعة الوثائق الآن (Print)</span>
              </button>

              <button
                onClick={() => setActiveTab('halls')}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black px-3.5 py-2.5 rounded-xl text-xs shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                title="إغلاق المعاينة والعودة إلى القاعات"
              >
                <X size={16} />
                <span>خروج</span>
              </button>
            </div>
          </div>

          {/* Document Preview Container (Rendered on screen & captured for printing) */}
          <div id="calling-lists-printable" className="bg-slate-900/50 p-4 sm:p-6 rounded-3xl border border-slate-800 space-y-8">
            {halls
              .filter(h => selectedHallForCallingList === 'all' || h.id === selectedHallForCallingList)
              .map((hall, hIdx) => {
                const hallStudents = students
                  .filter(s => s.examHallId === hall.id)
                  .sort((a, b) => {
                    const classA = (a.classGroup || a.stream || '').trim();
                    const classB = (b.classGroup || b.stream || '').trim();
                    const cComp = classA.localeCompare(classB, 'ar', { numeric: true });
                    if (cComp !== 0) return cComp;

                    const seatA = a.seatNumber || 0;
                    const seatB = b.seatNumber || 0;
                    if (seatA !== seatB) return seatA - seatB;
                    return (a.name || '').localeCompare(b.name || '', 'ar');
                  });

                const hallGroup = examGroups.find(g => g.hallId === hall.id);
                const firstStudent = hallStudents[0];
                const lastStudent = hallStudents[hallStudents.length - 1];

                if (callingDocType === 'door_poster') {
                  // A4 DOOR POSTER / PLACARD TEMPLATE MATCHING ALGERIAN MINISTRY STANDARDS
                  return (
                    <div 
                      key={`door-${hall.id || hIdx}`}
                      className="bg-white text-black p-8 font-sans max-w-3xl mx-auto rounded-xl shadow-2xl border-4 border-black print-card mb-8 print-page-break flex flex-col justify-between"
                      style={{ direction: 'rtl', color: '#000000', backgroundColor: '#ffffff', minHeight: '800px' }}
                    >
                      {/* Top Header */}
                      <div className="text-center space-y-2 pb-6 border-b-4 border-black">
                        <div className="flex justify-center mb-2">
                          <svg width="60" height="40" viewBox="0 0 900 600" className="border border-gray-300 rounded shadow-md">
                            <rect width="450" height="600" fill="#006233"/>
                            <rect x="450" width="450" height="600" fill="#ffffff"/>
                            <circle cx="450" cy="300" r="180" fill="#d21034"/>
                            <circle cx="500" cy="300" r="144" fill="#ffffff"/>
                            <polygon points="480,300 575,269 516,350 516,250 575,331" fill="#d21034"/>
                          </svg>
                        </div>
                        <h2 className="text-base font-black text-black">الجمهورية الجزائرية الديمقراطية الشعبية</h2>
                        <h3 className="text-sm font-extrabold text-gray-900">وزارة التربية الوطنية - مديرية التربية لولاية {wilaya}</h3>
                        <h4 className="text-sm font-bold text-gray-800">{institutionName} | السنة الدراسية: {schoolYear}</h4>
                      </div>

                      {/* Main Hall Big Title Badge */}
                      <div className="my-8 text-center">
                        <div className="inline-block bg-sky-50 border-4 border-[#0099FF] px-10 py-5 rounded-2xl shadow-md">
                          <h1 className="text-3xl font-black text-[#0099FF] tracking-wide">
                            {hall.name}
                          </h1>
                          <p className="text-sm font-black text-black mt-1">
                            سعة القاعة: {hall.capacity || 30} مقعد
                          </p>
                        </div>
                      </div>

                      {/* Stream & Student Info Box */}
                      <div className="space-y-6 border-2 border-black p-6 rounded-2xl bg-gray-50 text-black">
                        <div className="flex justify-between items-center text-base font-black border-b-2 border-gray-300 pb-3">
                          <span>المستوى والشعبة المعنية:</span>
                          <span className="text-[#0099FF]">{hallGroup ? hallGroup.name : 'جميع الشعب المعنية'}</span>
                        </div>

                        <div className="flex justify-between items-center text-base font-black border-b-2 border-gray-300 pb-3">
                          <span>عدد التلاميذ الموزعين بالقاعة:</span>
                          <span className="font-mono text-xl">{hallStudents.length} تلميذ</span>
                        </div>

                        <div className="flex justify-between items-center text-base font-black border-b-2 border-gray-300 pb-3">
                          <span>نطاق المقاعد بالقاعة:</span>
                          <span className="font-mono text-xl text-emerald-700">
                            من المقعد #01 إلى المقعد #{hallStudents.length || 30}
                          </span>
                        </div>

                        {hallStudents.length > 0 && (
                          <div className="space-y-2 pt-2 text-sm font-extrabold">
                            <div className="flex justify-between">
                              <span className="text-gray-700">من التلميذ(ة):</span>
                              <span className="text-black">{firstStudent?.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-700">إلى التلميذ(ة):</span>
                              <span className="text-black">{lastStudent?.name}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Note & Official Signature */}
                      <div className="mt-12 pt-6 border-t-2 border-black flex justify-between items-end text-sm font-black">
                        <div>
                          <span>ملاحظة: يُرجى الالتزام التام برقم المقعد المحدد والهدوء أثناء الامتحان</span>
                        </div>
                        <div className="text-center space-y-6 pl-4">
                          <div>تأشيرة وتوقيع مدير المؤسسة</div>
                          <div className="h-10"></div>
                        </div>
                      </div>

                    </div>
                  );
                }

                if (callingDocType === 'desk_stickers') {
                  // A4 DESK STICKERS TEMPLATE (ملصقات الطاولات والمقاعد)
                  const pageSize = 8;
                  const pagesCount = Math.max(1, Math.ceil(hallStudents.length / pageSize));
                  const pages = [];
                  for (let p = 0; p < pagesCount; p++) {
                    pages.push(hallStudents.slice(p * pageSize, (p + 1) * pageSize));
                  }

                  return (
                    <div key={`stickers-hall-${hall.id || hIdx}`} className="space-y-8">
                      {pages.map((pageStudents, pIdx) => (
                        <div
                          key={`stickers-page-${hall.id || hIdx}-${pIdx}`}
                          className="bg-white text-black p-6 font-sans max-w-4xl mx-auto rounded-xl shadow-2xl border border-gray-300 print-card mb-8 print-page-break"
                          style={{ direction: 'rtl', color: '#000000', backgroundColor: '#ffffff' }}
                        >
                          {/* Page Sub-header */}
                          <div className="flex justify-between items-center pb-3 mb-4 border-b-2 border-black text-xs font-bold text-gray-900">
                            <div className="flex items-center gap-2">
                              <span className="bg-[#0099FF] text-white px-2.5 py-1 rounded-lg font-black text-xs">
                                {hall.name}
                              </span>
                              <span>ملصقات طاولات ومقاعد الامتحان — صفحة {pIdx + 1} من {pagesCount}</span>
                            </div>
                            <div>{institutionName} | السنة الدراسية: {schoolYear}</div>
                            <div className="bg-gray-100 px-3 py-1 rounded border border-gray-400 font-mono">
                              {hallGroup ? hallGroup.name : 'عام'}
                            </div>
                          </div>

                          {/* 2 columns x 4 rows grid of stickers */}
                          <div className="grid grid-cols-2 gap-3.5">
                            {pageStudents.map((st, sIdx) => {
                              const overallIdx = pIdx * pageSize + sIdx;
                              return (
                                <div
                                  key={st.id || overallIdx}
                                  className="p-3.5 rounded-xl border-2 border-dashed border-gray-800 bg-gray-50/80 flex flex-col justify-between"
                                  style={{ minHeight: '140px', pageBreakInside: 'avoid', breakInside: 'avoid' }}
                                >
                                  {/* Sticker top */}
                                  <div className="flex justify-between items-start border-b border-gray-300 pb-1.5 mb-2">
                                    <div className="text-[10px] font-black text-gray-800 leading-tight">
                                      <div>{institutionName}</div>
                                      <div className="text-[9px] text-gray-500 font-bold">امتحانات {selectedTerm}</div>
                                    </div>
                                    <div className="bg-[#0099FF] text-white px-2 py-0.5 rounded font-black text-xs">
                                      {hall.name}
                                    </div>
                                  </div>

                                  {/* Student info */}
                                  <div className="space-y-1">
                                    <div className="text-sm font-black text-black leading-snug">{st.name}</div>
                                    <div className="text-xs font-extrabold text-gray-700 truncate" title={st.stream}>
                                      {st.stream} {st.subSpecialty ? `(${st.subSpecialty})` : ''}
                                    </div>
                                    <div className="text-[10px] font-mono font-bold text-gray-600">
                                      رقم التسجيل: {st.matricule || '-'} | الفوج: {st.classGroup || '-'}
                                    </div>
                                  </div>

                                  {/* Seat badge */}
                                  <div className="mt-2 pt-2 border-t border-gray-300 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-500">طاولة رقم</span>
                                    <div className="bg-black text-white px-3 py-0.5 rounded-lg font-mono font-black text-sm">
                                      #{String(st.seatNumber || (overallIdx + 1)).padStart(2, '0')}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Footer cutting guide note */}
                          <div className="mt-4 pt-2 border-t border-gray-300 text-center text-[10px] text-gray-500 font-bold">
                            ✂ قص الملصق بمحاذاة الخط المتقطع وإلصاقه على زاوية طاولة الامتحان المخصصة للتلميذ
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                // Standard Calling List Template
                return (
                  <div 
                    key={hall.id || hIdx}
                    className="bg-white text-black p-8 font-sans max-w-4xl mx-auto rounded-xl shadow-2xl border border-gray-300 print-card mb-8 print-page-break"
                    style={{ direction: 'rtl', color: '#000000', backgroundColor: '#ffffff' }}
                  >
                    {/* Header */}
                    <div className="text-center space-y-1 pb-4 border-b-2 border-black">
                      <div className="flex justify-center mb-1">
                        <svg width="42" height="28" viewBox="0 0 900 600" className="border border-gray-300 rounded shadow-sm">
                          <rect width="450" height="600" fill="#006233"/>
                          <rect x="450" width="450" height="600" fill="#ffffff"/>
                          <circle cx="450" cy="300" r="180" fill="#d21034"/>
                          <circle cx="500" cy="300" r="144" fill="#ffffff"/>
                          <polygon points="480,300 575,269 516,350 516,250 575,331" fill="#d21034"/>
                        </svg>
                      </div>
                      <h2 className="text-sm font-black text-gray-900">الجمهورية الجزائرية الديمقراطية الشعبية</h2>
                      <h3 className="text-xs font-bold text-gray-800">وزارة التربية الوطنية - مديرية التربية لولاية {wilaya}</h3>
                      <h4 className="text-xs font-bold text-gray-800">{institutionName} | السنة الدراسية: {schoolYear}</h4>
                      
                      <div className="pt-2">
                        <div className="inline-block bg-gray-100 border-2 border-black px-6 py-1.5 rounded-lg">
                          <h1 className="text-base font-black text-black">
                            قائمة المناداة وإمضاء حضور التلاميذ — {hall.name}
                          </h1>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs font-bold text-gray-900 pt-2 px-2">
                        <span>الشعبة / الفوج: <strong>{hallGroup ? hallGroup.name : 'عام'}</strong></span>
                        <span>عدد التلاميذ: <strong>{hallStudents.length} تلميذ</strong></span>
                        <span>سعة القاعة: <strong>{hall.capacity || 30} مقعد</strong></span>
                      </div>
                    </div>

                    {/* Calling Table */}
                    <div className="mt-4">
                      <table className="w-full text-center border-collapse border-2 border-black text-xs">
                        <thead>
                          <tr className="bg-gray-100 font-extrabold border-b-2 border-black">
                            <th className="border-2 border-black p-2 w-16">رقم المقعد</th>
                            <th className="border-2 border-black p-2 w-28">رقم التسجيل</th>
                            <th className="border-2 border-black p-2 text-right pr-4">اللقب والاسم</th>
                            <th className="border-2 border-black p-2 w-24">الفوج الأصلي</th>
                            <th className="border-2 border-black p-2 w-32">إمضاء التلميذ</th>
                            <th className="border-2 border-black p-2 w-20">الملاحظة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hallStudents.length > 0 ? (
                            hallStudents.map((st, sIdx) => (
                              <tr key={st.id || sIdx} className="border-b border-black">
                                <td className="border-2 border-black p-2 font-mono font-black text-sm">{st.seatNumber || (sIdx + 1)}</td>
                                <td className="border-2 border-black p-2 font-mono font-bold text-xs">{st.matricule || '-'}</td>
                                <td className="border-2 border-black p-2 font-black text-sm text-right pr-4">
                                  {st.name} {st.subSpecialty && <span className="text-[10px] text-gray-600 font-normal">({st.subSpecialty})</span>}
                                </td>
                                <td className="border-2 border-black p-2 font-bold text-xs">{st.classGroup || '-'}</td>
                                <td className="border-2 border-black p-2 h-9"></td>
                                <td className="border-2 border-black p-2 font-bold text-xs">حاضر</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-gray-500 font-bold">
                                لا يوجد تلاميذ معينين في هذه القاعة حالياً. قم بإجراء التفويج التلقائي.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Signatures Footer */}
                    <div className="mt-8 pt-4 border-t border-gray-400 grid grid-cols-3 gap-4 text-xs font-bold text-gray-900 text-center">
                      <div className="space-y-8">
                        <div>إحصاء الحضور:</div>
                        <div className="font-normal text-[11px]">الحاضرون: ...... | الغائبون: ......</div>
                      </div>
                      <div className="space-y-8">
                        <div>توقيع الأساتذة الحراس:</div>
                        <div className="h-6"></div>
                      </div>
                      <div className="space-y-8">
                        <div>تأشيرة رئيس المركز / مدير المؤسسة:</div>
                        <div className="h-6"></div>
                      </div>
                    </div>

                  </div>
                );
              })}
          </div>

        </div>
      )}
      {/* TAB 5: TIMETABLE PER HALL (FEATURE 8 FROM VIDEO) */}
      {activeTab === 'timetables' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-[#0D162A] p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-base font-black text-white">معاينة جداول سير الامتحانات بالقاعات</h3>
              <p className="text-xs text-slate-400 mt-0.5">جدول الرزنامة والمواد المبرمجة بكل قاعة لتعليقه على باب القاعة</p>
            </div>

            <button
              onClick={handlePrintHallTimetables}
              className="flex items-center gap-2 bg-[#0099FF] hover:bg-sky-500 text-white font-black px-4 py-2 rounded-xl text-xs cursor-pointer shadow-md"
            >
              <Printer size={15} />
              <span>طباعة الجداول</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {halls.map((hall) => {
              const assignedGroups = examGroups.filter(g => g.hallId === hall.id);

              return (
                <div key={hall.id} className="bg-[#0D162A] p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#0099FF]/20 text-cyan-400 flex items-center justify-center font-bold">
                        <DoorOpen size={16} />
                      </div>
                      <h4 className="font-extrabold text-white text-sm">{hall.name}</h4>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">السعة: {hall.capacity || 30} طالب</span>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-cyan-300 block mb-2">الأفواج والشعب المعنية في القاعة:</span>
                    {assignedGroups.length > 0 ? (
                      <div className="space-y-1.5">
                        {assignedGroups.map(g => (
                          <div key={g.id} className="bg-[#121E36] p-2.5 rounded-xl border border-slate-700/60 flex justify-between items-center text-xs font-bold">
                            <span className="text-white">{g.name}</span>
                            <span className="text-cyan-400 font-mono">{g.studentCount || 0} طالب</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 font-bold">لم تعين أفواج لهذه القاعة بعد</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <span className="text-xs font-bold text-slate-400 block mb-2">رزنامة المواد المبرمجة:</span>
                    <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar text-[11px]">
                      {exams.slice(0, 5).map(e => (
                        <div key={e.id} className="flex justify-between items-center p-1.5 bg-[#121E36]/50 rounded-lg text-slate-300">
                          <span className="font-bold text-white">{e.subject}</span>
                          <span className="font-mono text-cyan-300">{e.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <ExcelImportModal 
        isOpen={isImportModalOpen}
        onClose={() => { setIsImportModalOpen(false); setFileBuffer(null); }}
        fileBuffer={fileBuffer}
        title={importTarget === 'halls' ? "استيراد القاعات" : "استيراد قائمة التلاميذ"}
        expectedColumns={importTarget === 'halls' ? [
          { key: 'name', label: 'اسم القاعة', required: true, aliases: ['اسم القاعة', 'القاعة', 'اسم', 'hall', 'name', 'salle'] },
          { key: 'capacity', label: 'السعة (طالب)', aliases: ['السعة', 'سعة القاعة', 'capacity', 'capacite'] }
        ] : [
          { key: 'name', label: 'اللقب والاسم (أو الاسم الكامل)', required: true, aliases: ['اللقب والاسم', 'الاسم واللقب', 'اسم التلميذ', 'التلميذ', 'الاسم الكامل', 'الاسم واللقب والتخصص', 'اللقب والاسم القسم', 'name', 'student', 'eleve', 'full_name'] },
          { key: 'lastName', label: 'اللقب (إن وجد منفصلاً)', aliases: ['اللقب', 'nom', 'last_name', 'family_name'] },
          { key: 'firstName', label: 'الاسم (إن وجد منفصلاً)', aliases: ['الاسم', 'prenom', 'first_name', 'given_name'] },
          { key: 'matricule', label: 'رقم التسجيل', aliases: ['رقم التسجيل', 'رقم التعريف', 'رقم التعريف المدرسي', 'الرقم', 'matricule', 'id', 'num', 'n_eleve'] },
          { key: 'gender', label: 'الجنس', aliases: ['الجنس', 'النوع', 'gender', 'sexe', 'sexe_eleve'] },
          { key: 'level', label: 'المستوى', aliases: ['المستوى', 'السنة', 'المستوى الدراسي', 'level', 'grade', 'niveau'] },
          { key: 'stream', label: 'الشعبة', aliases: ['الشعبة', 'التخصص', 'شعبة الدراسة', 'stream', 'filiere', 'serie'] },
          { key: 'classGroup', label: 'القسم / الفوج الأصلي', aliases: ['القسم', 'الفوج التربوي', 'الفوج', 'الصف', 'class', 'group', 'classe'] },
          { key: 'subSpecialty', label: 'التخصص الفرعي', aliases: ['التخصص الفرعي', 'الخيار', 'المادة الاختيارية', 'subSpecialty', 'option'] },
        ]}
        onConfirm={handleConfirmImport}
      />

      {/* Clear All Students Confirmation Modal */}
      {isClearStudentsModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md print:hidden">
          <div className="bg-[#121E36] border border-rose-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100">
            <div className="p-4 bg-rose-600/20 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm text-white">تأكيد مسح بيانات التلاميذ</h4>
                  <p className="text-xs text-rose-200 mt-0.5">إجمالي التلاميذ المسجلين: {students.length} تلميذ</p>
                </div>
              </div>
              <button
                type="button"
                disabled={clearBusy}
                onClick={() => setIsClearStudentsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                هل أنت متأكد من مسح جميع بيانات التلاميذ والأفواج الامتحانية؟ لا يمكن التراجع عن هذه العملية بعد تنفيذها.
              </p>

              {filteredStudents.length > 0 && filteredStudents.length < students.length && (
                <button
                  type="button"
                  disabled={clearBusy}
                  onClick={() => executeClearStudents('filtered')}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40 font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <span>مسح التلاميذ المصفّين في الجدول فقط</span>
                  <span className="bg-amber-500/25 px-2.5 py-0.5 rounded-full font-mono text-[11px]">{filteredStudents.length} تلميذ</span>
                </button>
              )}
            </div>

            <div className="p-4 bg-[#091021] border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={clearBusy}
                onClick={() => setIsClearStudentsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={clearBusy}
                onClick={() => executeClearStudents('all')}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={15} />
                <span>{clearBusy ? 'جاري المسح...' : `نعم، مسح الكل (${students.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Confirmation Modal (Halls clear/delete/init) */}
      {confirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md print:hidden">
          <div className="bg-[#121E36] border border-rose-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100">
            <div className="p-4 bg-rose-600/20 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <h4 className="font-black text-sm text-white">{confirmModal.title}</h4>
              </div>
              <button
                type="button"
                disabled={clearBusy}
                onClick={() => setConfirmModal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 text-xs text-slate-300 leading-relaxed">
              {confirmModal.description}
            </div>

            <div className="p-4 bg-[#091021] border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={clearBusy}
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={clearBusy}
                onClick={async () => {
                  setClearBusy(true);
                  try {
                    await confirmModal.onConfirm();
                    setConfirmModal(null);
                  } finally {
                    setClearBusy(false);
                  }
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={15} />
                <span>{clearBusy ? 'جاري التنفيذ...' : confirmModal.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
