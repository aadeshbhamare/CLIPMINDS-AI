
import React from 'react';
import { MediaItem, AudioTrack, ProjectSettings, VisualEffect } from './types';

interface ExportOptions {
  canvas: HTMLCanvasElement;
  assetTimeline: (MediaItem & { globalStart: number; globalEnd: number })[];
  audioTimeline: (AudioTrack & { globalStart: number; globalEnd: number })[];
  audioBuffers: Record<string, AudioBuffer>;
  videoRefs: React.MutableRefObject<Record<string, HTMLVideoElement | null>>;
  imageRefs: React.MutableRefObject<Record<string, HTMLImageElement | null>>;
  totalDuration: number;
  settings: ProjectSettings;
  fps: number;
  onProgress: (progress: number) => void;
}

const FILTERS: Record<VisualEffect, string> = {
  none: 'none',
  vibrant: 'saturate(1.8) contrast(1.1)',
  monochrome: 'grayscale(1) contrast(1.2)',
  vintage: 'sepia(0.5) contrast(0.9) brightness(1.1)',
  retro: 'hue-rotate(-30deg) saturate(1.4) contrast(1.1)',
  elegant: 'brightness(1.05) contrast(0.95) saturate(0.8)',
  pop: 'saturate(2) contrast(1.2)',
  zoom: 'none',
  blur: 'blur(5px)',
  glitch: 'hue-rotate(90deg) contrast(1.5)'
};

/**
 * Mixes all audio tracks from the timeline into a single master AudioBuffer.
 */
async function createMasterAudioBuffer(options: ExportOptions): Promise<AudioBuffer> {
  const { audioTimeline, audioBuffers, totalDuration } = options;
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, Math.max(1, Math.ceil(totalDuration * sampleRate)), sampleRate);

  for (const track of audioTimeline) {
    const buffer = audioBuffers[track.id];
    if (!buffer) continue;

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    
    const gain = offlineCtx.createGain();
    source.connect(gain);
    gain.connect(offlineCtx.destination);

    // Duration between trim points
    const durationToPlay = track.trimEnd - track.trimStart;
    source.start(track.globalStart, track.trimStart, durationToPlay);
  }

  return await offlineCtx.startRendering();
}

export const fastRenderVideo = async (options: ExportOptions): Promise<{ blob: Blob; mimeType: string }> => {
  const { canvas, assetTimeline, totalDuration, settings, videoRefs, imageRefs, fps, onProgress } = options;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error("Canvas context failed");

  // Dynamic Canvas sizing
  switch (settings.aspectRatio) {
    case '16:9': canvas.width = 1280; canvas.height = 720; break;
    case '9:16': canvas.width = 720; canvas.height = 1280; break;
    case '1:1': canvas.width = 720; canvas.height = 720; break;
    case '4:5': canvas.width = 720; canvas.height = 900; break;
    case '21:9': canvas.width = 1280; canvas.height = 548; break;
    default: canvas.width = 1280; canvas.height = 720;
  }

  // 1. Generate Master Audio
  const masterBuffer = await createMasterAudioBuffer(options);
  
  // 2. Setup Real-time Playback Context for Capture
  const playbackCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
  await playbackCtx.resume();
  
  const dest = playbackCtx.createMediaStreamDestination();
  const audioSource = playbackCtx.createBufferSource();
  audioSource.buffer = masterBuffer;
  audioSource.connect(dest);

  // 3. Setup Combined Stream
  const videoStream = canvas.captureStream(fps); // Capture at designated FPS
  const combinedStream = new MediaStream();
  videoStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
  dest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));

  // 4. Initialize Recorder with explicit Audio encoding
  const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2') 
    ? 'video/mp4;codecs=avc1,mp4a.40.2' 
    : 'video/webm;codecs=vp9,opus';
    
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 10000000,
    audioBitsPerSecond: 128000
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      playbackCtx.close();
      resolve({ blob: new Blob(chunks, { type: recorder.mimeType }), mimeType: recorder.mimeType });
    };
    recorder.onerror = (e) => {
      playbackCtx.close();
      reject(e);
    };

    recorder.start();
    const startTime = playbackCtx.currentTime;
    audioSource.start(startTime);

    const renderLoop = async () => {
      const elapsed = playbackCtx.currentTime - startTime;
      
      if (elapsed >= totalDuration) {
        recorder.stop();
        audioSource.stop();
        return;
      }

      // Find current asset based on audio clock
      const active = assetTimeline.find(a => elapsed >= a.globalStart && elapsed < a.globalEnd);

      if (active) {
        let source: HTMLImageElement | HTMLVideoElement | null = null;
        if (active.type === 'video') {
          const videoElement = videoRefs.current[active.id];
          if (videoElement) {
            source = videoElement;
            const targetLocalTime = elapsed - active.globalStart;
            // Sync video frames to audio clock
            if (Math.abs(videoElement.currentTime - targetLocalTime) > 0.1) {
              videoElement.currentTime = targetLocalTime;
              if (videoElement.readyState < 2) {
                await new Promise(r => {
                  const onSeeked = () => { videoElement.removeEventListener('seeked', onSeeked); r(null); };
                  videoElement.addEventListener('seeked', onSeeked);
                });
              }
            }
          }
        } else {
          source = imageRefs.current[active.id];
        }

        if (source) {
          const sW = (source as any).videoWidth || (source as any).naturalWidth || 100;
          const sH = (source as any).videoHeight || (source as any).naturalHeight || 100;
          const sAspect = sW / sH;
          const cAspect = canvas.width / canvas.height;

          let dW, dH, dX, dY;
          if (active.scaleMode === 'fill') {
            dW = canvas.width; dH = canvas.height; dX = 0; dY = 0;
          } else if (active.scaleMode === 'cover') {
            if (sAspect > cAspect) { dH = canvas.height; dW = dH * sAspect; }
            else { dW = canvas.width; dH = dW / sAspect; }
            dX = (canvas.width - dW) / 2; dY = (canvas.height - dH) / 2;
          } else {
            if (sAspect > cAspect) { dW = canvas.width; dH = dW / sAspect; }
            else { dH = canvas.height; dW = dH * sAspect; }
            dX = (canvas.width - dW) / 2; dY = (canvas.height - dH) / 2;
          }

          ctx.save();
          // Single-pass draw to prevent flicker
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.filter = FILTERS[active.effect] || 'none';
          ctx.drawImage(source, dX, dY, dW, dH);
          ctx.restore();
        }

        // Render Typography
        if (active.overlayText || active.overlaySubtext) {
          const baseSize = active.overlayTextSize || 60;
          const fontSize = baseSize * (canvas.width / 1920);
          const xPos = (active.overlayX / 100) * canvas.width;
          const yPos = (active.overlayY / 100) * canvas.height;
          
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (active.overlayText) {
            ctx.font = `${active.fontWeight || 900} ${fontSize}px ${active.fontFamily || 'Inter'}`;
            ctx.fillStyle = active.overlayTextColor || '#ffffff';
            ctx.fillText(active.overlayText.toUpperCase(), xPos, yPos);
          }
          if (active.overlaySubtext) {
            const subSize = fontSize * 0.4;
            ctx.font = `700 ${subSize}px ${active.fontFamily || 'Inter'}`;
            ctx.fillStyle = active.overlaySubtextColor || '#cccccc';
            ctx.fillText(active.overlaySubtext.toUpperCase(), xPos, yPos + fontSize * 0.75);
          }
        }
      }

      onProgress((elapsed / totalDuration) * 100);
      
      // Use requestAnimationFrame for smooth real-time capture
      requestAnimationFrame(renderLoop);
    };

    renderLoop();
  });
};
