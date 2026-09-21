import React, { useState, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  Edit3,
  Printer,
  Copy,
  Trash2,
  Calendar,
  User,
  Phone,
  Layers,
  ShoppingBag,
  TrendingUp,
  FileText,
  ChevronRight,
  CheckCircle2,
  Building,
  Filter,
  ArrowUpDown,
  RefreshCw,
  PackageCheck,
} from 'lucide-react';
import { Quotation, StaffMember } from '../types';
import { calculateQuotation, formatItemDescription } from '../services/calculations';
import { SearchableSelect } from './SearchableSelect';
import { deleteQuotation, saveQuotation } from '../services/db';

interface QuotationsListViewProps {
  quotations: Quotation[];
  currentQuotationId?: string;
  staffList: StaffMember[];
  currentUser?: StaffMember;
  onOpenQuotation: (quotation: Quotation, targetTab: 'editor' | 'preview' | 'order_form') => void;
  onCreateNewQuotation: () => void;
  onRefreshData: () => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const QuotationsListView: React.FC<QuotationsListViewProps> = ({
  quotations,
  currentQuotationId,
  staffList,
  currentUser,
  onOpenQuotation,
  onCreateNewQuotation,
  onRefreshData,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSalesFilter, setSelectedSalesFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'number'>('date_desc');
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter quotations based on user role:
  // - Staff can only view their own quotations (matching their salesName or adminName)
  // - Manager and Admin can view all quotations
  const roleFilteredQuotations = useMemo(() => {
    if (currentUser?.role === 'staff') {
      const staffName = (currentUser.name || '').trim().toLowerCase();
      const empId = (currentUser.employeeId || '').trim().toLowerCase();
      return quotations.filter((q) => {
        const sales = (q.customer?.salesName || '').trim().toLowerCase();
        const admin = (q.customer?.adminName || '').trim().toLowerCase();
        return (
          (staffName && sales === staffName) ||
          (staffName && admin === staffName) ||
          (empId && sales.includes(empId)) ||
          (empId && admin.includes(empId))
        );
      });
    }
    return quotations;
  }, [quotations, currentUser]);

  // Pre-calculate financial totals for role-filtered quotations
  const quotesWithCalculations = useMemo(() => {
    return roleFilteredQuotations.map((q) => {
      const calc = calculateQuotation(q);
      const totalItemsCount = q.sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
      return {
        quotation: q,
        calculation: calc,
        totalItemsCount,
      };
    });
  }, [roleFilteredQuotations]);

  // Overall KPI statistics
  const stats = useMemo(() => {
    const totalCount = roleFilteredQuotations.length;
    const totalValue = quotesWithCalculations.reduce(
      (sum, item) => sum + item.calculation.finalNetAmount,
      0
    );
    const totalItems = quotesWithCalculations.reduce(
      (sum, item) => sum + item.totalItemsCount,
      0
    );

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthCount = roleFilteredQuotations.filter((q) => q.date && q.date.startsWith(currentYearMonth)).length;

    return {
      totalCount,
      totalValue,
      totalItems,
      thisMonthCount,
    };
  }, [roleFilteredQuotations, quotesWithCalculations]);

  // Sales staff options for Searchable filter
  const salesOptions = useMemo(() => {
    const uniqueSales = Array.from(
      new Set(roleFilteredQuotations.map((q) => q.customer?.salesName).filter(Boolean))
    ).sort();

    return [
      { value: 'ALL', label: 'พนักงานขายทั้งหมด (All Sales)' },
      ...uniqueSales.map((s) => ({ value: s as string, label: s as string })),
    ];
  }, [roleFilteredQuotations]);

  // Sort options
  const sortOptions = [
    { value: 'date_desc', label: 'วันที่ล่าสุด (Newest First)' },
    { value: 'date_asc', label: 'วันที่เก่าสุด (Oldest First)' },
    { value: 'amount_desc', label: 'ยอดเงินมากสุด (Highest Amount)' },
    { value: 'amount_asc', label: 'ยอดเงินน้อยสุด (Lowest Amount)' },
    { value: 'number', label: 'เลขที่ใบเสนอราคา (Quotation No.)' },
  ];

  // Filter & sort
  const filteredQuotations = useMemo(() => {
    return quotesWithCalculations
      .filter(({ quotation: q }) => {
        // Sales filter
        if (selectedSalesFilter !== 'ALL' && q.customer?.salesName !== selectedSalesFilter) {
          return false;
        }

        // Search term filter
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase().trim();

        const matchNo = q.quotationNumber?.toLowerCase().includes(query);
        const matchCustomer = q.customer?.customerName?.toLowerCase().includes(query);
        const matchContact = q.customer?.contactName?.toLowerCase().includes(query);
        const matchPhone = q.customer?.phone?.toLowerCase().includes(query);
        const matchSales = q.customer?.salesName?.toLowerCase().includes(query);
        const matchAdmin = q.customer?.adminName?.toLowerCase().includes(query);
        const matchSections = q.sections?.some((s) => s.title?.toLowerCase().includes(query));

        return (
          matchNo ||
          matchCustomer ||
          matchContact ||
          matchPhone ||
          matchSales ||
          matchAdmin ||
          matchSections
        );
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          return (b.quotation.date || '').localeCompare(a.quotation.date || '') || (b.quotation.updatedAt || 0) - (a.quotation.updatedAt || 0);
        }
        if (sortBy === 'date_asc') {
          return (a.quotation.date || '').localeCompare(b.quotation.date || '');
        }
        if (sortBy === 'amount_desc') {
          return b.calculation.finalNetAmount - a.calculation.finalNetAmount;
        }
        if (sortBy === 'amount_asc') {
          return a.calculation.finalNetAmount - b.calculation.finalNetAmount;
        }
        if (sortBy === 'number') {
          return (b.quotation.quotationNumber || '').localeCompare(a.quotation.quotationNumber || '');
        }
        return 0;
      });
  }, [quotesWithCalculations, selectedSalesFilter, searchQuery, sortBy]);

  const handleDuplicate = async (sourceQuote: Quotation) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const newNumber = `QT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

      const duplicatedQuote: Quotation = {
        ...JSON.parse(JSON.stringify(sourceQuote)),
        id: 'quote-' + Date.now(),
        quotationNumber: newNumber,
        date: today,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveQuotation(duplicatedQuote);
      await onRefreshData();
      onOpenQuotation(duplicatedQuote, 'editor');
      onShowToast(`📋 คัดลอกสร้างใบเสนอราคาใหม่ (${newNumber}) เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Error duplicating quotation', err);
      onShowToast('❌ ไม่สามารถคัดลอกใบเสนอราคาได้');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteQuotation(id);
      await onRefreshData();
      setDeleteConfirmId(null);
      onShowToast('🗑️ ลบใบเสนอราคาออกจากระบบแล้ว');
    } catch (err) {
      console.error('Error deleting quotation', err);
      onShowToast('❌ ไม่สามารถลบใบเสนอราคาได้');
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Role Permission Notice Banner */}
      {currentUser && (
        <div
          className={`px-4 py-2.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 border ${
            currentUser.role === 'staff'
              ? 'bg-blue-50/80 border-blue-200 text-blue-800'
              : currentUser.role === 'manager'
              ? 'bg-purple-50/80 border-purple-200 text-purple-800'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <span className="font-bold">
              {currentUser.role === 'staff'
                ? '👤 สิทธิ์พนักงานขาย:'
                : currentUser.role === 'manager'
                ? '🛡️ สิทธิ์ผู้จัดการ:'
                : '⭐ สิทธิ์ผู้ดูแลระบบ (Admin):'}
            </span>
            <span>
              {currentUser.role === 'staff'
                ? `แสดงเฉพาะรายการของคุณ (${currentUser.name})`
                : currentUser.role === 'manager'
                ? `แสดงข้อมูลพนักงานทุกคน (ตรวจสอบและดูเอกสาร)`
                : `เข้าถึงและจัดการข้อมูลได้ทุกส่วนของระบบ`}
            </span>
          </div>
          <div className="text-[11px] opacity-75">
            รหัสพนักงาน: <span className="font-mono font-bold">{currentUser.employeeId}</span>
          </div>
        </div>
      )}

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Quotations */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">ใบเสนอราคาทั้งหมด</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
              {stats.totalCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">ใบ</span>
            </p>
          </div>
        </div>

        {/* Total Sales Value */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">มูลค่ารวมสุทธิ</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-700 font-mono truncate max-w-[150px] sm:max-w-none">
              ฿{Math.round(stats.totalValue).toLocaleString()}
            </p>
          </div>
        </div>

        {/* This Month Quotations */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">สร้างในเดือนนี้</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
              {stats.thisMonthCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">ใบ</span>
            </p>
          </div>
        </div>

        {/* Total Line Items */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">รายการสินค้าในระบบ</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
              {stats.totalItems.toLocaleString()} <span className="text-xs font-normal text-slate-400">รายการ</span>
            </p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเลขที่ใบเสนอราคา, ชื่อลูกค้า, ผู้ติดต่อ, เบอร์โทร, ห้อง หรือพนักงานขาย..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-200/60 px-1.5 py-0.5 rounded"
              >
                ล้าง
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleManualRefresh}
              className={`p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors ${
                isRefreshing ? 'animate-spin text-indigo-600' : ''
              }`}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onCreateNewQuotation}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs hover:shadow-md transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>สร้างใบเสนอราคาใหม่</span>
            </button>
          </div>
        </div>

        {/* Filters Row using SearchableSelect */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 sm:w-72">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-600 shrink-0">พนักงานขาย:</span>
            <div className="flex-1">
              <SearchableSelect
                options={salesOptions}
                value={selectedSalesFilter}
                onChange={setSelectedSalesFilter}
                placeholder="เลือกพนักงานขาย"
                searchPlaceholder="ค้นหาพนักงานขาย..."
                className="text-xs py-1.5"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:w-72">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-600 shrink-0">เรียงลำดับ:</span>
            <div className="flex-1">
              <SearchableSelect
                options={sortOptions}
                value={sortBy}
                onChange={(val) => setSortBy(val as any)}
                placeholder="เรียงลำดับตาม..."
                searchPlaceholder="ค้นหาการเรียง..."
                className="text-xs py-1.5"
              />
            </div>
          </div>

          <div className="sm:ml-auto text-xs text-slate-500 font-medium">
            แสดงผล {filteredQuotations.length} จากทั้งหมด {quotations.length} รายการ
          </div>
        </div>
      </div>

      {/* QUOTATION LIST */}
      {filteredQuotations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-base font-bold text-slate-700">ไม่พบรายการใบเสนอราคา</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || selectedSalesFilter !== 'ALL'
              ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา ลองปรับคำค้นหาหรือตัวกรอง'
              : 'ยังไม่มีการสร้างใบเสนอราคาในระบบ เริ่มต้นสร้างฉบับแรกได้ทันที'}
          </p>
          <button
            type="button"
            onClick={onCreateNewQuotation}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            สร้างใบเสนอราคาใหม่
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuotations.map(({ quotation: q, calculation: calc, totalItemsCount }) => {
            const isCurrent = q.id === currentQuotationId;
            const isExpanded = expandedQuoteId === q.id;

            return (
              <div
                key={q.id}
                className={`bg-white rounded-xl border transition-all overflow-hidden ${
                  isCurrent
                    ? 'border-indigo-400 shadow-md ring-1 ring-indigo-300'
                    : 'border-slate-200 hover:border-indigo-200 hover:shadow-xs'
                }`}
              >
                {/* Main Card Header / Summary Row */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Number, Customer & Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-base text-slate-900 font-mono tracking-tight">
                        {q.quotationNumber || 'ไม่มีเลขที่'}
                      </span>

                      {isCurrent && (
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                          กำลังเปิดใช้งาน
                        </span>
                      )}

                      <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateDisplay(q.date)}
                      </span>

                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                        {q.customer?.validityType || '7 วัน'}
                      </span>
                    </div>

                    {/* Customer & Contacts */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="text-slate-400">ลูกค้า:</span>
                        <span className="font-semibold text-slate-800 truncate">
                          {q.customer?.customerName || '-'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-400">ผู้ติดต่อ:</span>
                        <span className="text-slate-700 truncate">
                          {q.customer?.contactName || '-'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-400">เบอร์โทร:</span>
                        <span className="font-mono text-slate-700">
                          {q.customer?.phone || '-'}
                        </span>
                      </div>
                    </div>

                    {/* Section and Staff Sub-row */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap pt-0.5">
                      <span className="flex items-center gap-1 font-medium">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {q.sections?.length || 0} โซน/ห้อง
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-medium">
                        <ShoppingBag className="w-3 h-3 text-slate-400" />
                        {totalItemsCount} รายการสินค้า
                      </span>
                      <span>•</span>
                      <span className="text-slate-600">
                        ผู้ขาย: <strong className="text-indigo-700">{q.customer?.salesName || '-'}</strong>
                      </span>
                      {q.customer?.adminName && (
                        <>
                          <span>•</span>
                          <span className="text-slate-600">ผู้ดูแล: {q.customer.adminName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Middle: Financials */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 lg:min-w-[210px] text-right flex flex-row lg:flex-col justify-between items-center lg:items-end gap-1">
                    <div>
                      <span className="text-[11px] text-slate-500 block">ยอดรวมสุทธิ (Net Total)</span>
                      <span className="text-lg sm:text-xl font-bold font-mono text-emerald-700">
                        ฿{calc.finalNetAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 space-x-2">
                      {calc.totalItemDiscount + calc.ontopDiscountAmount + calc.additionalDiscountAmount > 0 && (
                        <span className="text-amber-700 font-semibold">
                          ลดรวม ฿{Math.round(calc.totalItemDiscount + calc.ontopDiscountAmount + calc.additionalDiscountAmount).toLocaleString()}
                        </span>
                      )}
                      <span>• {q.customer?.paymentCondition || 'ชำระ 100%'}</span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-center">
                    <button
                      type="button"
                      onClick={() => onOpenQuotation(q, 'editor')}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="เปิดในหน้าแก้ไข"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>แก้ไข</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenQuotation(q, 'preview')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="ดูตัวอย่างแบบพิมพ์จริง A4 (ใบเสนอราคา)"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>พิมพ์ A4</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenQuotation(q, 'order_form')}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200/60"
                      title="ดูแบบฟอร์มสำหรับสั่งออเดอร์ (พร้อมบาร์โค้ดแนบท้าย)"
                    >
                      <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>สั่งออเดอร์</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicate(q)}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                      title="คัดลอกสร้างใหม่ (Duplicate)"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(q.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="ลบใบเสนอราคา"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedQuoteId(isExpanded ? null : q.id)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title={isExpanded ? 'ซ่อนรายละเอียดสินค้า' : 'ดูรายการสินค้าข้างใน'}
                    >
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {/* EXPANDABLE SECTION / ITEMS PREVIEW */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3 text-xs animate-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between text-slate-600 font-semibold">
                      <span>รายละเอียดห้องและรายการสินค้า ({totalItemsCount} รายการ)</span>
                      <span className="text-[11px] text-slate-400">
                        {q.customer?.address || '-'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {q.sections.map((section, sIdx) => (
                        <div
                          key={section.id || sIdx}
                          className="bg-white rounded-lg border border-slate-200 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-800 text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-[10px]">
                                {sIdx + 1}
                              </span>
                              {section.title || `ห้อง/โซนที่ ${sIdx + 1}`}
                            </span>
                            <span className="text-slate-500 font-normal">
                              {section.items.length} รายการ
                            </span>
                          </div>

                          {section.items.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                              {section.items.map((item, iIdx) => (
                                <div
                                  key={item.id || iIdx}
                                  className="py-1.5 flex items-center justify-between text-[11px] gap-2"
                                >
                                  <div className="flex items-center gap-2 flex-1 truncate">
                                    <span className="text-slate-400 w-4 shrink-0">{iIdx + 1}.</span>
                                    <span className="text-slate-800 font-medium truncate">
                                      {formatItemDescription(item)}
                                    </span>
                                    {item.isCustom && (
                                      <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded shrink-0">
                                        สั่งตัดพิเศษ
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-slate-600 shrink-0 font-mono">
                                    {item.quantity} {item.unit || 'ชิ้น'} × ฿{item.price.toLocaleString()}
                                    {item.discountPercent > 0 && (
                                      <span className="text-emerald-600 font-semibold ml-1">
                                        (-{item.discountPercent}%)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">ยังไม่มีรายการสินค้าในโซนนี้</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 font-bold text-sm">
              <div className="p-2 bg-red-100 rounded-xl">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <span>ยืนยันการลบใบเสนอราคา</span>
            </div>

            <p className="text-xs text-slate-600">
              คุณต้องการลบใบเสนอราคานี้ออกจากระบบอย่างถาวรใช่หรือไม่? การกระทำนี้ไม่สามารถยกเลิกได้
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
