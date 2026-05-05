import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Hall } from '../types';
import { DoorOpen, Trash2, Edit2, Plus, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import ExcelImportModal from './ExcelImportModal';

export default function HallsPage() {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingHall, setEditingHall] = useState<Hall | null>(null);

  // Excel Import State
  const [importData, setImportData] = useState<any[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const fetchHalls = async () => {
    try {
      const data = await api.get('/api/halls');
      setHalls(data);
    } catch(e) {
      console.error(e);
      toast.error('خطأ في جلب القاعات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHalls();
  }, []);

  const handleAddHall = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const hallData = {
      name: formData.get('name') as string,
      capacity: Number(formData.get('capacity')) || 30,
    };

    try {
      if (editingHall) {
        await api.put(`/api/halls/${editingHall.id}`, hallData);
        toast.success('تم التحديث');
      } else {
        await api.post('/api/halls', { ...hallData, id: Date.now().toString() });
        toast.success('تمت الإضافة');
      }
      setShowForm(false);
      setEditingHall(null);
      e.currentTarget.reset();
      fetchHalls();
    } catch (error) {
      toast.error('خطأ في الحفظ');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/halls/${id}`);
      toast.success('تم الحذف');
      fetchHalls();
    } catch (error) {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const XLSX = await import('xlsx');
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        setImportData(data);
        setIsImportModalOpen(true);
      } catch (error) {
        toast.error('حدث خطأ أثناء قراءة الملف');
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async (mappedData: any[]) => {
    setIsImportModalOpen(false);
    toast.loading('جاري استيراد القاعات...', { id: 'import' });
    try {
      let count = 0;
      for (const row of mappedData) {
        if (row.name) {
          await api.post('/api/halls', {
            id: Date.now().toString() + Math.random().toString(),
            name: String(row.name),
            capacity: Number(row.capacity) || 30,
          });
          count++;
        }
      }
      toast.success(`تم استيراد ${count} قاعة بنجاح`, { id: 'import' });
      fetchHalls();
    } catch (error) {
      toast.error('حدث خطأ أثناء الإستيراد', { id: 'import' });
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="bg-white p-4 lg:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 lg:space-y-6">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div>
            <h3 className="text-lg lg:text-xl font-bold text-gray-900 leading-tight">إدارة القاعات</h3>
            <p className="text-xs lg:text-sm text-gray-500 mt-1">تحديد القاعات المتاحة للاختبارات</p>
          </div>
          <div className="flex gap-2 lg:gap-3 flex-wrap">
            <label className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-3 lg:py-2 rounded-xl cursor-pointer hover:bg-emerald-100 transition-colors font-bold border border-emerald-200 text-sm">
              <span className="hidden sm:inline">إستيراد إكسل</span>
              <span className="sm:hidden">إكسل</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
            <button 
              onClick={() => { setEditingHall(null); setShowForm(!showForm); }}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 lg:py-2 rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-md shadow-blue-200 text-sm"
            >
              <Plus size={18} />
              {showForm ? 'إلغاء الإضافة' : 'إضافة قاعة'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          { (showForm || editingHall) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <form onSubmit={handleAddHall} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50 rounded-2xl border border-blue-50">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">اسم القاعة</label>
                  <input name="name" defaultValue={editingHall?.name} required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">السعة (طالب)</label>
                  <input type="number" name="capacity" defaultValue={editingHall?.capacity || 30} required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-all">حفظ البيانات</button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {halls.map((hall) => (
          <div key={hall.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm group hover:border-blue-200 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-gray-50 text-gray-500 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <DoorOpen size={20} />
              </div>
              <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingHall(hall); setShowForm(true); }} className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 rounded-lg lg:bg-transparent">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(hall.id!)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 rounded-lg lg:bg-transparent">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <h4 className="font-bold text-gray-900 mb-1">{hall.name}</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Info size={12} />
              <span>السعة: {hall.capacity} طالب</span>
            </div>
          </div>
        ))}
        {halls.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
            <DoorOpen size={32} className="mx-auto mb-2 opacity-20" />
            <p>لا توجد قاعات مضافة</p>
          </div>
        )}
      </div>

      <ExcelImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        data={importData}
        title="استيراد القاعات"
        expectedColumns={[
          { key: 'name', label: 'اسم القاعة', required: true },
          { key: 'capacity', label: 'السعة (طالب)' }
        ]}
        onConfirm={handleConfirmImport}
      />
    </div>
  );
}
