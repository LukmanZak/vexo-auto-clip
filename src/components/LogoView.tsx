import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Wand2, 
  Fingerprint,
  Type,
  Palette,
  Layout,
  Download,
  RotateCcw,
  Maximize2,
  X,
  Plus,
  Briefcase,
  Search,
  Image as ImageIcon,
  MousePointer2,
  Sparkles,
  Layers,
  ChevronDown,
  Building2
} from 'lucide-react';
import { generateLogo, LogoInputs } from '../services/geminiService';
import { ProcessingView } from './ProcessingView';
import { TiltCard } from './TiltCard';
import { useBrand } from '../context/BrandContext';
import { downloadImage, cn } from '../lib/utils';

export const LogoView = () => {
  const { brand, updateBrand, applyBrand } = useBrand();
  const [step, setStep] = useState<'input' | 'processing' | 'result'>('input');
  const [progress, setProgress] = useState(0);
  const [generatedLogoUrl, setGeneratedLogoUrl] = useState('');
  const [inputs, setInputs] = useState<LogoInputs>({
    companyName: brand.companyName || '',
    tagline: brand.tagline || '',
    style: 'Modern',
    logoType: 'Icon + Text',
    iconDescription: '',
    objectCategory: 'Abstract',
    referenceImage: null,
    vibes: ['Modern'],
    artisticStyle: 'Flat Design',
    colorTheme: 'Cyberpunk',
    category: brand.category || 'Tech'
  });

  const [activeSection, setActiveSection] = useState<string>('identity');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const logoTypes = [
    { id: 'Typography Only', icon: Type, desc: 'Google, Sony' },
    { id: 'Icon + Text', icon: Layers, desc: 'Adidas, Nike' },
    { id: 'Icon Only', icon: Fingerprint, desc: 'Apple, Tesla' }
  ];

  const categories = [
    { name: 'Abstract', icon: '✨' },
    { name: 'Animals', icon: '🦊' },
    { name: 'Nature', icon: '🏔️' },
    { name: 'Tech', icon: '💻' },
    { name: 'Food', icon: '☕' }
  ];

  const vibeList = [
    { name: 'Modern', desc: 'Sleek, clean lines with a contemporary feel.' },
    { name: 'Vintage', desc: 'Nostalgic, retro aesthetics inspired by the past.' },
    { name: 'Minimalist', desc: 'Less is more. Focused on simple, essential forms.' },
    { name: 'Playful', desc: 'Lighthearted, fun, and energetic visual language.' },
    { name: 'Luxury', desc: 'Opulent, sophisticated, and high-end prestige.' },
    { name: 'Futuristic', desc: 'Tech-forward, innovative, and ahead of its time.' },
    { name: 'Brutalest', desc: 'Raw, bold, and unpolished geometric impact.' },
    { name: 'Elegant', desc: 'Graceful, refined, and beautifully balanced.' }
  ];

  const artisticStyles = ['Line Art', 'Flat Design', '3D Gradient', 'Mascot', 'Hand-drawn', 'Geometric', 'Bauhaus'];

  const themes = [
    { name: 'Cyberpunk', colors: 'from-pink-500 via-purple-500 to-cyan-500', desc: 'Neon pink, electric purple, and vibrant cyan' },
    { name: 'Premium Gold', colors: 'from-yellow-200 via-yellow-400 to-yellow-600', desc: 'Metallic gold, amber, and deep black accents' },
    { name: 'Midnight Blue', colors: 'from-blue-600 to-indigo-900', desc: 'Deep navy, indigo, and bright sapphire contrast' },
    { name: 'Emerald High', colors: 'from-emerald-400 to-teal-700', desc: 'Rich emerald green, teal, and forest shades' },
    { name: 'Velvet Rose', colors: 'from-rose-400 to-pink-600', desc: 'Soft rose pink, deep burgundy, and crimson' },
    { name: 'Mono Stealth', colors: 'from-slate-700 to-black', desc: 'Minimalist shades of gray, charcoal, and pure black' },
    { name: 'Oceanic Quad', colors: 'from-blue-400 via-teal-400 to-cyan-500', desc: '4-Color Bloom: Azure, Teal, Cyan, and Deep Marine' },
    { name: 'Neon Triad', colors: 'from-green-400 via-pink-500 to-yellow-400', desc: '3-Color Punch: Electric Lime, Hot Pink, and Sunburst' },
    { name: 'Sunrise Aurora', colors: 'from-orange-400 via-pink-500 via-purple-500 to-blue-600', desc: '4-Color Aura: Sunset Orange, Magenta, Deep Purple, and Twilight Blue' },
    { name: 'Deep Forest', colors: 'from-green-900 via-emerald-800 to-green-600', desc: '3-Color Earth: Moss Green, deep Emerald, and Pine' },
    { name: 'Royal Majesty', colors: 'from-purple-800 via-red-600 to-yellow-500', desc: 'Imperial Purple, Royal Red, and Lustrous Gold' },
    { name: 'Berry Fusion', colors: 'from-fuchsia-600 via-purple-600 to-pink-400', desc: 'Berry tones: Blackberry, Plum, and Raspberry' }
  ];

  const niches = ['Tech', 'Education', 'Gaming', 'Finance', 'LifeStyle', 'Health', 'Creative', 'Agency'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInputs({ ...inputs, referenceImage: file });
    }
  };

  const toggleVibe = (v: string) => {
    setInputs(prev => ({
      ...prev,
      vibes: prev.vibes.includes(v) 
        ? prev.vibes.filter(item => item !== v) 
        : [...prev.vibes, v]
    }));
  };

  const handleGenerate = async () => {
    if (!inputs.companyName) return;
    
    setStep('processing');
    setProgress(0);
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev < 30) return prev + 10;
        if (prev < 60) return prev + 5;
        if (prev < 80) return prev + 2;
        if (prev < 98) return prev + 0.5;
        return 99;
      });
    }, 300);

    try {
      const selectedTheme = themes.find(t => t.name === inputs.colorTheme);
      const result = await generateLogo({
        ...inputs,
        colorTheme: inputs.colorTheme,
        colorPaletteDescription: selectedTheme?.desc ? `${selectedTheme.desc}.` : undefined
      });
      console.log("✅ Vexo Genesis Successful:", result.imageUrl.length);
      
      clearInterval(interval);
      setProgress(100);
      setGeneratedLogoUrl(result.imageUrl);
      
      console.log("🎬 Transitioning to Result View...");
      setTimeout(() => setStep('result'), 600);
    } catch (error: any) {
      console.error("Vexo Forge Failure:", error);
      clearInterval(interval);
      setStep('input');
      alert(`Synthesis failed: ${error?.message}`);
    }
  };

  const setAsBrandLogo = () => {
    updateBrand({ logo: generatedLogoUrl });
    applyBrand({ ...brand, logo: generatedLogoUrl });
    alert("Fused to Brand DNA.");
  };

  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-12 py-16">
      <AnimatePresence mode="wait">
        {step === 'input' && (
          <motion.div 
            key="input"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-12"
          >
            {/* Hero Section */}
            <header className="flex flex-col lg:flex-row items-center justify-between gap-8 border-b border-white/5 pb-10">
               <div className="text-left space-y-4">
                 <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
                    <Sparkles size={14} className="text-primary animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Vexo Architect v3.0</span>
                 </div>
                 <h1 className="text-6xl font-black font-headline tracking-tighter uppercase leading-none">
                   IDENTITY <span className="text-gradient">CATALYST</span>
                 </h1>
                 <p className="text-on-surface-variant max-w-xl font-medium">
                   High-fidelity identity synthesis. Transform conceptual seeds into world-class brand artifacts.
                 </p>
               </div>
               
               <div className="hidden lg:flex items-center gap-4 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5">
                 {['Identity', 'Imagery', 'Aesthetic'].map(s => (
                   <button 
                    key={s}
                    onClick={() => setActiveSection(s.toLowerCase())}
                    className={cn(
                      "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      activeSection === s.toLowerCase() ? "bg-white/10 text-white shadow-xl" : "text-on-surface-variant hover:text-white"
                    )}
                   >
                     {s}
                   </button>
                 ))}
               </div>
            </header>

            <div className="grid grid-cols-12 gap-8">
              {/* Left Column: Config */}
              <div className="col-span-12 lg:col-span-8 space-y-8">
                
                {/* 1. Core Identity */}
                <section className={cn("glass-card overflow-hidden transition-all duration-500", activeSection === 'identity' ? "ring-1 ring-primary/30" : "opacity-90")}>
                  <div className="p-10 space-y-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                          <Building2 size={20} />
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">Vexo Identity Core</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Brand Name</label>
                        <input 
                          type="text" 
                          placeholder="Brand Name"
                          value={inputs.companyName}
                          onChange={(e) => setInputs({...inputs, companyName: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-xl font-black text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Slogan / Tagline</label>
                        <input 
                          type="text" 
                          placeholder="Optional slogan..."
                          value={inputs.tagline}
                          onChange={(e) => setInputs({...inputs, tagline: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-base font-bold text-white/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Logo Type Strategy</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {logoTypes.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setInputs({...inputs, logoType: t.id as any})}
                            className={cn(
                              "flex flex-col p-6 rounded-3xl border-2 transition-all text-left group",
                              inputs.logoType === t.id 
                                ? "bg-primary/10 border-primary shadow-2xl shadow-primary/10" 
                                : "bg-white/[0.02] border-white/5 hover:border-white/20"
                            )}
                          >
                            <t.icon size={24} className={cn("mb-4 transition-transform group-hover:scale-110", inputs.logoType === t.id ? "text-primary" : "text-on-surface-variant")} />
                            <span className={cn("text-lg font-black leading-tight", inputs.logoType === t.id ? "text-white" : "text-white/60")}>{t.id}</span>
                            <span className="text-[10px] font-bold text-on-surface-variant mt-1 opacity-60 uppercase">{t.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 2. Subject & Imagery */}
                <section className={cn("glass-card overflow-hidden transition-all duration-500", activeSection === 'imagery' ? "ring-1 ring-secondary/30" : "opacity-90")}>
                  <div className="p-10 space-y-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary">
                          <Layers size={20} />
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">Vexo Visual Subject</h3>
                      </div>
                    </div>

                    <div className="space-y-8">
                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Icon Description / Subject</label>
                          <div className="relative">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20" size={20} />
                            <input 
                              type="text" 
                              placeholder="e.g. Wolf, Mountain, Circuit..."
                              value={inputs.iconDescription}
                              onChange={(e) => setInputs({...inputs, iconDescription: e.target.value})}
                              className="w-full bg-black/40 border border-white/10 rounded-[2rem] py-6 pl-16 pr-8 text-base font-bold text-white focus:ring-2 focus:ring-secondary/20 outline-none transition-all placeholder:text-white/10"
                            />
                          </div>
                       </div>

                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Conceptual Category</label>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {categories.map(c => (
                              <button
                                key={c.name}
                                onClick={() => setInputs({...inputs, objectCategory: c.name})}
                                className={cn(
                                  "flex flex-col items-center justify-center p-6 rounded-3xl border transition-all gap-4",
                                  inputs.objectCategory === c.name 
                                    ? "bg-secondary/10 border-secondary scale-105" 
                                    : "bg-white/[0.02] border-white/5 hover:bg-white/5"
                                )}
                              >
                                <span className="text-3xl">{c.icon}</span>
                                <span className={cn("text-[10px] font-black uppercase tracking-widest", inputs.objectCategory === c.name ? "text-secondary" : "text-on-surface-variant")}>{c.name}</span>
                              </button>
                            ))}
                          </div>
                       </div>

                       <div className="pt-4 border-t border-white/5">
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                              "p-8 border-2 border-dashed rounded-[2.5rem] transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group relative overflow-hidden",
                              inputs.referenceImage ? "border-secondary bg-secondary/5" : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                            )}
                          >
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                            {inputs.referenceImage ? (
                               <div className="flex items-center gap-4 relative z-10">
                                 <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black/40 p-2">
                                    <img 
                                      src={typeof inputs.referenceImage === 'string' ? inputs.referenceImage : URL.createObjectURL(inputs.referenceImage as File)} 
                                      alt="Ref" 
                                      className="w-full h-full object-contain"
                                    />
                                 </div>
                                 <div className="text-left">
                                   <div className="text-sm font-black text-white">REF_LOCKED</div>
                                   <div className="text-[10px] font-bold text-on-surface-variant uppercase">Click to Swap blueprint</div>
                                 </div>
                                 <X 
                                  size={20} 
                                  className="ml-4 hover:text-red-500 transition-colors" 
                                  onClick={(e) => { e.stopPropagation(); setInputs({...inputs, referenceImage: null}); }} 
                                 />
                               </div>
                            ) : (
                              <>
                                <ImageIcon size={32} className="text-on-surface-variant group-hover:scale-110 transition-transform" />
                                <div className="text-center">
                                  <div className="text-sm font-black text-white uppercase tracking-tight">Upload Reference / Sketch</div>
                                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1 opacity-60">Scaffolding for manifestation synthesis</div>
                                </div>
                              </>
                            )}
                          </div>
                       </div>
                    </div>
                  </div>
                </section>

                {/* 3. Personality & Style */}
                <section className={cn("glass-card overflow-hidden transition-all duration-500", activeSection === 'aesthetic' ? "ring-1 ring-highlight/30" : "opacity-90")}>
                  <div className="p-10 space-y-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-highlight/20 flex items-center justify-center text-highlight">
                          <MousePointer2 size={20} />
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">Vexo Aesthetic</h3>
                      </div>
                    </div>

                    <div className="space-y-8">
                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">The "Vibe" DNA (Multi-Select)</label>
                        <div className="flex flex-wrap gap-2">
                           {vibeList.map(v => (
                             <div key={v.name} className="group relative">
                               <button
                                onClick={() => toggleVibe(v.name)}
                                className={cn(
                                  "px-6 py-3 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all",
                                  inputs.vibes.includes(v.name) 
                                    ? "bg-highlight text-black border-highlight shadow-lg shadow-highlight/20" 
                                    : "bg-white/5 border-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white"
                                )}
                               >
                                 {v.name}
                               </button>
                               {/* Vibe Description Tooltip */}
                               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 text-[10px] font-bold text-white/80 text-center leading-relaxed shadow-2xl">
                                  {v.desc}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-black/90" />
                               </div>
                             </div>
                           ))}
                        </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant flex items-center gap-2">
                               Artistic Technique
                            </label>
                            <div className="relative group">
                              <select 
                                value={inputs.artisticStyle}
                                onChange={(e) => setInputs({...inputs, artisticStyle: e.target.value})}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-base font-bold text-white focus:ring-2 focus:ring-highlight/20 outline-none transition-all appearance-none pr-12 cursor-pointer"
                              >
                                {artisticStyles.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none group-hover:text-white transition-colors" size={20} />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Market Classification</label>
                            <div className="relative group">
                              <select 
                                value={inputs.category}
                                onChange={(e) => setInputs({...inputs, category: e.target.value})}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-sm font-bold text-white focus:ring-2 focus:ring-highlight/20 outline-none transition-all appearance-none pr-12 cursor-pointer"
                              >
                                {niches.map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none group-hover:text-white transition-colors" size={20} />
                            </div>
                          </div>
                       </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Sidebar Action Zone */}
              <div className="col-span-12 lg:col-span-4 space-y-8">
                <section className="glass-card p-10 flex flex-col gap-10 sticky top-12">
                   <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center text-secondary">
                          <Palette size={16} />
                        </div>
                        <h4 className="text-lg font-black uppercase tracking-tight">Chromatic Core</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                         {themes.map(t => (
                           <button
                            key={t.name}
                            onClick={() => setInputs({...inputs, colorTheme: t.name})}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-2xl border transition-all relative group overflow-hidden",
                              inputs.colorTheme === t.name 
                                ? "bg-white/10 border-primary/50 shadow-xl" 
                                : "bg-white/[0.02] border-white/5 hover:bg-white/5"
                            )}
                           >
                             <div className={cn("absolute inset-y-0 left-0 w-1.5 transition-all opacity-0 group-hover:opacity-100 bg-gradient-to-b", t.colors)} />
                             <span className={cn("text-[10px] font-black uppercase tracking-widest", inputs.colorTheme === t.name ? "text-primary" : "text-white/60")}>{t.name}</span>
                             <div className={cn("w-16 h-4 rounded-full bg-gradient-to-r border border-white/5", t.colors)} />
                           </button>
                         ))}
                      </div>
                   </div>

                   <button 
                    onClick={handleGenerate}
                    disabled={!inputs.companyName}
                    className="w-full btn-primary !py-12 !rounded-[3rem] flex flex-col items-center justify-center gap-3 group relative overflow-hidden disabled:opacity-30"
                   >
                     <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                     <div className="flex items-center gap-4 relative z-10">
                        <Wand2 size={24} className="group-hover:rotate-[30deg] transition-transform duration-500" />
                        <span className="text-2xl font-black uppercase tracking-tighter">Initiate manifestation</span>
                     </div>
                     <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.4em] relative z-10 group-hover:text-white transition-colors">Forge Vexo Identity</span>
                   </button>
                </section>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <ProcessingView progress={progress} context={inputs.companyName} platform="Vexo Identity Core Synthesis" />
        )}

        {step === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-16"
          >
            <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-20">
               {/* Result Image */}
               <div className="flex-1 relative group">
                  <div className="absolute inset-0 bg-primary/20 blur-[150px] rounded-full scale-75 group-hover:scale-110 transition-transform duration-1000" />
                  <TiltCard className="relative glass-card !p-12 !rounded-[5rem] aspect-square w-full max-w-xl shadow-2xl border-white/10">
                    <div className="w-full h-full rounded-[4rem] overflow-hidden bg-black/40 flex items-center justify-center shadow-inner relative group/img">
                       <img src={generatedLogoUrl} className="max-w-[85%] max-h-[85%] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:scale-110 transition-transform duration-1000" alt="Generated Logo" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity" />
                    </div>
                    <button 
                      onClick={() => setIsFullScreen(true)}
                      className="absolute bottom-10 right-10 p-5 bg-white/10 backdrop-blur-xl rounded-full text-white hover:bg-white/20 transition-all opacity-0 group-hover:opacity-100 shadow-xl border border-white/20"
                    >
                      <Maximize2 size={24} />
                    </button>
                  </TiltCard>
               </div>

               {/* Result Info */}
               <div className="lg:w-1/3 space-y-10">
                 <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                      <Zap size={14} className="animate-pulse" /> Manifestation Locked
                    </div>
                    <h2 className="text-7xl font-black font-headline tracking-tighter leading-[0.8] text-white uppercase">
                       BRAND <br /> <span className="highlight-gradient">ARTIFACT</span>
                    </h2>
                    <p className="text-xl text-on-surface-variant font-medium leading-relaxed">
                      Synthesis complete. The essence of "{inputs.companyName}" has been crystallized into a high-fidelity visual blueprint.
                    </p>
                 </div>

                 <div className="space-y-4 pt-4">
                    <button 
                      onClick={setAsBrandLogo}
                      className="w-full btn-primary !py-8 !px-10 flex items-center justify-center gap-4 text-2xl tracking-tighter !rounded-[2rem] shadow-2xl shadow-primary/20"
                    >
                      <Plus size={28} />
                      <span>FUSE TO BRAND KIT</span>
                    </button>
                    <div className="flex gap-4">
                       <button 
                        onClick={() => downloadImage(generatedLogoUrl, `Logo_${inputs.companyName.replace(/\s+/g, '_')}`)}
                        className="flex-1 bg-white/5 border border-white/10 py-6 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all text-white font-black uppercase text-xs tracking-widest"
                      >
                        <Download size={20} />
                        <span>PNG</span>
                      </button>
                      <button 
                        onClick={() => setStep('input')}
                        className="flex-1 bg-white/5 border border-white/10 py-6 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all text-white font-black uppercase text-xs tracking-widest"
                      >
                        <RotateCcw size={20} />
                        <span>Resync</span>
                      </button>
                    </div>
                 </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFullScreen && (
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
              className="relative p-12 lg:p-24 bg-white/[0.03] border border-white/10 rounded-[5rem] shadow-2xl flex items-center justify-center max-w-4xl"
            >
               <img src={generatedLogoUrl} className="max-h-[70vh] w-auto drop-shadow-[0_35px_60px_rgba(0,0,0,0.6)]" alt="Full Screen Logo" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
