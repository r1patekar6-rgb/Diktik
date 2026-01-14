import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, MessageSquare, Menu, X, Trash2 } from 'lucide-react';
import { streamGeminiResponse, generateTitle } from './services/gemini';
import { ChatMessage, ChatSession, ModelId } from './types';
import { ChatMessages } from './components/ChatMessages';
import { Composer } from './components/Composer';

export default function App() {
  // Initialize sessions from localStorage if available
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem('chat_sessions');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error("Failed to load sessions", e);
        }
    }
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // Settings State
  const [currentModel, setCurrentModel] = useState<ModelId>(ModelId.FLASH);
  const [enableSearch, setEnableSearch] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Persistence Effect
  useEffect(() => {
    localStorage.setItem('chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Ensure there's always at least one session or select the most recent one on load
  useEffect(() => {
    if (sessions.length === 0) {
        createNewSession();
    } else if (!currentSessionId) {
        // If loaded from storage but no ID selected, select the first one (most recent usually if sorted)
        setCurrentSessionId(sessions[0].id);
    }
  }, [sessions.length]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now(),
    };
    // Add to top of list
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
        setCurrentSessionId(null); // Effect will pick next available or create new
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  const updateSessionMessages = (sessionId: string, newMessages: ChatMessage[]) => {
    setSessions(prev => prev.map(session => 
        session.id === sessionId 
            ? { ...session, messages: newMessages, updatedAt: Date.now() } 
            : session
    ));
  };

  const updateSessionTitle = (sessionId: string, title: string) => {
      setSessions(prev => prev.map(session => 
        session.id === sessionId ? { ...session, title } : session
      ));
  };

  const generateResponse = async (messages: ChatMessage[], newHistory: ChatMessage[], currentText: string) => {
    if (!currentSessionId) return;

    const botMsgId = uuidv4();
    const botPlaceholder: ChatMessage = {
      id: botMsgId,
      role: 'model',
      content: '', // Start empty
      timestamp: Date.now(),
      isThinking: true,
      isReasoning: currentModel === ModelId.PRO && enableThinking,
    };

    const updatedMessages = [...messages, botPlaceholder];
    updateSessionMessages(currentSessionId, updatedMessages);
    setIsLoading(true);

    try {
        let accumulatedText = '';
        let accumulatedMetadata: any = undefined;

        await streamGeminiResponse({
            model: currentModel,
            history: newHistory, // Pass history *before* the new exchange
            message: currentText,
            enableSearch,
            enableThinking,
            onChunk: (chunkText) => {
                accumulatedText += chunkText;
                setSessions(prev => {
                    const session = prev.find(s => s.id === currentSessionId);
                    if (!session) return prev;
                    
                    const newMsgs = session.messages.map(msg => 
                        msg.id === botMsgId 
                        ? { ...msg, content: accumulatedText, isThinking: false } 
                        : msg
                    );
                    return prev.map(s => s.id === currentSessionId ? { ...s, messages: newMsgs } : s);
                });
            },
            onGrounding: (metadata) => {
                accumulatedMetadata = metadata;
                setSessions(prev => {
                    const session = prev.find(s => s.id === currentSessionId);
                    if (!session) return prev;
                    
                    const newMsgs = session.messages.map(msg => 
                        msg.id === botMsgId 
                        ? { ...msg, groundingMetadata: metadata } 
                        : msg
                    );
                    return prev.map(s => s.id === currentSessionId ? { ...s, messages: newMsgs } : s);
                });
            }
        });

    } catch (error) {
        // Error handling: update bot message to show error
        setSessions(prev => {
            const session = prev.find(s => s.id === currentSessionId);
            if (!session) return prev;
            const newMsgs = session.messages.map(msg => 
                msg.id === botMsgId 
                ? { ...msg, content: "Sorry, I encountered an error processing your request. Please try again.", isThinking: false } 
                : msg
            );
            return prev.map(s => s.id === currentSessionId ? { ...s, messages: newMsgs } : s);
        });
    } finally {
        setIsLoading(false);
    }
  }

  const handleSendMessage = async (text: string, files: File[]) => {
    if (!currentSession) return;

    // Note: For full multimodal support, we would need to upload/convert files here 
    // and pass them to the service. For now, we update the signature to support the UI.
    const hasAttachments = files.length > 0;
    const displayContent = hasAttachments 
        ? `${text}\n\n[Attached ${files.length} file(s)]` 
        : text;

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: displayContent,
      timestamp: Date.now(),
    };

    // If first message, generate title
    if (currentSession.messages.length === 0) {
        generateTitle(text || "Attachment").then(title => updateSessionTitle(currentSession.id, title));
    }

    const newHistory = currentSession.messages;
    const messagesWithUser = [...currentSession.messages, userMsg];
    
    // Call unified generation function
    // We pass:
    // 1. messagesWithUser: The UI state including the user's new message (to show immediately)
    // 2. newHistory: The context sent to API (which is just the previous history, as the function appends 'message' itself to context)
    // 3. text: The current prompt
    await generateResponse(messagesWithUser, newHistory, displayContent);
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
      if (!currentSession) return;

      // Find index of the message to edit
      const msgIndex = currentSession.messages.findIndex(m => m.id === messageId);
      if (msgIndex === -1) return;

      // Keep messages strictly BEFORE this message
      const historyBeforeEdit = currentSession.messages.slice(0, msgIndex);
      
      // Create the updated message
      const updatedMsg: ChatMessage = {
          ...currentSession.messages[msgIndex],
          content: newContent,
          timestamp: Date.now(), // Update timestamp? Maybe keep original? Let's update to indicate change.
      };

      // New UI state: History + Updated Message. (Discarding everything after)
      const messagesWithUpdated = [...historyBeforeEdit, updatedMsg];

      // Trigger generation
      await generateResponse(messagesWithUpdated, historyBeforeEdit, newContent);
  };

  // Sort sessions by updatedAt descending
  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex h-screen bg-[#0d1117] text-gray-100 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div 
        className={`${
          isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'
        } bg-[#161b22] border-r border-gray-800 transition-all duration-300 ease-in-out flex flex-col absolute md:relative z-20 h-full`}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h1 className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">AI Diktik</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400">
                <X size={20} />
            </button>
        </div>

        <div className="p-3">
            <button 
                onClick={createNewSession}
                className="w-full flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white py-2.5 px-4 rounded-lg transition-colors shadow-sm font-medium text-sm"
            >
                <Plus size={16} />
                New Chat
            </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            <div className="text-xs font-semibold text-gray-500 px-2 py-2 uppercase tracking-wider">Recent</div>
            {sortedSessions.map(session => (
                <div
                    key={session.id}
                    onClick={() => {
                        setCurrentSessionId(session.id);
                        if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                        currentSessionId === session.id 
                        ? 'bg-gray-800 text-white' 
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                    }`}
                >
                    <MessageSquare size={16} className={currentSessionId === session.id ? 'text-brand-400' : 'opacity-50'} />
                    <span className="truncate flex-1">{session.title}</span>
                    
                    {/* Delete button (only shows on hover or active) */}
                    <button 
                        onClick={(e) => deleteSession(e, session.id)}
                        className={`p-1 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity ${currentSessionId === session.id ? 'opacity-100' : ''}`}
                        title="Delete chat"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
        </div>

        <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
            Powered by Gemini 2.0
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Mobile Header */}
        <div className="h-14 border-b border-gray-800 flex items-center px-4 md:hidden bg-[#0d1117]/80 backdrop-blur">
            <button onClick={() => setIsSidebarOpen(true)} className="text-gray-400 mr-4">
                <Menu size={20} />
            </button>
            <span className="font-semibold text-gray-200 truncate">{currentSession?.title}</span>
        </div>

        <ChatMessages 
            messages={currentSession?.messages || []} 
            isStreaming={isLoading}
            onEditMessage={handleEditMessage}
        />

        <Composer 
            onSend={handleSendMessage} 
            isLoading={isLoading}
            currentModel={currentModel}
            onModelChange={setCurrentModel}
            enableSearch={enableSearch}
            onToggleSearch={setEnableSearch}
            enableThinking={enableThinking}
            onToggleThinking={setEnableThinking}
        />
      </div>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-10 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}