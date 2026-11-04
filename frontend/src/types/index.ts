export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
}

export interface FacebookPage {
  _id: string;
  pageId: string;
  pageName: string;
  pageCategory?: string;
  avatarUrl?: string;
  permissions: string[];
  status: 'active' | 'expired' | 'revoked' | 'permission_denied';
  lastSyncAt: string;
  createdAt: string;
}

export interface FacebookAccount {
  _id: string;
  facebookUserId: string;
  facebookName: string;
  status: 'active' | 'expired' | 'revoked';
  lastSyncAt: string;
}

export interface MediaAsset {
  _id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  storageUrl: string;
  checksum: string;
  width?: number;
  height?: number;
  status: 'pending' | 'ready' | 'failed';
  createdAt: string;
}

export interface CampaignStats {
  totalPosts: number;
  totalPublishes: number;
  successfulPublishes: number;
  failedPublishes: number;
  pendingPublishes: number;
  processingPublishes: number;
}

export interface Campaign {
  _id: string;
  name: string;
  description?: string;
  caption: string;
  totalImages: number;
  imagesPerPost: number;
  totalPosts: number;
  pageIds: string[];
  intervalMinutes: number;
  startAt: string;
  timezone: string;
  distributionMode: 'all_pages' | 'round_robin';
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  stats: CampaignStats;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  _id: string;
  campaignId: string;
  postNumber: number;
  caption: string;
  mediaIds: MediaAsset[];
  totalImages: number;
  status: string;
  tasks?: PublishTask[];
}

export interface PublishTask {
  _id: string;
  campaignId: { _id: string; name: string } | string;
  postId: { _id: string; postNumber: number; caption: string; totalImages: number } | string;
  pageId: string;
  facebookPageRef?: { _id: string; pageName: string; avatarUrl?: string };
  scheduledAt: string;
  status: 'pending' | 'queued' | 'processing' | 'success' | 'failed' | 'unknown' | 'cancelled' | 'paused';
  facebookPhotoIds: string[];
  facebookPostId?: string;
  facebookPostUrl?: string;
  attemptCount: number;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: string;
  publishedAt?: string;
  createdAt: string;
}

export interface DashboardOverview {
  totalFanpages: number;
  totalCampaigns: number;
  totalImages: number;
  totalPosts: number;
  totalPublishes: number;
  successfulPublishes: number;
  pendingPublishes: number;
  processingPublishes: number;
  failedPublishes: number;
}

