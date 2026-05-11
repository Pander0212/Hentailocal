/* global SillyTavern */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getBooruSites, searchBooru, autocompleteTags, downloadImage } from './booru';
import { generateImageName, generateFallbackName, getAINamingSettings } from './ai-naming';

/**
 * Get request headers for ST API calls
 */
function getRequestHeaders() {
    return SillyTavern.getContext().getRequestHeaders();
}

/**
 * Tag Input Component with Autocomplete
 */
function TagInput({ value, onChange, onSearch, suggestions, placeholder }) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
    const inputRef = useRef(null);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedSuggestion >= 0 && suggestions[selectedSuggestion]) {
                const tag = suggestions[selectedSuggestion].value;
                onChange(tag);
                setShowSuggestions(false);
                setSelectedSuggestion(-1);
                onSearch();
            } else {
                onSearch();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedSuggestion(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setSelectedSuggestion(-1);
        } else if (e.key === 'Tab' && selectedSuggestion >= 0 && suggestions[selectedSuggestion]) {
            e.preventDefault();
            onChange(suggestions[selectedSuggestion].value);
            setShowSuggestions(false);
            setSelectedSuggestion(-1);
        }
    };

    const handleInputChange = (e) => {
        onChange(e.target.value);
        setShowSuggestions(true);
        setSelectedSuggestion(-1);
    };

    const handleSuggestionClick = (suggestion) => {
        onChange(suggestion.value);
        setShowSuggestions(false);
        setSelectedSuggestion(-1);
        inputRef.current?.focus();
    };

    return (
        <div className="hentailocal-tag-input-container">
            <input
                ref={inputRef}
                type="text"
                className="hentailocal-tag-input"
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={placeholder || 'Enter tags (space separated)...'}
            />
            {showSuggestions && suggestions.length > 0 && (
                <div className="hentailocal-suggestions">
                    {suggestions.map((s, i) => (
                        <div
                            key={i}
                            className={`hentailocal-suggestion-item ${i === selectedSuggestion ? 'selected' : ''}`}
                            onMouseDown={() => handleSuggestionClick(s)}
                            onMouseEnter={() => setSelectedSuggestion(i)}
                        >
                            <span className="suggestion-value">{s.label || s.value}</span>
                            {s.category && <span className="suggestion-category">{s.category}</span>}
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
function ImageCard({ post, onSave, onAINaming, onPreview, isSaving, isAINaming }) {
    return (
        <div className="hentailocal-image-card">
            <div className="hentailocal-image-thumb" onClick={() => onPreview(post)}>
                <img src={post.thumbnail} alt={post.tags?.join(', ') || ''} loading="lazy" />
                <div className="hentailocal-image-overlay">
                    <span className="hentailocal-image-site">{post.siteName}</span>
                    <span className="hentailocal-image-score">★ {post.score}</span>
                    <span className={`hentailocal-image-rating rating-${post.rating}`}>{post.rating}</span>
                </div>
            </div>
            <div className="hentailocal-image-actions">
                <button
                    className="hentailocal-btn hentailocal-btn-save"
                    onClick={() => onSave(post)}
                    disabled={isSaving}
                    title="Save to LocalImage"
                >
                    {isSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-download"></i>}
                </button>
                <button
                    className="hentailocal-btn hentailocal-btn-ai"
                    onClick={() => onAINaming(post)}
                    disabled={isAINaming}
                    title="AI Name & Save"
                >
                    {isAINaming ? <i className="fa-solid fa-wand-magic-sparkles fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                </button>
            </div>
        </div>
    );
}

/**
 * Scraper Panel Component
 */
function ScraperPanel({ characterName, onImageSaved }) {
    const sites = getBooruSites();
    const [selectedSite, setSelectedSite] = useState('rule34');
    const [searchTags, setSearchTags] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [rating, setRating] = useState('');
    const [savingImages, setSavingImages] = useState(new Set());
    const [aiNamingImages, setAiNamingImages] = useState(new Set());
    const [previewImage, setPreviewImage] = useState(null);
    const [targetFolder, setTargetFolder] = useState(characterName || '');
    const [subfolder, setSubfolder] = useState('');
    const [batchMode, setBatchMode] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState(new Set());
    const [statusMessage, setStatusMessage] = useState('');

    // Update target folder when character changes
    useEffect(() => {
        if (characterName) setTargetFolder(characterName);
    }, [characterName]);

    // Debounced tag autocomplete
    const autocompleteTimer = useRef(null);
    useEffect(() => {
        if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
        if (!searchTags || searchTags.length < 2) {
            setSuggestions([]);
            return;
        }
        autocompleteTimer.current = setTimeout(async () => {
            try {
                const tags = await autocompleteTags(selectedSite, searchTags);
                setSuggestions(tags);
            } catch (e) {
                setSuggestions([]);
            }
        }, 300);
        return () => { if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current); };
    }, [searchTags, selectedSite]);

    const handleSearch = useCallback(async (page = 1) => {
        if (!searchTags.trim()) {
            setError('Please enter search tags');
            return;
        }
        setLoading(true);
        setError(null);
        setCurrentPage(page);
        setStatusMessage('');

        try {
            const posts = await searchBooru(selectedSite, searchTags.trim(), {
                limit: 20,
                page,
                rating: rating || null,
            });
            setResults(posts);
            if (posts.length === 0) {
                setStatusMessage('No results found. Try different tags.');
            } else {
                setStatusMessage(`Found ${posts.length} results on ${sites[selectedSite]?.name}`);
            }
        } catch (err) {
            setError(err.message);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [selectedSite, searchTags, rating, sites]);

    const handleSaveImage = useCallback(async (post, useAI = false) => {
        const imageKey = `${post.siteKey}_${post.id}`;
        const savingSet = new Set(useAI ? aiNamingImages : savingImages);
        savingSet.add(imageKey);
        if (useAI) setAiNamingImages(savingSet);
        else setSavingImages(savingSet);
        setError(null);

        try {
            // Download the image
            const { base64, ext } = await downloadImage(post.fullImage);

            // Determine the folder path
            let folder = targetFolder;
            if (subfolder) folder = `${targetFolder}/${subfolder}`;

            // Generate filename
            let filename;
            let description = '';

            if (useAI) {
                try {
                    const aiResult = await generateImageName(post);
                    filename = aiResult.name;
                    description = aiResult.description;
                } catch (aiErr) {
                    console.warn('[HentaiLocal] AI naming failed, using fallback:', aiErr.message);
                    filename = generateFallbackName(post);
                }
            } else {
                filename = generateFallbackName(post);
            }

            // Upload to ST's image storage
            const response = await fetch('/api/images/upload', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    image: base64,
                    ch_name: folder,
                    filename: filename,
                    format: ext.replace(/^\.?/, ''),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
            }

            const imagePath = `user/images/${folder}/${filename}.${ext.replace(/^\.?/, '')}`;

            // Assign in LocalImage system
            if (onImageSaved) {
                onImageSaved(folder, filename, imagePath, description);
            }

            setStatusMessage(`Saved as "${filename}" for ${folder}`);

            // Remove from saving sets
            const newSaving = new Set(savingImages);
            newSaving.delete(imageKey);
            setSavingImages(newSaving);
            const newAINaming = new Set(aiNamingImages);
            newAINaming.delete(imageKey);
            setAiNamingImages(newAINaming);
        } catch (err) {
            console.error('[HentaiLocal] Save failed:', err);
            setError(`Failed to save image: ${err.message}`);
            const newSaving = new Set(savingImages);
            newSaving.delete(imageKey);
            setSavingImages(newSaving);
            const newAINaming = new Set(aiNamingImages);
            newAINaming.delete(imageKey);
            setAiNamingImages(newAINaming);
        }
    }, [targetFolder, subfolder, savingImages, aiNamingImages, onImageSaved]);

    const handleBatchSave = useCallback(async () => {
        if (selectedBatch.size === 0) return;
        const posts = results.filter((_, i) => selectedBatch.has(i));
        const aiSettings = getAINamingSettings();

        for (const post of posts) {
            await handleSaveImage(post, aiSettings.autoDescribe);
            // Small delay between saves
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        setSelectedBatch(new Set());
        setBatchMode(false);
    }, [selectedBatch, results, handleSaveImage]);

    const toggleBatchSelection = (index) => {
        setSelectedBatch(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) newSet.delete(index);
            else newSet.add(index);
            return newSet;
        });
    };

    const siteEntries = Object.entries(sites);

    return (
        <div className="hentailocal-scraper-panel">
            {/* Site Selector */}
            <div className="hentailocal-scraper-section">
                <label className="hentailocal-label">Booru Site</label>
                <div className="hentailocal-site-selector">
                    {siteEntries.map(([key, site]) => (
                        <button
                            key={key}
                            className={`hentailocal-site-btn ${selectedSite === key ? 'active' : ''}`}
                            onClick={() => { setSelectedSite(key); setSuggestions([]); }}
                            title={site.name}
                        >
                            <span className="site-icon">{site.icon}</span>
                            <span className="site-name">{site.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Search Bar */}
            <div className="hentailocal-scraper-section">
                <label className="hentailocal-label">Search Tags</label>
                <div className="hentailocal-search-row">
                    <TagInput
                        value={searchTags}
                        onChange={setSearchTags}
                        onSearch={() => handleSearch(1)}
                        suggestions={suggestions}
                        placeholder="1girl, blue_hair, weapon..."
                    />
                    <button
                        className="hentailocal-btn hentailocal-btn-search"
                        onClick={() => handleSearch(1)}
                        disabled={loading}
                    >
                        {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-search"></i>}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="hentailocal-scraper-section hentailocal-filters">
                <label className="hentailocal-label">Rating</label>
                <select
                    className="hentailocal-select"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                >
                    <option value="">All</option>
                    <option value="safe">Safe</option>
                    <option value="questionable">Questionable</option>
                    <option value="explicit">Explicit</option>
                </select>

                <label className="hentailocal-label">Save To</label>
                <input
                    type="text"
                    className="hentailocal-input"
                    value={targetFolder}
                    onChange={(e) => setTargetFolder(e.target.value)}
                    placeholder="Character name"
                />

                <label className="hentailocal-label">Subfolder</label>
                <input
                    type="text"
                    className="hentailocal-input hentailocal-input-sm"
                    value={subfolder}
                    onChange={(e) => setSubfolder(e.target.value)}
                    placeholder="Outfits, Expressions..."
                />
            </div>

            {/* Batch controls */}
            <div className="hentailocal-scraper-section hentailocal-batch-bar">
                <button
                    className={`hentailocal-btn ${batchMode ? 'active' : ''}`}
                    onClick={() => { setBatchMode(!batchMode); setSelectedBatch(new Set()); }}
                >
                    <i className="fa-solid fa-check-double"></i> Batch
                </button>
                {batchMode && selectedBatch.size > 0 && (
                    <button
                        className="hentailocal-btn hentailocal-btn-batch-save"
                        onClick={handleBatchSave}
                    >
                        <i className="fa-solid fa-download"></i> Save {selectedBatch.size} images (AI named)
                    </button>
                )}
            </div>

            {/* Status */}
            {statusMessage && (
                <div className="hentailocal-status">{statusMessage}</div>
            )}

            {/* Error */}
            {error && (
                <div className="hentailocal-error">{error}</div>
            )}

            {/* Results Grid */}
            <div className="hentailocal-results">
                {results.map((post, index) => (
                    <div key={`${post.siteKey}_${post.id}`} className="hentailocal-result-wrapper">
                        {batchMode && (
                            <input
                                type="checkbox"
                                className="hentailocal-batch-check"
                                checked={selectedBatch.has(index)}
                                onChange={() => toggleBatchSelection(index)}
                            />
                        )}
                        <ImageCard
                            post={post}
                            onSave={(p) => handleSaveImage(p, false)}
                            onAINaming={(p) => handleSaveImage(p, true)}
                            onPreview={setPreviewImage}
                            isSaving={savingImages.has(`${post.siteKey}_${post.id}`)}
                            isAINaming={aiNamingImages.has(`${post.siteKey}_${post.id}`)}
                        />
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {results.length > 0 && (
                <div className="hentailocal-pagination">
                    <button
                        className="hentailocal-btn"
                        onClick={() => handleSearch(currentPage - 1)}
                        disabled={currentPage <= 1 || loading}
                    >
                        <i className="fa-solid fa-chevron-left"></i> Prev
                    </button>
                    <span className="hentailocal-page-info">Page {currentPage}</span>
                    <button
                        className="hentailocal-btn"
                        onClick={() => handleSearch(currentPage + 1)}
                        disabled={loading}
                    >
                        Next <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            )}

            {/* Preview Lightbox */}
            {previewImage && (
                <div className="hentailocal-lightbox" onClick={() => setPreviewImage(null)}>
                    <div className="hentailocal-lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <img src={previewImage.fullImage} alt="Preview" />
                        <div className="hentailocal-lightbox-info">
                            <span>Source: {previewImage.siteName}</span>
                            <span>Rating: {previewImage.rating}</span>
                            <span>Score: {previewImage.score}</span>
                            {previewImage.tags && previewImage.tags.length > 0 && (
                                <div className="hentailocal-lightbox-tags">
                                    {previewImage.tags.slice(0, 15).map((tag, i) => (
                                        <span key={i} className="hentailocal-tag-chip">{tag}</span>
                                    ))}
                                    {previewImage.tags.length > 15 && <span className="hentailocal-tag-more">+{previewImage.tags.length - 15} more</span>}
                                </div>
                            )}
                        </div>
                        <div className="hentailocal-lightbox-actions">
                            <button onClick={() => { handleSaveImage(previewImage, false); setPreviewImage(null); }}>
                                <i className="fa-solid fa-download"></i> Save
                            </button>
                            <button onClick={() => { handleSaveImage(previewImage, true); setPreviewImage(null); }}>
                                <i className="fa-solid fa-wand-magic-sparkles"></i> AI Name & Save
                            </button>
                            <button onClick={() => setPreviewImage(null)}>
                                <i className="fa-solid fa-times"></i> Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ScraperPanel;
