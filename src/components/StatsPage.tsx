import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Teacher, Assignment } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Users, Clock, AlertTriangle } from 'lucide-react';

export default function StatsPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/teachers'),
      api.get('/api/assignments')
    ]).then(([tData, aData]) => {
      setTeachers(tData);
      setAssignments(aData);
      setLoading(false);
    }).catch(console.error);
  }, []);

  const teachersExecution = teachers.map(t => {
    const count = assignments.filter(a => a.teacherId === t.id).length;
    return { name: t.name, count };
  }).sort((a, b) => b.count - a.count);

  const stats = [
    { label: 'إجمالي الأساتذة', value: teachers.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'إجمالي التكليفات', value: assignments.length, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'متوسط الحراسة / أستاذ', value: (assignments.length / (teachers.length || 1)).toFixed(1), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6 lg:space-y-8 pb-20 lg:pb-0">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {stats.map((item, idx) => (
          <div key={idx} className="bg-white p-4 lg:p-8 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] lg:text-sm font-bold text-gray-500 mb-1">{item.label}</p>
              <p className="text-xl lg:text-3xl font-extrabold text-gray-900">{item.value}</p>
            </div>
            <div className={`p-3 lg:p-4 ${item.bg} ${item.color} rounded-2xl`}>
              <item.icon size={20} className="lg:w-8 lg:h-8" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="bg-white p-4 lg:p-8 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-sm lg:text-xl font-bold text-gray-900 mb-6 lg:mb-8 border-r-4 border-blue-600 pr-3 lg:pr-4">توزيع ساعات الحراسة</h3>
          <div className="h-[300px] lg:h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teachersExecution.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={24}>
                  {teachersExecution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 lg:p-8 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-sm lg:text-xl font-bold text-gray-900 mb-6 lg:mb-8 border-r-4 border-emerald-600 pr-3 lg:pr-4">إحصائيات الشفافية والعدالة</h3>
          <div className="space-y-5 lg:space-y-6">
            <div className="flex items-start gap-3 p-3 lg:p-4 bg-amber-50 rounded-xl border border-amber-100">
              <AlertTriangle className="text-amber-600 shrink-0" size={18} />
              <p className="text-[11px] lg:text-sm text-amber-800 font-medium leading-relaxed">
                يتم توزيع الحراسة بناءً على إجمالي الساعات المتبقية لكل أستاذ. النظام يضمن أن الفرق بين أكثر أستاذ حراسة وأقلهم لا يتعدى فترة واحدة.
              </p>
            </div>
            
            <div className="space-y-4">
              {teachersExecution.slice(0, 5).map((t, idx) => (
                <div key={idx} className="group cursor-default">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs lg:text-sm font-bold text-gray-700">{t.name}</span>
                    <span className="text-[10px] lg:text-xs font-bold text-gray-400 group-hover:text-blue-600 transition-colors uppercase">{t.count} فترات</span>
                  </div>
                  <div className="w-full h-1.5 lg:h-2 bg-gray-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${Math.min(100, (t.count / (assignments.length || 1) * 100) * 5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
