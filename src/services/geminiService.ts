import { GoogleGenAI } from "@google/genai";

let currentApiKey = process.env.GEMINI_API_KEY || '';
let ai = new GoogleGenAI({ apiKey: currentApiKey });

export const updateApiServiceKey = (key: string) => {
  if (key && key !== currentApiKey) {
    currentApiKey = key;
    ai = new GoogleGenAI({ apiKey: currentApiKey });
    console.log("Neural Engine Key Updated");
  }
};

export interface ThumbnailInputs {
  platform: string;
  context: string;
  thumbnailText: string;
  style: string;
  sourceType: 'Upload Image' | 'Image URL' | 'None';
  imageUrl?: string;
  imageFile?: File | null;
}

export const generateThumbnail = async (inputs: ThumbnailInputs) => {
  try {
    let referenceImagePart: any = null;
    let imageDescription = "";

    // If there's an image file or URL, get a description first to guide the generation
    if (inputs.sourceType !== 'None') {
      try {
        if (inputs.sourceType === 'Upload Image' && inputs.imageFile) {
          const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(inputs.imageFile!);
          });

          referenceImagePart = {
            inlineData: {
              data: base64Data,
              mimeType: inputs.imageFile.type
            }
          };

          const visionResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [referenceImagePart, { text: "Describe this image in detail, focusing on composition, colors, and subjects to use as a reference for a new thumbnail." }] }]
          });
          imageDescription = visionResponse.text || "";
        } else if (inputs.sourceType === 'Image URL' && inputs.imageUrl) {
          imageDescription = `Reference image URL: ${inputs.imageUrl}. `;
        }
      } catch (err) {
        console.error("Vision analysis failed:", err);
      }
    }

    // 1. Use Gemini Flash to refine the prompt based on all inputs
    const promptResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a world-class creative director at a top-tier digital marketing agency.
      Create an award-winning, high-conversion image generation prompt for a ${inputs.platform} thumbnail.
      
      ${imageDescription ? `REFERENCE IMAGE CONTEXT: ${imageDescription}` : ''}
      
      Design Brief:
      - Title/Subject: "${inputs.context}"
      - Hook Text: "${inputs.thumbnailText}"
      - Primary Aesthetic: "${inputs.style}"
      
      CREATIVE DIRECTION:
      - CONCEPT: Emphasize the "${inputs.style}" vibe throughout the composition.
      - COMPOSITION: Use professional cinematography rules. Dramatic foreground elements, deep field of view, and a clear focal point that tells a story instantly.
      - LIGHTING: Cinematic "Volumetric" lighting. Use rim lights, high-contrast shadows, and "Golden Hour" or "Cyberpunk Neon" accents depending on the mood.
      - STYLE: A master-class in "${inputs.style}" aesthetic. Blend "Hyper-realistic photography" with high-end digital art techniques.
      - EMOTION: If people are featured, their expressions should be authentic yet intense—eyes that tell a story, high-stakes facial acting.
      - AESTHETIC: Avoid generic "stock photo" looks. Every element should feel curated, expensive, and visually arresting.
      - VIBRANCY: Bold, intentional color palettes. High dynamic range (HDR) feel.
      - CLICK-ABILITY: Infuse "Visual Tension" or "Curiosity Gaps". Make the viewer feel they MUST click to understand.`,
    });

    const refinedPrompt = promptResponse.text || `A viral ${inputs.platform} thumbnail for "${inputs.context}".`;

    // 2. Use Nano Banana (gemini-2.5-flash-image) to generate the image
    const aspectRatio = inputs.platform === 'TikTok' ? "9:16" : (inputs.platform === 'Instagram' ? "1:1" : "16:9");

    const finalPrompt = `
      Create a high-CTR ${inputs.platform} thumbnail.
      
      SUBJECT: "${inputs.context}"
      TEXT TO INCLUDE: "${inputs.thumbnailText}"
      STYLE: ${inputs.style}
      
      VISUAL DIRECTION:
      ${refinedPrompt}
      
      CRITICAL TEXT REQUIREMENTS:
      - The text "${inputs.thumbnailText}" must be EXTREMELY BOLD, massive, and highly legible.
      - Use vibrant colors with strong contrast/outlines.
      - Position it for maximum impact.
      
      ${referenceImagePart ? "Maintain visual consistency with the provided reference image." : ""}
    `;

    const imageParts: any[] = [{ text: finalPrompt }];
    if (referenceImagePart) {
      imageParts.unshift(referenceImagePart);
    }

    const imageResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: imageParts
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        }
      }
    });

    let generatedImageUrl = '';
    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!generatedImageUrl) {
      throw new Error("The Vexo forge failed to crystalize an image. Please refine your inputs.");
    }

    return {
      imageUrl: generatedImageUrl,
      prompt: refinedPrompt
    };
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    throw error;
  }
};

export const analyzeInputs = async (inputs: { context: string }) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a viral growth expert and top-tier YouTube strategist.
      Analyze this video context and project the most psychologically compelling, high-CTR thumbnail text. 
      Focus on extreme curiosity, emotional stakes, or shocking brevity.
      Context: "${inputs.context}"
      
      RULES:
      - Max 3 words.
      - Must feel "Professional" and "Urgent".
      - Use "Pattern Interrupt" language.
      - Return ONLY the hook text.`,
    });
    return response.text?.trim().replace(/['"]/g, '') || "WATCH THIS!";
  } catch (error) {
    console.error("Error analyzing inputs:", error);
    return "WOW!";
  }
};

export interface LogoInputs {
  companyName: string;
  tagline: string;
  style: string;
  logoType?: 'Typography Only' | 'Icon + Text' | 'Icon Only';
  iconDescription?: string;
  objectCategory?: string;
  referenceImage?: File | string | null;
  vibes?: string[];
  artisticStyle?: string;
  colorTheme: string;
  colorPaletteDescription?: string;
  category: string;
}

export const generateLogo = async (inputs: LogoInputs) => {
  try {
    console.log("🛠 Starting Vexo Logo Manifestation:", inputs.companyName);
    
    let referenceImagePart: any = null;
    let imageDescription = "";

    // Handle reference image if provided
    if (inputs.referenceImage) {
      if (typeof inputs.referenceImage !== 'string') {
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(inputs.referenceImage as File);
        });
        referenceImagePart = {
          inlineData: {
            data: base64Data,
            mimeType: (inputs.referenceImage as File).type
          }
        };
      } else if (inputs.referenceImage.startsWith('data:')) {
        referenceImagePart = {
          inlineData: {
            data: inputs.referenceImage.split(',')[1],
            mimeType: inputs.referenceImage.split(';')[0].split(':')[1]
          }
        };
      }

      if (referenceImagePart) {
        try {
          const visionResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [referenceImagePart, { text: "Explain the visual key elements, shapes, and spirit of this logo/sketch to use as a professional reference." }] }]
          });
          imageDescription = visionResponse.text || "";
        } catch (visionErr) {
          console.warn("Vision analysis failed for logo reference:", visionErr);
        }
      }
    }

    // 1. Refine Logo Prompt with more context
    let refinedPrompt = "";
    try {
      const promptResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a legendary Brand Identity Designer (like Paul Rand or Saul Bass).
        Create an award-winning, timeless logo design prompt for "${inputs.companyName}".
        
        STRICT INDUSTRY ALIGNMENT: 
        The logo MUST look like it belongs in the ${inputs.category} industry. 
        - If CATEGORY is Education: Include cues like books, wisdom, growth, shields, or torches.
        - If CATEGORY is Gaming: Use dynamic, bold, energetic, or controller-inspired geometry.
        - If CATEGORY is Finance: Use stability, growth, pillars, or secure geometric shapes.
        - If CATEGORY is Health: Use care, vitality, pulses, or clean organic shapes.
        - If CATEGORY is Tech: Use connectivity, nodes, futuristic lines, or sleek minimalist geometry.
        
        SUBJECT SPECIFICITY:
        The logo subject is "${inputs.iconDescription || inputs.objectCategory}".
        - If SUBJECT is Nature: Focus on organic curves, leaves, mountains, suns, or water. Elements should feel earthy and grounded.
        - If SUBJECT is Abstract: Focus on conceptual geometry, unique interlocking shapes, and patterns that convey a deeper "feeling" rather than a literal object.
        - If SUBJECT is Tech: Focus on digital signals, pixel-perfection, circuit paths, and sleek, high-precision mathematical forms.
        - If SUBJECT is Food: Focus on appetite-stimulating shapes, steam, silverware metaphors, or organic produce cues.
        
        DESIGN PARAMETERS:
        - BRAND NAME: "${inputs.companyName}"
        - TYPE: ${inputs.logoType}
        - CORE SUBJECT: ${inputs.iconDescription ? inputs.iconDescription : `Derive a meaningful symbol/metaphor directly related to the brand name "${inputs.companyName}" and its category "${inputs.category}"`}
        - CATEGORY/NICHE: ${inputs.category}
        - VIBES: ${inputs.vibes.join(', ')}
        - STYLE: ${inputs.artisticStyle}
        - COLOR PALETTE: ${inputs.colorPaletteDescription || inputs.colorTheme}
        - TAGLINE: "${inputs.tagline}"
        ${imageDescription ? `- REF IMAGE CONTEXT: ${imageDescription}` : ''}
        
        CREATIVE STRATEGY:
        - ICONOGRAPHY: ${inputs.logoType === 'Typography Only' ? 'Focus purely on letterforms and negative space within characters.' : `The icon MUST represent the brand "${inputs.companyName}" and its category "${inputs.category}". ${inputs.iconDescription ? `Use the subject "${inputs.iconDescription}".` : `Analyze the name "${inputs.companyName}" and create an icon that makes sense for a ${inputs.category} brand.`}`}
        - TYPOGRAPHY: ${inputs.logoType === 'Icon Only' ? 'No text needed.' : 'Bespoke, high-end lettering. Perfect kerning.'}
        - GEOMETRY: Use the Golden Ratio and mathematical precision.
        - FEEL: It must embody ${inputs.vibes.join(' and ')}.
        - QUALITY: Must be recognizable as a "Top 1% Global Brand". Vector-sharp, minimalist but deeply meaningful.
        - COLOR FIDELITY: Use EXACTLY the following colors for the logo: ${inputs.colorPaletteDescription || inputs.colorTheme}.
        - FINAL OUTPUT: The entire background MUST be pure white.`,
      });
      refinedPrompt = promptResponse.text || "";
    } catch (refineError) {
      console.warn("⚠️ Logo refinement step bypassed:", refineError);
    }

    const finalAestheticPrompt = refinedPrompt || `A masterpiece ${inputs.artisticStyle} logo for ${inputs.companyName}. Type: ${inputs.logoType}. Aesthetic: ${inputs.vibes.join(', ')}.`;
    
    // 2. Generate Logo
    const parts: any[] = [{ text: `A professional, award-winning centered logo design for a company named "${inputs.companyName}" in the ${inputs.category} industry.
    
    CRITICAL MANDATE:
    The resulting logo MUST be recognizable as a branding asset for the ${inputs.category} sector. Use symbols, shapes, and a visual language specifically associated with ${inputs.category}.
    
    BRAND BRIEF:
    - NAME: "${inputs.companyName}"
    - TAGLINE: "${inputs.tagline}"
    - CATEGORY: ${inputs.category}
    - LOGO TYPE: ${inputs.logoType}
    - REQUESTED SUBJECT: ${inputs.iconDescription || `A creative, industry-appropriate icon for ${inputs.category} that represents "${inputs.companyName}"`}
    
    AESTHETIC DNA:
    - PRIMARY STYLE: ${inputs.artisticStyle}
    - CORE VIBES: ${inputs.vibes.join(', ')}
    - LOGO COLOR PALETTE: ${inputs.colorPaletteDescription || inputs.colorTheme}
    - BACKGROUND: PURE SOLID WHITE
    
    VISUAL CUES BY SUBJECT:
    ${inputs.objectCategory === 'Nature' ? '- Use organic flow, natural geometry, and earth-balanced proportions.' : ''}
    ${inputs.objectCategory === 'Abstract' ? '- Use unique conceptual forms, negative space artistry, and symbolic geometry.' : ''}
    ${inputs.objectCategory === 'Tech' ? '- Use digital precision, sharp nodes, integrated circuit patterns, and modern sleekness.' : ''}
    ${inputs.objectCategory === 'Food' ? '- Use appetizing curves, clean organic iconography, and welcoming visual metaphors.' : ''}
    
    DESIGN EXECUTION:
    - ${finalAestheticPrompt}
    - The design must be perfectly centered on a PURE SOLID WHITE background.
    - The color theme "${inputs.colorPaletteDescription || inputs.colorTheme}" must be applied ONLY to the logo icon and typography.
    - Minimalist but deeply premium.
    - Ensure the logo subject is directly relevant to both the brand name "${inputs.companyName}" and the ${inputs.category} industry.
    - No background textures, no gradients in the background, strictly solid white.
    - ${inputs.logoType === 'Typography Only' ? 'DO NOT include any icons. Focus entirely on creative typography for the brand name.' : ''}
    ${inputs.logoType === 'Icon Only' ? 'DO NOT include any text. Create only a profound, minimalist icon/emblem.' : ''}
    ${inputs.logoType === 'Icon + Text' ? 'Intelligently combine the brand name with a creative icon.' : ''}
    ` }];

    if (referenceImagePart) {
      parts.unshift(referenceImagePart);
    }

    const imageResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    let generatedImageUrl = '';
    const responseParts = imageResponse.candidates?.[0]?.content?.parts || [];
    for (const part of responseParts) {
      if (part.inlineData) {
        generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!generatedImageUrl) {
      throw new Error("Visual manifestation failed. The neural engine returned no artifact.");
    }

    return {
      imageUrl: generatedImageUrl,
      prompt: finalAestheticPrompt
    };
  } catch (error: any) {
    console.error("🔥 Error generating logo:", error);
    if (error?.message?.includes("Safety") || error?.message?.includes("blocked")) {
      throw new Error("The synthesis was blocked by safety protocols. Please try different terms.");
    }
    throw new Error(error?.message || "An unexpected error occurred during neural synthesis.");
  }
};

export interface MockupInputs {
  logoUrl: string;
  category: string;
  companyName: string;
}

export const generateMockup = async (inputs: MockupInputs) => {
  try {
    const base64Data = inputs.logoUrl.includes(',') ? inputs.logoUrl.split(',')[1] : inputs.logoUrl;
    const logoPart = {
      inlineData: {
        data: base64Data,
        mimeType: 'image/png'
      }
    };

    let categoryItems = `
      - A premium cotton T-shirt prominently displayed.
      - A clean tote bag or high-end backpack.
      - A coffee mug or stainless steel water bottle.
      - A minimalist notebook or stationery set.
    `;

    if (inputs.category === 'Education') {
      categoryItems = `
        - A stack of premium hardback books with the logo on the spine and cover.
        - A high-end student backpack with a leather patch featuring the logo.
        - A modern tablet or laptop with the logo as a decal.
        - A minimalist pencil case and a set of professional pens.
      `;
    } else if (inputs.category === 'Tech & AI') {
      categoryItems = `
        - A sleek, high-end laptop with the logo prominently on the lid.
        - A smartphone or tablet showing a branded app icon.
        - A futuristic VR headset or smart device with discrete branding.
        - A minimalist magnetic cable organizer or tech pouch with the logo.
      `;
    } else if (inputs.category === 'Gaming') {
      categoryItems = `
        - A professional gaming controller with a backlit logo.
        - A high-fidelity gaming headset with the logo on the earcups.
        - A custom mechanical keyboard with a branded escaped key or chassis.
        - A premium oversized desk mat featuring the brand's visual identity.
      `;
    } else if (inputs.category === 'Finance') {
      categoryItems = `
        - A premium metal credit card featuring the logo.
        - A sleek leather wallet with an embossed logo.
        - A high-end fountain pen with an engraved logo on the barrel.
        - A professional leather-bound portfolio or planner.
      `;
    } else if (inputs.category === 'Finance') {
      categoryItems = `
        - A premium metal credit card featuring the logo.
        - A sleek leather wallet with an embossed logo.
        - A high-end fountain pen with an engraved logo on the barrel.
        - A professional leather-bound portfolio or planner.
      `;
    } else if (inputs.category === 'Lifestyle') {
      categoryItems = `
        - A luxury perfume or skincare bottle with a branded label.
        - A premium yoga mat or gym bag with the logo.
        - A high-end scented candle with a minimalist branded label.
        - A sleek water bottle or apparel item with the logo.
      `;
    }

    const prompt = `
      Create a world-class, editorial-style branding manifestation display for "${inputs.companyName}".
      Niche: "${inputs.category}"
      
      ATMOSPHERE:
      High-end, architectural photography style. Soft ambient lighting, shallow depth of field (bokeh), and premium textures. No clutter. 
      
      SCENE COMPOSITION:
      - A curated arrangement of premium, tangible products that reflect a "Billion-Dollar Brand" in the ${inputs.category} sector.
      - PRODUCT LIST: ${categoryItems}
      
      BRANDING EXECUTION:
      - Apply the provided logo with extreme realism. Use premium techniques: Gold Foil, Blind Embossing, Laser Engraving, or High-Density Screen Printing.
      - The logo should feel "intertwined" with the materials, not just an overlay.
      - Reflect the lighting and texture of the surface (e.g., logo reflecting off glass or catching light on textured paper).
      
      QUALITY:
      8k resolution, cinematic lighting, shot on a high-end phase-one camera. This is for an award-winning brand identity showcase.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [logoPart, { text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        }
      }
    });

    let generatedImageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!generatedImageUrl) {
      throw new Error("Branding display synthesis failed.");
    }

    return generatedImageUrl;
  } catch (error) {
    console.error("Error generating mockup:", error);
    throw error;
  }
};

export interface CoverInputs {
  title: string;
  subtitle: string;
  category: string;
  style: string;
  author?: string;
}

export const generateCover = async (inputs: CoverInputs) => {
  try {
    const promptResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a world-class Graphic Designer and Art Director specializing in premium A4 document covers, professional posters, and digital asset design.
      Design a high-fidelity, FLAT A4 document cover (This is a 2D document page, NOT a 3D book cover) for:
      
      DOCUMENT METADATA:
      - Title: "${inputs.title}"
      - Description/Subtitle: "${inputs.subtitle}"
      - Category: "${inputs.category}"
      - Style: "${inputs.style}"
      ${inputs.author ? `- Credits: "${inputs.author}"` : ''}

      VISUAL DNA & CATEGORY CONTEXT:
      - If ${inputs.category} is Education: Use clean, structured layouts, perhaps academic metaphors or growth symbols that reflect "${inputs.title}".
      - If ${inputs.category} is Tech & AI: Use futuristic nodes, digital gradients, and sleek geometric patterns related to "${inputs.title}".
      - If ${inputs.category} is Finance: Use stability-focused imagery, sophisticated grids, and trust-evoking professional color palettes.
      - If ${inputs.category} is Gaming: Use high-energy visuals, dynamic perspectives, and bold, punchy aesthetics.
      - If ${inputs.category} is Lifestyle: Use high-end photography-style visuals, elegant typography, and airy, modern compositions.

      CREATIVE SPECIFICATIONS:
      - FLAT PRESENTATION: This is a front-facing, flat A4 page. DO NOT show any book spines, pages, or 3D thickness.
      - TYPOGRAPHY: Treat the text "${inputs.title}" as a premium branding element. It must be legible but artistic.
      - HIERARCHY: Perfect visual hierarchy. The title should be dominant, followed by the description "${inputs.subtitle}".
      - QUALITY: 8k digital masterpiece. Sharp, professional, and commercial-grade output.`,
    });

    const refinedPrompt = promptResponse.text || `A flat A4 professional document cover for "${inputs.title}". Style: ${inputs.style}. Industry: ${inputs.category}. No 3D book effects.`;

    const imageResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: refinedPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
        }
      }
    });

    let generatedImageUrl = '';
    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!generatedImageUrl) {
      throw new Error("Prestige cover synthesis failed.");
    }

    return {
      imageUrl: generatedImageUrl,
      prompt: refinedPrompt
    };
  } catch (error) {
    console.error("Error generating cover:", error);
    throw error;
  }
};

export interface EnhanceInputs {
  imageFile?: File | null;
  imageUrl?: string;
  sourceType: 'upload' | 'url';
  instructions: string;
}

export const enhancePhoto = async (inputs: EnhanceInputs) => {
  try {
    let imagePart: any = null;

    if (inputs.sourceType === 'upload' && inputs.imageFile) {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(inputs.imageFile!);
      });

      imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: inputs.imageFile.type
        }
      };
    } else if (inputs.sourceType === 'url' && inputs.imageUrl) {
      // In a real app we might need to fetch and convert to base64 if not possible directly
      // For now, we assume provide a prompt describing the enhancement
    }

    const editPrompt = `
      You are a World-Class Master Photo Retoucher and Digital Imaging Artist (Vogue, Harper's Bazaar style).
      Transform this image into a HIGH-END PROFESSIONAL DSLR PHOTOGRAPH.
      
      CORE MANDATE: 
      The resulting image MUST look like it was shot with a high-end full-frame DSLR (e.g., Canon EOS R5 or Sony A7R IV) using a premium prime lens (e.g., 85mm f/1.2 or 35mm f/1.4).
      
      USER INSTRUCTIONS (OPTIONAL MODIFIERS): 
      "${inputs.instructions || "Enhance to absolute professional quality."}"
      
      TECHNICAL REQUIREMENTS:
      - SENSITIVITY: 100% natural texture preservation. No "AI waxiness". Maintain skin pores, micro-hairs, and authentic material grain.
      - OPTICS: Mimic the bokeh and shallow depth of field of a professional prime lens. Natural optical fall-off.
      - LIGHTING: Apply cinematic "Dodge and Burn". Enhance three-dimensionality (3D pop). Use volumetric light rays if appropriate.
      - COLOR SCIENCE: Professional commercial color grading. Deep shadows, vibrant but natural highlights, and perfect skin tones.
      - RETOUCHING: Remove all distractions and clutter as requested: "${inputs.instructions}".
      - SHARPNESS: Razor-sharp focus on the primary subject (especially eyes if people are present) with professional lens clarity.
      - FINAL VIBE: This must be a "Billion-Dollar Campaign" quality shot. Extremely high aesthetic value.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [imagePart, { text: editPrompt }].filter(Boolean)
      }
    });

    let generatedImageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!generatedImageUrl) {
      throw new Error("Digital retoucher failed to process the image.");
    }

    return generatedImageUrl;
  } catch (error) {
    console.error("Error enhancing photo:", error);
    throw error;
  }
};
