import React from 'react';
import { motion } from 'motion/react';
import { Check, Zap, Cpu, Search, Sparkles } from 'lucide-react';

interface ProcessingViewProps {
  progress: number;
  context?: string;
  platform?: string;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({ progress, context, platform }) => {
  const getLoadingMessage = () => {
    if (progress <= 30) return `Decrypting Concept: "${context || 'VEXO Protocol'}"...`;
    if (progress <= 70) return `Injecting Visual Patterns for ${platform || 'Target Display'}...`;
    return `Finalizing Synthesis & Optical Calibration...`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center p-12 text-center h-full relative"
    >
      {/* Background Glow */}
      <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full scale-50 animate-pulse" />

      <div className="relative w-80 h-80 mb-16">
        {/* Outer Ring */}
        <svg className="w-full h-full absolute inset-0 rotate-[-90deg]" viewBox="0 0 100 100">
          <circle 
            cx="50" cy="50" r="48" 
            fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" 
          />
          <motion.circle 
            cx="50" cy="50" r="48" 
            fill="none" stroke="var(--color-primary)" strokeWidth="2" 
            strokeDasharray="301.6"
            strokeDashoffset={301.6 - (301.6 * progress) / 100}
            strokeLinecap="round"
            className="drop-shadow-[0_0_8px_var(--color-primary)]"
          />
        </svg>

        {/* Inner Rotating Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute inset-4 border border-dashed border-white/10 rounded-full"
        />

        {/* Center Core */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-7xl font-black font-headline tracking-tighter text-white"
          >
            {Math.round(progress)}<span className="text-2xl text-primary">%</span>
          </motion.div>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-1 h-1 bg-primary rounded-full animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-on-surface-variant">Syncing</span>
          </div>
        </div>
      </div>

      <div className="space-y-6 max-w-2xl relative z-10">
        <h2 className="text-4xl font-black font-headline tracking-tighter text-white">
          SYNTHESIZING <span className="text-gradient">REALITY</span>
        </h2>
        <div className="flex items-center justify-center gap-4 text-on-surface-variant h-8">
          <span className="text-sm font-bold tracking-wide italic opacity-80">{getLoadingMessage()}</span>
        </div>
      </div>

      {/* Process Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-20">
        {[
          { label: `Concept Analysis`, icon: Search, status: progress > 30 ? 'DONE' : 'ACTIVE', active: progress <= 30 },
          { label: `Integrated Rendering`, icon: Cpu, status: progress > 70 ? 'DONE' : (progress > 30 ? 'ACTIVE' : 'PENDING'), active: progress > 30 && progress <= 70 },
          { label: `Optical Master`, icon: Sparkles, status: progress === 100 ? 'DONE' : (progress > 70 ? 'ACTIVE' : 'PENDING'), active: progress > 70 },
        ].map((step, i) => (
          <motion.div 
            key={step.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.2 }}
            className={`p-8 rounded-[2rem] border-2 transition-all duration-500 relative overflow-hidden ${
              step.status === 'ACTIVE' 
                ? 'bg-primary/5 border-primary shadow-[0_0_40px_rgba(244,114,182,0.1)]' 
                : step.status === 'DONE'
                  ? 'bg-white/5 border-white/10 opacity-100'
                  : 'bg-white/[0.02] border-transparent opacity-30'
            }`}
          >
            {step.status === 'ACTIVE' && (
              <motion.div 
                animate={{ opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-primary"
              />
            )}
            
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <div className={`p-3 rounded-xl ${step.status === 'ACTIVE' ? 'bg-primary text-white' : 'bg-white/5 text-on-surface-variant'}`}>
                  <step.icon size={20} />
                </div>
                {step.status === 'DONE' && <Check size={20} className="text-primary" />}
              </div>
              <div className="text-left">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-1">{step.status}</div>
                <div className="text-lg font-black text-white leading-tight">{step.label}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

