// SettingsPanel.jsx - Settings for AI API, booru sites, download quality
/* global SillyTavern */

import { useState, useEffect } from 'react';

/**
 * Settings Panel Component for HentaiLocal
 */
function SettingsPanel({ extensionName = 'HentaiLocal' }) {
  const [settings, setSettings] = useState({
    aiNaming: {
      enabled: false,
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o-mini',
      maxTokens: 150,
      temperature: 0.7
    },
    scraper: {
      maxResults: 20,
      defaultSite: 'rule34',
      safeMode: false,
      minScore: 0,
      downloadQuality: 'original'
    },
    booruSites: {
      enabled: ['rule34', 'gelbooru', 'danbooru'],
      disabled: ['yandere', 'konachan', 'zerochan', 'sankaku']
    }
  });

  const [saved, setSaved] = useState(false);
  const context = SillyTavern.getContext();

  // Load settings on mount
  useEffect(() => {
    if (context.extensionSettings?.[extensionName]) {
      setSettings(prev => ({
        ...prev,
        ...context.extensionSettings[extensionName]
      }));
    }
  }, [context, extensionName]);

  const saveSettings = () => {
    context.extensionSettings[extensionName] = settings;
    context.saveSettingsDebounced();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAIChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      aiNaming: { ...prev.aiNaming, [key]: value }
    }));
  };

  const handleScraperChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      scraper: { ...prev.scraper, [key]: value }
    }));
  };

  const handleBooruToggle = (site) => {
    setSettings(prev => {
      const enabled = [...prev.booruSites.enabled];
      const disabled = [...prev.booruSites.disabled];
      const idx = enabled.indexOf(site);
      
      if (idx > -1) {
        enabled.splice(idx, 1);
        disabled.push(site);
      } else {
        const didx = disabled.indexOf(site);
        if (didx > -1) {
          disabled.splice(didx, 1);
          enabled.push(site);
        }
      }
      
      return {
        ...prev,
        booruSites: { enabled, disabled }
      };
    });
  };

  const booruSitesList = [
    { key: 'rule34', name: 'Rule34.xxx', category: 'nsfw' },
    { key: 'gelbooru', name: 'Gelbooru', category: 'nsfw' },
    { key: 'danbooru', name: 'Danbooru', category: 'sfw/nsfw' },
    { key: 'paheal', name: 'Paheal', category: 'nsfw' },
    { key: 'yandere', name: 'Yande.re', category: 'sfw' },
    { key: 'konachan', name: 'Konachan', category: 'sfw/nsfw' },
    { key: 'zerochan', name: 'Zerochan', category: 'sfw' },
    { key: 'sankaku', name: 'Sankaku', category: 'nsfw' }
  ];

  const aiProviders = [
    { key: 'openai', name: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { key: 'nanogpt', name: 'NanoGPT', models: ['gpt-4', 'gpt-3.5-turbo'] },
    { key: 'local', name: 'Local LLM', models: ['local-model'] },
    { key: 'oobabooga', name: 'Oobabooga', models: ['ooba-model'] }
  ];

  const selectedProvider = aiProviders.find(p => p.key === settings.aiNaming.provider);

  return (
    <div className="hentai-local-settings">
      <div className="settings-section">
        <h3>AI Naming Configuration</h3>

        <div className="settings-row">
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.aiNaming.enabled}
              onChange={(e) => handleAIChange('enabled', e.target.checked)}
            />
            <span>Enable AI-powered image naming</span>
          </label>
        </div>

        {settings.aiNaming.enabled && (
          <>
            <div className="settings-row">
              <label className="settings-label">Provider:</label>
              <select
                className="settings-select"
                value={settings.aiNaming.provider}
                onChange={(e) => handleAIChange('provider', e.target.value)}
              >
                {aiProviders.map(p => (
                  <option key={p.key} value={p.key}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <label className="settings-label">Model:</label>
              <select
                className="settings-select"
                value={settings.aiNaming.model}
                onChange={(e) => handleAIChange('model', e.target.value)}
              >
                {(selectedProvider?.models || ['gpt-4o-mini']).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <label className="settings-label">API Key:</label>
              <input
                type="password"
                className="settings-input"
                value={settings.aiNaming.apiKey}
                onChange={(e) => handleAIChange('apiKey', e.target.value)}
                placeholder="Enter your API key"
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">Max Tokens:</label>
              <input
                type="number"
                className="settings-input settings-input-small"
                min="50"
                max="500"
                value={settings.aiNaming.maxTokens}
                onChange={(e) => handleAIChange('maxTokens', parseInt(e.target.value))}
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">Temperature:</label>
              <input
                type="range"
                className="settings-range"
                min="0"
                max="1"
                step="0.1"
                value={settings.aiNaming.temperature}
                onChange={(e) => handleAIChange('temperature', parseFloat(e.target.value))}
              />
              <span className="settings-range-value">{settings.aiNaming.temperature}</span>
            </div>
          </>
        )}
      </div>

      <div className="settings-section">
        <h3>Booru Scraper Settings</h3>

        <div className="settings-row">
          <label className="settings-label">Max Results:</label>
          <input
            type="number"
            className="settings-input settings-input-small"
            min="5"
            max="100"
            value={settings.scraper.maxResults}
            onChange={(e) => handleScraperChange('maxResults', parseInt(e.target.value))}
          />
        </div>

        <div className="settings-row">
          <label className="settings-label">Default Site:</label>
          <select
            className="settings-select"
            value={settings.scraper.defaultSite}
            onChange={(e) => handleScraperChange('defaultSite', e.target.value)}
          >
            {booruSitesList.map(s => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="settings-row">
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.scraper.safeMode}
              onChange={(e) => handleScraperChange('safeMode', e.target.checked)}
            />
            <span>Safe Mode (S only - no NSFW)</span>
          </label>
        </div>

        <div className="settings-row">
          <label className="settings-label">Download Quality:</label>
          <select
            className="settings-select"
            value={settings.scraper.downloadQuality}
            onChange={(e) => handleScraperChange('downloadQuality', e.target.value)}
          >
            <option value="thumbnail">Thumbnail</option>
            <option value="sample">Sample</option>
            <option value="original">Original</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3>Enabled Booru Sites</h3>
        <div className="booru-sites-grid">
          {booruSitesList.map(site => {
            const isEnabled = settings.booruSites.enabled.includes(site.key);
            return (
              <button
                key={site.key}
                className={`booru-site-btn ${isEnabled ? 'enabled' : 'disabled'}`}
                onClick={() => handleBooruToggle(site.key)}
                title={`${isEnabled ? 'Disable' : 'Enable'} ${site.name}`}
              >
                <span className="site-name">{site.name}</span>
                <span className="site-category">{site.category}</span>
                <i className={`fa-solid ${isEnabled ? 'fa-check' : 'fa-xmark'}`}></i>
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-actions">
        <button
          className={`settings-btn settings-btn-primary ${saved ? 'saved' : ''}`}
          onClick={saveSettings}
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

export default SettingsPanel;