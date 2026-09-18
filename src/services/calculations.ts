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
  roundingDifference: number;           // ส่วนต่างจากการปัดเศษ
  balanceRemaining: number;             // ยอดค้างชำระ (ปัดเศษสตางค์ลงเป็นจำนวนเต็ม)
  rawBalanceRemaining: number;          // ยอดค้างชำระก่อนปัดเศษ
  itemCalculations: Map<string, ItemCalculation>;
  sectionCalculations: Map<string, SectionCalculation>;
}

export function formatItemDescription(item: QuoteItem): string {
  const coll = (item.collection || '').trim();
  const color = (item.color || '').trim();
  const size = (item.customSizeValue || item.size || '').trim();

  // ใช้ "/" คั่นระหว่าง Collection และ Color โดยมีเว้นวรรคหน้าและหลังเสมอ
  const collSlashColor = coll && color ? `${coll} / ${color}` : (coll || color);

  if (item.isCustom) {
    // รายการสินค้าสั่งตัดพิเศษ: รูปแบบ - Collection / Color Size
    // หากในชื่อรูปแบบมี Collection อยู่แล้ว จะไม่แสดง Collection ซ้ำ
    const rawPattern = (item.customPattern || 'สั่งตัดพิเศษ').trim();

    if (!collSlashColor) {
      return `${rawPattern} ${size}`.replace(/\s+/g, ' ').trim();
    }

    // ตรวจสอบว่าใน rawPattern มีชื่อ Collection อยู่แล้วหรือไม่
    if (coll && rawPattern.toLowerCase().includes(coll.toLowerCase())) {
      if (color) {
        return `${rawPattern} / ${color} ${size}`.replace(/\s+/g, ' ').trim();
      }
      return `${rawPattern} ${size}`.replace(/\s+/g, ' ').trim();
    }

    const cleanPattern = rawPattern.replace(/[-–—]\s*$/, '').trim();
    return `${cleanPattern} - ${collSlashColor} ${size}`.replace(/\s+/g, ' ').trim();
  } else {
    // สินค้าในฐานข้อมูลสินค้า:
    // ใช้ "/" คั่นระหว่าง Collection และ Color (เว้นวรรคหน้าและหลัง)
    // แสดงแค่ตัวคั่น "/" เพราะมีข้อมูล Collection และ Color อยู่แล้ว และไม่ต้องแสดง Collection ซ้ำ
    const rawDesc = (item.description || '').trim();

    if (!rawDesc) {
      return `${collSlashColor} ${size}`.replace(/\s+/g, ' ').trim();
    }

    // ตรวจสอบว่าใน Description มีชื่อ Collection อยู่แล้วหรือไม่ (เช่น "ผ้าปูที่นอน KUBUA")
    if (coll && rawDesc.toLowerCase().includes(coll.toLowerCase())) {
      // ใน Description มี Collection อยู่แล้ว -> แสดงแค่ตัวคั่น " / " และ Color เพื่อไม่ให้แสดง Collection ซ้ำ
      if (color) {
        // หากใน Description มี Color อยู่ด้วยแล้ว
        if (rawDesc.toLowerCase().includes(color.toLowerCase())) {
          return `${rawDesc} ${size}`.replace(/\s+/g, ' ').trim();
        }
        return `${rawDesc} / ${color} ${size}`.replace(/\s+/g, ' ').trim();
      }
      return `${rawDesc} ${size}`.replace(/\s+/g, ' ').trim();
    }

    // หากใน Description ยังไม่มี Collection ให้แสดง Description ตามด้วย Collection / Color Size
    if (collSlashColor) {
      return `${rawDesc} ${collSlashColor} ${size}`.replace(/\s+/g, ' ').trim();
    }

    return `${rawDesc} ${size}`.replace(/\s+/g, ' ').trim();
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

  const rawBalanceRemaining =
    quotation.customer.paymentCondition === 'ชำระเงิน 100%'
      ? finalNetAmount
      : Math.max(0, finalNetAmount - depositAmount);

  // ปัดเศษสตางค์ลงเป็นจำนวนเต็มทุกครั้ง (Math.floor)
  const normalizedRawBalance = Math.round(rawBalanceRemaining * 100) / 100;
  const balanceRemaining = Math.floor(normalizedRawBalance);
  // ส่วนต่างจากการปัดเศษ (เศษสตางค์ที่ถูกปัดลง)
  const roundingDifference = Math.round((normalizedRawBalance - balanceRemaining) * 100) / 100;

  return {
    totalGrossAmount,
    totalItemDiscount,
    amountAfterItemDiscount,
    ontopDiscountAmount,
    additionalDiscountAmount,
    finalNetAmount,
    depositAmount,
    roundingDifference,
    balanceRemaining,
    rawBalanceRemaining: normalizedRawBalance,
    itemCalculations: itemCalcs,
    sectionCalculations: sectionCalcs,
  };
}
