import React from 'react';
import { MessageSquare, Image, Mic, Search, Edit3 } from 'lucide-react';
import Chat from './features/Chat';
import ImageGeneration from './features/ImageGeneration';
import ImageEditing from './features/ImageEditing';
import LiveConversation from './features/LiveConversation';
import GroundedSearch from './features/GroundedSearch';
import type { Tool } from './types';

export const TOOLS: Tool[] = [
  { id: 'chat', name: 'Chat IA', icon: MessageSquare, component: Chat },
  { id: 'image_generation', name: "Génération d'Image", icon: Image, component: ImageGeneration },
  { id: 'image_editing', name: "Édition d'Image", icon: Edit3, component: ImageEditing },
  { id: 'live_conversation', name: 'Conversation en Direct', icon: Mic, component: LiveConversation },
  { id: 'grounded_search', name: 'Recherche Avancée', icon: Search, component: GroundedSearch },
];