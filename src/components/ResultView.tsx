import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, 
  Download,
  RotateCcw, 
  Maximize2,
  X,
  Share2,
  Bookmark,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';


import { TiltCard } from './TiltCard';
import { ThumbnailInputs } from '../services/geminiService';

interface ResultViewProps {
  inputs: ThumbnailInputs;
  generatedImageUrl: string;
  onReset: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({ inputs, generatedImageUrl, onReset }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);


  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleDownload = async (format = '1280x720') => {
    if (!generatedImageUrl) return;
    
    try {
      const base64Data = generatedImageUrl.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `vexo-synergizer-${format}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setShowExportMenu(false);
    } catch (error) {
      console.error("Download failed:", error);
      const link = document.createElement('a');
      link.href = generatedImageUrl;
      link.download = `vexo-artifact.png`;
      link.click();
    }
  };


  const getAspectRatioClass = () => {
    switch (inputs.platform) {
      case 'TikTok': return 'aspect-[9/16] h-[600px]';
      case 'Instagram': return 'aspect-square h-[500px]';
      default: return 'aspect-video h-[400px]';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col items-center justify-center py-20 px-12 h-full relative"
    >
      {/* Decorative background text */}
      <div className="absolute top-20 left-20 text-[10rem] font-black text-white/[0.02] pointer-events-none select-none tracking-tighter leading-none">
        MASTERPIECE
      </div>

      <div className="w-full max-w-7xl flex flex-col lg:flex-row items-center gap-20 relative z-10">
        
        {/* Left Side: Preview */}
        <div className="flex-1 relative group">
           {/* Ambient Glow */}
           <div className="absolute inset-0 bg-primary/20 blur-[120px] rounded-full scale-75 group-hover:scale-100 transition-transform duration-1000" />
           
           <TiltCard className={`relative glass-card !p-3 !rounded-[3rem] overflow-hidden ${getAspectRatioClass()} shadow-[0_50px_100px_rgba(0,0,0,0.5)]`}>
             <div className="w-full h-full rounded-[2.2rem] overflow-hidden relative">
                <img 
                  src={generatedImageUrl} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s] ease-out" 
                  alt="Generated Thumbnail" 
                />
                
                {/* Safe Zone Overlay */}
                <AnimatePresence>
                  {showSafeZone && inputs.platform === 'YouTube' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 pointer-events-none"
                    >
                      {/* YouTube Timestamp Mock */}
                      <div className="absolute bottom-4 right-4 w-[25%] h-[15%] bg-black/80 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/20">
                        <span className="text-white font-bold text-lg">12:34</span>
                      </div>
                      {/* Safe Zone Borders */}
                      <div className="absolute inset-0 border-2 border-dashed border-highlight/50 m-4 rounded-xl" />
                      <div className="absolute top-6 left-6 bg-highlight text-black px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest">
                        YouTube Safe Zone
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-10">
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setIsFullScreen(true)}
                      className="flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl text-white font-bold hover:bg-white/20 transition-all"
                    >
                      <Maximize2 size={18} />
                      <span>Expand Artifact</span>
                    </button>
                    {inputs.platform === 'YouTube' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowSafeZone(!showSafeZone); }}
                        className={`flex items-center gap-3 px-6 py-3 backdrop-blur-xl border rounded-2xl font-bold transition-all ${showSafeZone ? 'bg-highlight text-black border-highlight' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                      >
                        <ShieldCheck size={18} />
                        <span>{showSafeZone ? 'Hide Safe Zone' : 'Show Safe Zone'}</span>
                      </button>
                    )}
                  </div>
                </div>
             </div>
           </TiltCard>

        </div>

        {/* Right Side: Details & Actions */}
        <div className="lg:w-1/3 flex flex-col gap-10">
          <div className="space-y-4">
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-primary"
            >
              <Check size={14} /> Synchronized
            </motion.div>
            <h2 className="text-5xl font-black font-headline tracking-tighter leading-tight text-white">
              VISUAL ASSET <br /> <span className="text-gradient">FINALIZED</span>
            </h2>
            <p className="text-lg text-on-surface-variant font-medium leading-relaxed">
              Visual synthesis complete. The generated artifact is optimized for maximum engagement on {inputs.platform}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
              <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Resolution</div>
              <div className="font-bold text-white">4K Dynamic Upscale</div>
            </div>
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
              <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Platform</div>
              <div className="font-bold text-white">{inputs.platform} Spec</div>
            </div>
          </div>

          <div className="space-y-4 pt-4 relative">
            <div className="flex gap-2">
              <button 
                onClick={() => handleDownload()}
                className="flex-1 btn-primary !py-6 !px-10 flex items-center justify-center gap-4 text-xl tracking-tighter !rounded-[2rem]"
              >
                <Download size={24} />
                <span>EXPORT ARTIFACT</span>
              </button>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={`px-6 btn-secondary !rounded-[2rem] transition-transform ${showExportMenu ? 'rotate-180' : ''}`}
              >
                <ChevronDown size={24} />
              </button>
            </div>

            <AnimatePresence>
              {showExportMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full mb-4 left-0 right-0 glass-card !p-4 !rounded-3xl z-50 flex flex-col gap-2 border-primary/20"
                >
                  {[
                    { id: '1280x720', label: 'YouTube Standard', sub: '1280 x 720 • 16:9' },
                    { id: '1080x1920', label: 'TikTok / Shorts', sub: '1080 x 1920 • 9:16' },
                    { id: '1080x1080', label: 'Instagram Post', sub: '1080 x 1080 • 1:1' }
                  ].map((format) => (
                    <button 
                      key={format.id}
                      onClick={() => handleDownload(format.id)}
                      className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all text-left group"
                    >
                      <div>
                        <div className="font-bold text-white group-hover:text-primary transition-colors">{format.label}</div>
                        <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">{format.sub}</div>
                      </div>
                      <Download size={16} className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex gap-4">

               <button 
                onClick={onReset}
                className="flex-1 btn-secondary !py-5 !rounded-2xl flex items-center justify-center gap-3"
              >
                <RotateCcw size={18} />
                <span>Restart</span>
              </button>
              <button className="p-5 btn-secondary !rounded-2xl">
                <Share2 size={18} />
              </button>
              <button className="p-5 btn-secondary !rounded-2xl">
                <Bookmark size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Modal */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-8 md:p-24"
          >
            <button 
              onClick={() => setIsFullScreen(false)}
              className="absolute top-12 right-12 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all z-[110] border border-white/10"
            >
              <X size={32} />
            </button>
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative shadow-2xl rounded-[3rem] overflow-hidden max-h-[90vh] glass-card !p-4"
            >
              <img 
                src={generatedImageUrl} 
                className="max-h-[80vh] w-auto rounded-[2rem] object-contain" 
                alt="Full Screen Artifact" 
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

