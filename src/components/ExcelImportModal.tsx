import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface ColumnDef {
  key: string;
  label: string;
  required?: boolean;
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  expectedColumns: ColumnDef[];
  onConfirm: (mappedData: any[]) => void;
  title: string;
}

export default function ExcelImportModal({ isOpen, onClose, data, expectedColumns, onConfirm, title }: ExcelImportModalProps) {
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});

  // Extract all unique headers from the imported data
  const availableHeaders = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    const headers = new Set<string>();
    data.forEach(row => Object.keys(row).forEach(k => headers.add(k)));
    return Array.from(headers);
  }, [data]);

  // Auto-guess columns based on exact or partial matches
  useEffect(() => {
    if (availableHeaders.length === 0) return;
    const initialMap: Record<string, string> = {};
    
    expectedColumns.forEach(exp => {
      const match = availableHeaders.find(h => 
        h.includes(exp.label) || 
        h.toLowerCase() === exp.key.toLowerCase() ||
        exp.label.includes(h)
      );
      if (match) {
        initialMap[exp.key] = match;
      } else {
        initialMap[exp.key] = "";
      }
    });
    setColumnMap(initialMap);
  }, [availableHeaders, expectedColumns]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const mappedData = data.map(row => {
      const newRow: any = {};
      expectedColumns.forEach(exp => {
        const fileCol = columnMap[exp.key];
        newRow[exp.key] = fileCol ? row[fileCol] : undefined;
      });
      return newRow;
    });
    onConfirm(mappedData);
  };

  // Preview first 3 rows
  const previewData = data.slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold">{title} - مطابقة الأعمدة</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium">
            يرجى تحديد العمود المناسب من ملف الإكسل (يمين) لكل حقل مطلوب في النظام (يسار). النظام سيحاول توقع المطابقة تلقائياً.
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg">إعدادات المطابقة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expectedColumns.map(exp => (
                <div key={exp.key} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-gray-800">{exp.label}</span>
                    {exp.required && <span className="text-red-500 text-xs">* (مطلوب)</span>}
                  </div>
                  <select 
                    value={columnMap[exp.key] || ""}
                    onChange={(e) => setColumnMap({ ...columnMap, [exp.key]: e.target.value })}
                    className="w-full p-2 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- تجاهل / غير موجود --</option>
                    {availableHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg">معاينة البيانات (أول 3 صفوف)</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {expectedColumns.map(exp => (
                      <th key={exp.key} className="p-3 border-b border-l last:border-l-0 font-bold text-gray-700">
                        {exp.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className="border-b last:border-b-0 hover:bg-gray-50">
                      {expectedColumns.map(exp => {
                        const fileCol = columnMap[exp.key];
                        const val = fileCol ? row[fileCol] : '-';
                        return (
                          <td key={exp.key} className="p-3 border-l last:border-l-0">
                            {val !== undefined && val !== null ? String(val) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={expectedColumns.length} className="p-6 text-center text-gray-500">
                        الملف فارغ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {data.length > 3 && (
                <div className="p-3 bg-gray-50 text-center text-xs text-gray-500 border-t">
                  و {data.length - 3} صفوف أخرى...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50"
          >
            إلغاء
          </button>
          <button 
            onClick={handleConfirm}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex items-center gap-2"
          >
            <Check size={18} />
            تأكيد واستيراد ({data.length} صف)
          </button>
        </div>
      </div>
    </div>
  );
}
