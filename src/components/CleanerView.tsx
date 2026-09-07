import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Eraser, 
  Video, 
  Terminal, 
  Eye, 
  EyeOff, 
  Cpu, 
  Loader2,
  Settings2,
  FileVideo,
  Download,
  CheckCircle2,
  Droplets,
  Wand2
} from 'lucide-react';
import { cn } from '../lib/utils';

export const CleanerView = () => {
  const [ffmpegPath, setFfmpegPath] = useState('');
  const [showFfmpeg, setShowFfmpeg] = useState(false);
  const [videoPath, setVideoPath] = useState('');
  const [colorToRemove, setColorToRemove] = useState('white');
  const [similarity, setSimilarity] = useState(0.1);
  const [blend, setBlend] = useState(0.1);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!videoPath) {
      alert("Please provide the Video path.");
      return;
    }
    
    setIsProcessing(true);
    setErrorMessage(null);
    setOutputUrl(null);
    
    try {
      const response = await fetch('/api/cleaner/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ffmpegPath, 
          videoPath, 
          color: colorToRemove,
          similarity,
          blend
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        setOutputUrl(data.outputPath);
      } else {
        setErrorMessage(data.error);
        throw new Error(data.error || "Purification failed");
      }
    } catch (error: any) {
      console.error("Purifier UI Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-12 py-16 space-y-12 pb-32">
      <header className="flex flex-col lg:flex-row items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="text-left space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-highlight/10 border border-highlight/20 rounded-full">
            <Settings2 size={14} className="text-highlight animate-spin-slow" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-highlight">Chroma Isolation v2.4</span>
          </div>
          <h1 className="text-6xl font-black font-headline tracking-tighter uppercase leading-none">
            VISUAL <span className="text-gradient">PURIFIER</span>
          </h1>
          <p className="text-on-surface-variant max-w-xl font-medium">
            Remove dominant background colors and isolate subjects using advanced chroma keying and local stream processing.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-12">
        {/* Input Configuration */}
        <div className="col-span-12 lg:col-span-5 space-y-8">
          <section className="glass-card p-10 space-y-10">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Terminal className="text-highlight" size={24} />
                <h3 className="text-2xl font-black uppercase tracking-tight">System Protocol</h3>
              </div>

              <div className="space-y-6">
                {/* FFMPEG Path */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Binary Execution Path</label>
                  <div className="relative group">
                    <Terminal className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-highlight transition-colors" size={20} />
                    <input 
                      type={showFfmpeg ? "text" : "password"}
                      value={ffmpegPath}
                      onChange={(e) => setFfmpegPath(e.target.value)}
                      placeholder="/usr/local/bin/executor"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 pl-16 pr-16 text-sm font-mono text-white focus:ring-2 focus:ring-highlight/20 outline-none transition-all"
                    />
                    <button 
                      onClick={() => setShowFfmpeg(!showFfmpeg)}
                      className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                    >
                      {showFfmpeg ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Video Path */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Source Video Path</label>
                  <div className="relative group">
                    <FileVideo className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-highlight transition-colors" size={20} />
                    <input 
                      type="text"
                      value={videoPath}
                      onChange={(e) => setVideoPath(e.target.value)}
                      placeholder="/vids/input_video.mp4"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 pl-16 text-sm font-mono text-white focus:ring-2 focus:ring-highlight/20 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8 bg-white/[0.02] p-8 rounded-3xl border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <Droplets className="text-highlight" size={20} />
                <h4 className="text-sm font-black uppercase tracking-widest">Chroma Parameters</h4>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Dominant Color</label>
                    <span className="text-[10px] font-black text-highlight uppercase">{colorToRemove}</span>
                  </div>
                  <select 
                    value={colorToRemove}
                    onChange={(e) => setColorToRemove(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-highlight transition-all appearance-none"
                  >
                    <option value="white">White (#FFFFFF)</option>
                    <option value="black">Black (#000000)</option>
                    <option value="green">Green (#00FF00)</option>
                    <option value="blue">Blue (#0000FF)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Similarity Sensitivity</label>
                    <span className="text-[10px] font-black text-highlight uppercase">{similarity}</span>
                  </div>
                  <input 
                    type="range" min="0.01" max="0.5" step="0.01"
                    value={similarity}
                    onChange={(e) => setSimilarity(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Edge Blend</label>
                    <span className="text-[10px] font-black text-highlight uppercase">{blend}</span>
                  </div>
                  <input 
                    type="range" min="0" max="0.5" step="0.01"
                    value={blend}
                    onChange={(e) => setBlend(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleProcess}
              disabled={isProcessing || !videoPath || !ffmpegPath}
              className="w-full btn-primary !py-8 !rounded-3xl flex items-center justify-center gap-4 group disabled:opacity-30"
              style={{ backgroundColor: 'rgb(236, 72, 153)' }}
            >
              {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <Wand2 size={24} />}
              <span className="text-xl font-black uppercase tracking-tighter">Invoke Purification</span>
            </button>
          </section>
        </div>

        {/* Viewport & Result */}
        <div className="col-span-12 lg:col-span-7">
          <section className="glass-card min-h-[600px] p-10 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
            
            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div 
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-8"
                >
                  <div className="relative">
                    <div className="w-32 h-32 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <Eraser className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={32} />
                  </div>
                  <div className="text-center space-y-3">
                    <p className="text-2xl font-black uppercase tracking-tighter">REMOVING DOMINANT CHROMA</p>
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.4em] animate-pulse">Decomposing into Frames & Synthesizing Layers...</p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                       {[0, 1, 2, 3].map(i => (
                         <motion.div 
                          key={i}
                          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                          transition={{ delay: i * 0.2, duration: 1, repeat: Infinity }}
                          className="w-2 h-2 rounded-full bg-primary"
                         />
                       ))}
                    </div>
                  </div>
                </motion.div>
              ) : errorMessage ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-6 p-8 max-w-md"
                >
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
                    <Terminal className="text-red-500 mx-auto mb-4" size={32} />
                    <p className="text-sm font-mono text-red-400 break-all leading-relaxed">
                      {errorMessage}
                    </p>
                  </div>
                  <button 
                    onClick={() => setErrorMessage(null)}
                    className="text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-white transition-colors"
                  >
                    Clear Error & Retry
                  </button>
                </motion.div>
              ) : outputUrl ? (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full space-y-8 flex flex-col items-center"
                >
                  <div className="w-full aspect-video rounded-[3rem] border-2 border-primary/30 bg-black/40 flex flex-col items-center justify-center relative group overflow-hidden shadow-2xl">
                     <div className="absolute inset-0 flex items-center justify-center opacity-20">
                        <CheckCircle2 size={120} className="text-primary" />
                     </div>
                     <div className="relative z-10 text-center space-y-4 p-12">
                        <h4 className="text-4xl font-black tracking-tighter uppercase">SYNTHESIS COMPLETE</h4>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 font-mono text-xs text-on-surface-variant">
                          {outputUrl}
                        </div>
                        <p className="text-sm font-medium text-white/60">Subject has been isolated from dominant "{colorToRemove}" environment.</p>
                     </div>
                  </div>

                  <button 
                    onClick={() => alert("File available at local path.")}
                    className="btn-secondary !py-6 !px-12 rounded-[2rem] flex items-center gap-4 font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
                  >
                    <Download size={22} />
                    Download Manifestation
                  </button>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center gap-8 text-center max-w-sm">
                  <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center text-white/20 rotate-[-12deg]">
                    <Video size={48} />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-2xl font-black tracking-tight uppercase">ISO-CHROMA OFFLINE</h4>
                    <p className="text-on-surface-variant text-sm font-medium leading-relaxed">Invoke the Visual Purifier protocol to extract subjects from high-contrast backgrounds via local integrated rendering.</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </div>
    </div>
  );
};
