import React from 'react';
import { Room, FacilityBriefing, PlantBatch } from '../types';

interface DashboardProps {
  rooms: Room[];
  briefing: FacilityBriefing | null;
  batches: PlantBatch[];
  onRefresh: () => void;
}

const StatCard: React.FC<{ label: string; value: string; unit: string; color?: string }> = ({ label, value, unit, color }) => (
  <div className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-800">
    <div className="text-gray-500 text-xs uppercase tracking-wider">{label}</div>
    <div className={`text-2xl font-mono font-bold ${color || 'text-white'}`}>
      {value}<span className="text-sm text-gray-600 ml-1">{unit}</span>
    </div>
  </div>
);

export const DashboardView: React.FC<DashboardProps> = ({ rooms, briefing, batches, onRefresh }) => {
  const playBriefing = () => {
    if (!briefing || typeof window === 'undefined') return;
    
    // Stop any existing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(briefing.summary);
    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Briefing Section */}
      <section className="relative overflow-hidden rounded-xl bg-neutral-900 border border-neutral-800 p-6">
        <div className="absolute top-0 left-0 w-1 h-full bg-neon-green shadow-[0_0_10px_#00ffa3]"></div>
        <div className="flex justify-between items-start mb-4">
            <div>
                <h2 className="text-neon-green font-bold tracking-widest text-sm uppercase mb-1">Facility Briefing</h2>
                <div className="text-xs text-gray-500">AI-Generated • {new Date().toLocaleTimeString()}</div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={playBriefing} 
                    className="p-2 hover:bg-neutral-800 rounded-full transition-colors group"
                    title="Read Briefing"
                >
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-neon-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                </button>
                <button 
                    onClick={onRefresh} 
                    className="p-2 hover:bg-neutral-800 rounded-full transition-colors group"
                    title="Refresh Data"
                >
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-neon-green transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>
        </div>
        
        {briefing ? (
          <div className="space-y-4">
            <p className="text-lg text-white font-light leading-relaxed">{briefing.summary}</p>
            <div className="flex flex-wrap gap-2">
                {briefing.actionItems.map((item, i) => (
                    <span key={i} className="px-3 py-1 bg-neon-purple/20 text-neon-purple text-xs rounded-full border border-neon-purple/30">
                        {item}
                    </span>
                ))}
            </div>
            <div className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                briefing.status === 'OPTIMAL' ? 'bg-green-900/50 text-green-400' : 
                briefing.status === 'CRITICAL' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'
            }`}>
                SYSTEM STATUS: {briefing.status}
            </div>
          </div>
        ) : (
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-neutral-800 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-neutral-800 rounded"></div>
                <div className="h-4 bg-neutral-800 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Rooms Grid */}
      <section>
        <h3 className="text-gray-400 text-sm font-bold uppercase mb-4 tracking-wider">Active Environments</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rooms.map(room => (
            <div key={room.id} className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 relative group hover:border-neon-blue transition-colors duration-300">
               <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${room.status === 'NOMINAL' ? 'bg-neon-green shadow-[0_0_8px_#00ffa3]' : 'bg-red-500 shadow-[0_0_8px_#ff0000]'} animate-pulse`}></div>
               <h4 className="text-white font-bold text-lg mb-4">{room.name}</h4>
               
               <div className="grid grid-cols-2 gap-3">
                 <StatCard 
                    label="Temp" 
                    value={room.currentReading?.temp.toFixed(1) || '--'} 
                    unit="°C" 
                    color={room.currentReading && room.currentReading.temp > 28 ? 'text-red-400' : 'text-neon-blue'}
                 />
                 <StatCard 
                    label="RH" 
                    value={room.currentReading?.humidity.toFixed(0) || '--'} 
                    unit="%"
                 />
                 <StatCard 
                    label="VPD" 
                    value={room.currentReading?.vpd.toFixed(2) || '--'} 
                    unit="kPa"
                    color={room.currentReading && (room.currentReading.vpd < 0.8 || room.currentReading.vpd > 1.5) ? 'text-yellow-400' : 'text-neon-green'}
                 />
                 <StatCard 
                    label="CO2" 
                    value={room.currentReading?.co2.toString() || '--'} 
                    unit="ppm"
                 />
               </div>
            </div>
          ))}
        </div>
      </section>

      {/* Batches List */}
      <section>
        <h3 className="text-gray-400 text-sm font-bold uppercase mb-4 tracking-wider">Plant Batches</h3>
        <div className="space-y-3">
          {batches.map(batch => (
            <div key={batch.id} className="flex items-center justify-between bg-neutral-900 p-4 rounded-lg border border-neutral-800">
              <div>
                <div className="text-white font-bold">{batch.name}</div>
                <div className="text-xs text-gray-500">{batch.strain} • {batch.stage}</div>
              </div>
              <div className="text-right">
                <div className="text-neon-green text-sm font-mono">{Math.floor((Date.now() - batch.startDate) / (1000 * 60 * 60 * 24))} Days</div>
                <div className="text-xs text-gray-600">{batch.plantedCount} Plants</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};