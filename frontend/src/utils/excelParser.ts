export interface ParsedProductRow {
  product_code: string;
  price: number;
}

/**
 * Parse CSV, TSV (Excel copy-paste), or semicolon-separated text
 * Supports:
 * - Direct copy-paste from Excel spreadsheet (tab-delimited)
 * - CSV files (comma-delimited)
 * - Header row detection (e.g. "product_code,price" or "Mã,Giá")
 */
export function parseExcelText(rawText: string): ParsedProductRow[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const results: ParsedProductRow[] = [];

  // Detect delimiter: tab (\t), comma (,), or semicolon (;)
  const firstLine = lines[0];
  let delimiter = '\t';
  if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (firstLine.includes(',')) {
    delimiter = ',';
  } else if (firstLine.includes(';')) {
    delimiter = ';';
  }

  // Check if first line is a header
  let startIndex = 0;
  const headerParts = firstLine.split(delimiter).map((p) => p.trim().toLowerCase());
  const hasHeader =
    headerParts.some((p) => p.includes('mã') || p.includes('code') || p.includes('sku') || p.includes('sp')) ||
    headerParts.some((p) => p.includes('giá') || p.includes('price') || p.includes('tien'));

  if (hasHeader) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(delimiter).map((p) => p.replace(/^["']|["']$/g, '').trim());

    if (parts.length >= 1) {
      const code = parts[0].toUpperCase().trim();
      if (!code) continue;

      let price = 0;
      if (parts.length >= 2) {
        // Clean price string (remove 'đ', 'k', 'vnđ', dots, commas)
        let priceStr = parts[1].replace(/[^\d.,]/gi, '').trim();
        // Handle 149.000 or 149,000 -> 149000
        if (priceStr.includes('.') && priceStr.split('.').pop()?.length === 3) {
          priceStr = priceStr.replace(/\./g, '');
        } else if (priceStr.includes(',') && priceStr.split(',').pop()?.length === 3) {
          priceStr = priceStr.replace(/,/g, '');
        }
        price = parseFloat(priceStr) || 0;
      }

      results.push({
        product_code: code,
        price,
      });
    }
  }

  return results;
}

