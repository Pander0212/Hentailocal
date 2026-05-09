// ScraperPanel.jsx - React component for booru scraper UI
/* global SillyTavern */

import { useState, useEffect, useCallback, useRef } from 'react';
import BooruScraper from './BooruScraper';
import AINaming from './AINaming';

/**
 * Tag Autocomplete Component
 */
function TagAutocomplete({ value, onChange, onAddTag, suggestions, onSelectSuggestion }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value && suggestions.length > 0) {
      const lastWord = value.split(/\s+/).pop().toLowerCase();
      const filtered = suggestions.filter(s => 
        s.toLowerCase().includes(lastWord) && s.toLowerCase() !== lastWord
      ).slice(0, 10);
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [value, suggestions]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !showSuggestions) {
      e.preventDefault();
      onAddTag && onAddTag(value);
    }
  };

  return (
    <div className="tag-autocomplete">
      <input
        ref={inputRef}
        type="text"
        className="tag-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter tags (e.g., 1girl, blue_hair, smile)"
      />
      {showSuggestions && (
        <div className="suggestions-dropdown">
          {filteredSuggestions.map((s, i) => (
            <div
              key={i}
              className="suggestion-item"
              onClick={() => {
                onSelectSuggestion(s);
                setShowSuggestions(false);
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Image Card Component for search results
 */
function ImageCard({ image, onSelect, onSave, characterName }) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(image);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scraper-image-card" onClick={() => onSelect(image)}>
      <div className="image-wrapper">
        <img 
          src={image.thumbnailUrl || image.imageUrl} 
          alt={image.tags?.join(', ') || 'booru image'}
          loading="lazy"
        />
        <div className="image-overlay">
          <span className={`rating rating-${image.rating}`}>
            {image.rating === 's' ? 'Safe' : image.rating === 'q' ? 'Questionable' : 'Explicit'}
          </span>
          <button 
            className="save-btn"
            onClick={(e) => { e.stopPropagation(); handleSave(); }}
            disabled={saving}
            title="Save to character folder"
          >
            {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-download"></i>}
          </button>
        </div>
      </div>
      <div className="image-info">
        <div className="image-tags">
          {image.tags?.slice(0, 3).map((tag, i) => (
            <span key={i} className="tag">{tag}</span>
          ))}
        </div>
        <div className="image-meta">
          {image.width}×{image.height}
        </div>
      </div>
    </div>
  );
}

/**
 * Settings Panel for Scraper
 */
function ScraperSettingsPanel({ settings, onChange, onClose }) {
  return (
    <div className="scraper-settings">
      <div className="settings-row">
        <label>Maximum Results:</label>
        <input
          type="number"
          min="5"
          max="100"
          value={settings.maxResults}
          onChange={(e) => onChange({ maxResults: parseInt(e.target.value) })}
        />
      </div>
      <div className="settings-row">
        <label>Default Site:</label>
        <select
          value={settings.defaultSite}
          onChange={(e) => onChange({ defaultSite: e.target.value })}
        >
          <option value="rule34">Rule34.xxx</option>
          <option value="gelbooru">Gelbooru</option>
          <option value="danbooru">Danbooru</option>
          <option value="paheal">Paheal</option>
          <option value="yandere">Yande.re</option>
          <option value="konachan">Konachan</option>
          <option value="zerochan">Zerochan</option>
          <option value="sankaku">Sankaku</option>
        </select>
      </div>
      <div className="settings-row">
        <label>
          <input
            type="checkbox"
            checked={settings.safeMode}
            onChange={(e) => onChange({ safeMode: e.target.checked })}
          />
          Safe Mode (S only)
        </label>
      </div>
      <button className="settings-close-btn" onClick={onClose}>
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
}

/**
 * Main Scraper Panel Component
 */
function ScraperPanel({ characterName, onClose, onImageSave }) {
  const [searchTags, setSearchTags] = useState('');
  const [selectedSite, setSelectedSite] = useState('rule34');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [scraperSettings, setScraperSettings] = useState({
    maxResults: 20,
    defaultSite: 'rule34',
    safeMode: false
  });
  const context = SillyTavern.getContext();

  // Load saved settings
  useEffect(() => {
    if (context.extensionSettings?.HentaiLocal?.scraper) {
      setScraperSettings(context.extensionSettings.HentaiLocal.scraper);
    }
  }, [context]);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (!searchTags.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const rating = scraperSettings.safeMode ? 's' : ratingFilter === 'all' ? null : ratingFilter;
      const data = await BooruScraper.search(searchTags.trim(), {
        site: selectedSite,
        limit: scraperSettings.maxResults,
        rating
      });
      setResults(data);
    } catch (e) {
      setError(e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchTags, selectedSite, ratingFilter, scraperSettings]);

  // Get tag suggestions
  const handleTagChange = useCallback(async (value) => {
    setSearchTags(value);
    if (value.length > 2) {
      const suggestions = await BooruScraper.getTagSuggestions(value, selectedSite);
      setTagSuggestions(suggestions);
    }
  }, [selectedSite]);

  // Select tag from suggestions
  const handleTagSelect = (tag) => {
    const words = searchTags.split(/\s+/);
    words[words.length - 1] = tag;
    setSearchTags(words.join(' '));
    setTagSuggestions([]);
  };

  // Save image to character folder
  const handleSaveImage = async (image) => {
    try {
      // Download image
      const imageData = await BooruScraper.downloadImage(image.imageUrl);
      
      let filename = image.generatedName || `${image.id}`;
      const ext = imageData.ext || 'jpg';
      const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
      
      // Upload via ST API
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        headers: context.getRequestHeaders(),
        body: JSON.stringify({
          image: imageData.data,
          ch_name: characterName,
          filename: cleanName,
          format: ext
        })
      });

      if (!response.ok) throw new Error('Upload failed');

      const imagePath = `user/images/${characterName}/${cleanName}.${ext}`;
      const description = image.generatedDescription || image.tags?.join(', ');

      onImageSave && onImageSave(cleanName, imagePath, description);
    } catch (e) {
      console.error('[ScraperPanel] Save error:', e);
      setError(`Failed to save: ${e.message}`);
    }
  };

  // AI Name generation for selected image
  const handleAIName = async (image) => {
    if (!AINaming.isAvailable()) return;
    
    try {
      const [name, description] = await Promise.all([
        AINaming.generateName(image.tags, characterName),
        AINaming.generateDescription(image.tags, characterName)
      ]);
      
      setSelectedImage({ ...image, generatedName: name, generatedDescription: description });
    } catch (e) {
      console.error('[ScraperPanel] AI naming failed:', e);
    }
  };

  // Handle settings change
  const handleSettingsChange = (newSettings) => {
    setScraperSettings(prev => ({ ...prev, ...newSettings }));
    
    if (context.extensionSettings?.HentaiLocal) {
      context.extensionSettings.HentaiLocal.scraper = { ...scraperSettings, ...newSettings };
      context.saveSettingsDebounced();
    }
  };

  return (
    <div className="scraper-panel-backdrop" onClick={onClose}>
      <div className="scraper-panel" onClick={(e) => e.stopPropagation()}>
        <div className="scraper-header">
          <h3>Booru Image Scraper - {characterName}</h3>
          <div className="scraper-actions">
            <button onClick={() => setShowSettings(!showSettings)}>
              <i className="fa-solid fa-gear"></i>
            </button>
            <button onClick={onClose}>
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
        </div>

        {showSettings && (
          <ScraperSettingsPanel
            settings={scraperSettings}
            onChange={handleSettingsChange}
            onClose={() => setShowSettings(false)}
          />
        )}

        <div className="scraper-search">
          <TagAutocomplete
            value={searchTags}
            onChange={handleTagChange}
            suggestions={tagSuggestions}
            onSelectSuggestion={handleTagSelect}
          />
          <select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)}>
            <option value="rule34">Rule34.xxx</option>
            <option value="gelbooru">Gelbooru</option>
            <option value="danbooru">Danbooru</option>
            <option value="paheal">Paheal</option>
            <option value="yandere">Yande.re</option>
            <option value="konachan">Konachan</option>
            <option value="zerochan">Zerochan</option>
            <option value="sankaku">Sankaku</option>
          </select>
          <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
            <option value="all">All Ratings</option>
            <option value="s">Safe</option>
            <option value="q">Questionable</option>
            <option value="e">Explicit</option>
          </select>
          <button onClick={handleSearch} disabled={loading || !searchTags.trim()}>
            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-search"></i>}
          </button>
        </div>

        {error && <div className="scraper-error">{error}</div>}

        <div className="scraper-results">
          {loading ? (
            <div className="scraper-loading">Searching...</div>
          ) : results.length === 0 ? (
            <div className="scraper-empty">Enter tags and click search</div>
          ) : (
            <div className="scraper-grid">
              {results.map((image) => (
                <ImageCard
                  key={`${image.site}-${image.id}`}
                  image={image}
                  onSelect={setSelectedImage}
                  onSave={handleSaveImage}
                  characterName={characterName}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScraperPanel;