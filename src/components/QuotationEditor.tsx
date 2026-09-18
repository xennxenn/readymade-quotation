import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Calendar,
  User,
  Building,
  Phone,
  CreditCard,
  UserCheck,
  Briefcase,
  Percent,
  Scissors,
  Check,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  Quotation,
  QuoteSection,
  QuoteItem,
  StaffMember,
  PromotionGroup,
  ValidityOption,
  PaymentConditionOption,
} from '../types';
import { calculateQuotation, formatItemDescription } from '../services/calculations';
import { AddItemModal } from './AddItemModal';
import { SearchableSelect, SearchableOption } from './SearchableSelect';

interface QuotationEditorProps {
  quotation: Quotation;
  onChange: (updated: Quotation) => void;
  staffList: StaffMember[];
  promotionGroups: PromotionGroup[];
}

export const QuotationEditor: React.FC<QuotationEditorProps> = ({
  quotation,
  onChange,
  staffList,
  promotionGroups,
}) => {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    sectionId: string;
    item: QuoteItem;
  } | null>(null);

  const calc = calculateQuotation(quotation);

  // Customer Field Updater
  const updateCustomer = (field: string, value: unknown) => {
    onChange({
      ...quotation,
      customer: {
        ...quotation.customer,
        [field]: value,
      },
    });
  };

  // Sections Management
  const handleAddSection = () => {
    const newSection: QuoteSection = {
      id: 'sec-' + Date.now(),
      title: `ชุดข้อมูลใหม่ ${quotation.sections.length + 1}`,
      items: [],
    };
    onChange({
      ...quotation,
      sections: [...quotation.sections, newSection],
    });
  };

  const handleUpdateSectionTitle = (sectionId: string, title: string) => {
    onChange({
      ...quotation,
      sections: quotation.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)),
    });
  };

  const handleDeleteSection = (sectionId: string) => {
    if (quotation.sections.length <= 1) {
      return;
    }
    onChange({
      ...quotation,
      sections: quotation.sections.filter((s) => s.id !== sectionId),
    });
  };

  // Items Management
  const handleOpenAddItem = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setEditingItem(null);
    setIsAddItemModalOpen(true);
  };

  const handleOpenEditItem = (sectionId: string, item: QuoteItem) => {
    setActiveSectionId(sectionId);
    setEditingItem({ sectionId, item });
    setIsAddItemModalOpen(true);
  };

  const handleSaveItem = (item: QuoteItem) => {
    if (!activeSectionId) return;

    const sections = quotation.sections.map((sec) => {
      if (sec.id !== activeSectionId) return sec;

      if (editingItem) {
        // Edit existing item
        return {
          ...sec,
          items: sec.items.map((i) => (i.id === item.id ? item : i)),
        };
      } else {
        // Append new item
        return {
          ...sec,
          items: [...sec.items, item],
        };
      }
    });

    onChange({
      ...quotation,
      sections,
    });
  };

  const handleDeleteItem = (sectionId: string, itemId: string) => {
    const sections = quotation.sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        items: sec.items.filter((i) => i.id !== itemId),
      };
    });

    onChange({
      ...quotation,
      sections,
    });
  };

  const handleToggleExcludeOntop = (sectionId: string, itemId: string) => {
    const sections = quotation.sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        items: sec.items.map((i) =>
          i.id === itemId ? { ...i, excludeOntopDiscount: !i.excludeOntopDiscount } : i
        ),
      };
    });

    onChange({
      ...quotation,
      sections,
    });
  };

  // Notes Management
  const handleAddNote = () => {
    onChange({
      ...quotation,
      notes: [...quotation.notes, ''],
    });
  };

  const handleUpdateNote = (index: number, text: string) => {
    const updated = [...quotation.notes];
    updated[index] = text;
    onChange({
      ...quotation,
      notes: updated,
    });
  };

  const handleDeleteNote = (index: number) => {
    onChange({
      ...quotation,
      notes: quotation.notes.filter((_, idx) => idx !== index),
    });
  };

  const getAddressLine = (lineNum: 1 | 2 | 3): string => {
    if (lineNum === 1) {
      if (quotation.customer?.addressLine1 !== undefined && quotation.customer?.addressLine1 !== null) {
        return quotation.customer.addressLine1;
      }
      return (quotation.customer?.address || '').split('\n')[0] || '';
    }
    if (lineNum === 2) {
      if (quotation.customer?.addressLine2 !== undefined && quotation.customer?.addressLine2 !== null) {
        return quotation.customer.addressLine2;
      }
      return (quotation.customer?.address || '').split('\n')[1] || '';
    }
    if (lineNum === 3) {
      if (quotation.customer?.addressLine3 !== undefined && quotation.customer?.addressLine3 !== null) {
        return quotation.customer.addressLine3;
      }
      return (quotation.customer?.address || '').split('\n')[2] || '';
    }
    return '';
  };

  const handleAddressLineChange = (lineNum: 1 | 2 | 3, value: string) => {
    const l1 = lineNum === 1 ? value : getAddressLine(1);
    const l2 = lineNum === 2 ? value : getAddressLine(2);
    const l3 = lineNum === 3 ? value : getAddressLine(3);
    const combined = [l1, l2, l3].filter(Boolean).join('\n');

    onChange({
      ...quotation,
      customer: {
        ...quotation.customer,
        addressLine1: l1,
        addressLine2: l2,
        addressLine3: l3,
        address: combined,
      },
    });
  };

  const adminStaff = staffList.filter((s) => s.role === 'admin' || s.role === 'manager' || s.role === 'staff');
  const salesStaff = staffList.filter((s) => s.role === 'staff' || s.role === 'manager' || s.role === 'admin');

  const validityOptions: SearchableOption[] = [
    { value: '3 วัน', label: '3 วัน (Days)' },
    { value: '7 วัน', label: '7 วัน (Days)' },
    { value: 'custom', label: 'ระบุกำหนดวันเอง... (Custom Days)' },
  ];

  const paymentConditionOptions: SearchableOption[] = [
    { value: 'ชำระเงิน 100%', label: 'ชำระเงินเต็มจำนวน (100%)' },
    {
      value: 'มัดจำ 50% และชำระส่วนที่เหลือเมื่อส่งมอบสินค้า',
      label: 'มัดจำ 50% และชำระส่วนที่เหลือเมื่อส่งมอบสินค้า',
    },
    { value: 'custom', label: 'กำหนดเงื่อนไขเอง... (Custom)' },
  ];

  const adminStaffOptions: SearchableOption[] = [
    { value: '', label: '-- เลือกผู้ดูแล --' },
    ...adminStaff.map((s) => ({
      value: s.name,
      label: s.employeeId ? `[${s.employeeId}] ${s.name}` : s.name,
      sublabel: `โทร: ${s.phone || '-'}`,
      badge: s.role === 'manager' ? 'ผู้จัดการ' : s.role === 'admin' ? 'แอดมิน' : 'พนักงาน',
    })),
  ];

  const salesStaffOptions: SearchableOption[] = [
    { value: '', label: '-- เลือกพนักงานขาย --' },
    ...salesStaff.map((s) => ({
      value: s.name,
      label: s.employeeId ? `[${s.employeeId}] ${s.name}` : s.name,
      sublabel: `โทร: ${s.phone || '-'}`,
      badge: s.role === 'manager' ? 'ผู้จัดการ' : s.role === 'admin' ? 'แอดมิน' : 'พนักงาน',
    })),
  ];

  const discountApplyFromOptions: SearchableOption[] = [
    { value: 'after_discount', label: 'ลดจากยอดหลังหักส่วนลดสินค้า' },
    { value: 'before_discount', label: 'ลดจากยอดรวมก่อนหักส่วนลด' },
  ];

  const discountTypeOptions: SearchableOption[] = [
    { value: 'percent', label: 'เปอร์เซ็นต์ (%)' },
    { value: 'amount', label: 'บาท (฿)' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. ข้อมูลลูกค้า และเงื่อนไขทั่วไป (CUSTOMER INFO CARD - 70% Left / 30% Right) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <User className="w-4 h-4 text-indigo-600" />
            <span>1. ข้อมูลลูกค้า และเงื่อนไขการเสนอราคา</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> วันที่:
            </label>
            <input
              type="date"
              value={quotation.date}
              onChange={(e) => onChange({ ...quotation, date: e.target.value })}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium"
            />
            <input
              type="text"
              value={quotation.quotationNumber}
              onChange={(e) => onChange({ ...quotation, quotationNumber: e.target.value })}
              placeholder="เลขที่ใบเสนอราคา"
              className="w-32 px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-mono font-medium"
            />
          </div>
        </div>

        {/* Balanced 70% Left / 30% Right Grid Layout */}
        <div className="flex flex-col lg:flex-row text-xs divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left Column: 70% Customer Details */}
          <div className="w-full lg:w-[70%] p-5 space-y-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>ข้อมูลลูกค้า (Customer Details) - สัดส่วน 70%</span>
              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-normal">
                ตรงตามแบบฟอร์มเอกสาร
              </span>
            </div>

            {/* Row 1: Contact & Customer Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ชื่อผู้ติดต่อ (Contact Name) <span className="text-red-500">* จำเป็น</span>
                </label>
                <input
                  type="text"
                  required
                  value={quotation.customer.contactName}
                  onChange={(e) => updateCustomer('contactName', e.target.value)}
                  placeholder="เช่น คุณเนตรนภา"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ชื่อลูกค้า (Customer Name) <span className="text-red-500">* จำเป็น</span>
                </label>
                <input
                  type="text"
                  required
                  value={quotation.customer.customerName}
                  onChange={(e) => updateCustomer('customerName', e.target.value)}
                  placeholder="เช่น คุณเนตรนภา หรือ ชื่อบริษัท..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Row 2: 3-line Address */}
            <div className="space-y-2 bg-slate-50/70 p-3 rounded-lg border border-slate-200">
              <label className="block font-semibold text-slate-700">
                ที่อยู่ลูกค้า (Address - กำหนด 3 บรรทัด) <span className="text-slate-400 font-normal">(ตัวเลือก)</span>
              </label>

              <div>
                <input
                  type="text"
                  value={getAddressLine(1)}
                  onChange={(e) => handleAddressLineChange(1, e.target.value)}
                  placeholder="บรรทัดที่ 1: เลขที่, ซอย, ถนน, อาคาร/หมู่บ้าน (เช่น 9/9 หมู่บ้านพฤกษาวิลล์)"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={getAddressLine(2)}
                  onChange={(e) => handleAddressLineChange(2, e.target.value)}
                  placeholder="บรรทัดที่ 2: ตำบล/แขวง, อำเภอ/เขต (เช่น ตำบลอ้อมเกร็ด อำเภอปากเกร็ด)"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={getAddressLine(3)}
                  onChange={(e) => handleAddressLineChange(3, e.target.value)}
                  placeholder="บรรทัดที่ 3: จังหวัด และ รหัสไปรษณีย์ (เช่น จังหวัดนนทบุรี 11120)"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Row 3: Tax ID & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  เลขที่ประจำตัวผู้เสียภาษี (Tax ID){' '}
                  <span className="text-slate-400 font-normal">(ตัวเลือก)</span>
                </label>
                <input
                  type="text"
                  value={quotation.customer.taxId}
                  onChange={(e) => updateCustomer('taxId', e.target.value)}
                  placeholder="เช่น 0105546015615 หรือ -"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  เบอร์โทรศัพท์ (Phone) <span className="text-red-500">* จำเป็น</span>
                </label>
                <input
                  type="tel"
                  required
                  value={quotation.customer.phone}
                  onChange={(e) => updateCustomer('phone', e.target.value)}
                  placeholder="เช่น 081-573-7941"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Right Column: 30% Validity & Staff Terms */}
          <div className="w-full lg:w-[30%] p-5 space-y-4 bg-slate-50/50">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              เงื่อนไขและเจ้าหน้าที่ (Terms) - สัดส่วน 30%
            </div>

            {/* กำหนดยืนราคา */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                กำหนดยืนราคา (Validity)
              </label>
              <div className="space-y-1.5">
                <SearchableSelect
                  options={validityOptions}
                  value={quotation.customer.validityType}
                  onChange={(val) => updateCustomer('validityType', val as ValidityOption)}
                  placeholder="เลือกกำหนดยืนราคา"
                />
                {quotation.customer.validityType === 'custom' && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="number"
                      min="1"
                      value={quotation.customer.validityCustomDays || 15}
                      onChange={(e) =>
                        updateCustomer('validityCustomDays', parseInt(e.target.value) || 1)
                      }
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                    />
                    <span className="text-slate-500">วัน</span>
                  </div>
                )}
              </div>
            </div>

            {/* เงื่อนไขการชำระเงิน */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                เงื่อนไขการชำระเงิน
              </label>
              <SearchableSelect
                options={paymentConditionOptions}
                value={quotation.customer.paymentCondition}
                onChange={(val) => updateCustomer('paymentCondition', val as PaymentConditionOption)}
                placeholder="เลือกเงื่อนไขการชำระเงิน"
              />
              {quotation.customer.paymentCondition === 'custom' && (
                <input
                  type="text"
                  value={quotation.customer.paymentCustomText || ''}
                  onChange={(e) => updateCustomer('paymentCustomText', e.target.value)}
                  placeholder="ระบุข้อความเงื่อนไข..."
                  className="w-full mt-1.5 px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                />
              )}
            </div>

            {/* ผู้ดูแล (Admin) */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                ผู้ดูแล (Admin)
              </label>
              <SearchableSelect
                options={adminStaffOptions}
                value={quotation.customer.adminName}
                onChange={(val) => updateCustomer('adminName', val)}
                placeholder="-- เลือกผู้ดูแล --"
                searchPlaceholder="ค้นหาชื่อหรือรหัสผู้ดูแล..."
              />
            </div>

            {/* พนักงานขาย (Sales) */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                พนักงานขาย (Sale)
              </label>
              <SearchableSelect
                options={salesStaffOptions}
                value={quotation.customer.salesName}
                onChange={(val) => updateCustomer('salesName', val)}
                placeholder="-- เลือกพนักงานขาย --"
                searchPlaceholder="ค้นหาชื่อหรือรหัสพนักงานขาย..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. รายการสินค้าแยกตามชุดข้อมูล / หมวดหมู่ (SECTIONS BUILDER) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-800">
              2. กำหนดหัวข้อและรายการสินค้าแต่ละชุดข้อมูล
            </h3>
            <span className="text-xs text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full font-semibold">
              {quotation.sections.length} ชุดข้อมูล
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddSection}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            เพิ่มชุดข้อมูลใหม่ (Add Section)
          </button>
        </div>

        {/* Sections List */}
        {quotation.sections.map((section, sIdx) => {
          const secCalc = calc.sectionCalculations.get(section.id);

          return (
            <div
              key={section.id}
              className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden"
            >
              {/* Section Header Bar */}
              <div className="px-5 py-3.5 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-bold shrink-0">
                    {sIdx + 1}
                  </span>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => handleUpdateSectionTitle(section.id, e.target.value)}
                      placeholder="เช่น ห้องลูกชาย - KUBUA / WHIMSICAL BLUE"
                      className="w-full px-3 py-1.5 text-xs sm:text-sm font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAddItem(section.id)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มรายการสินค้าในชุดนี้
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSection(section.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="ลบชุดข้อมูลนี้"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3 min-w-[240px]">
                        รายการสินค้า (Description Color Size)
                      </th>
                      <th className="py-2 px-2 text-center w-16">จำนวน</th>
                      <th className="py-2 px-2 text-center w-14">หน่วย</th>
                      <th className="py-2 px-3 text-right w-24">ราคา (@Price)</th>
                      <th className="py-2 px-3 text-right w-24">ยอดรวม</th>
                      <th className="py-2 px-2 text-center w-20">ส่วนลด</th>
                      <th className="py-2 px-3 text-right w-28">ยอดรวมสุทธิ</th>
                      <th className="py-2 px-2 text-center w-20" title="ติ๊กเมื่อไม่ต้องการลด Ontop">
                        ไม่ลด Ontop
                      </th>
                      <th className="py-2 px-3 text-center w-20">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {section.items.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          ยังไม่มีรายการสินค้าในชุดข้อมูลนี้ — คลิก{' '}
                          <span className="font-semibold text-emerald-600">
                            &quot;+ เพิ่มรายการสินค้าในชุดนี้&quot;
                          </span>{' '}
                          ด้านบน
                        </td>
                      </tr>
                    ) : (
                      section.items.map((item, idx) => {
                        const itemCalc = calc.itemCalculations.get(item.id);
                        const formattedName = formatItemDescription(item);

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.isCustom && (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 shrink-0">
                                    <Scissors className="w-3 h-3" /> สั่งตัดพิเศษ
                                  </span>
                                )}
                                <span>{formattedName}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-700">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-500">{item.unit}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                              {item.price.toLocaleString()} ฿
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {itemCalc?.grossAmount.toLocaleString()} ฿
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {item.discountPercent > 0 ? (
                                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold font-mono">
                                  {item.discountPercent}%
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                              {itemCalc?.netAmount.toLocaleString()} ฿
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={item.excludeOntopDiscount}
                                onChange={() => handleToggleExcludeOntop(section.id, item.id)}
                                title="ติ๊กเมื่อไม่ให้ใช้ส่วนลด Ontop ท้ายบิลสำหรับรายการนี้"
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer border-slate-300"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditItem(section.id, item)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                  title="แก้ไขรายการ"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(section.id, item.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="ลบรายการ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  {/* Section Subtotal Footer */}
                  {section.items.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100/70 font-semibold border-t border-slate-200 text-slate-700">
                        <td colSpan={5} className="py-2 px-4 text-right">
                          รวมชุดข้อมูล ({section.title || `ชุดที่ ${sIdx + 1}`}):
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {secCalc?.totalGrossAmount.toLocaleString()} ฿
                        </td>
                        <td></td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-indigo-900">
                          {secCalc?.totalNetAmount.toLocaleString()} ฿
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. สรุปส่วนลด ONTOP ท้ายบิล และส่วนลดเพิ่มเติม (DISCOUNTS & SUMMARY CARD) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Ontop, Additional Discounts & Notes */}
        <div className="space-y-4">
          {/* ONTOP DISCOUNT */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <Percent className="w-4 h-4 text-indigo-600" />
                <span>ส่วนลด Ontop ท้ายบิล (ใส่ครั้งเดียวลด Ontop ทั้งหมด)</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              ลด Ontop เพิ่มเติมจากยอดสินค้าทั้งหมด ยกเว้นรายการที่ติ๊ก &quot;ไม่ลด Ontop&quot;
            </p>
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700">ระบุส่วนลด Ontop (%):</label>
              <div className="relative w-32">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={quotation.ontopDiscountPercent || 0}
                  onChange={(e) =>
                    onChange({
                      ...quotation,
                      ontopDiscountPercent: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-sm font-bold text-indigo-700"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400">%</span>
              </div>
              <span className="text-xs font-semibold text-slate-600">
                = ลดเพิ่ม {calc.ontopDiscountAmount.toLocaleString()} ฿
              </span>
            </div>
          </div>

          {/* ADDITIONAL DISCOUNTS */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={quotation.additionalDiscount?.enabled || false}
                  onChange={(e) =>
                    onChange({
                      ...quotation,
                      additionalDiscount: {
                        ...quotation.additionalDiscount,
                        enabled: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-indigo-600 w-4 h-4 border-slate-300"
                />
                <span className="font-bold text-slate-800 text-sm">
                  ส่วนลดอื่นๆ เพิ่มเติม (เช่น ส่วนลดท้ายบิล หรือระบุเอง)
                </span>
              </label>
            </div>

            {quotation.additionalDiscount?.enabled && (
              <div className="pt-2 space-y-3 text-xs border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    คำอธิบายส่วนลดเพิ่มเติม:
                  </label>
                  <input
                    type="text"
                    value={quotation.additionalDiscount.description || ''}
                    onChange={(e) =>
                      onChange({
                        ...quotation,
                        additionalDiscount: {
                          ...quotation.additionalDiscount,
                          description: e.target.value,
                        },
                      })
                    }
                    placeholder="เช่น ส่วนลดพิเศษโครงการ, ส่วนลดท้ายบิล"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ลดจากยอดไหน:</label>
                    <SearchableSelect
                      options={discountApplyFromOptions}
                      value={quotation.additionalDiscount.applyFrom || 'after_discount'}
                      onChange={(val) =>
                        onChange({
                          ...quotation,
                          additionalDiscount: {
                            ...quotation.additionalDiscount,
                            applyFrom: val as 'before_discount' | 'after_discount',
                          },
                        })
                      }
                      placeholder="เลือกลดจากยอดไหน"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ประเภทและมูลค่าส่วนลด:
                    </label>
                    <div className="flex gap-2 items-center">
                      <div className="w-36 shrink-0">
                        <SearchableSelect
                          options={discountTypeOptions}
                          value={quotation.additionalDiscount.type || 'percent'}
                          onChange={(val) =>
                            onChange({
                              ...quotation,
                              additionalDiscount: {
                                ...quotation.additionalDiscount,
                                type: val as 'amount' | 'percent',
                              },
                            })
                          }
                          placeholder="ประเภทส่วนลด"
                        />
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={quotation.additionalDiscount.value ?? 0}
                        onChange={(e) =>
                          onChange({
                            ...quotation,
                            additionalDiscount: {
                              ...quotation.additionalDiscount,
                              value: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* NOTES */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-sm">หมายเหตุท้ายใบเสนอราคา:</span>
              <button
                type="button"
                onClick={handleAddNote}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                เพิ่มข้อความหมายเหตุ
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {quotation.notes.map((note, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">{idx + 1}.</span>
                  <input
                    type="text"
                    value={note || ''}
                    onChange={(e) => handleUpdateNote(idx, e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(idx)}
                    className="text-slate-400 hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Financial Grand Totals Card */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="font-bold text-base text-slate-800 border-b border-slate-200 pb-3">
              สรุปยอดรวมใบเสนอราคา (Financial Summary)
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">ราคารวมภาษีมูลค่าเพิ่ม (Gross Amount):</span>
                <span className="font-mono font-medium text-slate-800">
                  {calc.totalGrossAmount.toLocaleString()} ฿
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700">
                <span>ส่วนลดสินค้ารวม (Item Discounts):</span>
                <span className="font-mono font-medium">
                  -{calc.totalItemDiscount.toLocaleString()} ฿
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 font-semibold">
                <span className="text-slate-700">ราคาหลังหักส่วนลด discount:</span>
                <span className="font-mono text-slate-900">
                  {calc.amountAfterItemDiscount.toLocaleString()} ฿
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 text-indigo-700">
                <span>ส่วนลด ontop {quotation.ontopDiscountPercent}%:</span>
                <span className="font-mono font-medium">
                  -{calc.ontopDiscountAmount.toLocaleString()} ฿
                </span>
              </div>

              {quotation.additionalDiscount?.enabled && (
                <div className="flex justify-between py-1 border-b border-slate-100 text-indigo-700">
                  <span>{quotation.additionalDiscount.description || 'ส่วนลดเพิ่มเติม'}:</span>
                  <span className="font-mono font-medium">
                    -{calc.additionalDiscountAmount.toLocaleString()} ฿
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                <span>ค่ามัดจำ:</span>
                <span className="font-mono font-medium">
                  {calc.depositAmount.toLocaleString()} ฿
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t-2 border-slate-800 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900">ยอดค้างชำระ / ยอดสุทธิ:</span>
              <span className="text-2xl font-black font-mono text-indigo-700">
                {calc.balanceRemaining.toLocaleString()} ฿
              </span>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center font-bold text-xs text-amber-900">
              ตัวอักษรภาษาไทย: {calc.balanceRemaining.toLocaleString()} บาท
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Item Modal */}
      <AddItemModal
        isOpen={isAddItemModalOpen}
        onClose={() => {
          setIsAddItemModalOpen(false);
          setEditingItem(null);
        }}
        onAddItem={handleSaveItem}
        promotionGroups={promotionGroups}
        sectionTitle={
          quotation.sections.find((s) => s.id === activeSectionId)?.title || 'ชุดข้อมูล'
        }
        initialItem={editingItem?.item || null}
      />
    </div>
  );
};
