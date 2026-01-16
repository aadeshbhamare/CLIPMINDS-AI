
export type MediaType = 'image' | 'video' | 'asset';
export type VisualEffect = 'none' | 'monochrome' | 'retro' | 'vibrant' | 'pop' | 'zoom' | 'blur' | 'glitch' | 'vintage' | 'elegant';
export type TextAnimationEffect = 'none' | 'reveal' | 'typewriter' | 'bounce' | 'flicker' | 'glitch' | 'wave' | 'zoom' | 'slide-left' | 'slide-right' | 'rotate';

export interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  name: string;
  duration: number;
  locked: boolean;
  order: number;
  base64?: string;
  
  // Advanced Editing Properties
  effect: VisualEffect;
  scaleMode: 'cover' | 'contain' | 'fill' | 'fit';
  
  // Overlay Text & Typography
  overlayText?: string;
  overlaySubtext?: string;
  overlayBgColor?: string;
  overlayTextColor?: string;
  overlaySubtextColor?: string;
  overlayX: number;
  overlayY: number;
  overlayTextSize?: number;
  fontFamily?: 'Inter' | 'Serif' | 'Monospace' | 'cursive' | 'Oswald' | 'Playfair Display';
  fontWeight?: number | string;
  letterSpacing?: string;
  textShadow?: string;
  
  overlayAnimation?: TextAnimationEffect;
  overlayAnimationSpeed?: number;
  
  // Neural Layer / Composite
  compositeImageUrl?: string;
  compositeX: number;
  compositeY: number;
  compositeScale: number;
}

export interface AudioTrack {
  id: string;
  url: string;
  name: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  timelineStart: number;
  order: number;
  isAI?: boolean;
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '21:9' | '3:4' | '2:3';
export type FitMode = 'cover' | 'contain' | 'fill' | 'fit';

export interface ProjectSettings {
  aspectRatio: AspectRatio;
  fitMode: FitMode;
  quality: 'hd' | 'standard';
}

export interface BeatMarker {
  time: number;
  intensity: number;
  effect: 'pop' | 'focus' | 'flash' | 'shake';
}

export interface InvitationDesign {
  headline: string;
  subheadline: string;
  bgUrl: string;
  bgColor: string;
  textColor: string;
  fontFamily: string;
}

export interface AISceneData {
  title: string;
  subtitle: string;
  bgUrl: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  letterSpacing: string;
  textColor: string;
}

export interface AlbumPageDesign {
  backgroundColor: string;
  accentColor: string;
  layoutStyle: 'minimal' | 'bold' | 'elegant' | 'journal';
  borderStyle: string;
  captionPlacement: 'top' | 'bottom' | 'side';
  decorativePrompt: string;
}
