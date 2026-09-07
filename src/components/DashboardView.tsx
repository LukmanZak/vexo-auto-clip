import React from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  Monitor, 
  Fingerprint, 
  Sparkles, 
  BookOpen, 
  ImagePlus,
  ArrowRight,
  Activity,
  Zap,
  Globe,
  Scissors,
  Eraser
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl flex items-center gap-6"
  >
    <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-white shadow-lg`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  </motion.div>
);

interface ProjectCardProps {
  id: string;
  title: string;
  description: string;
  icon: any;
  onNavigate: (id: string) => void;
  stats: string;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
  id, 
  title, 
  description, 
  icon: Icon, 
  onNavigate,
  stats
}) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    onClick={() => onNavigate(id)}
    className="glass-card p-1 group cursor-pointer overflow-hidden"
  >
    <div className="bg-white/[0.02] p-8 rounded-[2.2rem] h-full flex flex-col transition-colors group-hover:bg-white/5">
      <div className="flex items-start justify-between mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-all">
          <Icon size={32} />
        </div>
        <div className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black text-on-surface-variant group-hover:text-white transition-colors">
          {stats}
        </div>
      </div>
      
      <h3 className="text-2xl font-black text-white mb-3 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-on-surface-variant text-sm font-medium mb-8 flex-1 leading-relaxed">
        {description}
      </p>
      
      <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest group-hover:gap-4 transition-all">
        Launch Project <ArrowRight size={14} />
      </div>
    </div>
  </motion.div>
);

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const projects = [
    {
      id: 'home',
      title: 'Visual Synergizer',
      description: 'Generate high-CTR visuals optimized for global distribution using visual hooks and viral synergy.',
      icon: Monitor,
      stats: '4.2k Manifestations'
    },
    {
      id: 'logo',
      title: 'Identity Catalyst',
      description: 'Forge industry-aligned brand icons and minimalist typography designed for instant recognition.',
      icon: Fingerprint,
      stats: '1.8k Logos'
    },
    {
      id: 'branding',
      title: 'Genetic Blueprint',
      description: 'Synchronize global design DNA, constants, and identities across your entire digital organism.',
      icon: Sparkles,
      stats: '92 Kits'
    },
    {
      id: 'cover',
      title: 'Aura Canvas',
      description: 'Design professional document shells and archival posters with architectural precision.',
      icon: BookOpen,
      stats: '640 Covers'
    },
    {
      id: 'enhancer',
      title: 'Lumen Architect',
      description: 'Reconstruct visual data to professional DSLR quality using advanced refinement protocols.',
      icon: ImagePlus,
      stats: '12k Enhanced'
    },
    {
      id: 'slicin',
      title: 'Context Slicer',
      description: 'Extract viral highlights from long-form video using contextual analysis and smart cutting.',
      icon: Scissors,
      stats: 'New Engine'
    },
    {
      id: 'cleaner',
      title: 'Visual Purifier',
      description: 'Remove dominant background colors from video streams to isolate active subjects and subjects.',
      icon: Eraser,
      stats: 'Chroma Alpha'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-12 py-16 space-y-16">
      {/* Welcome Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-4"
          >
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">System Operational</span>
          </motion.div>
          <h1 className="text-6xl font-black font-headline tracking-tighter mb-4">
            VEXO <span className="text-gradient">DASHBOARD</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-xl font-medium">
            Welcome back, Architect. Your integrated creative suite is fully synchronized and ready for manifestation.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button className="bg-white/5 border border-white/10 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-colors">
            View Analytics
          </button>
          <button className="bg-primary text-black px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg">
            Global Export
          </button>
        </div>
      </section>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Projects" value="482" icon={Activity} color="bg-blue-500" />
        <StatCard label="System Compute" value="98.2%" icon={Zap} color="bg-yellow-500" />
        <StatCard label="Global Reach" value="1.2M" icon={Globe} color="bg-purple-500" />
        <StatCard label="Active Tokens" value="2,401" icon={BarChart3} color="bg-green-500" />
      </div>

      {/* Projects Grid */}
      <section className="space-y-10">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black uppercase tracking-tighter">MANIFESTATION CORE</h2>
          <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
            Select a project core to begin
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => (
            <ProjectCard 
              key={project.id}
              id={project.id}
              title={project.title}
              description={project.description}
              icon={project.icon}
              onNavigate={onNavigate}
              stats={project.stats}
            />
          ))}
        </div>
      </section>

      {/* Recent Activity Mini-Section */}
      <section className="glass-card p-10 bg-white/[0.02]">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter">System Pulse</h3>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Real-time system activity</p>
          </div>
        </div>
        
        <div className="space-y-4">
          {[
            { tag: 'THUMBNAIL', label: 'MrBeast Style Synthesis completed in 4.2s', time: '2m ago' },
            { tag: 'LOGO', label: 'Tech Icon Manifestation finalized for Project Nova', time: '12m ago' },
            { tag: 'BRAND', label: 'Global CSS variables synchronized across all nodes', time: '45m ago' }
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-4">
                <span className="bg-primary/20 text-primary text-[8px] font-black px-2 py-1 rounded-lg">
                  {item.tag}
                </span>
                <span className="text-sm font-medium text-white/80">{item.label}</span>
              </div>
              <span className="text-[10px] font-medium text-on-surface-variant">{item.time}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
