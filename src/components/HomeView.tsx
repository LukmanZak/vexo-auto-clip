import React, { useState } from 'react';
import { 
  Youtube, 
  Smartphone, 
  Instagram, 
  Check, 
  Zap, 
  Sparkles,
  Upload,
  Link as LinkIcon,
  Type,
  ImageIcon,
  Layout,
  MousePointer2,
  Wand2,
  Cpu,
  Monitor,
  Fingerprint,
  ShieldCheck,
  Layers
} from 'lucide-react';


import { motion, AnimatePresence } from 'motion/react';
import { analyzeInputs, ThumbnailInputs } from '../services/geminiService';


interface HomeViewProps {
  onGenerate: (inputs: ThumbnailInputs) => void;
}

const BentoCard = ({ children, className = "", title, icon: Icon, subtitle }: { children: React.ReactNode, className?: string, title?: string, icon?: any, subtitle?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`glass-card p-8 flex flex-col group hover:border-primary/30 transition-all duration-500 ${className}`}
  >
    {title && (
      <div className="flex items-start justify-between mb-8">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tighter text-white group-hover:text-primary transition-colors">{title}</h3>
          {subtitle && <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="p-3 bg-white/5 rounded-2xl text-on-surface-variant group-hover:text-primary group-hover:bg-primary/10 transition-all border border-white/5">
            <Icon size={20} />
          </div>
        )}
      </div>
    )}
    {children}
  </motion.div>
);

const RadioPill = ({ options, value, onChange, gridCols = "grid-cols-2" }: { options: string[], value: string, onChange: (v: string) => void, gridCols?: string }) => (
  <div className={`grid ${gridCols} gap-3`}>
    {options.map(opt => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(opt)}
        className={`px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${
          value === opt 
            ? 'bg-primary text-white border-primary shadow-[0_0_20px_rgba(244,114,182,0.3)]' 
            : 'bg-white/5 border-white/5 text-on-surface-variant hover:bg-white/10 hover:text-white'
        }`}
      >
        {opt}
      </button>
    ))}
  </div>
);

export const HomeView: React.FC<HomeViewProps> = ({ onGenerate }) => {
  const [inputs, setInputs] = useState<ThumbnailInputs>({
    context: '',
    thumbnailText: '',
    style: 'Cinematic',
    sourceType: 'None',
    imageUrl: '',
    imageFile: null,
    platform: 'YouTube'
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!inputs.context) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeInputs({ context: inputs.context });
      setInputs(prev => ({ ...prev, thumbnailText: result }));
    } catch (err) {
      console.error(err);
    }
    setIsAnalyzing(false);
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInputs({ ...inputs, imageFile: file, imageUrl: '' });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [isRemovingBg, setIsRemovingBg] = useState(false);

  const removeBackground = async () => {
    if (!previewUrl) return;
    setIsRemovingBg(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Mock result: add a grayscale filter or something to indicate "processed" 
    // In a real app, this would be the transparency-masked image from an API
    alert("Background removal protocol executed. (Mock implementation: Image processed)");
    setIsRemovingBg(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-12 py-16 space-y-16">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
      
      {/* Hero Section */}
      <section className="relative py-12">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="text-center relative z-10 space-y-6">
          <div className="flex justify-center gap-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-4"
            >
              <Sparkles size={14} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant">Vexo Engine v4.0</span>
            </motion.div>
          </div>

          <h1 className="text-7xl font-black font-headline tracking-tighter leading-none">
            VISUAL <span className="highlight-gradient">SYNERGIZER</span> <br />
            GENERATE VISUALS
          </h1>
          <p className="text-xl text-on-surface-variant max-w-2xl mx-auto font-medium">
            Transform raw concepts into high-conversion digital manifestations using advanced integrated synthesis and viral hooks.
          </p>
        </div>
      </section>

      {/* Main Control Grid */}
      <div className="grid grid-cols-12 gap-8">
        
        {/* Core Inputs */}
        <BentoCard 
          className="col-span-12 lg:col-span-8 !bg-white/[0.03]" 
          title="Concept Definition" 
          subtitle="Define the conceptual core of your visual"
          icon={Cpu}
        >
          <div className="space-y-8">
            <div className="relative group">
              <textarea 
                value={inputs.context}
                onChange={(e) => setInputs({ ...inputs, context: e.target.value })}
                className="w-full bg-black/40 rounded-[2rem] p-8 text-2xl font-bold border border-white/5 text-white placeholder:text-white/10 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all min-h-[160px] resize-none outline-none" 
                placeholder="Initialize concept parameters... (e.g. 'Unboxing a $10,000 laser cutter')"
              />
              <div className="absolute top-4 right-4 text-[10px] font-black text-white/20 uppercase tracking-widest group-focus-within:text-primary transition-colors">
                Concept Input
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                  <Type size={12} /> Focal Text Overlay
                </label>
                <div className="relative">
                  <input 
                    value={inputs.thumbnailText}
                    onChange={(e) => setInputs({ ...inputs, thumbnailText: e.target.value })}
                    className="w-full bg-black/40 rounded-2xl p-5 pr-14 text-lg font-black border border-white/5 text-white placeholder:text-white/10 focus:border-primary/50 outline-none transition-all" 
                    placeholder="E.g. INSANE TECH!"
                  />
                  <button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !inputs.context}
                    className="absolute right-3 top-3 bottom-3 w-10 flex items-center justify-center bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all disabled:opacity-30"
                  >
                    {isAnalyzing ? <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <Wand2 size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                  <Fingerprint size={12} /> Adaptive Style Filter
                </label>
                <div className="flex flex-wrap gap-2">
                   {['Cinematic', 'Hyper-Pop', 'Minimalist', '3D Render', 'Vintage Editorial', 'Cyberpunk', 'Bauhaus'].map(style => (
                     <button 
                       key={style} 
                       onClick={() => setInputs({ ...inputs, style })}
                       className={`px-6 py-4 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                         inputs.style === style 
                           ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                           : 'bg-white/5 border-white/5 text-on-surface-variant hover:text-white hover:bg-white/10'
                       }`}
                     >
                       {style}
                     </button>
                   ))}
                </div>
              </div>
            </div>
          </div>
        </BentoCard>

        {/* Platform Selection */}
        <BentoCard 
          className="col-span-12 lg:col-span-4" 
          title="Terminal Output" 
          subtitle="Target display specifications"
          icon={Monitor}
        >
          <div className="flex flex-col gap-4">
            {[
              { id: 'YouTube', icon: Youtube, desc: '16:9 Landscape' },
              { id: 'TikTok', icon: Smartphone, desc: '9:16 Portrait' },
              { id: 'Instagram', icon: Instagram, desc: '1:1 Square' },
            ].map((p) => (
              <button 
                key={p.id}
                onClick={() => setInputs({ ...inputs, platform: p.id })}
                className={`flex items-center gap-5 p-5 rounded-[1.5rem] transition-all border-2 ${
                  inputs.platform === p.id 
                    ? 'bg-primary/10 border-primary text-white' 
                    : 'bg-white/5 border-transparent text-on-surface-variant hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className={`p-3 rounded-xl ${inputs.platform === p.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-black/20'}`}>
                  <p.icon size={20} />
                </div>
                <div className="text-left flex-1">
                  <div className="text-sm font-black uppercase tracking-widest">{p.id}</div>
                  <div className="text-[10px] font-bold opacity-40">{p.desc}</div>
                </div>
                <AnimatePresence>
                  {inputs.platform === p.id && (
                    <motion.div 
                      initial={{ scale: 0 }} 
                      animate={{ scale: 1 }} 
                      exit={{ scale: 0 }}
                    >
                      <Check size={18} className="text-primary" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            ))}
          </div>
        </BentoCard>

        {/* Visual Reference */}
        <BentoCard 
          className="col-span-12" 
          title="Visual Substrate" 
          subtitle="Define base imagery protocols"
          icon={ImageIcon}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="col-span-1">
               <RadioPill 
                options={['None', 'Upload', 'URL']} 
                value={inputs.sourceType === 'Upload Image' ? 'Upload' : inputs.sourceType === 'Image URL' ? 'URL' : 'None'}
                onChange={(v) => {
                  const map: any = { 'None': 'None', 'Upload': 'Upload Image', 'URL': 'Image URL' };
                  setInputs({...inputs, sourceType: map[v]});
                }}
                gridCols="grid-cols-1"
              />
            </div>

            <div className="col-span-2">
              <AnimatePresence mode="wait">
                {inputs.sourceType === 'Image URL' ? (
                  <motion.div 
                    key="url"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="relative h-full flex items-center"
                  >
                    <input 
                      value={inputs.imageUrl}
                      onChange={(e) => setInputs({ ...inputs, imageUrl: e.target.value })}
                      className="w-full bg-black/40 rounded-2xl p-6 pl-14 text-lg font-bold border border-white/5 text-white placeholder:text-white/10 focus:border-primary/50 outline-none transition-all" 
                      placeholder="Enter substrate URL path..."
                    />
                    <LinkIcon size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-primary" />
                  </motion.div>
                ) : inputs.sourceType === 'Upload Image' ? (
                  <motion.div 
                    key="upload"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-full border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden"
                  >
                    {previewUrl ? (
                      <div className="relative h-full w-full">
                        <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                        <div className="relative z-10 h-full flex flex-col items-center justify-center gap-4">
                          <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 flex items-center gap-3">
                            <Check size={16} className="text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Substrate Locked</span>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeBackground(); }}
                            disabled={isRemovingBg}
                            className="bg-primary/20 hover:bg-primary/40 text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/30 transition-all flex items-center gap-2"
                          >
                            {isRemovingBg ? (
                              <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            ) : (
                              <ShieldCheck size={14} />
                            )}
                            {isRemovingBg ? 'Processing...' : 'Remove Background'}
                          </button>
                        </div>
                      </div>
                    ) : (

                      <>
                        <Upload size={32} className="text-white/20 group-hover:text-primary transition-colors" />
                        <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] group-hover:text-white">Initialize Upload</span>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-center"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/10">Pure Synthesis • No Reference</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Synthesis Execution */}
      <footer className="flex flex-col items-center pt-12">
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onGenerate(inputs)}
          disabled={!inputs.context || !inputs.thumbnailText}
          className="group relative w-full max-w-2xl overflow-hidden rounded-[3rem] p-1 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Animated Border */}
          <div className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,var(--color-primary)_0%,var(--color-secondary)_50%,var(--color-primary)_100%)] opacity-30 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative flex items-center justify-center gap-4 bg-black rounded-[2.9rem] px-12 py-10">
            <Zap size={32} fill="currentColor" className="text-primary group-hover:animate-pulse" />
            <span className="text-4xl font-black font-headline tracking-tighter text-white">EXECUTE SYNTHESIS</span>
            <MousePointer2 size={24} className="absolute right-12 text-white/10 group-hover:text-primary transition-colors" />
          </div>
        </motion.button>
        
        <div className="mt-12 flex items-center gap-6">
           <div className="h-px w-32 bg-gradient-to-r from-transparent to-white/10" />
           <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.5em]">
             VEXO CREATIVE SUITE v4.2.0
           </p>
           <div className="h-px w-32 bg-gradient-to-l from-transparent to-white/10" />
        </div>
      </footer>
    </div>
  );
};

