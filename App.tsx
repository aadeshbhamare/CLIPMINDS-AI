
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Plus, Play, Pause, Trash2, Film, Music, Download, Settings, Sparkles, Scissors,
  Wand2, Layout, Palette, Zap, Layers, Type, MoveHorizontal, ChevronRight,
  Repeat, Loader2, X, FileCheck, Clock, Music2, Image as ImageIcon, CheckCircle2,
  Minus, Plus as PlusIcon, AlignLeft, AlignCenter, AlignRight, Monitor, RefreshCw,
  LayoutTemplate, ImagePlus, Type as TypeIcon, ZoomIn, Maximize, Scaling, Frame,
  ChevronUp, ChevronDown, Layers3, MousePointer2, ArrowUp, ArrowDown, Move,
  Palette as PaletteIcon, FastForward, Rewind, Timer, Replace, Hash, Droplets,
  Type as FontIcon, Move3d, Box, Wand, Sliders, MonitorPlay, Smartphone, Square,
  Tv, Clapperboard, Activity
} from 'lucide-react';
import { 
  MediaItem, AudioTrack, ProjectSettings, AspectRatio, FitMode,
  VisualEffect, TextAnimationEffect, BeatMarker 
} from './types';
import { 
  analyzeSequenceByPrompt, analyzeAudioBeats, generateAISceneData, generateWebsiteBackground, analyzeMediaForBackground
} from './geminiService';
import { fastRenderVideo } from './exportEngine';

const FONTS = ['Inter', 'Oswald', 'Playfair Display', 'Serif', 'Monospace', 'cursive'];

const EFFECTS: { id: VisualEffect; label: string; filter: string }[] = [
  { id: 'none', label: 'Original', filter: 'none' },
  { id: 'vibrant', label: 'Vibrant', filter: 'saturate(1.8) contrast(1.1)' },
  { id: 'monochrome', label: 'B&W', filter: 'grayscale(1) contrast(1.2)' },
  { id: 'vintage', label: 'Vintage', filter: 'sepia(0.5) contrast(0.9) brightness(1.1)' },
  { id: 'retro', label: 'Retro', filter: 'hue-rotate(-30deg) saturate(1.4) contrast(1.1)' },
  { id: 'elegant', label: 'Elegant', filter: 'brightness(1.05) contrast(0.95) saturate(0.8)' },
  { id: 'pop', label: 'Pop Art', filter: 'saturate(2) contrast(1.2)' },
  { id: 'glitch', label: 'Glitch FX', filter: 'hue-rotate(90deg) contrast(1.5)' },
  { id: 'blur', label: 'Soft Focus', filter: 'blur(4px)' },
  { id: 'zoom', label: 'Impact Zoom', filter: 'contrast(1.3) brightness(1.1)' }
];

const ANIMATIONS: { id: TextAnimationEffect; label: string }[] = [
  { id: 'none', label: 'Static' },
  { id: 'reveal', label: 'LAL Reveal' },
  { id: 'typewriter', label: 'LAL Typewriter' },
  { id: 'bounce', label: 'LAL Bounce' },
  { id: 'glitch', label: 'LAL Glitch' },
  { id: 'flicker', label: 'LAL Flicker' },
  { id: 'wave', label: 'LAL Wave' },
  { id: 'zoom', label: 'LAL Zoom' },
];

const FIT_MODES: { id: FitMode; label: string }[] = [
  { id: 'cover', label: 'Cover (Fill)' },
  { id: 'contain', label: 'Contain (Letterbox)' },
  { id: 'fill', label: 'Stretch to Fill' },
  { id: 'fit', label: 'Fit to View' }
];

const ASPECT_RATIO_CONFIGS: { id: AspectRatio; label: string; icon: React.ReactNode }[] = [
  { id: '16:9', label: 'Widescreen (16:9)', icon: <MonitorPlay size={20}/> },
  { id: '9:16', label: 'Vertical (9:16)', icon: <Smartphone size={20}/> },
  { id: '1:1', label: 'Square (1:1)', icon: <Square size={20}/> },
  { id: '4:5', label: 'Social (4:5)', icon: <Smartphone size={20}/> },
  { id: '21:9', label: 'Cinematic (21:9)', icon: <Clapperboard size={20}/> },
  { id: '3:4', label: 'Classic (3:4)', icon: <Tv size={20}/> },
  { id: '2:3', label: 'Portrait (2:3)', icon: <Smartphone size={20}/> },
];

const App: React.FC = () => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [audioBuffers, setAudioBuffers] = useState<Record<string, AudioBuffer>>({});
  const [beatMarkers, setBeatMarkers] = useState<Record<string, BeatMarker[]>>({});
  const [settings, setSettings] = useState<ProjectSettings>({
    aspectRatio: '16:9',
    fitMode: 'cover',
    quality: 'hd'
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0); 
  const [activeTab, setActiveTab] = useState<'curate' | 'audio' | 'neural' | 'settings'>('curate');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [siteBgPrompt, setSiteBgPrompt] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState<'idle' | 'rendering' | 'finished'>('idle');
  const [generatedFileUrl, setGeneratedFileUrl] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const lastActiveAudioIdRef = useRef<string | null>(null);
  
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(performance.now());
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const imageRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);

  const assetTimeline = useMemo(() => {
    let acc = 0;
    return [...mediaItems].sort((a, b) => a.order - b.order).map((item) => {
      const start = acc;
      const end = start + item.duration;
      acc = end;
      return { ...item, globalStart: start, globalEnd: end };
    });
  }, [mediaItems]);

  const audioTimeline = useMemo(() => {
    return [...audioTracks].sort((a,b) => a.timelineStart - b.timelineStart).map((track) => {
      const activeDuration = track.trimEnd - track.trimStart;
      const globalStart = track.timelineStart;
      const globalEnd = globalStart + activeDuration;
      return { ...track, globalStart, globalEnd, activeDuration };
    });
  }, [audioTracks]);

  const totalDuration = useMemo(() => {
    const mediaEnd = assetTimeline.length > 0 ? assetTimeline[assetTimeline.length - 1].globalEnd : 0;
    return Math.max(mediaEnd, 0.1);
  }, [assetTimeline]);

  const assetTimelineRef = useRef(assetTimeline);
  const audioTimelineRef = useRef(audioTimeline);
  const totalDurationRef = useRef(totalDuration);
  
  useEffect(() => { assetTimelineRef.current = assetTimeline; }, [assetTimeline]);
  useEffect(() => { audioTimelineRef.current = audioTimeline; }, [audioTimeline]);
  useEffect(() => { totalDurationRef.current = totalDuration; }, [totalDuration]);

  const activeAsset = useMemo(() => {
    return assetTimeline.find(a => currentTime >= a.globalStart && currentTime < a.globalEnd) || assetTimeline[0] || null;
  }, [assetTimeline, currentTime]);

  const selectedItem = useMemo(() => {
    return mediaItems.find(it => it.id === selectedItemId) || null;
  }, [mediaItems, selectedItemId]);

  const isBeatActive = useMemo(() => {
    if (!isPlaying) return false;
    for (const track of audioTimeline) {
      if (currentTime >= track.globalStart && currentTime < track.globalEnd) {
        const markers = beatMarkers[track.id];
        if (markers) {
          const localTime = currentTime - track.globalStart + track.trimStart;
          // Pulse window of 100ms for responsiveness
          return markers.some(m => Math.abs(m.time - localTime) < 0.1);
        }
      }
    }
    return false;
  }, [audioTimeline, beatMarkers, currentTime, isPlaying]);

  const initAudioEngine = () => {
    if (audioCtxRef.current) return audioCtxRef.current;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const compressor = ctx.createDynamicsCompressor();
      compressor.connect(ctx.destination);
      audioCtxRef.current = ctx;
      compressorRef.current = compressor;
      return ctx;
    } catch (e) { return null; }
  };

  const stopActiveAudioSource = () => {
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch(e) {}
      activeSourceRef.current.disconnect();
      activeSourceRef.current = null;
    }
  };

  const playBufferedAudio = (trackId: string, offset: number) => {
    const ctx = initAudioEngine();
    const buffer = audioBuffers[trackId];
    if (!ctx || !buffer) return;
    stopActiveAudioSource();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(compressorRef.current!);
    const clampedOffset = Math.max(0, Math.min(offset, buffer.duration));
    source.start(0, clampedOffset);
    activeSourceRef.current = source;
  };

  const playbackLoop = (timestamp: number) => {
    if (!isPlaying) return;
    const dt = (timestamp - lastUpdateRef.current) / 1000;
    lastUpdateRef.current = timestamp;
    currentTimeRef.current += dt;
    const nextGlobalTime = currentTimeRef.current;

    const currentAudioTimeline = audioTimelineRef.current;
    const currentAssetTimeline = assetTimelineRef.current;
    const currentTotalDuration = totalDurationRef.current;

    const currentActiveAudio = currentAudioTimeline.find(a => nextGlobalTime >= a.globalStart && nextGlobalTime < a.globalEnd);
    if (currentActiveAudio) {
      if (currentActiveAudio.id !== lastActiveAudioIdRef.current) {
        const hardwarePos = currentActiveAudio.trimStart + (nextGlobalTime - currentActiveAudio.globalStart);
        playBufferedAudio(currentActiveAudio.id, hardwarePos);
        lastActiveAudioIdRef.current = currentActiveAudio.id;
      }
    } else if (lastActiveAudioIdRef.current) {
      stopActiveAudioSource();
      lastActiveAudioIdRef.current = null;
    }

    const currentActiveAsset = currentAssetTimeline.find(a => nextGlobalTime >= a.globalStart && nextGlobalTime < a.globalEnd);
    if (currentActiveAsset?.type === 'video') {
      const v = videoRefs.current[currentActiveAsset.id];
      if (v) {
        const targetLocalTime = nextGlobalTime - currentActiveAsset.globalStart;
        if (Math.abs(v.currentTime - targetLocalTime) > 0.15) {
          v.currentTime = targetLocalTime;
        }
        if (v.paused) {
          v.play().catch(() => {});
        }
      }
    } else {
      Object.values(videoRefs.current).forEach(v => {
        if (v && !v.paused) v.pause();
      });
    }

    if (nextGlobalTime >= currentTotalDuration) {
      setIsPlaying(false);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      stopActiveAudioSource();
      lastActiveAudioIdRef.current = null;
      return;
    }

    setCurrentTime(nextGlobalTime);
    rafRef.current = requestAnimationFrame(playbackLoop);
  };

  const togglePlayback = () => {
    const nextState = !isPlaying;
    if (nextState) {
      const ctx = initAudioEngine();
      if (ctx) ctx.resume();
    }
    setIsPlaying(nextState);
  };

  useEffect(() => {
    if (isPlaying) {
      lastUpdateRef.current = performance.now();
      currentTimeRef.current = currentTime;
      const startAudio = audioTimelineRef.current.find(a => currentTime >= a.globalStart && currentTime < a.globalEnd);
      if (startAudio) {
        const hardwarePos = startAudio.trimStart + (currentTime - startAudio.globalStart);
        playBufferedAudio(startAudio.id, hardwarePos);
        lastActiveAudioIdRef.current = startAudio.id;
      }
      if (!rafRef.current) rafRef.current = requestAnimationFrame(playbackLoop);
    } else {
      stopActiveAudioSource();
      lastActiveAudioIdRef.current = null;
      if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
      }
      Object.values(videoRefs.current).forEach(v => v?.pause());
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    files.forEach(async (file, fIdx) => {
      const type = file.type.startsWith('video') ? 'video' : 'image';
      let duration = 5;
      const url = URL.createObjectURL(file);
      if (type === 'video') {
        const v = document.createElement('video');
        v.src = url;
        v.crossOrigin = 'anonymous';
        await new Promise(r => v.onloadedmetadata = r);
        duration = v.duration;
      }
      const finalBase64 = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result as string);
          r.readAsDataURL(file);
      });

      const newItem: MediaItem = {
        id: Math.random().toString(36).substr(2, 9),
        url, type, name: file.name,
        duration: Math.min(duration, 10),
        locked: false, order: mediaItems.length + fIdx,
        effect: 'none', scaleMode: settings.fitMode || 'cover',
        overlayX: 50, overlayY: 50, overlayTextSize: 60, fontFamily: 'Inter',
        fontWeight: '900', letterSpacing: '0.1em',
        compositeScale: 40, compositeX: 50, compositeY: 50,
        overlayTextColor: '#ffffff', overlaySubtextColor: '#cccccc', overlayBgColor: 'transparent',
        overlayAnimation: 'reveal', overlayAnimationSpeed: 1,
        base64: finalBase64
      };
      setMediaItems(prev => [...prev, newItem].sort((a, b) => a.order - b.order));
    });
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const ctx = initAudioEngine() || new (window.AudioContext || (window as any).webkitAudioContext)();
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const trackId = Math.random().toString(36).substr(2, 9);
        
        setIsProcessing(true);
        analyzeAudioBeats(file.name).then(markers => {
          setBeatMarkers(prev => ({ ...prev, [trackId]: markers }));
          setIsProcessing(false);
        }).catch(() => setIsProcessing(false));

        setAudioBuffers(prev => ({ ...prev, [trackId]: audioBuffer }));
        setAudioTracks(prev => [...prev, {
          id: trackId, url: URL.createObjectURL(file), name: file.name,
          duration: audioBuffer.duration, trimStart: 0, trimEnd: audioBuffer.duration,
          timelineStart: 0, order: prev.length
        }]);
      } catch (err) {}
    }
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    const sorted = [...mediaItems].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(it => it.id === id);
    if (direction === 'up' && idx > 0) {
      const tempOrder = sorted[idx].order;
      sorted[idx].order = sorted[idx - 1].order;
      sorted[idx - 1].order = tempOrder;
    } else if (direction === 'down' && idx < sorted.length - 1) {
      const tempOrder = sorted[idx].order;
      sorted[idx].order = sorted[idx + 1].order;
      sorted[idx + 1].order = tempOrder;
    }
    setMediaItems([...sorted]);
  };

  const moveToPosition = (id: string, targetRank: number) => {
    const targetIdx = Math.max(0, Math.min(targetRank - 1, mediaItems.length - 1));
    const sorted = [...mediaItems].sort((a, b) => a.order - b.order);
    const currentIdx = sorted.findIndex(it => it.id === id);
    if (currentIdx === -1 || currentIdx === targetIdx) return;
    const [itemToMove] = sorted.splice(currentIdx, 1);
    sorted.splice(targetIdx, 0, itemToMove);
    const updatedItems = sorted.map((it, idx) => ({ ...it, order: idx }));
    setMediaItems(updatedItems);
  };

  const updateSelectedItem = (updates: Partial<MediaItem>) => {
    if (!selectedItemId) return;
    setMediaItems(prev => prev.map(it => it.id === selectedItemId ? { ...it, ...updates } : it));
  };

  const updateAudioTrack = (trackId: string, updates: Partial<AudioTrack>) => {
    setAudioTracks(prev => {
        const next = prev.map(t => t.id === trackId ? { ...t, ...updates } : t);
        if (isPlaying && lastActiveAudioIdRef.current === trackId) {
            lastActiveAudioIdRef.current = null; 
        }
        return next;
    });
  };

  const handleStartExport = async () => {
    if (assetTimeline.length === 0) return;
    setIsExportModalOpen(true);
    setExportStage('rendering');
    setExportProgress(0);
    try {
      const { blob } = await fastRenderVideo({
        canvas: renderCanvasRef.current!,
        assetTimeline,
        audioTimeline,
        audioBuffers,
        videoRefs,
        imageRefs,
        totalDuration,
        settings,
        fps: 30,
        onProgress: (p) => setExportProgress(p)
      });
      const url = URL.createObjectURL(blob);
      setGeneratedFileUrl(url);
      setExportStage('finished');
    } catch (error) {
      console.error("Export failed:", error);
      setExportStage('idle');
      setIsExportModalOpen(false);
    }
  };

  const handleAIGen = async (type: 'scene' | 'order' | 'site-bg' | 'site-bg-match') => {
    setIsProcessing(true);
    try {
      if (type === 'scene' && aiPrompt) {
        const data = await generateAISceneData(aiPrompt, "cinematic");
        const newItem: MediaItem = {
          id: Math.random().toString(36).substr(2, 9),
          url: data.bgUrl, type: 'image', name: data.title, duration: 5, locked: false, order: mediaItems.length,
          effect: 'none', scaleMode: settings.fitMode || 'cover', overlayText: data.title, overlaySubtext: data.subtitle,
          overlayX: 50, overlayY: 50, overlayTextSize: data.fontSize, fontFamily: data.fontFamily as any,
          fontWeight: data.fontWeight, letterSpacing: data.letterSpacing, overlayTextColor: data.textColor,
          overlaySubtextColor: '#cccccc', overlayBgColor: 'transparent', compositeScale: 40, compositeX: 50, compositeY: 50,
          overlayAnimation: 'reveal', overlayAnimationSpeed: 1, base64: data.bgUrl.startsWith('data:') ? data.bgUrl : "" 
        };
        setMediaItems(prev => [...prev, newItem].sort((a, b) => a.order - b.order));
        setAiPrompt('');
      } else if (type === 'order') {
        const newOrder = await analyzeSequenceByPrompt(mediaItems, aiPrompt || "narrative flow");
        setMediaItems(prev => newOrder.map((idx, newPos) => ({ ...prev[idx], order: newPos })).sort((a, b) => a.order - b.order));
      } else if (type === 'site-bg' && siteBgPrompt) {
        const bgUrl = await generateWebsiteBackground(siteBgPrompt);
        document.documentElement.style.setProperty('--bg-image', `url('${bgUrl}')`, 'important');
        setSiteBgPrompt('');
      }
    } catch (error) { console.error(error); } finally { setIsProcessing(false); }
  };

  return (
    <div className="flex h-screen w-full text-slate-100 overflow-hidden font-['Inter'] relative">
      <nav className="w-24 border-r border-white/5 flex flex-col items-center py-12 space-y-12 bg-black/30 z-50">
        <div className="p-5 bg-red-600 rounded-[2.2rem] shadow-[0_0_30px_rgba(239,68,68,0.4)]"><Sparkles className="text-white" size={30} /></div>
        <div className="flex flex-col gap-10">
          <button onClick={() => setActiveTab('curate')} className={`p-4 rounded-2xl transition-all ${activeTab === 'curate' ? 'bg-red-600/15 text-red-500' : 'text-slate-500 hover:text-slate-200'}`}><Layers size={28} /></button>
          <button onClick={() => setActiveTab('audio')} className={`p-4 rounded-2xl transition-all ${activeTab === 'audio' ? 'bg-red-600/15 text-red-500' : 'text-slate-500 hover:text-slate-200'}`}><Music size={28} /></button>
          <button onClick={() => setActiveTab('neural')} className={`p-4 rounded-2xl transition-all ${activeTab === 'neural' ? 'bg-red-600/15 text-red-500' : 'text-slate-500 hover:text-slate-200'}`}><Zap size={28} /></button>
          <button onClick={() => setActiveTab('settings')} className={`p-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-red-600/15 text-red-500' : 'text-slate-500 hover:text-slate-200'}`}><Settings size={28} /></button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-12 bg-black/10 shrink-0 z-50">
          <div className="flex items-center gap-4"><h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-100">KINE<span className="text-red-500">AI</span> PRO</h1></div>
          <button onClick={handleStartExport} className="bg-red-600 hover:bg-red-500 px-10 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest text-white flex items-center gap-3 shadow-xl transition-all"><Download size={20} /> Master Render</button>
        </header>

        <div className="flex-1 flex overflow-hidden z-40">
          <aside className="w-[540px] border-r border-white/5 flex flex-col glass-panel overflow-y-auto p-12 space-y-16 no-scrollbar">
            {activeTab === 'curate' && (
              <>
                <section>
                    <div className="flex items-center justify-between mb-10">
                        <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-red-500">Production Bin</h2>
                        <label className="p-4 bg-white/5 text-red-500 rounded-2xl cursor-pointer hover:bg-red-600 transition-all border border-white/10 active:scale-90"><Plus size={26} /><input type="file" multiple className="hidden" onChange={handleFileUpload} accept="image/*,video/*" /></label>
                    </div>
                    <div className="grid grid-cols-1 gap-5">
                      {assetTimeline.map((item, idx) => (
                        <div key={item.id} onClick={() => setSelectedItemId(item.id)} className={`p-5 rounded-[3rem] border transition-all cursor-pointer ${selectedItemId === item.id ? 'bg-red-600/10 border-red-500 active-ring shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'bg-black/40 border-white/5 hover:bg-black/60'}`}>
                          <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shrink-0 border border-white/10 shadow-lg relative">
                               <span className="absolute top-0 left-0 bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded-br-lg z-10">#{idx + 1}</span>
                              {item.type === 'video' ? <Film size={30} className="text-slate-700"/> : <img src={item.url} className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 truncate">
                                <p className="text-[13px] font-black uppercase truncate text-slate-100 mb-1">{item.name}</p>
                                <div className="flex items-center gap-3">
                                    <p className="text-[10px] text-slate-500 font-bold">{item.duration.toFixed(1)}s</p>
                                    <p className="text-[10px] text-red-500/80 font-black uppercase tracking-tighter">Start: {item.globalStart.toFixed(1)}s</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={(e) => { e.stopPropagation(); moveItem(item.id, 'up'); }} className="p-2 bg-white/5 rounded-lg hover:text-red-500 transition-colors"><ChevronUp size={20}/></button>
                                <button onClick={(e) => { e.stopPropagation(); moveItem(item.id, 'down'); }} className="p-2 bg-white/5 rounded-lg hover:text-red-500 transition-colors"><ChevronDown size={20}/></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                </section>

                {selectedItem && (
                  <section className="bg-red-600/5 rounded-[4rem] p-10 border border-red-500/10 space-y-12">
                    <div className="flex items-center justify-between border-b border-white/5 pb-6 mb-8">
                      <div className="flex items-center gap-4 text-red-500"><Replace size={24}/><h3 className="text-[13px] font-black uppercase tracking-[0.3em]">Precision Inspector</h3></div>
                      <button onClick={() => setSelectedItemId(null)} className="text-slate-600 hover:text-white"><X size={20}/></button>
                    </div>
                    
                    <div className="space-y-12">
                      <div className="space-y-6">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2"><Hash size={16}/> Timeline Order (Shift & Move)</label>
                        <div className="flex items-center gap-4">
                            <button onClick={() => moveToPosition(selectedItemId!, mediaItems.findIndex(it => it.id === selectedItemId))} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><Minus size={18}/></button>
                            <input 
                              type="number" min="1" max={mediaItems.length} value={mediaItems.findIndex(it => it.id === selectedItemId) + 1} 
                              onChange={(e) => moveToPosition(selectedItemId!, parseInt(e.target.value))} 
                              className="w-24 bg-black/60 border border-white/10 rounded-2xl p-4 text-[15px] font-bold outline-none text-red-500 text-center focus:border-red-500 transition-all shadow-inner" 
                            />
                            <button onClick={() => moveToPosition(selectedItemId!, mediaItems.findIndex(it => it.id === selectedItemId) + 2)} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><PlusIcon size={18}/></button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-8">
                        <div className="space-y-4">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2"><TypeIcon size={16}/> Headline Script</label>
                          <input type="text" value={selectedItem.overlayText || ''} onChange={(e) => updateSelectedItem({ overlayText: e.target.value })} className="w-full bg-black/60 border border-white/10 rounded-2xl p-6 text-[15px] font-bold outline-none text-white shadow-inner" />
                        </div>
                        <div className="space-y-4">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2"><TypeIcon size={16}/> Subheading Script</label>
                          <input type="text" value={selectedItem.overlaySubtext || ''} onChange={(e) => updateSelectedItem({ overlaySubtext: e.target.value })} className="w-full bg-black/60 border border-white/10 rounded-2xl p-6 text-[13px] font-bold outline-none text-slate-300 shadow-inner" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-10">
                        <div className="space-y-4">
                            <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase"><span>X Pos %</span><span className="text-red-500">{selectedItem.overlayX}%</span></div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => updateSelectedItem({ overlayX: Math.max(0, selectedItem.overlayX - 1) })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><Minus size={14}/></button>
                              <input type="range" min="0" max="100" value={selectedItem.overlayX} onChange={(e) => updateSelectedItem({ overlayX: parseInt(e.target.value) })} className="flex-1" />
                              <button onClick={() => updateSelectedItem({ overlayX: Math.min(100, selectedItem.overlayX + 1) })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><PlusIcon size={14}/></button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase"><span>Y Pos %</span><span className="text-red-500">{selectedItem.overlayY}%</span></div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => updateSelectedItem({ overlayY: Math.max(0, selectedItem.overlayY - 1) })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><Minus size={14}/></button>
                              <input type="range" min="0" max="100" value={selectedItem.overlayY} onChange={(e) => updateSelectedItem({ overlayY: parseInt(e.target.value) })} className="flex-1" />
                              <button onClick={() => updateSelectedItem({ overlayY: Math.min(100, selectedItem.overlayY + 1) })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><PlusIcon size={14}/></button>
                            </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2"><FontIcon size={14}/> Font Family</label>
                          <select value={selectedItem.fontFamily} onChange={(e) => updateSelectedItem({ fontFamily: e.target.value as any })} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-[13px] font-bold outline-none text-white">
                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div className="space-y-4">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2"><Zap size={14}/> Text Animation</label>
                          <select value={selectedItem.overlayAnimation} onChange={(e) => updateSelectedItem({ overlayAnimation: e.target.value as any })} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-[13px] font-bold outline-none text-white">
                            {ANIMATIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                         <div className="space-y-4">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2"><Wand size={14}/> Visual Effect</label>
                            <select value={selectedItem.effect} onChange={(e) => updateSelectedItem({ effect: e.target.value as any })} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-[13px] font-bold outline-none text-white">
                              {EFFECTS.map(eff => <option key={eff.id} value={eff.id}>{eff.label}</option>)}
                            </select>
                         </div>
                         <div className="space-y-4">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2"><Box size={14}/> Scaling Mode</label>
                            <select value={selectedItem.scaleMode} onChange={(e) => updateSelectedItem({ scaleMode: e.target.value as any })} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-[13px] font-bold outline-none text-white">
                              {FIT_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                            </select>
                         </div>
                      </div>

                      <div className="space-y-10 border-t border-white/5 pt-10">
                        <div className="space-y-6">
                            <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase"><span>Font Size (±10 | ±1)</span><span className="text-red-500 font-mono text-lg">{selectedItem.overlayTextSize}px</span></div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => updateSelectedItem({ overlayTextSize: Math.max(10, (selectedItem.overlayTextSize || 60) - 10) })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><Rewind size={18}/></button>
                              <button onClick={() => updateSelectedItem({ overlayTextSize: Math.max(10, (selectedItem.overlayTextSize || 60) - 1) })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><Minus size={18}/></button>
                              <input type="range" min="10" max="250" value={selectedItem.overlayTextSize || 60} onChange={(e) => updateSelectedItem({ overlayTextSize: parseInt(e.target.value) })} className="flex-1" />
                              <button onClick={() => updateSelectedItem({ overlayTextSize: Math.min(250, (selectedItem.overlayTextSize || 60) + 1) })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><PlusIcon size={18}/></button>
                              <button onClick={() => updateSelectedItem({ overlayTextSize: Math.min(250, (selectedItem.overlayTextSize || 60) + 10) })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><FastForward size={18}/></button>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase"><span>Clip Duration (±1.0s | ±0.1s)</span><span className="text-red-500 font-mono text-lg">{selectedItem.duration.toFixed(1)}s</span></div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => updateSelectedItem({ duration: Math.max(0.1, selectedItem.duration - 1) })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><Rewind size={18}/></button>
                                <button onClick={() => updateSelectedItem({ duration: Math.max(0.1, selectedItem.duration - 0.1) })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><Minus size={18}/></button>
                                <input type="range" min="0.1" max="20" step="0.1" value={selectedItem.duration} onChange={(e) => updateSelectedItem({ duration: parseFloat(e.target.value) })} className="flex-1" />
                                <button onClick={() => updateSelectedItem({ duration: selectedItem.duration + 0.1 })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><PlusIcon size={18}/></button>
                                <button onClick={() => updateSelectedItem({ duration: selectedItem.duration + 1 })} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-red-600 transition-all"><FastForward size={18}/></button>
                            </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-10">
                         <div className="space-y-4">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2"><Droplets size={14}/> Heading Color</label>
                            <div className="flex gap-4">
                               <input type="color" value={selectedItem.overlayTextColor || '#ffffff'} onChange={(e) => updateSelectedItem({ overlayTextColor: e.target.value })} className="w-12 h-12 bg-transparent border-0 cursor-pointer" />
                               <div className="flex-1 bg-black/40 rounded-xl flex items-center px-4 font-mono text-[10px] uppercase text-slate-400 border border-white/5">{selectedItem.overlayTextColor}</div>
                            </div>
                         </div>
                         <div className="space-y-4">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2"><Droplets size={14}/> Subheading Color</label>
                            <div className="flex gap-4">
                               <input type="color" value={selectedItem.overlaySubtextColor || '#cccccc'} onChange={(e) => updateSelectedItem({ overlaySubtextColor: e.target.value })} className="w-12 h-12 bg-transparent border-0 cursor-pointer" />
                               <div className="flex-1 bg-black/40 rounded-xl flex items-center px-4 font-mono text-[10px] uppercase text-slate-400 border border-white/5">{selectedItem.overlaySubtextColor}</div>
                            </div>
                         </div>
                      </div>

                      <button onClick={() => { 
                          setMediaItems(prev => prev.filter(it => it.id !== selectedItemId));
                          setSelectedItemId(null);
                      }} className="w-full py-6 rounded-3xl border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 mt-10"><Trash2 size={20}/> Delete asset</button>
                    </div>
                  </section>
                )}
              </>
            )}

            {activeTab === 'audio' && (
              <section className="space-y-12">
                <div className="flex items-center justify-between"><h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-red-500">Audio Channels</h2><label className="p-4 bg-white/5 text-red-500 rounded-xl cursor-pointer hover:bg-red-600 transition-all border border-white/10 active:scale-90"><Music size={24}/><input type="file" multiple className="hidden" onChange={handleAudioUpload} accept="audio/*" /></label></div>
                <div className="space-y-10">
                    {audioTracks.map(track => (
                        <div key={track.id} className="p-10 bg-black/40 rounded-[3.5rem] border border-white/5 space-y-10 relative overflow-hidden group">
                           {beatMarkers[track.id] && <div className="absolute top-0 right-0 p-2 bg-red-600/20 rounded-bl-xl"><Activity size={14} className="text-red-500 animate-pulse"/></div>}
                           <div className="flex items-center justify-between"><p className="text-[13px] font-black uppercase truncate text-slate-100">{track.name}</p><button onClick={() => setAudioTracks(prev => prev.filter(t => t.id !== track.id))} className="text-slate-700 hover:text-red-500"><Trash2 size={20}/></button></div>
                           <div className="space-y-8">
                              <div className="space-y-4">
                                <div className="flex justify-between text-[11px] font-black uppercase text-slate-500"><span>Timeline Start (±1.0 | ±0.1)</span><span className="text-red-500 font-mono text-lg">{track.timelineStart.toFixed(1)}s</span></div>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => updateAudioTrack(track.id, { timelineStart: Math.max(0, track.timelineStart - 1.0) })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><Rewind size={16}/></button>
                                  <button onClick={() => updateAudioTrack(track.id, { timelineStart: Math.max(0, track.timelineStart - 0.1) })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><Minus size={16}/></button>
                                  <input type="range" min="0" max={Math.max(totalDuration, 60)} step="0.1" value={track.timelineStart} onChange={(e) => updateAudioTrack(track.id, { timelineStart: parseFloat(e.target.value) })} className="flex-1" />
                                  <button onClick={() => updateAudioTrack(track.id, { timelineStart: track.timelineStart + 0.1 })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><PlusIcon size={16}/></button>
                                  <button onClick={() => updateAudioTrack(track.id, { timelineStart: track.timelineStart + 1.0 })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><FastForward size={16}/></button>
                                </div>
                              </div>
                              <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex justify-between text-[11px] font-black uppercase text-slate-500"><span>Audio Start (Trim ±1.0 | ±0.1)</span><span className="text-red-500 font-mono text-lg">{track.trimStart.toFixed(1)}s</span></div>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => updateAudioTrack(track.id, { trimStart: Math.max(0, track.trimStart - 1.0) })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><Rewind size={16}/></button>
                                  <button onClick={() => updateAudioTrack(track.id, { trimStart: Math.max(0, track.trimStart - 0.1) })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><Minus size={16}/></button>
                                  <input type="range" min="0" max={track.trimEnd - 0.1} step="0.1" value={track.trimStart} onChange={(e) => updateAudioTrack(track.id, { trimStart: parseFloat(e.target.value) })} className="flex-1" />
                                  <button onClick={() => updateAudioTrack(track.id, { trimStart: Math.min(track.trimEnd - 0.1, track.trimStart + 0.1) })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><PlusIcon size={16}/></button>
                                  <button onClick={() => updateAudioTrack(track.id, { trimStart: Math.min(track.trimEnd - 0.1, track.trimStart + 1.0) })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><FastForward size={16}/></button>
                                </div>
                              </div>
                              <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex justify-between text-[11px] font-black uppercase text-slate-500"><span>Audio End (Trim ±1.0 | ±0.1)</span><span className="text-red-500 font-mono text-lg">{track.trimEnd.toFixed(1)}s</span></div>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => updateAudioTrack(track.id, { trimEnd: Math.max(track.trimStart + 0.1, track.trimEnd - 1.0) })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><Rewind size={16}/></button>
                                  <button onClick={() => updateAudioTrack(track.id, { trimEnd: Math.max(track.trimStart + 0.1, track.trimEnd - 0.1) })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><Minus size={16}/></button>
                                  <input type="range" min={track.trimStart + 0.1} max={track.duration} step="0.1" value={track.trimEnd} onChange={(e) => updateAudioTrack(track.id, { trimEnd: parseFloat(e.target.value) })} className="flex-1" />
                                  <button onClick={() => updateAudioTrack(track.id, { trimEnd: Math.min(track.duration, track.trimEnd + 0.1) })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><PlusIcon size={16}/></button>
                                  <button onClick={() => updateAudioTrack(track.id, { trimEnd: Math.min(track.duration, track.trimEnd + 1.0) })} className="p-3 bg-black/60 rounded-xl border border-white/10 hover:bg-red-600 transition-all"><FastForward size={16}/></button>
                                </div>
                              </div>
                           </div>
                        </div>
                    ))}
                </div>
              </section>
            )}

            {activeTab === 'neural' && (
              <section className="space-y-16">
                <div className="space-y-8">
                  <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-red-500">AI Director (Scene Generation)</h2>
                  <div className="p-10 bg-black/40 rounded-[3.5rem] border border-white/10 space-y-10 relative overflow-hidden">
                    {isProcessing && <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10 flex items-center justify-center"><Loader2 size={48} className="text-red-500 animate-spin"/></div>}
                    <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g. 'Epic sunset over Tokyo'..." className="w-full h-36 bg-black/60 border border-white/10 rounded-3xl p-8 text-[14px] outline-none shadow-inner resize-none text-slate-200" />
                    <button onClick={() => handleAIGen('scene')} disabled={isProcessing || !aiPrompt} className="w-full bg-red-600 hover:bg-red-500 h-16 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white shadow-xl flex items-center justify-center gap-3"><Sparkles size={18}/> Generate Scene</button>
                  </div>
                </div>
                <div className="space-y-8">
                  <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-red-500">Background Lab (UI Synthesis)</h2>
                  <div className="p-10 bg-black/40 rounded-[3.5rem] border border-white/10 space-y-10 relative overflow-hidden">
                    {isProcessing && <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10 flex items-center justify-center"><Loader2 size={48} className="text-red-500 animate-spin"/></div>}
                    <textarea value={siteBgPrompt} onChange={(e) => setSiteBgPrompt(e.target.value)} placeholder="e.g. 'Abstract dark flow with red neon'..." className="w-full h-36 bg-black/60 border border-white/10 rounded-3xl p-8 text-[14px] outline-none shadow-inner resize-none text-slate-200" />
                    <button onClick={() => handleAIGen('site-bg')} disabled={isProcessing || !siteBgPrompt} className="w-full bg-white/10 hover:bg-white/15 h-16 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white shadow-xl">Synthesize Theme</button>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'settings' && (
              <section className="space-y-16">
                <div className="space-y-8">
                  <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-red-500">Project Aspect Ratio</h2>
                  <div className="grid grid-cols-1 gap-4">
                    {ASPECT_RATIO_CONFIGS.map((config) => (
                      <button 
                        key={config.id} 
                        onClick={() => setSettings(prev => ({ ...prev, aspectRatio: config.id }))}
                        className={`p-6 rounded-3xl border transition-all flex items-center justify-between group ${settings.aspectRatio === config.id ? 'bg-red-600/10 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-black/40 border-white/5 hover:bg-black/60'}`}
                      >
                        <div className="flex items-center gap-6">
                           <div className={`p-4 rounded-xl ${settings.aspectRatio === config.id ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
                              {config.icon}
                           </div>
                           <span className={`text-[13px] font-black uppercase tracking-widest ${settings.aspectRatio === config.id ? 'text-white' : 'text-slate-500'}`}>{config.label}</span>
                        </div>
                        {settings.aspectRatio === config.id && <CheckCircle2 size={24} className="text-red-500" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-8">
                   <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-red-500">Default Fit Mode</h2>
                   <div className="grid grid-cols-2 gap-4">
                      {FIT_MODES.map((mode) => (
                        <button 
                          key={mode.id} 
                          onClick={() => setSettings(prev => ({ ...prev, fitMode: mode.id }))}
                          className={`p-6 rounded-3xl border transition-all font-black uppercase text-[11px] tracking-widest ${settings.fitMode === mode.id ? 'bg-red-600 text-white border-red-500 shadow-xl' : 'bg-black/40 border-white/5 text-slate-500 hover:text-white'}`}
                        >
                          {mode.label}
                        </button>
                      ))}
                   </div>
                </div>
              </section>
            )}
          </aside>

          <div className="flex-1 flex flex-col relative overflow-hidden">
            <div className="flex-1 flex items-center justify-center p-16">
               <div className="relative bg-black overflow-hidden shadow-2xl border border-white/10 rounded-[3.5rem]" 
                    style={{ 
                      aspectRatio: settings.aspectRatio.replace(':', '/'), 
                      height: '60vh',
                      transform: isBeatActive ? 'scale(1.025)' : 'scale(1)',
                      transition: 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                {assetTimeline.map((asset) => {
                  const isActive = asset.id === activeAsset?.id;
                  const fitClass = 
                    asset.scaleMode === 'fill' ? 'object-fill' : 
                    asset.scaleMode === 'contain' ? 'object-contain' : 
                    asset.scaleMode === 'fit' ? 'object-contain' : 
                    'object-cover';

                  return (
                    <div key={asset.id} className={`absolute inset-0 ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                      {asset.type === 'video' ? (
                        <video ref={el => { videoRefs.current[asset.id] = el; }} src={asset.url} className={`w-full h-full ${fitClass}`} muted playsInline crossOrigin="anonymous" style={{ filter: EFFECTS.find(e => e.id === asset.effect)?.filter || 'none' }} />
                      ) : (
                        <img ref={el => { imageRefs.current[asset.id] = el; }} src={asset.url} className={`w-full h-full ${fitClass}`} alt="" style={{ filter: EFFECTS.find(e => e.id === asset.effect)?.filter || 'none' }} />
                      )}
                      {isActive && (asset.overlayText || asset.overlaySubtext) && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                          <div className="absolute text-center px-10" 
                              style={{ 
                                  left: `${asset.overlayX}%`,
                                  top: `${asset.overlayY}%`,
                                  transform: 'translate(-50%, -50%)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center'
                              }}>
                            {asset.overlayText && (
                              <h3 className={`t-anim-${asset.overlayAnimation || 'reveal'}`} 
                                  style={{ 
                                      fontFamily: asset.fontFamily || 'Oswald', 
                                      fontSize: `${asset.overlayTextSize}px`,
                                      color: asset.overlayTextColor,
                                      backgroundColor: asset.overlayBgColor,
                                      padding: asset.overlayBgColor !== 'transparent' ? '0.2em 0.8em' : '0',
                                      borderRadius: '0.2em',
                                      textTransform: 'uppercase',
                                      fontWeight: asset.fontWeight || '900',
                                      letterSpacing: asset.letterSpacing || '0.1em',
                                      textShadow: asset.textShadow ? `0 0 20px ${asset.textShadow}` : 'none'
                                  }}>{asset.overlayText}</h3>
                            )}
                            {asset.overlaySubtext && (
                              <p className="mt-2 font-bold tracking-widest uppercase"
                                 style={{ 
                                   color: asset.overlaySubtextColor || '#cccccc', 
                                   fontSize: `${(asset.overlayTextSize || 60) * 0.4}px`,
                                   fontFamily: asset.fontFamily || 'Inter'
                                 }}>
                                {asset.overlaySubtext}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
               </div>
            </div>
            
            <div className="h-80 border-t border-white/10 bg-black/60 flex flex-col p-10 space-y-8 backdrop-blur-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-10">
                  <button onClick={togglePlayback} className={`w-16 h-16 flex items-center justify-center rounded-2xl transition-all shadow-xl active:scale-90 ${isPlaying ? 'bg-slate-100' : 'bg-red-600'}`}>
                      {isPlaying ? <Pause size={32} fill="black" className="text-slate-900" /> : <Play size={32} fill="white" className="ml-1 text-white" />}
                  </button>
                  <div className="px-10 py-4 bg-black/40 border border-white/10 rounded-2xl font-mono text-3xl font-black text-red-500 tabular-nums">{currentTime.toFixed(2)}s</div>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto relative bg-black/40 rounded-[2.5rem] p-10 border border-white/10 no-scrollbar timeline-grid">
                 <div className="h-full relative flex flex-col gap-6" style={{ minWidth: `${(totalDuration * 160) + 200}px` }}>
                    <div className="h-14 flex relative">
                      {assetTimeline.map(item => (
                        <div key={item.id} onClick={() => setSelectedItemId(item.id)} className={`h-full border absolute rounded-2xl transition-all cursor-pointer flex items-center px-8 overflow-hidden ${selectedItemId === item.id ? 'bg-red-600/30 border-red-500 active-ring shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-white/5 border-white/10'}`} style={{ width: `${item.duration * 160}px`, left: `${item.globalStart * 160}px` }}>
                          <span className="text-[11px] font-black uppercase text-slate-400 truncate">{item.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="absolute top-0 bottom-0 w-[3px] bg-red-500 z-50 pointer-events-none rounded-full shadow-[0_0_20px_#ef4444]" style={{ left: `${currentTime * 160}px` }} />
                 </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <canvas ref={renderCanvasRef} className="hidden" />

      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-12">
          <div className="w-full max-w-2xl bg-black/40 border border-white/10 rounded-[4.5rem] p-16 space-y-12 text-center shadow-[0_0_100px_rgba(0,0,0,0.8)] glass-panel">
            {exportStage === 'rendering' ? (
              <>
                <div className="relative w-48 h-48 mx-auto">
                   <div className="absolute inset-0 border-[6px] border-white/5 rounded-full"></div>
                   <div className="absolute inset-0 border-[6px] border-red-600 rounded-full border-t-transparent animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center text-3xl font-black text-red-500 tabular-nums">{Math.round(exportProgress)}%</div>
                </div>
                <div className="space-y-6">
                   <h2 className="text-4xl font-black uppercase tracking-widest italic text-white">Encoding Master</h2>
                   <p className="text-slate-500 font-bold uppercase text-[12px] tracking-[0.2em]">Synchronizing cinematic layers...</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-32 h-32 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                  <CheckCircle2 size={64} className="text-emerald-500" />
                </div>
                <div className="space-y-6">
                  <h2 className="text-4xl font-black uppercase tracking-widest italic text-white">Master Complete</h2>
                  <p className="text-slate-500 font-bold uppercase text-[12px] tracking-[0.2em]">Production rendered successfully.</p>
                </div>
                <div className="flex gap-6 pt-10">
                  <a href={generatedFileUrl!} download={`KineAI_HD_Master_${Date.now()}.mp4`} className="flex-1 bg-red-600 h-24 rounded-[2.5rem] flex items-center justify-center gap-4 text-[14px] font-black uppercase tracking-widest text-white hover:bg-red-500 transition-all shadow-[0_20px_50px_rgba(239,68,68,0.3)] hover:scale-105 active:scale-95">
                    <Download size={28}/> Save Final
                  </a>
                  <button onClick={() => { setIsExportModalOpen(false); setExportStage('idle'); setGeneratedFileUrl(null); }} className="px-12 h-24 bg-white/5 border border-white/10 rounded-[2.5rem] text-[12px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all hover:bg-white/10">
                    Exit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
