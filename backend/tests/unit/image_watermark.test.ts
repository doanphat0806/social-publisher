import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { imageWatermarkService } from '../../src/services/imageWatermark.service.js';

describe('Sharp Image Watermark Engine Unit Tests', () => {
  // Create blank test buffers for testing
  const createTestImage = async (w: number, h: number, color = { r: 100, g: 150, b: 200 }) => {
    return await sharp({
      create: {
        width: w,
        height: h,
        channels: 3,
        background: color,
      },
    })
      .jpeg()
      .toBuffer();
  };

  it('Should correctly watermark Landscape image (1920x1080) preserving aspect ratio', async () => {
    const landscapeBuf = await createTestImage(1920, 1080);
    const result = await imageWatermarkService.applyWatermark(landscapeBuf, {
      text: 'XEKO XUKA 99K',
      position: 'bottom-right',
      fontSizePercent: 5,
      hasBackground: true,
      bgColor: '#000000',
      bgOpacity: 70,
      textColor: '#ffffff',
      outputFormat: 'jpeg',
    });

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);

    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1080);
    expect(meta.format).toBe('jpeg');
  });

  it('Should correctly watermark Portrait image (1080x1920)', async () => {
    const portraitBuf = await createTestImage(1080, 1920);
    const result = await imageWatermarkService.applyWatermark(portraitBuf, {
      text: 'PORTRAIT_SP001',
      position: 'top-left',
      fontSizePercent: 6,
      hasBackground: true,
      bgColor: '#1e1b4b',
      textColor: '#818cf8',
      outputFormat: 'png',
    });

    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
    expect(meta.format).toBe('png');
  });

  it('Should correctly watermark Square image (1000x1000)', async () => {
    const squareBuf = await createTestImage(1000, 1000);
    const result = await imageWatermarkService.applyWatermark(squareBuf, {
      text: 'SQUARE_99K',
      position: 'center',
      fontSizePercent: 8,
      rotation: -15,
      outputFormat: 'webp',
    });

    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(1000);
    expect(meta.height).toBe(1000);
    expect(meta.format).toBe('webp');
  });

  it('Should support Repeat / Tiled pattern watermark across whole image', async () => {
    const buf = await createTestImage(800, 600);
    const result = await imageWatermarkService.applyWatermark(buf, {
      text: 'BAN_QUYEN_XEKO',
      layoutMode: 'repeat',
      opacity: 30,
      textColor: '#ffffff',
      rotation: -30,
    });

    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
  });

  it('Should support 90-degree image rotation', async () => {
    const buf = await createTestImage(800, 600); // 800w x 600h
    const result = await imageWatermarkService.applyWatermark(buf, {
      text: 'ROTATED_TEST',
      rotateImageAngle: 90,
      position: 'bottom-right',
    });

    const meta = await sharp(result).metadata();
    // After 90 degree rotation, width becomes 600, height becomes 800
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(800);
  });
});

