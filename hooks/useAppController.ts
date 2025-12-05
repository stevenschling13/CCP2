import { useState, useEffect, useCallback, useMemo } from 'react';
import { dbService } from '../services/db';
import { hardwareService } from '../services/hardwareService';
import { geminiService } from '../services/geminiService';
import { PlantBatch, Room, GrowLog, FacilityBriefing, LogType, UserSettings } from '../types';

const SETTINGS_STORAGE_KEY = 'ccp_settings';
const DEFAULT_SETTINGS: UserSettings = {
  apiKey: geminiService.currentKey,
  theme: 'dark',
  units: 'metric',
  notificationsEnabled: true,
};

export const useAppController = () => {
  // State
  const [batches, setBatches] = useState<PlantBatch[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [logs, setLogs] = useState<GrowLog[]>([]);
  const [briefing, setBriefing] = useState<FacilityBriefing | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'camera' | 'chat' | 'settings'>('dashboard');
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Initialization
  useEffect(() => {
    const init = async () => {
      try {
        const [loadedBatches, loadedRooms, loadedLogs] = await Promise.all([
          dbService.getBatches(),
          dbService.getRooms(),
          dbService.getLogs()
        ]);
        
        setBatches(loadedBatches);
        setRooms(loadedRooms);
        setLogs(loadedLogs.sort((a, b) => b.timestamp - a.timestamp));

        // Start hardware sim
        loadedRooms.forEach(r => hardwareService.registerRoom(r));
        hardwareService.startSimulation();
        
        // Initial AI Briefing
        generateBriefing(loadedRooms);
      } catch (e) {
        console.error("Initialization failed", e);
      }
    };
    init();

    return () => hardwareService.stopSimulation();
  }, []);

  useEffect(() => {
    const storedSettings = typeof localStorage !== 'undefined'
      ? localStorage.getItem(SETTINGS_STORAGE_KEY)
      : null;

    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings) as UserSettings;
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        setSettings(merged);
        if (merged.apiKey) {
          geminiService.setApiKey(merged.apiKey, false);
        }
      } catch (e) {
        console.error('Failed to load settings', e);
        setSettingsError('Could not load saved settings.');
      }
    } else if (DEFAULT_SETTINGS.apiKey) {
      try {
        geminiService.setApiKey(DEFAULT_SETTINGS.apiKey, false);
      } catch (e) {
        setSettingsError((e as Error).message);
      }
    }
  }, []);

  // Hardware subscriptions
  useEffect(() => {
    const unsubscribe = hardwareService.onReading((roomId, reading) => {
      setRooms(prev => prev.map(r => {
        if (r.id === roomId) {
          // Check thresholds
          let status: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL';
          if (reading.vpd < 0.4 || reading.vpd > 1.6) status = 'WARNING';
          if (reading.temp > 30 || reading.temp < 15) status = 'CRITICAL';
          
          return { ...r, currentReading: reading, status };
        }
        return r;
      }));
    });
    return unsubscribe;
  }, []);

  // Actions
  const persistSettings = useCallback((next: UserSettings) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const updateSettings = useCallback((partial: Partial<UserSettings>) => {
    setSettings(prev => {
      const merged = { ...prev, ...partial };
      persistSettings(merged);
      return merged;
    });

    if (partial.apiKey !== undefined) {
      try {
        geminiService.setApiKey(partial.apiKey);
        setSettingsError(null);
        setSettingsStatus('Gemini API key saved');
      } catch (e) {
        setSettingsError((e as Error).message);
      }
    } else {
      setSettingsStatus('Settings updated');
    }
  }, [persistSettings]);

  const clearSettingsFeedback = useCallback(() => {
    setSettingsStatus(null);
    setSettingsError(null);
  }, []);

  const generateBriefing = useCallback(async (currentRooms: Room[]) => {
    try {
      const result = await geminiService.generateFacilityBriefing(currentRooms);
      setBriefing(result);
    } catch (e) {
      console.warn("Briefing generation failed", e);
    }
  }, []);

  const addLog = useCallback(async (log: GrowLog) => {
    await dbService.saveLog(log);
    setLogs(prev => [log, ...prev]);
  }, []);

  const handleImageAnalysis = useCallback(async (file: File) => {
    setIsAiLoading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      
      const cleanBase64 = base64.split(',')[1];
      const diagnosis = await geminiService.analyzePlantImage(cleanBase64);
      
      const newLog: GrowLog = {
        id: crypto.randomUUID(),
        batchId: batches[0]?.id || 'unknown',
        timestamp: Date.now(),
        type: LogType.OBSERVATION,
        note: `AI Diagnosis: ${diagnosis.issues.join(', ')}`,
        imageUrl: base64,
        aiDiagnosis: diagnosis,
        author: 'AI'
      };
      
      await addLog(newLog);
      return diagnosis;
    } catch (e) {
      alert("Analysis failed: " + (e as Error).message);
    } finally {
      setIsAiLoading(false);
    }
  }, [batches, addLog]);

  return {
    state: {
      batches,
      rooms,
      logs,
      briefing,
      isAiLoading,
      activeTab,
      settings,
      settingsStatus,
      settingsError
    },
    actions: {
      setActiveTab,
      addLog,
      handleImageAnalysis,
      refreshBriefing: () => generateBriefing(rooms),
      updateSettings,
      clearSettingsFeedback
    }
  };
};
