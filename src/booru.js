/* global SillyTavern */

/**
 * Booru Site Definitions
 * Each site defines its API endpoint, response format, and how to extract images
 */
const BOORU_SITES = {
    rule34: {
        name: 'Rule34',
        icon: '🟠',
        baseUrl: 'https://api.rule34.xxx',
        searchEndpoint: '/index.php?page=dapi&s=post&q=index',
        tagsEndpoint: '/autocomplete.php',
        ratingMap: { safe: 'rating:safe', questionable: 'rating:questionable', explicit: 'rating:explicit' },
        hasAutocomplete: true,
        corsProxy: true,
    },
    gelbooru: {
        name: 'Gelbooru',
        icon: '🔵',
        baseUrl: 'https://gelbooru.com',
        searchEndpoint: '/index.php?page=dapi&s=post&q=index',
        tagsEndpoint: '/index.php?page=dapi&s=tag&q=index',
        ratingMap: { safe: 'rating:safe', questionable: 'rating:questionable', explicit: 'rating:explicit' },
        hasAutocomplete: true,
        corsProxy: true,
    },
    danbooru: {
        name: 'Danbooru',
        icon: '🔴',
        baseUrl: 'https://danbooru.donmai.us',
        searchEndpoint: '/posts.json',
        tagsEndpoint: '/autocomplete.json',
        ratingMap: { safe: 's', questionable: 'q', explicit: 'e' },
        hasAutocomplete: true,
        corsProxy: true,
    },
    safebooru: {
        name: 'Safebooru',
        icon: '🟢',
        baseUrl: 'https://safebooru.org',
        searchEndpoint: '/index.php?page=dapi&s=post&q=index',
        tagsEndpoint: '/autocomplete.php',
        ratingMap: {},
        hasAutocomplete: false,
        corsProxy: true,
    },
    yandere: {
        name: 'Yande.re',
        icon: '🟣',
        baseUrl: 'https://yande.re',
        searchEndpoint: '/post.json',
        tagsEndpoint: '/tag/autocomplete.json',
        ratingMap: { safe: 'rating:safe', questionable: 'rating:questionable', explicit: 'rating:explicit' },
        hasAutocomplete: true,
        corsProxy: true,
    },
    konachan: {
        name: 'Konachan',
        icon: '🌸',
        baseUrl: 'https://konachan.com',
        searchEndpoint: '/post.json',
        tagsEndpoint: '/tag/autocomplete.json',
        ratingMap: { safe: 'rating:safe', questionable: 'rating:questionable', explicit: 'rating:explicit' },
        hasAutocomplete: true,
        corsProxy: true,
    },
    paheal: {
        name: 'Paheal',
        icon: '🟤',
        baseUrl: 'https://shimmie.shishnet.org',
        searchEndpoint: '/api/danbooru/find_posts/index.json',
        tagsEndpoint: '/api/internal/autocomplete',
        ratingMap: { explicit: 'rating:explicit' },
        hasAutocomplete: false,
        corsProxy: true,
        altBaseUrl: 'https://rule34.paheal.net',
    },
    sankaku: {
        name: 'Sankaku',
        icon: '⚡',
        baseUrl: 'https://capi-v2.sankakucomplex.com',
        searchEndpoint: '/posts',
        tagsEndpoint: '/tags/autocomplete',
        ratingMap: { safe: 'rating:s', questionable: 'rating:q', explicit: 'rating:e' },
        hasAutocomplete: true,
        corsProxy: true,
    },
    zerochan: {
        name: 'Zerochan',
        icon: '⚪',
        baseUrl: 'https://www.zerochan.net',
        searchEndpoint: '/search.json',
        tagsEndpoint: '/autocomplete.json',
        ratingMap: { safe: 'safe' },
        hasAutocomplete: false,
        corsProxy: true,
    },
    lolibooru: {
        name: 'Lolibooru',
        icon: '🎀',
        baseUrl: 'https://lolibooru.moe',
        searchEndpoint: '/post.json',
        tagsEndpoint: '/tag/autocomplete.json',
        ratingMap: { safe: 'rating:safe', questionable: 'rating:questionable', explicit: 'rating:explicit' },
        hasAutocomplete: true,
        corsProxy: true,
    },
};

/**
 * Rate limiter to respect booru site rate limits
 */
class RateLimiter {
    constructor() {
        this.lastRequest = {};
        this.minInterval = 1000; // 1 second between requests to same site
    }

    async wait(siteKey) {
        const now = Date.now();
        const lastTime = this.lastRequest[siteKey] || 0;
        const elapsed = now - lastTime;
        
        if (elapsed < this.minInterval) {
            await new Promise(resolve => setTimeout(resolve, this.minInterval - elapsed));
        }
        
        this.lastRequest[siteKey] = Date.now();
    }
}

const rateLimiter = new RateLimiter();

/**
 * Make a request through SillyTavern's proxy to avoid CORS issues
 */
async function proxyFetch(url, options = {}) {
    const context = SillyTavern.getContext();
    const headers = context.getRequestHeaders();
    
    // Use ST's built-in proxy endpoint
    try {
        const response = await fetch('/api/extensions/proxy', {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, method: options.method || 'GET' }),
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.warn('[HentaiLocal] Proxy fetch failed, trying direct:', e.message);
    }
    
    // Fallback: try direct fetch (works for some APIs with CORS headers)
    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'HentaiLocal/1.0',
            },
        });
        if (response.ok) {
            return await response.json();
        }
        throw new Error(`HTTP ${response.status}`);
    } catch (e) {
        console.error('[HentaiLocal] Direct fetch also failed:', e.message);
        throw e;
    }
}

/**
 * Normalize search results from different booru sites into a common format
 * @param {Object} post - Raw post from the API
 * @param {string} siteKey - The booru site key
 * @returns {Object} Normalized post object
 */
function normalizePost(post, siteKey) {
    const site = BOORU_SITES[siteKey];
    
    switch (siteKey) {
        case 'danbooru':
            return {
                id: post.id,
                thumbnail: post.preview_file_url || `https://danbooru.donmai.us/data/preview/${post.md5}.jpg`,
                fullImage: post.file_url || `https://danbooru.donmai.us/data/${post.md5}.${post.file_ext}`,
                tags: (post.tag_string || '').split(' ').filter(Boolean),
                score: post.score || 0,
                rating: post.rating || 'q',
                source: post.source,
                siteKey,
                siteName: site.name,
                width: post.image_width,
                height: post.image_height,
                fileExt: post.file_ext,
            };
            
        case 'gelbooru':
        case 'rule34':
        case 'safebooru':
            return {
                id: post.id,
                thumbnail: post.preview_url || post.sample_url || post.file_url,
                fullImage: post.file_url || post.sample_url,
                tags: (post.tags || '').split(' ').filter(Boolean),
                score: parseInt(post.score) || 0,
                rating: post.rating || 'e',
                source: post.source,
                siteKey,
                siteName: site.name,
                width: parseInt(post.width) || 0,
                height: parseInt(post.height) || 0,
                fileExt: (post.file_url || '').split('.').pop()?.split('?')[0] || 'jpg',
            };
            
        case 'yandere':
        case 'konachan':
        case 'lolibooru':
            return {
                id: post.id,
                thumbnail: post.preview_url || post.sample_url,
                fullImage: post.file_url || post.sample_url || post.jpeg_url,
                tags: (post.tags || '').split(' ').filter(Boolean),
                score: post.score || 0,
                rating: post.rating || 'e',
                source: post.source,
                siteKey,
                siteName: site.name,
                width: post.width,
                height: post.height,
                fileExt: (post.file_url || '').split('.').pop()?.split('?')[0] || 'jpg',
            };
            
        case 'paheal':
            return {
                id: post.id,
                thumbnail: post.preview_url || post.thumb_url,
                fullImage: post.file_url || post.image_url,
                tags: (post.tags || '').split(' ').filter(Boolean),
                score: 0,
                rating: 'e',
                source: post.source,
                siteKey,
                siteName: site.name,
                width: post.width || 0,
                height: post.height || 0,
                fileExt: (post.file_url || '').split('.').pop()?.split('?')[0] || 'jpg',
            };
            
        case 'sankaku':
            return {
                id: post.id,
                thumbnail: post.preview_url || post.sample_url,
                fullImage: post.file_url || post.sample_url,
                tags: (post.tags || []).map(t => t.name || t).filter(Boolean),
                score: post.score || 0,
                rating: post.rating || 'e',
                source: post.source,
                siteKey,
                siteName: site.name,
                width: post.width,
                height: post.height,
                fileExt: (post.file_url || '').split('.').pop()?.split('?')[0] || 'jpg',
            };

        case 'zerochan':
            return {
                id: post.id,
                thumbnail: post.thumbnail || post.thumb,
                fullImage: post.full || post.file_url,
                tags: (post.tags || '').split(', ').filter(Boolean),
                score: 0,
                rating: 's',
                source: post.source,
                siteKey,
                siteName: site.name,
                width: post.width,
                height: post.height,
                fileExt: 'jpg',
            };
            
        default:
            return {
                id: post.id,
                thumbnail: post.preview_url || post.thumbnail,
                fullImage: post.file_url || post.image_url,
                tags: [],
                score: 0,
                rating: 'q',
                source: '',
                siteKey,
                siteName: site?.name || 'Unknown',
                width: 0,
                height: 0,
                fileExt: 'jpg',
            };
    }
}

/**
 * Search for images on a booru site
 * @param {string} siteKey - The booru site key
 * @param {string} tags - Search tags (space-separated)
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of normalized posts
 */
async function searchBooru(siteKey, tags, options = {}) {
    const site = BOORU_SITES[siteKey];
    if (!site) throw new Error(`Unknown booru site: ${siteKey}`);
    
    await rateLimiter.wait(siteKey);
    
    const {
        limit = 20,
        page = 1,
        rating = null,
    } = options;
    
    // Build tag string with rating filter
    let tagString = tags || '';
    if (rating && site.ratingMap[rating]) {
        tagString += ` ${site.ratingMap[rating]}`;
    }
    
    try {
        let url;
        let posts;
        
        switch (siteKey) {
            case 'danbooru': {
                const params = new URLSearchParams({
                    tags: tagString.trim(),
                    limit: Math.min(limit, 100).toString(),
                    page: page.toString(),
                });
                url = `${site.baseUrl}${site.searchEndpoint}?${params}`;
                posts = await proxyFetch(url);
                if (!Array.isArray(posts)) posts = [];
                break;
            }
            
            case 'gelbooru':
            case 'rule34':
            case 'safebooru': {
                const params = new URLSearchParams({
                    tags: tagString.trim(),
                    limit: Math.min(limit, 100).toString(),
                    pid: ((page - 1) * limit).toString(),
                    json: '1',
                });
                url = `${site.baseUrl}${site.searchEndpoint}&${params}`;
                const data = await proxyFetch(url);
                // Gelbooru/Rule34 return { post: [...] } or just [...]
                posts = Array.isArray(data) ? data : (data?.post || data?.posts || []);
                break;
            }
            
            case 'yandere':
            case 'konachan':
            case 'lolibooru': {
                const params = new URLSearchParams({
                    tags: tagString.trim(),
                    limit: Math.min(limit, 100).toString(),
                    page: page.toString(),
                });
                url = `${site.baseUrl}${site.searchEndpoint}?${params}`;
                posts = await proxyFetch(url);
                if (!Array.isArray(posts)) posts = [];
                break;
            }
            
            case 'paheal': {
                const base = site.altBaseUrl || site.baseUrl;
                const params = new URLSearchParams({
                    tags: tagString.trim(),
                    limit: Math.min(limit, 100).toString(),
                    page: page.toString(),
                });
                url = `${base}${site.searchEndpoint}?${params}`;
                posts = await proxyFetch(url);
                if (!Array.isArray(posts)) posts = [];
                break;
            }
            
            case 'sankaku': {
                const params = new URLSearchParams({
                    tags: tagString.trim(),
                    limit: Math.min(limit, 40).toString(),
                    page: page.toString(),
                });
                url = `${site.baseUrl}${site.searchEndpoint}?${params}`;
                posts = await proxyFetch(url);
                if (!Array.isArray(posts)) posts = [];
                break;
            }

            case 'zerochan': {
                const tagPath = tagString.trim().replace(/\s+/g, '+');
                url = `${site.baseUrl}/${tagPath}?json=1&s=1&p=${page}&l=${Math.min(limit, 20)}`;
                const data = await proxyFetch(url);
                posts = data?.items || data?.posts || (Array.isArray(data) ? data : []);
                break;
            }
            
            default:
                posts = [];
        }
        
        return posts.map(post => normalizePost(post, siteKey));
    } catch (error) {
        console.error(`[HentaiLocal] Search failed for ${siteKey}:`, error);
        throw new Error(`Search failed on ${site.name}: ${error.message}`);
    }
}

/**
 * Get tag autocomplete suggestions
 * @param {string} siteKey - The booru site key
 * @param {string} query - Partial tag to autocomplete
 * @returns {Promise<Array>} Array of tag suggestions
 */
async function autocompleteTags(siteKey, query) {
    const site = BOORU_SITES[siteKey];
    if (!site || !site.hasAutocomplete || !query || query.length < 2) return [];
    
    await rateLimiter.wait(`${siteKey}_tags`);
    
    try {
        let url;
        let suggestions;
        
        switch (siteKey) {
            case 'danbooru': {
                const params = new URLSearchParams({ 'search[query]': query, 'search[limit]': '10' });
                url = `${site.baseUrl}${site.tagsEndpoint}?${params}`;
                const data = await proxyFetch(url);
                suggestions = (Array.isArray(data) ? data : []).map(t => ({
                    label: t.label || t.name || t,
                    value: t.value || t.name || t.label || t,
                    category: t.category || t.post_count ? `(${t.post_count} posts)` : '',
                }));
                break;
            }
            
            case 'gelbooru': {
                const params = new URLSearchParams({ 'name': query, 'limit': '10', 'orderby': 'count' });
                url = `${site.baseUrl}${site.tagsEndpoint}&${params}`;
                const data = await proxyFetch(url);
                const tags = data?.tag || data || [];
                suggestions = (Array.isArray(tags) ? tags : []).map(t => ({
                    label: t.name || t,
                    value: t.name || t,
                    category: t.count ? `(${t.count} posts)` : '',
                }));
                break;
            }
            
            case 'rule34': {
                url = `${site.baseUrl}${site.tagsEndpoint}?q=${encodeURIComponent(query)}`;
                const data = await proxyFetch(url);
                suggestions = (Array.isArray(data) ? data : []).map(t => ({
                    label: t.label || t.value || t.name || t,
                    value: t.value || t.label || t.name || t,
                    category: t.count ? `(${t.count})` : '',
                }));
                break;
            }
            
            case 'yandere':
            case 'konachan':
            case 'lolibooru': {
                url = `${site.baseUrl}${site.tagsEndpoint}?query=${encodeURIComponent(query)}`;
                const data = await proxyFetch(url);
                suggestions = (Array.isArray(data) ? data : []).map(t => ({
                    label: t.name || t.label || t.value || t,
                    value: t.name || t.value || t.label || t,
                    category: t.count ? `(${t.count} posts)` : '',
                }));
                break;
            }
            
            case 'sankaku': {
                url = `${site.baseUrl}${site.tagsEndpoint}?query=${encodeURIComponent(query)}`;
                const data = await proxyFetch(url);
                suggestions = (Array.isArray(data) ? data : []).map(t => ({
                    label: t.name || t.label || t,
                    value: t.name || t.value || t.label || t,
                    category: t.post_count ? `(${t.post_count} posts)` : '',
                }));
                break;
            }
            
            default:
                suggestions = [];
        }
        
        return suggestions.slice(0, 10);
    } catch (error) {
        console.warn(`[HentaiLocal] Autocomplete failed for ${siteKey}:`, error.message);
        return [];
    }
}

/**
 * Download an image from a URL and return it as a base64 string
 * @param {string} imageUrl - URL of the image to download
 * @returns {Promise<{base64: string, ext: string}>} Base64 data and file extension
 */
async function downloadImage(imageUrl) {
    try {
        // Try fetching through ST's proxy first
        const context = SillyTavern.getContext();
        const headers = context.getRequestHeaders();
        
        const response = await fetch('/api/extensions/proxy', {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: imageUrl, method: 'GET', binary: true }),
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const base64 = await blobToBase64(blob);
            const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
            return { base64, ext: ext.toLowerCase() };
        }
    } catch (e) {
        console.warn('[HentaiLocal] Proxy download failed, trying direct:', e.message);
    }
    
    // Fallback: direct fetch with no-cors
    try {
        const response = await fetch(imageUrl, {
            mode: 'cors',
            headers: { 'Accept': 'image/*' },
        });
        if (response.ok) {
            const blob = await response.blob();
            const base64 = await blobToBase64(blob);
            const ext = blob.type?.split('/')[1] || imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
            return { base64, ext: ext.toLowerCase() };
        }
    } catch (e) {
        console.warn('[HentaiLocal] Direct download also failed:', e.message);
    }
    
    throw new Error('Failed to download image');
}

/**
 * Convert a Blob to base64 string
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Get the list of available booru sites
 * @returns {Object} The BOORU_SITES configuration
 */
function getBooruSites() {
    return BOORU_SITES;
}

export { getBooruSites, searchBooru, autocompleteTags, downloadImage, BOORU_SITES };
