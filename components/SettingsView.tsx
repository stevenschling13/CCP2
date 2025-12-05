import React, { useEffect, useState } from 'react';
import { UserSettings } from '../types';

interface SettingsViewProps {
  settings: UserSettings;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onUpdate: (partial: Partial<UserSettings>) => void;
  onClearFeedback: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  statusMessage,
  errorMessage,
  onUpdate,
  onClearFeedback,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState(settings.apiKey || '');

  useEffect(() => {
    setApiKeyInput(settings.apiKey || '');
  }, [settings.apiKey]);

  const handleSaveKey = () => {
    onUpdate({ apiKey: apiKeyInput });
  };

  const handleUnitsChange = (units: UserSettings['units']) => {
    onUpdate({ units });
  };

  const handleThemeChange = (theme: UserSettings['theme']) => {
    onUpdate({ theme });
  };

  const toggleNotifications = () => {
    onUpdate({ notificationsEnabled: !settings.notificationsEnabled });
  };

  return (
    <div className="space-y-6 pb-24" onFocus={onClearFeedback}>
      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-neon-green text-xs font-bold uppercase tracking-widest">AI Connectivity</p>
            <h2 className="text-xl font-semibold text-white">Gemini API Key</h2>
            <p className="text-sm text-gray-400">Paste your Google AI Studio key to enable on-device requests.</p>
          </div>
          <span className="px-3 py-1 text-xs rounded-full border border-neutral-700 text-gray-400 bg-neutral-800/60">Secure • Local</span>
        </div>

        <label className="text-sm text-gray-400" htmlFor="apiKey">API Key</label>
        <div className="mt-2 flex gap-3 items-center">
          <input
            id="apiKey"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            className="flex-1 bg-black border border-neutral-700 rounded-lg px-3 py-3 text-sm text-white focus:border-neon-green outline-none"
            placeholder="AIza..."
            autoComplete="off"
          />
          <button
            onClick={handleSaveKey}
            className="px-4 py-3 bg-neon-green text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
          >
            Save Key
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500">
          <span className="px-2 py-1 bg-neutral-800 rounded-full border border-neutral-700">Stored locally</span>
          <span className="px-2 py-1 bg-neutral-800 rounded-full border border-neutral-700">Used instantly</span>
          <span className="px-2 py-1 bg-neutral-800 rounded-full border border-neutral-700">Editable anytime</span>
        </div>

        {(statusMessage || errorMessage) && (
          <div className={`mt-4 text-sm rounded-lg px-3 py-2 border ${errorMessage ? 'border-red-900 bg-red-900/20 text-red-300' : 'border-neon-green/40 bg-neon-green/10 text-neon-green'}`}>
            {errorMessage || statusMessage}
          </div>
        )}
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-neon-blue text-xs font-bold uppercase tracking-widest">Preferences</p>
            <h2 className="text-xl font-semibold text-white">Interface & Telemetry</h2>
            <p className="text-sm text-gray-400">Tune the UI and how environmental data is presented.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between bg-neutral-800/40 border border-neutral-700 rounded-lg p-4">
            <div>
              <p className="text-sm text-gray-400">Theme</p>
              <p className="text-white font-semibold">{settings.theme === 'dark' ? 'Dark' : 'Light'}</p>
            </div>
            <div className="flex gap-2" role="group" aria-label="Theme selector">
              <button
                onClick={() => handleThemeChange('dark')}
                className={`px-3 py-2 text-sm rounded-md border ${settings.theme === 'dark' ? 'bg-neon-green text-black border-neon-green' : 'bg-black border-neutral-700 text-gray-300'}`}
              >
                Dark
              </button>
              <button
                onClick={() => handleThemeChange('light')}
                className={`px-3 py-2 text-sm rounded-md border ${settings.theme === 'light' ? 'bg-neon-green text-black border-neon-green' : 'bg-black border-neutral-700 text-gray-300'}`}
              >
                Light
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-neutral-800/40 border border-neutral-700 rounded-lg p-4">
            <div>
              <p className="text-sm text-gray-400">Units</p>
              <p className="text-white font-semibold">{settings.units === 'metric' ? 'Metric (°C, kPa)' : 'Imperial (°F, inHg)'}</p>
            </div>
            <div className="flex gap-2" role="group" aria-label="Measurement units">
              <button
                onClick={() => handleUnitsChange('metric')}
                className={`px-3 py-2 text-sm rounded-md border ${settings.units === 'metric' ? 'bg-neon-blue text-white border-neon-blue/60' : 'bg-black border-neutral-700 text-gray-300'}`}
              >
                Metric
              </button>
              <button
                onClick={() => handleUnitsChange('imperial')}
                className={`px-3 py-2 text-sm rounded-md border ${settings.units === 'imperial' ? 'bg-neon-blue text-white border-neon-blue/60' : 'bg-black border-neutral-700 text-gray-300'}`}
              >
                Imperial
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-neutral-800/40 border border-neutral-700 rounded-lg p-4 md:col-span-2">
            <div>
              <p className="text-sm text-gray-400">Notifications</p>
              <p className="text-white font-semibold">Get alerts when readings drift or actions finish.</p>
            </div>
            <button
              onClick={toggleNotifications}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${settings.notificationsEnabled ? 'bg-neon-purple/20 border-neon-purple text-neon-purple' : 'bg-black border-neutral-700 text-gray-300'}`}
            >
              {settings.notificationsEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
