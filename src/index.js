/* global SillyTavern */
import { createRoot } from 'react-dom/client';
import Gallery from './Gallery';
import GroupGallery from './GroupGallery';
import ScraperPanel from './ScraperPanel';
import { generateImageName, generateFallbackName, getAINamingSettings, saveAINamingSettings, resolveApiConfig } from './ai-naming';

const EXTENSION_NAME = 'HentaiLocal';
const BUTTON_ID = 'local_image_button';
const FLOATING_BUTTON_ID = 'local_image_floating_button';
const FLOATING_PANEL_ID = 'local_image_floating_panel';
const SETTINGS_TAB_ID = 'hentailocal-settings-tab';

let galleryRoot = null;
let galleryContainer = null;
let floatingPanelExpanded = false;
let scraperDrawerOpen = false;

// =================================
// Settings Management
// ==========================================

/**
 * Initialize extension settings
 */
function initSettings() {
    const context = SillyTavern.getContext();
    const defaultSettings = {
        enabled: true,
        assignments: {},
        characterSettings: {},
        customPrompts: [],
        aiNaming: {
            baseUrl: '',
            apiKey: '',
            model: 'gpt-4o-mini',
            namingStyle: 'snake_case',
            autoDescribe: true,
        },
        scraper: {
            defaultSite: 'rule34',
            defaultRating: '',
            downloadQuality: 'full',
        },
    };

    if (!context.extensionSettings[EXTENSION_NAME]) {
        context.extensionSettings[EXTENSION_NAME] = {};
    }

    Object.assign(context.extensionSettings[EXTENSION_NAME], {
        ...defaultSettings,
        ...context.extensionSettings[EXTENSION_NAME],
    });

    // Ensure nested objects exist
    const settings = context.extensionSettings[EXTENSION_NAME];
    if (!settings.aiNaming) settings.aiNaming = defaultSettings.aiNaming;
    if (!settings.scraper) settings.scraper = defaultSettings.scraper;

    // Migrate old format (string paths) to new format (objects with path/description)
    if (settings.assignments) {
        for (const charName of Object.keys(settings.assignments)) {
            for (const imageName of Object.keys(settings.assignments[charName])) {
                const value = settings.assignments[charName][imageName];
                if (typeof value === 'string') {
                    settings.assignments[charName][imageName] = {
                        path: value,
                        description: ''
                    };
                }
            }
        }
    }

    return settings;
}

function getSettings() {
    const context = SillyTavern.getContext();
    return context.extensionSettings[EXTENSION_NAME] || {};
}

function saveSettings() {
    const context = SillyTavern.getContext();
    context.saveSettingsDebounced();
}

// =================================
// Character / Persona / Group Helpers
// ==========================================

function getCurrentCharacterName() {
    const context = SillyTavern.getContext();
    if (context.characterId !== undefined && context.characters[context.characterId]) {
        return context.characters[context.characterId].name;
    }
    return null;
}

function getCurrentPersonaName() {
    const context = SillyTavern.getContext();
    return context.name1 || null;
}

function isGroupChat() {
    const context = SillyTavern.getContext();
    return context.groupId !== null && context.groupId !== undefined;
}

function getCurrentGroup() {
    const context = SillyTavern.getContext();
    if (!isGroupChat()) return null;
    const group = context.groups?.find(g => g.id === context.groupId);
    if (!group) return null;
    return {
        id: group.id,
        name: group.name || `Group ${group.id}`,
        members: group.members || []
    };
}

function getGroupMemberNames(memberIds) {
    const context = SillyTavern.getContext();
    const names = [];
    for (const memberId of memberIds) {
        const char = context.characters.find(c => c.avatar === memberId);
        if (char) names.push(char.name);
    }
    return names;
}

function resolveEntityName(entityName) {
    const context = SillyTavern.getContext();
    if (context.substituteParams) {
        const resolved = context.substituteParams(entityName);
        if (resolved !== entityName) return resolved;
    }
    const lowerName = entityName.toLowerCase();
    if (lowerName === '{{user}}' || lowerName === 'user') return getCurrentPersonaName() || entityName;
    if (lowerName === '{{char}}' || lowerName === 'char') return getCurrentCharacterName() || entityName;
    if (lowerName === '{{group}}' || lowerName === 'group') {
        const group = getCurrentGroup();
        return group ? group.name : entityName;
    }
    return entityName;
}

// ==========================================
// Assignment Management
// ==========================================

function getCharacterAssignments(charName) {
    const settings = getSettings();
    return settings.assignments?.[charName] || {};
}

function getCharacterSettings(charName) {
    const settings = getSettings();
    return settings.characterSettings?.[charName] || { injectPrompt: false, customPrefix: '' };
}

function saveCharacterSettings(charName, charSettings) {
    const context = SillyTavern.getContext();
    const settings = context.extensionSettings[EXTENSION_NAME];
    if (!settings.characterSettings) settings.characterSettings = {};
    settings.characterSettings[charName] = charSettings;
    saveSettings();
}

function assignImage(charName, imageName, imagePath, description = '') {
    const context = SillyTavern.getContext();
    const settings = context.extensionSettings[EXTENSION_NAME];
    if (!settings.assignments) settings.assignments = {};
    if (!settings.assignments[charName]) settings.assignments[charName] = {};
    settings.assignments[charName][imageName] = { path: imagePath, description: description };
    saveSettings();
    console.log(`[${EXTENSION_NAME}] Assigned "${imageName}" to "${imagePath}" for ${charName}`);
}

function updateImageDescription(charName, imageName, description) {
    const context = SillyTavern.getContext();
    const settings = context.extensionSettings[EXTENSION_NAME];
    if (settings.assignments?.[charName]?.[imageName]) {
        settings.assignments[charName][imageName].description = description;
        saveSettings();
    }
}

function unassignImage(charName, imageName) {
    const context = SillyTavern.getContext();
    const settings = context.extensionSettings[EXTENSION_NAME];
    if (settings.assignments?.[charName]?.[imageName]) {
        delete settings.assignments[charName][imageName];
        saveSettings();
        console.log(`[${EXTENSION_NAME}] Unassigned "${imageName}" for ${charName}`);
    }
}

function getImagePath(charName, imageName) {
    const assignments = getCharacterAssignments(charName);
    const assignment = assignments[imageName];
    if (!assignment) return '';
    return typeof assignment === 'string' ? assignment : assignment.path || '';
}

// ==========================================
// Custom Prompts
// ==========================================

function getDefaultPromptTemplate(charName) {
    return `Available images for ${charName} (use ::img ${charName} name:: to display):`;
}

function getCustomPrompts() {
    const settings = getSettings();
    return settings.customPrompts || [];
}

function addCustomPrompt(name, template) {
    const context = SillyTavern.getContext();
    const settings = context.extensionSettings[EXTENSION_NAME];
    if (!settings.customPrompts) settings.customPrompts = [];
    const id = 'prompt_' + Date.now();
    settings.customPrompts.push({ id, name, template });
    saveSettings();
    return id;
}

function updateCustomPrompt(id, name, template) {
    const context = SillyTavern.getContext();
    const settings = context.extensionSettings[EXTENSION_NAME];
    const prompt = settings.customPrompts?.find(p => p.id === id);
    if (prompt) { prompt.name = name; prompt.template = template; saveSettings(); }
}

function deleteCustomPrompt(id) {
    const context = SillyTavern.getContext();
    const settings = context.extensionSettings[EXTENSION_NAME];
    if (settings.customPrompts) {
        settings.customPrompts = settings.customPrompts.filter(p => p.id !== id);
        saveSettings();
    }
}

function getPromptTemplate(id, charName) {
    if (!id || id === 'default') return getDefaultPromptTemplate(charName);
    const customPrompts = getCustomPrompts();
    const prompt = customPrompts.find(p => p.id === id);
    return prompt ? prompt.template : getDefaultPromptTemplate(charName);
}

function generateImageListPrompt(charName) {
    const assignments = getCharacterAssignments(charName);
    const charSettings = getCharacterSettings(charName);
    const imageNames = Object.keys(assignments);
    if (imageNames.length === 0) return '';
    const lines = imageNames.map(name => {
        const assignment = assignments[name];
        const desc = typeof assignment === 'object' ? assignment.description : '';
        return desc ? `- ${name}: ${desc}` : `- ${name}`;
    });
    const template = getPromptTemplate(charSettings.selectedPromptId, charName);
    const prefix = template.replace(/\{\{char\}\}/gi, charName);
    return `[${prefix}\n${lines.join('\n')}]`;
}

// =================================
// Tag Processing
// =================================

function replaceImageTags(text) {
    if (!text) return text;
    const pattern = /::img\s+(.+?)::/gi;
    return text.replace(pattern, (match, content) => {
        const trimmed = content.trim();
        const lastSpace = trimmed.lastIndexOf(' ');
        if (lastSpace === -1) return match;
        const entityName = resolveEntityName(trimmed.substring(0, lastSpace).trim());
        const imageName = trimmed.substring(lastSpace + 1).trim();
        const imagePath = getImagePath(entityName, imageName);
        if (imagePath) return `![${imageName}](/${imagePath})`;
        const currentChar = getCurrentCharacterName();
        if (currentChar) {
            const currentPath = getImagePath(currentChar, imageName);
            if (currentPath) return `![${imageName}](/${currentPath})`;
        }
        return match;
    });
}

function stripImageTags(text) {
    if (!text) return text;
    return text.replace(/::img\s+.+?::/gi, '').replace(/\s{2,}/g, ' ').trim();
}

// =================================
// Message Processing
// ==========================================

const processedMessages = new WeakSet();

function processMessageElement(mesElement) {
    if (processedMessages.has(mesElement)) return;
    let mesText = mesElement.querySelector('.mes_text .stle--content') || mesElement.querySelector('.mes_text');
    if (!mesText) return;
    const text = mesText.textContent || '';
    const pattern = /::img\s+(.+?)::/gi;
    let match;
    const matches = [];
    while ((match = pattern.exec(text)) !== null) {
        const trimmed = match[1].trim();
        const lastSpace = trimmed.lastIndexOf(' ');
        if (lastSpace === -1) continue;
        matches.push({
            full: match[0],
            charName: trimmed.substring(0, lastSpace).trim(),
            imageName: trimmed.substring(lastSpace + 1).trim()
        });
    }
    if (matches.length === 0) return;
    processedMessages.add(mesElement);
    console.log(`[${EXTENSION_NAME}] Found ${matches.length} tag(s) in message`);

    matches.forEach(m => {
        const resolvedName = resolveEntityName(m.charName);
        console.log(`[${EXTENSION_NAME}] Processing tag: entity="${m.charName}" -> "${resolvedName}", name="${m.imageName}"`);
        let imagePath = getImagePath(resolvedName, m.imageName);
        if (!imagePath) {
            const currentChar = getCurrentCharacterName();
            if (currentChar && currentChar !== resolvedName) imagePath = getImagePath(currentChar, m.imageName);
        }
        if (!imagePath) {
            const currentPersona = getCurrentPersonaName();
            if (currentPersona && currentPersona !== resolvedName) imagePath = getImagePath(currentPersona, m.imageName);
        }
        if (imagePath) {
            const imgHtml = `<img src="/${imagePath}" alt="${m.imageName}" class="localimage-inserted" style="max-width: 100%; border-radius: 8px; margin: 5px 0; display: block;">`;
            const mesId = mesElement.getAttribute('mesid');
            const context = SillyTavern.getContext();
            if (context.chat && mesId !== null) {
                const msgIndex = parseInt(mesId);
                if (context.chat[msgIndex]) {
                    const originalMes = context.chat[msgIndex].mes;
                    const newMes = originalMes.replace(m.full, imgHtml);
                    if (newMes !== originalMes) {
                        context.chat[msgIndex].mes = newMes;
                        const mesTextEl = mesElement.querySelector('.mes_text');
                        if (mesTextEl) mesTextEl.innerHTML = newMes;
                    }
                }
            }
            const paragraphs = mesText.querySelectorAll('p');
            for (const p of paragraphs) {
                const pText = p.textContent || '';
                if (pText.includes(m.full)) { p.innerHTML = imgHtml; break; }
            }
        }
    });
}

function processAllMessages() {
    document.querySelectorAll('#chat .mes').forEach(processMessageElement);
}

function registerMessageHandler() {
    const chatElement = document.getElementById('chat');
    if (!chatElement) {
        setTimeout(registerMessageHandler, 1000);
        return;
    }
    setTimeout(processAllMessages, 500);
    console.log(`[${EXTENSION_NAME}] Message handler registered`);
}

// ==========================================
// Gallery Modals
// ==========================================

function openGallery() {
    const charName = getCurrentCharacterName();
    if (!charName) { console.warn(`[${EXTENSION_NAME}] No character selected`); return; }
    if (!galleryContainer) {
        galleryContainer = document.createElement('div');
        galleryContainer.id = 'local-image-gallery-root';
        document.body.appendChild(galleryContainer);
        galleryRoot = createRoot(galleryContainer);
    }
    const assignments = getCharacterAssignments(charName);
    const charSettings = getCharacterSettings(charName);
    const customPrompts = getCustomPrompts();
    galleryRoot.render(
        <Gallery
            characterName={charName}
            onClose={closeGallery}
            assignments={assignments}
            characterSettings={charSettings}
            customPrompts={customPrompts}
            onAssign={(name, path, description) => { assignImage(charName, name, path, description); openGallery(); }}
            onUnassign={(name) => { unassignImage(charName, name); openGallery(); }}
            onUpdateDescription={(name, description) => { updateImageDescription(charName, name, description); openGallery(); }}
            onSaveSettings={(settings) => { saveCharacterSettings(charName, settings); openGallery(); }}
            onAddPrompt={(name, template) => { const id = addCustomPrompt(name, template); openGallery(); return id; }}
            onEditPrompt={(id, name, template) => { updateCustomPrompt(id, name, template); openGallery(); }}
            onDeletePrompt={(id) => { deleteCustomPrompt(id); openGallery(); }}
            onAINameImage={(imageSrc, entityName) => handleAINameImage(imageSrc, entityName)}
        />
    );
}

function openPersonaGallery() {
    const personaName = getCurrentPersonaName();
    if (!personaName) { console.warn(`[${EXTENSION_NAME}] No persona selected`); return; }
    if (!galleryContainer) {
        galleryContainer = document.createElement('div');
        galleryContainer.id = 'local-image-gallery-root';
        document.body.appendChild(galleryContainer);
        galleryRoot = createRoot(galleryContainer);
    }
    const assignments = getCharacterAssignments(personaName);
    const charSettings = getCharacterSettings(personaName);
    const customPrompts = getCustomPrompts();
    galleryRoot.render(
        <Gallery
            characterName={personaName}
            onClose={closeGallery}
            assignments={assignments}
            characterSettings={charSettings}
            customPrompts={customPrompts}
            onAssign={(name, path, description) => { assignImage(personaName, name, path, description); openPersonaGallery(); }}
            onUnassign={(name) => { unassignImage(personaName, name); openPersonaGallery(); }}
            onUpdateDescription={(name, description) => { updateImageDescription(personaName, name, description); openPersonaGallery(); }}
            onSaveSettings={(settings) => { saveCharacterSettings(personaName, settings); openPersonaGallery(); }}
            onAddPrompt={(name, template) => { const id = addCustomPrompt(name, template); openPersonaGallery(); return id; }}
            onEditPrompt={(id, name, template) => { updateCustomPrompt(id, name, template); openPersonaGallery(); }}
            onDeletePrompt={(id) => { deleteCustomPrompt(id); openPersonaGallery(); }}
            isPersona={true}
            onAINameImage={(imageSrc, entityName) => handleAINameImage(imageSrc, entityName)}
        />
    );
}

function openGroupGallery() {
    const group = getCurrentGroup();
    if (!group) { console.warn(`[${EXTENSION_NAME}] No group selected`); return; }
    if (!galleryContainer) {
        galleryContainer = document.createElement('div');
        galleryContainer.id = 'local-image-gallery-root';
        document.body.appendChild(galleryContainer);
        galleryRoot = createRoot(galleryContainer);
    }
    const memberNames = getGroupMemberNames(group.members);
    const memberAssignments = {};
    for (const memberName of memberNames) {
        memberAssignments[memberName] = getCharacterAssignments(memberName);
    }
    const groupAssignments = getCharacterAssignments(group.name);
    const groupSettings = getCharacterSettings(group.name);
    const customPrompts = getCustomPrompts();
    galleryRoot.render(
        <GroupGallery
            groupName={group.name}
            groupId={group.id}
            memberNames={memberNames}
            memberAssignments={memberAssignments}
            groupAssignments={groupAssignments}
            groupSettings={groupSettings}
            customPrompts={customPrompts}
            onClose={closeGallery}
            onAssignGroup={(name, path, description) => { assignImage(group.name, name, path, description); openGroupGallery(); }}
            onUnassignGroup={(name) => { unassignImage(group.name, name); openGroupGallery(); }}
            onUpdateGroupDescription={(name, description) => { updateImageDescription(group.name, name, description); openGroupGallery(); }}
            onSaveGroupSettings={(settings) => { saveCharacterSettings(group.name, settings); openGroupGallery(); }}
            onAddPrompt={(name, template) => { const id = addCustomPrompt(name, template); openGroupGallery(); return id; }}
            onEditPrompt={(id, name, template) => { updateCustomPrompt(id, name, template); openGroupGallery(); }}
            onDeletePrompt={(id) => { deleteCustomPrompt(id); openGroupGallery(); }}
        />
    );
}

function closeGallery() {
    if (galleryRoot) galleryRoot.render(null);
}

// ==========================================
// AI Naming Handler
// ==========================================

async function handleAINameImage(imageSrc, entityName) {
    try {
        // Get the image filename from the path
        const filename = imageSrc.split('/').pop().replace(/\.[^/.]+$/, '');
        
        // For now, generate a name based on existing assignment info
        // In a full implementation, this could analyze the image
        const assignments = getCharacterAssignments(entityName);
        const existingAssignment = Object.entries(assignments).find(([_, val]) => {
            const path = typeof val === 'string' ? val : val?.path;
            return path === imageSrc;
        });
        
        if (existingAssignment) {
            // Already assigned - generate a new name
            const result = await generateImageName({
                tags: [existingAssignment[0]],
                siteName: 'local',
                rating: 'unknown',
            });
            
            // Reassign with the new name
            const oldName = existingAssignment[0];
            const oldData = existingAssignment[1];
            const desc = typeof oldData === 'object' ? oldData.description : '';
            
            unassignImage(entityName, oldName);
            assignImage(entityName, result.name, imageSrc, result.description || desc);
        } else {
            // Not assigned - generate a name
            const result = await generateImageName({
                tags: [filename.replace(/_/g, ' ')],
                siteName: 'local',
                rating: 'unknown',
            });
            assignImage(entityName, result.name, imageSrc, result.description);
        }
        
        toastr.success(`AI named image: ${result?.name || 'renamed'}`, 'HentaiLocal');
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] AI naming failed:`, error);
        toastr.error(`AI naming failed: ${error.message}`, 'HentaiLocal');
    }
}

// ==========================================
// Scraper Image Saved Handler
// ==========================================

function handleScraperImageSaved(folder, filename, imagePath, description) {
    assignImage(folder, filename, imagePath, description);
    console.log(`[${EXTENSION_NAME}] Scraper saved image "${filename}" for ${folder}`);
}

// ==========================================
// Floating Quick-Send Button & Panel
// =================================

const PERSONA_BUTTON_ID = 'local_image_persona_button';

function sendAsNarrator(message) {
    const textarea = document.getElementById('send_textarea');
    const sendButton = document.getElementById('send_but');
    if (!textarea || !sendButton) { console.error(`[${EXTENSION_NAME}] Could not find send elements`); return; }
    textarea.value = `/sys ${message}`;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();
    console.log(`[${EXTENSION_NAME}] Sent narrator message: ${message}`);
}

function getEntitiesWithImages() {
    const entities = [];
    const personaName = getCurrentPersonaName();
    if (personaName) {
        const personaAssignments = getCharacterAssignments(personaName);
        const imageNames = Object.keys(personaAssignments);
        if (imageNames.length > 0) entities.push({ name: personaName, type: 'persona', images: imageNames });
    }
    if (isGroupChat()) {
        const group = getCurrentGroup();
        if (group) {
            const memberNames = getGroupMemberNames(group.members);
            for (const memberName of memberNames) {
                const assignments = getCharacterAssignments(memberName);
                const imageNames = Object.keys(assignments);
                if (imageNames.length > 0) entities.push({ name: memberName, type: 'character', images: imageNames });
            }
        }
    } else {
        const charName = getCurrentCharacterName();
        if (charName) {
            const assignments = getCharacterAssignments(charName);
            const imageNames = Object.keys(assignments);
            if (imageNames.length > 0) entities.push({ name: charName, type: 'character', images: imageNames });
        }
    }
    return entities;
}

function createFloatingButton() {
    const existing = document.getElementById(FLOATING_BUTTON_ID);
    if (existing) existing.remove();

    const button = document.createElement('div');
    button.id = FLOATING_BUTTON_ID;
    button.className = 'local-image-floating-button';
    button.innerHTML = '<i class="fa-solid fa-images"></i>';
    button.title = 'Quick Image Send';
    button.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleFloatingPanel(); });
    document.body.appendChild(button);

    const updatePosition = () => {
        const viewportHeight = window.innerHeight;
        button.style.top = (viewportHeight - 140) + 'px';
        button.style.bottom = 'auto';
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    console.log(`[${EXTENSION_NAME}] Floating button created`);
}

function toggleFloatingPanel() {
    floatingPanelExpanded = !floatingPanelExpanded;
    if (floatingPanelExpanded) createFloatingPanel();
    else closeFloatingPanel();
}

function createFloatingPanel() {
    closeFloatingPanel();
    const entities = getEntitiesWithImages();
    if (entities.length === 0) {
        floatingPanelExpanded = false;
        return;
    }

    const panel = document.createElement('div');
    panel.id = FLOATING_PANEL_ID;
    panel.className = 'local-image-floating-panel';

    const header = document.createElement('div');
    header.className = 'floating-panel-header';
    header.innerHTML = `
        <span>Quick Image Send</span>
        <button class="floating-panel-close" title="Close"><i class="fa-solid fa-times"></i></button>
    `;
    panel.appendChild(header);
    header.querySelector('.floating-panel-close').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); floatingPanelExpanded = false; closeFloatingPanel();
    });

    const content = document.createElement('div');
    content.className = 'floating-panel-content';

    for (const entity of entities) {
        const row = document.createElement('div');
        row.className = 'floating-panel-row';
        const label = document.createElement('span');
        label.className = 'floating-panel-label';
        label.textContent = entity.name;
        if (entity.type === 'persona') label.innerHTML += ' <small>(you)</small>';
        row.appendChild(label);
        const controls = document.createElement('div');
        controls.className = 'floating-panel-controls';
        const select = document.createElement('select');
        select.className = 'floating-panel-select';
        select.dataset.entityName = entity.name;
        for (const imageName of entity.images) {
            const option = document.createElement('option');
            option.value = imageName; option.textContent = imageName;
            select.appendChild(option);
        }
        controls.appendChild(select);
        const sendBtn = document.createElement('button');
        sendBtn.className = 'floating-panel-send';
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        sendBtn.title = 'Send image';
        sendBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const selectedImage = select.value;
            if (selectedImage) sendAsNarrator(`::img ${entity.name} ${selectedImage}::`);
        });
        controls.appendChild(sendBtn);
        row.appendChild(controls);
        content.appendChild(row);
    }

    panel.appendChild(content);
    document.body.appendChild(panel);
    const viewportHeight = window.innerHeight;
    const panelHeight = Math.min(350, panel.offsetHeight);
    panel.style.top = (viewportHeight - 140 - panelHeight - 10) + 'px';
    panel.style.bottom = 'auto';
}

function closeFloatingPanel() {
    const panel = document.getElementById(FLOATING_PANEL_ID);
    if (panel) panel.remove();
}

function updateFloatingPanel() {
    if (floatingPanelExpanded) createFloatingPanel();
}

// ==========================================
// Persona Gallery Button
// ==========================================

function addPersonaGalleryButton() {
    const existingButton = document.getElementById(PERSONA_BUTTON_ID);
    if (existingButton) existingButton.remove();
    const personaButtonsBlock = document.querySelector('.persona_controls_buttons_block');
    if (!personaButtonsBlock) { setTimeout(addPersonaGalleryButton, 1000); return; }
    const button = document.createElement('div');
    button.id = PERSONA_BUTTON_ID;
    button.className = 'menu_button fa-solid fa-images';
    button.title = 'Persona Images';
    button.setAttribute('data-i18n', '[title]Persona Images');
    button.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openPersonaGallery(); });
    personaButtonsBlock.appendChild(button);
}

function removePersonaGalleryButton() {
    const button = document.getElementById(PERSONA_BUTTON_ID);
    if (button) button.remove();
}

// ==========================================
// Scraper Drawer
// ==========================================

function createScraperDrawerButton() {
    const existing = document.getElementById('hentailocal-scraper-btn');
    if (existing) existing.remove();

    const button = document.createElement('div');
    button.id = 'hentailocal-scraper-btn';
    button.className = 'menu_button fa-solid fa-fire interactable';
    button.title = 'Booru Scraper';
    button.innerHTML = '<i class="fa-solid fa-fire"></i>';
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleScraperDrawer();
    });

    // Insert next to the gallery button
    const galleryButton = document.getElementById(BUTTON_ID);
    if (galleryButton && galleryButton.nextSibling) {
        galleryButton.parentElement.insertBefore(button, galleryButton.nextSibling);
    } else if (galleryButton) {
        galleryButton.parentElement.appendChild(button);
    }
}

function toggleScraperDrawer() {
    scraperDrawerOpen = !scraperDrawerOpen;
    if (scraperDrawerOpen) {
        openScraperDrawer();
    } else {
        closeScraperDrawer();
    }
}

function openScraperDrawer() {
    closeScraperDrawer();
    scraperDrawerOpen = true;

    const charName = getCurrentCharacterName();
    const personaName = getCurrentPersonaName();

    const drawer = document.createElement('div');
    drawer.id = 'hentailocal-scraper-drawer';
    drawer.className = 'hentailocal-drawer';

    const header = document.createElement('div');
    header.className = 'hentailocal-drawer-header';
    header.innerHTML = `
        <h3><i class="fa-solid fa-fire"></i> Booru Scraper</h3>
        <div class="hentailocal-drawer-actions">
            <button class="hentailocal-drawer-btn" id="hentailocal-open-gallery" title="Open Gallery">
                <i class="fa-solid fa-images"></i>
            </button>
            <button class="hentailocal-drawer-btn" id="hentailocal-close-drawer" title="Close">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
    `;
    drawer.appendChild(header);

    // Wire header buttons
    header.querySelector('#hentailocal-open-gallery').addEventListener('click', () => { openGallery(); });
    header.querySelector('#hentailocal-close-drawer').addEventListener('click', () => { scraperDrawerOpen = false; closeScraperDrawer(); });

    // Scraper content container
    const content = document.createElement('div');
    content.id = 'hentailocal-scraper-content';
    content.className = 'hentailocal-drawer-content';
    drawer.appendChild(content);

    document.body.appendChild(drawer);

    // Render ScraperPanel into the drawer using React
    const root = createRoot(content);
    root.render(
        <ScraperPanel
            characterName={charName || personaName || ''}
            onImageSaved={handleScraperImageSaved}
        />
    );

    // Store root for cleanup
    drawer._reactRoot = root;
}

function closeScraperDrawer() {
    const drawer = document.getElementById('hentailocal-scraper-drawer');
    if (drawer) {
        if (drawer._reactRoot) drawer._reactRoot.unmount();
        drawer.remove();
    }
}

// ==========================================
// Chat Changed Handler
// =================================

function onChatChanged() {
    const inGroup = isGroupChat();
    console.log(`[${EXTENSION_NAME}] onChatChanged called, isGroupChat: ${inGroup}`);

    const existingButton = document.getElementById(BUTTON_ID);
    if (existingButton) existingButton.remove();

    // Remove old scraper button
    const existingScraperBtn = document.getElementById('hentailocal-scraper-btn');
    if (existingScraperBtn) existingScraperBtn.remove();

    if (inGroup) {
        // Group chat: show group gallery button
        const button = document.createElement('div');
        button.id = BUTTON_ID;
        button.className = 'menu_button fa-solid fa-images interactable';
        button.title = 'Group Local Images';
        button.setAttribute('data-i18n', '[title]Group Local Images');
        button.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openGroupGallery(); });

        const exportButton = document.getElementById('export_button');
        if (!exportButton || !exportButton.parentElement) { setTimeout(onChatChanged, 500); return; }
        const buttonContainer = exportButton.parentElement;
        if (exportButton.nextSibling) buttonContainer.insertBefore(button, exportButton.nextSibling);
        else buttonContainer.appendChild(button);
        console.log(`[${EXTENSION_NAME}] Group gallery button added`);
    } else {
        const exportButton = document.getElementById('export_button');
        if (!exportButton || !exportButton.parentElement) { setTimeout(onChatChanged, 500); return; }
        const charName = getCurrentCharacterName();
        if (!charName) return;

        const button = document.createElement('div');
        button.id = BUTTON_ID;
        button.className = 'menu_button fa-solid fa-images interactable';
        button.title = 'Local Images';
        button.setAttribute('data-i18n', '[title]Local Images');
        button.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openGallery(); });

        const buttonContainer = exportButton.parentElement;
        if (exportButton.nextSibling) buttonContainer.insertBefore(button, exportButton.nextSibling);
        else buttonContainer.appendChild(button);
        console.log(`[${EXTENSION_NAME}] Gallery button added (character mode)`);

        // Add scraper button
        createScraperDrawerButton();
    }
}

// ==========================================
// Extension Settings UI
// ==========================================

function createSettingsUI() {
    const context = SillyTavern.getContext();

    // Find or create the settings tab
    const settingsContainer = document.getElementById('extensions_settings');
    if (!settingsContainer) {
        setTimeout(createSettingsUI, 1000);
        return;
    }

    // Create the settings block
    const settingsBlock = document.createElement('div');
    settingsBlock.id = SETTINGS_TAB_ID;
    settingsBlock.className = 'hentailocal-settings';

    const settings = getSettings();
    const aiSettings = settings.aiNaming || {};

    settingsBlock.innerHTML = `
        <div class="hentailocal-settings-header">
            <h4><i class="fa-solid fa-fire"></i> HentaiLocal Settings</h4>
        </div>
        <div class="hentailocal-settings-section">
            <h5>AI Naming API</h5>
            <div class="hentailocal-settings-row">
                <label>API Base URL</label>
                <input type="text" id="hentailocal-api-url" class="text_pole" value="${aiSettings.baseUrl || ''}" placeholder="https://api.openai.com/v1" />
            </div>
            <div class="hentailocal-settings-row">
                <label>API Key</label>
                <input type="password" id="hentailocal-api-key" class="text_pole" value="${aiSettings.apiKey || ''}" placeholder="sk-..." />
            </div>
            <div class="hentailocal-settings-row">
                <label>Model</label>
                <input type="text" id="hentailocal-api-model" class="text_pole" value="${aiSettings.model || 'gpt-4o-mini'}" placeholder="gpt-4o-mini" />
            </div>
            <div class="hentailocal-settings-row">
                <label>Naming Style</label>
                <select id="hentailocal-naming-style" class="text_pole">
                    <option value="snake_case" ${aiSettings.namingStyle === 'snake_case' ? 'selected' : ''}>snake_case</option>
                    <option value="kebab-case" ${aiSettings.namingStyle === 'kebab-case' ? 'selected' : ''}>kebab-case</option>
                </select>
            </div>
            <div class="hentailocal-settings-row">
                <label class="hentailocal-checkbox-label">
                    <input type="checkbox" id="hentailocal-auto-describe" ${aiSettings.autoDescribe !== false ? 'checked' : ''} />
                    Auto-generate descriptions when saving from scraper
                </label>
            </div>
            <div class="hentailocal-settings-hint">
                Leave API fields empty to use SillyTavern's configured OpenAI-compatible API.
            </div>
        </div>
        <div class="hentailocal-settings-section">
            <h5>Scraper Defaults</h5>
            <div class="hentailocal-settings-row">
                <label>Default Site</label>
                <select id="hentailocal-default-site" class="text_pole">
                    <option value="rule34" ${(settings.scraper?.defaultSite || 'rule34') === 'rule34' ? 'selected' : ''}>Rule34</option>
                    <option value="gelbooru" ${settings.scraper?.defaultSite === 'gelbooru' ? 'selected' : ''}>Gelbooru</option>
                    <option value="danbooru" ${settings.scraper?.defaultSite === 'danbooru' ? 'selected' : ''}>Danbooru</option>
                    <option value="safebooru" ${settings.scraper?.defaultSite === 'safebooru' ? 'selected' : ''}>Safebooru</option>
                    <option value="yandere" ${settings.scraper?.defaultSite === 'yandere' ? 'selected' : ''}>Yande.re</option>
                    <option value="konachan" ${settings.scraper?.defaultSite === 'konachan' ? 'selected' : ''}>Konachan</option>
                    <option value="paheal" ${settings.scraper?.defaultSite === 'paheal' ? 'selected' : ''}>Paheal</option>
                    <option value="sankaku" ${settings.scraper?.defaultSite === 'sankaku' ? 'selected' : ''}>Sankaku</option>
                    <option value="zerochan" ${settings.scraper?.defaultSite === 'zerochan' ? 'selected' : ''}>Zerochan</option>
                    <option value="lolibooru" ${settings.scraper?.defaultSite === 'lolibooru' ? 'selected' : ''}>Lolibooru</option>
                </select>
            </div>
        </div>
    `;

    settingsContainer.appendChild(settingsBlock);

    // Wire up settings change handlers
    const apiurlInput = document.getElementById('hentailocal-api-url');
    const apikeyInput = document.getElementById('hentailocal-api-key');
    const modelInput = document.getElementById('hentailocal-api-model');
    const styleSelect = document.getElementById('hentailocal-naming-style');
    const autoDescCheck = document.getElementById('hentailocal-auto-describe');
    const defaultSiteSelect = document.getElementById('hentailocal-default-site');

    const saveAI = () => {
        saveAINamingSettings({
            baseUrl: apiurlInput.value,
            apiKey: apikeyInput.value,
            model: modelInput.value,
            namingStyle: styleSelect.value,
            autoDescribe: autoDescCheck.checked,
        });
    };

    apiurlInput.addEventListener('change', saveAI);
    apikeyInput.addEventListener('change', saveAI);
    modelInput.addEventListener('change', saveAI);
    styleSelect.addEventListener('change', saveAI);
    autoDescCheck.addEventListener('change', saveAI);
    defaultSiteSelect.addEventListener('change', () => {
        const context = SillyTavern.getContext();
        const settings = context.extensionSettings[EXTENSION_NAME];
        if (!settings.scraper) settings.scraper = {};
        settings.scraper.defaultSite = defaultSiteSelect.value;
        saveSettings();
    });

    console.log(`[${EXTENSION_NAME}] Settings UI created`);
}

// =================================
// Main Init
// ==========================================

function init() {
    initSettings();
    registerMessageHandler();
    createSettingsUI();

    const context = SillyTavern.getContext();

    // Subscribe to events
    if (context.eventSource && context.eventTypes) {
        context.eventSource.on(context.eventTypes.CHAT_CHANGED, () => {
            onChatChanged();
            updateFloatingPanel();
            setTimeout(processAllMessages, 500);
        });

        if (context.eventTypes.GROUP_CHAT_CHANGED) {
            context.eventSource.on(context.eventTypes.GROUP_CHAT_CHANGED, () => {
                onChatChanged();
                updateFloatingPanel();
                setTimeout(processAllMessages, 500);
            });
        }

        if (context.eventTypes.CHAT_LOADED) {
            context.eventSource.on(context.eventTypes.CHAT_LOADED, () => {
                onChatChanged();
                updateFloatingPanel();
                setTimeout(processAllMessages, 500);
            });
        }

        if (context.eventTypes.MESSAGE_RENDERED) {
            context.eventSource.on(context.eventTypes.MESSAGE_RENDERED, (messageId) => {
                setTimeout(() => {
                    const mesElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
                    if (mesElement) processMessageElement(mesElement);
                }, 100);
            });
        }

        if (context.eventTypes.USER_MESSAGE_RENDERED) {
            context.eventSource.on(context.eventTypes.USER_MESSAGE_RENDERED, (messageId) => {
                setTimeout(() => {
                    const mesElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
                    if (mesElement) processMessageElement(mesElement);
                }, 1000);
                setTimeout(() => {
                    const mesElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
                    if (mesElement && !mesElement.querySelector('.localimage-inserted')) {
                        processedMessages.delete(mesElement);
                        processMessageElement(mesElement);
                    }
                }, 2000);
            });
        }

        if (context.eventTypes.CHARACTER_MESSAGE_RENDERED) {
            context.eventSource.on(context.eventTypes.CHARACTER_MESSAGE_RENDERED, (messageId) => {
                setTimeout(() => {
                    const mesElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
                    if (mesElement) processMessageElement(mesElement);
                }, 500);
            });
        }

        // Inject image list into prompt
        if (context.eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS) {
            context.eventSource.on(context.eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS, () => {
                const prompts = [];
                if (isGroupChat()) {
                    const group = getCurrentGroup();
                    if (group) {
                        const groupSettings = getCharacterSettings(group.name);
                        if (groupSettings.injectPrompt) {
                            const groupPrompt = generateImageListPrompt(group.name);
                            if (groupPrompt) prompts.push(groupPrompt);
                        }
                        const memberNames = getGroupMemberNames(group.members);
                        for (const memberName of memberNames) {
                            const memberSettings = getCharacterSettings(memberName);
                            if (memberSettings.injectPrompt) {
                                const memberPrompt = generateImageListPrompt(memberName);
                                if (memberPrompt) prompts.push(memberPrompt);
                            }
                        }
                    }
                } else {
                    const charName = getCurrentCharacterName();
                    if (charName) {
                        const charSettings = getCharacterSettings(charName);
                        if (charSettings.injectPrompt) {
                            const prompt = generateImageListPrompt(charName);
                            if (prompt) prompts.push(prompt);
                        }
                    }
                }
                if (prompts.length === 0) return;
                const combinedPrompt = prompts.join('\n\n');
                context.setExtensionPrompt(EXTENSION_NAME, combinedPrompt, 1, 0);
            });
        }

        // Strip ::img:: tags from prompt
        if (context.eventTypes.CHAT_COMPLETION_PROMPT_READY) {
            context.eventSource.on(context.eventTypes.CHAT_COMPLETION_PROMPT_READY, (data) => {
                if (!data || !data.messages) return;
                for (const message of data.messages) {
                    if (message.content && typeof message.content === 'string') {
                        message.content = stripImageTags(message.content);
                    }
                    if (Array.isArray(message.content)) {
                        for (const part of message.content) {
                            if (part.type === 'text' && part.text) part.text = stripImageTags(part.text);
                        }
                    }
                }
                console.log(`[${EXTENSION_NAME}] Stripped ::img:: tags from prompt`);
            });
        }
    }

    // Initial setup
    setTimeout(() => {
        onChatChanged();
        addPersonaGalleryButton();
        createFloatingButton();
    }, 100);

    // Fallback polling for button presence
    let lastGroupId = null;
    let lastCharacterId = null;
    const checkAndUpdateButton = () => {
        try {
            const ctx = SillyTavern.getContext();
            if (ctx.groupId !== lastGroupId || ctx.characterId !== lastCharacterId) {
                lastGroupId = ctx.groupId;
                lastCharacterId = ctx.characterId;
                onChatChanged();
            } else {
                const existingButton = document.getElementById(BUTTON_ID);
                if (!existingButton) {
                    const chatElement = document.getElementById('chat');
                    if (chatElement && chatElement.children.length > 0) onChatChanged();
                }
            }
        } catch (e) { console.error(`[${EXTENSION_NAME}] Error in checkAndUpdateButton:`, e); }
    };

    setTimeout(checkAndUpdateButton, 500);
    setInterval(checkAndUpdateButton, 2000);

    console.log(`[${EXTENSION_NAME}] Extension initialized`);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
