import React, { Suspense } from 'react';
import { useAppController } from './hooks/useAppController';
import { DashboardView } from './components/DashboardView';
import { CameraView } from './components/CameraView';
import { ChatInterface } from './components/ChatInterface';

const App: React.FC = () => {
  const { state, actions } = useAppController();

  return (
    <div className="min-h-screen bg-black text-gray-200 font-sans selection:bg-neon-green selection:text-black">
      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-black/80 backdrop-blur-md border-b border-neutral-800">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center">
                <span className="text-black font-bold text-xs">CP</span>
            </div>
            <h1 className="font-bold text-lg tracking-tight text-white">Cultivator's <span className="text-neon-green">CoPilot</span></h1>
          </div>
          <div className="flex items-center gap-3">
             {/* Status Dot */}
             <div className={`w-2 h-2 rounded-full ${state.isAiLoading ? 'bg-neon-purple animate-pulse' : 'bg-green-500'}`}></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-4 h-screen box-border">
         <Suspense fallback={<div className="flex items-center justify-center h-full text-neon-green">Initializing Neural Uplink...</div>}>
            {state.activeTab === 'dashboard' && (
                <DashboardView 
                    rooms={state.rooms}
                    briefing={state.briefing}
                    batches={state.batches}
                    onRefresh={actions.refreshBriefing}
                />
            )}
            {state.activeTab === 'chat' && <ChatInterface />}
         </Suspense>
      </main>

      {/* Camera Overlay */}
      {state.activeTab === 'camera' && (
        <CameraView 
            onAnalyze={actions.handleImageAnalysis}
            onClose={() => actions.setActiveTab('dashboard')}
        />
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full z-40 bg-black/90 backdrop-blur-lg border-t border-neutral-800 pb-safe">
        <div className="flex justify-around items-center h-16">
            <button 
                onClick={() => actions.setActiveTab('dashboard')} 
                className={`flex flex-col items-center gap-1 w-16 ${state.activeTab === 'dashboard' ? 'text-neon-green' : 'text-gray-500'}`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                <span className="text-[10px] font-bold uppercase tracking-wider">Dash</span>
            </button>
            
            <button 
                onClick={() => actions.setActiveTab('camera')}
                className="flex flex-col items-center justify-center w-14 h-14 bg-neutral-800 rounded-full -mt-6 border border-neutral-700 shadow-lg shadow-neon-green/20 text-white hover:scale-105 transition-transform"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>

            <button 
                onClick={() => actions.setActiveTab('chat')} 
                className={`flex flex-col items-center gap-1 w-16 ${state.activeTab === 'chat' ? 'text-neon-blue' : 'text-gray-500'}`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
            </button>
        </div>
      </nav>
    </div>
  );
};

export default App;