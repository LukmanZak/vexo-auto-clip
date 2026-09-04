import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImagePlus, Wand2, Download, RefreshCw, Upload, Trash2, Camera, Sparkles, AlertCircle, Maximize2, X } from 'lucide-react';
import { enhancePhoto, EnhanceInputs } from '../services/geminiService';
import { downloadImage } from '../lib/utils';

export const EnhanceView = () => {
  const [sourceType, setSourceType] = useState<'upload' | 'url'>('upload');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedImageUrl, setEnhancedImageUrl] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setEnhancedImageUrl(null);
    }
  };

  const handleEnhance = async () => {
    if (sourceType === 'upload' && !file) return;
    if (sourceType === 'url' && !url) return;
    
    setIsEnhancing(true);
    try {
      const result = await enhancePhoto({
        sourceType,
        imageFile: file,
        imageUrl: url,
        instructions
      });
      setEnhancedImageUrl(result);
    } catch (error: any) {
      console.error(error);
      alert(`Photo enhancement protocol failed: ${error?.message || "Check connectivity or quota."}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setEnhancedImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-12 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between mb-12">
        <div>
          <h2 className="text-5xl font-black font-headline tracking-tighter mb-4 uppercase">
            LUMEN <span className="text-gradient">ARCHITECT</span>
          </h2>
          <p className="text-on-surface-variant text-lg max-w-md">Vexo reconstructs visual data, elevates lighting, and refines your photographs to professional studio quality.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Editor Panel */}
        <div className="lg:col-span-5 space-y-8">
          <section className="glass-card p-8 space-y-8">
            <div className="flex bg-white/5 p-2 rounded-2xl">
              <button 
                onClick={() => setSourceType('upload')}
                className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${sourceType === 'upload' ? 'bg-primary text-white shadow-lg' : 'text-on-surface-variant hover:text-white'}`}
              >
                Upload File
              </button>
              <button 
                onClick={() => setSourceType('url')}
                className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${sourceType === 'url' ? 'bg-primary text-white shadow-lg' : 'text-on-surface-variant hover:text-white'}`}
              >
                External URL
              </button>
            </div>

            <div className="space-y-6">
              {sourceType === 'upload' ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`aspect-video rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4 relative overflow-hidden group ${file ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-primary/50 hover:bg-white/5'}`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*" 
                  />
                  
                  {previewUrl ? (
                    <>
                      <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover" alt="Preview" />
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black">
                          <Upload size={24} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-white/40 group-hover:text-primary transition-colors">
                        <Upload size={32} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-white mb-1 tracking-tight">Drop your image here</p>
                        <p className="text-xs text-on-surface-variant font-medium">PNG, JPG or WEBP up to 10MB</p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary block">Image source (HTTPS URL)</label>
                  <input 
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary block flex items-center gap-2">
                  <Sparkles size={14} />
                  Enhancement Instructions
                </label>
                <textarea 
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white text-sm focus:outline-none focus:border-primary transition-colors min-h-[120px] resize-none"
                  placeholder="e.g. Remove the extra person in the background, sharpen the details, and make the colors more cinematic."
                />
                <div className="flex items-center gap-2 text-on-surface-variant/40 text-[10px] font-bold italic">
                  <AlertCircle size={10} />
                  <span>The system will intelligently analyze and modify the visual data.</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                onClick={reset}
                className="p-5 bg-white/5 hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all border border-white/5"
              >
                <Trash2 size={24} />
              </button>
              <button 
                onClick={handleEnhance}
                disabled={isEnhancing || (sourceType === 'upload' ? !file : !url)}
                className="btn-primary flex-1 py-5 flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] font-black"
              >
                {isEnhancing ? <RefreshCw className="animate-spin" size={24} /> : <Wand2 size={24} />}
                {isEnhancing ? 'Synthesizing...' : 'Enhance Photo'}
              </button>
            </div>
          </section>
        </div>

        {/* Viewport */}
        <div className="lg:col-span-7">
          <div className="glass-card h-full min-h-[600px] flex flex-col items-center justify-center relative overflow-hidden p-8">
            <AnimatePresence mode="wait">
              {isEnhancing ? (
                <motion.div 
                  key="enhancing"
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-10"
                >
                  <div className="w-48 h-1 bg-white/10 rounded-full relative overflow-hidden">
                    <motion.div 
                      className="absolute inset-0 bg-primary"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                  <div className="text-center space-y-3">
                    <p className="text-2xl font-black tracking-tighter uppercase">RECONSTRUCTING PIXELS</p>
                    <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Deep Detail Refinement in progress...</p>
                  </div>
                </motion.div>
              ) : enhancedImageUrl ? (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full flex flex-col items-center gap-8"
                >
                  <div className="grid grid-cols-2 gap-4 w-full max-w-4xl">
                     <div className="space-y-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Original Source</span>
                        <div className="aspect-square rounded-3xl overflow-hidden border border-white/5 bg-black/40">
                          <img src={previewUrl || url} className="w-full h-full object-cover" alt="Original" />
                        </div>
                     </div>
                     <div className="space-y-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                           <Sparkles size={12} />
                           Enhanced Manifestation
                        </span>
                        <div className="aspect-square rounded-3xl overflow-hidden border-2 border-primary shadow-[0_0_50px_rgba(244,114,182,0.2)]">
                          <img src={enhancedImageUrl} className="w-full h-full object-cover" alt="Enhanced" referrerPolicy="no-referrer" />
                        </div>
                     </div>
                  </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => setIsFullScreen(true)}
                        className="btn-secondary !p-5 flex items-center justify-center border-white/10"
                      >
                        <Maximize2 size={22} />
                      </button>
                      <button 
                        onClick={() => downloadImage(enhancedImageUrl, 'enhanced_photo_manifestation')}
                        className="btn-primary flex-1 !py-5 !px-12 flex items-center justify-center gap-3 font-black uppercase tracking-widest"
                      >
                        <Download size={22} />
                        Download PNG
                      </button>
                      <button 
                        onClick={handleEnhance}
                        className="btn-secondary !py-5 !px-10 flex items-center justify-center gap-3 font-black uppercase tracking-widest border-white/10"
                      >
                        <RefreshCw size={22} />
                        Retry
                      </button>
                    </div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center gap-8 text-center max-w-sm">
                  <div className="relative">
                    <div className="w-32 h-32 bg-white/5 rounded-[2.5rem] flex items-center justify-center text-white/20 rotate-12">
                      <ImagePlus size={54} />
                    </div>
                    <Camera className="absolute -bottom-2 -right-2 text-primary" size={32} />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-2xl font-black tracking-tight">VISUAL UPGRADE REQUIRED</h4>
                    <p className="text-on-surface-variant text-sm font-medium leading-relaxed">Select a high-resolution base image and provide enhancement instructions to invoke the advanced refinement protocol.</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Full Screen Modal */}
      <AnimatePresence>
        {isFullScreen && enhancedImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-24"
          >
            <button onClick={() => setIsFullScreen(false)} className="absolute top-12 right-12 p-6 bg-white/10 hover:bg-white/20 rounded-full text-white border border-white/10 transition-all">
              <X size={36} />
            </button>
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              className="relative p-8 bg-white/[0.03] border border-white/10 rounded-[3rem] shadow-2xl flex items-center justify-center max-w-5xl"
            >
               <img src={enhancedImageUrl} className="max-h-[75vh] w-auto drop-shadow-2xl rounded-2xl" alt="Full Screen Enhanced" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
