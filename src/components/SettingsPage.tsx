import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { SystemSettings } from '../types';
import { Shield, Bell, Save, Building, Info, Database, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    institutionName: 'المؤسسة التعليمية',
    proctorRatio: 2
  });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    api.get('/api/settings').then((data) => {
      if (Object.keys(data).length > 0) {
        setSettings(data as SystemSettings);
      }
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/settings', settings);
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const seedData = async () => {
    toast.error('هذه الميزة غير مدعومة في النسخة الحالية');
  };

  const clearData = async () => {
    setSeeding(true);
    try {
      toast.loading('جاري مسح البيانات...', { id: 'cleaning' });
      await api.delete('/api/clear-all');
      toast.success('تم مسح البيانات بنجاح', { id: 'cleaning' });
    } catch (error: any) {
      console.error(error);
      toast.error('حدث خطأ أثناء مسح البيانات', { id: 'cleaning' });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-blue-600 p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Building size={28} />
              إعدادات المؤسسة
            </h2>
            <p className="text-blue-100 opacity-80 mt-1">تخصيص معلومات المؤسسة ومعايير التوزيع</p>
          </div>
          <Building size={120} className="absolute -left-4 -bottom-4 opacity-10 rotate-12" />
        </div>

        <div className="p-10 space-y-8">
          <form onSubmit={handleSave} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">اسم المؤسسة</label>
                <input
                  value={settings.institutionName}
                  onChange={e => setSettings({ ...settings, institutionName: e.target.value })}
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-right"
                  placeholder="مثلاً: ثانوية العقيد لطفي"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">نسبة الحراسة الافتراضية</label>
                <div className="relative">
                  <input
                    type="number"
                    value={settings.proctorRatio}
                    onChange={e => setSettings({ ...settings, proctorRatio: Number(e.target.value) })}
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all pr-10 text-right"
                  />
                  <Shield className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
                <p className="text-xs text-gray-400">عدد الحراس المقترح لكل قاعة اختبار</p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="bg-blue-600 text-white font-bold py-3 px-10 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 active:scale-95"
              >
                <Save size={20} />
                حفظ التغييرات
              </button>
            </div>
          </form>

          <div className="pt-8 border-t border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Database size={20} className="text-purple-500" />
              أدوات المطور / تجربة النظام
            </h3>
            <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="text-purple-600 shrink-0 mt-1" size={24} />
                <div>
                  <p className="font-bold text-purple-900">بيانات تجريبية (Seed Data)</p>
                  <p className="text-sm text-purple-700 leading-relaxed max-w-md">
                    هل تريد ملء التطبيق بأسماء أساتذة وقاعات واختبارات وهمية لتجربة خوارزمية التوزيع؟
                  </p>
                </div>
              </div>
              <button
                onClick={seedData}
                disabled={seeding}
                className="whitespace-nowrap bg-purple-600 text-white font-bold py-3 px-8 rounded-2xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 active:scale-95 disabled:bg-purple-300"
              >
                {seeding ? 'جاري الإضافة...' : 'إضافة بيانات تجريبية'}
              </button>
              <button
                onClick={clearData}
                disabled={seeding}
                className="whitespace-nowrap bg-red-50 text-red-600 font-bold py-3 px-8 rounded-2xl hover:bg-red-100 transition-all border border-red-100 active:scale-95 disabled:opacity-50"
              >
                مسح البيانات
              </button>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Bell size={20} className="text-amber-500" />
              نظام التنبيهات
            </h3>
            <div className="space-y-4">
              <label className="flex items-center gap-4 group cursor-pointer bg-gray-50 p-4 rounded-2xl border border-transparent hover:border-blue-100 transition-all">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 font-sans"></div>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">إرسال إشعارات البريد الإلكتروني</p>
                  <p className="text-xs text-gray-500">سيتم إبلاغ الأساتذة بجدولهم قبل 24 ساعة (يتطلب إعداد SMTP برمجياً)</p>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
            <Info className="text-blue-600 shrink-0 mt-1" size={20} />
            <div className="text-sm text-blue-800 leading-relaxed">
              <p className="font-bold mb-1">دعم العمل الجماعي</p>
              بصفتك مديراً، يمكنك مشاركة رابط التطبيق مع المراقب العام. جميع التغييرات ستتم مزامنتها في الوقت الفعلي لكل المستخدمين المصرح لهم.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
