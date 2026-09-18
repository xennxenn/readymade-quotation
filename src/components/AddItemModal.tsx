import React, { useState, useEffect } from 'react';
import {
  X,
  Barcode,
  Layers,
  Scissors,
  Check,
  AlertCircle,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react';
import { QuoteItem, CustomPatternType, PromotionGroup } from '../types';
import {
  getProductByBarcode,
  getDistinctCollections,
  getDistinctDescriptions,
  getDistinctSizes,
  getDistinctColors,
  findProduct,
  findApplicableDiscount,
} from '../services/db';
import { formatItemDescription } from '../services/calculations';
import { SearchableSelect, SearchableOption } from './SearchableSelect';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: QuoteItem) => void;
  promotionGroups: PromotionGroup[];
  sectionTitle?: string;
  initialItem?: QuoteItem | null;
}

const CUSTOM_PATTERNS: CustomPatternType[] = [
  'ผ้าปูที่นอนแบบรัดมุม',
  'ผ้าปูที่นอนแบบไม่รัดมุม',
  'ปลอกหมอนหนุน',
  'ปลอกหมอนบอดี้',
  'ปลอกหมอนข้าง',
  'ปลอกผ้านวม',
  'ผ้านวมเย็บติด',
  'ปลอกหมอนอิง',
];

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onAddItem,
  promotionGroups,
  sectionTitle,
  initialItem,
}) => {
  const [entryMode, setEntryMode] = useState<'barcode' | 'hierarchy'>('hierarchy');

  // Barcode mode state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeSearchStatus, setBarcodeSearchStatus] = useState<string | null>(null);

  // Form Fields
  const [isCustom, setIsCustom] = useState(false);
  const [collection, setCollection] = useState('');
  const [description, setDescription] = useState('');
  const [customPattern, setCustomPattern] = useState<CustomPatternType>('ผ้าปูที่นอนแบบรัดมุม');
  const [customSizeUnit, setCustomSizeUnit] = useState<'cm.' | 'in.'>('cm.');
  const [customSizeValue, setCustomSizeValue] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [customColorInput, setCustomColorInput] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [unit, setUnit] = useState('ชิ้น');
  const [quantity, setQuantity] = useState<number>(1);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [excludeOntopDiscount, setExcludeOntopDiscount] = useState(false);
  const [matchedBarcode, setMatchedBarcode] = useState<string | undefined>(undefined);

  // Dynamic dropdown options
  const [collectionsList, setCollectionsList] = useState<string[]>([]);
  const [descriptionsList, setDescriptionsList] = useState<string[]>([]);
  const [sizesList, setSizesList] = useState<string[]>([]);
  const [colorsList, setColorsList] = useState<string[]>([]);

  // Load collections on open
  useEffect(() => {
    if (isOpen) {
      loadCollections();
      if (initialItem) {
        // Edit mode
        setIsCustom(initialItem.isCustom ?? false);
        setCollection(initialItem.collection || '');
        setDescription(initialItem.description || '');
        setCustomPattern(initialItem.customPattern || 'ผ้าปูที่นอนแบบรัดมุม');
        setCustomSizeUnit(initialItem.customSizeUnit || 'cm.');
        setCustomSizeValue(initialItem.customSizeValue || '');
        setSize(initialItem.size || '');
        setColor(initialItem.color || '');
        setPrice(initialItem.price ?? 0);
        setUnit(initialItem.unit || 'ชิ้น');
        setQuantity(initialItem.quantity || 1);
        setDiscountPercent(initialItem.discountPercent ?? 0);
        setExcludeOntopDiscount(initialItem.excludeOntopDiscount ?? false);
        setMatchedBarcode(initialItem.barcode);
        setEntryMode(initialItem.barcode ? 'barcode' : 'hierarchy');
        if (initialItem.barcode) setBarcodeInput(initialItem.barcode);
      } else {
        // Reset defaults
        resetForm();
      }
    }
  }, [isOpen, initialItem]);

  const loadCollections = async () => {
    const list = await getDistinctCollections();
    setCollectionsList(list);
  };

  const resetForm = () => {
    setBarcodeInput('');
    setBarcodeSearchStatus(null);
    setIsCustom(false);
    setCollection('');
    setDescription('');
    setCustomPattern('ผ้าปูที่นอนแบบรัดมุม');
    setCustomSizeUnit('cm.');
    setCustomSizeValue('');
    setSize('');
    setColor('');
    setCustomColorInput('');
    setPrice(0);
    setUnit('ชิ้น');
    setQuantity(1);
    setDiscountPercent(0);
    setExcludeOntopDiscount(false);
    setMatchedBarcode(undefined);
    setSizesList([]);
    setColorsList([]);
  };

  // When collection changes
  const handleCollectionChange = async (newCol: string) => {
    setCollection(newCol);
    setDescription('');
    setSize('');
    setColor('');
    setPrice(0);

    if (newCol) {
      const descs = await getDistinctDescriptions(newCol);
      setDescriptionsList(descs);
      const cols = await getDistinctColors(newCol);
      setColorsList(cols);
    } else {
      setDescriptionsList([]);
      setColorsList([]);
    }
  };

  // When description changes
  const handleDescriptionChange = async (newDesc: string) => {
    setDescription(newDesc);
    setSize('');
    setColor('');
    setPrice(0);

    if (newDesc === 'สั่งตัดพิเศษ') {
      setIsCustom(true);
      setDiscountPercent(0); // 6. ระบุส่วนลด (Default เป็น 0)
      if (customPattern.includes('ผ้าปู') || customPattern.includes('ผ้านวม')) {
        setUnit('ผืน');
      } else {
        setUnit('ชิ้น');
      }
      return;
    }

    setIsCustom(false);
    if (collection && newDesc) {
      const sizes = await getDistinctSizes(collection, newDesc);
      setSizesList(sizes);
    }
  };

  // When pattern changes for custom item
  const handlePatternChange = (pat: CustomPatternType) => {
    setCustomPattern(pat);
    if (pat.includes('ผ้าปู') || pat.includes('ผ้านวม')) {
      setUnit('ผืน');
    } else {
      setUnit('ชิ้น');
    }
  };

  // When size changes
  const handleSizeChange = async (newSize: string) => {
    setSize(newSize);
    setColor('');
    setPrice(0);

    if (collection && description && newSize) {
      const colors = await getDistinctColors(collection, description, newSize);
      setColorsList(colors);
    }
  };

  // When color changes (Regular)
  const handleColorChange = async (newColor: string) => {
    setColor(newColor);
    if (collection && description && size && newColor) {
      const prod = await findProduct(collection, description, size, newColor);
      if (prod) {
        setPrice(prod.price);
        setUnit(prod.unit || 'ชิ้น');
        setMatchedBarcode(prod.barcode);

        // Apply Promotion Group default discount
        const defaultDiscount = findApplicableDiscount(promotionGroups, collection, newColor);
        setDiscountPercent(defaultDiscount);
      }
    }
  };

  // Barcode Lookup
  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) return;
    setBarcodeSearchStatus('กำลังค้นหา...');

    const prod = await getProductByBarcode(barcodeInput.trim());
    if (prod) {
      setIsCustom(false);
      setCollection(prod.collection);
      setDescription(prod.description);
      setSize(prod.size);
      setColor(prod.color);
      setPrice(prod.price);
      setUnit(prod.unit || 'ชิ้น');
      setMatchedBarcode(prod.barcode);

      const defaultDiscount = findApplicableDiscount(promotionGroups, prod.collection, prod.color);
      setDiscountPercent(defaultDiscount);

      setBarcodeSearchStatus('พบบาร์โค้ด: ' + prod.itemName || prod.description);
    } else {
      setBarcodeSearchStatus('ไม่พบบาร์โค้ดนี้ในฐานข้อมูล');
    }
  };

  const handleSaveItem = () => {
    const finalColor = isCustom && customColorInput ? customColorInput : color;
    let finalSize = size;

    if (isCustom) {
      finalSize = `${customSizeValue.trim()} ${customSizeUnit}`;
    }

    if (!collection.trim()) {
      alert('กรุณาระบุ Collection');
      return;
    }

    if (isCustom) {
      if (!customSizeValue.trim()) {
        alert('กรุณาระบุขนาด Size');
        return;
      }
      if (!finalColor) {
        alert('กรุณาเลือกหรือระบุสี Color');
        return;
      }
      if (price <= 0) {
        alert('กรุณาระบุราคาสินค้า');
        return;
      }
    } else {
      if (!description) {
        alert('กรุณาเลือก Descriptions');
        return;
      }
      if (!finalSize) {
        alert('กรุณาเลือก Size');
        return;
      }
      if (!finalColor) {
        alert('กรุณาเลือก Color');
        return;
      }
    }

    const newItem: QuoteItem = {
      id: initialItem?.id || 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      isCustom,
      barcode: matchedBarcode,
      collection: collection.trim(),
      description: isCustom ? 'สั่งตัดพิเศษ' : description,
      color: finalColor.trim(),
      size: finalSize.trim(),
      unit: unit.trim() || 'ชิ้น',
      quantity: Math.max(1, quantity),
      price: Math.max(0, price),
      discountPercent: Math.max(0, Math.min(100, discountPercent)),
      excludeOntopDiscount,
      customPattern: isCustom ? customPattern : undefined,
      customSizeUnit: isCustom ? customSizeUnit : undefined,
      customSizeValue: isCustom ? customSizeValue.trim() : undefined,
    };

    onAddItem(newItem);
    onClose();
  };

  // Preview Object
  const previewItem: QuoteItem = {
    id: 'temp',
    isCustom,
    collection,
    description: isCustom ? 'สั่งตัดพิเศษ' : description,
    color: isCustom && customColorInput ? customColorInput : color,
    size: isCustom ? `${customSizeValue} ${customSizeUnit}` : size,
    unit,
    quantity,
    price,
    discountPercent,
    excludeOntopDiscount,
    customPattern,
    customSizeUnit,
    customSizeValue,
  };

  const previewFormattedName = formatItemDescription(previewItem);
  const previewGross = quantity * price;
  const previewDiscountAmount = previewGross * (discountPercent / 100);
  const previewNet = previewGross - previewDiscountAmount;

  const collectionOptions: SearchableOption[] = [
    { value: '', label: '-- เลือก Collection --' },
    ...collectionsList.map((col) => ({ value: col, label: col })),
  ];

  const descriptionOptions: SearchableOption[] = [
    { value: '', label: '-- เลือก Description --' },
    { value: 'สั่งตัดพิเศษ', label: '✂️ สั่งตัดพิเศษ (Made-to-order)', badge: 'สั่งตัด' },
    ...descriptionsList.map((desc) => ({ value: desc, label: desc })),
  ];

  const customPatternOptions: SearchableOption[] = CUSTOM_PATTERNS.map((p) => ({
    value: p,
    label: p,
  }));

  const customColorsOptions: SearchableOption[] = [
    { value: '', label: `-- เลือกสีจาก Collection (${collection || 'ทั่วไป'}) --` },
    ...colorsList.map((c) => ({ value: c, label: c })),
  ];

  const sizesOptions: SearchableOption[] = [
    { value: '', label: '-- เลือก Size --' },
    ...sizesList.map((s) => ({ value: s, label: s })),
  ];

  const colorsOptions: SearchableOption[] = [
    { value: '', label: '-- เลือก Color --' },
    ...colorsList.map((c) => ({ value: c, label: c })),
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 overflow-y-auto backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              {initialItem ? 'แก้ไขรายการสินค้า' : 'เพิ่มรายการสินค้าลงในใบเสนอราคา'}
            </h3>
            {sectionTitle && (
              <p className="text-xs text-slate-500 mt-0.5">
                หมวดหมู่/ชุดข้อมูล: <span className="font-semibold text-slate-700">{sectionTitle}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (only in create mode) */}
        {!initialItem && (
          <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-2">
            <button
              type="button"
              onClick={() => setEntryMode('hierarchy')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                entryMode === 'hierarchy'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              เลือกตามขั้นตอน (Collection &gt; สินค้า)
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('barcode')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                entryMode === 'barcode'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Barcode className="w-4 h-4" />
              ค้นหาด้วยบาร์โค้ด (Barcode)
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1">
          {/* BARCODE MODE SEARCH BOX */}
          {entryMode === 'barcode' && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3.5 space-y-2">
              <label className="block text-xs font-semibold text-indigo-900">
                สแกนหรือใส่รหัสบาร์โค้ดสินค้า (Barcode):
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={barcodeInput || ''}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                    placeholder="เช่น 885123400101 หรือยิงบาร์โค้ด..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
                <button
                  type="button"
                  onClick={handleBarcodeSearch}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  ดึงข้อมูล
                </button>
              </div>
              {barcodeSearchStatus && (
                <p
                  className={`text-xs flex items-center gap-1.5 font-medium ${
                    barcodeSearchStatus.includes('พบ') ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  {barcodeSearchStatus}
                </p>
              )}
            </div>
          )}

          {/* STEP 1: COLLECTION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1. เลือก Collection <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={collectionOptions}
                value={collection || ''}
                onChange={(v) => handleCollectionChange(v)}
                placeholder="-- เลือก Collection --"
                searchPlaceholder="ค้นหา Collection..."
              />
            </div>

            {/* STEP 2: DESCRIPTIONS */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                2. เลือก Descriptions <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={descriptionOptions}
                value={description || ''}
                onChange={(v) => handleDescriptionChange(v)}
                disabled={!collection}
                placeholder="-- เลือก Description --"
                searchPlaceholder="ค้นหา Description หรือสั่งตัด..."
              />
            </div>
          </div>

          {/* CUSTOM MADE-TO-ORDER FORM (REQUIREMENT 6) */}
          {isCustom && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
                <Scissors className="w-4 h-4 text-amber-700" />
                <span>กำหนดรายละเอียดสินค้าสั่งตัดพิเศษ (Custom Made-to-order)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Custom Pattern */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลือกรูปแบบ <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={customPatternOptions}
                    value={customPattern || 'ผ้าปูที่นอนแบบรัดมุม'}
                    onChange={(v) => handlePatternChange(v as CustomPatternType)}
                    placeholder="เลือกรูปแบบ"
                  />
                </div>

                {/* Custom Size with cm./in. selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ระบุ Size และหน่วย <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customSizeValue || ''}
                      onChange={(e) => setCustomSizeValue(e.target.value)}
                      placeholder="เช่น 193 x 203 x 21.5 หรือ 12 x 35"
                      className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="flex items-center border border-amber-300 rounded-lg overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setCustomSizeUnit('cm.')}
                        className={`px-2.5 py-1.5 text-xs font-medium ${
                          customSizeUnit === 'cm.'
                            ? 'bg-amber-600 text-white font-bold'
                            : 'text-slate-600 hover:bg-amber-100'
                        }`}
                      >
                        cm.
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomSizeUnit('in.')}
                        className={`px-2.5 py-1.5 text-xs font-medium ${
                          customSizeUnit === 'in.'
                            ? 'bg-amber-600 text-white font-bold'
                            : 'text-slate-600 hover:bg-amber-100'
                        }`}
                      >
                        in.
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custom Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลือก Color <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-1.5">
                    <SearchableSelect
                      options={customColorsOptions}
                      value={color || ''}
                      onChange={(v) => {
                        setColor(v);
                        setCustomColorInput('');
                      }}
                      placeholder={`-- เลือกสีจาก Collection (${collection || 'ทั่วไป'}) --`}
                      searchPlaceholder="ค้นหารหัสสี..."
                    />
                    <input
                      type="text"
                      value={customColorInput || ''}
                      onChange={(e) => {
                        setCustomColorInput(e.target.value);
                        setColor('');
                      }}
                      placeholder="หรือพิมพ์ชื่อสีพิเศษเอง..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Custom Price */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ระบุราคาต่อหน่วย (@Price ฿) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={price ?? 0}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    placeholder="เช่น 9350"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-slate-800 text-sm font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STANDARD PRODUCT STEPS (STEP 3 & 4) */}
          {!isCustom && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* STEP 3: SIZE */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  3. เลือก Size <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={sizesOptions}
                  value={size || ''}
                  onChange={(v) => handleSizeChange(v)}
                  disabled={!description || sizesList.length === 0}
                  placeholder="-- เลือก Size --"
                  searchPlaceholder="ค้นหา Size..."
                />
              </div>

              {/* STEP 4: COLOR */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  4. เลือก Color <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={colorsOptions}
                  value={color || ''}
                  onChange={(v) => handleColorChange(v)}
                  disabled={!size || colorsList.length === 0}
                  placeholder="-- เลือก Color --"
                  searchPlaceholder="ค้นหา Color..."
                />
              </div>
            </div>
          )}

          {/* QUANTITY, PRICE, DISCOUNT, ONTOP CHECKBOX */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวน (Qty)
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity ?? 1}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm font-semibold"
                />
              </div>

              {/* Unit */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หน่วย (Unit)
                </label>
                <input
                  type="text"
                  value={unit || ''}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="ผืน, ชิ้น, ชุด"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm"
                />
              </div>

              {/* Price (@Price) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ราคาต่อหน่วย (@Price)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={price ?? 0}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    disabled={!isCustom && entryMode === 'barcode'}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm font-bold disabled:bg-slate-100"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">฿</span>
                </div>
              </div>

              {/* Discount Percent */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>ส่วนลด (% Disc)</span>
                  {discountPercent > 0 && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-bold">
                      โปรโมชั่น
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={discountPercent ?? 0}
                    onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm font-semibold text-emerald-700"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">%</span>
                </div>
              </div>
            </div>

            {/* Exclude Ontop Discount Option */}
            <div className="pt-2 border-t border-slate-200">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={excludeOntopDiscount}
                  onChange={(e) => setExcludeOntopDiscount(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-slate-300"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800">
                    ไม่ให้ใช้ส่วนลด Ontop ท้ายบิลสำหรับรายการนี้
                  </span>
                  <p className="text-[11px] text-slate-500">
                    หากติ๊กไว้ ส่วนลด Ontop รวมท้ายบิลจะไม่นำยอดสินค้ารายการนี้ไปคำนวณลดเพิ่ม
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* REAL-TIME PREVIEW OF QUOTATION LINE (REQUIREMENT 7 & 8) */}
          <div className="bg-slate-100/80 rounded-xl p-3.5 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                ตัวอย่างการแสดงผลในใบเสนอราคา:
              </span>
              <span className="text-slate-500 text-[11px]">
                {isCustom ? 'สั่งตัดพิเศษ (ข้อ 8)' : 'สินค้าปกติ (ข้อ 7)'}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 shadow-2xs break-words">
              {previewFormattedName || '(กรุณาเลือกข้อมูลเพื่อดูรูปแบบข้อความ)'}
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60 font-medium">
              <span className="text-slate-500">
                {quantity} {unit} × {price.toLocaleString()} ฿ = {previewGross.toLocaleString()} ฿
              </span>
              <span className="text-slate-800 font-bold">
                ยอดสุทธิ: {previewNet.toLocaleString()} ฿
                {discountPercent > 0 && (
                  <span className="text-emerald-600 text-xs ml-1">(-{discountPercent}%)</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSaveItem}
            className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs hover:shadow-md transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {initialItem ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
          </button>
        </div>
      </div>
    </div>
  );
};
