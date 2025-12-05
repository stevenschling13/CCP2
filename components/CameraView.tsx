import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AiDiagnosis } from '../types';

interface CameraViewProps {
  onAnalyze: (file: File) => Promise<AiDiagnosis | undefined>;
  onClose: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onAnalyze, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiDiagnosis | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function setupCamera() {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        if (mounted) {
            streamRef.current = ms;
            setCameraError(null);
            if (videoRef.current) {
                videoRef.current.srcObject = ms;
            }
        }
      } catch (e) {
        console.error("Camera access denied", e);
        setCameraError('Unable to access the camera. Please grant permission and ensure the lens is free.');
      }
    }
    setupCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
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
                if (result) {
                    setAnalysisResult(result);
                    setShowFullReport(false);
                }
            }
            setIsCapturing(false);
        }, 'image/jpeg', 0.9);
    }
  }, [onAnalyze]);

  const getHealthColor = (score: number) => {
      if (score >= 90) return 'text-neon-green';
      if (score >= 70) return 'text-neon-blue';
      if (score >= 50) return 'text-yellow-400';
      return 'text-red-500';
  };

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

      {cameraError && (
        <div className="absolute top-14 left-0 right-0 z-20 px-4">
          <div className="bg-red-900/70 border border-red-700 text-red-100 text-sm rounded-lg p-3">
            {cameraError}
          </div>
        </div>
      )}

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
      </div>

      {/* Result Sheet (Collapsible) */}
      {analysisResult && (
        <div 
            className={`absolute bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-xl border-t border-neon-purple/50 rounded-t-3xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-40 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${showFullReport ? 'h-[85vh]' : 'h-auto max-h-[40vh]'}`}
        >
             {/* Handle bar */}
             <div className="w-full flex justify-center pt-3 pb-1 shrink-0 cursor-pointer" onClick={() => setShowFullReport(!showFullReport)}>
                 <div className="w-12 h-1.5 bg-neutral-700 rounded-full hover:bg-neutral-600 transition-colors"></div>
             </div>

             <div className="px-6 pb-6 pt-2 flex flex-col h-full overflow-hidden">
                {/* Header Section */}
                <div className="flex justify-between items-start mb-4 shrink-0">
                    <div onClick={() => setShowFullReport(!showFullReport)} className="cursor-pointer">
                         <h3 className="font-bold text-neon-purple text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                             {showFullReport ? 'Diagnosis Report' : 'Diagnosis Complete'}
                             {!showFullReport && <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>}
                         </h3>
                         <div className="text-xs text-gray-400">Confidence: {(analysisResult.confidence * 100).toFixed(0)}%</div>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className={`text-4xl font-bold font-mono ${getHealthColor(analysisResult.healthScore)}`}>
                            {analysisResult.healthScore}
                        </div>
                        <div className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Health Score</div>
                    </div>
                </div>

                {/* Content Container */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                    {/* Issues Tags (Always visible summary) */}
                    <div className="flex flex-wrap gap-2 mb-6 shrink-0">
                        {analysisResult.issues.slice(0, 3).map((issue, i) => (
                            <span key={i} className="text-xs bg-red-900/40 text-red-200 px-2 py-1 rounded border border-red-800/50">{issue}</span>
                        ))}
                        {analysisResult.issues.length > 3 && (
                            <span className="text-xs text-gray-400 px-2 py-1">+{analysisResult.issues.length - 3} more</span>
                        )}
                        {analysisResult.issues.length === 0 && (
                            <span className="text-xs bg-green-900/40 text-green-200 px-2 py-1 rounded border border-green-800/50">Healthy</span>
                        )}
                    </div>

                    {/* Collapsible Details */}
                    {showFullReport && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             {/* Detailed Recommendations */}
                             <div className="bg-neutral-800/30 rounded-xl p-4 border border-neutral-800">
                                <h4 className="text-neon-green font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Recommendations
                                </h4>
                                <div className="space-y-3">
                                    {analysisResult.recommendations.map((rec, i) => (
                                        <div key={i} className="flex gap-3 text-sm text-gray-300">
                                            <span className="shrink-0 w-5 h-5 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center text-xs font-bold border border-neon-green/30">{i+1}</span>
                                            <span className="leading-relaxed">{rec}</span>
                                        </div>
                                    ))}
                                </div>
                             </div>

                             {/* Issues Detail */}
                             {analysisResult.issues.length > 0 && (
                                 <div className="bg-red-900/10 rounded-xl p-4 border border-red-900/30">
                                    <h4 className="text-red-400 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        Analysis Notes
                                    </h4>
                                    <ul className="space-y-2">
                                        {analysisResult.issues.map((issue, i) => (
                                            <li key={i} className="text-red-200/80 text-sm flex gap-2">
                                                <span className="text-red-500">•</span> {issue}
                                            </li>
                                        ))}
                                    </ul>
                                 </div>
                             )}
                             
                             <div className="h-16"></div> {/* Spacer */}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="mt-auto pt-4 grid grid-cols-2 gap-3 shrink-0 bg-neutral-900/0">
                     <button onClick={() => setAnalysisResult(null)} className="bg-neutral-800 py-3 rounded-lg text-sm font-bold text-gray-300 hover:bg-neutral-700 transition-colors">
                        Dismiss
                     </button>
                     <button 
                        onClick={() => setShowFullReport(!showFullReport)} 
                        className={`py-3 rounded-lg text-sm font-bold transition-colors ${showFullReport ? 'bg-white text-black hover:bg-gray-200' : 'bg-neon-purple/20 border border-neon-purple/50 text-neon-purple hover:bg-neon-purple/30'}`}
                     >
                        {showFullReport ? 'Minimize' : 'View Full Report'}
                     </button>
                 </div>
             </div>
        </div>
      )}

      {/* Footer Controls (Visible behind sheet but practically hidden when expanded) */}
      <div className="h-32 bg-black flex items-center justify-center relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent"></div>
          <button
              onClick={handleCapture}
              disabled={isCapturing || analysisResult !== null || !!cameraError}
              className={`w-16 h-16 rounded-full border-4 flex items-center justify-center active:scale-95 transition-all ${analysisResult ? 'border-gray-600 opacity-50' : 'border-white'}`}
          >
            <div className={`w-14 h-14 rounded-full bg-white ${isCapturing ? 'scale-90 opacity-50' : ''} transition-all`}></div>
        </button>
      </div>
    </div>
  );
};
