import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Shield,
  Zap,
} from 'lucide-react';
import {
  getSavedFirebaseConfig,
  saveFirebaseConfig,
  isCloudSyncEnabled,
  FirebaseConfig,
} from '../services/firebase';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [appId, setAppId] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSavedFirebaseConfig();
      if (cfg) {
        setApiKey(cfg.apiKey || '');
        setProjectId(cfg.projectId || '');
        setDatabaseId(cfg.databaseId || '');
        setAuthDomain(cfg.authDomain || '');
        setStorageBucket(cfg.storageBucket || '');
        setMessagingSenderId(cfg.messagingSenderId || '');
        setAppId(cfg.appId || '');
      }
      setSyncStatus(isCloudSyncEnabled());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim() || !appId.trim()) {
      saveFirebaseConfig(null);
      setSyncStatus(false);
      onConfigSaved();
      onClose();
      return;
    }

    const newConfig: FirebaseConfig = {
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      databaseId: databaseId.trim() || undefined,
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      storageBucket: storageBucket.trim() || `${projectId.trim()}.firebasestorage.app`,
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
    };

    saveFirebaseConfig(newConfig);
    setSyncStatus(true);
    onConfigSaved();
    onClose();
  };

  const copyVercelEnvExample = () => {
    const text = `VITE_FIREBASE_API_KEY=${apiKey || 'YOUR_API_KEY'}
VITE_FIREBASE_PROJECT_ID=${projectId || 'YOUR_PROJECT_ID'}
VITE_FIREBASE_DATABASE_ID=${databaseId || ''}
VITE_FIREBASE_AUTH_DOMAIN=${authDomain || `${projectId || 'YOUR_PROJECT_ID'}.firebaseapp.com`}
VITE_FIREBASE_STORAGE_BUCKET=${storageBucket || `${projectId || 'YOUR_PROJECT_ID'}.firebasestorage.app`}
VITE_FIREBASE_MESSAGING_SENDER_ID=${messagingSenderId || ''}
VITE_FIREBASE_APP_ID=${appId || 'YOUR_APP_ID'}`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                ตั้งค่า Realtime Cloud Database (Vercel & Github)
              </h2>
              <p className="text-xs text-slate-500">
                เชื่อมต่อฐานข้อมูลออนไลน์แบบ Realtime เพื่อใช้งานพร้อมกันทุกอุปกรณ์
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Current Status Card */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 ${
              syncStatus
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {syncStatus ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <div className="font-bold text-sm">
                {syncStatus
                  ? '🟢 เชื่อมต่อ Realtime Cloud สำเร็จ'
                  : '🟠 กำลังทำงานในโหมด Local IndexedDB'}
              </div>
              <p className="leading-relaxed opacity-90">
                {syncStatus
                  ? 'ข้อมูลใบเสนอราคาและรายชื่อพนักงานจะซิงค์ Realtime ทันทีเมื่อมีการเพิ่ม/แก้ไข ทุกคนและทุกเครื่องจะเห็นข้อมูลตรงกัน'
                  : 'สามารถใช้งานในเครื่องนี้ได้ตามปกติ หากต้องการ Deploy ขึ้น Vercel และให้ทุกคนใช้งานข้อมูลเดียวกันแบบ Realtime กรุณากรอกการตั้งค่า Firebase ด้านล่าง'}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Firebase API Key *
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project ID *
                </label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="my-quotation-app"
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Firestore Database ID
                </label>
                <input
                  type="text"
                  value={databaseId}
                  onChange={(e) => setDatabaseId(e.target.value)}
                  placeholder="ai-studio-pasayaquotation-..."
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-400">
                  ระบุ ID ฐานข้อมูล Firestore เดียวกันเพื่อให้ทุกอุปกรณ์เชื่อมต่อ Database เดียวกัน
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  App ID *
                </label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="1:123456789:web:abcdef"
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Auth Domain (Optional)
                </label>
                <input
                  type="text"
                  value={authDomain}
                  onChange={(e) => setAuthDomain(e.target.value)}
                  placeholder="my-app.firebaseapp.com"
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Embedded Config Note */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-600" /> ฝังการเชื่อมต่อในโค้ดแล้ว (Built-in Config)
                </span>
                <button
                  type="button"
                  onClick={copyVercelEnvExample}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 bg-white border border-emerald-300 rounded-md hover:bg-emerald-50 text-emerald-800 font-medium transition-colors"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" /> คัดลอกแล้ว
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> สำเนาค่า Config
                    </>
                  )}
                </button>
              </div>
              <p className="text-emerald-700 leading-relaxed">
                การตั้งค่า Firebase ทั้งหมดถูกฝังไว้ในตัวแอปพลิเคชันโดยตรงแล้ว เมื่อนำโค้ดไป Deploy บน Vercel หรือเซิร์ฟเวอร์ใดก็ตาม <strong>ระบบจะเชื่อมต่อ Cloud Firestore ให้โดยอัตโนมัติทันที โดยไม่จำเป็นต้องกรอกค่าใน Environment Variables ของ Vercel อีก</strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                บันทึกการตั้งค่า
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
