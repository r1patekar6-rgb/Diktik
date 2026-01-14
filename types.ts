export enum ModelId {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview',
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  // Metadata for advanced features
  isReasoning?: boolean;
  groundingMetadata?: GroundingMetadata;
  // UI states
  isThinking?: boolean;
}

export interface GroundingMetadata {
  searchEntryPoint?: { renderedContent: string };
  groundingChunks?: GroundingChunk[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface AppState {
  currentModel: ModelId;
  enableSearch: boolean;
  enableThinking: boolean; // Triggers higher thinking budget on Pro
  sessions: ChatSession[];
  currentSessionId: string | null;
}