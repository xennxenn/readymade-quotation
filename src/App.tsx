import React, { useState, useEffect } from 'react';
import {
  Printer,
  Edit3,
  Database,
  Tag,
  Save,
  PlusCircle,
  FolderOpen,
  Check,
  Users,
  AlertCircle,
  X,
  Building2,
  ListFilter,
  FileText,
  LogOut,
  Shield,
  Cloud,
  User as UserIcon,
} from 'lucide-react';
import { Quotation, StaffMember, PromotionGroup, CompanySettings } from './types';
import {
  getStaffList,
  getPromotionGroups,
  getProductCount,
  saveQuotation,
  getQuotations,
  getCompanySettings,
  DEFAULT_COMPANY_SETTINGS,
  ensureAdminAccount,
  syncStaffListToIndexedDB,
  syncQuotationsToIndexedDB,
  syncPromotionsToIndexedDB,
  syncProductsToIndexedDB,
} from './services/db';
import {
  isCloudSyncEnabled,
  subscribeToCloudQuotations,
  subscribeToCloudStaff,
  subscribeToCloudCompanySettings,
  subscribeToCloudPromotionGroups,
  initializeCloudDatabaseSeed,
  fetchCloudProducts,
} from './services/firebase';
import { QuotationEditor } from './components/QuotationEditor';
import { QuotationPreview } from './components/QuotationPreview';
import { ProductDatabaseModal } from './components/ProductDatabaseModal';
import { PromotionGroupModal } from './components/PromotionGroupModal';
import { SavedQuotationsModal } from './components/SavedQuotationsModal';
import { StaffDatabaseModal } from './components/StaffDatabaseModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { QuotationsListView } from './components/QuotationsListView';
import { LoginView } from './components/LoginView';
import { CloudSyncModal } from './components/CloudSyncModal';

const AUTH_STORAGE_KEY = 'pasaya_auth_session';
const ACTIVE_TAB_KEY = 'pasaya_active_tab';

function createDefaultEmptyQuotation(adminName = '', salesName = ''): Quotation {
  const today = new Date().toISOString().split('T')[0];
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return {
    id: 'quote-' + Date.now(),
    quotationNumber: `QT-${new Date().getFullYear()}-${randNum}`,
    date: today,
    customer: {
      contactName: '',
      customerName: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      address: '',
      taxId: '',
      phone: '',
      validityType: '7 วัน',
      paymentCondition: 'ชำระเงิน 100%',
      adminName,
      salesName,
    },
    sections: [
      {
        id: 'sec-' + Date.now(),
        title: 'ห้องนอนใหญ่ (Master Bedroom)',
        items: [],
      },
    ],
    ontopDiscountPercent: 0,
    additionalDiscount: {
      enabled: false,
      type: 'percent',
      value: 0,
      applyFrom: 'after_discount',
      description: 'ส่วนลดพิเศษเพิ่มเติม',
    },
    depositRatePercent: 0,
    notes: [
      'ผู้สั่งซื้อจะต้องชำระเงินครบทั้งหมด ก่อนดำเนินการสั่งผลิต',
      'รอสินค้า 30 วันทำการ',
    ],
    inspectorName: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export default function App() {
  // Authentication State - locally persisted so page refresh keeps user logged in
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<'list' | 'editor' | 'preview'>(() => {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY);
    return (saved as 'list' | 'editor' | 'preview') || 'list';
  });

  const [quotation, setQuotation] = useState<Quotation>(() => createDefaultEmptyQuotation());
  const [savedQuotations, setSavedQuotations] = useState<Quotation[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [promotionGroups, setPromotionGroups] = useState<PromotionGroup[]>([]);
  const [productCount, setProductCount] = useState<number>(0);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [isCloudActive, setIsCloudActive] = useState<boolean>(isCloudSyncEnabled());

  // Modals
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false);
  const [isPromotionOpen, setIsPromotionOpen] = useState(false);
  const [isSavedQuotesOpen, setIsSavedQuotesOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isCompanySettingsOpen, setIsCompanySettingsOpen] = useState(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [isNewQuoteConfirmOpen, setIsNewQuoteConfirmOpen] = useState(false);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Save active tab
  const handleTabChange = (tab: 'list' | 'editor' | 'preview') => {
    setActiveTab(tab);
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
  };

  useEffect(() => {
    ensureAdminAccount();
    loadAppInitialData();
  }, []);

  // Realtime Cloud Synchronization listeners (Firebase)
  useEffect(() => {
    if (!isCloudSyncEnabled()) return;

    setIsCloudActive(true);

    // Realtime Quotations
    const unsubQuotes = subscribeToCloudQuotations((cloudQuotes) => {
      setSavedQuotations(cloudQuotes);
      syncQuotationsToIndexedDB(cloudQuotes);
    });

    // Realtime Staff
    const unsubStaff = subscribeToCloudStaff((cloudStaff) => {
      if (cloudStaff && cloudStaff.length > 0) {
        setStaffList(cloudStaff);
        syncStaffListToIndexedDB(cloudStaff);
      }
    });

    // Realtime Company Settings
    const unsubSettings = subscribeToCloudCompanySettings((cloudSettings) => {
      if (cloudSettings) {
        setCompanySettings(cloudSettings);
        try {
          localStorage.setItem('bedding_quotation_company_settings', JSON.stringify(cloudSettings));
        } catch (e) {
          console.error(e);
        }
      }
    });

    // Realtime Promotion Groups
    const unsubPromos = subscribeToCloudPromotionGroups((cloudPromos) => {
      if (cloudPromos && cloudPromos.length > 0) {
        setPromotionGroups(cloudPromos);
        syncPromotionsToIndexedDB(cloudPromos);
      }
    });

    return () => {
      if (unsubQuotes) unsubQuotes();
      if (unsubStaff) unsubStaff();
      if (unsubSettings) unsubSettings();
      if (unsubPromos) unsubPromos();
    };
  }, [isCloudActive]);

  const loadAppInitialData = async () => {
    try {
      if (isCloudSyncEnabled()) {
        setIsCloudActive(true);
        // Ensure shared cloud database has admin, settings, and purge mock records
        await initializeCloudDatabaseSeed();

        // ALWAYS sync products directly from central Cloud Firestore to local cache
        // This guarantees EVERY user on ANY device sees the EXACT SAME central products
        const cloudProds = await fetchCloudProducts();
        if (cloudProds && cloudProds.length > 0) {
          await syncProductsToIndexedDB(cloudProds);
        }
      }

      await ensureAdminAccount();

      const staff = await getStaffList();
      setStaffList(staff);
      const promos = await getPromotionGroups();
      setPromotionGroups(promos);
      const count = await getProductCount();
      setProductCount(count);

      const compSettings = await getCompanySettings();
      setCompanySettings(compSettings);

      // Check if there are saved quotations
      const saved = await getQuotations();
      setSavedQuotations(saved);
      if (saved.length > 0) {
        setQuotation(saved[0]);
      } else {
        setQuotation(createDefaultEmptyQuotation());
      }
    } catch (err) {
      console.error('Error initializing data', err);
    }
  };

  const refreshQuotations = async () => {
    try {
      const saved = await getQuotations();
      setSavedQuotations(saved);
    } catch (err) {
      console.error('Error refreshing quotations', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleLoginSuccess = (user: StaffMember) => {
    setCurrentUser(user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    showToast(`ยินดีต้อนรับคุณ ${user.name}`);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setCurrentUser(null);
    showToast('ออกจากระบบเรียบร้อยแล้ว');
  };

  const handleSaveCurrentQuotation = async () => {
    try {
      await saveQuotation(quotation);
      await refreshQuotations();
      showToast('✅ บันทึกใบเสนอราคาสำเร็จ');
    } catch (err) {
      console.error('Error saving quotation', err);
      showToast('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const executeCreateNewQuotation = () => {
    const today = new Date().toISOString().split('T')[0];
    const defaultAdmin = staffList.find((s) => s.role === 'admin' || s.role === 'manager')?.name || '';
    
    // If current logged-in user is staff, set them as the salesperson automatically
    const defaultSale = currentUser?.role === 'staff' 
      ? currentUser.name 
      : (staffList.find((s) => s.role === 'staff')?.name || currentUser?.name || '');

    const newQuotation: Quotation = {
      id: 'quote-' + Date.now(),
      quotationNumber: `QT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      date: today,
      customer: {
        contactName: '',
        customerName: '',
        addressLine1: '',
        addressLine2: '',
        addressLine3: '',
        address: '',
        taxId: '',
        phone: '',
        validityType: '7 วัน',
        paymentCondition: 'ชำระเงิน 100%',
        adminName: defaultAdmin,
        salesName: defaultSale,
      },
      sections: [
        {
          id: 'sec-' + Date.now(),
          title: 'ห้องนอนใหญ่ (Master Bedroom)',
          items: [],
        },
      ],
      ontopDiscountPercent: 0,
      additionalDiscount: {
        enabled: false,
        type: 'percent',
        value: 0,
        applyFrom: 'after_discount',
        description: 'ส่วนลดพิเศษเพิ่มเติม',
      },
      depositRatePercent: 0,
      notes: [
        'ผู้สั่งซื้อจะต้องชำระเงินครบทั้งหมด ก่อนดำเนินการสั่งผลิต',
        'รอสินค้า 30 วันทำการ',
      ],
      inspectorName: staffList.find((s) => s.role === 'manager')?.name || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setQuotation(newQuotation);
    handleTabChange('editor');
    setIsNewQuoteConfirmOpen(false);
    showToast('✨ สร้างใบเสนอราคาใหม่เรียบร้อยแล้ว');
  };

  // If user is not authenticated, show Login View (Strictly without hints)
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Role definitions based on user requirements:
  // - Admin: can do everything (full settings, full view)
  // - Manager: can view all quotations, but CANNOT configure settings
  // - Staff: can ONLY view own quotations, CANNOT configure settings
  const isAdmin = currentUser.role === 'admin';
  const isManager = currentUser.role === 'manager';
  const isStaff = currentUser.role === 'staff';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-70 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold border border-slate-700 animate-in slide-in-from-top duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP APPLICATION HEADER (Hidden when printing) */}
      <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs w-full">
        {/* Full-width container: w-full px-4 sm:px-6 lg:px-8 */}
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Brand / Logo Title & Company Info */}
            <div
              className={`flex items-center gap-3 ${isAdmin ? 'cursor-pointer group' : ''}`}
              onClick={() => {
                if (isAdmin) setIsCompanySettingsOpen(true);
              }}
              title={isAdmin ? 'คลิกเพื่อจัดการข้อมูลบริษัทและอัปโหลดโลโก้' : ''}
            >
              <img
                src={companySettings.logoUrl || '/pasaya-logo.svg'}
                alt={companySettings.companyName || 'Company Logo'}
                className="w-10 h-10 object-contain rounded-md border border-slate-200 p-0.5 bg-white shadow-2xs group-hover:border-indigo-400 transition-colors"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/pasaya-logo.svg';
                }}
              />
              <div>
                <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                  PASAYA - QUOTATION
                  <span className="hidden md:inline-block text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-mono font-semibold">
                    PRO
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500 hidden sm:block truncate max-w-xs group-hover:text-indigo-600 transition-colors">
                  {companySettings.companyName || 'บริษัท เท็กซ์ไทล์ แกลลอรี่ จำกัด'}
                </p>
              </div>
            </div>

            {/* Quick Action Navigation */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* SETTINGS BUTTONS: ONLY VISIBLE FOR ADMIN */}
              {isAdmin && (
                <>
                  {/* ตั้งค่าบริษัท & โลโก้ */}
                  <button
                    type="button"
                    onClick={() => setIsCompanySettingsOpen(true)}
                    className="px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="ฐานข้อมูลและอัปโหลดโลโก้บริษัท"
                  >
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden xl:inline">ตั้งค่าบริษัท & โลโก้</span>
                  </button>

                  {/* ฐานข้อมูลสินค้า */}
                  <button
                    type="button"
                    onClick={() => setIsDatabaseOpen(true)}
                    className="px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="จัดการฐานข้อมูลและนำเข้าไฟล์ CSV/TXT"
                  >
                    <Database className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden xl:inline">ฐานข้อมูลสินค้า</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-mono font-bold">
                      {productCount.toLocaleString()}
                    </span>
                  </button>

                  {/* ฐานข้อมูลพนักงาน */}
                  <button
                    type="button"
                    onClick={() => setIsStaffModalOpen(true)}
                    className="px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="จัดการรายชื่อ รหัสพนักงาน รหัสผ่าน และสิทธิ์การใช้งาน"
                  >
                    <Users className="w-3.5 h-3.5 text-purple-600" />
                    <span className="hidden xl:inline">จัดการพนักงาน</span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded-full font-mono font-bold">
                      {staffList.length}
                    </span>
                  </button>

                  {/* กลุ่มโปรโมชั่น */}
                  <button
                    type="button"
                    onClick={() => setIsPromotionOpen(true)}
                    className="px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="กำหนดกลุ่มโปรโมชั่นตาม Collection"
                  >
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden 2xl:inline">โปรโมชั่น</span>
                  </button>

                  {/* Cloud Realtime Sync Configuration */}
                  <button
                    type="button"
                    onClick={() => setIsCloudSyncModalOpen(true)}
                    className={`px-2.5 sm:px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isCloudActive
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                    }`}
                    title="ตั้งค่าเชื่อมต่อ Firebase Realtime Database (สำหรับ Deploy บน Github & Vercel)"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {isCloudActive ? 'Cloud Online' : 'Local Mode'}
                    </span>
                  </button>
                </>
              )}

              {/* สร้างใบใหม่ button */}
              <button
                type="button"
                onClick={() => setIsNewQuoteConfirmOpen(true)}
                className="px-2.5 sm:px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="สร้างใบเสนอราคาฉบับใหม่"
              >
                <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">สร้างใบใหม่</span>
              </button>

              {/* บันทึก */}
              <button
                type="button"
                onClick={handleSaveCurrentQuotation}
                className="px-3 sm:px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>บันทึก</span>
              </button>

              {/* User Account / Role Badge & Logout */}
              <div className="h-6 w-px bg-slate-200 mx-1" />
              <div className="flex items-center gap-2 pl-1">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] font-mono flex items-center justify-end gap-1 text-slate-500">
                    <span
                      className={`px-1 rounded text-[9px] font-sans font-semibold ${
                        isAdmin
                          ? 'bg-rose-100 text-rose-700'
                          : isManager
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isAdmin ? 'Admin' : isManager ? 'Manager' : 'Staff'}
                    </span>
                    <span>{currentUser.employeeId}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="ออกจากระบบ (Logout)"
                  aria-label="ออกจากระบบ"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher Sub-header with All 3 Tabs */}
        <div className="border-t border-slate-200 bg-slate-50/50 w-full">
          {/* Full-width container: w-full px-4 sm:px-6 lg:px-8 */}
          <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex gap-1 py-1.5 overflow-x-auto">
              {/* TAB 1: หน้ารวมรายการใบเสนอราคา */}
              <button
                type="button"
                onClick={() => {
                  refreshQuotations();
                  handleTabChange('list');
                }}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'list'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                หน้ารวมใบเสนอราคา
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {savedQuotations.length}
                </span>
              </button>

              {/* TAB 2: แก้ไขใบเสนอราคา */}
              <button
                type="button"
                onClick={() => handleTabChange('editor')}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                แก้ไขใบเสนอราคา (Editor)
              </button>

              {/* TAB 3: ดูฟอร์มพิมพ์จริง */}
              <button
                type="button"
                onClick={() => handleTabChange('preview')}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Printer className="w-4 h-4" />
                ดูแบบฟอร์มพิมพ์จริง A4
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-mono">
              <span>กำลังเปิด: {quotation.quotationNumber || 'QT-DRAFT'}</span>
              <span>•</span>
              <span className="truncate max-w-[200px]">{quotation.customer.customerName || 'ลูกค้ายังไม่ระบุ'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* FULL-WIDTH MAIN CONTAINER: w-full px-4 sm:px-6 lg:px-8 */}
      <main className="flex-1 w-full p-4 sm:p-6 lg:p-8">
        {activeTab === 'list' && (
          <QuotationsListView
            quotations={savedQuotations}
            currentQuotationId={quotation.id}
            staffList={staffList}
            currentUser={currentUser}
            onOpenQuotation={(selected: Quotation, targetTab: 'editor' | 'preview') => {
              setQuotation(selected);
              handleTabChange(targetTab);
              showToast(`เปิดใบเสนอราคา ${selected.quotationNumber} แล้ว`);
            }}
            onCreateNewQuotation={() => {
              executeCreateNewQuotation();
              handleTabChange('editor');
            }}
            onRefreshData={refreshQuotations}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'editor' && (
          <QuotationEditor
            quotation={quotation}
            onChange={setQuotation}
            staffList={staffList}
            promotionGroups={promotionGroups}
          />
        )}

        {activeTab === 'preview' && (
          <QuotationPreview
            quotation={quotation}
            companySettings={companySettings}
            onBackToEdit={() => handleTabChange('editor')}
          />
        )}
      </main>

      {/* CONFIRM NEW QUOTATION MODAL */}
      {isNewQuoteConfirmOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-indigo-700 font-bold text-sm">
                <PlusCircle className="w-5 h-5" />
                <span>ยืนยันสร้างใบเสนอราคาใหม่</span>
              </div>
              <button
                onClick={() => setIsNewQuoteConfirmOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2 bg-indigo-50/60 p-3.5 rounded-lg border border-indigo-100">
              <p className="font-semibold text-indigo-950 flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                คุณต้องการเริ่มสร้างใบเสนอราคาฉบับใหม่ใช่หรือไม่?
              </p>
              <p className="text-slate-600">
                หากมีข้อมูลของใบปัจจุบันที่ต้องการเก็บไว้ กรุณากด <strong>บันทึก</strong>{' '}
                ก่อนสร้างใหม่ ระบบจะทำการตั้งเลขที่ใบเสนอราคาใหม่และล้างฟอร์มให้พร้อมกรอกทันที
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewQuoteConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeCreateNewQuotation}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                ยืนยันสร้างใบใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS - ONLY ACCESSIBLE TO ADMIN */}
      {isAdmin && (
        <>
          <CompanySettingsModal
            isOpen={isCompanySettingsOpen}
            onClose={() => setIsCompanySettingsOpen(false)}
            onSettingsUpdated={(updatedSettings: CompanySettings) => {
              setCompanySettings(updatedSettings);
              showToast('✅ บันทึกข้อมูลบริษัทและโลโก้เรียบร้อยแล้ว');
            }}
          />

          <ProductDatabaseModal
            isOpen={isDatabaseOpen}
            onClose={() => setIsDatabaseOpen(false)}
            onDataChanged={async () => {
              const count = await getProductCount();
              setProductCount(count);
            }}
          />

          <StaffDatabaseModal
            isOpen={isStaffModalOpen}
            onClose={() => setIsStaffModalOpen(false)}
            onStaffUpdated={async () => {
              const staff = await getStaffList();
              setStaffList(staff);
            }}
          />

          <PromotionGroupModal
            isOpen={isPromotionOpen}
            onClose={() => setIsPromotionOpen(false)}
            onPromotionsUpdated={async () => {
              const promos = await getPromotionGroups();
              setPromotionGroups(promos);
            }}
          />

          <CloudSyncModal
            isOpen={isCloudSyncModalOpen}
            onClose={() => setIsCloudSyncModalOpen(false)}
            onConfigSaved={() => {
              setIsCloudActive(isCloudSyncEnabled());
              showToast('✅ อัปเดตการตั้งค่า Cloud Sync เรียบร้อย');
            }}
          />
        </>
      )}

      <SavedQuotationsModal
        isOpen={isSavedQuotesOpen}
        onClose={() => setIsSavedQuotesOpen(false)}
        onSelectQuotation={(selected) => {
          setQuotation(selected);
          showToast(`เปิดใบเสนอราคา ${selected.quotationNumber} แล้ว`);
        }}
        currentQuotationId={quotation.id}
      />
    </div>
  );
}

