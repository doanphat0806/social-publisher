import { describe, it, expect } from 'vitest';
import { SkuGroupingService } from '../../src/services/skuGrouping.service.js';

describe('SkuGroupingService Unit Tests', () => {
  const service = new SkuGroupingService();

  describe('parseSkuFromFileName', () => {
    it('should correctly parse base filename with space and index', () => {
      const res1 = service.parseSkuFromFileName('AE0309436.jpg');
      expect(res1.productCode).toBe('AE0309436');
      expect(res1.imageIndex).toBe(1);

      const res2 = service.parseSkuFromFileName('AE0309436 2.jpg');
      expect(res2.productCode).toBe('AE0309436');
      expect(res2.imageIndex).toBe(2);

      const res3 = service.parseSkuFromFileName('AE0309436 3.jpg');
      expect(res3.productCode).toBe('AE0309436');
      expect(res3.imageIndex).toBe(3);

      const res4 = service.parseSkuFromFileName('AE0309436 4.jpg');
      expect(res4.productCode).toBe('AE0309436');
      expect(res4.imageIndex).toBe(4);
    });

    it('should not confuse AE0309436 with AE03094360', () => {
      const res1 = service.parseSkuFromFileName('AE0309436.jpg');
      const res2 = service.parseSkuFromFileName('AE03094360.jpg');
      const res3 = service.parseSkuFromFileName('AE03094360 2.jpg');

      expect(res1.productCode).toBe('AE0309436');
      expect(res2.productCode).toBe('AE03094360');
      expect(res3.productCode).toBe('AE03094360');
      expect(res3.imageIndex).toBe(2);
      expect(res1.productCode).not.toBe(res2.productCode);
    });

    it('should handle various delimiter formats: underscore, dash, parens, dot', () => {
      expect(service.parseSkuFromFileName('SP100_1.png')).toEqual({
        productCode: 'SP100',
        imageIndex: 1,
        isUnclassified: false,
      });

      expect(service.parseSkuFromFileName('GP1903382-2.jpeg')).toEqual({
        productCode: 'GP1903382',
        imageIndex: 2,
        isUnclassified: false,
      });

      expect(service.parseSkuFromFileName('AO_HOODIE (3).webp')).toEqual({
        productCode: 'AO_HOODIE',
        imageIndex: 3,
        isUnclassified: false,
      });

      expect(service.parseSkuFromFileName('VAY.4.jpg')).toEqual({
        productCode: 'VAY',
        imageIndex: 4,
        isUnclassified: false,
      });
    });

    it('should mark unidentifiable files as unclassified', () => {
      const res = service.parseSkuFromFileName('   .jpg');
      expect(res.isUnclassified).toBe(true);
      expect(res.productCode).toBe('Chưa phân loại');
    });
  });

  describe('groupMediaBySku', () => {
    it('should group 100 SKUs with 4 images each into correct groups', () => {
      const files: { fileName: string; originalName: string }[] = [];
      for (let i = 1; i <= 100; i++) {
        const code = `SKU${i.toString().padStart(4, '0')}`;
        files.push({ fileName: `${code}.jpg`, originalName: `${code}.jpg` });
        files.push({ fileName: `${code} 2.jpg`, originalName: `${code} 2.jpg` });
        files.push({ fileName: `${code} 3.jpg`, originalName: `${code} 3.jpg` });
        files.push({ fileName: `${code} 4.jpg`, originalName: `${code} 4.jpg` });
      }

      const groups = service.groupMediaBySku(files, 4);
      expect(groups.size).toBe(100);

      const firstGroup = groups.get('SKU0001');
      expect(firstGroup).toBeDefined();
      expect(firstGroup?.imageCount).toBe(4);
      expect(firstGroup?.status).toBe('ready');
      expect(firstGroup?.files.map((f) => f.imageIndex)).toEqual([1, 2, 3, 4]);
    });

    it('should flag SKU with 3 images as missing_images and 5 images as excess_images', () => {
      const files = [
        { fileName: 'A01.jpg', originalName: 'A01.jpg' },
        { fileName: 'A01 2.jpg', originalName: 'A01 2.jpg' },
        { fileName: 'A01 3.jpg', originalName: 'A01 3.jpg' }, // 3 images

        { fileName: 'B02.jpg', originalName: 'B02.jpg' },
        { fileName: 'B02 2.jpg', originalName: 'B02 2.jpg' },
        { fileName: 'B02 3.jpg', originalName: 'B02 3.jpg' },
        { fileName: 'B02 4.jpg', originalName: 'B02 4.jpg' },
        { fileName: 'B02 5.jpg', originalName: 'B02 5.jpg' }, // 5 images
      ];

      const groups = service.groupMediaBySku(files, 4);
      expect(groups.get('A01')?.status).toBe('missing_images');
      expect(groups.get('B02')?.status).toBe('excess_images');
    });
  });

  describe('matchExcelWithSku', () => {
    it('should merge prices and flag SKUs without images or without Excel', () => {
      const files = [
        { fileName: 'GP1903382.jpg', originalName: 'GP1903382.jpg' },
        { fileName: 'GP1903382 2.jpg', originalName: 'GP1903382 2.jpg' },
        { fileName: 'GP1903382 3.jpg', originalName: 'GP1903382 3.jpg' },
        { fileName: 'GP1903382 4.jpg', originalName: 'GP1903382 4.jpg' },
        { fileName: 'ONLY_PHOTO.jpg', originalName: 'ONLY_PHOTO.jpg' },
      ];

      const groups = service.groupMediaBySku(files, 4);

      const excelRows = [
        { product_code: 'GP1903382', price: 149000 },
        { product_code: 'NO_PHOTO_SKU', price: 99000 },
      ];

      const merged = service.matchExcelWithSku(groups, excelRows, 4);

      const matched = merged.find((m) => m.productCode === 'GP1903382');
      expect(matched?.price).toBe(149000);
      expect(matched?.status).toBe('ready');
      expect(matched?.inExcel).toBe(true);

      const noPhoto = merged.find((m) => m.productCode === 'NO_PHOTO_SKU');
      expect(noPhoto?.status).toBe('no_images');
      expect(noPhoto?.imageCount).toBe(0);

      const onlyPhoto = merged.find((m) => m.productCode === 'ONLY_PHOTO');
      expect(onlyPhoto?.price).toBe(0);
      expect(onlyPhoto?.inExcel).toBe(false);
    });
  });

  describe('formatPrice and generateCaption', () => {
    it('should format prices correctly with units K, nghìn đồng, VNĐ', () => {
      expect(service.formatPrice(149000, 'K')).toBe('149');
      expect(service.formatPrice(149, 'K')).toBe('149');
      expect(service.formatPrice(149000, 'nghìn đồng')).toBe('149 nghìn đồng');
      expect(service.formatPrice(149000, 'VNĐ')).toContain('149');
      expect(service.formatPrice(0, 'K')).toBe('0');
    });

    it('should render template with dynamic variables and handle showCodeLine option', () => {
      const template = `MS {product_code}\n\n👉 Sale cực sốc chỉ còn {price}K\n👉 Số lượng chỉ còn vài chiếc!`;

      const captionWithCode = service.generateCaption(template, 'GP1903382', 149000, {
        unit: 'K',
        showCodeLine: true,
      });

      expect(captionWithCode).toContain('MS GP1903382');
      expect(captionWithCode).toContain('149K');

      const captionWithoutCode = service.generateCaption(template, 'GP1903382', 149000, {
        unit: 'K',
        showCodeLine: false,
      });

      expect(captionWithoutCode).not.toContain('MS GP1903382');
      expect(captionWithoutCode).toContain('149K');
    });
  });

  describe('generateSchedule', () => {
    it('should compute staggered schedules per Fanpage for 100 products', () => {
      const products = Array.from({ length: 100 }, (_, i) => ({
        productCode: `SP_${i + 1}`,
      }));
      const pages = ['PAGE_A', 'PAGE_B'];
      const startTime = new Date('2026-12-01T08:00:00Z');

      const tasks = service.generateSchedule(products, pages, {
        mode: 'scheduled',
        startAt: startTime,
        intervalMinutes: 15,
      });

      expect(tasks.length).toBe(200);

      const pageATasks = tasks.filter((t) => t.pageId === 'PAGE_A');
      expect(pageATasks.length).toBe(100);
      expect(pageATasks[0].scheduledAt.toISOString()).toBe('2026-12-01T08:00:00.000Z');
      expect(pageATasks[1].scheduledAt.toISOString()).toBe('2026-12-01T08:15:00.000Z');
      expect(pageATasks[2].scheduledAt.toISOString()).toBe('2026-12-01T08:30:00.000Z');
    });
  });
});

