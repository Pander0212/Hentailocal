/* global SillyTavern */
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Get request headers for ST API calls
 */
function getRequestHeaders() {
    return SillyTavern.getContext().getRequestHeaders();
}

/**
 * Settings Panel Component for Group
 */
function GroupSettingsPanel({ groupName, settings, customPrompts, assignments, onSave, onAddPrompt, onEditPrompt, onDeletePrompt }) {
    const [injectPrompt, setInjectPrompt] = useState(settings.injectPrompt || false);
    const [selectedPromptId, setSelectedPromptId] = useState(settings.selectedPromptId || 'default');

    const defaultTemplate = `Available images for ${groupName} (use ::img ${groupName} name:: to display):`;

    const handlePromptChange = (e) => {
        const newId = e.target.value;
        setSelectedPromptId(newId);
        onSave({ injectPrompt, selectedPromptId: newId });
    };

    return (
        <div className="local-image-settings">
            <div className="settings-row">
                <label className="settings-checkbox">
                    <input
                        type="checkbox"
                        checked={injectPrompt}
                        onChange={(e) => {
                            setInjectPrompt(e.target.checked);
                            onSave({ injectPrompt: e.target.checked, selectedPromptId });
                        }}
                    />
                    <span>Inject image list into group prompt</span>
                </label>
            </div>
            {injectPrompt && (
                <div className="settings-row">
                    <label className="settings-label">Prompt template:</label>
                    <select className="settings-select" value={selectedPromptId} onChange={handlePromptChange}>
                        <option value="default">Default</option>
                        {customPrompts.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
}

/**
 * Member Section Component
 */
function MemberSection({ memberName, assignments, expanded, onToggle, onImageClick }) {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (expanded) fetchMemberImages();
    }, [expanded, memberName]);

    const fetchMemberImages = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/images/list', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ folder: memberName, sortField: 'date', sortOrder: 'desc' }),
            });
            if (response.ok) {
                const data = await response.json();
                setImages(data.map((file) => ({ name: file, src: `user/images/${memberName}/${file}`, owner: memberName })));
            } else { setImages([]); }
        } catch (e) {
            console.error('Failed to fetch member images:', e);
            setImages([]);
        } finally { setLoading(false); }
    };

    const getAssignmentInfo = (imageSrc) => {
        if (!assignments) return { name: null, description: '' };
        const name = Object.keys(assignments).find(key => {
            const val = assignments[key];
            const path = typeof val === 'string' ? val : val?.path;
            return path === imageSrc;
        });
        if (!name) return { name: null, description: '' };
        const assignment = assignments[name];
        const description = typeof assignment === 'object' ? assignment.description : '';
        return { name, description };
    };

    const assignedCount = Object.keys(assignments || {}).length;

    return (
        <div className="group-member-section">
            <div className="group-member-header" onClick={onToggle}>
                <i className={`fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
                <span className="member-name">{memberName}</span>
                {assignedCount > 0 && <span className="member-count">{assignedCount} assigned</span>}
            </div>
            {expanded && (
                <div className="group-member-content">
                    {loading ? (
                        <div className="local-image-loading">Loading...</div>
                    ) : images.length === 0 ? (
                        <div className="local-image-empty-small">No images</div>
                    ) : (
                        <div className="local-image-grid local-image-grid-small">
                            {images.map((image, index) => {
                                const { name: assignmentName, description } = getAssignmentInfo(image.src);
                                return (
                                    <div
                                        key={index}
                                        className={`local-image-item local-image-item-small ${assignmentName ? 'assigned' : ''}`}
                                        onClick={(e) => onImageClick(e, image, true)}
                                        title={`${memberName}: ${assignmentName || image.name}${description ? ` - ${description}` : ''}`}
                                    >
                                        <img src={image.src} alt={image.name} loading="lazy" />
                                        {assignmentName && (
                                            <div className="assignment-label">
                                                <span className="assignment-name">{assignmentName}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Image Options Menu for Group Gallery
 */
function GroupImageOptionsMenu({ image, position, onClose, onView, onAssign, onEditDescription, onRename, onDelete, assignmentName, assignmentDescription, isReadOnly }) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div ref={menuRef} className="local-image-options-menu" style={{ top: position.y, left: position.x }}>
            <div className="options-menu-item" onClick={() => { onView(); onClose(); }}>
                <i className="fa-solid fa-expand"></i> View Full Size
            </div>
            {!isReadOnly && (
                <>
                    <div className="options-menu-item" onClick={() => { onAssign(); onClose(); }}>
                        <i className="fa-solid fa-tag"></i> {assignmentName ? 'Change Name' : 'Assign Name'}
                    </div>
                    {assignmentName && (
                        <div className="options-menu-item" onClick={() => { onEditDescription(); onClose(); }}>
                            <i className="fa-solid fa-align-left"></i> {assignmentDescription ? 'Edit Description' : 'Add Description'}
                        </div>
                    )}
                    {assignmentName && (
                        <div className="options-menu-item" onClick={() => { onRename(); onClose(); }}>
                            <i className="fa-solid fa-xmark"></i> Remove Assignment
                        </div>
                    )}
                    <div className="options-menu-item options-menu-item-danger" onClick={() => { onDelete(); onClose(); }}>
                        <i className="fa-solid fa-trash"></i> Delete
                    </div>
                </>
            )}
            {isReadOnly && (
                <div className="options-menu-info">
                    <i className="fa-solid fa-info-circle"></i> Member images are read-only
                </div>
            )}
        </div>
    );
}

function findMemberConflicts(imageName, memberAssignments) {
    const conflicts = [];
    for (const [memberName, assignments] of Object.entries(memberAssignments)) {
        if (assignments && assignments[imageName]) conflicts.push(memberName);
    }
    return conflicts;
}

/**
 * Group Gallery Modal Component
 */
function GroupGallery({ groupName, groupId, memberNames, memberAssignments, groupAssignments, groupSettings, customPrompts, onClose, onAssignGroup, onUnassignGroup, onUpdateGroupDescription, onSaveGroupSettings, onAddPrompt, onEditPrompt, onDeletePrompt }) {
    const [groupImages, setGroupImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [optionsMenu, setOptionsMenu] = useState(null);
    const [error, setError] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [expandedMembers, setExpandedMembers] = useState({});
    const fileInputRef = useRef(null);

    const groupFolder = `_group_${groupId}`;

    const fetchGroupImages = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/images/list', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ folder: groupFolder, sortField: 'date', sortOrder: 'desc' }),
            });
            if (response.ok) {
                const data = await response.json();
                setGroupImages(data.map((file) => ({
                    name: file,
                    src: `user/images/${groupFolder}/${file}`,
                    owner: groupName,
                    isGroupImage: true,
                })));
            } else { setGroupImages([]); }
        } catch (e) {
            console.error('Failed to fetch group images:', e);
            setError('Failed to load group images');
            setGroupImages([]);
        } finally { setLoading(false); }
    }, [groupFolder, groupName]);

    useEffect(() => { fetchGroupImages(); }, [fetchGroupImages]);

    const handleUpload = useCallback(async (files) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        setError(null);
        const uploadedImages = [];
        for (const file of files) {
            try {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                const ext = file.name.split('.').pop().toLowerCase();
                const filename = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
                const response = await fetch('/api/images/upload', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ image: base64, ch_name: groupFolder, filename, format: ext }),
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
                }
                const uploadedPath = `user/images/${groupFolder}/${filename}.${ext}`;
                uploadedImages.push({ filename: `${filename}.${ext}`, path: uploadedPath });
            } catch (e) {
                console.error('Failed to upload image:', e);
                setError(`Failed to upload ${file.name}: ${e.message}`);
            }
        }
        setUploading(false);
        await fetchGroupImages();
        for (const img of uploadedImages) {
            const nameFromFile = img.filename.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_');
            onAssignGroup(nameFromFile, img.path, nameFromFile);
        }
    }, [groupFolder, memberAssignments, fetchGroupImages, onAssignGroup]);

    const handleFileSelect = useCallback((e) => {
        handleUpload(Array.from(e.target.files));
        e.target.value = '';
    }, [handleUpload]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        handleUpload(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
    }, [handleUpload]);

    const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);

    const handleDelete = useCallback(async (image) => {
        if (!confirm(`Delete ${image.name}?`)) return;
        try {
            const response = await fetch('/api/images/delete', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ path: image.src }),
            });
            if (!response.ok) throw new Error('Delete failed');
            const assignmentName = Object.keys(groupAssignments || {}).find(key => {
                const val = groupAssignments[key];
                const path = typeof val === 'string' ? val : val?.path;
                return path === image.src;
            });
            if (assignmentName) onUnassignGroup(assignmentName);
            fetchGroupImages();
        } catch (e) { console.error('Failed to delete image:', e); setError('Failed to delete image'); }
    }, [fetchGroupImages, groupAssignments, onUnassignGroup]);

    const handleAssign = useCallback((image) => {
        const currentName = Object.keys(groupAssignments || {}).find(key => {
            const val = groupAssignments[key];
            const path = typeof val === 'string' ? val : val?.path;
            return path === image.src;
        });
        const currentAssignment = currentName ? groupAssignments[currentName] : null;
        const currentDesc = currentAssignment && typeof currentAssignment === 'object' ? currentAssignment.description : '';
        let name = prompt(`Enter a name for this image (used in ::img ${groupName} name:: tag):`, currentName || '');
        if (name && name.trim()) {
            name = name.trim().replace(/\s+/g, '_');
            if (name !== currentName) {
                const conflicts = findMemberConflicts(name, memberAssignments);
                if (conflicts.length > 0) {
                    const proceed = confirm(`Warning: The name "${name}" is already used by: ${conflicts.join(', ')}\n\nContinue with this name?`);
                    if (!proceed) return;
                }
            }
            if (currentName && currentName !== name) onUnassignGroup(currentName);
            let description = currentDesc;
            if (!currentName) description = prompt('Enter a description (helps AI choose when to use this image):') || '';
            onAssignGroup(name, image.src, description);
        }
    }, [groupAssignments, groupName, memberAssignments, onAssignGroup, onUnassignGroup]);

    const handleEditDescription = useCallback((image) => {
        const currentName = Object.keys(groupAssignments || {}).find(key => {
            const val = groupAssignments[key];
            const path = typeof val === 'string' ? val : val?.path;
            return path === image.src;
        });
        if (!currentName) return;
        const currentDesc = typeof groupAssignments[currentName] === 'object' ? groupAssignments[currentName].description : '';
        const description = prompt('Enter a description:', currentDesc);
        if (description !== null) onUpdateGroupDescription(currentName, description.trim());
    }, [groupAssignments, onUpdateGroupDescription]);

    const getGroupAssignmentInfo = useCallback((imageSrc) => {
        if (!groupAssignments) return { name: null, description: '' };
        const name = Object.keys(groupAssignments).find(key => {
            const val = groupAssignments[key];
            const path = typeof val === 'string' ? val : val?.path;
            return path === imageSrc;
        });
        if (!name) return { name: null, description: '' };
        const assignment = groupAssignments[name];
        const description = typeof assignment === 'object' ? assignment.description : '';
        return { name, description };
    }, [groupAssignments]);

    const handleImageClick = useCallback((e, image, isReadOnly = false) => {
        e.preventDefault();
        e.stopPropagation();
        let x = e.clientX;
        let y = e.clientY;
        if (x + 180 > window.innerWidth) x = window.innerWidth - 190;
        if (y + 200 > window.innerHeight) y = window.innerHeight - 210;
        setOptionsMenu({ image, position: { x, y }, isReadOnly });
    }, []);

    const handleBackdropClick = useCallback((e) => {
        if (e.target.classList.contains('local-image-modal-backdrop')) onClose();
    }, [onClose]);

    const toggleMember = (memberName) => {
        setExpandedMembers(prev => ({ ...prev, [memberName]: !prev[memberName] }));
    };

    const groupAssignedCount = Object.keys(groupAssignments || {}).length;
    const totalMemberAssignments = memberNames.reduce((sum, name) => sum + Object.keys(memberAssignments[name] || {}).length, 0);

    return (
        <div className="local-image-modal-backdrop" onClick={handleBackdropClick} onDrop={handleDrop} onDragOver={handleDragOver}>
            <div className="local-image-modal local-image-modal-large" onClick={() => setOptionsMenu(null)}>
                <div className="local-image-modal-header">
                    <h3>Group Images - {groupName}</h3>
                    <div className="local-image-modal-actions">
                        <button className={`menu_button ${showSettings ? 'menu_button_active' : ''}`} onClick={() => setShowSettings(!showSettings)} title="Settings">
                            <i className="fa-solid fa-gear"></i>
                        </button>
                        <button className="menu_button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Upload Group Images">
                            <i className="fa-solid fa-upload"></i>
                        </button>
                        <button className="menu_button" onClick={onClose} title="Close">
                            <i className="fa-solid fa-times"></i>
                        </button>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                </div>
                {showSettings && <GroupSettingsPanel groupName={groupName} settings={groupSettings} customPrompts={customPrompts} assignments={groupAssignments} onSave={onSaveGroupSettings} onAddPrompt={onAddPrompt} onEditPrompt={onEditPrompt} onDeletePrompt={onDeletePrompt} />}
                {error && <div className="local-image-error">{error}</div>}
                <div className="local-image-info">
                    <span>Use <code>{`::img ${groupName} name::`}</code> for group images, or <code>::img MemberName name::</code> for member images.</span>
                </div>
                <div className="local-image-modal-content group-gallery-content">
                    <div className="group-section">
                        <div className="group-section-header">
                            <i className="fa-solid fa-users"></i>
                            <span>Group Images</span>
                            {groupAssignedCount > 0 && <span className="section-count">{groupAssignedCount} assigned</span>}
                        </div>
                        <div className="group-section-content">
                            {loading ? (<div className="local-image-loading">Loading...</div>) : groupImages.length === 0 ? (
                                <div className="local-image-empty">
                                    <p>No group images yet</p>
                                    <p>Upload images shared by all members (locations, scenes, etc.)</p>
                                </div>
                            ) : (
                                <div className="local-image-grid">
                                    {groupImages.map((image, index) => {
                                        const { name: assignmentName, description } = getGroupAssignmentInfo(image.src);
                                        return (
                                            <div key={index} className={`local-image-item ${assignmentName ? 'assigned' : ''}`} onClick={(e) => handleImageClick(e, image, false)} title={description || assignmentName || image.name}>
                                                <img src={image.src} alt={image.name} loading="lazy" />
                                                {assignmentName && (<div className="assignment-label"><span className="assignment-name">{assignmentName}</span>{description && <span className="assignment-desc">{description}</span>}</div>)}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="group-section">
                        <div className="group-section-header">
                            <i className="fa-solid fa-user"></i>
                            <span>Member Images</span>
                            {totalMemberAssignments > 0 && <span className="section-count">{totalMemberAssignments} total assigned</span>}
                        </div>
                        <div className="group-members-list">
                            {memberNames.map((memberName) => (
                                <MemberSection key={memberName} memberName={memberName} assignments={memberAssignments[memberName] || {}} expanded={expandedMembers[memberName] || false} onToggle={() => toggleMember(memberName)} onImageClick={handleImageClick} />
                            ))}
                        </div>
                    </div>
                </div>
                {uploading && (<div className="local-image-uploading"><i className="fa-solid fa-spinner fa-spin"></i> Uploading...</div>)}
            </div>
            {optionsMenu && (
                <GroupImageOptionsMenu
                    image={optionsMenu.image} position={optionsMenu.position} isReadOnly={optionsMenu.isReadOnly}
                    assignmentName={optionsMenu.isReadOnly ? null : getGroupAssignmentInfo(optionsMenu.image.src).name}
                    assignmentDescription={optionsMenu.isReadOnly ? null : getGroupAssignmentInfo(optionsMenu.image.src).description}
                    onClose={() => setOptionsMenu(null)} onView={() => setSelectedImage(optionsMenu.image)}
                    onAssign={() => handleAssign(optionsMenu.image)} onEditDescription={() => handleEditDescription(optionsMenu.image)}
                    onRename={() => { const name = getGroupAssignmentInfo(optionsMenu.image.src).name; if (name) onUnassignGroup(name); }}
                    onDelete={() => handleDelete(optionsMenu.image)}
                />
            )}
            {selectedImage && (
                <div className="local-image-lightbox" onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage.src} alt={selectedImage.name} />
                    <button className="lightbox-close" onClick={() => setSelectedImage(null)}><i className="fa-solid fa-times"></i></button>
                </div>
            )}
        </div>
    );
}

export default GroupGallery;
