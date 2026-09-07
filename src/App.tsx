/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { ProcessingView } from './components/ProcessingView';
import { ResultView } from './components/ResultView';
import { BrandingView } from './components/BrandingView';
import { LogoView } from './components/LogoView';
import { CoverView } from './components/CoverView';
import { EnhanceView } from './components/EnhanceView';
import { SlicinView } from './components/SlicinView';
import { CleanerView } from './components/CleanerView';
import { generateThumbnail, ThumbnailInputs, updateApiServiceKey } from './services/geminiService';
import { useApiKey } from './context/ApiKeyContext';

import { DashboardView } from './components/DashboardView';

// --- Types ---
type AppState = 'home' | 'processing' | 'result';

export default function App() {
  const { effectiveApiKey } = useApiKey();
  const [state, setState] = useState<AppState>('home');
  const [currentView, setCurrentView] = useState('dashboard');

  useEffect(() => {
    updateApiServiceKey(effectiveApiKey);
  }, [effectiveApiKey]);
  const [progress, setProgress] = useState(0);
  const [inputs, setInputs] = useState<ThumbnailInputs | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');

  const handleGenerate = async (newInputs: ThumbnailInputs) => {
    setInputs(newInputs);
    setState('processing');
    setProgress(0);

    try {
      // Start the AI generation in parallel with the progress animation
      const generationPromise = generateThumbnail(newInputs);
      
      // Progress animation
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 1;
        });
      }, 50);

      const result = await generationPromise;
      setGeneratedImageUrl(result.imageUrl);
      
      // Finish progress
      setProgress(100);
      setTimeout(() => setState('result'), 500);
    } catch (error: any) {
      console.error("Failed to generate thumbnail:", error);
      setState('home');
      const errorMessage = error?.message || "Check your API key and try again.";
      alert(`Synthesis Failed: ${errorMessage}`);
    }
  };

  const handleReset = () => {
    setState('home');
    setInputs(null);
    setGeneratedImageUrl('');
    setProgress(0);
  };

  return (
    <div className="flex h-screen w-full bg-background text-white overflow-hidden selection:bg-primary/30">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="flex-1 flex flex-col h-full overflow-y-auto relative">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-primary/20 rounded-full blur-[120px] animate-pulse-slow" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[35rem] h-[35rem] bg-secondary/15 rounded-full blur-[140px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[30%] left-[40%] w-[25rem] h-[25rem] bg-tertiary/10 rounded-full blur-[100px] animate-float" />
        </div>

        <Header />

        <div className="flex-1 relative z-10">
          <AnimatePresence mode="wait">
            {currentView === 'dashboard' && (
              <motion.div
                key="dashboard-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="h-full"
              >
                <DashboardView onNavigate={(id) => setCurrentView(id)} />
              </motion.div>
            )}

            {currentView === 'home' && (
              <motion.div
                key="home-container"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="h-full"
              >
                {state === 'home' && (
                  <HomeView key="home" onGenerate={handleGenerate} />
                )}

                {state === 'processing' && (
                  <ProcessingView 
                    key="processing" 
                    progress={progress} 
                    context={inputs?.context}
                    platform={inputs?.platform}
                  />
                )}

                {state === 'result' && inputs && (
                  <ResultView 
                    key="result" 
                    inputs={inputs} 
                    generatedImageUrl={generatedImageUrl} 
                    onReset={handleReset} 
                  />
                )}
              </motion.div>
            )}

            {currentView === 'assets' && (
              <motion.div 
                key="assets"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.4, ease: "circOut" }}
                className="p-12 max-w-7xl mx-auto w-full"
              >
                <div className="flex items-end justify-between mb-12">
                  <div>
                    <h2 className="text-5xl font-black font-headline tracking-tighter mb-4">YOUR <span className="text-gradient">GALLERY</span></h2>
                    <p className="text-on-surface-variant text-lg max-w-md">Manage and reuse your AI-generated masterpieces from one central hub.</p>
                  </div>
                  <button className="btn-primary flex items-center gap-2">
                    <span>Upload Asset</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <motion.div 
                      key={i} 
                      whileHover={{ y: -10, scale: 1.02 }}
                      className="aspect-[4/5] glass-card overflow-hidden group cursor-pointer p-3"
                    >
                      <div className="w-full h-full rounded-2xl overflow-hidden relative">
                        <img src={`https://picsum.photos/seed/asset${i}/600/800`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                          <p className="font-bold text-white">Project Nova {i}</p>
                          <p className="text-xs text-white/60">YouTube Thumbnail • 4K</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {currentView === 'styles' && (
              <motion.div 
                key="styles"
                initial={{ opacity: 0, filter: 'blur(10px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(10px)' }}
                className="p-12 max-w-6xl mx-auto w-full"
              >
                <h2 className="text-5xl font-black font-headline tracking-tighter mb-12">DESIGN <span className="text-gradient">PRESETS</span></h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[
                    { name: 'Hyper Realistic', desc: 'Cinematic lighting with 8K textures.', color: 'from-pink-500 to-rose-500' },
                    { name: 'Minimalist', desc: 'Clean lines and focused subject matter.', color: 'from-blue-400 to-cyan-400' },
                    { name: 'Neo-Retro', desc: '80s synthwave vibes with grain filters.', color: 'from-purple-500 to-indigo-500' },
                    { name: 'Abstract Art', desc: 'Fluid shapes and experimental palettes.', color: 'from-orange-400 to-yellow-400' }
                  ].map(style => (
                    <motion.div 
                      key={style.name} 
                      whileHover={{ x: 10 }}
                      className="p-1 glass-card overflow-hidden cursor-pointer"
                    >
                      <div className="p-8 flex items-center gap-8 bg-white/5 rounded-[2.2rem]">
                        <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${style.color} flex items-center justify-center text-3xl font-black text-white shadow-lg`}>
                          {style.name[0]}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold mb-1">{style.name}</h3>
                          <p className="text-on-surface-variant">{style.desc}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {currentView === 'branding' && (
              <BrandingView key="branding" />
            )}

            {currentView === 'logo' && (
              <LogoView key="logo" />
            )}

            {currentView === 'cover' && (
              <CoverView key="cover" />
            )}

            {currentView === 'enhancer' && (
              <EnhanceView key="enhancer" />
            )}

            {currentView === 'slicin' && (
              <SlicinView key="slicin" />
            )}

            {currentView === 'cleaner' && (
              <CleanerView key="cleaner" />
            )}
          </AnimatePresence>
        </div>

        <footer className="mt-auto py-12 flex flex-col items-center gap-6 border-t border-white/5 relative z-10 bg-background/50 backdrop-blur-md">
          <div className="flex gap-12 text-sm font-medium tracking-wide text-on-surface-variant/60">
            <a href="#" className="hover:text-primary transition-colors">Privacy Architecture</a>
            <a href="#" className="hover:text-primary transition-colors">API Systems</a>
            <a href="#" className="hover:text-primary transition-colors">Neural Network Status</a>
          </div>
          <div className="flex items-center gap-4">
             <div className="h-px w-24 bg-gradient-to-r from-transparent to-white/10" />
             <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/20">© 2024 VEXO CREATIVE SUITE • VEXO PROTOCOL</p>
             <div className="h-px w-24 bg-gradient-to-l from-transparent to-white/10" />
          </div>
        </footer>
      </main>
    </div>
  );
}

