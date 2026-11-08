import path from 'path';

export interface SkuFileInfo {
  fileName: string;
  originalName: string;
  mediaAssetId?: string;
  url?: string;
  size?: number;
}

export interface ParsedSkuResult {
  productCode: string;
  imageIndex: number;
  isUnclassified: boolean;
}

export interface SkuGroupItem {
  productCode: string;
  price: number;
  imageCount: number;
  targetCount: number;
  status: 'ready' | 'missing_images' | 'excess_images' | 'no_images';
  files: (SkuFileInfo & { imageIndex: number })[];
  caption?: string;
  inExcel: boolean;
}

export interface ExcelProductInput {
  product_code: string;
  price: number;
}

export class SkuGroupingService {
  /**
   * Parse SKU code and image index from filename
   * Handles patterns:
   *   AE0309436.jpg -> code: AE0309436, index: 1
   *   AE0309436 2.jpg -> code: AE0309436, index: 2
   *   AE0309436_3.jpg -> code: AE0309436, index: 3
   *   AE0309436-4.jpg -> code: AE0309436, index: 4
   *   AE0309436 (1).jpg -> code: AE0309436, index: 1
   *   AE03094360.jpg -> code: AE03094360, index: 1 (DOES NOT COLLIDE WITH AE0309436)
   */
  parseSkuFromFileName(fileName: string, customRegex?: string): ParsedSkuResult {
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext).trim();

    if (!baseName) {
      return { productCode: 'Chưa phân loại', imageIndex: 1, isUnclassified: true };
    }

    if (customRegex) {
      try {
        const re = new RegExp(customRegex, 'i');
        const match = baseName.match(re);
        if (match && match[1]) {
          const code = match[1].trim().toUpperCase();
          const idx = match[2] ? parseInt(match[2], 10) : 1;
          return { productCode: code, imageIndex: isNaN(idx) ? 1 : idx, isUnclassified: false };
        }
      } catch {
        // Fall back to default parsing
      }
    }

    // Default intelligent parser:
    // Regex matches delimiter: space, underscore, dash, dot, parentheses, brackets, or '#'
    // followed by digits (index) at the end of string.
    const suffixRegex = /^(.*?)(?:[\s\-_.]+|\s*[\(\[\{]|\s*#)(\d+)\s*[\)\]\}]?$/;
    const match = baseName.match(suffixRegex);

    if (match && match[1].trim().length > 0) {
      const code = match[1].trim().toUpperCase();
      const index = parseInt(match[2], 10);
      return {
        productCode: code,
        imageIndex: isNaN(index) || index <= 0 ? 1 : index,
        isUnclassified: false,
      };
    }

    // If no delimiter + number at the end, check if it's a clean SKU code (alphanumeric, at least 2 chars)
    const cleanCode = baseName.toUpperCase().trim();
    if (/^[A-Z0-9_\-\.]+$/i.test(cleanCode) && cleanCode.length >= 2) {
      return {
        productCode: cleanCode,
        imageIndex: 1,
        isUnclassified: false,
      };
    }

    // Fallback: unclassified
    return {
      productCode: 'Chưa phân loại',
      imageIndex: 1,
      isUnclassified: true,
    };
  }

  /**
   * Group file list by SKU code
   */
  groupMediaBySku(
    files: SkuFileInfo[],
    imagesPerPost: number = 4,
    customRegex?: string
  ): Map<string, SkuGroupItem> {
    const groups = new Map<string, SkuGroupItem>();

    for (const file of files) {
      const parsed = this.parseSkuFromFileName(file.originalName || file.fileName, customRegex);
      const code = parsed.productCode;

      if (!groups.has(code)) {
        groups.set(code, {
          productCode: code,
          price: 0,
          imageCount: 0,
          targetCount: imagesPerPost,
          status: 'missing_images',
          files: [],
          inExcel: false,
        });
      }

      const group = groups.get(code)!;
      group.files.push({
        ...file,
        imageIndex: parsed.imageIndex,
      });
      group.imageCount = group.files.length;
    }

    // Sort files in each group by imageIndex
    for (const group of groups.values()) {
      group.files.sort((a, b) => a.imageIndex - b.imageIndex);

      if (group.productCode === 'Chưa phân loại') {
        group.status = 'missing_images';
      } else if (group.imageCount === imagesPerPost) {
        group.status = 'ready';
      } else if (group.imageCount < imagesPerPost) {
        group.status = 'missing_images';
      } else {
        group.status = 'excess_images';
      }
    }

    return groups;
  }

  /**
   * Merge Excel/CSV data (product_code, price) with image groups
   */
  matchExcelWithSku(
    skuGroups: Map<string, SkuGroupItem>,
    excelRows: ExcelProductInput[],
    imagesPerPost: number = 4
  ): SkuGroupItem[] {
    const resultMap = new Map<string, SkuGroupItem>(skuGroups);

    for (const row of excelRows) {
      if (!row.product_code) continue;
      const cleanCode = row.product_code.trim().toUpperCase();
      const numPrice = typeof row.price === 'number' ? row.price : parseFloat(String(row.price)) || 0;

      if (resultMap.has(cleanCode)) {
        const item = resultMap.get(cleanCode)!;
        item.price = numPrice;
        item.inExcel = true;
      } else {
        // SKU in Excel has NO photos
        resultMap.set(cleanCode, {
          productCode: cleanCode,
          price: numPrice,
          imageCount: 0,
          targetCount: imagesPerPost,
          status: 'no_images',
          files: [],
          inExcel: true,
        });
      }
    }

    return Array.from(resultMap.values());
  }

  /**
   * Format price based on unit
   */
  formatPrice(price: number, unit: 'K' | 'nghìn đồng' | 'VNĐ' = 'K'): string {
    if (price === 0) return '0';

    if (unit === 'K') {
      if (price >= 1000) {
        return `${Math.round(price / 1000)}`;
      }
      return `${price}`;
    }

    if (unit === 'nghìn đồng') {
      if (price >= 1000) {
        return `${Math.round(price / 1000)} nghìn đồng`;
      }
      return `${price} nghìn đồng`;
    }

    if (unit === 'VNĐ') {
      return `${price.toLocaleString('vi-VN')} VNĐ`;
    }

    return `${price}`;
  }

  /**
   * Generate Facebook post caption with dynamic variables
   */
  generateCaption(
    template: string,
    productCode: string,
    price: number,
    options: {
      unit?: 'K' | 'nghìn đồng' | 'VNĐ';
      showCodeLine?: boolean;
      pageId?: string;
    } = {}
  ): string {
    const unit = options.unit || 'K';
    const showCodeLine = options.showCodeLine !== false;
    const formattedPrice = this.formatPrice(price, unit);
    const messengerUrl = options.pageId ? `https://m.me/${options.pageId}` : 'https://m.me';

    let caption = template;

    // If unit is 'K', template typically has `{price}K` or `{price}`
    // If unit is VNĐ or nghìn đồng, `{price}K` should become `{price}` so it doesn't render '149.000 VNĐK'
    if (unit !== 'K') {
      caption = caption.replace(/\{price\}K/gi, '{price}');
    }

    caption = caption
      .replace(/\{product_code\}/gi, productCode)
      .replace(/\{productCode\}/gi, productCode)
      .replace(/\{price\}/gi, formattedPrice)
      .replace(/\{price_raw\}/gi, price.toString())
      .replace(/\{inbox_link\}|\{messenger_link\}|\{inbox\}|\{messenger\}/gi, messengerUrl);

    if (!showCodeLine) {
      // Remove lines like "MS GP1903382" or "Mã: GP1903382"
      const lines = caption.split('\n');
      const filtered = lines.filter((line) => {
        const trimmed = line.trim();
        // If line is just the product code or "MS <code-here>"
        return (
          trimmed !== productCode &&
          !new RegExp(`^(?:MS|MÃ|MÃ SP|CODE)[:\\s]*${productCode}$`, 'i').test(trimmed)
        );
      });
      caption = filtered.join('\n');
    }

    return caption.trim();
  }

  /**
   * Generate scheduled publishing time distribution across Fanpages
   */
  generateSchedule(
    products: { productCode: string; _id?: any }[],
    pageIds: string[],
    scheduleConfig: {
      mode: 'immediate' | 'scheduled';
      startAt?: Date;
      intervalMinutes: number;
      pageSchedules?: { pageId: string; startAt: Date }[];
    }
  ): { productCode: string; pageId: string; scheduledAt: Date }[] {
    const results: { productCode: string; pageId: string; scheduledAt: Date }[] = [];
    const now = new Date();
    const intervalMs = (scheduleConfig.intervalMinutes || 15) * 60 * 1000;

    for (const pageId of pageIds) {
      // Determine start time for this specific page
      let pageStartTime: Date;

      if (scheduleConfig.mode === 'immediate') {
        pageStartTime = new Date(now.getTime() + 10000); // 10 seconds from now
      } else {
        const customPageSched = scheduleConfig.pageSchedules?.find((s) => s.pageId === pageId);
        if (customPageSched && customPageSched.startAt) {
          pageStartTime = new Date(customPageSched.startAt);
        } else if (scheduleConfig.startAt) {
          pageStartTime = new Date(scheduleConfig.startAt);
        } else {
          pageStartTime = new Date(now.getTime() + 10000);
        }
      }

      // Distribute products sequentially for this page
      products.forEach((prod, index) => {
        let taskTime: Date;
        if (scheduleConfig.mode === 'immediate') {
          // In immediate mode, stagger each post by 1 minute per page to avoid FB spam flags
          taskTime = new Date(pageStartTime.getTime() + index * 60 * 1000);
        } else {
          taskTime = new Date(pageStartTime.getTime() + index * intervalMs);
        }

        results.push({
          productCode: prod.productCode,
          pageId,
          scheduledAt: taskTime,
        });
      });
    }

    return results;
  }
}

export const skuGroupingService = new SkuGroupingService();

