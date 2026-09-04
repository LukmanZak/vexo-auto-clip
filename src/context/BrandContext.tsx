import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BrandKit {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontHeadline: string;
  fontBody: string;
  logo: string | null;
  category: string;
  companyName: string;
  tagline: string;
}

interface BrandContextType {
  brand: BrandKit;
  updateBrand: (newBrand: Partial<BrandKit>) => void;
  applyBrand: (targetBrand?: BrandKit) => void;
}

const defaultBrand: BrandKit = {
  primaryColor: '#3b82f6',
  secondaryColor: '#22d3ee',
  accentColor: '#facc15',
  fontHeadline: 'Outfit',
  fontBody: 'Space Grotesk',
  logo: '/Vexo_New.png',
  category: 'Creativity',
  companyName: 'Vexo',
  tagline: 'Neural Visual Studio',
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export const BrandProvider = ({ children }: { children: ReactNode }) => {
  const [brand, setBrand] = useState<BrandKit>(defaultBrand);

  const updateBrand = (newBrand: Partial<BrandKit>) => {
    setBrand(prev => ({ ...prev, ...newBrand }));
  };

  const applyBrand = (targetBrand?: BrandKit) => {
    const b = targetBrand || brand;
    if (targetBrand) {
      setBrand(targetBrand);
    }
    
    // Safety check for color values
    const safeColor = (c: string,fallback: string) => c.startsWith('#') || c.startsWith('rgb') ? c : fallback;

    // Update CSS variables globally
    document.documentElement.style.setProperty('--color-primary', safeColor(b.primaryColor, '#3b82f6'));
    document.documentElement.style.setProperty('--color-secondary', safeColor(b.secondaryColor, '#22d3ee'));
    document.documentElement.style.setProperty('--color-highlight', safeColor(b.accentColor, '#facc15'));
    document.documentElement.style.setProperty('--font-headline', `"${b.fontHeadline}", sans-serif`);
    document.documentElement.style.setProperty('--font-sans', `"${b.fontBody}", sans-serif`);
    
    console.log('🧬 Brand Genetics Synchronized:', {
      primary: b.primaryColor,
      secondary: b.secondaryColor,
      fonts: `${b.fontHeadline} / ${b.fontBody}`,
      identity: b.companyName,
      logo: b.logo ? `Active (${b.logo.length} bytes)` : 'Inactive'
    });

    // Verify application
    const computed = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
    console.log('✅ Applied Primary Color:', computed);
  };

  React.useEffect(() => {
    applyBrand();
  }, []);

  return (
    <BrandContext.Provider value={{ brand, updateBrand, applyBrand }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
};
