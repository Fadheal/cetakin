export type Step = 'personal' | 'files' | 'settings' | 'review' | 'confirmation';

export interface PersonalInfo {
  name: string;
  phone: string;
  address: string;
  deliveryTime: string;
}

export interface PrintSettings {
  mode: 'quick' | 'advanced';
  color: 'color' | 'bw';
  sidedness: 'single' | 'double';
  copies: number;
  quality: 'standard' | 'high';
  paperType: 'normal' | 'glossy' | 'cardstock';
  paperWeight?: string;
  cutting?: string;
  layout?: string;
  binding: 'none' | 'staple' | 'ring' | 'softbound';
  notes: string;
}

export interface FileInfo {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  pages: number;
}
