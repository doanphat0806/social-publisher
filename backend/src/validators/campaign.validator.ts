import { z } from 'zod';

export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Tên chiến dịch không được để trống'),
  description: z.string().optional(),
  caption: z.string().default(''),
  imagesPerPost: z.coerce.number().min(1, 'Số ảnh mỗi bài tối thiểu là 1').max(100, 'Số ảnh mỗi bài tối đa là 100').default(10),
  pageIds: z.array(z.string()).min(1, 'Phải chọn ít nhất 1 Fanpage'),
  intervalMinutes: z.coerce.number().min(1, 'Khoảng cách tối thiểu là 1 phút').default(15),
  startAt: z.string().or(z.date()).transform((val) => new Date(val)),
  timezone: z.string().default('Asia/Ho_Chi_Minh'),
  distributionMode: z.enum(['all_pages', 'round_robin']).default('all_pages'),
  mediaIds: z.array(z.string()).default([]),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const previewCampaignSchema = z.object({
  totalImages: z.coerce.number().min(1, 'Số lượng ảnh phải lớn hơn 0'),
  imagesPerPost: z.coerce.number().min(1, 'Số ảnh mỗi bài tối thiểu là 1'),
  pageIds: z.array(z.string()).min(1, 'Phải chọn ít nhất 1 Fanpage'),
  intervalMinutes: z.coerce.number().min(1, 'Khoảng cách tối thiểu là 1 phút'),
  startAt: z.string().or(z.date()).transform((val) => new Date(val)),
  timezone: z.string().default('Asia/Ho_Chi_Minh'),
});

