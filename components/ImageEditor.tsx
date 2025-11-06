import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { fileToBase64 } from '../utils/imageUtils';
import { UploadIcon, LoadingSpinner } from './icons/ActionIcons';

const FONT_OPTIONS = ['Arial', 'Verdana', 'Impact', 'Comic Sans MS', 'Courier New'];

type ExportSize = 'original' | '1:1' | '9:16' | '16:9';

const EXPORT_OPTIONS: { value: ExportSize; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: '1:1', label: 'Quadrado (1:1)' },
  { value: '9:16', label: 'Story (9:16)' },
  { value: '16:9', label: 'Paisagem (16:9)' },
];


const ImageEditor: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<{ file: File; dataUrl: string; mimeType: string } | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for text editing
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [textPosition, setTextPosition] = useState({ x: 256, y: 256 }); // Default position

  // State for export modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Refs for canvas and dragging logic
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartOffsetRef = useRef({ x: 0, y: 0 });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file (PNG, JPG, WEBP, etc.).');
        return;
      }
      setError(null);
      const dataUrl = URL.createObjectURL(file);
      setOriginalImage({ file, dataUrl, mimeType: file.type });
      setGeneratedImage(null);
      setText(''); // Reset text when new image is uploaded
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!originalImage || !prompt) {
      setError('Please upload an image and enter a prompt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    setText('');

    try {
      const base64Data = await fileToBase64(originalImage.file);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: originalImage.mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      const firstPart = response.candidates?.[0]?.content?.parts?.[0];
      if (firstPart && firstPart.inlineData) {
        const base64ImageBytes = firstPart.inlineData.data;
        const imageUrl = `data:${firstPart.inlineData.mimeType};base64,${base64ImageBytes}`;
        setGeneratedImage(imageUrl);
      } else {
        throw new Error('No image was generated. Please try a different prompt.');
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [originalImage, prompt]);

  // Effect to draw on canvas when image or text properties change
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    if (!generatedImage) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = generatedImage;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (textPosition.x === 256 && textPosition.y === 256) { // Center on first load
          setTextPosition({ x: img.width / 2, y: img.height / 2 });
      }
      
      ctx.drawImage(img, 0, 0);

      if (text) {
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, textPosition.x, textPosition.y);
      }
    };
  }, [generatedImage, text, textColor, fontSize, fontFamily, textPosition]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!text) return;
    const coords = getCanvasCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if(!ctx) return;
    
    ctx.font = `${fontSize}px ${fontFamily}`;
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize; // Approximation
    
    // Check if click is inside the text bounding box
    if (
        coords.x >= textPosition.x - textWidth / 2 &&
        coords.x <= textPosition.x + textWidth / 2 &&
        coords.y >= textPosition.y - textHeight / 2 &&
        coords.y <= textPosition.y + textHeight / 2
    ) {
        isDraggingRef.current = true;
        dragStartOffsetRef.current = {
            x: coords.x - textPosition.x,
            y: coords.y - textPosition.y,
        };
        e.currentTarget.style.cursor = 'grabbing';
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      const coords = getCanvasCoordinates(e);
      setTextPosition({
        x: coords.x - dragStartOffsetRef.current.x,
        y: coords.y - dragStartOffsetRef.current.y,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
        isDraggingRef.current = false;
        e.currentTarget.style.cursor = text ? 'grab' : 'default';
    }
  };
  
  const handleDownload = (size: ExportSize) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
  
    // Handle original size download
    if (size === 'original') {
      const link = document.createElement('a');
      link.download = 'ai-edited-image.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      return;
    }
  
    // Handle cropped download
    const ratioMap = {
      '1:1': 1 / 1,
      '9:16': 9 / 16,
      '16:9': 16 / 9,
    };
    const targetRatio = ratioMap[size];
    if (!targetRatio) return;
  
    const sourceWidth = canvas.width;
    const sourceHeight = canvas.height;
    const sourceRatio = sourceWidth / sourceHeight;
  
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;
    let cropX = 0;
    let cropY = 0;
  
    // Calculate dimensions for center crop
    if (sourceRatio > targetRatio) { // Source is wider than target
      cropWidth = sourceHeight * targetRatio;
      cropX = (sourceWidth - cropWidth) / 2;
    } else if (sourceRatio < targetRatio) { // Source is taller than target
      cropHeight = sourceWidth / targetRatio;
      cropY = (sourceHeight - cropHeight) / 2;
    }
  
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropWidth;
    tempCanvas.height = cropHeight;
    const tempCtx = tempCanvas.getContext('2d');
  
    if (!tempCtx) return;
  
    tempCtx.drawImage(
      canvas,
      cropX, cropY,
      cropWidth, cropHeight,
      0, 0,
      cropWidth, cropHeight
    );
  
    const link = document.createElement('a');
    link.download = `ai-edited-image-${size.replace(':', 'x')}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  };
  
  const handleExport = (size: ExportSize) => {
    handleDownload(size);
    setIsExportModalOpen(false);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Column */}
          <div className="flex flex-col gap-4 p-4 bg-gray-700/50 rounded-lg">
            <h2 className="text-xl font-bold text-indigo-300">1. Upload & Describe</h2>
            <div
              className="relative w-full h-64 border-2 border-dashed border-gray-500 rounded-lg flex flex-col justify-center items-center text-gray-400 hover:border-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
              />
              {originalImage ? (
                <img src={originalImage.dataUrl} alt="Original" className="object-contain w-full h-full rounded-lg" />
              ) : (
                <>
                  <UploadIcon className="h-12 w-12 mb-2" />
                  <p>Click to upload an image</p>
                </>
              )}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Add a retro filter, make it cinematic..."
              className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
              rows={3}
            />
            
            <button
              onClick={handleGenerate}
              disabled={isLoading || !originalImage || !prompt}
              className="w-full flex justify-center items-center p-3 font-bold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <><LoadingSpinner /> Generating...</> : 'Generate Image'}
            </button>
          </div>

          {/* Output Column */}
          <div className="flex flex-col gap-4 p-4 bg-gray-700/50 rounded-lg">
            <h2 className="text-xl font-bold text-purple-300">2. Result & Edit</h2>
            <div className="w-full h-[350px] border-2 border-dashed border-gray-500 rounded-lg flex justify-center items-center bg-gray-900/50 overflow-hidden">
              {isLoading && (
                <div className="text-center text-gray-400">
                  <LoadingSpinner />
                  <p className="mt-2">Generating your image...</p>
                </div>
              )}
              {error && <p className="text-red-400 p-4">{error}</p>}
              
              {generatedImage && !isLoading && (
                  <canvas
                      ref={canvasRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      className="max-w-full max-h-full object-contain"
                      style={{ cursor: text ? 'grab' : 'default' }}
                  />
              )}
              {!isLoading && !error && !generatedImage && <p className="text-gray-400">Your generated image will appear here</p>}
            </div>

            {generatedImage && (
              <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg">
                  <h3 className="text-lg font-semibold text-indigo-300 -mt-2">Add Text</h3>
                  <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter text here..." className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-1 focus:ring-indigo-500"/>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Font</label>
                          <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md">
                              {FONT_OPTIONS.map(font => <option key={font} value={font}>{font}</option>)}
                          </select>
                      </div>
                       <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Color</label>
                          <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full h-10 p-1 bg-gray-800 border border-gray-600 rounded-md cursor-pointer"/>
                      </div>
                  </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Size: {fontSize}px</label>
                      <input type="range" min="10" max="128" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
                  </div>

                  <button onClick={() => setIsExportModalOpen(true)} className="w-full p-2 font-bold bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
                    Export Image
                  </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setIsExportModalOpen(false)}>
          <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-xs sm:max-w-sm transform transition-all" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-center mb-6 text-purple-300">Selecione o Formato</h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {EXPORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleExport(opt.value)}
                  className="p-3 bg-gray-700 text-gray-200 font-semibold rounded-lg hover:bg-purple-600 hover:text-white transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
                onClick={() => setIsExportModalOpen(false)}
                className="mt-6 w-full p-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
            >
                Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ImageEditor;
