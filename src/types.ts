export interface Product {
  id: string;
  barcode: string;          // Col A
  description: string;      // Col C
  design?: string;          // Col M
  color: string;            // Col N
  size: string;             // Col O
  price: number;            // Col P
  collection: string;       // Col R
  category?: string;        // Col U
  itemName?: string;        // Col V
  styleName?: string;       // Col W
  unit: string;             // Col AO (e.g. ผืน, ชิ้น, ชุด)
  weight?: string;          // Col AP
  createdAt?: number;
}

export type CustomPatternType =
  | 'ผ้าปูที่นอนแบบรัดมุม'
  | 'ผ้าปูที่นอนแบบไม่รัดมุม'
  | 'ปลอกหมอนหนุน'
  | 'ปลอกหมอนบอดี้'
  | 'ปลอกหมอนข้าง'
  | 'ปลอกผ้านวม'
  | 'ผ้านวมเย็บติด'
  | 'ปลอกหมอนอิง';

export interface QuoteItem {
  id: string;
  isCustom: boolean;           // true if สั่งตัดพิเศษ
  barcode?: string;
  collection: string;
  description: string;
  color: string;
  size: string;
  unit: string;
  quantity: number;
  price: number;
  discountPercent: number;     // % ส่วนลดรายการ
  excludeOntopDiscount: boolean; // ติ๊กข้อมูลไม่ให้ใช้ส่วนลด Ontop
  
  // Custom Made-to-order specific fields:
  customPattern?: CustomPatternType;
  customSizeUnit?: 'cm.' | 'in.';
  customSizeValue?: string;
  notes?: string;
}

export interface QuoteSection {
  id: string;
  title: string;              // เช่น "ห้องลูกชาย - KUBUA / WHIMSICAL BLUE"
  items: QuoteItem[];
}

export type ValidityOption = '3 วัน' | '7 วัน' | 'custom';
export type PaymentConditionOption = 
  | 'ชำระเงิน 100%' 
  | 'มัดจำ 50% และชำระส่วนที่เหลือเมื่อส่งมอบสินค้า' 
  | 'custom';

export interface CustomerInfo {
  contactName: string;        // ชื่อผู้ติดต่อ (จำเป็น)
  customerName: string;       // ชื่อลูกค้า (จำเป็น)
  addressLine1?: string;      // ที่อยู่ บรรทัดที่ 1
  addressLine2?: string;      // ที่อยู่ บรรทัดที่ 2
  addressLine3?: string;      // ที่อยู่ บรรทัดที่ 3
  address: string;            // ที่อยู่ (3 บรรทัด)
  taxId: string;              // เลขที่ประจำตัวผู้เสียภาษี (ตัวเลือก)
  phone: string;              // เบอร์โทรศัพท์ (จำเป็น)
  
  validityType: ValidityOption;
  validityCustomDays?: number;
  
  paymentCondition: PaymentConditionOption;
  paymentCustomText?: string;
  
  adminName: string;          // ผู้ดูแล (เลือกรายชื่อพนักงาน)
  salesName: string;          // พนักงานขาย (เลือกรายชื่อพนักงาน)
}

export interface AdditionalDiscount {
  enabled: boolean;
  type: 'amount' | 'percent';
  value: number;
  applyFrom: 'before_discount' | 'after_discount'; // ลดจากยอดไหน
  description: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  date: string;               // YYYY-MM-DD
  customer: CustomerInfo;
  sections: QuoteSection[];
  
  // Ontop discount
  ontopDiscountPercent: number; // ใส่ครั้งเดียวลด Ontop ทั้งหมด
  
  // Additional discount
  additionalDiscount: AdditionalDiscount;
  
  // Deposit & payment status
  depositRatePercent: number; // 0, 50, 100 or custom
  customDepositAmount?: number;
  
  notes: string[];
  inspectorName?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PromotionGroup {
  id: string;
  name: string;
  collection: string;
  applyToAllColors: boolean;  // ทั้ง collection
  selectedColors: string[];   // หรือเลือกบางสี
  discountPercent: number;
  createdAt: number;
}

export type StaffRole = 'staff' | 'admin' | 'manager';

export interface StaffMember {
  id: string;
  name: string;
  employeeId: string;
  password?: string;
  role: StaffRole;
  phone?: string;
  createdAt?: number;
}

export interface CompanySettings {
  logoUrl: string;           // Base64 data URL or path e.g. '/pasaya-logo.svg'
  companyName: string;       // e.g. บริษัท เท็กซ์ไทล์ แกลลอรี่ จำกัด
  branchName: string;        // e.g. (สำนักงานใหญ่)
  address: string;           // e.g. 77/191-192 อาคารสินสาธรทาวเวอร์ ชั้น 42...
  taxId: string;             // e.g. 0105546015615
  phone: string;             // e.g. 0-2440-0955
  fax: string;               // e.g. 0-2440-0933-4
  email?: string;
  website?: string;
  logoHeight?: number;       // display height in pixels, default ~80-96px
}
