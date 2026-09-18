import React, { useState, useEffect } from 'react';
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
    await deleteStaffMember(id);
    await loadStaff();
    onStaffUpdated();
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
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-800">
                  ฐานข้อมูลพนักงาน (Staff Database)
                </h3>
                <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full">
                  {staffList.length} คน
                </span>
              </div>
              <p className="text-xs text-slate-500">
                จัดการรายชื่อ รหัสพนักงาน รหัสผ่าน และหน้าที่ (พนักงาน, แอดมิน, ผู้จัดการ)
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

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <span className="text-xs text-slate-600 font-medium">
            รายชื่อพนักงานใช้สำหรับเลือกในช่อง ผู้ดูแล (Admin), พนักงานขาย (Sale), และผู้ตรวจสอบ
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
              });
              setIsEditModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
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
                <th className="py-2.5 px-3 border-r border-slate-200">รหัสผ่านเข้าใช้งาน</th>
                <th className="py-2.5 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
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
                          className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(st.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
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
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* Add / Edit Staff Sub-Modal */}
      {isEditModalOpen && editingStaff && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                {editingStaff.id ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
              </h4>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-3 text-xs">
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
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-mono focus:ring-2 focus:ring-purple-500"
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
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white font-medium focus:ring-2 focus:ring-purple-500"
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
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  value={editingStaff.phone || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  placeholder="เช่น 081-234-5678"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-mono focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  พาสเวิร์ดเข้าใช้งาน (Password)
                </label>
                <input
                  type="text"
                  value={editingStaff.password || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, password: e.target.value })}
                  placeholder="ระบุรหัสผ่าน (ค่าเริ่มต้น 123456)"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-mono focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs flex items-center gap-1.5"
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
