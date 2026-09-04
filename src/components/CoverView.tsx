import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Wand2, Download, RefreshCw, Type, Palette, User, Sparkles, Maximize2, X } from 'lucide-react';
import { generateCover, CoverInputs } from '../services/geminiService';
import { downloadImage } from '../lib/utils';

export const CoverView = () => {
  const [inputs, setInputs] = useState<CoverInputs>({
    title: '',
    subtitle: '',
    category: 'Education',
    style: 'Minimalist',
    author: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleGenerate = async () => {
    if (!inputs.title) return;
    setIsGenerating(true);
    setGeneratedImage(null);
    try {
      const result = await generateCover(inputs);
      setGeneratedImage(result.imageUrl);
    } catch (error: any) {
      console.error(error);
      alert(`Cover manifestation failed: ${error?.message || "Check connectivity or quota."}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-12 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between mb-12">
        <div>
          <h2 className="text-5xl font-black font-headline tracking-tighter mb-4 uppercase">
            AURA <span className="text-gradient">CANVAS</span>
          </h2>
          <p className="text-on-surface-variant text-lg max-w-md">Professional archival document manifestation and digital poster synthesis.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Control Panel */}
        <div className="lg:col-span-5 space-y-8">
          <section className="glass-card p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 block">Document Title</label>
                <div className="relative">
                  <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input 
                    type="text" 
                    value={inputs.title}
                    onChange={(e) => setInputs({ ...inputs, title: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-colors font-medium"
                    placeholder="e.g. Quantum Physics 101"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 block">Subtitle / Description</label>
                <textarea 
                  value={inputs.subtitle}
                  onChange={(e) => setInputs({ ...inputs, subtitle: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-primary transition-colors font-medium h-24 resize-none"
                  placeholder="e.g. A comprehensive guide to the subatomic world"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 block">Category</label>
                  <select 
                    value={inputs.category}
                    onChange={(e) => setInputs({ ...inputs, category: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-primary transition-colors font-medium appearance-none"
                  >
                    <option value="Education">Education</option>
                    <option value="Tech & AI">Tech & AI</option>
                    <option value="Finance">Finance</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Lifestyle">Lifestyle</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 block">Art Style</label>
                  <select 
                    value={inputs.style}
                    onChange={(e) => setInputs({ ...inputs, style: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-primary transition-colors font-medium appearance-none"
                  >
                    <option value="Minimalist">Minimalist</option>
                    <option value="Hyper-Realistic">Hyper-Realistic</option>
                    <option value="Cyberpunk">Cyberpunk</option>
                    <option value="Abstract">Abstract</option>
                    <option value="Classical">Classical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 block">Author / Credits (Optional)</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input 
                    type="text" 
                    value={inputs.author}
                    onChange={(e) => setInputs({ ...inputs, author: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-colors font-medium"
                    placeholder="e.g. Dr. Felix Arvid"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !inputs.title}
              className="btn-primary w-full py-5 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex items-center gap-3">
                {isGenerating ? <RefreshCw className="animate-spin" size={20} /> : <Wand2 size={20} />}
                <span className="font-black uppercase tracking-widest">Manifest Cover</span>
              </div>
            </button>
          </section>
        </div>

        {/* Manifestation Display */}
        <div className="lg:col-span-7">
          <div className="glass-card h-full min-h-[600px] flex flex-col items-center justify-center relative overflow-hidden p-8">
            <div className="absolute inset-0 bg-white/[0.02] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-20 pointer-events-none" />
            
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-8"
                >
                  <div className="relative">
                    <div className="w-32 h-32 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={32} />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-xl font-black uppercase tracking-tighter">FORGING VOID COVER</p>
                    <p className="text-on-surface-variant text-sm font-bold uppercase tracking-[0.3em] animate-pulse">Syncing Creative Protocols...</p>
                  </div>
                </motion.div>
              ) : generatedImage ? (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, scale: 0.9 }} 
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full flex flex-col items-center gap-8"
                >
                  <div className="relative group max-w-[450px] w-full">
                    <div className="aspect-[210/297] rounded-[2rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] border border-white/10 bg-black/40">
                      <img 
                        src={generatedImage} 
                        className="w-full h-full object-cover" 
                        alt="A4 Cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    
                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 backdrop-blur-sm rounded-[2rem]">
                      <button 
                        onClick={() => downloadImage(generatedImage, `A4_Cover_${inputs.title.replace(/\s+/g, '_')}`)}
                        className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform shadow-2xl"
                      >
                        <Download size={32} />
                      </button>
                      <button 
                        onClick={() => setIsFullScreen(true)}
                        className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/20"
                      >
                        <Maximize2 size={32} />
                      </button>
                    </div>

                    <div className="absolute -top-4 -right-4 bg-primary text-white p-4 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest rotate-12">
                      A4 FORMAT
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => downloadImage(generatedImage, `A4_Cover_${inputs.title.replace(/\s+/g, '_')}`)}
                      className="btn-secondary !py-4 !px-8 flex items-center gap-3"
                    >
                      <Download size={20} />
                      <span className="font-black uppercase tracking-widest">Download PNG</span>
                    </button>
                    <button 
                      onClick={handleGenerate}
                      className="btn-primary !py-4 !px-8 flex items-center gap-3"
                    >
                      <RefreshCw size={20} />
                      <span className="font-black uppercase tracking-widest">Remanifest</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center gap-6 text-center max-w-sm">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center text-white/20">
                    <FileText size={48} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">Awaiting Parameters</h4>
                    <p className="text-on-surface-variant text-sm font-medium">Input your cover's metadata and choose an aesthetic style to begin the manifestation process.</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Full Screen Modal */}
      <AnimatePresence>
        {isFullScreen && generatedImage && (
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
              className="relative p-8 bg-white/[0.03] border border-white/10 rounded-[3rem] shadow-2xl flex items-center justify-center"
            >
               <img src={generatedImage} className="max-h-[85vh] w-auto drop-shadow-2xl rounded-2xl" alt="Full Screen Cover" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
