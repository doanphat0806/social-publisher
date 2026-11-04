import { create } from 'zustand';
import { MediaAsset } from '../types/index.js';

export interface CampaignWizardData {
  // Step 1: Info
  name: string;
  description: string;
  startDate: string;
  startTime: string;
  timezone: string;

  // Step 2: Uploaded Media
  mediaAssets: MediaAsset[];

  // Step 3: Grouping
  imagesPerPost: number;

  // Step 4: Caption
  caption: string;
  customCaptions: Record<number, string>; // postIndex -> custom caption

  // Step 5: Fanpages
  selectedPageIds: string[];

  // Step 6: Schedule
  intervalMinutes: number;

  // Wizard state
  currentStep: number;
}

interface CampaignWizardStore extends CampaignWizardData {
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateData: (data: Partial<CampaignWizardData>) => void;
  addMediaAsset: (asset: MediaAsset) => void;
  removeMediaAsset: (assetId: string) => void;
  setMediaAssets: (assets: MediaAsset[]) => void;
  togglePageSelection: (pageId: string) => void;
  selectAllPages: (pageIds: string[]) => void;
  clearSelectedPages: () => void;
  resetWizard: () => void;
}

const initialDate = new Date().toISOString().slice(0, 10);
const initialTime = new Date(Date.now() + 15 * 60 * 1000).toTimeString().slice(0, 5);

const initialState: CampaignWizardData = {
  name: '',
  description: '',
  startDate: initialDate,
  startTime: initialTime,
  timezone: 'Asia/Ho_Chi_Minh',
  mediaAssets: [],
  imagesPerPost: 10,
  caption: '',
  customCaptions: {},
  selectedPageIds: [],
  intervalMinutes: 15,
  currentStep: 1,
};

export const useCampaignWizardStore = create<CampaignWizardStore>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 7) })),
  prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),

  updateData: (data) => set((state) => ({ ...state, ...data })),

  addMediaAsset: (asset) =>
    set((state) => ({
      mediaAssets: [...state.mediaAssets, asset],
    })),

  removeMediaAsset: (assetId) =>
    set((state) => ({
      mediaAssets: state.mediaAssets.filter((a) => a._id !== assetId),
    })),

  setMediaAssets: (assets) => set({ mediaAssets: assets }),

  togglePageSelection: (pageId) =>
    set((state) => {
      const exists = state.selectedPageIds.includes(pageId);
      return {
        selectedPageIds: exists
          ? state.selectedPageIds.filter((id) => id !== pageId)
          : [...state.selectedPageIds, pageId],
      };
    }),

  selectAllPages: (pageIds) => set({ selectedPageIds: pageIds }),
  clearSelectedPages: () => set({ selectedPageIds: [] }),

  resetWizard: () => set({ ...initialState }),
}));

