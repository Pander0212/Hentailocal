// BooruScraper.js - Multi-site booru image scraper
/* global SillyTavern */

import axios from 'axios';

class BooruScraper {
  constructor() {
    // Booru site configurations
    this.sites = {
      rule34: {
        name: 'Rule34.xxx',
        apiUrl: 'https://api.rule34.xxx',
        searchEndpoint: '/index.php',
        imageUrl: (data) => data.file_url || data.image,
        supportsRating: true,
        aliases: ['rule34']
      },
      gelbooru: {
        name: 'Gelbooru',
        apiUrl: 'https://gelbooru.com',
        searchEndpoint: '/index.php',
        imageUrl: (data) => data.file_url || data.image,
        supportsRating: true,
        aliases: ['gelbooru', 'gb']
      },
      danbooru: {
        name: 'Danbooru',
        apiUrl: 'https://danbooru.donmai.us',
        searchEndpoint: '/posts.json',
        imageUrl: (data) => data.file_url || `https://danbooru.donmai.us${data.large_file_url || data.file_url}`,
        supportsRating: true,
        aliases: ['danbooru', 'db']
      },
      paheal: {
        name: 'Paheal',
        apiUrl: 'https://rule34.paheal.net',
        searchEndpoint: '/api/search',
        imageUrl: (data) => data.file_url || data.image,
        supportsRating: true,
        aliases: ['paheal', 'safebooru']
      },
      yandere: {
        name: 'Yande.re',
        apiUrl: 'https://yande.re',
        searchEndpoint: '/post.json',
        imageUrl: (data) => data.file_url || data.jpeg_url || data.preview_url,
        supportsRating: false,
        aliases: ['yande.re', 'yandere']
      },
      konachan: {
        name: 'Konachan',
        apiUrl: 'https://konachan.com',
        searchEndpoint: '/post.json',
        imageUrl: (data) => data.file_url || data.jpeg_url || data.preview_url,
        supportsRating: false,
        aliases: ['konachan', 'kc']
      },
      zerochan: {
        name: 'Zerochan',
        apiUrl: 'https://www.zerochan.net',
        searchEndpoint: '/api/search',
        imageUrl: (data) => data.url || data.thumbnail,
        supportsRating: false,
        aliases: ['zerochan', 'zc']
      },
      sankaku: {
        name: 'Sankaku',
        apiUrl: 'https://chan.sankakucomplex.com',
        searchEndpoint: '/post/index.json',
        imageUrl: (data) => data.file_url || data.preview_url,
        supportsRating: true,
        aliases: ['sankaku', 'sankakucomplex']
      }
    };

    this.rateLimit = {}; // Track rate limits per site
    this.defaultHeaders = {
      'User-Agent': 'HentaiLocal/1.0 (SillyTavern Extension)'
    };
  }

  /**
   * Get site configuration by key or alias
   */
  getSiteConfig(siteKey) {
    const key = siteKey.toLowerCase();
    return this.sites[key] || Object.values(this.sites).find(s => s.aliases.includes(key));
  }

  /**
   * Check rate limit for a site
   */
  checkRateLimit(siteKey) {
    const now = Date.now();
    const limit = this.rateLimit[siteKey];
    
    if (limit && now - limit.lastRequest < limit.delay) {
      return false;
    }
    
    this.rateLimit[siteKey] = {
      lastRequest: now,
      delay: 1000 // 1 second between requests
    };
    
    return true;
  }

  /**
   * Search for images across booru sites
   */
  async search(tags, options = {}) {
    const {
      site = 'rule34',
      limit = 20,
      page = 1,
      rating = null,
      score = null,
      sort = 'date'
    } = options;

    const config = this.getSiteConfig(site);
    if (!config) {
      throw new Error(`Unknown booru site: ${site}`);
    }

    if (!this.checkRateLimit(site)) {
      throw new Error(`Rate limited for ${site}. Please wait.`);
    }

    try {
      const params = this.buildSearchParams(config, tags, { limit, page, rating, score, sort });
      const response = await axios.get(`${config.apiUrl}${config.searchEndpoint}`, {
        params,
        headers: this.defaultHeaders,
        timeout: 30000
      });

      return this.parseResponse(config, response.data);
    } catch (error) {
      console.error(`[BooruScraper] Search error for ${site}:`, error.message);
      throw error;
    }
  }

  /**
   * Build site-specific search parameters
   */
  buildSearchParams(config, tags, options) {
    const { limit, page, rating, score, sort } = options;
    
    // Base params for most boorus
    const params = {
      tags: tags,
      limit: limit,
      pid: page - 1, // page 0-indexed for most sites
      json: 1
    };

    // Site-specific adjustments
    if (config.name === 'Danbooru') {
      return {
        tags: tags,
        limit: limit,
        page: page,
        ...(rating && { rating: rating === 's' ? 's' : rating === 'q' ? 'q' : 'e' })
      };
    }

    if (config.name === 'Yande.re' || config.name === 'Konachan') {
      return {
        tags: tags,
        limit: limit,
        page: page
      };
    }

    // Gelbooru/Rule34 style params
    if (config.supportsRating && rating) {
      params.rating = rating;
    }

    return params;
  }

  /**
   * Parse API response based on site
   */
  parseResponse(config, data) {
    // Handle different response formats
    let posts = [];

    if (Array.isArray(data)) {
      posts = data;
    } else if (data && data.posts) {
      posts = data.posts;
    } else if (data && data.post) {
      posts = Array.isArray(data.post) ? data.post : [data.post];
    } else if (data && typeof data === 'object') {
      // Try to extract array from object
      posts = Object.values(data).find(v => Array.isArray(v)) || [];
    }

    return posts.map(post => this.normalizePost(config, post)).filter(Boolean);
  }

  /**
   * Normalize post data to common format
   */
  normalizePost(config, post) {
    if (!post) return null;

    const id = post.id || post.post_id || post.pid;
    const imageUrl = config.imageUrl(post);
    const tags = this.parseTags(post);
    const rating = this.parseRating(post);
    const score = post.score || post.up_score || 0;
    const createdAt = post.created_at || post.date || post.timestamp;

    return {
      id,
      site: config.name,
      siteKey: Object.keys(this.sites).find(k => this.sites[k] === config),
      imageUrl: imageUrl,
      thumbnailUrl: this.getThumbnailUrl(config, post),
      tags,
      rating,
      score,
      width: post.width || post.w,
      height: post.height || post.h,
      fileSize: post.size || post.file_size,
      fileType: post.ext || post.file_ext || 'jpg',
      source: post.source || post.source_url || '',
      createdAt,
      artist: this.extractArtist(tags),
      character: this.extractCharacter(tags)
    };
  }

  /**
   * Parse tags from post data
   */
  parseTags(post) {
    if (Array.isArray(post.tags)) {
      return post.tags;
    }
    if (typeof post.tags === 'string') {
      return post.tags.split(' ');
    }
    if (typeof post.tag_string === 'string') {
      return post.tag_string.split(' ');
    }
    return [];
  }

  /**
   * Parse rating from post data
   */
  parseRating(post) {
    if (post.rating) {
      const r = post.rating.toLowerCase();
      if (r === 's' || r === 'safe') return 's';
      if (r === 'q' || r === 'questionable') return 'q';
      if (r === 'e' || r === 'explicit') return 'e';
    }
    return 'q'; // Default to questionable
  }

  /**
   * Get thumbnail URL for a post
   */
  getThumbnailUrl(config, post) {
    if (post.preview_url) return post.preview_url;
    if (post.thumbnail_url) return post.thumbnail_url;
    if (post.sample_url) return post.sample_url;
    if (post.medium_url) return post.medium_url;
    return null;
  }

  /**
   * Extract artist from tags
   */
  extractArtist(tags) {
    if (!Array.isArray(tags)) return 'unknown';
    const artistTag = tags.find(t => t.startsWith('artist:') || t.startsWith('creator:'));
    return artistTag ? artistTag.replace(/^(artist|creator):/, '') : 'unknown';
  }

  /**
   * Extract character from tags
   */
  extractCharacter(tags) {
    if (!Array.isArray(tags)) return null;
    const charTag = tags.find(t => t.startsWith('character:') || t.startsWith('char:'));
    return charTag ? charTag.replace(/^(character|char):/, '') : null;
  }

  /**
   * Get full image URL with size preference
   */
  getImageUrl(post, quality = 'original') {
    if (!post) return null;

    const config = this.getSiteConfig(post.siteKey);
    if (!config) return post.imageUrl;

    // For Danbooru, handle size-specific URLs
    if (post.site === 'Danbooru') {
      if (quality === 'large' && post.large_file_url) {
        return `https://danbooru.donmai.us${post.large_file_url}`;
      }
      if (quality === 'original' && post.file_url) {
        return `https://danbooru.donmai.us${post.file_url}`;
      }
    }

    return post.imageUrl;
  }

  /**
   * Get tag suggestions for autocomplete
   */
  async getTagSuggestions(partialTag, site = 'rule34') {
    const config = this.getSiteConfig(site);
    if (!config) return [];

    // Common tag suggestions based on partial input
    const commonTags = [
      '1girl', '1boy', '2girls', '2boys', 'solo', 'multiple_girls',
      'long_hair', 'short_hair', 'breasts', 'pussy', 'ass',
      'blush', 'smile', 'open_mouth', 'closed_eyes',
      'school_uniform', 'swimsuit', 'lingerie', 'nude',
      'sex', 'cum', 'masturbation', 'anal', 'oral'
    ];

    return commonTags.filter(t => t.toLowerCase().includes(partialTag.toLowerCase()));
  }

/**
    * Download image (in-memory, returns base64)
    */
  async downloadImage(url, quality = 'original') {
    if (!this.checkRateLimit('download')) {
      throw new Error('Rate limited. Please wait.');
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: this.defaultHeaders,
        timeout: 60000
      });

      let base64 = '';
      const bytes = new Uint8Array(response.data);
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        base64 += String.fromCharCode.apply(null, chunk);
      }
      base64 = btoa(base64);
      
      const ext = url.split('.').pop().split('?')[0] || 'jpg';

      return {
        data: base64,
        ext: ext,
        mimeType: response.headers['content-type'] || 'image/jpeg'
      };
    } catch (error) {
      console.error('[BooruScraper] Download error:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
export default new BooruScraper();