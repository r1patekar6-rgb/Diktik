import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, GroundingChunk } from '../types';
import { Bot, User, BrainCircuit, Globe, Copy, Check, Pencil, X, Send } from 'lucide-react';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onEditMessage?: (messageId: string, newContent: string) => void;
}

const CodeBlock = ({ children, className }: any) => {
    const [copied, setCopied] = React.useState(false);

    // Extract text content safely for copying
    const getTextContent = () => {
        if (typeof children === 'string') return children;
        if (Array.isArray(children)) {
            return children.map((c: any) => typeof c === 'string' ? c : '').join('');
        }
        return String(children || '');
    };

    const handleCopy = () => {
        const text = getTextContent();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Simple language extraction from className "language-js" -> "js"
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : 'text';

    return (
        <div className="relative group my-4 rounded-lg overflow-hidden border border-gray-700 bg-[#1e1e1e]">
            <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] text-xs text-gray-400 border-b border-gray-700/50 select-none">
                <span className="font-mono text-gray-500">{lang}</span>
                <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none"
                    title="Copy code"
                >
                    {copied ? (
                        <>
                            <Check size={14} className="text-green-500" />
                            <span className="text-green-500 font-medium">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={14} />
                            <span>Copy Code</span>
                        </>
                    )}
                </button>
            </div>
            <div className="p-4 overflow-x-auto text-sm font-mono leading-relaxed text-gray-200">
                <code className={className}>{children}</code>
            </div>
        </div>
    );
};

const GroundingSources = ({ chunks }: { chunks: GroundingChunk[] }) => {
    if (!chunks || chunks.length === 0) return null;

    // Deduplicate URIs
    const uniqueChunks = chunks.filter((chunk, index, self) =>
        index === self.findIndex((c) => (
            c.web?.uri === chunk.web?.uri
        ))
    );

    return (
        <div className="mt-4 pt-3 border-t border-gray-700/50">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Globe size={12} />
                Sources
            </h4>
            <div className="flex flex-wrap gap-2">
                {uniqueChunks.map((chunk, i) => (
                    chunk.web && (
                        <a 
                            key={i} 
                            href={chunk.web.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs bg-gray-800 hover:bg-gray-700 text-blue-400 border border-gray-700 px-2 py-1 rounded-full transition-colors truncate max-w-[200px]"
                        >
                            {chunk.web.title || new URL(chunk.web.uri).hostname}
                        </a>
                    )
                ))}
            </div>
        </div>
    );
};

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, isStreaming, onEditMessage }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messages.length > 0 ? messages[messages.length - 1].content : null]);

  const startEditing = (msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = (msgId: string) => {
    if (onEditMessage && editContent.trim() !== '') {
        onEditMessage(msgId, editContent);
        setEditingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 md:p-8 scroll-smooth">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
                <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
                    <BrainCircuit size={32} className="text-brand-500" />
                </div>
                <p className="text-lg font-medium">Ready to think.</p>
            </div>
        )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-4 max-w-4xl mx-auto group ${
            msg.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          {msg.role === 'model' && (
            <div className="w-8 h-8 rounded-full bg-brand-600/20 flex-shrink-0 flex items-center justify-center border border-brand-500/30 text-brand-400 mt-1">
              <Bot size={18} />
            </div>
          )}

          <div
            className={`flex-1 max-w-[85%] min-w-0 ${
              msg.role === 'user' ? 'flex justify-end' : ''
            }`}
          >
            <div
              className={`relative px-5 py-3.5 rounded-2xl text-sm md:text-base leading-7 ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-tr-sm'
                  : 'bg-transparent text-gray-200 pl-0'
              } ${editingId === msg.id ? 'w-full' : ''}`}
            >
                {/* Reasoning Indicator */}
                {msg.isReasoning && msg.role === 'model' && (
                    <div className="mb-3 text-xs text-brand-400 flex items-center gap-2 bg-brand-900/20 w-fit px-2 py-1 rounded border border-brand-500/20">
                        <BrainCircuit size={12} />
                        <span>Reasoning Model</span>
                    </div>
                )}

                {/* Edit Mode */}
                {editingId === msg.id ? (
                    <div className="w-full bg-[#1e1e1e] p-3 rounded-lg border border-gray-600">
                        <textarea 
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-transparent text-gray-200 outline-none resize-none min-h-[80px]"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button 
                                onClick={cancelEditing}
                                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => saveEdit(msg.id)}
                                className="px-3 py-1 text-xs bg-brand-600 hover:bg-brand-500 rounded text-white transition-colors"
                            >
                                Save & Submit
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Content Rendering */}
                        {msg.role === 'user' ? (
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                        ) : (
                            <div className="markdown-body">
                                {/* Loading/Thinking State for Model */}
                                {msg.content === '' && msg.isThinking ? (
                                    <div className="flex items-center gap-2 text-gray-400 italic">
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                                        <span className="text-sm">Thinking...</span>
                                    </div>
                                ) : (
                                    <ReactMarkdown
                                        components={{
                                            code: ({node, inline, className, children, ...props}: any) => {
                                                const match = /language-(\w+)/.exec(className || '')
                                                // Ensure CodeBlock is used for all block-level code (not inline)
                                                // 'inline' prop is passed by react-markdown
                                                if (!inline) {
                                                    return (
                                                        <CodeBlock className={className} {...props}>
                                                            {children}
                                                        </CodeBlock>
                                                    );
                                                }
                                                return (
                                                    <code className="bg-gray-800 text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                                        {children}
                                                    </code>
                                                )
                                            }
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                )}
                                
                                {/* Grounding Sources */}
                                {msg.groundingMetadata?.groundingChunks && (
                                    <GroundingSources chunks={msg.groundingMetadata.groundingChunks} />
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            
            {/* Edit Button for User Messages */}
            {msg.role === 'user' && !editingId && !isStreaming && onEditMessage && (
                <button 
                    onClick={() => startEditing(msg)}
                    className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all"
                    title="Edit message"
                >
                    <Pencil size={14} />
                </button>
            )}
          </div>

          {msg.role === 'user' && (
            <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center mt-1">
              <User size={18} className="text-gray-300" />
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} className="h-4" />
    </div>
  );
};