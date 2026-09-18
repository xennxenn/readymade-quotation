import { Quotation, QuoteItem, QuoteSection } from '../types';

export interface ItemCalculation {
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  ontopDiscountAmount: number;
  finalItemAmount: number;
  formattedDescription: string;
}

export interface SectionCalculation {
  totalGrossAmount: number;
  totalDiscountAmount: number;
  totalNetAmount: number;
}

export interface QuotationCalculation {
  totalGrossAmount: number;             // ราคารวมภาษีมูลค่าเพิ่ม
  totalItemDiscount: number;            // ส่วนลด discount
  amountAfterItemDiscount: number;      // ราคาหลังหักส่วนลด discount
  ontopDiscountAmount: number;          // ส่วนลด ontop
  additionalDiscountAmount: number;     // ส่วนลดอื่นๆ เพิ่มเติม
  finalNetAmount: number;               // ยอดสุทธิ
  depositAmount: number;                // ค่ามัดจำ
  balanceRemaining: number;             // ยอดค้างชำระ
  itemCalculations: Map<string, ItemCalculation>;
  sectionCalculations: Map<string, SectionCalculation>;
}

export function formatItemDescription(item: QuoteItem): string {
  if (item.isCustom) {
    // 8. รายการสินค้าสั่งตัดพิเศษจะแสดงข้อมูลในใบเสนอราคาคือ
    // รูปแบบ เว้นวรรค ตามด้วย "-" เว้นวรรค ตามด้วย Collection เว้นวรรค ตามด้วย Color เว้นวรรค ตามด้วย Size ที่ระบุพร้อมหน่วย
    const pattern = item.customPattern || 'สั่งตัดพิเศษ';
    const coll = item.collection || '';
    const color = item.color || '';
    const size = item.customSizeValue || item.size || '';
    return `${pattern} - ${coll} ${color} ${size}`.replace(/\s+/g, ' ').trim();
  } else {
    // 7. รายการสินค้าปกติจะแสดงข้อมูลในใบเสนอราคาคือ
    // Description เว้นวรรค ตามด้วย Color เว้นวรรค ตามด้วย Size
    const desc = item.description || '';
    const color = item.color || '';
    const size = item.size || '';
    return `${desc} ${color} ${size}`.replace(/\s+/g, ' ').trim();
  }
}

export function calculateQuotation(quotation: Quotation): QuotationCalculation {
  const itemCalcs = new Map<string, ItemCalculation>();
  const sectionCalcs = new Map<string, SectionCalculation>();

  let totalGrossAmount = 0;
  let totalItemDiscount = 0;
  let totalEligibleForOntop = 0;

  // First pass: item and section calculations
  for (const section of quotation.sections) {
    let sectionGross = 0;
    let sectionDiscount = 0;
    let sectionNet = 0;

    for (const item of section.items) {
      const gross = (item.quantity || 0) * (item.price || 0);
      const discountPct = Math.min(100, Math.max(0, item.discountPercent || 0));
      const discAmt = gross * (discountPct / 100);
      const netBeforeOntop = gross - discAmt;

      let ontopAmt = 0;
      if (!item.excludeOntopDiscount && quotation.ontopDiscountPercent > 0) {
        ontopAmt = netBeforeOntop * (quotation.ontopDiscountPercent / 100);
      }

      const finalItem = netBeforeOntop - ontopAmt;

      itemCalcs.set(item.id, {
        grossAmount: gross,
        discountAmount: discAmt,
        netAmount: netBeforeOntop,
        ontopDiscountAmount: ontopAmt,
        finalItemAmount: finalItem,
        formattedDescription: formatItemDescription(item),
      });

      sectionGross += gross;
      sectionDiscount += discAmt;
      sectionNet += netBeforeOntop;

      totalGrossAmount += gross;
      totalItemDiscount += discAmt;

      if (!item.excludeOntopDiscount) {
        totalEligibleForOntop += netBeforeOntop;
      }
    }

    sectionCalcs.set(section.id, {
      totalGrossAmount: sectionGross,
      totalDiscountAmount: sectionDiscount,
      totalNetAmount: sectionNet,
    });
  }

  const amountAfterItemDiscount = totalGrossAmount - totalItemDiscount;

  // Ontop discount calculation
  const ontopDiscountAmount =
    quotation.ontopDiscountPercent > 0
      ? totalEligibleForOntop * (quotation.ontopDiscountPercent / 100)
      : 0;

  // Additional discount calculation
  let additionalDiscountAmount = 0;
  if (quotation.additionalDiscount && quotation.additionalDiscount.enabled) {
    const ad = quotation.additionalDiscount;
    const baseAmount =
      ad.applyFrom === 'before_discount' ? totalGrossAmount : amountAfterItemDiscount;

    if (ad.type === 'percent') {
      additionalDiscountAmount = baseAmount * (ad.value / 100);
    } else {
      additionalDiscountAmount = ad.value;
    }
  }

  const finalNetAmount = Math.max(
    0,
    amountAfterItemDiscount - ontopDiscountAmount - additionalDiscountAmount
  );

  // Deposit calculation
  let depositAmount = 0;
  if (quotation.customDepositAmount !== undefined && quotation.customDepositAmount > 0) {
    depositAmount = quotation.customDepositAmount;
  } else if (quotation.depositRatePercent > 0) {
    depositAmount = finalNetAmount * (quotation.depositRatePercent / 100);
  } else if (
    quotation.customer.paymentCondition ===
    'มัดจำ 50% และชำระส่วนที่เหลือเมื่อส่งมอบสินค้า'
  ) {
    depositAmount = finalNetAmount * 0.5;
  }

  const balanceRemaining =
    quotation.customer.paymentCondition === 'ชำระเงิน 100%'
      ? finalNetAmount
      : Math.max(0, finalNetAmount - depositAmount);

  return {
    totalGrossAmount,
    totalItemDiscount,
    amountAfterItemDiscount,
    ontopDiscountAmount,
    additionalDiscountAmount,
    finalNetAmount,
    depositAmount,
    balanceRemaining,
    itemCalculations: itemCalcs,
    sectionCalculations: sectionCalcs,
  };
}
