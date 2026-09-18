import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { PromotionGroup } from '../types';
import {
  getPromotionGroups,
  savePromotionGroup,
  deletePromotionGroup,
  getDistinctCollections,
  getDistinctColors,
} from '../services/db';

interface PromotionGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPromotionsUpdated: () => void;
}

export const PromotionGroupModal: React.FC<PromotionGroupModalProps> = ({
  isOpen,
  onClose,
  onPromotionsUpdated,
}) => {
  const [promotions, setPromotions] = useState<PromotionGroup[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [availableColors, setAvailableColors] = useState<string[]>([]);

  // Form states
  const [name, setName] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [applyToAllColors, setApplyToAllColors] = useState(true);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    const list = await getPromotionGroups();
    setPromotions(list);
    const cols = await getDistinctCollections();
    setCollections(cols);
  };

  const handleCollectionSelect = async (col: string) => {
    setSelectedCollection(col);
    setSelectedColors([]);
    if (col) {
      const colors = await getDistinctColors(col);
      setAvailableColors(colors);
    } else {
      setAvailableColors([]);
    }
  };

  const toggleColor = (colorName: string) => {
    setSelectedColors((prev) =>
      prev.includes(colorName) ? prev.filter((c) => c !== colorName) : [...prev, colorName]
    );
  };

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('กรุณาระบุชื่อโปรโมชั่น');
      return;
    }
    if (!selectedCollection) {
      alert('กรุณาเลือก Collection');
      return;
    }
    if (!applyToAllColors && selectedColors.length === 0) {
      alert('กรุณาเลือกอย่างน้อย 1 สี หรือเลือกใช้ทั้ง Collection');
      return;
    }

    const newPromo: PromotionGroup = {
      id: 'promo-' + Date.now(),
      name: name.trim(),
      collection: selectedCollection,
      applyToAllColors,
      selectedColors: applyToAllColors ? [] : selectedColors,
      discountPercent: Math.max(0, Math.min(100, discountPercent)),
      createdAt: Date.now(),
    };

    await savePromotionGroup(newPromo);
    await loadData();
    onPromotionsUpdated();

    // Reset
    setName('');
    setSelectedCollection('');
    setApplyToAllColors(true);
    setSelectedColors([]);
    setDiscountPercent(20);
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('คุณต้องการลบกลุ่มโปรโมชั่นนี้ใช่หรือไม่?')) {
      await deletePromotionGroup(id);
      await loadData();
      onPromotionsUpdated();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 overflow-y-auto backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                จัดการกลุ่มโปรโมชั่น (Promotion Groups)
              </h3>
              <p className="text-xs text-slate-500">
                กำหนด % ส่วนลดเริ่มต้นตาม Collection หรือเฉพาะสีที่กำหนด
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
          {!isAdding ? (
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-slate-700">
                  รายการโปรโมชั่นปัจจุบัน ({promotions.length})
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  เพิ่มกลุ่มโปรโมชั่นใหม่
                </button>
              </div>

              {promotions.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <Tag className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                  <p className="text-slate-500 font-medium">ยังไม่มีกลุ่มโปรโมชั่นที่กำหนด</p>
                  <p className="text-xs text-slate-400 mt-1">
                    คลิกปุ่ม &quot;เพิ่มกลุ่มโปรโมชั่นใหม่&quot; เพื่อเริ่มกำหนดส่วนลด
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {promotions.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl flex items-center justify-between transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-xs">
                            ลด {p.discountPercent}%
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-2">
                          <span className="font-semibold text-slate-700">
                            Collection: {p.collection}
                          </span>
                          <span>•</span>
                          {p.applyToAllColors ? (
                            <span className="text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> ทุกสีใน Collection
                            </span>
                          ) : (
                            <span className="text-amber-700 font-medium">
                              เฉพาะสี: {p.selectedColors.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบโปรโมชั่น"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Add Promotion Form */
            <form onSubmit={handleCreatePromotion} className="space-y-4">
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                <div className="font-bold text-emerald-900 text-sm">
                  สร้างกลุ่มโปรโมชั่นส่วนลดใหม่
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อกลุ่มโปรโมชั่น <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name || ''}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น โปรโมชั่น KUBUA 25% ตลอดเดือน"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เลือก Collection <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedCollection || ''}
                      onChange={(e) => handleCollectionSelect(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      <option value="">-- เลือก Collection --</option>
                      {collections.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      กำหนดส่วนลด (% Discount) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={discountPercent ?? 0}
                        onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-400">%</span>
                    </div>
                  </div>
                </div>

                {/* Color Application Scope */}
                <div className="pt-2 border-t border-emerald-200/60 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    ขอบเขตการใช้ส่วนลดใน Collection นี้:
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="colorScope"
                        checked={applyToAllColors}
                        onChange={() => setApplyToAllColors(true)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-medium text-slate-700">
                        ทั้ง Collection (ทุกสี)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="colorScope"
                        checked={!applyToAllColors}
                        onChange={() => setApplyToAllColors(false)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-medium text-slate-700">
                        เลือกเฉพาะบางสี
                      </span>
                    </label>
                  </div>

                  {/* Multi-select color checkboxes */}
                  {!applyToAllColors && (
                    <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg space-y-2 max-h-40 overflow-y-auto">
                      <div className="text-[11px] text-slate-500 font-medium">
                        เลือกสีที่ต้องการกำหนดโปรโมชั่น:
                      </div>
                      {availableColors.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          กรุณาเลือก Collection ก่อนเพื่อแสดงรายชื่อสี
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {availableColors.map((colName) => {
                            const isChecked = selectedColors.includes(colName);
                            return (
                              <label
                                key={colName}
                                className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer border ${
                                  isChecked
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleColor(colName)}
                                  className="text-emerald-600 rounded"
                                />
                                <span className="truncate">{colName}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  บันทึกกลุ่มโปรโมชั่น
                </button>
              </div>
            </form>
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
