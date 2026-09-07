import React, { useState } from 'react';
import { Building2, Eye, EyeOff, Save, Key, CheckCircle2, Sparkles } from 'lucide-react';
import { useBrand } from '../context/BrandContext';
import { useApiKey } from '../context/ApiKeyContext';
import { motion, AnimatePresence } from 'motion/react';

export const Header = () => {
  const { brand } = useBrand();
  const { apiKey, saveApiKey, effectiveApiKey } = useApiKey();
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const handleSave = () => {
    saveApiKey(tempKey);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  return (
    <header className="px-12 pt-8 pb-4 flex items-center justify-between bg-transparent relative z-50">
      {/* API Key Input Section - Floating Glass Container */}
      <div className="flex-1 max-w-2xl">
        <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 p-2 rounded-[2rem] backdrop-blur-md shadow-2xl">
          <div className="relative flex-1 group">
            <Key className="absolute left-6 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type={showKey ? "text" : "password"}
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="Enter Gemini API Key..." 
              className="w-full bg-transparent border-none rounded-2xl py-4 pl-16 pr-16 text-sm font-mono outline-none focus:ring-0 transition-all placeholder:text-on-surface-variant/40"
            />
            <button 
              onClick={() => setShowKey(!showKey)}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-2 text-on-surface-variant hover:text-white transition-colors"
            >
              {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-8 py-4 bg-primary text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_20px_rgba(var(--primary-rgb),0.3)]"
          >
            <Save size={16} />
            Save
          </button>

          <AnimatePresence>
            {showSavedToast && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="pr-6 flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
              >
                <CheckCircle2 size={14} />
                Synced
              </motion.div>
            )}
          </AnimatePresence>

          {!effectiveApiKey && (
            <div className="pr-6 text-[10px] font-black text-red-400 uppercase tracking-widest animate-pulse">
              Missing Key
            </div>
          )}
        </div>
      </div>

      {/* Descriptive Project Info - Premium Branding */}
      <div className="flex items-center gap-8 ml-12">
        <div className="text-right">
          <div className="text-sm font-black text-white uppercase tracking-[0.3em] flex items-center justify-end gap-3">
            <span className="text-primary tracking-[0.5em] font-black">PREMIUM</span>
            <span>AI MANIFESTATION SUITE</span>
          </div>
          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.4em] opacity-60 mt-2 flex items-center justify-end gap-2">
            <Sparkles size={10} className="text-primary" />
            Advanced Neural Design Protocol v4.2.0
          </div>
        </div>
      </div>
    </header>
  );
};
