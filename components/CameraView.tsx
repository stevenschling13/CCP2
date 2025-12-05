import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AiDiagnosis } from '../types';

interface CameraViewProps {
  onAnalyze: (file: File) => Promise<AiDiagnosis | undefined>;
  onClose: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onAnalyze, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiDiagnosis | null>(null);

  useEffect(() => {
    let mounted = true;
    async function setupCamera() {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        if (mounted) {
            setStream(ms);
            if (videoRef.current) {
                videoRef.current.srcObject = ms;
            }
        }
      } catch (e) {
        console.error("Camera access denied", e);
      }
    }
    setupCamera();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Only mount once

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Draw frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.drawImage(video, 0, 0);
        
        canvas.toBlob(async (blob) => {
            if (blob) {
                const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
                const result = await onAnalyze(file);
                if (result) setAnalysisResult(result);
            }
            setIsCapturing(false);
        }, 'image/jpeg', 0.9);
    }
  }, [onAnalyze]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="absolute top-0 w-full p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="text-white p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <span className="text-neon-green font-mono text-sm uppercase tracking-widest bg-black/50 px-2 py-1 rounded">Vision Mode</span>
        <div className="w-8"></div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative bg-neutral-900 overflow-hidden">
        <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* AR Overlay Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(#00ffa3 1px, transparent 1px), linear-gradient(90deg, #00ffa3 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        {/* Focus Reticle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white/30 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 border border-neon-green rounded-full bg-neon-green/50 animate-pulse"></div>
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-neon-green"></div>
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-neon-green"></div>
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-neon-green"></div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-neon-green"></div>
        </div>

        {/* AI Result Overlay */}
        {analysisResult && (
            <div className="absolute bottom-24 left-4 right-4 bg-black/80 backdrop-blur-md border border-neon-purple/50 p-4 rounded-xl text-white">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-neon-purple">Diagnosis Complete</h3>
                    <div className="text-2xl font-bold">{analysisResult.healthScore}<span className="text-sm text-gray-400">/100</span></div>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                    {analysisResult.issues.map((issue, i) => (
                        <span key={i} className="text-xs bg-red-900/50 text-red-200 px-2 py-1 rounded border border-red-800">{issue}</span>
                    ))}
                </div>
                 <p className="text-sm text-gray-300 line-clamp-2">{analysisResult.recommendations[0]}</p>
                 <button onClick={() => setAnalysisResult(null)} className="mt-3 w-full bg-neutral-800 py-2 rounded text-sm hover:bg-neutral-700">Dismiss</button>
            </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="h-32 bg-black flex items-center justify-center relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent"></div>
        <button 
            onClick={handleCapture}
            disabled={isCapturing}
            className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform"
        >
            <div className={`w-14 h-14 rounded-full bg-white ${isCapturing ? 'scale-90 opacity-50' : ''} transition-all`}></div>
        </button>
      </div>
    </div>
  );
};