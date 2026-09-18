import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Database,
  Upload,
  Plus,
  Search,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  RefreshCw,
  Barcode,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Product } from '../types';
import {
  searchProducts,
  getProductCount,
  addProduct,
  updateProduct,
  deleteProduct,
  clearAllProducts,
} from '../services/db';
import {
  parseAndImportFile,
  generateSampleCsv,
  ImportProgress,
  CsvEncodingOption,
} from '../services/csvParser';

interface ProductDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const ProductDatabaseModal: React.FC<ProductDatabaseModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [encodingOption, setEncodingOption] = useState<CsvEncodingOption>('auto');
  const cancelImportRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual CRUD State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Clear Database State (Requires typing "confirm")
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [confirmInputText, setConfirmInputText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen, searchTerm, currentPage]);

  const loadProducts = async () => {
    const total = await getProductCount();
    setTotalCount(total);

    const { items } = await searchProducts(
      searchTerm,
      pageSize,
      (currentPage - 1) * pageSize
    );
    setProducts(items);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Delete product
  const handleDeleteProduct = async (id: string) => {
    await deleteProduct(id);
    await loadProducts();
    onDataChanged();
  };

  // Save manual product (Add or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editingProduct.barcode?.trim()) {
      return;
    }
    if (!editingProduct.collection?.trim()) {
      return;
    }
    if (!editingProduct.description?.trim()) {
      return;
    }

    if (editingProduct.id) {
      await updateProduct(editingProduct as Product);
    } else {
      await addProduct({
        barcode: editingProduct.barcode.trim(),
        collection: editingProduct.collection.trim(),
        description: editingProduct.description.trim(),
        design: editingProduct.design?.trim(),
        color: editingProduct.color?.trim() || '-',
        size: editingProduct.size?.trim() || '-',
        price: Number(editingProduct.price) || 0,
        category: editingProduct.category?.trim(),
        itemName: editingProduct.itemName?.trim(),
        styleName: editingProduct.styleName?.trim(),
        unit: editingProduct.unit?.trim() || 'ชิ้น',
        weight: editingProduct.weight?.trim(),
      });
    }

    setIsEditModalOpen(false);
    setEditingProduct(null);
    await loadProducts();
    onDataChanged();
  };

  // Start File Import
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    cancelImportRef.current = { cancelled: false };
    setImportProgress({
      processedRows: 0,
      validProducts: 0,
      status: 'parsing',
    });

    try {
      await parseAndImportFile(
        file,
        (progress) => setImportProgress({ ...progress }),
        cancelImportRef.current,
        encodingOption
      );
      await loadProducts();
      onDataChanged();
    } catch (err) {
      console.error('Import failed', err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelImport = () => {
    cancelImportRef.current.cancelled = true;
  };

  const handleDownloadSampleCsv = () => {
    const csvContent = generateSampleCsv();
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_bedding_products_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Perform clear all after typing "confirm"
  const handleExecuteClearAll = async () => {
    if (confirmInputText.trim().toLowerCase() !== 'confirm') return;

    setIsClearing(true);
    try {
      await clearAllProducts();
      await loadProducts();
      onDataChanged();
      setIsClearModalOpen(false);
      setConfirmInputText('');
    } catch (err) {
      console.error('Clear all failed', err);
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 overflow-y-auto backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-800">
                  ฐานข้อมูลสินค้าเครื่องนอน (Product Database)
                </h3>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full font-mono">
                  {totalCount.toLocaleString()} รายการ
                </span>
              </div>
              <p className="text-xs text-slate-500">
                รองรับการนำเข้าไฟล์ CSV/TXT มากกว่า 1 ล้านแถว (รองรับ TIS-620 / Windows-874 ภาษาไทย)
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
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="ค้นหาด้วยบาร์โค้ด, Collection, Description, สี..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setEditingProduct({
                  barcode: '',
                  collection: '',
                  description: '',
                  design: '',
                  color: '',
                  size: '',
                  price: 0,
                  unit: 'ชิ้น',
                });
                setIsEditModalOpen(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              เพิ่มสินค้าเอง
            </button>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              นำเข้าไฟล์ CSV/TXT (&gt;1,000,000 Row)
            </button>

            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors"
              title="ดาวน์โหลดไฟล์ตัวอย่างคอลัมน์ A, C, M, N, O, P, R, U, V, W, AO, AP"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              ไฟล์แม่แบบตัวอย่าง
            </button>

            {/* Clear All Data Button */}
            <button
              type="button"
              onClick={() => {
                setConfirmInputText('');
                setIsClearModalOpen(true);
              }}
              className="px-2.5 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs flex items-center gap-1 transition-colors border border-transparent hover:border-red-200"
              title="ล้างข้อมูลสินค้าทั้งหมดในฐานข้อมูล (ต้องพิมพ์ confirm ยืนยัน)"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              <span className="text-red-600 font-medium">ล้างข้อมูลทั้งหมด</span>
            </button>
          </div>
        </div>

        {/* Product Table */}
        <div className="overflow-x-auto flex-1 p-4">
          <table className="w-full text-left text-xs border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-3 border-r border-slate-200">บาร์โค้ด (Col A)</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Collection (Col R)</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Description (Col C)</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Size (Col O)</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Color (Col N)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">ราคา (@Price)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center">หน่วย</th>
                <th className="py-2.5 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    ไม่พบรายการสินค้าที่ค้นหา
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">
                      {p.barcode}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-medium text-indigo-700">
                      {p.collection}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-800">
                      {p.description}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-600">
                      {p.size}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-600">
                      {p.color}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-slate-800 font-mono">
                      {p.price.toLocaleString()} ฿
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-500">
                      {p.unit}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct({ ...p });
                            setIsEditModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id)}
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

        {/* Pagination & Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            แสดง {products.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} ถึง{' '}
            {Math.min(currentPage * pageSize, totalCount)} จากทั้งหมด {totalCount.toLocaleString()}{' '}
            รายการ
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs disabled:opacity-40"
            >
              ย้อนกลับ
            </button>
            <span className="font-semibold text-slate-800">
              หน้า {currentPage} / {Math.max(1, Math.ceil(totalCount / pageSize))}
            </span>
            <button
              type="button"
              disabled={currentPage >= Math.ceil(totalCount / pageSize)}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      {/* CLEAR ALL CONFIRMATION SUB-MODAL (Requires typing "confirm") */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-red-200 w-full max-w-md p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-red-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>ยืนยันการล้างข้อมูลสินค้าทั้งหมด</span>
            </div>

            <div className="text-xs text-slate-600 space-y-2 bg-red-50 p-3.5 rounded-lg border border-red-200">
              <p className="font-semibold text-red-900">
                คุณกำลังจะลบรายการสินค้าทั้งหมด ({totalCount.toLocaleString()} รายการ) ออกจากฐานข้อมูล
              </p>
              <p className="text-slate-600">
                การดำเนินการนี้ไม่สามารถยกเลิกหรือกู้คืนได้ เพื่อความปลอดภัย กรุณาพิมพ์คำว่า{' '}
                <span className="font-bold text-red-700 bg-white px-1.5 py-0.5 rounded border border-red-300 font-mono">
                  confirm
                </span>{' '}
                ในช่องด้านล่างเพื่อยืนยัน
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                พิมพ์คำว่า confirm เพื่อปลดล็อคปุ่มยืนยัน:
              </label>
              <input
                type="text"
                value={confirmInputText}
                onChange={(e) => setConfirmInputText(e.target.value)}
                placeholder="confirm"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsClearModalOpen(false);
                  setConfirmInputText('');
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                disabled={confirmInputText.trim().toLowerCase() !== 'confirm' || isClearing}
                onClick={handleExecuteClearAll}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังล้างข้อมูล...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    ยืนยันล้างข้อมูลทั้งหมด
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT CSV / TXT SUB-MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                นำเข้าข้อมูลสินค้าจากไฟล์ CSV / TXT
              </h4>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Encoding Selection (Fixes Thai mojibake / ภาษาต่างดาว) */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-900 flex items-center gap-1">
                  🌐 การเข้ารหัสภาษา (ป้องกันภาษาต่างดาว):
                </span>
              </div>
              <select
                value={encodingOption}
                onChange={(e) => setEncodingOption(e.target.value as CsvEncodingOption)}
                className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md text-xs font-medium text-slate-800"
              >
                <option value="auto">ตรวจจับอัตโนมัติ (Auto Detect - แนะนำ)</option>
                <option value="windows-874">
                  TIS-620 / Windows-874 (สำหรับไฟล์จาก Excel / ERP ภาษาไทย)
                </option>
                <option value="utf-8">UTF-8 (ไฟล์สากล / พร้อม BOM)</option>
              </select>
              <p className="text-[11px] text-amber-700">
                หากไฟล์ที่เซฟจาก Excel ภาษาไทยแสดงผลเป็นภาษาต่างดาว ให้เลือกเป็น{' '}
                <span className="font-semibold">TIS-620 / Windows-874</span>
              </p>
            </div>

            <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <p className="font-semibold text-slate-700">
                รองรับไฟล์ขนาดใหญ่มากกว่า 1,000,000 Rows ด้วยระบบ Streaming Batch Processing:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-500 font-mono text-[11px]">
                <li>คอลัมน์ A (index 0): บาร์โค้ด (Barcode)</li>
                <li>คอลัมน์ C (index 2): Description</li>
                <li>คอลัมน์ M (index 12): Design</li>
                <li>คอลัมน์ N (index 13): Color</li>
                <li>คอลัมน์ O (index 14): Size</li>
                <li>คอลัมน์ P (index 15): Price</li>
                <li>คอลัมน์ R (index 17): Collection</li>
                <li>คอลัมน์ U (index 20): Catagory</li>
                <li>คอลัมน์ V (index 21): Item Name</li>
                <li>คอลัมน์ W (index 22): Style Name</li>
                <li>คอลัมน์ AO (index 40): Unit</li>
                <li>คอลัมน์ AP (index 41): Weight</li>
              </ul>
            </div>

            {/* File Upload Trigger */}
            {!importProgress || importProgress.status === 'idle' ? (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors bg-white">
                <FileSpreadsheet className="w-10 h-10 text-blue-600 mx-auto mb-2" />
                <p className="text-xs text-slate-700 font-medium mb-1">
                  เลือกไฟล์ CSV หรือ TXT จากเครื่องของคุณ
                </p>
                <p className="text-[11px] text-slate-400 mb-3">
                  ระบบจะทำการอ่านและบันทึกลงฐานข้อมูล IndexedDB อัตโนมัติ
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.txt"
                  onChange={handleFileSelected}
                  className="hidden"
                  id="csv-file-input"
                />
                <label
                  htmlFor="csv-file-input"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  เลือกไฟล์เพื่อเริ่ม Import
                </label>
              </div>
            ) : (
              /* Progress View */
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                    {importProgress.status === 'completed' ? (
                      '✅ นำเข้าข้อมูลเสร็จสิ้น'
                    ) : importProgress.status === 'cancelled' ? (
                      '⚠️ ยกเลิกการนำเข้าแล้ว'
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        กำลังนำเข้าข้อมูล...
                      </>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {importProgress.detectedEncoding && (
                      <span className="text-[10px] bg-blue-200/80 text-blue-900 px-1.5 py-0.5 rounded font-mono">
                        {importProgress.detectedEncoding.toUpperCase()}
                      </span>
                    )}
                    {importProgress.speedRowsPerSec ? (
                      <span className="text-blue-700 font-mono text-[11px]">
                        ~{importProgress.speedRowsPerSec.toLocaleString()} rows/s
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 font-medium">
                    <span>แถวที่อ่านแล้ว: {importProgress.processedRows.toLocaleString()}</span>
                    <span>บันทึกแล้ว: {importProgress.validProducts.toLocaleString()} รายการ</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 transition-all duration-200 rounded-full animate-pulse"
                      style={{
                        width: importProgress.status === 'completed' ? '100%' : '75%',
                      }}
                    />
                  </div>
                </div>

                {importProgress.status === 'parsing' || importProgress.status === 'saving' ? (
                  <button
                    type="button"
                    onClick={handleCancelImport}
                    className="w-full py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg font-medium transition-colors"
                  >
                    หยุดการนำเข้าชั่วคราว / ยกเลิก
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsImportModalOpen(false);
                      setImportProgress(null);
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-bold transition-colors"
                  >
                    ปิดหน้าต่าง
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANUAL ADD / EDIT PRODUCT SUB-MODAL */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Barcode className="w-4 h-4 text-blue-600" />
                {editingProduct.id ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่ลงในฐานข้อมูล'}
              </h4>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    บาร์โค้ด (Barcode) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.barcode || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, barcode: e.target.value })
                    }
                    placeholder="เช่น 885123400101"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Collection <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.collection || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, collection: e.target.value })
                    }
                    placeholder="เช่น KUBUA, NOVELTY"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.description || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, description: e.target.value })
                  }
                  placeholder="เช่น ผ้าปูที่นอน, ปลอกหมอนหนุน"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Color (สี)</label>
                  <input
                    type="text"
                    value={editingProduct.color || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, color: e.target.value })
                    }
                    placeholder="เช่น WHIMSICAL BLUE"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Size (ขนาด)</label>
                  <input
                    type="text"
                    value={editingProduct.size || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, size: e.target.value })
                    }
                    placeholder="เช่น 193 x 203 x 21.5 cm."
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ราคา (@Price ฿) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={editingProduct.price || 0}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">หน่วย (Unit)</label>
                  <input
                    type="text"
                    value={editingProduct.unit || 'ชิ้น'}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, unit: e.target.value })
                    }
                    placeholder="ผืน, ชิ้น, ชุด"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  บันทึกสินค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
