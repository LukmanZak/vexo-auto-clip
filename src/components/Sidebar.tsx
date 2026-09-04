import React, { useState } from 'react';
import { 
  Palette, 
  Sparkles,
  Zap,
  Monitor,
  Fingerprint,
  BookOpen,
  ImagePlus,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Scissors,
  Eraser
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { useBrand } from '../context/BrandContext';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const { brand } = useBrand();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'System Hub' },
    { id: 'home', icon: Monitor, label: 'Visual Synergist' },
    { id: 'logo', icon: Fingerprint, label: 'Identity Catalyst' },
    { id: 'branding', icon: Sparkles, label: 'Identity Blueprint' },
    { id: 'cover', icon: BookOpen, label: 'Aura Canvas' },
    { id: 'enhancer', icon: ImagePlus, label: 'Lumen Architect' },
    { id: 'slicin', icon: Scissors, label: 'Context Slicer' },
    { id: 'cleaner', icon: Eraser, label: 'Visual Purifier' },
  ];

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isExpanded ? '280px' : '112px' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="h-screen flex flex-col items-center py-10 bg-black/40 backdrop-blur-3xl border-r border-white/5 z-20 relative overflow-x-hidden shrink-0 select-none touch-pan-y"
    >
      {/* Toggle Handle - Redesigned for Maximum Visibility & Premium Feel */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute top-1/2 -right-4 -translate-y-1/2 w-10 h-32 group z-30 cursor-pointer flex items-center justify-center focus:outline-none"
      >
        <div className="relative h-full w-full flex items-center justify-center">
          {/* Main Handle Body - Solid & Glassy */}
          <div className="absolute inset-y-0 right-4 w-3 bg-white/10 backdrop-blur-3xl rounded-full border border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.5)] group-hover:bg-primary/30 group-hover:border-primary/50 transition-all duration-500 group-hover:w-4 group-hover:right-3" />
          
          {/* Active Status Indicator - Thicker & Glowing */}
          <div className="absolute right-[19px] w-1 h-16 bg-primary/40 rounded-full transition-all duration-500 group-hover:h-24 group-hover:bg-primary group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.8)]" />
          
          {/* Icon indicator - Now more stable */}
          <div className="absolute right-7 opacity-20 group-hover:opacity-100 transition-all duration-300 translate-x-1 group-hover:translate-x-0">
            <div className="bg-primary/20 p-2.5 rounded-2xl border border-primary/30 backdrop-blur-3xl shadow-2xl">
              {isExpanded ? (
                <ChevronLeft size={14} className="text-primary" strokeWidth={4} />
              ) : (
                <ChevronRight size={14} className="text-primary" strokeWidth={4} />
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Brand Logo */}
      <div 
        className={`mb-12 relative group transition-all duration-300 ${isExpanded ? 'px-8 w-full flex items-center gap-4' : ''}`}
      >
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative group shrink-0"
        >
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="w-16 h-16 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl relative z-10 overflow-hidden"
          >
            {brand.logo ? (
              <img src={brand.logo} className="w-full h-full object-contain p-2" alt="Brand Logo" referrerPolicy="no-referrer" />
            ) : (
              <Zap className="w-8 h-8 text-primary" fill="currentColor" />
            )}
          </motion.div>
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col cursor-pointer"
            onClick={() => onViewChange('dashboard')}
          >
            <span className="text-xl font-black text-white leading-tight uppercase tracking-tighter">{brand.companyName || 'Vexo'}</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest opacity-60">Creative Suite</span>
          </motion.div>
        )}
      </div>

      <nav className={`flex-1 flex flex-col gap-6 w-full ${isExpanded ? 'px-6' : 'px-4'} overflow-y-auto overflow-x-hidden no-scrollbar pb-8`}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`group relative p-4 rounded-2xl transition-all duration-300 flex items-center ${isExpanded ? 'justify-start gap-4 px-6' : 'justify-center'} ${
              currentView === item.id 
                ? 'bg-primary text-black shadow-[0_10px_30px_rgba(var(--primary-rgb),0.3)]' 
                : 'text-on-surface-variant hover:bg-white/5 hover:text-white'
            }`}
          >
            <item.icon size={26} strokeWidth={currentView === item.id ? 2.5 : 2} className="shrink-0" />
            
            {isExpanded ? (
              <span className={`text-xs font-black uppercase tracking-widest whitespace-nowrap transition-colors ${currentView === item.id ? 'text-black' : 'text-on-surface-variant group-hover:text-white'}`}>
                {item.label}
              </span>
            ) : (
              /* Tooltip only when collapsed */
              <div className="absolute left-full ml-10 px-5 py-3 bg-surface-container text-white text-[10px] font-black uppercase tracking-widest rounded-2xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-[-15px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-2xl border border-white/5 backdrop-blur-xl">
                {item.label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-[8px] border-transparent border-r-surface-container" />
              </div>
            )}

            {!isExpanded && currentView === item.id && (
              <motion.div 
                layoutId="active-nav-indicator"
                className="absolute -right-1 top-1/4 bottom-1/4 w-1 bg-primary rounded-full shadow-[0_0_15px_var(--color-primary)]"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        ))}
      </nav>

      <div className={`mt-auto flex flex-col items-center gap-6 pb-2 w-full ${isExpanded ? 'px-6' : ''}`}>
        <div className="h-px w-full max-w-[40px] bg-white/10" />
        <div className={`w-full flex items-center ${isExpanded ? 'gap-4 px-4 py-3 bg-white/5 rounded-2xl border border-white/10' : 'justify-center'}`}>
          <motion.div 
            whileHover={{ scale: 1.1 }}
            className="w-12 h-12 rounded-2xl border-2 border-primary/20 p-1 overflow-hidden cursor-pointer bg-white/5 transition-colors hover:border-primary shrink-0"
          >
            <img 
              src="https://api.dicebear.com/7.x/shapes/svg?seed=Felix" 
              alt="User" 
              className="w-full h-full object-cover rounded-[0.6rem] bg-surface-container" 
            />
          </motion.div>
          {isExpanded && (
            <div className="flex flex-col truncate">
              <span className="text-xs font-black text-white uppercase tracking-tighter truncate">User Architect</span>
              <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest">Global Admin</span>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
};

