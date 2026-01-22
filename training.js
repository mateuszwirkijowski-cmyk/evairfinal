import { supabase } from './auth.js';

let currentModuleId = null;
let allModules = [];

export async function initTrainingModules(isAdmin) {
    console.log('[TRAINING] Initializing training modules, isAdmin:', isAdmin);

    if (isAdmin) {
        const manageBtn = document.getElementById('manage-modules-btn');
        if (manageBtn) {
            manageBtn.style.display = 'inline-flex';
            manageBtn.onclick = openTrainingModulesModal;
        }
    }

    await loadTrainingModules();
    setupRichTextEditor();
    setupModuleEventListeners();
}

async function loadTrainingModules() {
    try {
        const { data, error } = await supabase
            .from('training_modules')
            .select('*')
            .eq('is_active', true)
            .order('order_index', { ascending: true });

        if (error) throw error;

        allModules = data || [];
        renderModulesList(allModules);

        if (allModules.length > 0) {
            await showModuleContent(allModules[0].id);
        }
    } catch (error) {
        console.error('[TRAINING] Error loading modules:', error);
        document.getElementById('training-modules-list').innerHTML =
            '<p style="color: #dc3545;">Błąd ładowania modułów</p>';
    }
}

function renderModulesList(modules) {
    const container = document.getElementById('training-modules-list');

    if (modules.length === 0) {
        container.innerHTML = '<p style="color: #666;">Brak dostępnych modułów</p>';
        return;
    }

    container.innerHTML = modules.map((module, index) => `
        <button class="training-btn ${index === 0 ? 'active' : ''}"
                data-module-id="${module.id}"
                onclick="window.showTrainingModule('${module.id}')">
            ${module.title}
        </button>
    `).join('');
}

async function showModuleContent(moduleId) {
    currentModuleId = moduleId;

    document.querySelectorAll('.training-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-module-id') === moduleId) {
            btn.classList.add('active');
        }
    });

    try {
        const { data, error } = await supabase
            .from('training_modules')
            .select('*')
            .eq('id', moduleId)
            .single();

        if (error) throw error;

        renderModuleContent(data);
    } catch (error) {
        console.error('[TRAINING] Error loading module content:', error);
        document.getElementById('module-content').innerHTML =
            '<p style="color: #dc3545;">Błąd ładowania treści modułu</p>';
    }
}

function renderModuleContent(module) {
    const container = document.getElementById('module-content');
    let html = module.content || '<p>Brak treści</p>';

    if (module.video_url) {
        const videoUrl = supabase.storage.from('training-files').getPublicUrl(module.video_url).data.publicUrl;
        html += `
            <div class="module-video-container">
                <video controls>
                    <source src="${videoUrl}" type="video/mp4">
                    Twoja przeglądarka nie obsługuje odtwarzania wideo.
                </video>
            </div>
        `;
    }

    if (module.embed_code) {
        html += `
            <div class="module-embed-container">
                ${module.embed_code}
            </div>
        `;
    }

    if (module.pdf_url) {
        const pdfUrl = supabase.storage.from('training-files').getPublicUrl(module.pdf_url).data.publicUrl;
        html += `
            <div class="module-pdf-container">
                <h4>Dokumentacja PDF</h4>
                <a href="${pdfUrl}" target="_blank" download>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Pobierz PDF
                </a>
            </div>
        `;
    }

    container.innerHTML = html;
}

window.showTrainingModule = showModuleContent;

async function openTrainingModulesModal() {
    const modal = document.getElementById('training-modules-modal');
    modal.classList.remove('hidden');

    await loadAdminModulesList();
}

window.closeTrainingModulesModal = function() {
    const modal = document.getElementById('training-modules-modal');
    modal.classList.add('hidden');
};

async function loadAdminModulesList() {
    try {
        const { data, error } = await supabase
            .from('training_modules')
            .select('*')
            .order('order_index', { ascending: true });

        if (error) throw error;

        const container = document.getElementById('admin-modules-list');

        if (data.length === 0) {
            container.innerHTML = '<p style="color: #666;">Brak modułów. Dodaj pierwszy moduł!</p>';
            return;
        }

        container.innerHTML = data.map(module => `
            <div class="module-admin-card">
                <div class="module-admin-info">
                    <h3>${module.title}</h3>
                    <p>
                        ${module.is_active ? '<span style="color: #28a745;">✓ Aktywny</span>' : '<span style="color: #dc3545;">✗ Nieaktywny</span>'}
                        · Kolejność: ${module.order_index}
                    </p>
                </div>
                <div class="module-admin-actions">
                    <button class="btn btn-outline btn-small" onclick="window.editTrainingModule('${module.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edytuj
                    </button>
                    <button class="btn btn-outline btn-small" style="color: #dc3545; border-color: #dc3545;"
                            onclick="window.deleteTrainingModule('${module.id}', '${module.title.replace(/'/g, "\\'")}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Usuń
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('[TRAINING] Error loading admin modules list:', error);
    }
}

window.editTrainingModule = async function(moduleId) {
    const modal = document.getElementById('edit-module-modal');
    const titleEl = document.getElementById('edit-module-title');

    if (moduleId === 'new') {
        titleEl.textContent = 'Dodaj nowy moduł';
        document.getElementById('edit-module-id').value = '';
        document.getElementById('edit-module-name').value = '';
        document.getElementById('edit-module-content').innerHTML = '<p>Wpisz treść modułu...</p>';
        document.getElementById('edit-module-embed').value = '';
        document.getElementById('edit-module-active').checked = true;
        document.getElementById('current-video-info').textContent = '';
        document.getElementById('current-pdf-info').textContent = '';

        const maxOrder = allModules.length > 0 ? Math.max(...allModules.map(m => m.order_index)) : 0;
        document.getElementById('edit-module-name').setAttribute('data-order', maxOrder + 1);
    } else {
        titleEl.textContent = 'Edytuj moduł';

        try {
            const { data, error } = await supabase
                .from('training_modules')
                .select('*')
                .eq('id', moduleId)
                .single();

            if (error) throw error;

            document.getElementById('edit-module-id').value = data.id;
            document.getElementById('edit-module-name').value = data.title;
            document.getElementById('edit-module-content').innerHTML = data.content || '<p>Wpisz treść modułu...</p>';
            document.getElementById('edit-module-embed').value = data.embed_code || '';
            document.getElementById('edit-module-active').checked = data.is_active;
            document.getElementById('edit-module-name').setAttribute('data-order', data.order_index);

            if (data.video_url) {
                document.getElementById('current-video-info').textContent = '✓ Wideo już dodane. Wybierz nowy plik aby zamienić.';
            } else {
                document.getElementById('current-video-info').textContent = '';
            }

            if (data.pdf_url) {
                document.getElementById('current-pdf-info').textContent = '✓ PDF już dodany. Wybierz nowy plik aby zamienić.';
            } else {
                document.getElementById('current-pdf-info').textContent = '';
            }
        } catch (error) {
            console.error('[TRAINING] Error loading module for edit:', error);
            alert('Błąd ładowania modułu');
            return;
        }
    }

    modal.classList.remove('hidden');
};

window.closeEditModuleModal = function() {
    const modal = document.getElementById('edit-module-modal');
    modal.classList.add('hidden');
};

window.deleteTrainingModule = async function(moduleId, moduleTitle) {
    if (!confirm(`Czy na pewno chcesz usunąć moduł "${moduleTitle}"?`)) {
        return;
    }

    try {
        const { data: module } = await supabase
            .from('training_modules')
            .select('video_url, pdf_url')
            .eq('id', moduleId)
            .single();

        if (module?.video_url) {
            await supabase.storage.from('training-files').remove([module.video_url]);
        }
        if (module?.pdf_url) {
            await supabase.storage.from('training-files').remove([module.pdf_url]);
        }

        const { error } = await supabase
            .from('training_modules')
            .delete()
            .eq('id', moduleId);

        if (error) throw error;

        alert('Moduł został usunięty');
        await loadAdminModulesList();
        await loadTrainingModules();
    } catch (error) {
        console.error('[TRAINING] Error deleting module:', error);
        alert('Błąd usuwania modułu');
    }
};

function setupModuleEventListeners() {
    const addNewModuleBtn = document.getElementById('add-new-module-btn');
    if (addNewModuleBtn) {
        addNewModuleBtn.onclick = () => window.editTrainingModule('new');
    }

    const form = document.getElementById('edit-module-form');
    if (form) {
        form.onsubmit = handleModuleSave;
    }
}

async function handleModuleSave(e) {
    e.preventDefault();

    const moduleId = document.getElementById('edit-module-id').value;
    const title = document.getElementById('edit-module-name').value.trim();
    const content = document.getElementById('edit-module-content').innerHTML;
    const embedCode = document.getElementById('edit-module-embed').value.trim();
    const isActive = document.getElementById('edit-module-active').checked;
    const orderIndex = parseInt(document.getElementById('edit-module-name').getAttribute('data-order')) || 0;

    const videoFile = document.getElementById('edit-module-video').files[0];
    const pdfFile = document.getElementById('edit-module-pdf').files[0];

    try {
        let videoUrl = null;
        let pdfUrl = null;

        if (moduleId) {
            const { data: existing } = await supabase
                .from('training_modules')
                .select('video_url, pdf_url')
                .eq('id', moduleId)
                .single();

            videoUrl = existing?.video_url;
            pdfUrl = existing?.pdf_url;
        }

        if (videoFile) {
            if (videoUrl) {
                await supabase.storage.from('training-files').remove([videoUrl]);
            }

            const videoPath = `videos/${Date.now()}_${videoFile.name}`;
            const { error: uploadError } = await supabase.storage
                .from('training-files')
                .upload(videoPath, videoFile);

            if (uploadError) throw uploadError;
            videoUrl = videoPath;
        }

        if (pdfFile) {
            if (pdfUrl) {
                await supabase.storage.from('training-files').remove([pdfUrl]);
            }

            const pdfPath = `pdfs/${Date.now()}_${pdfFile.name}`;
            const { error: uploadError } = await supabase.storage
                .from('training-files')
                .upload(pdfPath, pdfFile);

            if (uploadError) throw uploadError;
            pdfUrl = pdfPath;
        }

        const moduleData = {
            title,
            content,
            embed_code: embedCode || null,
            video_url: videoUrl,
            pdf_url: pdfUrl,
            is_active: isActive,
            order_index: orderIndex,
            updated_at: new Date().toISOString()
        };

        if (moduleId) {
            const { error } = await supabase
                .from('training_modules')
                .update(moduleData)
                .eq('id', moduleId);

            if (error) throw error;
        } else {
            const { data: user } = await supabase.auth.getUser();
            moduleData.created_by = user.user.id;

            const { error } = await supabase
                .from('training_modules')
                .insert([moduleData]);

            if (error) throw error;
        }

        alert('Moduł został zapisany');
        window.closeEditModuleModal();
        await loadAdminModulesList();
        await loadTrainingModules();
    } catch (error) {
        console.error('[TRAINING] Error saving module:', error);
        alert('Błąd zapisywania modułu: ' + error.message);
    }
}

function setupRichTextEditor() {
    const toolbar = document.querySelector('.rich-text-toolbar');
    if (!toolbar) return;

    const editor = document.getElementById('edit-module-content');

    toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.toolbar-btn');
        if (!btn) return;

        e.preventDefault();
        const command = btn.getAttribute('data-command');
        const value = btn.getAttribute('data-value');

        editor.focus();

        if (command === 'formatBlock') {
            document.execCommand(command, false, value);
        } else {
            document.execCommand(command, false, value || null);
        }
    });
}
