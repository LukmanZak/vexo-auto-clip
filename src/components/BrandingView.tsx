import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useBrand } from '../context/BrandContext';
import { Upload, Check, Palette, Type, ShieldCheck, Briefcase, Wand2, Building2, Quote, Layout, Download } from 'lucide-react';
import { generateLogo, generateMockup } from '../services/geminiService';
import { downloadImage } from '../lib/utils';

export const BrandingView = () => {
  const { brand, updateBrand, applyBrand } = useBrand();
  const [showSuccess, setShowSuccess] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mockupUrl, setMockupUrl] = useState<string | null>(null);
  const [isManifesting, setIsManifesting] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("📂 File selected:", file.name, file.size, file.type);
      const reader = new FileReader();
      reader.onloadstart = () => console.log("⏳ Starting file read...");
      reader.onloadend = () => {
        if (reader.result) {
          console.log("✅ File read complete. Updating brand state.");
          updateBrand({ logo: reader.result as string });
        } else {
          console.error("❌ File read resulted in empty output.");
        }
      };
      reader.onerror = (err) => console.error("❌ FileReader Error:", err);
      reader.readAsDataURL(file);
    }
  };

  const handleApply = async () => {
    console.log("🚀 Synchronize Protocols Initialized...");
    
    if (!brand.companyName && !brand.logo) {
      console.warn("⚠️ Sync attempted without name or logo.");
      alert("Please provide a Company Name or upload a Logo to synchronize your brand.");
      return;
    }

    setIsSyncing(true);
    let currentBrand = { ...brand };

    try {
      // If no logo is present but business info is filled, auto-generate as part of synchronization
      if (!brand.logo && brand.companyName) {
        setIsGenerating(true);
        console.log("🧬 Starting Emblem Synthesis for:", brand.companyName);
        try {
          const result = await generateLogo({
            companyName: brand.companyName,
            tagline: brand.tagline,
            category: brand.category,
            style: 'Minimalist',
            colorTheme: brand.primaryColor // Removed hardcoded string, uses the actual primary color value
          });
          
          console.log("✅ Emblem synthesis successful. Image Byte Length:", result.imageUrl.length);
          currentBrand = { ...brand, logo: result.imageUrl };
        } catch (err: any) {
          console.error("❌ Auto-generation protocol failed:", err);
          alert(`Failed to auto-generate logo: ${err?.message || "Check connectivity or quota."}`);
          setIsGenerating(false);
          setIsSyncing(false);
          return;
        }
        setIsGenerating(false);
      }

      console.log("📡 Applying global genetics update with payload:", {
        name: currentBrand.companyName,
        primary: currentBrand.primaryColor,
        hasLogo: !!currentBrand.logo
      });
      
      // Simulate a small delay for "Neural Syncing" feel if it was instant
      await new Promise(resolve => setTimeout(resolve, 800));
      
      applyBrand(currentBrand);

      // Manifest the brand into the real world (Mockup generation)
      if (currentBrand.logo) {
        console.log("🏙️ Manifesting brand into the material world...");
        setIsManifesting(true);
        try {
          const mockup = await generateMockup({
            logoUrl: currentBrand.logo,
            category: currentBrand.category,
            companyName: currentBrand.companyName || 'Your Brand'
          });
          setMockupUrl(mockup);
          console.log("✅ Manifestation complete.");
        } catch (err) {
          console.error("❌ Manifestation failed:", err);
        } finally {
          setIsManifesting(false);
        }
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      console.log("🏁 Synchronization protocol complete.");
    } catch (error) {
      console.error("❌ Critical Sync Failure:", error);
      alert("Synchronization failed due to a system error. See console for details.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="p-12 max-w-6xl mx-auto w-full space-y-12 pb-32"
    >
      {/* Global Sync Overlay */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-6"
          >
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <div className="flex flex-col items-center gap-2">
              <span className="text-xl font-black uppercase tracking-widest text-white">Vexo Protocol Synthesis</span>
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest animate-pulse">Syncing VEXO protocols...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black font-headline tracking-tighter mb-4 uppercase">IDENTITY <span className="highlight-gradient">BLUEPRINT</span></h2>
          <p className="text-on-surface-variant text-lg">Define your Vexo protocols and synchronize them across your entire digital organism.</p>
        </div>
        
        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-primary/20 text-primary px-6 py-3 rounded-2xl border border-primary/30 flex items-center gap-3 font-bold text-sm shadow-[0_0_20px_rgba(244,114,182,0.2)]"
            >
              <Check size={18} />
              <span>Protocols Applied Successfully</span>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Core Identity Section */}
        <section className="glass-card p-10 space-y-10 md:col-span-12">
          <div className="flex items-center gap-3">
            <Building2 className="text-primary" />
            <h3 className="text-2xl font-black uppercase tracking-tighter">Vexo Business Core</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                <Building2 size={12} /> Company / Channel Name
              </label>
              <input 
                type="text" 
                value={brand.companyName}
                onChange={(e) => updateBrand({ companyName: e.target.value })}
                placeholder="E.g. Vexo Nexus"
                className="w-full bg-black/20 border border-white/5 rounded-2xl p-5 text-xl font-black text-white focus:border-primary/50 outline-none transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                <Quote size={12} /> Slogan / Tagline
              </label>
              <input 
                type="text" 
                value={brand.tagline}
                onChange={(e) => updateBrand({ tagline: e.target.value })}
                placeholder="The Future is Now"
                className="w-full bg-black/20 border border-white/5 rounded-2xl p-5 text-base font-bold text-white/60 focus:border-primary/50 outline-none transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                <Briefcase size={12} /> Domain / Niche
              </label>
              <select 
                value={brand.category}
                onChange={(e) => updateBrand({ category: e.target.value })}
                className="w-full bg-black/20 border border-white/5 rounded-2xl p-5 text-base font-bold text-white/80 focus:border-primary/50 outline-none transition-all appearance-none"
              >
                <option value="General">General</option>
                <option value="Education">Education</option>
                <option value="Tech & AI">Tech & AI</option>
                <option value="Gaming">Gaming</option>
                <option value="Finance">Finance</option>
                <option value="Lifestyle">Lifestyle</option>
              </select>
            </div>
          </div>
        </section>

        {/* Visual Styles */}
        <section className="glass-card p-8 space-y-8 md:col-span-4">
          <div className="flex items-center gap-3">
            <Palette className="text-primary" />
            <h3 className="text-xl font-bold">Palette</h3>
          </div>
          <div className="space-y-6">
            {[
              { id: 'primaryColor', label: 'Primary' },
              { id: 'secondaryColor', label: 'Secondary' },
            ].map((color) => (
              <div key={color.id} className="flex items-center justify-between">
                <label className="text-sm font-medium text-on-surface-variant">{color.label}</label>
                <input 
                  type="color" 
                  value={(brand as any)[color.id]} 
                  onChange={(e) => updateBrand({ [color.id]: e.target.value })}
                  className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card p-8 space-y-8 md:col-span-8">
          <div className="flex items-center gap-3">
            <Type className="text-secondary" />
            <h3 className="text-xl font-bold">Typography</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Headline</label>
              <select value={brand.fontHeadline} onChange={(e) => updateBrand({ fontHeadline: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-white">
                <option value="Outfit">Outfit</option>
                <option value="Inter">Inter</option>
                <option value="Space Grotesk">Space Grotesk</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Body</label>
              <select value={brand.fontBody} onChange={(e) => updateBrand({ fontBody: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-white">
                <option value="Space Grotesk">Space Grotesk</option>
                <option value="Inter">Inter</option>
              </select>
            </div>
          </div>
        </section>

        {/* Emblem Control */}
        <section className="glass-card p-10 md:col-span-12 space-y-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-highlight" />
            <h3 className="text-2xl font-black uppercase tracking-tighter">Emblem Designation</h3>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex flex-col items-center gap-4">
              <div 
                onClick={() => document.getElementById('brand-logo-input')?.click()}
                className="w-64 h-64 border-2 border-dashed border-white/10 rounded-[4rem] flex flex-col items-center justify-center gap-4 hover:border-primary/50 transition-all cursor-pointer overflow-hidden group relative bg-black/40 shadow-2xl"
              >
                {brand.logo ? (
                  <>
                    <img src={brand.logo} className="w-full h-full object-contain p-12 group-hover:scale-110 transition-transform duration-700" alt="Logo Preview" />
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <Upload className="text-white" size={32} />
                      <span className="text-[10px] font-black uppercase text-white tracking-widest">Re-designate</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-on-surface-variant/40 group-hover:text-primary transition-colors">
                    {isGenerating ? (
                      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    ) : (
                      <Upload size={48} />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Awaiting Data</span>
                  </div>
                )}
              </div>
            </div>
            
            <input type="file" id="brand-logo-input" className="hidden" accept="image/*" onChange={handleLogoUpload} />
            
            <div className="flex-1 space-y-10">
              <div className="p-8 bg-white/5 rounded-[3rem] border border-white/5 space-y-6">
                <div className="flex items-center gap-4 text-highlight">
                  <Wand2 size={24} className={isGenerating ? 'animate-pulse' : ''} />
                  <span className="text-lg font-black uppercase tracking-tight">Vexo Sync Ready</span>
                </div>
                <p className="text-base text-on-surface-variant leading-relaxed font-medium">
                  Click 'VEXO SYNC' to apply these protocols. If an emblem is missing, the system will automatically synthesize one from your Vexo Core data.
                </p>
              </div>
              
              <button 
                onClick={handleApply}
                disabled={isGenerating || isSyncing}
                className="w-full btn-primary !py-10 !px-16 flex items-center justify-center gap-6 text-3xl tracking-tighter !rounded-[3rem] relative overflow-hidden"
              >
                {(isGenerating || isSyncing) && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                )}
                <div className={`flex items-center gap-6 transition-opacity ${(isGenerating || isSyncing) ? 'opacity-0' : 'opacity-100'}`}>
                  <Check size={36} />
                  <span>{brand.logo ? 'VEXO DNA SYNCHRONIZE' : 'VEXO GENERATE & SYNC'}</span>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Identity Manifestation - New Section */}
        <AnimatePresence>
          {(mockupUrl || isManifesting) && (
            <motion.section 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-10 md:col-span-12 space-y-8 overflow-hidden relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Layout className="text-primary" />
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Vexo Manifestation</h3>
                </div>
                {isManifesting && (
                  <div className="flex items-center gap-2 text-primary animate-pulse">
                    <Wand2 size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Integrated Forging in Progress...</span>
                  </div>
                )}
              </div>

              <div className="relative rounded-[3rem] overflow-hidden bg-black/60 shadow-inner border border-white/5 aspect-video flex items-center justify-center">
                {isManifesting ? (
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-on-surface-variant text-sm font-bold uppercase tracking-[0.3em]">Synthesizing Reality</p>
                  </div>
                ) : (
                  mockupUrl && (
                    <div className="relative w-full h-full group">
                      <motion.img 
                        initial={{ scale: 1.1, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        src={mockupUrl} 
                        className="w-full h-full object-cover"
                        alt="Brand Mockup" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button 
                          onClick={() => downloadImage(mockupUrl, `Brand_Manifestation_${brand.companyName.replace(/\s+/g, '_')}`)}
                          className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform shadow-2xl"
                        >
                          <Download size={32} />
                        </button>
                      </div>
                    </div>
                  )
                )}
                
                <div className="absolute top-8 left-8 bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Real-World Simulation</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: "Visual Fidelity", value: "99.9%" },
                  { label: "Fabrication Accuracy", value: "High-Res" },
                  { label: "Manifestation Mode", value: "Multi-Product" }
                ].map((stat, i) => (
                  <div key={i} className="p-6 bg-white/5 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{stat.label}</p>
                    <p className="text-lg font-black text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
