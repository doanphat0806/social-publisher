import { describe, it, expect } from 'vitest';
import { skuGroupingService } from '../../src/services/skuGrouping.service.js';

describe('SKU Bulk Posting System Logic & Edge Cases', () => {
  it('Edge Case: 100 SKUs with exactly 4 images each distributed over 5 Fanpages', () => {
    const products = Array.from({ length: 100 }, (_, i) => ({
      productCode: `GP${(1900000 + i).toString()}`,
      price: 149000,
    }));

    const pageIds = ['PAGE_1', 'PAGE_2', 'PAGE_3', 'PAGE_4', 'PAGE_5'];
    const startTime = new Date('2026-11-05T08:00:00Z');

    const scheduled = skuGroupingService.generateSchedule(products, pageIds, {
      mode: 'scheduled',
      startAt: startTime,
      intervalMinutes: 15,
    });

    // 100 products * 5 Fanpages = 500 total tasks
    expect(scheduled.length).toBe(500);

    // Verify per-page independent schedule
    for (const pageId of pageIds) {
      const pageTasks = scheduled.filter((t) => t.pageId === pageId);
      expect(pageTasks.length).toBe(100);

      // Task 0: 08:00
      expect(pageTasks[0].scheduledAt.toISOString()).toBe('2026-11-05T08:00:00.000Z');
      // Task 1: 08:15 (15 mins later)
      expect(pageTasks[1].scheduledAt.toISOString()).toBe('2026-11-05T08:15:00.000Z');
      // Task 99: 08:00 + 99 * 15m = 1485m = 24h45m
      expect(pageTasks[99].scheduledAt.getTime() - pageTasks[0].scheduledAt.getTime()).toBe(
        99 * 15 * 60 * 1000
      );
    }
  });

  it('Edge Case: 1,000 SKUs with 4 images each (4,000 files) performance parsing', () => {
    const files: { fileName: string; originalName: string }[] = [];
    for (let i = 1; i <= 1000; i++) {
      const code = `SKU${i.toString().padStart(4, '0')}`;
      files.push({ fileName: `${code}.jpg`, originalName: `${code}.jpg` });
      files.push({ fileName: `${code} 2.jpg`, originalName: `${code} 2.jpg` });
      files.push({ fileName: `${code} 3.jpg`, originalName: `${code} 3.jpg` });
      files.push({ fileName: `${code} 4.jpg`, originalName: `${code} 4.jpg` });
    }

    const start = performance.now();
    const groups = skuGroupingService.groupMediaBySku(files, 4);
    const duration = performance.now() - start;

    expect(groups.size).toBe(1000);
    expect(duration).toBeLessThan(500); // Must parse 4,000 files in under 500ms
  });

  it('Edge Case: SKU with 3 images (missing) and SKU with 5 images (excess)', () => {
    const files = [
      { fileName: 'M3_PHOTO.jpg', originalName: 'M3_PHOTO.jpg' },
      { fileName: 'M3_PHOTO 2.jpg', originalName: 'M3_PHOTO 2.jpg' },
      { fileName: 'M3_PHOTO 3.jpg', originalName: 'M3_PHOTO 3.jpg' },

      { fileName: 'M5_PHOTO.jpg', originalName: 'M5_PHOTO.jpg' },
      { fileName: 'M5_PHOTO 2.jpg', originalName: 'M5_PHOTO 2.jpg' },
      { fileName: 'M5_PHOTO 3.jpg', originalName: 'M5_PHOTO 3.jpg' },
      { fileName: 'M5_PHOTO 4.jpg', originalName: 'M5_PHOTO 4.jpg' },
      { fileName: 'M5_PHOTO 5.jpg', originalName: 'M5_PHOTO 5.jpg' },
    ];

    const groups = skuGroupingService.groupMediaBySku(files, 4);
    expect(groups.get('M3_PHOTO')?.status).toBe('missing_images');
    expect(groups.get('M3_PHOTO')?.imageCount).toBe(3);

    expect(groups.get('M5_PHOTO')?.status).toBe('excess_images');
    expect(groups.get('M5_PHOTO')?.imageCount).toBe(5);
  });

  it('Edge Case: SKU without price, price = 0, and non-numeric price', () => {
    const template = 'MS {product_code} - Giá {price}K';

    const capZero = skuGroupingService.generateCaption(template, 'SP_FREE', 0, { unit: 'K' });
    expect(capZero).toContain('Giá 0K');

    const capLarge = skuGroupingService.generateCaption(template, 'SP_NORMAL', 149000, { unit: 'K' });
    expect(capLarge).toContain('Giá 149K');

    const capVnd = skuGroupingService.generateCaption(template, 'SP_NORMAL', 149000, { unit: 'VNĐ' });
    expect(capVnd).toContain('VNĐ');
    expect(capVnd).not.toContain('VNĐK');
  });

  it('Edge Case: Excel rows with SKUs not present in image uploads', () => {
    const groups = skuGroupingService.groupMediaBySku(
      [{ fileName: 'HAS_PHOTO.jpg', originalName: 'HAS_PHOTO.jpg' }],
      4
    );

    const excelRows = [
      { product_code: 'HAS_PHOTO', price: 200000 },
      { product_code: 'GHOST_SKU', price: 300000 },
    ];

    const merged = skuGroupingService.matchExcelWithSku(groups, excelRows, 4);
    const ghost = merged.find((m) => m.productCode === 'GHOST_SKU');

    expect(ghost).toBeDefined();
    expect(ghost?.status).toBe('no_images');
    expect(ghost?.imageCount).toBe(0);
    expect(ghost?.price).toBe(300000);
  });
});
