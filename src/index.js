// HentaiLocal Extension - Main entry point
// Combines LocalImage functionality with Booru scraping
/* global SillyTavern */

import { createRoot } from 'react-dom/client';
import Gallery from './Gallery';
import GroupGallery from './GroupGallery';
import BooruScraper from './BooruScraper';
import AINaming from './AINaming';
import SettingsPanel from './SettingsPanel';

const EXTENSION_NAME = 'HentaiLocal';
const BUTTON_ID = 'hentai_local_button';
const FLOATING_BUTTON_ID = 'hentai_local_floating_button';
const FLOATING_PANEL_ID = 'hentai_local_floating_panel';

let galleryRoot = null;
let galleryContainer = null;
let floatingPanelExpanded = false;

/**
 * Initialize extension settings
 */
function initSettings() {
  const context = SillyTavern.getContext();
  const defaultSettings = {
    enabled: true,
    scraper: {
      maxResults: 20,
      defaultSite: 'rule34',
      safeMode: false,
      downloadQuality: 'original'
    },
    aiNaming: {
      enabled: false,
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o-mini'
    },
    booruSites: {
      enabled: ['rule34', 'gelbooru', 'danbooru'],
      disabled: ['yandere', 'konachan', 'zerochan', 'sankaku']
    },
    assignments: {},
    characterSettings: {},
    customPrompts: []
  };

  if (!context.extensionSettings[EXTENSION_NAME]) {
    context.extensionSettings[EXTENSION_NAME] = {};
  }

  Object.assign(context.extensionSettings[EXTENSION_NAME], {
    ...defaultSettings,
    ...context.extensionSettings[EXTENSION_NAME],
  });

  return context.extensionSettings[EXTENSION_NAME];
}

/**
 * Get extension settings
 */
function getSettings() {
  const context = SillyTavern.getContext();
  return context.extensionSettings[EXTENSION_NAME] || {};
}

/**
 * Save extension settings
 */
function saveSettings() {
  const context = SillyTavern.getContext();
  context.saveSettingsDebounced();
}

/**
 * Add a custom prompt template
 */
function addCustomPrompt(name, template) {
  const context = SillyTavern.getContext();
  const settings = context.extensionSettings[EXTENSION_NAME];
  
  if (!settings.customPrompts) {
    settings.customPrompts = [];
  }
  
  const id = 'prompt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  settings.customPrompts.push({ id, name, template });
  saveSettings();
  
  return id;
}

/**
 * Update a custom prompt template
 */
function updateCustomPrompt(id, name, template) {
  const context = SillyTavern.getContext();
  const settings = context.extensionSettings[EXTENSION_NAME];
  
  if (settings.customPrompts) {
    const prompt = settings.customPrompts.find(p => p.id === id);
    if (prompt) {
      prompt.name = name;
      prompt.template = template;
      saveSettings();
    }
  }
}

/**
 * Delete a custom prompt template
 */
function deleteCustomPrompt(id) {
  const context = SillyTavern.getContext();
  const settings = context.extensionSettings[EXTENSION_NAME];
  
  if (settings.customPrompts) {
    const index = settings.customPrompts.findIndex(p => p.id === id);
    if (index > -1) {
      settings.customPrompts.splice(index, 1);
      saveSettings();
    }
  }
}

/**
 * Get current character name
 */
function getCurrentCharacterName() {
  const context = SillyTavern.getContext();
  if (context.characterId !== undefined && context.characters[context.characterId]) {
    return context.characters[context.characterId].name;
  }
  return null;
}

/**
 * Get current persona/user name
 */
function getCurrentPersonaName() {
  const context = SillyTavern.getContext();
  return context.name1 || null;
}

/**
 * Check if currently in a group chat
 */
function isGroupChat() {
  const context = SillyTavern.getContext();
  return context.groupId !== null && context.groupId !== undefined;
}

/**
 * Get current group info
 */
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

/**
 * Get group member names
 */
function getGroupMemberNames(memberIds) {
  const context = SillyTavern.getContext();
  return memberIds.map(memberId => {
    const char = context.characters.find(c => c.avatar === memberId);
    return char ? char.name : memberId;
  }).filter(Boolean);
}

/**
 * Resolve entity name from tag macros
 */
function resolveEntityName(entityName) {
  const context = SillyTavern.getContext();

  if (context.substituteParams) {
    const resolved = context.substituteParams(entityName);
    if (resolved !== entityName) return resolved;
  }

  const lowerName = entityName.toLowerCase();
  if (lowerName === '{{user}}' || lowerName === 'user') {
    return getCurrentPersonaName() || entityName;
  }
  if (lowerName === '{{char}}' || lowerName === 'char') {
    return getCurrentCharacterName() || entityName;
  }
  if (lowerName === '{{group}}' || lowerName === 'group') {
    const group = getCurrentGroup();
    return group ? group.name : entityName;
  }

  return entityName;
}

/**
 * Get assignments for a character
 */
function getCharacterAssignments(charName) {
  const settings = getSettings();
  return settings.assignments?.[charName] || {};
}

/**
 * Get character-specific settings
 */
function getCharacterSettings(charName) {
  const settings = getSettings();
  return settings.characterSettings?.[charName] || { 
    injectPrompt: false, 
    selectedPromptId: 'default',
    aiNaming: { enabled: false, provider: 'openai', apiKey: '' }
  };
}

/**
 * Get all custom prompts
 * @returns {Array} Array of custom prompt objects
 */
function getCustomPrompts() {
  const settings = getSettings();
  return settings.customPrompts || [];
}

/**
 * Get a prompt template by ID
 * @param {string} id - Prompt ID ('default' or custom ID)
 * @param {string} charName - Character name (for default template)
 * @returns {string} The prompt template
 */
function getPromptTemplate(id, charName) {
  if (!id || id === 'default') {
    return `Available images for ${charName} (use ::img ${charName} name:: to display):`;
  }

  const customPrompts = getCustomPrompts();
  const prompt = customPrompts.find(p => p.id === id);
  return prompt ? prompt.template : `Available images for ${charName} (use ::img ${charName} name:: to display):`;
}

/**
 * Generate the image list prompt for a character
 * @param {string} charName - Character name
 * @returns {string} Formatted prompt text
 */
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

/**
 * Save character-specific settings
 */
function saveCharacterSettings(charName, charSettings) {
  const context = SillyTavern.getContext();
  const settings = context.extensionSettings[EXTENSION_NAME];

  if (!settings.characterSettings) {
    settings.characterSettings = {};
  }
  settings.characterSettings[charName] = charSettings;
  saveSettings();
}

/**
 * Assign a name to an image
 */
function assignImage(charName, imageName, imagePath, description = '') {
  const context = SillyTavern.getContext();
  const settings = context.extensionSettings[EXTENSION_NAME];

  if (!settings.assignments) settings.assignments = {};
  if (!settings.assignments[charName]) settings.assignments[charName] = {};

  settings.assignments[charName][imageName] = {
    path: imagePath,
    description: description
  };
  saveSettings();
}

/**
 * Update description for an assignment
 */
function updateImageDescription(charName, imageName, description) {
  const context = SillyTavern.getContext();
  const settings = context.extensionSettings[EXTENSION_NAME];

  if (settings.assignments?.[charName]?.[imageName]) {
    settings.assignments[charName][imageName].description = description;
    saveSettings();
  }
}

/**
 * Remove an assignment
 */
function unassignImage(charName, imageName) {
  const context = SillyTavern.getContext();
  const settings = context.extensionSettings[EXTENSION_NAME];

  if (settings.assignments?.[charName]?.[imageName]) {
    delete settings.assignments[charName][imageName];
    saveSettings();
  }
}

/**
 * Get image path by character and name
 */
function getImagePath(charName, imageName) {
  const assignments = getCharacterAssignments(charName);
  const assignment = assignments[imageName];
  if (!assignment) return '';
  return typeof assignment === 'string' ? assignment : assignment.path || '';
}

/**
 * Replace ::img:: tags in text
 */
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
    if (imagePath) {
      return `![${imageName}](/${imagePath})`;
    }
    const currentChar = getCurrentCharacterName();
    if (currentChar) {
      const currentPath = getImagePath(currentChar, imageName);
      if (currentPath) {
        return `![${imageName}](/${currentPath})`;
      }
    }
    return match;
  });
}

/**
 * Strip ::img:: tags from text
 */
function stripImageTags(text) {
  if (!text) return text;
  return text.replace(/::img\s+.+?::/gi, '').replace(/\s{2,}/g, ' ').trim();
}

const processedMessages = new WeakSet();

/**
 * Process a single message element
 */
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

  matches.forEach(m => {
    const resolvedName = resolveEntityName(m.charName);
    let imagePath = getImagePath(resolvedName, m.imageName);

    if (!imagePath) {
      const currentChar = getCurrentCharacterName();
      if (currentChar) {
        imagePath = getImagePath(currentChar, m.imageName);
      }
    }
    if (!imagePath) {
      const currentPersona = getCurrentPersonaName();
      if (currentPersona) {
        imagePath = getImagePath(currentPersona, m.imageName);
      }
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
            if (mesTextEl) {
              mesTextEl.innerHTML = newMes;
            }
          }
        }
      }
    }
  });
}

/**
 * Process all messages
 */
function processAllMessages() {
  const messages = document.querySelectorAll('#chat .mes');
  messages.forEach(processMessageElement);
}

/**
 * Register message handler
 */
function registerMessageHandler() {
  setTimeout(processAllMessages, 500);
}

/**
 * Open the gallery modal
 */
function openGallery() {
  const charName = getCurrentCharacterName();
  if (!charName) return;

  if (!galleryContainer) {
    galleryContainer = document.createElement('div');
    galleryContainer.id = 'hentai-local-gallery-root';
    document.body.appendChild(galleryContainer);
    galleryRoot = createRoot(galleryContainer);
  }

  const assignments = getCharacterAssignments(charName);
  const charSettings = getCharacterSettings(charName);
  const customPrompts = getSettings().customPrompts || [];

  galleryRoot.render(
    <Gallery
      characterName={charName}
      onClose={closeGallery}
      assignments={assignments}
      characterSettings={charSettings}
      customPrompts={customPrompts}
      onAssign={(name, path, description) => {
        assignImage(charName, name, path, description);
        openGallery();
      }}
      onUnassign={(name) => {
        unassignImage(charName, name);
        openGallery();
      }}
      onUpdateDescription={(name, description) => {
        updateImageDescription(charName, name, description);
        openGallery();
      }}
      onSaveSettings={(settings) => {
        saveCharacterSettings(charName, settings);
        openGallery();
      }}
      onAddPrompt={(name, template) => {
        const id = addCustomPrompt(name, template);
        openGallery();
        return id;
      }}
      onEditPrompt={(id, name, template) => {
        updateCustomPrompt(id, name, template);
        openGallery();
      }}
      onDeletePrompt={(id) => {
        deleteCustomPrompt(id);
        openGallery();
      }}
    />
  );
}

/**
 * Open the group gallery modal
 */
function openGroupGallery() {
  const group = getCurrentGroup();
  if (!group) {
    console.warn(`[${EXTENSION_NAME}] No group selected`);
    return;
  }

  // Create container if not exists
  if (!galleryContainer) {
    galleryContainer = document.createElement('div');
    galleryContainer.id = 'hentai-local-gallery-root';
    document.body.appendChild(galleryContainer);
    galleryRoot = createRoot(galleryContainer);
  }

  const memberNames = getGroupMemberNames(group.members);

  // Gather all member assignments
  const memberAssignments = {};
  for (const memberName of memberNames) {
    memberAssignments[memberName] = getCharacterAssignments(memberName);
  }

  // Group assignments use the group name as the key
  const groupAssignments = getCharacterAssignments(group.name);
  const groupSettings = getCharacterSettings(group.name);
  const customPrompts = getSettings().customPrompts || [];

  // Render group gallery
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
      onAssignGroup={(name, path, description) => {
        assignImage(group.name, name, path, description);
        openGroupGallery();
      }}
      onUnassignGroup={(name) => {
        unassignImage(group.name, name);
        openGroupGallery();
      }}
      onUpdateGroupDescription={(name, description) => {
        updateImageDescription(group.name, name, description);
        openGroupGallery();
      }}
      onSaveGroupSettings={(settings) => {
        saveCharacterSettings(group.name, settings);
        openGroupGallery();
      }}
      onAddPrompt={(name, template) => {
        const id = addCustomPrompt(name, template);
        openGroupGallery();
        return id;
      }}
      onEditPrompt={(id, name, template) => {
        updateCustomPrompt(id, name, template);
        openGroupGallery();
      }}
      onDeletePrompt={(id) => {
        deleteCustomPrompt(id);
        openGroupGallery();
      }}
    />
  );
}

/**
 * Close gallery
 */
function closeGallery() {
  if (galleryRoot) {
    galleryRoot.render(null);
  }
}

/**
 * Get all entities (characters + persona) that have images assigned
 */
function getEntitiesWithImages() {
  const settings = getSettings();
  const entities = [];

  // Always include persona if it has images
  const personaName = getCurrentPersonaName();
  if (personaName && settings.assignments?.[personaName]) {
    const imageCount = Object.keys(settings.assignments[personaName]).length;
    if (imageCount > 0) {
      entities.push({ name: personaName, type: 'persona', count: imageCount });
    }
  }

  if (isGroupChat()) {
    // In group chat, include the group entity itself if it has images
    const group = getCurrentGroup();
    if (group && settings.assignments?.[group.name]) {
      const imageCount = Object.keys(settings.assignments[group.name]).length;
      if (imageCount > 0) {
        entities.push({ name: group.name, type: 'group', count: imageCount });
      }
    }
    // Include all group members that have images
    if (group) {
      const memberNames = getGroupMemberNames(group.members);
      memberNames.forEach(memberName => {
        if (settings.assignments?.[memberName]) {
          const imageCount = Object.keys(settings.assignments[memberName]).length;
          if (imageCount > 0) {
            entities.push({ name: memberName, type: 'character', count: imageCount });
          }
        }
      });
    }
  } else {
    // Single character chat: include current character
    const charName = getCurrentCharacterName();
    if (charName && settings.assignments?.[charName]) {
      const imageCount = Object.keys(settings.assignments[charName]).length;
      if (imageCount > 0) {
        entities.push({ name: charName, type: 'character', count: imageCount });
      }
    }
  }

  return entities;
}

/**
 * Send a message as narrator (/sys) without triggering AI response
 */
function sendAsNarrator(message) {
  const context = SillyTavern.getContext();
  if (!context.chat) return;

  const sysMessage = {
    name: '/sys',
    mes: message,
    is_system: true
  };

  context.chat.push(sysMessage);
  context.saveChatDebounced();
  processAllMessages();
}

/**
 * Create the floating quick-send button
 */
function createFloatingButton() {
  // Only show in chat view
  const chatContainer = document.querySelector('#chat, .chat-container');
  if (!chatContainer) return;

  // Don't duplicate
  if (document.getElementById(FLOATING_BUTTON_ID)) return;

  const button = document.createElement('div');
  button.id = FLOATING_BUTTON_ID;
  button.className = 'hentai-local-floating-button';
  button.title = 'Quick Send Images';
  button.innerHTML = '🖼️';

  // Style the button
  Object.assign(button.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    backgroundColor: 'var(--st-button-bg, #4a5568)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    cursor: 'pointer',
    zIndex: '9999',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    border: '2px solid var(--st-button-border, #2d3748)',
    transition: 'transform 0.2s, box-shadow 0.2s'
  });

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  });

  button.addEventListener('click', toggleFloatingPanel);

  document.body.appendChild(button);

  // Initial panel update
  updateFloatingPanel();
}

/**
 * Create the floating panel with entity dropdowns
 */
function createFloatingPanel() {
  if (document.getElementById(FLOATING_PANEL_ID)) {
    closeFloatingPanel();
    return;
  }

  const entities = getEntitiesWithImages();
  if (entities.length === 0) {
    console.log(`[${EXTENSION_NAME}] No entities with images found`);
    return;
  }

  // Create panel container
  const panel = document.createElement('div');
  panel.id = FLOATING_PANEL_ID;

  Object.assign(panel.style, {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    width: '300px',
    maxHeight: '400px',
    backgroundColor: 'var(--st-main-bg, #1a202c)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    border: '1px solid var(--st-border-color, #2d3748)',
    zIndex: '9998',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  });

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, {
    padding: '12px 16px',
    borderBottom: '1px solid var(--st-border-color, #2d3748)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--st-secondary-bg, #2d3748)',
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'var(--st-text-color, #e2e8f0)'
  });
  header.textContent = 'Quick Send Image';
  panel.appendChild(header);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    background: 'none',
    border: 'none',
    color: 'var(--st-text-color, #e2e8f0)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0',
    lineHeight: '1'
  });
  closeBtn.addEventListener('click', closeFloatingPanel);
  header.appendChild(closeBtn);

  // Content area
  const content = document.createElement('div');
  Object.assign(content.style, {
    padding: '12px',
    maxHeight: '300px',
    overflowY: 'auto'
  });

  entities.forEach(entity => {
    const entitySection = document.createElement('div');
    entitySection.style.marginBottom = '12px';

    const label = document.createElement('div');
    label.textContent = `${entity.name} (${entity.count} images)`;
    Object.assign(label.style, {
      fontSize: '12px',
      color: 'var(--st-muted-text, #a0aec0)',
      marginBottom: '6px',
      fontWeight: 'bold'
    });
    entitySection.appendChild(label);

    const select = document.createElement('select');
    Object.assign(select.style, {
      width: '100%',
      padding: '8px',
      borderRadius: '6px',
      border: '1px solid var(--st-border-color, #2d3748)',
      backgroundColor: 'var(--st-input-bg, #2d3748)',
      color: 'var(--st-text-color, #e2e8f0)',
      fontSize: '13px',
      outline: 'none'
    });

    // Get assignments for this entity
    const assignments = getCharacterAssignments(entity.name);
    const imageNames = Object.keys(assignments);

    // Default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select an image...';
    select.appendChild(defaultOption);

    imageNames.forEach(imgName => {
      const option = document.createElement('option');
      option.value = imgName;
      option.textContent = imgName;
      if (assignments[imgName]?.description) {
        option.title = assignments[imgName].description;
      }
      select.appendChild(option);
    });

    // Send button
    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send';
    Object.assign(sendBtn.style, {
      marginTop: '6px',
      width: '100%',
      padding: '6px 12px',
      borderRadius: '6px',
      border: 'none',
      backgroundColor: 'var(--st-button-bg, #4a5568)',
      color: 'white',
      fontSize: '12px',
      cursor: 'pointer',
      fontWeight: 'bold'
    });

    sendBtn.addEventListener('click', () => {
      const selectedImage = select.value;
      if (!selectedImage) return;

      const imagePath = getImagePath(entity.name, selectedImage);
      if (imagePath) {
        const markdown = `![${selectedImage}](/${imagePath})`;
        sendAsNarrator(markdown);
        closeFloatingPanel();
      }
    });

    entitySection.appendChild(select);
    entitySection.appendChild(sendBtn);
    content.appendChild(entitySection);
  });

  panel.appendChild(content);
  document.body.appendChild(panel);

  floatingPanelExpanded = true;
}

/**
 * Close the floating panel
 */
function closeFloatingPanel() {
  const panel = document.getElementById(FLOATING_PANEL_ID);
  if (panel) {
    panel.remove();
  }
  floatingPanelExpanded = false;
}

/**
 * Toggle floating panel visibility
 */
function toggleFloatingPanel() {
  if (floatingPanelExpanded) {
    closeFloatingPanel();
  } else {
    updateFloatingPanel();
    createFloatingPanel();
  }
}

/**
 * Update floating panel content based on current chat state
 * Called when chat changes to refresh available entities
 */
function updateFloatingPanel() {
  // If panel is open, refresh it
  if (floatingPanelExpanded) {
    closeFloatingPanel();
    createFloatingPanel();
  }
}

/**
 * Handle character/group selection change (original gallery button handler)
 */
function onChatChanged() {
  const inGroup = isGroupChat();
  console.log(`[${EXTENSION_NAME}] onChatChanged called, isGroupChat: ${inGroup}`);

  // Remove existing button
  const existingButton = document.getElementById(BUTTON_ID);
  if (existingButton) {
    existingButton.remove();
  }

  // Create the button
  const button = document.createElement('div');
  button.id = BUTTON_ID;
  button.className = 'menu_button fa-solid fa-images interactable';

  if (inGroup) {
    // Group gallery
    button.title = 'Group Images';
    button.setAttribute('data-i18n', '[title]Group Images');
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openGroupGallery();
    });
  } else {
    // Single character chat - find the export button
    const exportButton = document.getElementById('export_button');
    if (!exportButton || !exportButton.parentElement) {
      // Retry after a short delay
      setTimeout(onChatChanged, 500);
      return;
    }

    const charName = getCurrentCharacterName();
    if (!charName) return; // No character selected

    button.title = 'HentaiLocal Scraper';
    button.setAttribute('data-i18n', '[title]HentaiLocal Scraper');
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openGallery();
    });

    // Insert after the export button
    const buttonContainer = exportButton.parentElement;
    if (exportButton.nextSibling) {
      buttonContainer.insertBefore(button, exportButton.nextSibling);
    } else {
      buttonContainer.appendChild(button);
    }
    console.log(`[${EXTENSION_NAME}] Gallery button added (character mode)`);
    return;
  }

  // Insert group button (same position as character button would be)
  const exportButton = document.getElementById('export_button');
  if (exportButton && exportButton.parentElement) {
    const buttonContainer = exportButton.parentElement;
    if (exportButton.nextSibling) {
      buttonContainer.insertBefore(button, exportButton.nextSibling);
    } else {
      buttonContainer.appendChild(button);
    }
  }
  console.log(`[${EXTENSION_NAME}] Gallery button added (group mode)`);
}

/**
 * Add gallery button (legacy - calls onChatChanged)
 */
function addGalleryButton() {
  onChatChanged();
}

/**
 * Initialize extension
 */
function init() {
  initSettings();
  registerMessageHandler();

  const context = SillyTavern.getContext();

  if (context.eventSource && context.eventTypes) {
    context.eventSource.on(context.eventTypes.CHAT_CHANGED, () => {
      setTimeout(() => {
        addGalleryButton();
        processAllMessages();
        updateFloatingPanel();
      }, 500);
    });

    // Listen for prompt generation to inject image list
    if (context.eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS) {
      context.eventSource.on(context.eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS, () => {
        const prompts = [];

        // Handle group chats
        if (isGroupChat()) {
          const group = getCurrentGroup();
          if (group) {
            const groupSettings = getCharacterSettings(group.name);
            if (groupSettings.injectPrompt) {
              const groupPrompt = generateImageListPrompt(group.name);
              if (groupPrompt) prompts.push(groupPrompt);
            }

            // Also inject member image lists if they have injectPrompt enabled
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
          // Single character chat
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

        // Inject into extension prompt (Author's Note style)
        const combinedPrompt = prompts.join('\n\n');
        const extensionPrompt = context.extensionPrompts?.[EXTENSION_NAME];
        if (extensionPrompt === undefined) {
          context.setExtensionPrompt(EXTENSION_NAME, combinedPrompt, 1, 0);
        }
      });
    }
  }

  setTimeout(() => {
    addGalleryButton();
    createFloatingButton();
  }, 100);

  // Load AI naming settings
  const settings = getSettings();
  if (settings.aiNaming) {
    AINaming.loadSettings(settings);
  }

  console.log(`[${EXTENSION_NAME}] Extension initialized`);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { BooruScraper, AINaming, SettingsPanel, addCustomPrompt, updateCustomPrompt, deleteCustomPrompt };