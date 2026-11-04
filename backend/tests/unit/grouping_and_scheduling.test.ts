import { describe, it, expect } from 'vitest';
import { CampaignService } from '../../src/services/campaign.service.js';

describe('Campaign Grouping & Multi-Page Scheduling Algorithm', () => {
  const campaignService = new CampaignService();

  it('Case 2: Should divide 100 images into exactly 10 posts with 10 images each', async () => {
    const totalImages = 100;
    const imagesPerPost = 10;
    const startAt = new Date('2026-11-04T08:00:00Z');
    const pageIds = ['page_A'];

    const preview = await campaignService.generatePreview({
      totalImages,
      imagesPerPost,
      pageIds,
      intervalMinutes: 15,
      startAt,
    });

    expect(preview.totalPosts).toBe(10);
    expect(preview.posts.length).toBe(10);
    preview.posts.forEach((post) => {
      expect(post.imageCount).toBe(10);
    });
  });

  it('Case 3: Should divide 105 images into 11 posts, with the last post having 5 images', async () => {
    const totalImages = 105;
    const imagesPerPost = 10;
    const startAt = new Date('2026-11-04T08:00:00Z');
    const pageIds = ['page_A'];

    const preview = await campaignService.generatePreview({
      totalImages,
      imagesPerPost,
      pageIds,
      intervalMinutes: 15,
      startAt,
    });

    expect(preview.totalPosts).toBe(11);
    expect(preview.posts.length).toBe(11);

    // First 10 posts should have 10 images
    for (let i = 0; i < 10; i++) {
      expect(preview.posts[i].imageCount).toBe(10);
    }
    // 11th post should have remainder 5 images
    expect(preview.posts[10].imageCount).toBe(5);
  });

  it('Case 4: Should support custom images per post (e.g., 7 images per post for 50 images)', async () => {
    const totalImages = 50;
    const imagesPerPost = 7;
    const startAt = new Date('2026-11-04T08:00:00Z');
    const pageIds = ['page_A'];

    const preview = await campaignService.generatePreview({
      totalImages,
      imagesPerPost,
      pageIds,
      intervalMinutes: 15,
      startAt,
    });

    expect(preview.totalPosts).toBe(8); // Math.ceil(50/7) = 8
    expect(preview.posts[0].imageCount).toBe(7);
    expect(preview.posts[7].imageCount).toBe(1); // 7*7 = 49, remainder = 1
  });

  it('Case 5, 6, 7: Should select 3 Fanpages and generate 30 PublishTasks with independent schedules', async () => {
    const totalImages = 100;
    const imagesPerPost = 10; // 10 posts
    const pageIds = ['page_A', 'page_B', 'page_C']; // 3 fanpages
    const startAt = new Date('2026-11-04T08:00:00Z');
    const intervalMinutes = 15;

    const preview = await campaignService.generatePreview({
      totalImages,
      imagesPerPost,
      pageIds,
      intervalMinutes,
      startAt,
    });

    expect(preview.totalPosts).toBe(10);
    expect(preview.pageCount).toBe(3);
    expect(preview.totalPublishes).toBe(30); // 10 posts * 3 pages = 30 tasks

    // Check independent schedules per fanpage
    preview.posts.forEach((post, postIndex) => {
      expect(post.schedules.length).toBe(3);

      const expectedTimeMs = startAt.getTime() + postIndex * intervalMinutes * 60 * 1000;
      const expectedDate = new Date(expectedTimeMs);

      post.schedules.forEach((schedule) => {
        expect(schedule.scheduledAt.getTime()).toBe(expectedDate.getTime());
      });
    });

    // Check Post #1 is at 08:00, Post #2 is at 08:15, Post #3 is at 08:30
    expect(preview.posts[0].schedules[0].scheduledAt.toISOString()).toBe('2026-11-04T08:00:00.000Z');
    expect(preview.posts[1].schedules[0].scheduledAt.toISOString()).toBe('2026-11-04T08:15:00.000Z');
    expect(preview.posts[2].schedules[0].scheduledAt.toISOString()).toBe('2026-11-04T08:30:00.000Z');
  });
});

