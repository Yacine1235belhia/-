import { isDemoTeacher } from './constants';

export const getToken = () => localStorage.getItem("auth_token");
export const setToken = (token: string) => localStorage.setItem("auth_token", token);
export const removeToken = () => localStorage.removeItem("auth_token");

export const getUser = () => {
  const user = localStorage.getItem("auth_user");
  return user ? JSON.parse(user) : { username: 'الناظر', role: 'ناظر' };
};
export const setUser = (user: any) => localStorage.setItem("auth_user", JSON.stringify(user));
export const removeUser = () => localStorage.removeItem("auth_user");

const SAVED_SNAPSHOT_KEY = 'hirasa_saved_snapshot_v1';
const PENDING_SYNC_KEY = 'hirasa_pending_server_sync';
const DIRTY_KEY = 'hirasa_workspace_dirty';
export const WORKSPACE_STATUS_EVENT = 'hirasa:workspace-status';

export interface SavedWorkspaceSnapshot {
  savedAt: string;
  settings: Record<string, any>;
  teachers: any[];
  halls: any[];
  exams: any[];
  assignments: any[];
  students: any[];
  exam_groups: any[];
  daysSchedule: any[] | null;
  streamSubjects: Record<string, string[]> | null;
}

export interface WorkspaceStatus {
  hasUnsavedChanges: boolean;
  hasSavedSnapshot: boolean;
  savedAt: string | null;
  pendingSync: boolean;
}

const delay = (ms = 40) => new Promise(r => setTimeout(r, ms));

export const parseLocalDate = (str: string): Date => {
  if (!str) return new Date();
  const parts = str.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getDb = (table: string): any[] => {
  const data = localStorage.getItem(`db_${table}`);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const setDb = (table: string, data: any[]) => {
  localStorage.setItem(`db_${table}`, JSON.stringify(data));
};

const getObjDb = (table: string): Record<string, any> => {
  const data = localStorage.getItem(`db_${table}`);
  if (!data) return {};
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const setObjDb = (table: string, data: Record<string, any>) => {
  localStorage.setItem(`db_${table}`, JSON.stringify(data));
};

// Initialize admin account entry only (never seed workspace data automatically)
if (!localStorage.getItem('db_accounts')) {
  setDb('accounts', [{ id: '1', username: 'admin', password: 'password123', role: 'مدير' }]);
}

export const getDefaultExams = () => {
  const settings = getObjDb('settings');

  const startDate = settings.examStartDate ? parseLocalDate(settings.examStartDate) : new Date();
  const endDate = settings.examEndDate ? parseLocalDate(settings.examEndDate) : null;

  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const workingDays: string[] = [];

  while (workingDays.length < 15) {
    const dayOfWeek = cur.getDay();
    if (dayOfWeek !== 5 && dayOfWeek !== 6) {
      workingDays.push(formatLocalDate(cur));
      if (endDate && cur >= endDate && workingDays.length >= 5) {
        break;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  const d1 = workingDays[0] || '2025-12-07';
  const d2 = workingDays[1] || '2025-12-08';
  const d3 = workingDays[2] || '2025-12-09';
  const d4 = workingDays[3] || '2025-12-10';

  return [
    { id: 'ex_1_sc_1', subject: 'الرياضيات', date: d1, period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },
    { id: 'ex_1_sc_2', subject: 'العلوم الإسلامية', date: d1, period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },
    { id: 'ex_1_sc_3', subject: 'التاريخ والجغرافيا', date: d2, period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },
    { id: 'ex_1_sc_4', subject: 'العلوم الفيزيائية', date: d3, period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },
    { id: 'ex_1_sc_5', subject: 'اللغة الإنجليزية', date: d3, period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },
    { id: 'ex_1_sc_6', subject: 'اللغة العربية وآدابها', date: d4, period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },

    { id: 'ex_1_ar_1', subject: 'اللغة العربية وآدابها', date: d1, period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },
    { id: 'ex_1_ar_2', subject: 'العلوم الإسلامية', date: d1, period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },
    { id: 'ex_1_ar_3', subject: 'التاريخ والجغرافيا', date: d2, period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },
    { id: 'ex_1_ar_4', subject: 'الرياضيات', date: d3, period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },
    { id: 'ex_1_ar_5', subject: 'اللغة الإنجليزية', date: d3, period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },
    { id: 'ex_1_ar_6', subject: 'اللغة الفرنسية', date: d4, period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },

    { id: 'ex_2_mt_1', subject: 'الرياضيات', date: d1, period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية تقني رياضي' },
    { id: 'ex_2_mt_2', subject: 'العلوم الإسلامية', date: d1, period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية تقني رياضي' },
    { id: 'ex_2_mt_3', subject: 'التاريخ والجغرافيا', date: d2, period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية تقني رياضي' },
    { id: 'ex_2_mt_4', subject: 'العلوم الفيزيائية', date: d3, period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية تقني رياضي' },
    { id: 'ex_2_mt_5', subject: 'اللغة الإنجليزية', date: d3, period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية تقني رياضي' },

    { id: 'ex_2_sc_1', subject: 'الرياضيات', date: d1, period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية علوم تجريبية' },
    { id: 'ex_2_sc_2', subject: 'العلوم الإسلامية', date: d1, period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية علوم تجريبية' },
    { id: 'ex_2_sc_3', subject: 'التاريخ والجغرافيا', date: d2, period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية علوم تجريبية' },

    { id: 'ex_3_sc_1', subject: 'علوم الطبيعة والحياة', date: d1, period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة علوم تجريبية' },
    { id: 'ex_3_sc_2', subject: 'العلوم الإسلامية', date: d1, period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'third', stream: 'ثالثة علوم تجريبية' },
    { id: 'ex_3_sc_3', subject: 'الرياضيات', date: d2, period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة علوم تجريبية' },
    { id: 'ex_3_ph_1', subject: 'الفلسفة', date: d1, period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة آداب وفلسفة' },
  ];
};

export const getWorkspaceStatus = (): WorkspaceStatus => {
  let savedAt: string | null = null;
  let hasSavedSnapshot = false;
  const savedRaw = localStorage.getItem(SAVED_SNAPSHOT_KEY);
  if (savedRaw) {
    try {
      const parsed = JSON.parse(savedRaw);
      if (parsed && typeof parsed === 'object') {
        hasSavedSnapshot = true;
        savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : null;
      }
    } catch {
      hasSavedSnapshot = false;
    }
  }
  return {
    hasUnsavedChanges: localStorage.getItem(DIRTY_KEY) === '1',
    hasSavedSnapshot,
    savedAt,
    pendingSync: localStorage.getItem(PENDING_SYNC_KEY) === '1',
  };
};

const emitWorkspaceStatus = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKSPACE_STATUS_EVENT, { detail: getWorkspaceStatus() }));
  }
};

export const markWorkspaceDirty = () => {
  localStorage.setItem(DIRTY_KEY, '1');
  emitWorkspaceStatus();
};

const clearWorkspaceDirty = () => {
  localStorage.setItem(DIRTY_KEY, '0');
  emitWorkspaceStatus();
};

function createEmptySnapshot(): SavedWorkspaceSnapshot {
  return {
    savedAt: '',
    settings: {},
    teachers: [],
    halls: [],
    exams: [],
    assignments: [],
    students: [],
    exam_groups: [],
    daysSchedule: null,
    streamSubjects: null,
  };
}

function applySnapshotToLocalStorage(snapshot: SavedWorkspaceSnapshot) {
  setObjDb('settings', snapshot.settings || {});
  setDb('teachers', Array.isArray(snapshot.teachers) ? snapshot.teachers : []);
  setDb('halls', Array.isArray(snapshot.halls) ? snapshot.halls : []);
  setDb('exams', Array.isArray(snapshot.exams) ? snapshot.exams : []);
  setDb('assignments', Array.isArray(snapshot.assignments) ? snapshot.assignments : []);
  setDb('students', Array.isArray(snapshot.students) ? snapshot.students : []);
  setDb('exam_groups', Array.isArray(snapshot.exam_groups) ? snapshot.exam_groups : []);

  localStorage.setItem('hirasa_exams', JSON.stringify(Array.isArray(snapshot.exams) ? snapshot.exams : []));
  localStorage.removeItem('hirasa_db_students');
  localStorage.removeItem('hirasa_db_exam_groups');

  if (Array.isArray(snapshot.daysSchedule)) {
    localStorage.setItem('hirasa_days_schedule', JSON.stringify(snapshot.daysSchedule));
  } else {
    localStorage.removeItem('hirasa_days_schedule');
  }

  if (snapshot.streamSubjects && typeof snapshot.streamSubjects === 'object') {
    localStorage.setItem('hirasa_stream_subjects', JSON.stringify(snapshot.streamSubjects));
  } else {
    localStorage.removeItem('hirasa_stream_subjects');
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };
    return await fetch(url, {
      ...options,
      headers,
      signal: controller?.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function pushSnapshotToServer(snapshot: SavedWorkspaceSnapshot): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  try {
    const res = await fetchWithTimeout(
      '/api/workspace/restore',
      {
        method: 'POST',
        body: JSON.stringify({
          settings: snapshot.settings,
          teachers: snapshot.teachers,
          halls: snapshot.halls,
          exams: snapshot.exams,
          assignments: snapshot.assignments,
          students: snapshot.students,
          exam_groups: snapshot.exam_groups,
        }),
      },
      15000
    );
    return res.ok;
  } catch {
    return false;
  }
}

let bootPromise: Promise<void> | null = null;

export const initializeWorkspaceOnBoot = async (): Promise<void> => {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    const savedRaw = localStorage.getItem(SAVED_SNAPSHOT_KEY);
    let snapshot: SavedWorkspaceSnapshot;

    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw);
        snapshot = {
          savedAt: parsed.savedAt || new Date().toISOString(),
          settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
          teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
          halls: Array.isArray(parsed.halls) ? parsed.halls : [],
          exams: Array.isArray(parsed.exams) ? parsed.exams : [],
          assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
          students: Array.isArray(parsed.students) ? parsed.students : [],
          exam_groups: Array.isArray(parsed.exam_groups) ? parsed.exam_groups : [],
          daysSchedule: Array.isArray(parsed.daysSchedule) ? parsed.daysSchedule : null,
          streamSubjects: parsed.streamSubjects && typeof parsed.streamSubjects === 'object' ? parsed.streamSubjects : null,
        };
      } catch {
        snapshot = createEmptySnapshot();
      }
    } else {
      // Nothing explicitly saved -> start completely empty
      snapshot = createEmptySnapshot();
    }

    applySnapshotToLocalStorage(snapshot);
    localStorage.setItem(DIRTY_KEY, '0');

    const ok = await pushSnapshotToServer(snapshot);
    if (ok) {
      localStorage.removeItem(PENDING_SYNC_KEY);
    }

    emitWorkspaceStatus();
  })();

  return bootPromise;
};

export const saveWorkspaceSnapshot = async (): Promise<{ syncedOnline: boolean; snapshot: SavedWorkspaceSnapshot }> => {
  let serverData: Record<string, any> | null = null;
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (!isOffline) {
    try {
      const res = await fetchWithTimeout('/api/workspace/snapshot', { method: 'GET' }, 15000);
      if (res.ok) {
        serverData = await res.json();
      }
    } catch {
      serverData = null;
    }
  }

  let daysSchedule: any[] | null = null;
  try {
    const rawDays = localStorage.getItem('hirasa_days_schedule');
    if (rawDays) {
      const parsedDays = JSON.parse(rawDays);
      if (Array.isArray(parsedDays)) daysSchedule = parsedDays;
    }
  } catch {
    daysSchedule = null;
  }

  let streamSubjects: Record<string, string[]> | null = null;
  try {
    const rawSubjects = localStorage.getItem('hirasa_stream_subjects');
    if (rawSubjects) {
      const parsedSubjects = JSON.parse(rawSubjects);
      if (parsedSubjects && typeof parsedSubjects === 'object') streamSubjects = parsedSubjects;
    }
  } catch {
    streamSubjects = null;
  }

  const snapshot: SavedWorkspaceSnapshot = {
    savedAt: new Date().toISOString(),
    settings: serverData?.settings && typeof serverData.settings === 'object' ? serverData.settings : getObjDb('settings'),
    teachers: Array.isArray(serverData?.teachers) ? serverData.teachers : getDb('teachers'),
    halls: Array.isArray(serverData?.halls) ? serverData.halls : getDb('halls'),
    exams: Array.isArray(serverData?.exams) ? serverData.exams : getDb('exams'),
    assignments: Array.isArray(serverData?.assignments) ? serverData.assignments : getDb('assignments'),
    students: Array.isArray(serverData?.students) ? serverData.students : getDb('students'),
    exam_groups: Array.isArray(serverData?.exam_groups) ? serverData.exam_groups : getDb('exam_groups'),
    daysSchedule,
    streamSubjects,
  };

  localStorage.setItem(SAVED_SNAPSHOT_KEY, JSON.stringify(snapshot));
  applySnapshotToLocalStorage(snapshot);

  const syncedOnline = await pushSnapshotToServer(snapshot);
  if (syncedOnline) {
    localStorage.removeItem(PENDING_SYNC_KEY);
  } else {
    localStorage.setItem(PENDING_SYNC_KEY, '1');
  }

  clearWorkspaceDirty();
  return { syncedOnline, snapshot };
};

export const syncPendingWorkspaceIfOnline = async (): Promise<boolean> => {
  if (localStorage.getItem(PENDING_SYNC_KEY) !== '1') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;

  const savedRaw = localStorage.getItem(SAVED_SNAPSHOT_KEY);
  if (!savedRaw) {
    localStorage.removeItem(PENDING_SYNC_KEY);
    emitWorkspaceStatus();
    return false;
  }

  try {
    const snapshot = JSON.parse(savedRaw) as SavedWorkspaceSnapshot;
    const ok = await pushSnapshotToServer(snapshot);
    if (ok) {
      localStorage.removeItem(PENDING_SYNC_KEY);
      emitWorkspaceStatus();
      return true;
    }
  } catch {
    return false;
  }
  return false;
};

export const clearSavedWorkspace = async (): Promise<void> => {
  localStorage.removeItem(SAVED_SNAPSHOT_KEY);
  localStorage.removeItem(PENDING_SYNC_KEY);
  const empty = createEmptySnapshot();
  applySnapshotToLocalStorage(empty);
  localStorage.setItem(DIRTY_KEY, '0');
  await pushSnapshotToServer(empty);
  emitWorkspaceStatus();
};

const mockResponse = async (handler: () => any) => {
  await delay(15);
  try {
    return await handler();
  } catch (e: any) {
    throw new Error(e.message || "Request failed");
  }
};

const fetchOrMock = async (
  url: string,
  options: RequestInit = {},
  mockHandler: (serverResult?: any) => any,
  opts: { timeoutMs?: number; mirrorOnSuccess?: boolean } = {}
) => {
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (!isOffline) {
    try {
      const response = await fetchWithTimeout(url, options, opts.timeoutMs ?? 5000);
      if (response.ok) {
        const json = await response.json();
        if (opts.mirrorOnSuccess) {
          try {
            mockHandler(json);
          } catch {
            // Keep server result even if local mirror fails
          }
        }
        return json;
      }
    } catch {
      // Network, timeout, or server unreachable -> fall back cleanly to localStorage
    }
  }
  return mockResponse(() => mockHandler());
};

export const api = {
  get: async (url: string) => {
    const tableFromUrl = url.replace('/api/', '').split('?')[0];
    return fetchOrMock(
      url,
      { method: 'GET' },
      (serverResult?: any) => {
        if (serverResult !== undefined) {
          if (url === '/api/settings' && serverResult && typeof serverResult === 'object') {
            setObjDb('settings', serverResult);
          } else if (
            ['teachers', 'halls', 'exams', 'assignments', 'students', 'exam_groups'].includes(tableFromUrl) &&
            Array.isArray(serverResult)
          ) {
            setDb(tableFromUrl, serverResult);
          }
          return serverResult;
        }
        if (url === '/api/settings') return getObjDb('settings');
        if (url === '/api/teachers') return getDb('teachers');
        if (url === '/api/halls') return getDb('halls');
        if (url === '/api/exams') return getDb('exams');
        if (url === '/api/assignments') return getDb('assignments');
        if (url === '/api/students') return getDb('students');
        if (url === '/api/exam_groups') return getDb('exam_groups');
        throw new Error(`Not found: GET ${url}`);
      },
      { mirrorOnSuccess: true }
    );
  },

  post: async (url: string, data: any) => {
    const isAuthRoute = url === '/api/login' || url === '/api/register';
    const isWorkspaceRoute = url.startsWith('/api/workspace/');
    const timeoutMs = url.includes('/bulk') || isWorkspaceRoute ? 20000 : 5000;

    const res = await fetchOrMock(
      url,
      { method: 'POST', body: JSON.stringify(data) },
      (serverResult?: any) => {
        if (url === '/api/login') {
          const accounts = getDb('accounts');
          let user = accounts.find((a: any) => a.username.toLowerCase() === (data.username || "").toLowerCase());
          if (!user || data.password !== user.password) {
            if (data.password === "password123" && data.username === "admin") {
              user = { id: '1', username: 'admin', password: 'password123', role: 'مدير' };
            } else {
              throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
            }
          }
          return { token: "mock-jwt-token", username: user.username, role: user.role };
        }

        if (url === '/api/register') {
          const accounts = getDb('accounts');
          if (accounts.some((a: any) => a.username.toLowerCase() === (data.username || "").toLowerCase())) {
            throw new Error("اسم المستخدم موجود مسبقاً");
          }
          const newUser = { id: Date.now().toString(), username: data.username, password: data.password, role: data.role };
          accounts.push(newUser);
          setDb('accounts', accounts);
          return { token: "mock-jwt-token", username: newUser.username, role: newUser.role };
        }

        if (url === '/api/settings') {
          const current = getObjDb('settings');
          const updated = { ...current, ...data };
          setObjDb('settings', updated);
          return { success: true };
        }

        if (url === '/api/students/bulk') {
          const list = getDb('students');
          const newStudents = data.students || [];
          const byId = new Map<string, any>();
          list.forEach((item: any) => { if (item?.id) byId.set(String(item.id), item); });
          newStudents.forEach((item: any, idx: number) => {
            const id = String(item.id || `s_${Date.now()}_${idx}`);
            byId.set(id, { ...item, id });
          });
          setDb('students', Array.from(byId.values()));
          return { success: true, count: newStudents.length };
        }

        if (url === '/api/students/delete-many') {
          const idsToDelete = new Set((data.ids || []).map((id: any) => String(id)));
          const list = getDb('students').filter((s: any) => !idsToDelete.has(String(s.id)));
          setDb('students', list);
          return { success: true, count: idsToDelete.size };
        }

        if (url === '/api/exam_groups/bulk') {
          const list = getDb('exam_groups');
          const newGroups = data.groups || [];
          const byId = new Map<string, any>();
          list.forEach((item: any) => { if (item?.id) byId.set(String(item.id), item); });
          newGroups.forEach((item: any, idx: number) => {
            const id = String(item.id || `grp_${Date.now()}_${idx}`);
            byId.set(id, { ...item, id });
          });
          setDb('exam_groups', Array.from(byId.values()));
          return { success: true, count: newGroups.length };
        }

        if (url === '/api/teachers/bulk') {
          const list = getDb('teachers');
          const newTeachers = (data.teachers || []).map((t: any, idx: number) => ({
            ...t,
            id: String(t.id || `t_${Date.now()}_${idx}`),
            isExempt: Boolean(t.isExempt),
            exemptReason: String(t.exemptReason || '')
          }));
          const cleanExisting = data.replaceExisting
            ? []
            : list.filter((t: any) => !isDemoTeacher(t));
          const updatedList = [...cleanExisting, ...newTeachers];
          setDb('teachers', updatedList);
          return { success: true, count: newTeachers.length };
        }

        if (url === '/api/halls/bulk') {
          const list = getDb('halls');
          const newHalls = data.halls || [];
          const updatedList = [...list, ...newHalls];
          setDb('halls', updatedList);
          return { success: true, count: newHalls.length };
        }

        if (url === '/api/halls/quick-generate') {
          const count = Number(data.count) || 20;
          const capacity = Number(data.capacity) || 30;
          const existing = getDb('halls');
          const byId = new Map<string, any>();
          existing.forEach((h: any) => { if (h?.id) byId.set(String(h.id), h); });
          for (let i = 1; i <= count; i++) {
            const id = `hall_${i}`;
            byId.set(id, { id, name: `القاعة ${String(i).padStart(2, '0')}`, capacity });
          }
          setDb('halls', Array.from(byId.values()));
          return { success: true, count };
        }

        if (url === '/api/exams/bulk') {
          const list = getDb('exams');
          const newExams = data.exams || [];
          const updatedList = [...list, ...newExams];
          setDb('exams', updatedList);
          return { success: true, count: newExams.length };
        }

        if (url === '/api/exams/reset-standard') {
          const exams = getDefaultExams();
          setDb('exams', exams);
          setDb('assignments', []);
          return { success: true, exams };
        }

        if (url === '/api/exams/delete-many') {
          const ids = new Set((data.ids || []).map((id: any) => String(id)));
          const list = getDb('exams');
          setDb('exams', list.filter((e: any) => !ids.has(String(e.id))));
          const assigns = getDb('assignments');
          setDb('assignments', assigns.filter((a: any) => !ids.has(String(a.examId))));
          return { success: true, count: ids.size };
        }

        if (url === '/api/assignments/replace') {
          setDb('assignments', data.assignments || []);
          const teachersList = getDb('teachers');
          for (const [tId, hours] of Object.entries(data.stats || {})) {
            const idx = teachersList.findIndex((t: any) => String(t.id) === String(tId));
            if (idx > -1) {
              teachersList[idx].totalHours = hours;
            }
          }
          setDb('teachers', teachersList);
          return { success: true };
        }

        const tables = ['teachers', 'halls', 'exams', 'assignments', 'students', 'exam_groups'];
        for (const table of tables) {
          if (url === `/api/${table}`) {
            const list = getDb(table);
            const assignedId = serverResult?.id || data.id || Date.now().toString();
            const newItem = { ...data, id: assignedId };
            const existingIdx = list.findIndex((x: any) => String(x.id) === String(assignedId));
            if (existingIdx > -1) {
              list[existingIdx] = newItem;
            } else {
              list.push(newItem);
            }
            setDb(table, list);
            return { success: true, id: newItem.id };
          }
        }

        throw new Error(`Not found: POST ${url}`);
      },
      { timeoutMs, mirrorOnSuccess: !isAuthRoute && !isWorkspaceRoute }
    );

    if (!isAuthRoute && !isWorkspaceRoute) {
      markWorkspaceDirty();
    }
    return res;
  },

  put: async (url: string, data: any) => {
    const res = await fetchOrMock(
      url,
      { method: 'PUT', body: JSON.stringify(data) },
      () => {
        const parts = url.split('/');
        const table = parts[2];
        const id = parts[3];
        const list = getDb(table);
        const index = list.findIndex((item: any) => String(item.id) === String(id));
        if (index > -1) {
          list[index] = { ...list[index], ...data };
          setDb(table, list);
          return { success: true };
        }
        return { success: true };
      },
      { mirrorOnSuccess: true }
    );

    markWorkspaceDirty();
    return res;
  },

  delete: async (url: string) => {
    const res = await fetchOrMock(
      url,
      { method: 'DELETE' },
      () => {
        if (url === '/api/clear-all') {
          setObjDb('settings', {});
          setDb('teachers', []);
          setDb('halls', []);
          setDb('exams', []);
          setDb('assignments', []);
          setDb('students', []);
          setDb('exam_groups', []);
          return { success: true };
        }
        if (url === '/api/students/all') {
          setDb('students', []);
          return { success: true };
        }
        if (url === '/api/halls/all') {
          setDb('halls', []);
          return { success: true };
        }
        if (url === '/api/teachers/demo') {
          const list = getDb('teachers');
          const cleaned = list.filter((t: any) => !isDemoTeacher(t));
          setDb('teachers', cleaned);
          return { success: true, count: list.length - cleaned.length };
        }
        if (url === '/api/teachers/all') {
          setDb('teachers', []);
          return { success: true };
        }
        if (url === '/api/exam_groups/all') {
          setDb('exam_groups', []);
          return { success: true };
        }
        if (url === '/api/exams/all') {
          setDb('exams', []);
          setDb('assignments', []);
          return { success: true };
        }

        const parts = url.split('/');
        const table = parts[2];
        const id = parts[3];
        const list = getDb(table);
        setDb(table, list.filter((item: any) => String(item.id) !== String(id)));
        return { success: true };
      },
      { mirrorOnSuccess: true }
    );

    markWorkspaceDirty();
    return res;
  }
};
