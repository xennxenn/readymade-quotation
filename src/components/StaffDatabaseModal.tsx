import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Users,
  Plus,
  Trash2,
  Edit2,
  Key,
  Shield,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  Briefcase,
  UserCheck,
  FileSignature,
  Upload,
  Sparkles,
} from 'lucide-react';
import { StaffMember, StaffRole } from '../types';
import { getStaffList, addStaffMember, updateStaffMember, deleteStaffMember } from '../services/db';

interface StaffDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStaffUpdated: () => void;
}

export const StaffDatabaseModal: React.FC<StaffDatabaseModalProps> = ({
  isOpen,
  onClose,
  onStaffUpdated,
}) => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Partial<StaffMember> | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [isProcessingSignature, setIsProcessingSignature] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStaff();
    }
  }, [isOpen]);

  const loadStaff = async () => {
    const list = await getStaffList();
    setStaffList(list);
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleDeleteStaff = async (id: string) => {
    if (window.confirm('คุณต้องการลบข้อมูลพนักงานคนนี้ใช่หรือไม่?')) {
      await deleteStaffMember(id);
      await loadStaff();
      onStaffUpdated();
    }
  };

  // Automatic signature background removal & transparent ink extraction
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingSignature(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 600;
          const maxH = 300;
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setEditingStaff((prev) => (prev ? { ...prev, signatureUrl: event.target?.result as string } : null));
            setIsProcessingSignature(false);
            return;
          }

          ctx.drawImage(img, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;

          let minX = w, minY = h, maxX = 0, maxY = 0;
          let foundDarkPixels = false;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue;

            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

            // Threshold: brightness > 200 = white/light paper background (make transparent)
            if (brightness > 205) {
              data[i + 3] = 0;
            } else if (brightness > 130) {
              // Smooth edge anti-aliasing
              const factor = (205 - brightness) / (205 - 130);
              data[i + 3] = Math.round(255 * factor);
              data[i] = Math.min(r, 40);
              data[i + 1] = Math.min(g, 40);
              data[i + 2] = Math.min(b, 50);
            } else {
              // Solid dark ink
              data[i + 3] = 255;
              data[i] = Math.min(r, 30);
              data[i + 1] = Math.min(g, 30);
              data[i + 2] = Math.min(b, 40);
            }

            if (data[i + 3] > 30) {
              const px = (i / 4) % w;
              const py = Math.floor((i / 4) / w);
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
              foundDarkPixels = true;
            }
          }

          ctx.putImageData(imgData, 0, 0);

          // Crop tight to bounding box with padding
          if (foundDarkPixels && maxX >= minX && maxY >= minY) {
            const cropPad = 6;
            const cropX = Math.max(0, minX - cropPad);
            const cropY = Math.max(0, minY - cropPad);
            const cropW = Math.min(w - cropX, maxX - minX + 1 + cropPad * 2);
            const cropH = Math.min(h - cropY, maxY - minY + 1 + cropPad * 2);

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            const cropCtx = cropCanvas.getContext('2d');
            if (cropCtx) {
              cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              const transparentPng = cropCanvas.toDataURL('image/png');
              setEditingStaff((prev) => (prev ? { ...prev, signatureUrl: transparentPng } : null));
              setIsProcessingSignature(false);
              return;
            }
          }

          const transparentPng = canvas.toDataURL('image/png');
          setEditingStaff((prev) => (prev ? { ...prev, signatureUrl: transparentPng } : null));
        } catch (err) {
          console.error('Error processing signature:', err);
          setEditingStaff((prev) => (prev ? { ...prev, signatureUrl: event.target?.result as string } : null));
        } finally {
          setIsProcessingSignature(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editingStaff.name?.trim() || !editingStaff.employeeId?.trim()) {
      return;
    }

    const memberToSave: StaffMember = {
      id: editingStaff.id || 'st-' + Date.now(),
      name: editingStaff.name.trim(),
      employeeId: editingStaff.employeeId.trim(),
      password: editingStaff.password?.trim() || '123456',
      role: (editingStaff.role as StaffRole) || 'staff',
      phone: editingStaff.phone?.trim() || '',
      signatureUrl: editingStaff.signatureUrl || undefined,
      createdAt: editingStaff.createdAt || Date.now(),
    };

    if (editingStaff.id) {
      await updateStaffMember(memberToSave);
    } else {
      await addStaffMember(memberToSave);
    }

    setIsEditModalOpen(false);
    setEditingStaff(null);
    await loadStaff();
    onStaffUpdated();
  };

  const getRoleBadge = (role: StaffRole) => {
    switch (role) {
      case 'manager':
        return (
          <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
            <Shield className="w-3 h-3 text-purple-600" /> ผู้จัดการ (Manager)
          </span>
        );
      case 'admin':
        return (
          <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-blue-600" /> แอดมิน (Admin)
          </span>
        );
      default:
        return (
          <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-emerald-600" /> พนักงาน (Staff)
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 overflow-y-auto backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-purple-50 via-white to-indigo-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-800">
                  ฐานข้อมูลพนักงาน (Staff Database)
                </h3>
                <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full font-mono">
                  {staffList.length} คน
                </span>
              </div>
              <p className="text-xs text-slate-500">
                จัดการรายชื่อ รหัสพนักงาน สิทธิ์ และอัปโหลดลายเซ็นต์ดิจิทัลแบบตัดพื้นหลังอัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center text-xs">
          <span className="text-slate-600 font-medium">
            รายชื่อพนักงานใช้สำหรับเลือกในช่อง ผู้ดูแล (Admin), พนักงานขาย (Sale), และผู้ตรวจสอบ พร้อมแสดงลายเซ็นต์ท้ายใบเสนอราคา
          </span>
          <button
            type="button"
            onClick={() => {
              setEditingStaff({
                name: '',
                employeeId: `EMP-${1000 + staffList.length + 1}`,
                password: '',
                role: 'staff',
                phone: '',
                signatureUrl: undefined,
              });
              setIsEditModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 ml-3"
          >
            <Plus className="w-3.5 h-3.5" />
            เพิ่มพนักงานใหม่
          </button>
        </div>

        {/* Staff Table */}
        <div className="p-5 overflow-y-auto flex-1">
          <table className="w-full text-left text-xs border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-3 border-r border-slate-200">รหัสพนักงาน</th>
                <th className="py-2.5 px-3 border-r border-slate-200">ชื่อ-นามสกุล</th>
                <th className="py-2.5 px-3 border-r border-slate-200">หน้าที่ / ตำแหน่ง</th>
                <th className="py-2.5 px-3 border-r border-slate-200">เบอร์โทรศัพท์</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center">ลายเซ็นต์</th>
                <th className="py-2.5 px-3 border-r border-slate-200">รหัสผ่าน</th>
                <th className="py-2.5 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    ยังไม่มีข้อมูลพนักงาน
                  </td>
                </tr>
              ) : (
                staffList.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-slate-700">
                      {st.employeeId}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-900">
                      {st.name}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200">
                      {getRoleBadge(st.role)}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono text-slate-600">
                      {st.phone || '-'}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center">
                      {st.signatureUrl ? (
                        <div className="inline-flex items-center justify-center p-1 bg-slate-100 border border-slate-300 rounded shadow-2xs">
                          <img
                            src={st.signatureUrl}
                            alt={`ลายเซ็นต์ ${st.name}`}
                            className="h-7 max-w-[80px] object-contain"
                          />
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">ไม่มีลายเซ็นต์</span>
                      )}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>
                          {visiblePasswords[st.id]
                            ? st.password || '123456'
                            : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(st.id)}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                          title="ดู/ซ่อนรหัสผ่าน"
                        >
                          {visiblePasswords[st.id] ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStaff({ ...st });
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(st.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-200/60 rounded-xl"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* Add / Edit Staff Sub-Modal */}
      {isEditModalOpen && editingStaff && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                {editingStaff.id ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
              </h4>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    รหัสพนักงาน <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStaff.employeeId || ''}
                    onChange={(e) =>
                      setEditingStaff({ ...editingStaff, employeeId: e.target.value })
                    }
                    placeholder="เช่น EMP-1001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    หน้าที่ / สิทธิ์ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingStaff.role || 'staff'}
                    onChange={(e) =>
                      setEditingStaff({ ...editingStaff, role: e.target.value as StaffRole })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white font-medium focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="staff">พนักงาน (Staff / Sale)</option>
                    <option value="admin">แอดมิน (Admin)</option>
                    <option value="manager">ผู้จัดการ (Manager)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ชื่อ-นามสกุล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingStaff.name || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  placeholder="เช่น คุณสมชาย ใจดี"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                  <input
                    type="tel"
                    value={editingStaff.phone || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    placeholder="เช่น 081-234-5678"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    พาสเวิร์ดเข้าใช้งาน
                  </label>
                  <input
                    type="text"
                    value={editingStaff.password || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, password: e.target.value })}
                    placeholder="รหัสผ่าน (ค่าเริ่มต้น 123456)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* SIGNATURE UPLOAD WITH BACKGROUND REMOVAL */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-purple-900 flex items-center gap-1.5">
                    <FileSignature className="w-4 h-4 text-purple-600" />
                    ลายเซ็นต์พนักงาน (ดึงเฉพาะลายเซ็นต์และตัดพื้นหลังออกอัตโนมัติ)
                  </label>
                  <span className="text-[10px] text-purple-600 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Auto Background Cutout
                  </span>
                </div>

                <p className="text-[11px] text-slate-500">
                  อัปโหลดรูปภาพลายเซ็นต์ (เช่น เซ็นต์ลงบนกระดาษแล้วถ่ายรูป หรือไฟล์รูป) ระบบจะตัดพื้นหลังกระดาษสีขาวออกให้เหลือเพียงเส้นหมึกคมชัดและแสดงที่ท้ายใบเสนอราคาอัตโนมัติ
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />

                {editingStaff.signatureUrl ? (
                  <div className="flex items-center gap-3 p-2 bg-white border border-purple-200 rounded-lg">
                    {/* Checkered background box for transparent preview */}
                    <div
                      className="p-2 border border-slate-300 rounded-md bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:8px_8px] flex items-center justify-center min-w-[120px] max-w-[160px] h-14"
                    >
                      <img
                        src={editingStaff.signatureUrl}
                        alt="ลายเซ็นต์"
                        className="max-h-12 object-contain"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ตัดพื้นหลังพร้อมใช้งานแล้ว
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-purple-700 font-semibold hover:underline"
                        >
                          เปลี่ยนรูปภาพ
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setEditingStaff({ ...editingStaff, signatureUrl: undefined })}
                          className="text-[11px] text-red-600 hover:underline"
                        >
                          ลบลายเซ็นต์
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessingSignature}
                      className="w-full py-3 px-4 border-2 border-dashed border-purple-300 hover:border-purple-500 bg-white hover:bg-purple-50/50 rounded-xl text-center flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Upload className={`w-5 h-5 text-purple-600 ${isProcessingSignature ? 'animate-bounce' : ''}`} />
                      <span className="font-semibold text-purple-800">
                        {isProcessingSignature ? 'กำลังดึงลายเซ็นต์และตัดพื้นหลัง...' : 'คลิกเพื่อเลือกไฟล์รูปภาพลายเซ็นต์'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        รองรับไฟล์ PNG, JPG, JPEG (ประมวลผลตัดพื้นหลังบนเครื่องทันที)
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  บันทึกข้อมูลพนักงาน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

