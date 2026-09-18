import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Layers,
  Search,
  CheckSquare,
  Square,
  CheckCircle2,
  Save,
  RotateCcw,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import {
  getAllDistinctCollections,
  getVisibleCollections,
  saveVisibleCollections,
  getCollectionProductCounts,
} from '../services/db';

interface ActiveCollectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  onSaved?: () => void;
}

export const ActiveCollectionsModal: React.FC<ActiveCollectionsModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
  onSaved,
}) => {
  const [allCollections, setAllCollections] = useState<string[]>([]);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCollections();
    }
  }, [isOpen]);

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      const [allCols, visibleCols, productCounts] = await Promise.all([
        getAllDistinctCollections(),
        getVisibleCollections(),
        getCollectionProductCounts(),
      ]);

      setAllCollections(allCols);
      setCounts(productCounts);

      if (visibleCols && visibleCols.length > 0) {
        setSelectedSet(new Set(visibleCols));
      } else {
        // By default, if nothing is filtered, all collections are selected
        setSelectedSet(new Set(allCols));
      }
    } catch (err) {
      console.error('Error loading collections:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return allCollections;
    const q = searchQuery.toLowerCase().trim();
    return allCollections.filter((c) => c.toLowerCase().includes(q));
  }, [allCollections, searchQuery]);

  const toggleCollection = (col: string) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        next.add(col);
      }
      return next;
    });
    setSavedSuccess(false);
  };

  const handleSelectAll = () => {
    setSelectedSet(new Set(allCollections));
    setSavedSuccess(false);
  };

  const handleDeselectAll = () => {
    setSelectedSet(new Set());
    setSavedSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const chosen = Array.from(selectedSet);
      // If user selected all, we can save all
      await saveVisibleCollections(chosen);
      setSavedSuccess(true);
      onUpdated?.();
      onSaved?.();
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error saving visible collections:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-blue-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-800">
                  เลือก Collection ที่ต้องการให้แสดงในระบบ
                </h3>
                <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded-full font-mono">
                  {selectedSet.size} / {allCollections.length}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                เลือกติ๊ก Collection ที่ต้องการเปิดใช้งานในตัวเลือก Dropdown ทั้งตอนสร้างใบเสนอราคาและจัดการกลุ่มโปรโมชั่น
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อ Collection..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              เลือกทั้งหมด
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Square className="w-3.5 h-3.5" />
              ยกเลิกทั้งหมด
            </button>
          </div>
        </div>

        {/* Warning if no collection selected */}
        {selectedSet.size === 0 && (
          <div className="mx-4 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>หากไม่ได้เลือก Collection ใดเลย ระบบจะแสดง Collection ทั้งหมดเป็นค่าเริ่มต้น</span>
          </div>
        )}

        {/* Collection Checkboxes Grid */}
        <div className="p-4 overflow-y-auto flex-1 max-h-[420px]">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              กำลังโหลดรายชื่อ Collection...
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs italic">
              ไม่พบ Collection ที่ตรงกับ "{searchQuery}"
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredCollections.map((col) => {
                const isChecked = selectedSet.has(col);
                const count = counts[col] || 0;
                return (
                  <label
                    key={col}
                    onClick={() => toggleCollection(col)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                      isChecked
                        ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-semibold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate mr-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-xs truncate">{col}</span>
                    </div>

                    {count > 0 && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
                          isChecked
                            ? 'bg-indigo-200/80 text-indigo-800 font-bold'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {count.toLocaleString()} สินค้า
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-medium">
            เปิดแสดงผล: <span className="font-bold text-indigo-600 font-mono">{selectedSet.size}</span> จากทั้งหมด{' '}
            <span className="font-mono">{allCollections.length}</span> Collection
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200/60 rounded-xl font-medium transition-colors"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`px-5 py-2 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all ${
                savedSuccess
                  ? 'bg-emerald-600'
                  : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50'
              }`}
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  บันทึกเรียบร้อย!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
