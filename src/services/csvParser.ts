import Papa from 'papaparse';
import { Product } from '../types';
import { batchInsertProducts } from './db';

export interface ImportProgress {
  processedRows: number;
  validProducts: number;
  status: 'idle' | 'parsing' | 'saving' | 'completed' | 'cancelled' | 'error';
  errorMessage?: string;
  speedRowsPerSec?: number;
  detectedEncoding?: string;
}

export type CsvEncodingOption = 'auto' | 'windows-874' | 'utf-8';

/**
 * Auto-detects whether a file is encoded in Windows-874 (TIS-620) or UTF-8
 */
export async function detectFileEncoding(file: File): Promise<'windows-874' | 'utf-8'> {
  try {
    const slice = file.slice(0, 8192);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // UTF-8 BOM check: 0xEF, 0xBB, 0xBF
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return 'utf-8';
    }

    let hasThaiTis620Bytes = false;
    let hasValidUtf8Thai = false;

    for (let i = 0; i < bytes.length; i++) {
      // Thai in UTF-8: 0xE0, (0xB8 or 0xB9), (0x80 to 0xBF)
      if (
        bytes[i] === 0xE0 &&
        i + 2 < bytes.length &&
        (bytes[i + 1] === 0xB8 || bytes[i + 1] === 0xB9) &&
        bytes[i + 2] >= 0x80 &&
        bytes[i + 2] <= 0xBF
      ) {
        hasValidUtf8Thai = true;
        i += 2;
        continue;
      }

      // Thai characters in TIS-620 / Windows-874: 0xA1 (ก) to 0xFB (๙)
      if (bytes[i] >= 0xA1 && bytes[i] <= 0xFB) {
        hasThaiTis620Bytes = true;
      }
    }

    if (hasThaiTis620Bytes && !hasValidUtf8Thai) {
      return 'windows-874';
    }

    return 'utf-8';
  } catch (e) {
    console.warn('Could not detect file encoding, defaulting to utf-8', e);
    return 'utf-8';
  }
}

export async function parseAndImportFile(
  file: File,
  onProgress: (progress: ImportProgress) => void,
  cancelRef: { cancelled: boolean },
  encodingPreference: CsvEncodingOption = 'auto'
): Promise<number> {
  let effectiveEncoding = encodingPreference === 'auto'
    ? await detectFileEncoding(file)
    : encodingPreference;

  return new Promise((resolve, reject) => {
    let rowCount = 0;
    let validCount = 0;
    let buffer: Product[] = [];
    const BATCH_SIZE = 5000;
    const startTime = Date.now();

    onProgress({
      processedRows: 0,
      validProducts: 0,
      status: 'parsing',
      detectedEncoding: effectiveEncoding,
    });

    async function flushBuffer(): Promise<void> {
      if (buffer.length === 0) return;
      const toSave = buffer;
      buffer = [];
      await batchInsertProducts(toSave);
    }

    Papa.parse(file, {
      encoding: effectiveEncoding, // 'windows-874' or 'utf-8'
      skipEmptyLines: 'greedy',
      chunkSize: 1024 * 1024 * 4, // 4MB chunks for rapid streaming of millions of rows
      chunk: async (results, parser) => {
        if (cancelRef.cancelled) {
          parser.abort();
          onProgress({
            processedRows: rowCount,
            validProducts: validCount,
            status: 'cancelled',
            detectedEncoding: effectiveEncoding,
          });
          resolve(validCount);
          return;
        }

        parser.pause(); // pause stream while writing batch to IndexedDB

        const rows = results.data as string[][];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          // Skip header row if it contains text headers
          if (rowCount === 0) {
            const firstCell = String(row[0] || '').trim().toLowerCase();
            if (
              firstCell === 'barcode' ||
              firstCell === 'บาร์โค้ด' ||
              firstCell === 'code' ||
              firstCell === 'col a'
            ) {
              rowCount++;
              continue;
            }
          }

          rowCount++;

          // Column Mapping:
          // A: Barcode (idx 0)
          // C: Description (idx 2)
          // M: Design (idx 12)
          // N: Color (idx 13)
          // O: Size (idx 14)
          // P: Price (idx 15)
          // R: Collection (idx 17)
          // U: Category (idx 20)
          // V: Item Name (idx 21)
          // W: Style Name (idx 22)
          // AO: Unit (idx 40)
          // AP: Weight (idx 41)

          const barcode = String(row[0] || '').trim();
          const description = String(row[2] || '').trim();
          const design = row[12] ? String(row[12]).trim() : undefined;
          const color = String(row[13] || '').trim();
          const size = String(row[14] || '').trim();
          const rawPrice = row[15] !== undefined ? String(row[15]).replace(/,/g, '').trim() : '0';
          const price = parseFloat(rawPrice) || 0;
          const collection = String(row[17] || '').trim();
          const category = row[20] ? String(row[20]).trim() : undefined;
          const itemName = row[21] ? String(row[21]).trim() : undefined;
          const styleName = row[22] ? String(row[22]).trim() : undefined;
          const unit = String(row[40] || 'ชิ้น').trim() || 'ชิ้น';
          const weight = row[41] ? String(row[41]).trim() : undefined;

          // Require at least a barcode or collection/description to be a valid row
          if (barcode || (collection && description)) {
            const prod: Product = {
              id: 'p-' + (barcode || `${collection}-${color}-${size}-${rowCount}`),
              barcode: barcode || `AUTO-${rowCount}`,
              description: description || 'สินค้าทั่วไป',
              design,
              color: color || '-',
              size: size || '-',
              price,
              collection: collection || 'GENERAL',
              category,
              itemName,
              styleName,
              unit,
              weight,
              createdAt: Date.now(),
            };

            buffer.push(prod);
            validCount++;
          }

          if (buffer.length >= BATCH_SIZE) {
            await flushBuffer();
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = elapsed > 0 ? Math.round(rowCount / elapsed) : 0;
            onProgress({
              processedRows: rowCount,
              validProducts: validCount,
              status: 'saving',
              speedRowsPerSec: speed,
              detectedEncoding: effectiveEncoding,
            });
          }
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? Math.round(rowCount / elapsed) : 0;
        onProgress({
          processedRows: rowCount,
          validProducts: validCount,
          status: 'parsing',
          speedRowsPerSec: speed,
          detectedEncoding: effectiveEncoding,
        });

        parser.resume();
      },
      complete: async () => {
        try {
          await flushBuffer();
          onProgress({
            processedRows: rowCount,
            validProducts: validCount,
            status: 'completed',
            detectedEncoding: effectiveEncoding,
          });
          resolve(validCount);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          onProgress({
            processedRows: rowCount,
            validProducts: validCount,
            status: 'error',
            errorMessage: message,
            detectedEncoding: effectiveEncoding,
          });
          reject(err);
        }
      },
      error: (error) => {
        onProgress({
          processedRows: rowCount,
          validProducts: validCount,
          status: 'error',
          errorMessage: error.message,
          detectedEncoding: effectiveEncoding,
        });
        reject(error);
      },
    });
  });
}

/**
 * Generates a sample CSV template file complying with columns A to AP for users to download and test
 */
export function generateSampleCsv(): string {
  const header: string[] = [];
  for (let i = 0; i <= 41; i++) {
    if (i === 0) header.push('Barcode (Col A)');
    else if (i === 2) header.push('Description (Col C)');
    else if (i === 12) header.push('Design (Col M)');
    else if (i === 13) header.push('Color (Col N)');
    else if (i === 14) header.push('Size (Col O)');
    else if (i === 15) header.push('Price (Col P)');
    else if (i === 17) header.push('Collection (Col R)');
    else if (i === 20) header.push('Category (Col U)');
    else if (i === 21) header.push('Item Name (Col V)');
    else if (i === 22) header.push('Style Name (Col W)');
    else if (i === 40) header.push('Unit (Col AO)');
    else if (i === 41) header.push('Weight (Col AP)');
    else header.push('');
  }

  function makeRow(
    barcode: string,
    desc: string,
    design: string,
    color: string,
    size: string,
    price: number,
    collection: string,
    category: string,
    itemName: string,
    styleName: string,
    unit: string,
    weight: string
  ): string[] {
    const row: string[] = new Array(42).fill('');
    row[0] = barcode;
    row[2] = desc;
    row[12] = design;
    row[13] = color;
    row[14] = size;
    row[15] = String(price);
    row[17] = collection;
    row[20] = category;
    row[21] = itemName;
    row[22] = styleName;
    row[40] = unit;
    row[41] = weight;
    return row;
  }

  const rows = [
    header.join(','),
    makeRow('885990001', 'ผ้าปูที่นอน', 'Classic', 'WHIMSICAL BLUE', '193 x 203 x 21.5 cm.', 9350, 'KUBUA', 'Bedsheet', 'Bedsheet Kubua', 'Modern', 'ผืน', '1.2 kg').join(','),
    makeRow('885990002', 'ปลอกหมอนหนุน', 'Standard', 'WHIMSICAL BLUE', '12 x 35 in.', 2050, 'KUBUA', 'Pillowcase', 'Bolster Kubua', 'Modern', 'ชิ้น', '0.3 kg').join(','),
    makeRow('885990003', 'ปลอกหมอนหนุน', 'Small', 'WHIMSICAL BLUE', '12 x 20 in.', 1790, 'KUBUA', 'Pillowcase', 'Pillow Kubua 12x20', 'Modern', 'ชิ้น', '0.25 kg').join(','),
    makeRow('885990004', 'ปลอกผ้านวมแบบมีกุ้น', 'King', 'WHIMSICAL BLUE', 'KING Size : 100 x 90 in.', 16650, 'KUBUA', 'Duvet', 'Duvet Kubua King', 'Luxury', 'ผืน', '2.1 kg').join(','),
    makeRow('885990005', 'ผ้าปูที่นอน', 'Sleek', 'NEON SILVER', '193 x 203 x 21.5 cm.', 9350, 'NOVELTY', 'Bedsheet', 'Bedsheet Novelty', 'Futuristic', 'ผืน', '1.2 kg').join(','),
    makeRow('885990006', 'ปลอกหมอนหนุน', 'Standard', 'NEON SILVER', '19 x 29 in.', 2050, 'NOVELTY', 'Pillowcase', 'Pillow Novelty Std', 'Futuristic', 'ชิ้น', '0.3 kg').join(','),
  ];

  return rows.join('\n');
}
