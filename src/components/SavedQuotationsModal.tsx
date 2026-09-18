import React, { useState, useEffect } from 'react';
import { X, FileText, Trash2, FolderOpen, Calendar, User, Phone, CheckCircle2 } from 'lucide-react';
import { Quotation } from '../types';
import { getQuotations, deleteQuotation } from '../services/db';

interface SavedQuotationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuotation: (quotation: Quotation) => void;
  currentQuotationId?: string;
}

export const SavedQuotationsModal: React.FC<SavedQuotationsModalProps> = ({
  isOpen,
  onClose,
  onSelectQuotation,
  currentQuotationId,
}) => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadQuotations();
    }
  }, [isOpen]);

  const loadQuotations = async () => {
    const list = await getQuotations();
    setQuotations(list);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('คุณต้องการลบใบเสนอราคานี้ใช่หรือไม่?')) {
      await deleteQuotation(id);
      await loadQuotations();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 overflow-y-auto backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                ประวัติใบเสนอราคาที่บันทึกไว้ ({quotations.length})
              </h3>
              <p className="text-xs text-slate-500">
                เลือกใบเสนอราคาที่ต้องการเปิดขึ้นมาแก้ไขหรือพิมพ์
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs sm:text-sm">
          {quotations.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-slate-500 font-medium">ยังไม่มีใบเสนอราคาที่บันทึกไว้</p>
            </div>
          ) : (
            quotations.map((q) => {
              const isCurrent = q.id === currentQuotationId;
              const totalItems = q.sections.reduce((sum, s) => sum + s.items.length, 0);

              return (
                <div
                  key={q.id}
                  onClick={() => {
                    onSelectQuotation(q);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-indigo-50/70 border-indigo-300 shadow-xs ring-1 ring-indigo-400'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">
                        {q.quotationNumber || 'ใบเสนอราคาไม่มีเลขที่'}
                      </span>
                      {isCurrent && (
                        <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> เปิดใช้งานอยู่
                        </span>
                      )}
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {q.date}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700">ลูกค้า:</span>{' '}
                        {q.customer.customerName || '-'}
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700">โทร:</span>{' '}
                        {q.customer.phone || '-'}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-0.5">
                      <span>{q.sections.length} ชุดข้อมูล</span>
                      <span>•</span>
                      <span>{totalItems} รายการสินค้า</span>
                      <span>•</span>
                      <span className="text-indigo-700 font-semibold">
                        พนักงานขาย: {q.customer.salesName || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(q.id, e)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="ลบใบเสนอราคา"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
