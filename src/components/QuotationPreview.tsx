import React from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import { Quotation, CompanySettings } from '../types';
import { calculateQuotation, formatItemDescription } from '../services/calculations';
import { thaiBahtText } from '../services/thaiBaht';
import { DEFAULT_COMPANY_SETTINGS } from '../services/db';

interface QuotationPreviewProps {
  quotation: Quotation;
  companySettings?: CompanySettings;
  onBackToEdit?: () => void;
}

export const QuotationPreview: React.FC<QuotationPreviewProps> = ({
  quotation,
  companySettings = DEFAULT_COMPANY_SETTINGS,
  onBackToEdit,
}) => {
  const calc = calculateQuotation(quotation);
  const thaiBaht = thaiBahtText(calc.balanceRemaining);

  const handlePrint = () => {
    window.print();
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    // if YYYY-MM-DD convert to DD-MM-YYYY
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const logoH = companySettings?.logoHeight || 96;

  return (
    <div className="space-y-4">
      {/* Non-printable Action Bar */}
      <div className="no-print flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          {onBackToEdit && (
            <button
              type="button"
              onClick={onBackToEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              กลับไปหน้าแก้ไข
            </button>
          )}
          <span className="text-xs sm:text-sm font-semibold text-slate-700">
            พรีวิวใบเสนอราคาแบบพิมพ์จริง (A4 Print Preview)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all"
          >
            <Printer className="w-4 h-4" />
            พิมพ์ / บันทึกเป็น PDF
          </button>
        </div>
      </div>

      {/* PRINTABLE QUOTATION SHEET */}
      <div className="quotation-print-sheet bg-white mx-auto shadow-lg border border-slate-200 p-8 text-black print:p-0 print:border-none print:shadow-none w-full max-w-[850px] min-h-[1050px] text-[11px] font-sans">
        {/* ITEMS TABLE WITH REPEATING HEADER FOR MULTI-PAGE PRINT */}
        <table className="w-full border-collapse mb-3 text-[10px]">
          <thead className="table-header-group">
            {/* Row 1: Header, Title & Customer Details (Repeats on every printed page) */}
            <tr>
              <th colSpan={8} className="p-0 font-normal text-left border-0 bg-transparent">
                {/* HEADER */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  {/* Logo with configured dynamic height */}
                  <div className="flex items-start gap-4">
                    <div
                      className="shrink-0 flex items-center justify-center"
                      style={{
                        height: `${logoH}px`,
                        width: `${logoH}px`,
                      }}
                    >
                      <img
                        src={companySettings?.logoUrl || '/pasaya-logo.svg'}
                        alt={companySettings?.companyName || 'PASAYA'}
                        className="max-h-full max-w-full object-contain border border-black/10"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/pasaya-logo.svg';
                        }}
                      />
                    </div>

                    {/* Company Info */}
                    <div className="space-y-0.5 pt-1">
                      <h1 className="font-bold text-sm tracking-wide text-black">
                        {companySettings?.companyName || 'บริษัท เท็กซ์ไทล์ แกลลอรี่ จำกัด'}{' '}
                        {companySettings?.branchName || ''}
                      </h1>
                      <p className="text-[10px] text-black leading-tight">
                        {companySettings?.address || '77/191-192 อาคารสินสาธรทาวเวอร์ ชั้น 42 ถนนกรุงธนบุรี แขวงคลองต้นไทร เขตคลองสาน กรุงเทพฯ 10600 (สำนักงานใหญ่)'}
                      </p>
                      <p className="text-[10px] text-black leading-tight">
                        {companySettings?.taxId && <span>เลขที่ประจำตัวผู้เสียภาษี {companySettings.taxId} </span>}
                        {companySettings?.phone && <span>โทร: {companySettings.phone} </span>}
                        {companySettings?.fax && <span>แฟกซ์: {companySettings.fax}</span>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* TITLE & DATE */}
                <div className="relative text-center my-3">
                  <h2 className="text-base font-bold tracking-wider uppercase">
                    ใบเสนอราคา/QUOTATION
                  </h2>

                  <div className="absolute right-0 top-0 border border-black px-3 py-1 flex items-center gap-2 text-[10px] bg-white">
                    <span className="font-semibold">วันที่/DATE:</span>
                    <span className="font-mono font-medium">{formatDateDisplay(quotation.date)}</span>
                  </div>
                </div>

                {/* CUSTOMER & PAYMENT TERMS BOX (70% Left / 30% Right) */}
                <div className="border border-black flex mb-3 text-[10.5px]">
                  {/* Left Column: Customer Details (70%) */}
                  <div className="w-[70%] basis-[70%] p-2 border-r border-black space-y-1">
                    <div className="flex">
                      <span className="w-28 shrink-0 font-medium">ชื่อผู้ติดต่อ/Contact :</span>
                      <span className="font-bold flex-1">{quotation.customer.contactName || '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="w-28 shrink-0 font-medium">ลูกค้า/Customer :</span>
                      <span className="flex-1">{quotation.customer.customerName || '-'}</span>
                    </div>
                    {/* 3-line Address */}
                    <div className="flex items-start">
                      <span className="w-28 shrink-0 font-medium">ที่อยู่/Address :</span>
                      <div className="flex-1 text-[10px] leading-tight space-y-0.5">
                        <div>
                          {quotation.customer.addressLine1 ||
                            (quotation.customer.address ? quotation.customer.address.split('\n')[0] : '-') ||
                            '-'}
                        </div>
                        <div>
                          {quotation.customer.addressLine2 ||
                            (quotation.customer.address ? quotation.customer.address.split('\n')[1] : '') ||
                            ''}
                        </div>
                        <div>
                          {quotation.customer.addressLine3 ||
                            (quotation.customer.address ? quotation.customer.address.split('\n')[2] : '') ||
                            ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-baseline pt-1 whitespace-nowrap overflow-hidden text-[10px]">
                      <span className="w-28 shrink-0 font-medium">Phone :</span>
                      <span className="w-32 shrink-0 font-mono">{quotation.customer.phone || '-'}</span>
                      <span className="font-medium shrink-0 mr-1.5">เลขที่ประจำตัวผู้เสียภาษี/Tax id :</span>
                      <span className="font-mono">{quotation.customer.taxId || '-'}</span>
                    </div>
                  </div>

                  {/* Right Column: Validity & Payment Terms (30%) - Term of payment removed */}
                  <div className="w-[30%] basis-[30%] p-2 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-baseline">
                      <span className="font-medium shrink-0 mr-1">กำหนดยืนราคา/Validity:</span>
                      <span className="font-semibold">
                        {quotation.customer.validityType === 'custom'
                          ? `${quotation.customer.validityCustomDays || 7} วัน/Days`
                          : `${quotation.customer.validityType}/Days`}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">เงื่อนไขการชำระเงิน:</span>
                      <span className="font-semibold text-[10px] leading-tight">
                        {quotation.customer.paymentCondition === 'custom'
                          ? quotation.customer.paymentCustomText || 'ชำระเงินตามตกลง'
                          : quotation.customer.paymentCondition}
                      </span>
                    </div>
                    <div className="flex items-baseline pt-1">
                      <span className="font-medium shrink-0 mr-1">ผู้ดูแล/Admin :</span>
                      <span className="truncate">{quotation.customer.adminName || '-'}</span>
                    </div>
                    <div className="flex items-baseline">
                      <span className="font-medium shrink-0 mr-1">พนักงานขาย/Sale :</span>
                      <span className="font-semibold truncate">{quotation.customer.salesName || '-'}</span>
                    </div>
                  </div>
                </div>
              </th>
            </tr>

            {/* Row 2: Items Table Column Header */}
            <tr className="border-t border-b border-black text-center font-bold bg-white">
              <th className="py-1 px-1.5 border-l border-r border-black w-8">#</th>
              <th className="py-1 px-2 border-r border-black text-center">
                รายการสินค้า
                <div className="text-[9px] font-normal">Descriptions</div>
              </th>
              <th className="py-1 px-1 border-r border-black w-12 text-center">
                จำนวน
                <div className="text-[9px] font-normal">Qty</div>
              </th>
              <th className="py-1 px-1 border-r border-black w-10 text-center">
                หน่วย
                <div className="text-[9px] font-normal">Unit</div>
              </th>
              <th className="py-1 px-1.5 border-r border-black w-16 text-right">
                ราคา
                <div className="text-[9px] font-normal">@Price</div>
              </th>
              <th className="py-1 px-1.5 border-r border-black w-18 text-right">
                ยอดรวม
                <div className="text-[9px] font-normal">Amount</div>
              </th>
              <th className="py-1 px-1 border-r border-black w-12 text-center">
                ส่วนลด
                <div className="text-[9px] font-normal">% Disc</div>
              </th>
              <th className="py-1 px-1.5 border-r border-black w-20 text-right">
                ยอดรวมสุทธิ
                <div className="text-[9px] font-normal">Net Amount</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {quotation.sections.map((section) => {
              const secCalc = calc.sectionCalculations.get(section.id);

              return (
                <React.Fragment key={section.id}>
                  {/* Section Title Header (Centered bold bar across row) */}
                  <tr className="border-b border-black bg-white">
                    <td
                      colSpan={8}
                      className="py-1 px-2 text-center font-bold text-[10.5px] border-l border-r border-b border-black bg-white"
                    >
                      {section.title}
                    </td>
                  </tr>

                  {/* Section Items */}
                  {section.items.map((item, idx) => {
                    const itemCalc = calc.itemCalculations.get(item.id);
                    const formattedName = formatItemDescription(item);

                    return (
                      <tr key={item.id} className="border-b border-black/30 bg-white">
                        <td className="py-1 px-1 border-l border-r border-black text-center font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-1 px-2 border-r border-black">
                          <span className="font-medium">{formattedName}</span>
                        </td>
                        <td className="py-1 px-1 border-r border-black text-center font-mono">
                          {item.quantity.toFixed(2)}
                        </td>
                        <td className="py-1 px-1 border-r border-black text-center font-medium">
                          {item.unit}
                        </td>
                        <td className="py-1 px-1.5 border-r border-black text-right font-mono">
                          {item.price.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-1 px-1.5 border-r border-black text-right font-mono">
                          {itemCalc?.grossAmount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-1 px-1 border-r border-black text-center font-mono">
                          {item.discountPercent > 0 ? `${item.discountPercent}%` : '-'}
                        </td>
                        <td className="py-1 px-1.5 border-r border-black text-right font-mono font-medium">
                          {itemCalc?.netAmount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Section Subtotal Row */}
                  <tr className="border-b border-black font-semibold bg-white">
                    <td colSpan={5} className="py-1 px-2 text-right border-l border-r border-black bg-white">
                      รวม / Total
                    </td>
                    <td className="py-1 px-1.5 border-r border-black text-right font-mono">
                      {secCalc?.totalGrossAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-1 px-1 border-r border-black"></td>
                    <td className="py-1 px-1.5 border-r border-black text-right font-mono">
                      {secCalc?.totalNetAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* NOTES & SUMMARY SECTION */}
        <div className="border border-black mb-3 print-break-inside-avoid">
          {/* Notes Box */}
          <div className="p-2 border-b border-black text-[10px] space-y-0.5">
            <div className="font-bold text-black">หมายเหตุ :</div>
            {quotation.notes.map((note, nIdx) => (
              <div key={nIdx} className="text-black pl-3">
                {nIdx + 1}. {note}
              </div>
            ))}
          </div>

          {/* Bottom Financial Summary Grid */}
          <div className="grid grid-cols-12 text-[10.5px]">
            {/* Thai Baht text box spanning left 7 cols */}
            <div className="col-span-7 p-3 flex items-end font-bold border-r border-black">
              <span className="text-xs">{thaiBaht}</span>
            </div>

            {/* Calculations spanning right 5 cols */}
            <div className="col-span-5 divide-y divide-black">
              <div className="flex justify-between py-1 px-2">
                <span className="font-medium">ราคารวมภาษีมูลค่าเพิ่ม</span>
                <span className="font-mono font-medium">
                  {calc.totalGrossAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex justify-between py-1 px-2">
                <span className="font-medium">ส่วนลด discount</span>
                <span className="font-mono">
                  {calc.totalItemDiscount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex justify-between py-1 px-2">
                <span className="font-medium">ราคาหลังหักส่วนลด discount</span>
                <span className="font-mono font-medium">
                  {calc.amountAfterItemDiscount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex justify-between py-1 px-2">
                <span className="font-medium">
                  ส่วนลด ontop {quotation.ontopDiscountPercent}%
                </span>
                <span className="font-mono">
                  {calc.ontopDiscountAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {quotation.additionalDiscount?.enabled && (
                <div className="flex justify-between py-1 px-2 text-black bg-white">
                  <span className="font-medium">
                    {quotation.additionalDiscount.description || 'ส่วนลดเพิ่มเติม'}
                  </span>
                  <span className="font-mono">
                    {calc.additionalDiscountAmount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1 px-2">
                <span className="font-medium">ค่ามัดจำ</span>
                <span className="font-mono">
                  {calc.depositAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex justify-between py-1 px-2">
                <span className="font-medium">ส่วนต่างจากการปัดเศษ</span>
                <span className="font-mono">
                  {calc.roundingDifference.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex justify-between py-1.5 px-2 font-bold bg-white">
                <span className="font-bold">ยอดค้างชำระ</span>
                <span className="font-mono font-bold text-xs">
                  {calc.balanceRemaining.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SIGNATURES SECTION */}
        <div className="grid grid-cols-3 gap-8 text-center pt-8 text-[10.5px] print-break-inside-avoid">
          {/* Sales Signature */}
          <div className="space-y-1">
            <div className="border-b border-black w-4/5 mx-auto h-8"></div>
            <div className="font-bold">ผู้เสนอราคา / Sale</div>
            <div className="text-[9.5px] text-black font-mono">
              {formatDateDisplay(quotation.date)}
            </div>
          </div>

          {/* Inspector Signature */}
          <div className="space-y-1">
            <div className="border-b border-black w-4/5 mx-auto h-8"></div>
            <div className="font-bold">ผู้ตรวจสอบ / Inspector</div>
            <div className="text-[9.5px] text-black font-mono">
              {formatDateDisplay(quotation.date)}
            </div>
          </div>

          {/* Customer Signature */}
          <div className="space-y-1">
            <div className="border-b border-black w-4/5 mx-auto h-8"></div>
            <div className="font-bold">ผู้สั่งซื้อ / Customer</div>
            <div className="text-[9.5px] text-black">
              วันที่ ......./......./.......
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
