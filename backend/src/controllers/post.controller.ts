import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Post, Campaign, PublishTask, MediaAsset } from '../models/index.js';

export class PostController {
  /**
   * GET /campaigns/:id/posts
   */
  async getCampaignPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaign = await Campaign.findOne({ _id: req.params.id, userId });
      if (!campaign) {
        res.status(404).json({ success: false, message: 'Chiến dịch không tồn tại' });
        return;
      }

      const posts = await Post.find({ campaignId: campaign._id })
        .populate('mediaIds')
        .sort({ postNumber: 1 });

      // Fetch all tasks for this campaign to attach per-post status
      const tasks = await PublishTask.find({ campaignId: campaign._id });

      const postsWithTasks = posts.map(post => {
        const postTasks = tasks.filter(t => t.postId.toString() === post._id.toString());
        return {
          ...post.toObject(),
          tasks: postTasks,
        };
      });

      res.json({ success: true, data: { posts: postsWithTasks } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /posts/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await Post.findById(req.params.id).populate('mediaIds');
      if (!post) {
        res.status(404).json({ success: false, message: 'Bài viết không tồn tại' });
        return;
      }

      const tasks = await PublishTask.find({ postId: post._id });
      res.json({ success: true, data: { post, tasks } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /posts/:id/caption
   */
  async updateCaption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { caption } = req.body;
      const post = await Post.findById(req.params.id);
      if (!post) {
        res.status(404).json({ success: false, message: 'Bài viết không tồn tại' });
        return;
      }

      post.caption = caption;
      await post.save();

      res.json({ success: true, message: 'Cập nhật caption bài viết thành công', data: { post } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /posts/:id/images
   */
  async updateImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mediaIds } = req.body;
      if (!Array.isArray(mediaIds)) {
        res.status(400).json({ success: false, message: 'mediaIds phải là một mảng' });
        return;
      }

      const post = await Post.findById(req.params.id);
      if (!post) {
        res.status(404).json({ success: false, message: 'Bài viết không tồn tại' });
        return;
      }

      post.mediaIds = mediaIds.map(id => new Types.ObjectId(id));
      post.totalImages = mediaIds.length;
      await post.save();

      res.json({ success: true, message: 'Cập nhật danh sách ảnh bài viết thành công', data: { post } });
    } catch (error) {
      next(error);
    }
  }
}

export const postController = new PostController();

