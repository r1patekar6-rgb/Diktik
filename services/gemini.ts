import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";
import { ChatMessage, ModelId } from "../types";

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to format history for the API
const formatHistory = (messages: ChatMessage[]): Content[] => {
  return messages.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));
};

interface StreamOptions {
  model: ModelId;
  history: ChatMessage[];
  message: string;
  enableSearch: boolean;
  enableThinking: boolean;
  onChunk: (text: string) => void;
  onGrounding: (metadata: any) => void;
}

export const streamGeminiResponse = async ({
  model,
  history,
  message,
  enableSearch,
  enableThinking,
  onChunk,
  onGrounding,
}: StreamOptions) => {
  const ai = getClient();
  
  // Prepare contents: History + New Message
  const contents = [...formatHistory(history), { role: 'user', parts: [{ text: message }] }];

  const tools: any[] = [];
  if (enableSearch) {
    tools.push({ googleSearch: {} });
  }

  // Thinking config
  // The prompt states: 
  // - "The maximum thinking budget for 2.5 Pro is 32768, and for 2.5 Flash and Flash-Lite is 24576."
  // - "gemini-3-pro-preview" supports it.
  // - If disable thinking, set to 0.
  let thinkingConfig = undefined;
  if (enableThinking && model === ModelId.PRO) {
    thinkingConfig = { thinkingBudget: 16000 }; // Use a substantial budget for "Deep Reasoning"
  } else if (!enableThinking && model === ModelId.PRO) {
      // If user explicitly disabled thinking on Pro, we can set it to 0 or leave default (auto).
      // Let's leave default for balanced performance unless strictly "Fast" is needed.
      // But to differentiate "Reasoning Mode", we only set budget when enabled.
      thinkingConfig = { thinkingBudget: 0 };
  }

  try {
    const result = await ai.models.generateContentStream({
      model: model,
      contents: contents as any, // Cast to any to avoid strict type conflicts with helper
      config: {
        tools: tools.length > 0 ? tools : undefined,
        thinkingConfig: thinkingConfig,
      },
    });

    for await (const chunk of result) {
        // Safe cast as per guidelines
        const c = chunk as GenerateContentResponse;
        
        // Extract text
        const text = c.text;
        if (text) {
            onChunk(text);
        }

        // Extract grounding metadata if present
        // Note: groundingMetadata usually appears in the candidates of the final chunks or aggregated response.
        // In a stream, we should check each chunk's candidates.
        const metadata = c.candidates?.[0]?.groundingMetadata;
        if (metadata) {
            onGrounding(metadata);
        }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateTitle = async (firstMessage: string): Promise<string> => {
    try {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate a very short, concise title (max 5 words) for a chat that starts with: "${firstMessage}". Do not use quotes.`,
        });
        return response.text || "New Chat";
    } catch (e) {
        return "New Chat";
    }
}