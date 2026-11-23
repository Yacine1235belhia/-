import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Lock, User, Loader2, UserPlus, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { setToken, setUser, api } from '../lib/api';

interface AuthPageProps {
  onLogin: () => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'مدير' | 'ناظر'>('مدير');

  useEffect(() => {
    const savedUser = localStorage.getItem('saved_username');
    const savedPass = localStorage.getItem('saved_password');
    if (savedUser) setUsername(savedUser);
    if (savedPass) setPassword(savedPass);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!username.trim() || !password.trim()) {
      toast.error('الرجاء إدخال اسم المستخدم وكلمة المرور');
      setLoading(false);
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      toast.error('كلمة السر غير متطابقة');
      setLoading(false);
      return;
    }

    try {
      const endpoint = isLogin ? "/api/login" : "/api/register";
      const payload = isLogin ? { username, password } : { username, password, role };
      
      const data = await api.post(endpoint, payload);
      
      setToken(data.token);
      setUser({ username: data.username, role: data.role });
      
      // Save login data to avoid losing credentials
      localStorage.setItem('saved_username', username);
      localStorage.setItem('saved_password', password);
      
      toast.success(isLogin ? 'تم تسجيل الدخول بنجاح' : 'تم إنشاء الحساب بنجاح');
      onLogin();
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-4 font-sans rtl" dir="rtl">
      <div className="bg-white p-6 lg:p-10 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8 relative z-10">
          <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900 mb-2">نظام الحراسة الذكي</h1>
          <p className="text-gray-500 font-medium">{isLogin ? 'سجل دخولك للمتابعة' : 'إنشاء حساب جديد'}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {!isLogin && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">نوع الحساب</label>
              <div className="flex gap-4">
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${role === 'مدير' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                  <input type="radio" value="مدير" checked={role === 'مدير'} onChange={(e) => setRole(e.target.value as 'مدير' | 'ناظر')} className="hidden" />
                  <ShieldCheck size={18} /> مدير
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${role === 'ناظر' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                  <input type="radio" value="ناظر" checked={role === 'ناظر'} onChange={(e) => setRole(e.target.value as 'مدير' | 'ناظر')} className="hidden" />
                  <UserPlus size={18} /> ناظر
                </label>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-bold text-gray-700 mb-1">اسم المستخدم</label>
            <div className="relative">
              <input 
                id="username"
                name="username"
                autoComplete="username"
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="اسم المستخدم (مثل admin)"
                className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-left" 
                required 
                dir="ltr"
              />
              <User className="absolute right-3 top-3.5 text-gray-400 w-5 h-5" />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-1">كلمة السر</label>
            <div className="relative">
              <input 
                id="password"
                name="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة السر"
                className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-left" 
                required 
                dir="ltr"
              />
              <Lock className="absolute right-3 top-3.5 text-gray-400 w-5 h-5" />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">تأكيد كلمة السر</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-left" 
                  required 
                  dir="ltr"
                />
                <Lock className="absolute right-3 top-3.5 text-gray-400 w-5 h-5" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3.5 px-6 rounded-xl hover:bg-blue-700 disabled:bg-blue-400 mt-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'تسجيل الدخول' : 'إنشاء حساب')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button" 
            onClick={() => { setIsLogin(!isLogin); setUsername(''); setPassword(''); setConfirmPassword(''); }}
            className="text-sm font-bold text-blue-600 hover:text-blue-800"
          >
            {isLogin ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب أصلًا؟ تسجيل الدخول'}
          </button>
        </div>
      </div>
    </div>
  );
}
