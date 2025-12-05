import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AiDiagnosis, ArOverlayData } from '../types';
import { geminiService } from '../services/geminiService';

interface CameraViewProps {
  onAnalyze: (file: File) => Promise<AiDiagnosis | undefined>;
  onClose: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onAnalyze, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null); // Small canvas for stability check
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiDiagnosis | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);
  
  // AR State
  const [arMode, setArMode] = useState(false);
  const [arOverlay, setArOverlay] = useState<ArOverlayData | null>(null);
  const [stabilityScore, setStabilityScore] = useState(0);
  const stabilityCounter = useRef(0);
  const lastFrameData = useRef<Uint8ClampedArray | null>(null);
  const lastAnalysisTime = useRef(0);
  const rafRef = useRef<number>(null);

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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // AR Loop
  useEffect(() => {
    if (!arMode || !stream || analysisResult) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setStabilityScore(0);
        return;
    }

    const processFrame = async () => {
        if (!videoRef.current || !analysisCanvasRef.current) return;

        const video = videoRef.current;
        const canvas = analysisCanvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (ctx && video.readyState === 4) {
            // Downsample for motion detection (32x32 is sufficient)
            ctx.drawImage(video, 0, 0, 32, 32);
            const imageData = ctx.getImageData(0, 0, 32, 32);
            const data = imageData.data;

            // Calculate motion (Simple SAD - Sum of Absolute Differences)
            let diff = 0;
            if (lastFrameData.current) {
                for (let i = 0; i < data.length; i += 4) { // Check RGB, skip Alpha
                    diff += Math.abs(data[i] - lastFrameData.current[i]) +
                            Math.abs(data[i+1] - lastFrameData.current[i+1]) +
                            Math.abs(data[i+2] - lastFrameData.current[i+2]);
                }
                diff /= (data.length / 4);
            }
            lastFrameData.current = data;

            // Stability Logic
            // Lower diff means more stable. Threshold ~15 seems good for handheld.
            const isStable = diff < 15;
            if (isStable) {
                stabilityCounter.current += 1;
            } else {
                stabilityCounter.current = 0;
            }
            
            // Normalize score for UI (0-100)
            const score = Math.min(100, stabilityCounter.current * 5); 
            setStabilityScore(score);

            // Trigger AI Analysis if stable for ~1s (20 frames @ 60fps approx) and cooldown passed
            const now = Date.now();
            if (stabilityCounter.current > 30 && now - lastAnalysisTime.current > 2000) {
                lastAnalysisTime.current = now;
                // Capture high-res frame for analysis
                const captureCanvas = canvasRef.current;
                if (captureCanvas) {
                    captureCanvas.width = video.videoWidth;
                    captureCanvas.height = video.videoHeight;
                    const captureCtx = captureCanvas.getContext('2d');
                    captureCtx?.drawImage(video, 0, 0);
                    const base64 = captureCanvas.toDataURL('image/jpeg', 0.7).split(',')[1];
                    
                    // Fire and forget (don't await to keep UI smooth)
                    geminiService.analyzeLiveFrame(base64).then(data => {
                        setArOverlay(data);
                    });
                }
            }
        }
        rafRef.current = requestAnimationFrame(processFrame);
    };

    rafRef.current = requestAnimationFrame(processFrame);
  }, [arMode, stream, analysisResult]);

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
                    setArMode(false); // Disable AR on capture
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
        <button 
            onClick={() => { setArMode(!arMode); setArOverlay(null); }}
            className={`font-mono text-xs uppercase tracking-widest px-3 py-1.5 rounded border transition-all ${arMode ? 'bg-neon-green/20 border-neon-green text-neon-green shadow-[0_0_10px_#00ffa3]' : 'bg-black/50 border-gray-600 text-gray-400'}`}
        >
            {arMode ? 'AR ACTIVE' : 'AR READY'}
        </button>
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
        <canvas ref={analysisCanvasRef} width={32} height={32} className="hidden" />
        
        {/* AR Overlay Grid & HUD */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${arMode ? 'opacity-100' : 'opacity-20'}`}>
            <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#00ffa3 1px, transparent 1px), linear-gradient(90deg, #00ffa3 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.1 }}></div>
            
            {/* HUD Elements */}
            {arMode && (
                <>
                    {/* Stability Bar */}
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                        <div className="text-[10px] text-neon-green uppercase tracking-wider font-mono">
                            Target Stability
                        </div>
                        <div className="w-32 h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-200 ${stabilityScore > 90 ? 'bg-neon-green' : 'bg-yellow-500'}`}
                                style={{ width: `${stabilityScore}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Detected Info */}
                    {arOverlay && (
                         <div className="absolute top-32 left-4 right-4 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                             <div className="bg-black/60 backdrop-blur-md border border-neon-blue/50 p-4 rounded-lg shadow-[0_0_15px_rgba(0,204,255,0.3)] max-w-sm w-full">
                                 <div className="flex justify-between items-center mb-2">
                                     <span className="text-neon-blue font-bold text-sm tracking-wider uppercase">Live Analysis</span>
                                     <span className="text-xs text-gray-400">{arOverlay.status}</span>
                                 </div>
                                 <div className="flex items-end justify-between">
                                    <div className="space-y-1">
                                        {arOverlay.detectedObjects.map((obj, i) => (
                                            <div key={i} className="text-white text-sm font-mono flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-neon-green"></span>
                                                {obj.label} <span className="text-gray-500 text-xs">{(obj.confidence * 100).toFixed(0)}%</span>
                                            </div>
                                        ))}
                                        {arOverlay.detectedObjects.length === 0 && <div className="text-gray-500 text-xs italic">Scanning for biology...</div>}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-white">{arOverlay.healthEstimate}</div>
                                        <div className="text-[10px] text-gray-400 uppercase">Est. Health</div>
                                    </div>
                                 </div>
                             </div>
                         </div>
                    )}
                </>
            )}
        </div>
        
        {/* Focus Reticle */}
        {!analysisResult && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 rounded-lg flex items-center justify-center transition-all duration-300 ${stabilityScore > 90 ? 'border-neon-green scale-100' : 'border-white/30 scale-105'}`}>
                <div className={`w-4 h-4 border rounded-full transition-colors ${stabilityScore > 90 ? 'border-neon-green bg-neon-green/50' : 'border-white/30 bg-transparent'}`}></div>
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-inherit"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-inherit"></div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-inherit"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-inherit"></div>
            </div>
        )}
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

      {/* Footer Controls */}
      <div className="h-32 bg-black flex items-center justify-center relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent"></div>
        <button 
            onClick={handleCapture}
            disabled={isCapturing || analysisResult !== null}
            className={`w-16 h-16 rounded-full border-4 flex items-center justify-center active:scale-95 transition-all ${analysisResult ? 'border-gray-600 opacity-50' : stabilityScore > 90 && arMode ? 'border-neon-green shadow-[0_0_15px_#00ffa3]' : 'border-white'}`}
        >
            <div className={`w-14 h-14 rounded-full bg-white ${isCapturing ? 'scale-90 opacity-50' : ''} transition-all`}></div>
        </button>
      </div>
    </div>
  );
};