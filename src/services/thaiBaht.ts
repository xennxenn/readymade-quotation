/**
 * Converts a numeric amount to Thai Baht text representation
 * Example: 53595.00 -> "ห้าหมื่นสามพันห้าร้อยเก้าสิบห้าบาทถ้วน"
 * Example: 7012.50  -> "เจ็ดพันสิบสองบาทห้าสิบสตางค์"
 */

const THAI_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

function convertGroup(digitsStr: string): string {
  let result = '';
  const len = digitsStr.length;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(digitsStr[i], 10);
    const pos = len - i - 1;

    if (digit === 0) continue;

    if (pos === 0 && digit === 1 && len > 1 && digitsStr[len - 2] !== '0') {
      result += 'เอ็ด';
    } else if (pos === 1 && digit === 1) {
      result += 'สิบ';
    } else if (pos === 1 && digit === 2) {
      result += 'ยี่สิบ';
    } else {
      result += THAI_DIGITS[digit] + THAI_POSITIONS[pos];
    }
  }

  return result;
}

export function thaiBahtText(amount: number): string {
  if (isNaN(amount) || amount === 0) {
    return 'ศูนย์บาทถ้วน';
  }

  const isNegative = amount < 0;
  amount = Math.abs(amount);

  // Round to 2 decimal places
  const fixed = amount.toFixed(2);
  const parts = fixed.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  let integerText = '';

  // Process millions groups
  const integerLen = integerPart.length;
  let remaining = integerPart;

  const chunks: string[] = [];
  while (remaining.length > 0) {
    const take = Math.min(6, remaining.length);
    chunks.unshift(remaining.slice(-take));
    remaining = remaining.slice(0, -take);
  }

  for (let i = 0; i < chunks.length; i++) {
    const groupText = convertGroup(chunks[i]);
    const millionLevel = chunks.length - 1 - i;
    if (groupText.length > 0) {
      integerText += groupText + (millionLevel > 0 ? 'ล้าน'.repeat(millionLevel) : '');
    }
  }

  if (integerText === '') {
    integerText = 'ศูนย์';
  }

  let satangText = '';
  const satangVal = parseInt(decimalPart, 10);
  if (satangVal > 0) {
    const d1 = parseInt(decimalPart[0], 10);
    const d2 = parseInt(decimalPart[1], 10);

    if (d1 === 1) {
      satangText += 'สิบ';
    } else if (d1 === 2) {
      satangText += 'ยี่สิบ';
    } else if (d1 > 2) {
      satangText += THAI_DIGITS[d1] + 'สิบ';
    }

    if (d2 === 1 && d1 > 0) {
      satangText += 'เอ็ด';
    } else if (d2 > 0) {
      satangText += THAI_DIGITS[d2];
    }
    satangText += 'สตางค์';
  }

  const fullText = (isNegative ? 'ลบ' : '') + integerText + 'บาท' + (satangVal === 0 ? 'ถ้วน' : satangText);
  return `= ${fullText} =`;
}
