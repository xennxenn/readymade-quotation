import React, { useState, useEffect } from 'react';
import {
  X,
  Tag,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Layers,
  Check,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import { PromotionGroup, PromotionCollectionRule } from '../types';
import {
  getPromotionGroups,
  savePromotionGroup,
  deletePromotionGroup,
  getDistinctCollections,
  getDistinctColors,
} from '../services/db';
import { SearchableSelect } from './SearchableSelect';

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
  const [availableCollections, setAvailableCollections] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [collectionRules, setCollectionRules] = useState<PromotionCollectionRule[]>([]);

  // Picker for adding new collection to the rules
  const [colPickerValue, setColPickerValue] = useState('');
  const [collectionColorsCache, setCollectionColorsCache] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    const list = await getPromotionGroups();
    setPromotions(list);
    const cols = await getDistinctCollections(true);
    setAvailableCollections(cols);
  };

  // Preload colors for a collection
  const loadColorsForCollection = async (col: string) => {
    if (!col || collectionColorsCache[col]) return;
    try {
      const colors = await getDistinctColors(col);
      setCollectionColorsCache((prev) => ({ ...prev, [col]: colors }));
    } catch (e) {
      console.error('Error loading colors for', col, e);
    }
  };

  // Open form for adding new promotion
  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setDiscountPercent(20);
    setStartDate('');
    setEndDate('');
    setCollectionRules([]);
    setColPickerValue('');
    setIsFormOpen(true);
  };

  // Open form for editing existing promotion
  const handleOpenEdit = async (promo: PromotionGroup) => {
    setEditingId(promo.id);
    setName(promo.name);
    setDiscountPercent(promo.discountPercent);
    setStartDate(promo.startDate || '');
    setEndDate(promo.endDate || '');

    // Normalize collection rules: support new multi-collection rules or legacy single collection
    let rules: PromotionCollectionRule[] = [];
    if (promo.collectionRules && promo.collectionRules.length > 0) {
      rules = JSON.parse(JSON.stringify(promo.collectionRules));
    } else if (promo.collection) {
      rules = [
        {
          collection: promo.collection,
          applyToAllColors: promo.applyToAllColors ?? true,
          selectedColors: promo.selectedColors ? [...promo.selectedColors] : [],
        },
      ];
    }
    setCollectionRules(rules);

    // Preload colors for all collections in the rules
    for (const r of rules) {
      await loadColorsForCollection(r.collection);
    }

    setColPickerValue('');
    setIsFormOpen(true);
  };

  // Add collection rule to the current promotion being edited
  const handleAddCollectionRule = async () => {
    if (!colPickerValue.trim()) return;
    const colToAdd = colPickerValue.trim();

    // Check if already in rules
    if (collectionRules.some((r) => r.collection.toUpperCase() === colToAdd.toUpperCase())) {
      alert(`Collection "${colToAdd}" ถูกเพิ่มในกลุ่มโปรโมชั่นนี้แล้ว`);
      return;
    }

    await loadColorsForCollection(colToAdd);

    setCollectionRules((prev) => [
      ...prev,
      {
        collection: colToAdd,
        applyToAllColors: true,
        selectedColors: [],
      },
    ]);

    setColPickerValue('');
  };

  // Remove collection rule
  const handleRemoveCollectionRule = (index: number) => {
    setCollectionRules((prev) => prev.filter((_, i) => i !== index));
  };

  // Update a collection rule's scope (all colors vs specific colors)
  const handleUpdateRuleScope = (index: number, applyToAll: boolean) => {
    setCollectionRules((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        applyToAllColors: applyToAll,
      };
      return next;
    });
  };

  // Toggle specific color for a collection rule
  const handleToggleColorInRule = (index: number, colorName: string) => {
    setCollectionRules((prev) => {
      const next = [...prev];
      const currentSelected = next[index].selectedColors || [];
      const isSelected = currentSelected.includes(colorName);
      const updatedColors = isSelected
        ? currentSelected.filter((c) => c !== colorName)
        : [...currentSelected, colorName];

      next[index] = {
        ...next[index],
        selectedColors: updatedColors,
      };
      return next;
    });
  };

  // Select all colors in rule
  const handleSelectAllColorsInRule = (index: number, colName: string) => {
    const allColors = collectionColorsCache[colName] || [];
    setCollectionRules((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        selectedColors: [...allColors],
      };
      return next;
    });
  };

  // Deselect all colors in rule
  const handleDeselectAllColorsInRule = (index: number) => {
    setCollectionRules((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        selectedColors: [],
      };
      return next;
    });
  };

  // Save promotion (Add or Update)
  const handleSavePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('กรุณาระบุชื่อกลุ่มโปรโมชั่น');
      return;
    }

    if (collectionRules.length === 0) {
      alert('กรุณาเพิ่มอย่างน้อย 1 Collection ในกลุ่มโปรโมชั่นนี้');
      return;
    }

    // Validate that if a collection is set to specific colors, at least 1 color is chosen
    for (const rule of collectionRules) {
      if (!rule.applyToAllColors && (!rule.selectedColors || rule.selectedColors.length === 0)) {
        alert(`Collection "${rule.collection}" ถูกตั้งเป็น "เลือกเฉพาะบางสี" แต่ยังไม่ได้เลือกสีใดๆ กรุณาเลือกสีอย่างน้อย 1 สี หรือเลือก "ทั้ง Collection"`);
        return;
      }
    }

    if (startDate && endDate && startDate > endDate) {
      alert('วันที่เริ่มต้นโปรโมชั่นต้องไม่มากกว่าวันที่สิ้นสุด');
      return;
    }

    const firstRule = collectionRules[0];
    const promoToSave: PromotionGroup = {
      id: editingId || 'promo-' + Date.now(),
      name: name.trim(),
      discountPercent: Math.max(0, Math.min(100, discountPercent)),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      collectionRules,
      // Backward compatibility for single collection consumers
      collection: firstRule.collection,
      applyToAllColors: firstRule.applyToAllColors,
      selectedColors: firstRule.selectedColors,
      createdAt: editingId
        ? promotions.find((p) => p.id === editingId)?.createdAt || Date.now()
        : Date.now(),
      updatedAt: Date.now(),
    };

    await savePromotionGroup(promoToSave);
    await loadData();
    onPromotionsUpdated();
    setIsFormOpen(false);
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shadow-2xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-800">
                  จัดการกลุ่มโปรโมชั่น (Promotion Groups)
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full font-mono">
                  {promotions.length} โปรโมชั่น
                </span>
              </div>
              <p className="text-xs text-slate-500">
                กำหนด % ส่วนลด วันที่เริ่ม-สิ้นสุด และเลือก Collection ที่ร่วมรายการได้หลาย Collection พร้อมระบุขอบเขตสี
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

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
          {!isFormOpen ? (
            /* PROMOTIONS LIST VIEW */
            <div>
              <div className="flex justify-between items-center mb-3.5">
                <span className="font-semibold text-slate-700">
                  รายการโปรโมชั่นทั้งหมด ({promotions.length})
                </span>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  เพิ่มกลุ่มโปรโมชั่นใหม่
                </button>
              </div>

              {promotions.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <Tag className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-50" />
                  <p className="text-slate-600 font-bold">ยังไม่มีกลุ่มโปรโมชั่น</p>
                  <p className="text-xs text-slate-400 mt-1">
                    คลิกปุ่ม &quot;เพิ่มกลุ่มโปรโมชั่นใหม่&quot; เพื่อกำหนดส่วนลดและ Collection ที่ร่วมรายการ
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {promotions.map((p) => {
                    const rules = p.collectionRules || (p.collection ? [{
                      collection: p.collection,
                      applyToAllColors: p.applyToAllColors ?? true,
                      selectedColors: p.selectedColors || [],
                    }] : []);

                    const hasDateRange = p.startDate || p.endDate;

                    return (
                      <div
                        key={p.id}
                        className="p-4 bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200 rounded-xl space-y-2.5 transition-all shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                              <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md text-xs font-mono">
                                ลด {p.discountPercent}%
                              </span>

                              {hasDateRange && (
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 font-medium px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-blue-500" />
                                  {p.startDate ? p.startDate : 'ไม่จำกัด'} ถึง{' '}
                                  {p.endDate ? p.endDate : 'ไม่จำกัด'}
                                </span>
                              )}
                            </div>

                            {/* Collections in this promotion */}
                            <div className="text-xs text-slate-600 space-y-1 pt-1">
                              <span className="font-semibold text-slate-700">Collection ที่ร่วมรายการ:</span>
                              <div className="flex flex-wrap gap-1.5 mt-0.5">
                                {rules.map((r, idx) => (
                                  <span
                                    key={idx}
                                    className="bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded text-xs flex items-center gap-1 shadow-2xs"
                                  >
                                    <span className="font-bold text-emerald-800">{r.collection}</span>
                                    <span className="text-slate-400">|</span>
                                    {r.applyToAllColors ? (
                                      <span className="text-emerald-700 font-medium text-[11px]">ทุกสี</span>
                                    ) : (
                                      <span className="text-amber-700 font-medium text-[11px]">
                                        {r.selectedColors?.length || 0} สี ({r.selectedColors?.join(', ')})
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: Edit and Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(p)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="แก้ไขกลุ่มโปรโมชั่น"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="ลบกลุ่มโปรโมชั่น"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ADD / EDIT PROMOTION FORM */
            <form onSubmit={handleSavePromotion} className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2.5">
                  <div className="font-bold text-emerald-950 text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    {editingId ? 'แก้ไขกลุ่มโปรโมชั่น' : 'สร้างกลุ่มโปรโมชั่นส่วนลดใหม่'}
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {editingId ? 'ID: ' + editingId : 'โปรโมชั่นใหม่'}
                  </span>
                </div>

                {/* Promotion Name and Discount % */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อกลุ่มโปรโมชั่น <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="เช่น โปรโมชั่น Bedding Mid-Year ลด 25%"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                      required
                    />
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
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs sm:text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                        required
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                </div>

                {/* Date Range: Start Date & End Date */}
                <div className="p-3 bg-white border border-emerald-200/80 rounded-xl space-y-2">
                  <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    ช่วงเวลาที่โปรโมชั่นมีผล (ตัวเลือก: หากไม่ระบุจะสามารถใช้ได้ตลอดเวลา)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1 font-medium">
                        วันที่เริ่มต้นโปรโมชั่น
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1 font-medium">
                        วันที่สิ้นสุดโปรโมชั่น
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* MULTI-COLLECTION BUILDER */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-slate-800">
                        Collection ที่ร่วมรายการในกลุ่มโปรโมชั่นนี้ ({collectionRules.length} Collection) <span className="text-red-500">*</span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        สามารถเพิ่มได้มากกว่า 1 Collection โดยแต่ละ Collection กำหนดขอบเขตสีแยกกันได้
                      </p>
                    </div>
                  </div>

                  {/* Add Collection Combobox (Layer หน้าสุด SearchableSelect) */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      เลือก Collection เพื่อเพิ่มในกลุ่มโปรโมชั่น:
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          options={availableCollections}
                          value={colPickerValue}
                          onChange={(val) => setColPickerValue(val)}
                          placeholder="-- ค้นหาหรือเลือก Collection --"
                          searchPlaceholder="พิมพ์ค้นหาชื่อ Collection..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCollectionRule}
                        disabled={!colPickerValue}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                      >
                        <Plus className="w-4 h-4" />
                        เพิ่ม Collection นี้
                      </button>
                    </div>
                  </div>

                  {/* Included Collection Cards */}
                  {collectionRules.length === 0 ? (
                    <div className="p-6 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 text-xs">
                      ยังไม่ได้เพิ่ม Collection ใดๆ กรุณาเลือก Collection ด้านบนแล้วกด &quot;เพิ่ม Collection นี้&quot;
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {collectionRules.map((rule, idx) => {
                        const colorsForCol = collectionColorsCache[rule.collection] || [];

                        return (
                          <div
                            key={rule.collection}
                            className="p-3.5 bg-white border border-slate-300 rounded-xl space-y-2.5 shadow-2xs"
                          >
                            {/* Collection Card Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                  {idx + 1}. Collection: <span className="text-emerald-700">{rule.collection}</span>
                                </span>
                                {colorsForCol.length > 0 && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                    มี {colorsForCol.length} สีในฐานข้อมูล
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveCollectionRule(idx)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors text-xs flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                นำออก
                              </button>
                            </div>

                            {/* Scope Radios */}
                            <div className="flex gap-4 items-center">
                              <label className="flex items-center gap-2 cursor-pointer text-xs">
                                <input
                                  type="radio"
                                  name={`scope-${idx}`}
                                  checked={rule.applyToAllColors}
                                  onChange={() => handleUpdateRuleScope(idx, true)}
                                  className="text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="font-semibold text-slate-700">
                                  ทั้ง Collection (ทุกสี)
                                </span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-xs">
                                <input
                                  type="radio"
                                  name={`scope-${idx}`}
                                  checked={!rule.applyToAllColors}
                                  onChange={() => {
                                    handleUpdateRuleScope(idx, false);
                                    loadColorsForCollection(rule.collection);
                                  }}
                                  className="text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="font-semibold text-slate-700">
                                  เลือกเฉพาะบางสี ({rule.selectedColors?.length || 0} สีที่เลือก)
                                </span>
                              </label>
                            </div>

                            {/* Color Checkboxes (Shown if specific colors selected) */}
                            {!rule.applyToAllColors && (
                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-600 font-medium">
                                    ติ๊กเลือกสีที่ต้องการกำหนดโปรโมชั่น:
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAllColorsInRule(idx, rule.collection)}
                                      className="text-indigo-600 hover:underline font-semibold"
                                    >
                                      เลือกทุกสี
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeselectAllColorsInRule(idx)}
                                      className="text-slate-500 hover:underline font-semibold"
                                    >
                                      ล้างการเลือก
                                    </button>
                                  </div>
                                </div>

                                {colorsForCol.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic">
                                    กำลังโหลดรายชื่อสี หรือไม่พบสีใน Collection นี้
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
                                    {colorsForCol.map((colName) => {
                                      const isChecked = rule.selectedColors?.includes(colName);
                                      return (
                                        <label
                                          key={colName}
                                          className={`flex items-center gap-2 p-1.5 rounded-md text-xs cursor-pointer border select-none transition-colors ${
                                            isChecked
                                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggleColorInRule(idx, colName)}
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
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingId ? 'บันทึกการแก้ไข' : 'บันทึกกลุ่มโปรโมชั่น'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-200/60 rounded-xl"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
