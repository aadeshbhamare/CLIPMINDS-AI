
import { GoogleGenAI, Type } from "@google/genai";
import { MediaItem, BeatMarker, AISceneData } from "./types";

/**
 * Specifically for generating cinematic media for the VIDEO TIMELINE.
 */
export const generateSceneBackground = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    // Highly descriptive prompt for literal interpretation of the user's subject
    const enhancedPrompt = `CINEMATIC MASTERPIECE: A breathtaking, high-resolution 8k photorealistic wide shot of: ${prompt}. 
    Professional cinematography, epic lighting, sharp details, masterwork quality.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: enhancedPrompt }]
      }
    });
    
    let imageUrl = '';
    const candidates = response.candidates || [];
    if (candidates.length > 0 && candidates[0].content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }
    return imageUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070';
  } catch (error) {
    console.error("Scene generation failed:", error);
    return 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070';
  }
};

/**
 * Specifically for generating backgrounds for the WEBSITE/APP UI.
 * Now allows literal subjects (landmarks, specific objects) if specified.
 */
export const generateWebsiteBackground = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    // Modified to be literal yet atmospheric for UI. 
    // Removed "Avoid distinct objects" to allow landmarks like Golden Temple.
    const enhancedPrompt = `PROFESSIONAL UI BACKDROP: A stunning, expansive cinematic image of: ${prompt}. 
    The style should be elegant and atmospheric with beautiful professional lighting. 
    If a location is mentioned, show the iconic location clearly but in a way that feels like a premium desktop wallpaper or software environment background. 
    Maintain a sophisticated color palette.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: enhancedPrompt }]
      }
    });
    
    let imageUrl = '';
    const candidates = response.candidates || [];
    if (candidates.length > 0 && candidates[0].content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }
    return imageUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029';
  } catch (error) {
    console.error("UI Theme generation failed:", error);
    return 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029';
  }
};

/**
 * Robust Multimodal Analysis for Adaptive Matching
 */
export const analyzeMediaForBackground = async (base64DataUrl: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Clean base64 string
  let dataOnly = base64DataUrl;
  let mimeType = 'image/jpeg';

  if (base64DataUrl.includes(',')) {
    const parts = base64DataUrl.split(',');
    dataOnly = parts[1];
    const match = parts[0].match(/:(.*?);/);
    if (match) mimeType = match[1];
  }

  const prompt = `Identify the specific subject, location, and dominant color atmosphere of this image. 
  Describe it in a way that would help an artist recreate a matching atmospheric background. 
  Example: "The Golden Temple at night with glowing golden reflections on water and deep blue sky."`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: dataOnly, mimeType: mimeType } },
          { text: prompt }
        ]
      }
    });
    return response.text.trim();
  } catch (error) {
    console.error("Neural analysis failed:", error);
    return "A modern professional cinematic environment";
  }
};

export const generateAISceneData = async (theme: string, style: string): Promise<AISceneData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Define cinematic typography for a ${style} scene: "${theme}". 
  Provide JSON: title, subtitle, fontSize (40-100), fontFamily (Inter, Oswald, Playfair Display), fontWeight (bold/900), letterSpacing, textColor (hex).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            fontSize: { type: Type.NUMBER },
            fontFamily: { type: Type.STRING },
            fontWeight: { type: Type.STRING },
            letterSpacing: { type: Type.STRING },
            textColor: { type: Type.STRING }
          },
          required: ['title', 'subtitle', 'fontSize', 'fontFamily', 'fontWeight', 'letterSpacing', 'textColor']
        }
      }
    });
    
    const data = JSON.parse(response.text.trim());
    const bgUrl = await generateSceneBackground(`${theme} cinematic ${style} visual`);
    return { ...data, bgUrl };
  } catch (error) {
    return { 
      title: theme, subtitle: "Cinematic Cut", bgUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070', 
      fontSize: 50, fontFamily: 'Inter', fontWeight: '900', letterSpacing: '0.1em', textColor: '#ffffff' 
    };
  }
};

export const analyzeSequenceByPrompt = async (items: MediaItem[], userChoice: string): Promise<number[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Story: "${userChoice}". Order these: ${items.map((it, idx) => `${idx}:${it.name}`).join(', ')}. Return index array JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.INTEGER } }
      }
    });
    return JSON.parse(response.text.trim());
  } catch (error) {
    return items.map((_, i) => i);
  }
};

export const analyzeAudioBeats = async (audioName: string): Promise<BeatMarker[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Detect rhythm points for "${audioName}". Return JSON array of {time, intensity, effect}.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { time: { type: Type.NUMBER }, intensity: { type: Type.NUMBER }, effect: { type: Type.STRING } },
            required: ['time', 'intensity', 'effect']
          }
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch (error) { return []; }
};
