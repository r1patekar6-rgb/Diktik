import React, { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { Send, Globe, BrainCircuit, Sparkles, Zap, ChevronDown, Paperclip, Mic, MicOff, X, FileText, Image as ImageIcon, Pencil } from 'lucide-react';
import { ModelId } from '../types';
import { ImageEditor } from './ImageEditor';

interface ComposerProps {
  onSend: (message: string, files: File[]) => void;
  isLoading: boolean;
  currentModel: ModelId;
  onModelChange: (model: ModelId) => void;
  enableSearch: boolean;
  onToggleSearch: (enabled: boolean) => void;
  enableThinking: boolean;
  onToggleThinking: (enabled: boolean) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  isLoading,
  currentModel,
  onModelChange,
  enableSearch,
  onToggleSearch,
  enableThinking,
  onToggleThinking,
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showModelMenu, setShowModelMenu] = useState(false);
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  // File Attachment State
  const [attachments, setAttachments] = useState<File[]>([]);
  const [editingAttachmentIndex, setEditingAttachmentIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep listening until stopped
        recognition.interimResults = true; // Process interim results for real-time feedback
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          let interim = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
             setInput(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + finalTranscript);
             setInterimTranscript('');
          } else {
             setInterimTranscript(interim);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript('');
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
          setInterimTranscript('');
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeAttachment = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveEditedImage = (newFile: File) => {
    if (editingAttachmentIndex === null) return;
    setAttachments(prev => {
        const newArr = [...prev];
        newArr[editingAttachmentIndex] = newFile;
        return newArr;
    });
    setEditingAttachmentIndex(null);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input, interimTranscript]);

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    onSend(input, attachments);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-800 bg-[#0d1117] p-4">
      {editingAttachmentIndex !== null && attachments[editingAttachmentIndex] && (
        <ImageEditor 
            file={attachments[editingAttachmentIndex]} 
            onSave={handleSaveEditedImage} 
            onCancel={() => setEditingAttachmentIndex(null)}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-3">
        
        {/* Controls Bar */}
        <div className="flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-2">
            
            {/* Model Selector Dropdown */}
            <div className="relative">
                <button 
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 border border-gray-700 transition-colors"
                >
                    {currentModel === ModelId.PRO ? (
                        <><BrainCircuit size={14} className="text-purple-400" /> DeepSeek (Pro)</>
                    ) : (
                        <><Zap size={14} className="text-yellow-400" /> Fast (Flash)</>
                    )}
                    <ChevronDown size={12} className="opacity-50" />
                </button>

                {showModelMenu && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowModelMenu(false)} />
                        <div className="absolute bottom-full mb-2 left-0 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-20">
                            <div className="p-1">
                                <button 
                                    onClick={() => { onModelChange(ModelId.FLASH); setShowModelMenu(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md ${currentModel === ModelId.FLASH ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
                                >
                                    <Zap size={14} className="text-yellow-400" />
                                    <div>
                                        <div className="font-medium">Flash Model</div>
                                        <div className="text-[10px] opacity-60">Fast, efficient</div>
                                    </div>
                                </button>
                                <button 
                                    onClick={() => { onModelChange(ModelId.PRO); setShowModelMenu(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md ${currentModel === ModelId.PRO ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
                                >
                                    <BrainCircuit size={14} className="text-purple-400" />
                                    <div>
                                        <div className="font-medium">Pro Model</div>
                                        <div className="text-[10px] opacity-60">Complex reasoning</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="h-4 w-px bg-gray-800 mx-1"></div>

            {/* Feature Toggles */}
            <button
                onClick={() => onToggleSearch(!enableSearch)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    enableSearch 
                    ? 'bg-blue-900/30 text-blue-400 border-blue-500/30' 
                    : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-800'
                }`}
            >
                <Globe size={14} />
                Search
            </button>
            
            {currentModel === ModelId.PRO && (
                <button
                    onClick={() => onToggleThinking(!enableThinking)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        enableThinking
                        ? 'bg-purple-900/30 text-purple-400 border-purple-500/30'
                        : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-800'
                    }`}
                    title="Enables extended thinking budget"
                >
                    <Sparkles size={14} />
                    Deep Think
                </button>
            )}
          </div>
        </div>

        {/* Input Field Area */}
        <div className={`relative bg-gray-800/50 border rounded-xl transition-all ${isListening ? 'border-red-500/50 ring-2 ring-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-gray-700 focus-within:ring-2 focus-within:ring-brand-500/50 focus-within:border-brand-500/50'}`}>
          
          {/* File Previews */}
          {attachments.length > 0 && (
            <div className="flex gap-2 p-3 pb-0 overflow-x-auto">
              {attachments.map((file, i) => (
                <div 
                    key={i} 
                    className="relative group flex-shrink-0 w-16 h-16 bg-gray-700 rounded-lg overflow-hidden border border-gray-600 cursor-pointer"
                    onClick={() => file.type.startsWith('image/') && setEditingAttachmentIndex(i)}
                >
                  {file.type.startsWith('image/') ? (
                    <>
                        <img 
                            src={URL.createObjectURL(file)} 
                            alt="preview" 
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                            onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors" />
                        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 flex items-end justify-center pb-1">
                            <Pencil size={12} className="text-white" />
                        </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                       <FileText size={20} />
                       <span className="text-[8px] px-1 truncate w-full text-center">{file.name.slice(-6)}</span>
                    </div>
                  )}
                  <button 
                    onClick={(e) => removeAttachment(e, i)} 
                    className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors z-10"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : (enableThinking && currentModel === ModelId.PRO ? "Ask a complex question..." : "Message AI Diktik...")}
            className="w-full bg-transparent text-gray-100 p-4 max-h-[200px] min-h-[52px] resize-none focus:outline-none text-sm md:text-base placeholder-gray-500"
            rows={1}
            disabled={isLoading}
          />

          {/* Voice Input Visualizer */}
          {isListening && (
            <div className="absolute top-3 right-16 flex items-center gap-2 bg-red-950/50 px-3 py-1 rounded-full border border-red-900/50 backdrop-blur-sm pointer-events-none">
                <div className="flex items-center gap-0.5 h-3">
                    <span className="w-0.5 bg-red-500 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-2"></span>
                    <span className="w-0.5 bg-red-500 rounded-full animate-[pulse_0.6s_ease-in-out_infinite_0.1s] h-4"></span>
                    <span className="w-0.5 bg-red-500 rounded-full animate-[pulse_0.6s_ease-in-out_infinite_0.2s] h-3"></span>
                    <span className="w-0.5 bg-red-500 rounded-full animate-[pulse_0.6s_ease-in-out_infinite_0.3s] h-2"></span>
                </div>
                <span className="text-xs font-medium text-red-200 whitespace-nowrap overflow-hidden max-w-[150px] text-ellipsis">
                    {interimTranscript || "Listening..."}
                </span>
            </div>
          )}
          
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            
            {/* Hidden File Inputs */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                multiple 
            />
            <input 
                type="file" 
                ref={imageInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                multiple 
                accept="image/*"
            />

            {/* Attachment Button */}
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors relative"
                title="Attach files"
            >
                <Paperclip size={18} />
                {attachments.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-brand-500 rounded-full border border-gray-800"></span>
                )}
            </button>

            {/* Image Button */}
            <button 
                onClick={() => imageInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors"
                title="Upload images"
            >
                <ImageIcon size={18} />
            </button>

            {/* Voice Input Button */}
            <button 
                onClick={toggleListening}
                className={`p-2 rounded-lg transition-all duration-200 ${
                    isListening 
                    ? 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                }`}
                title={isListening ? "Stop listening" : "Start voice input"}
            >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <button
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || isLoading}
              className={`p-2 rounded-lg transition-all duration-200 ${
                (input.trim() || attachments.length > 0) && !isLoading
                  ? 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-500/20'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        
        <div className="text-center">
            <p className="text-[10px] text-gray-600">
                AI can make mistakes. Check important info.
            </p>
        </div>
      </div>
    </div>
  );
};