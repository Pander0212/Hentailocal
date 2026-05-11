/* global SillyTavern */

const EXTENSION_NAME = 'HentaiLocal';

/**
 * Get AI naming settings from extension settings
 */
function getAINamingSettings() {
    const context = SillyTavern.getContext();
    const settings = context.extensionSettings[EXTENSION_NAME]?.aiNaming || {};
    return {
        baseUrl: settings.baseUrl || '',
        apiKey: settings.apiKey || '',
        model: settings.model || 'gpt-4o-mini',
        namingStyle: settings.namingStyle || 'snake_case',
        autoDescribe: settings.autoDescribe !== false,
    };
}

/**
 * Save AI naming settings
 */
function saveAINamingSettings(newSettings) {
    const context = SillyTavern.getContext();
    if (!context.extensionSettings[EXTENSION_NAME]) {
        context.extensionSettings[EXTENSION_NAME] = {};
    }
    if (!context.extensionSettings[EXTENSION_NAME].aiNaming) {
        context.extensionSettings[EXTENSION_NAME].aiNaming = {};
    }
    Object.assign(context.extensionSettings[EXTENSION_NAME].aiNaming, newSettings);
    context.saveSettingsDebounced();
}

/**
 * Try to get the AI API configuration from ST's main settings if not configured locally
 */
function resolveApiConfig() {
    const localSettings = getAINamingSettings();
    
    if (localSettings.baseUrl && localSettings.apiKey) {
        return {
            baseUrl: localSettings.baseUrl,
            apiKey: localSettings.apiKey,
            model: localSettings.model,
        };
    }
    
    // Try to use ST's configured API
    try {
        const context = SillyTavern.getContext();
        const oaiSettings = context.oai_settings || {};
        
        // Check for OpenAI-compatible
        if (oaiSettings.api_key) {
            return {
                baseUrl: oaiSettings.api_server || 'https://api.openai.com/v1',
                apiKey: oaiSettings.api_key,
                model: oaiSettings.set_oai_model || 'gpt-4o-mini',
            };
        }
        
        // Check for custom/openrouter/etc
        if (context.oai_settings?.api_server) {
            return {
                baseUrl: context.oai_settings.api_server,
                apiKey: context.oai_settings.api_key || '',
                model: context.oai_settings.set_oai_model || 'gpt-4o-mini',
            };
        }
    } catch (e) {
        console.warn('[HentaiLocal] Could not read ST API settings:', e.message);
    }
    
    return null;
}

/**
 * Call the OpenAI-compatible API
 */
async function callLLM(messages, config) {
    const apiConfig = config || resolveApiConfig();
    if (!apiConfig || !apiConfig.baseUrl || !apiConfig.apiKey) {
        throw new Error('AI API not configured. Please set up the API in HentaiLocal settings or configure an OpenAI-compatible API in SillyTavern.');
    }
    
    let baseUrl = apiConfig.baseUrl.replace(/\/+$/, '');
    if (!baseUrl.endsWith('/chat/completions')) {
        if (!baseUrl.endsWith('/v1')) {
            baseUrl += '/v1';
        }
        baseUrl += '/chat/completions';
    }
    
    const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
            model: apiConfig.model,
            messages,
            temperature: 0.7,
            max_tokens: 200,
        }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Empty response from AI API');
    }
    
    return content.trim();
}

/**
 * Generate a name and description for an image using AI
 * @param {Object} imageData - Image data with tags, site info, etc.
 * @param {Object} options - Options like naming style
 * @returns {Promise<{name: string, description: string}>} Generated name and description
 */
async function generateImageName(imageData, options = {}) {
    const settings = getAINamingSettings();
    const namingStyle = options.namingStyle || settings.namingStyle || 'snake_case';
    
    const tagsStr = (imageData.tags || []).slice(0, 20).join(', ');
    const siteInfo = imageData.siteName || 'unknown';
    const ratingInfo = imageData.rating || 'unknown';
    
    const styleInstruction = namingStyle === 'kebab-case' 
        ? 'Use kebab-case (lowercase words separated by hyphens, e.g. red-silk-dress-night, angry-expression-closeup)'
        : 'Use snake_case (lowercase words separated by underscores, e.g. red_silk_dress_night, angry_expression_closeup)';
    
    const messages = [
        {
            role: 'system',
            content: `You are a creative image naming assistant for a roleplay image gallery. Generate short, memorable, descriptive names for images based on their tags and metadata.

Rules:
- ${styleInstruction}
- Keep names to 2-5 words maximum
- Be specific and evocative, not generic
- Focus on the most visually distinctive elements
- Avoid numbers, special characters, or vague words like "image" or "pic"
- Respond ONLY with valid JSON in this exact format: {"name": "your_name_here", "description": "A short 5-15 word description of what the image depicts"}`
        },
        {
            role: 'user',
            content: `Generate a name and description for this image:

Tags: ${tagsStr}
Source: ${siteInfo}
Rating: ${ratingInfo}

Respond with JSON only: {"name": "...", "description": "..."}`
        }
    ];
    
    try {
        const response = await callLLM(messages);
        
        // Parse the JSON response
        let parsed;
        try {
            // Try direct parse first
            parsed = JSON.parse(response);
        } catch {
            // Try extracting JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not parse AI response as JSON');
            }
        }
        
        // Sanitize the name
        let name = (parsed.name || '').trim();
        if (namingStyle === 'kebab-case') {
            name = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        } else {
            name = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        }
        
        const description = (parsed.description || '').trim();
        
        if (!name) {
            throw new Error('AI generated empty name');
        }
        
        return { name, description };
    } catch (error) {
        console.error('[HentaiLocal] AI naming failed:', error);
        throw error;
    }
}

/**
 * Generate names for multiple images in batch
 * @param {Array} images - Array of image data objects
 * @param {Function} onProgress - Progress callback (index, total, result)
 * @returns {Promise<Array>} Array of {name, description} objects
 */
async function batchGenerateNames(images, onProgress = null) {
    const results = [];
    
    for (let i = 0; i < images.length; i++) {
        try {
            const result = await generateImageName(images[i]);
            results.push(result);
            if (onProgress) onProgress(i, images.length, result);
        } catch (error) {
            console.warn(`[HentaiLocal] Batch naming failed for image ${i}:`, error.message);
            // Generate a fallback name from tags
            const fallbackName = generateFallbackName(images[i]);
            results.push({ name: fallbackName, description: '' });
            if (onProgress) onProgress(i, images.length, { name: fallbackName, description: '' });
        }
        
        // Small delay between API calls to avoid rate limiting
        if (i < images.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return results;
}

/**
 * Generate a fallback name from tags when AI naming is not available
 * @param {Object} imageData - Image data with tags
 * @returns {string} A generated name
 */
function generateFallbackName(imageData) {
    const tags = imageData.tags || [];
    const settings = getAINamingSettings();
    const separator = settings.namingStyle === 'kebab-case' ? '-' : '_';
    
    // Pick up to 3 relevant tags
    const skipTags = new Set(['highres', 'absurdres', 'lowres', 'incredibly_absurdres', 'commentary', 'commentary_request', 'translated', 'translation_request', 'ai_generated', 'scan', 'official_art', 'concept_art']);
    const relevantTags = tags.filter(t => !skipTags.has(t) && t.length > 2).slice(0, 3);
    
    if (relevantTags.length > 0) {
        return relevantTags.join(separator);
    }
    
    // Ultimate fallback: use timestamp
    return `img_${Date.now()}`;
}

export { 
    generateImageName, 
    batchGenerateNames, 
    generateFallbackName, 
    getAINamingSettings, 
    saveAINamingSettings,
    resolveApiConfig,
    callLLM
};
