import React, { useState, useRef, useEffect } from 'react';
import { X, Check, RotateCw, Crop, Sliders, Sun, Contrast, Undo2, Redo2 } from 'lucide-react';

interface ImageEditorProps {
  file: File;
  onSave: (file: File) => void;
  onCancel: () => void;
}

type AspectRatio = 'original' | '1:1' | '16:9' | '4:3';

interface EditorState {
    rotation: number;
    brightness: number;
    contrast: number;
    aspectRatio: AspectRatio;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ file, onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  
  // Current Visual State
  const [rotation, setRotation] = useState(0); 
  const [brightness, setBrightness] = useState(100); 
  const [contrast, setContrast] = useState(100); 
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('original');
  const [activeTab, setActiveTab] = useState<'crop' | 'adjust'>('crop');

  // History State
  const [history, setHistory] = useState<EditorState[]>([
    { rotation: 0, brightness: 100, contrast: 100, aspectRatio: 'original' }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Load image
  useEffect(() => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    img.onload = () => setImage(img);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Push state to history
  const pushToHistory = (newState: EditorState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        const state = history[newIndex];
        setRotation(state.rotation);
        setBrightness(state.brightness);
        setContrast(state.contrast);
        setAspectRatio(state.aspectRatio);
        setHistoryIndex(newIndex);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        const state = history[newIndex];
        setRotation(state.rotation);
        setBrightness(state.brightness);
        setContrast(state.contrast);
        setAspectRatio(state.aspectRatio);
        setHistoryIndex(newIndex);
    }
  };

  // Draw canvas
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Calculate dimensions based on rotation
    const isRotated90 = rotation % 180 !== 0;
    const srcWidth = isRotated90 ? image.height : image.width;
    const srcHeight = isRotated90 ? image.width : image.height;

    // 2. Determine Crop Dimensions (Center Crop)
    let cropWidth = srcWidth;
    let cropHeight = srcHeight;

    if (aspectRatio !== 'original') {
        const [wRatio, hRatio] = aspectRatio.split(':').map(Number);
        const targetRatio = wRatio / hRatio;
        const currentRatio = srcWidth / srcHeight;

        if (currentRatio > targetRatio) {
            // Source is wider than target: Crop width
            cropWidth = srcHeight * targetRatio;
        } else {
            // Source is taller than target: Crop height
            cropHeight = srcWidth / targetRatio;
        }
    }

    // 3. Set Canvas Size (Display size)
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // 4. Drawing
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    
    // Move to center of canvas
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    // Rotate
    ctx.rotate((rotation * Math.PI) / 180);

    // Draw Image centered
    ctx.drawImage(
        image, 
        -image.width / 2, 
        -image.height / 2
    );

  }, [image, rotation, brightness, contrast, aspectRatio]);

  const handleSave = () => {
    if (!canvasRef.current) return;
    
    canvasRef.current.toBlob((blob) => {
        if (blob) {
            const newFile = new File([blob], file.name, { type: file.type, lastModified: Date.now() });
            onSave(newFile);
        }
    }, file.type);
  };

  // Actions
  const rotate = () => {
    const newRot = (rotation + 90) % 360;
    setRotation(newRot);
    pushToHistory({ rotation: newRot, brightness, contrast, aspectRatio });
  };

  const changeAspectRatio = (ratio: AspectRatio) => {
    setAspectRatio(ratio);
    pushToHistory({ rotation, brightness, contrast, aspectRatio: ratio });
  };

  const handleSliderCommit = () => {
    // Only push if different from current history
    const currentHist = history[historyIndex];
    if (currentHist.brightness !== brightness || currentHist.contrast !== contrast) {
        pushToHistory({ rotation, brightness, contrast, aspectRatio });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#161b22]">
            <button onClick={onCancel} className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition-colors">
                <X size={20} />
            </button>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleUndo} 
                    disabled={historyIndex === 0}
                    className={`p-2 rounded-lg transition-colors ${historyIndex === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                    title="Undo"
                >
                    <Undo2 size={18} />
                </button>
                <button 
                    onClick={handleRedo} 
                    disabled={historyIndex === history.length - 1}
                    className={`p-2 rounded-lg transition-colors ${historyIndex === history.length - 1 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                    title="Redo"
                >
                    <Redo2 size={18} />
                </button>
            </div>

            <button onClick={handleSave} className="p-2 text-brand-400 hover:text-brand-300 rounded-lg hover:bg-brand-900/20 transition-colors font-medium flex items-center gap-2">
                <Check size={20} />
                <span className="hidden sm:inline">Save</span>
            </button>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 overflow-hidden relative flex items-center justify-center p-8 bg-[#0d1117]">
            {image ? (
                <canvas 
                    ref={canvasRef} 
                    className="max-w-full max-h-full shadow-2xl border border-gray-800 object-contain"
                />
            ) : (
                <div className="text-gray-500 animate-pulse">Loading image...</div>
            )}
        </div>

        {/* Controls */}
        <div className="bg-[#161b22] border-t border-gray-800 p-4 pb-8 space-y-6">
            
            {/* Tabs */}
            <div className="flex justify-center gap-6 mb-4">
                <button 
                    onClick={() => setActiveTab('crop')}
                    className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${activeTab === 'crop' ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className={`p-2 rounded-full ${activeTab === 'crop' ? 'bg-brand-900/20' : 'bg-gray-800'}`}>
                        <Crop size={20} />
                    </div>
                    Crop & Rotate
                </button>
                <button 
                    onClick={() => setActiveTab('adjust')}
                    className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${activeTab === 'adjust' ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className={`p-2 rounded-full ${activeTab === 'adjust' ? 'bg-brand-900/20' : 'bg-gray-800'}`}>
                        <Sliders size={20} />
                    </div>
                    Filters
                </button>
            </div>

            {/* Tools Content */}
            <div className="max-w-md mx-auto h-24">
                {activeTab === 'crop' && (
                    <div className="flex flex-col items-center gap-4">
                         <div className="flex items-center gap-3">
                            {(['original', '1:1', '16:9', '4:3'] as AspectRatio[]).map((ratio) => (
                                <button
                                    key={ratio}
                                    onClick={() => changeAspectRatio(ratio)}
                                    className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                                        aspectRatio === ratio 
                                        ? 'bg-gray-200 text-black border-white' 
                                        : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                                    }`}
                                >
                                    {ratio === 'original' ? 'Free' : ratio}
                                </button>
                            ))}
                         </div>
                         <button 
                            onClick={rotate}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium text-gray-200 transition-colors"
                         >
                             <RotateCw size={14} />
                             Rotate 90°
                         </button>
                    </div>
                )}

                {activeTab === 'adjust' && (
                    <div className="space-y-4 px-4 w-full">
                        <div className="flex items-center gap-4">
                            <Sun size={16} className="text-gray-400 shrink-0" />
                            <input 
                                type="range" 
                                min="50" 
                                max="150" 
                                value={brightness} 
                                onChange={(e) => setBrightness(Number(e.target.value))}
                                onMouseUp={handleSliderCommit}
                                onTouchEnd={handleSliderCommit}
                                className="w-full accent-brand-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-xs text-gray-500 w-8 text-right">{brightness}%</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Contrast size={16} className="text-gray-400 shrink-0" />
                            <input 
                                type="range" 
                                min="50" 
                                max="150" 
                                value={contrast} 
                                onChange={(e) => setContrast(Number(e.target.value))}
                                onMouseUp={handleSliderCommit}
                                onTouchEnd={handleSliderCommit}
                                className="w-full accent-brand-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-xs text-gray-500 w-8 text-right">{contrast}%</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};