export const getToken = () => localStorage.getItem("auth_token");
export const setToken = (token: string) => localStorage.setItem("auth_token", token);
export const removeToken = () => localStorage.removeItem("auth_token");

export const getUser = () => {
  const user = localStorage.getItem("auth_user");
  return user ? JSON.parse(user) : null;
};
export const setUser = (user: any) => localStorage.setItem("auth_user", JSON.stringify(user));
export const removeUser = () => localStorage.removeItem("auth_user");

const delay = (ms = 100) => new Promise(r => setTimeout(r, ms));

const getDb = (table: string) => {
  const data = localStorage.getItem(`db_${table}`);
  return data ? JSON.parse(data) : [];
};

const setDb = (table: string, data: any) => {
  localStorage.setItem(`db_${table}`, JSON.stringify(data));
};

const getObjDb = (table: string) => {
  const data = localStorage.getItem(`db_${table}`);
  return data ? JSON.parse(data) : {};
};

const setObjDb = (table: string, data: any) => {
  localStorage.setItem(`db_${table}`, JSON.stringify(data));
};

// Initialize admin account if none exists
if (!localStorage.getItem('db_accounts')) {
  setDb('accounts', [{ id: '1', username: 'admin', password: 'password123', role: 'مدير' }]);
  setDb('teachers', []);
  setDb('halls', []);
  setDb('exams', []);
  setDb('assignments', []);
  setObjDb('settings', {});
}

const mockResponse = async (handler: () => any) => {
  await delay();
  try {
    const data = await handler();
    return data;
  } catch (e: any) {
    throw new Error(e.message || "Request failed");
  }
};

export const api = {
  get: async (url: string) => {
    return mockResponse(() => {
      if (url === '/api/settings') return getObjDb('settings');
      if (url === '/api/teachers') return getDb('teachers');
      if (url === '/api/halls') return getDb('halls');
      if (url === '/api/exams') return getDb('exams');
      if (url === '/api/assignments') return getDb('assignments');
      throw new Error("Not found");
    });
  },
  post: async (url: string, data: any) => {
    return mockResponse(() => {
      if (url === '/api/login') {
        const accounts = getDb('accounts');
        // Simple mock login handling
        let user = accounts.find((a: any) => a.username.toLowerCase() === (data.username || "").toLowerCase());
        if (!user || data.password !== user.password) {
          if (data.password === "password123" && data.username === "admin") {
             // Fallback
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
        setObjDb('settings', { ...current, ...data });
        return { success: true };
      }
      if (url === '/api/seed') {
        // Seed some data
        const teachers = [];
        for (let i = 1; i <= 30; i++) teachers.push({ id: `t${i}`, name: `أستاذ ${i}`, specialty: "مادة", seniority: 1, email: "", totalHours: 0, availabilityExceptions: "[]" });
        setDb('teachers', teachers);
        
        const halls = [];
        for (let i = 1; i <= 20; i++) halls.push({ id: `h${i}`, name: `القاعة ${i}`, capacity: 30 });
        setDb('halls', halls);

        const exams = [];
        exams.push({ id: "e1", subject: "العربية", date: new Date().toISOString().split('T')[0], period: "morning", duration: 2, hallCount: 5, proctorsPerHall: 2 });
        setDb('exams', exams);

        setDb('assignments', []);
        return { success: true };
      }
      
      const tables = ['teachers', 'halls', 'exams', 'assignments'];
      for (const table of tables) {
        if (url === `/api/${table}`) {
          const list = getDb(table);
          const newItem = { ...data, id: data.id || Date.now().toString() };
          list.push(newItem);
          setDb(table, list);
          return { success: true, id: newItem.id };
        }
      }
      throw new Error("Not found");
    });
  },
  put: async (url: string, data: any) => {
    return mockResponse(() => {
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
      throw new Error("Not found");
    });
  },
  delete: async (url: string) => {
    return mockResponse(() => {
      if (url === '/api/clear-all') {
        setDb('teachers', []);
        setDb('halls', []);
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
    });
  }
}
