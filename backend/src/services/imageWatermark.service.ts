import sharp from 'sharp';
import { logger } from '../utils/logger.js';

export interface WatermarkOptions {
  text: string;
  textColor?: string;
  fontSizePercent?: number; // 1 - 25% of min(width, height)
  fontStyle?: 'normal' | 'bold' | 'italic' | 'bold italic';
  hasBackground?: boolean;
  bgColor?: string;
  bgOpacity?: number; // 0 - 100
  padding?: number; // padding around text
  borderRadius?: number;
  opacity?: number; // 0 - 100
  rotation?: number; // -180 to 180
  layoutMode?: 'single' | 'repeat';
  position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'middle-left'
    | 'center'
    | 'middle-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
    | 'custom';
  customX?: number; // 0 - 100 %
  customY?: number; // 0 - 100 %
  offsetX?: number; // margin % from edge
  offsetY?: number; // margin % from edge
  rotateImageAngle?: number; // 0, 90, 180, 270
  outputFormat?: 'jpeg' | 'png' | 'webp';
  outputQuality?: number;
}

export class ImageWatermarkService {
  /**
   * Applies watermark to image buffer and outputs processed buffer
   */
  async applyWatermark(inputBuffer: Buffer, options: WatermarkOptions): Promise<Buffer> {
    try {
      let workingBuffer = inputBuffer;

      // Rotate image if requested
      if (options.rotateImageAngle && options.rotateImageAngle % 360 !== 0) {
        workingBuffer = await sharp(inputBuffer).rotate(options.rotateImageAngle).toBuffer();
      } else {
        // Auto-orient based on EXIF
        workingBuffer = await sharp(inputBuffer).rotate().toBuffer();
      }

      let pipeline = sharp(workingBuffer);
      const metadata = await pipeline.metadata();
      const width = metadata.width || 1200;
      const height = metadata.height || 800;

      const svgOverlay = this.generateSvgOverlay(width, height, options);

      // Composite SVG overlay onto image
      pipeline = pipeline.composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0,
        },
      ]);

      // Output formatting
      const format = options.outputFormat || 'jpeg';
      const quality = options.outputQuality || 90;

      if (format === 'png') {
        pipeline = pipeline.png({ compressionLevel: 8 });
      } else if (format === 'webp') {
        pipeline = pipeline.webp({ quality });
      } else {
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      }

      return await pipeline.toBuffer();
    } catch (error: any) {
      logger.error('Error applying watermark:', error);
      throw new Error(`Lỗi đóng dấu ảnh: ${error.message}`);
    }
  }

  /**
   * Generates SVG overlay matching the dimensions and options
   */
  private generateSvgOverlay(width: number, height: number, options: WatermarkOptions): string {
    const text = (options.text || 'XEKO XUKA')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const minDim = Math.min(width, height);
    const fontSizePercent = Math.max(1, Math.min(30, options.fontSizePercent || 5));
    const fontSize = Math.max(12, Math.round((minDim * fontSizePercent) / 100));

    const textColor = options.textColor || '#ffffff';
    const hasBg = options.hasBackground !== false;
    const bgColor = options.bgColor || '#000000';
    const bgOpacity = ((options.bgOpacity ?? 60) / 100).toFixed(2);
    const totalOpacity = ((options.opacity ?? 90) / 100).toFixed(2);
    const rotation = options.rotation || 0;
    const padding = Math.max(4, Math.round((fontSize * (options.padding || 12)) / 24));
    const radius = Math.max(2, Math.round((fontSize * (options.borderRadius || 8)) / 24));

    const isBold = options.fontStyle?.includes('bold');
    const isItalic = options.fontStyle?.includes('italic');
    const fontWeight = isBold ? 'bold' : 'normal';
    const fontStyle = isItalic ? 'italic' : 'normal';

    // Approximate text dimensions
    const approxCharWidth = fontSize * 0.6;
    const textWidth = Math.round(text.length * approxCharWidth);
    const textHeight = Math.round(fontSize * 1.2);
    const boxWidth = textWidth + padding * 2;
    const boxHeight = textHeight + padding * 2;

    if (options.layoutMode === 'repeat') {
      // Tiled Pattern Repeat
      const stepX = Math.round(minDim * 0.35);
      const stepY = Math.round(minDim * 0.25);
      const rot = rotation || -30;

      let items = '';
      for (let y = -stepY; y < height + stepY * 2; y += stepY) {
        for (let x = -stepX; x < width + stepX * 2; x += stepX) {
          items += `
            <g transform="translate(${x}, ${y}) rotate(${rot})">
              ${hasBg ? `<rect x="${-boxWidth / 2}" y="${-boxHeight / 2}" width="${boxWidth}" height="${boxHeight}" rx="${radius}" ry="${radius}" fill="${bgColor}" fill-opacity="${bgOpacity}" />` : ''}
              <text x="0" y="${fontSize * 0.38}" font-family="Plus Jakarta Sans, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" fill="${textColor}" text-anchor="middle">${text}</text>
            </g>
          `;
        }
      }

      return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" opacity="${totalOpacity}">
          ${items}
        </svg>
      `;
    }

    // Single Position Mode
    const marginX = Math.round((width * (options.offsetX ?? 4)) / 100);
    const marginY = Math.round((height * (options.offsetY ?? 4)) / 100);

    let posX = width - boxWidth / 2 - marginX;
    let posY = height - boxHeight / 2 - marginY;

    if (options.position === 'custom' && options.customX !== undefined && options.customY !== undefined) {
      posX = Math.round((width * options.customX) / 100);
      posY = Math.round((height * options.customY) / 100);
    } else {
      switch (options.position) {
        case 'top-left':
          posX = marginX + boxWidth / 2;
          posY = marginY + boxHeight / 2;
          break;
        case 'top-center':
          posX = Math.round(width / 2);
          posY = marginY + boxHeight / 2;
          break;
        case 'top-right':
          posX = width - marginX - boxWidth / 2;
          posY = marginY + boxHeight / 2;
          break;
        case 'middle-left':
          posX = marginX + boxWidth / 2;
          posY = Math.round(height / 2);
          break;
        case 'center':
          posX = Math.round(width / 2);
          posY = Math.round(height / 2);
          break;
        case 'middle-right':
          posX = width - marginX - boxWidth / 2;
          posY = Math.round(height / 2);
          break;
        case 'bottom-left':
          posX = marginX + boxWidth / 2;
          posY = height - marginY - boxHeight / 2;
          break;
        case 'bottom-center':
          posX = Math.round(width / 2);
          posY = height - marginY - boxHeight / 2;
          break;
        case 'bottom-right':
        default:
          posX = width - marginX - boxWidth / 2;
          posY = height - marginY - boxHeight / 2;
          break;
      }
    }

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" opacity="${totalOpacity}">
        <g transform="translate(${posX}, ${posY}) rotate(${rotation})">
          ${hasBg ? `<rect x="${-boxWidth / 2}" y="${-boxHeight / 2}" width="${boxWidth}" height="${boxHeight}" rx="${radius}" ry="${radius}" fill="${bgColor}" fill-opacity="${bgOpacity}" />` : ''}
          <text x="0" y="${fontSize * 0.38}" font-family="Plus Jakarta Sans, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" fill="${textColor}" text-anchor="middle">${text}</text>
        </g>
      </svg>
    `;
  }
}

export const imageWatermarkService = new ImageWatermarkService();
