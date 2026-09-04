import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Layers, Check, AlertCircle } from 'lucide-react';

interface BatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (textList: string[]) => void;
}

export const BatchModal: React.FC<BatchModalProps> = ({ isOpen, onClose, onExecute }) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExecute = async () => {
    const list = inputText.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (list.length === 0) return;
    
    setIsProcessing(true);
    // Simulate a bit of processing delay for the UI feel
    await new Promise(resolve => setTimeout(resolve, 1000));
    onExecute(list);
    setIsProcessing(false);
    onClose();
    setInputText('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl glass-card !p-10 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-tertiary to-secondary" />
            
            <header className="flex justify-between items-start mb-10">
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-primary">
                  <Layers size={24} />
                  <h2 className="text-3xl font-black font-headline tracking-tighter text-white uppercase">Batch Processor</h2>
                </div>
                <p className="text-on-surface-variant text-sm font-medium">Mass-synthesize thumbnails from a list of hooks.</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} className="text-on-surface-variant" />
              </button>
            </header>

            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant flex items-center gap-2">
                  <Zap size={12} className="text-highlight" /> Hook Distribution List
                </label>
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="E.g. I WON!, $1 VS $1M, DON'T CLICK!, SECRET REVEALED..."
                  className="w-full bg-black/40 rounded-2xl p-6 text-lg font-bold border border-white/5 text-white placeholder:text-white/10 focus:border-primary/50 outline-none transition-all min-h-[200px] resize-none"
                />
                <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-medium">
                  <AlertCircle size={12} />
                  <span>Separate each thumbnail hook with a comma. Maximum 10 per batch.</span>
                </div>
              </div>

              <div className="p-6 bg-primary/5 border border-primary/10 rounded-2xl">
                <div className="flex gap-4">
                   <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
                      <Zap className="text-primary" size={20} />
                   </div>
                   <p className="text-sm text-on-surface-variant leading-relaxed">
                     The system will inherit your current **Visual Substrate** and **Platform Specs** for all generated artifacts in this batch.
                   </p>
                </div>
              </div>

              <button 
                onClick={handleExecute}
                disabled={isProcessing || !inputText.trim()}
                className="w-full btn-primary !py-6 flex items-center justify-center gap-4 text-xl tracking-tighter"
              >
                {isProcessing ? (
                  <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={24} />
                    <span>INITIALIZE BATCH SYNTHESIS</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
