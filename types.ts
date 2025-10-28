import type { LucideIcon } from 'lucide-react';
import type React from 'react';

export type ToolId = 'chat' | 'image_generation' | 'image_editing' | 'live_conversation' | 'grounded_search';

export interface Tool {
  id: ToolId;
  name: string;
  icon: LucideIcon;
  component: React.FC;
}

export type Theme = 'light' | 'dark';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // base64 string
  sources?: GroundingSource[];
}

export interface GroundingSource {
    uri: string;
    title: string;
}