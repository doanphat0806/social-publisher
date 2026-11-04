import { z } from 'zod';

export const presignMediaSchema = z.object({
  fileName: z.string().min(1, 'Tên file không được để trống'),
  mimeType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/i, 'Chỉ chấp nhận định dạng ảnh JPG, JPEG, PNG, WEBP'),
  fileSize: z.coerce.number().max(20 * 1024 * 1024, 'Dung lượng ảnh tối đa là 20MB'),
  checksum: z.string().min(1, 'Checksum không được để trống'),
  campaignId: z.string().optional(),
});

