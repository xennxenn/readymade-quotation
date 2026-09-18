import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Check,
  Building2,
  Phone,
  Printer,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import { CompanySettings } from '../types';
import {
  getCompanySettings,
  saveCompanySettings,
  resetCompanySettings,
  DEFAULT_COMPANY_SETTINGS,
} from '../services/db';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: (settings: CompanySettings) => void;
}

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      setSaveSuccess(false);
      setUploadError(null);
    }
  }, [isOpen]);

  const loadSettings = async () => {
    const data = await getCompanySettings();
    setSettings(data);
  };

  const handleFile = (file: File) => {
    setUploadError(null);

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('กรุณาเลือกไฟล์ภาพประเภท PNG, JPG, SVG หรือ WebP เท่านั้น');
      return;
    }

    // Validate file size (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      setUploadError('ขนาดไฟล์ภาพใหญ่เกินไป (จำกัดไม่เกิน 4MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target?.result as string;
      if (base64Url) {
        setSettings((prev) => ({
          ...prev,
          logoUrl: base64Url,
        }));
      }
    };
    reader.onerror = () => {
      setUploadError('เกิดข้อผิดพลาดในการอ่านไฟล์ภาพ กรุณาลองใหม่อีกครั้ง');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleResetToDefault = async () => {
    if (window.confirm('คุณต้องการรีเซ็ตโลโก้และข้อมูลบริษัทกลับเป็นค่าเริ่มต้นของ PASAYA ใช่หรือไม่?')) {
      const def = await resetCompanySettings();
      setSettings(def);
      onSettingsUpdated(def);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  const handleSave = async () => {
    await saveCompanySettings(settings);
    onSettingsUpdated(settings);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 overflow-y-auto backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shadow-2xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                ฐานข้อมูลโลโก้และข้อมูลบริษัท
              </h3>
              <p className="text-xs text-slate-500">
                อัปโหลดโลโก้ ปรับขนาด และตั้งค่าข้อมูลบริษัทสำหรับพิมพ์ลงบนหัวใบเสนอราคา A4
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Logo Upload & Sizing Section */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="font-bold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                อัปโหลดไฟล์โลโก้บริษัท (PNG, JPG, SVG, WebP)
              </label>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-xs text-slate-600 hover:text-indigo-700 font-semibold flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                title="คืนค่าเป็นโลโก้และข้อมูลของ PASAYA"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                คืนค่าโลโก้เริ่มต้น (PASAYA)
              </button>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/80 scale-[1.01]'
                  : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center gap-2">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์ภาพโลโก้มาวางที่นี่
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    รองรับไฟล์ PNG (พื้นหลังโปร่งใส), JPG, SVG และ WebP (ขนาดไม่เกิน 4MB)
                  </p>
                </div>
              </div>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Logo Height / Scale Controller */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-slate-700 text-xs">
                  ความสูงของโลโก้บนเอกสาร:
                </span>
                <span className="font-mono font-bold text-indigo-700 text-xs bg-indigo-50 px-2 py-0.5 rounded">
                  {settings.logoHeight || 96} px
                </span>
              </div>
              <div className="flex items-center gap-3 flex-1 sm:max-w-xs">
                <span className="text-[11px] text-slate-400">เล็ก (48px)</span>
                <input
                  type="range"
                  min="48"
                  max="140"
                  step="4"
                  value={settings.logoHeight || 96}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      logoHeight: parseInt(e.target.value) || 96,
                    })
                  }
                  className="flex-1 accent-indigo-600 cursor-pointer"
                />
                <span className="text-[11px] text-slate-400">ใหญ่ (140px)</span>
              </div>
            </div>
          </div>

          {/* Company Header Info Inputs */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              ข้อมูลหัวกระดาษบริษัท (Company Header Info)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อบริษัท <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  placeholder="เช่น บริษัท เท็กซ์ไทล์ แกลลอรี่ จำกัด"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  สาขา / สำนักงาน
                </label>
                <input
                  type="text"
                  value={settings.branchName}
                  onChange={(e) => setSettings({ ...settings, branchName: e.target.value })}
                  placeholder="เช่น (สำนักงานใหญ่)"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ที่อยู่บริษัท
                </label>
                <textarea
                  rows={2}
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="เช่น 77/191-192 อาคารสินสาธรทาวเวอร์ ชั้น 42 ถนนกรุงธนบุรี แขวงคลองต้นไทร เขตคลองสาน กรุงเทพฯ 10600"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลขประจำตัวผู้เสียภาษี
                </label>
                <input
                  type="text"
                  value={settings.taxId}
                  onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                  placeholder="เช่น 0105546015615"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรศัพท์
                </label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="เช่น 0-2440-0955"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรสาร (แฟกซ์)
                </label>
                <input
                  type="text"
                  value={settings.fax}
                  onChange={(e) => setSettings({ ...settings, fax: e.target.value })}
                  placeholder="เช่น 0-2440-0933-4"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เว็บไซต์ / อีเมล (ตัวเลือก)
                </label>
                <input
                  type="text"
                  value={settings.website || ''}
                  onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                  placeholder="เช่น www.pasaya.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* REAL-TIME PREVIEW OF PRINT HEADER */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-indigo-600" />
                จำลองตัวอย่างหัวเอกสารพิมพ์จริง (A4 Header Mockup Preview)
              </span>
              <span className="text-[11px] text-slate-500">จะแสดงผลตามนี้เมื่อพิมพ์หรือบันทึก PDF</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-xs">
              <div className="flex items-start gap-4">
                {/* Logo Display with Dynamic Height */}
                <div
                  className="shrink-0 flex items-center justify-center p-1 bg-white border border-black/10 rounded-sm"
                  style={{
                    height: `${settings.logoHeight || 96}px`,
                    width: `${settings.logoHeight || 96}px`,
                  }}
                >
                  <img
                    src={settings.logoUrl || '/pasaya-logo.svg'}
                    alt={settings.companyName || 'Logo'}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      // Fallback if image fails to load
                      (e.target as HTMLImageElement).src = '/pasaya-logo.svg';
                    }}
                  />
                </div>

                {/* Company Details */}
                <div className="space-y-0.5 pt-0.5 flex-1">
                  <h3 className="font-bold text-sm tracking-wide text-black leading-tight">
                    {settings.companyName || 'ชื่อบริษัทของคุณ'} {settings.branchName}
                  </h3>
                  <p className="text-[11px] text-black leading-tight">
                    {settings.address || 'ที่อยู่บริษัทจะแสดงตรงนี้'}
                  </p>
                  <p className="text-[11px] text-black leading-tight">
                    {settings.taxId && <span>เลขที่ประจำตัวผู้เสียภาษี {settings.taxId} </span>}
                    {settings.phone && <span>โทร: {settings.phone} </span>}
                    {settings.fax && <span>แฟกซ์: {settings.fax}</span>}
                  </p>
                  {settings.website && (
                    <p className="text-[10px] text-slate-600">{settings.website}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {saveSuccess && (
              <span className="text-emerald-600 font-bold flex items-center gap-1 animate-in fade-in">
                <Check className="w-4 h-4" /> บันทึกการเปลี่ยนแปลงสำเร็จแล้ว
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              บันทึกโลโก้และข้อมูลบริษัท
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
