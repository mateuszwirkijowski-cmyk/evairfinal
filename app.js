// ============================================
// IMPORT MODUŁÓW
// ============================================
import {
    supabase,
    getCurrentUser,
    signIn,
    signUp,
    signOut,
    updateProfile,
    updatePassword,
    uploadAvatar,
    removeAvatar,
    onAuthStateChange
} from './auth.js';

import {
    getUserConversations,
    getConversationMembers,
    createConversation,
    addMembersToConversation,
    getMessages,
    sendMessage,
    sendMediaMessage,
    subscribeToMessages,
    unsubscribeFromMessages,
    searchUsers,
    getCurrentConversationId,
    getOrCreateDirectConversation
} from './chat.js';

// BLA_BLA_AIR POST FEED - Import modułu
import {
    getPosts,
    createPost,
    deletePost,
    togglePostLike,
    getPostLikes,
    hasUserLikedPost,
    getComments,
    createComment,
    deleteComment,
    toggleCommentLike,
    hasUserLikedComment,
    getCommentLikes,
    uploadAttachment,
    subscribeToPosts,
    unsubscribeFromPosts
} from './blabla.js';

// ============================================
// INICJALIZACJA APLIKACJI
// ============================================
document.addEventListener('DOMContentLoaded', async () => {

    // Elementy DOM
    const navButtons = document.querySelectorAll('.nav-btn:not(.disabled)');
    const sections = document.querySelectorAll('.channel-section');
    const pageTitle = document.getElementById('page-title');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const mainContainer = document.querySelector('.main-container');
    const authModal = document.getElementById('auth-modal');

    // NEW: Sprawdzenie czy użytkownik jest zalogowany
    const userData = await getCurrentUser();

    if (!userData) {
        // Użytkownik nie zalogowany - pokaż modal logowania
        showAuthModal();
        hideMainApp();
    } else {
        // Użytkownik zalogowany - pokaż aplikację
        hideAuthModal();
        showMainApp();
        updateUserDisplay(userData);
    }

    // NEW: Nasłuchiwanie zmian stanu autentykacji
    onAuthStateChange(async (event, userData) => {
        console.log('[AUTH] Auth state changed:', event, userData);

        // CRITICAL: Reset app TYLKO dla SIGNED_IN i SIGNED_OUT
        // TOKEN_REFRESHED NIE może resetować aplikacji bo jest wywoływany podczas operacji!
        if (event === 'SIGNED_IN') {
            // User logged in - reset and reload
            console.log('[AUTH] User logged in - resetting app state');

            // Reset realtime subscriptions
            unsubscribeFromMessages();

            // Reset conversation state
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
            currentConversation = null;

            // Show app
            hideAuthModal();
            showMainApp();
            updateUserDisplay(userData);

            // Reload all data for new user
            await loadConversations();
            await loadPosts();

        } else if (event === 'SIGNED_OUT') {
            // User logged out - clean up
            console.log('[AUTH] User logged out - cleaning up');

            unsubscribeFromMessages();
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
            currentConversation = null;

            showAuthModal();
            hideMainApp();

        } else if (event === 'TOKEN_REFRESHED') {
            // Token refreshed - DO NOTHING, just log
            console.log('[AUTH] Token refreshed - no app reset needed');

        } else if (event === 'USER_UPDATED') {
            // User updated - update display but DON'T reset
            console.log('[AUTH] User updated - updating display');
            if (userData) {
                updateUserDisplay(userData);
            }

        } else {
            // Other events - just log
            console.log('[AUTH] Other event:', event);
        }
    });

    // ============================================
    // FUNKCJE POMOCNICZE - WIDOCZNOŚĆ APLIKACJI
    // ============================================

    function showMainApp() {
        mainContainer.style.display = 'flex';
        document.querySelector('.top-bar').style.display = 'flex';
        document.querySelector('.main-footer').style.display = 'block';
    }

    function hideMainApp() {
        mainContainer.style.display = 'none';
        document.querySelector('.top-bar').style.display = 'none';
        document.querySelector('.main-footer').style.display = 'none';
    }

    function showAuthModal() {
        authModal.classList.remove('hidden');
        authModal.style.display = 'flex';
    }

    function hideAuthModal() {
        authModal.classList.add('hidden');
        authModal.style.display = 'none';
    }

    // NEW: Aktualizacja wyświetlania danych użytkownika
    function updateUserDisplay(userData) {
        const { user, profile } = userData;
        const displayName = profile?.full_name || user.email;
        const initials = getInitials(displayName);

        // Header - nazwa i avatar
        document.getElementById('user-display-name').textContent = displayName;
        const headerAvatar = document.getElementById('user-avatar');

        if (profile?.avatar_url) {
            headerAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" class="avatar-img">`;
        } else {
            headerAvatar.textContent = initials;
        }

        // Formularz profilu
        if (profile) {
            document.getElementById('profile-full-name').value = profile.full_name || '';
            document.getElementById('profile-email').value = profile.email || '';

            // Avatar w profilu
            const avatarPreview = document.getElementById('profile-avatar-preview');
            const removeBtn = document.getElementById('remove-avatar-btn');

            if (profile.avatar_url) {
                avatarPreview.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" class="profile-avatar-img">`;
                removeBtn.style.display = 'inline-block';
            } else {
                avatarPreview.innerHTML = `<div class="avatar-placeholder">${initials}</div>`;
                removeBtn.style.display = 'none';
            }
        }
    }

    function getInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    // ============================================
    // AUTENTYKACJA - PRZEŁĄCZANIE ZAKŁADEK
    // ============================================

    const authTabs = document.querySelectorAll('.auth-tab');
    const loginContainer = document.getElementById('login-form-container');
    const registerContainer = document.getElementById('register-form-container');

    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');

            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (targetTab === 'login') {
                loginContainer.classList.add('active');
                registerContainer.classList.remove('active');
            } else {
                registerContainer.classList.add('active');
                loginContainer.classList.remove('active');
            }
        });
    });

    // ============================================
    // AUTENTYKACJA - LOGOWANIE
    // ============================================

    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logowanie...';

            await signIn(email, password);

            loginForm.reset();

        } catch (error) {
            loginError.textContent = getPolishErrorMessage(error.message);
        } finally {
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Zaloguj się';
        }
    });

    // ============================================
    // AUTENTYKACJA - REJESTRACJA
    // ============================================

    const registerForm = document.getElementById('register-form');
    const registerError = document.getElementById('register-error');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.textContent = '';

        const fullName = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm').value;

        if (password !== confirmPassword) {
            registerError.textContent = 'Hasła nie są identyczne';
            return;
        }

        if (password.length < 6) {
            registerError.textContent = 'Hasło musi mieć minimum 6 znaków';
            return;
        }

        try {
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Rejestracja...';

            await signUp(email, password, fullName);

            registerForm.reset();

            // Automatyczne przełączenie na logowanie
            authTabs[0].click();
            loginError.textContent = '';
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.textContent = 'Konto utworzone! Możesz się teraz zalogować.';
            loginContainer.insertBefore(successMsg, loginForm);
            setTimeout(() => successMsg.remove(), 5000);

        } catch (error) {
            registerError.textContent = getPolishErrorMessage(error.message);
        } finally {
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Zarejestruj się';
        }
    });

    // ============================================
    // DROPDOWN PROFILU UŻYTKOWNIKA
    // ============================================

    const userProfileBtn = document.getElementById('user-profile-btn');
    const userDropdown = document.getElementById('user-dropdown');

    userProfileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('active');
    });

    // Zamknij dropdown przy kliknięciu poza nim
    document.addEventListener('click', (e) => {
        if (!userDropdown.contains(e.target) && !userProfileBtn.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
    });

    // Obsługa kliknięcia "Mój profil"
    const profileMenuItem = userDropdown.querySelector('[data-target="profile"]');
    profileMenuItem.addEventListener('click', () => {
        const targetId = 'profile';

        navButtons.forEach(b => b.classList.remove('active'));
        sections.forEach(sec => sec.classList.remove('active'));

        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        pageTitle.textContent = 'Mój profil';
        userDropdown.classList.remove('active');

        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
        }
        window.scrollTo(0, 0);
    });

    // NEW: Obsługa wylogowania
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut();
            userDropdown.classList.remove('active');
        } catch (error) {
            alert('Błąd wylogowania: ' + error.message);
        }
    });

    // ============================================
    // EDYCJA PROFILU
    // ============================================

    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullName = document.getElementById('profile-full-name').value.trim();
        const userData = await getCurrentUser();

        if (!userData) return;

        try {
            const submitBtn = profileForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Zapisywanie...';

            await updateProfile(userData.user.id, { full_name: fullName });

            // Zaktualizuj wyświetlanie
            const updatedData = await getCurrentUser();
            updateUserDisplay(updatedData);

            alert('Profil zaktualizowany pomyślnie!');

        } catch (error) {
            alert('Błąd aktualizacji profilu: ' + error.message);
        } finally {
            const submitBtn = profileForm.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Zapisz zmiany';
        }
    });

    // ============================================
    // ZMIANA HASŁA
    // ============================================

    const changePasswordForm = document.getElementById('change-password-form');
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            alert('Hasła nie są identyczne');
            return;
        }

        if (newPassword.length < 6) {
            alert('Hasło musi mieć minimum 6 znaków');
            return;
        }

        try {
            const submitBtn = changePasswordForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Zmienianie...';

            await updatePassword(newPassword);

            changePasswordForm.reset();
            alert('Hasło zmienione pomyślnie!');

        } catch (error) {
            alert('Błąd zmiany hasła: ' + error.message);
        } finally {
            const submitBtn = changePasswordForm.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Zmień hasło';
        }
    });

    // ============================================
    // UPLOAD AVATARA
    // ============================================

    const avatarUploadInput = document.getElementById('avatar-upload');
    const removeAvatarBtn = document.getElementById('remove-avatar-btn');

    avatarUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Walidacja pliku
        if (!file.type.startsWith('image/')) {
            alert('Proszę wybrać plik obrazu');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Plik jest za duży. Maksymalny rozmiar to 5MB');
            return;
        }

        const userData = await getCurrentUser();
        if (!userData) return;

        try {
            await uploadAvatar(userData.user.id, file);

            const updatedData = await getCurrentUser();
            updateUserDisplay(updatedData);

            alert('Zdjęcie profilowe zaktualizowane!');
        } catch (error) {
            alert('Błąd uploadowania zdjęcia: ' + error.message);
        }

        avatarUploadInput.value = '';
    });

    removeAvatarBtn.addEventListener('click', async () => {
        if (!confirm('Czy na pewno chcesz usunąć zdjęcie profilowe?')) return;

        const userData = await getCurrentUser();
        if (!userData) return;

        try {
            await removeAvatar(userData.user.id);

            const updatedData = await getCurrentUser();
            updateUserDisplay(updatedData);

            alert('Zdjęcie profilowe usunięte!');
        } catch (error) {
            alert('Błąd usuwania zdjęcia: ' + error.message);
        }
    });

    // ============================================
    // NAWIGACJA MIĘDZY KANAŁAMI
    // ============================================

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            if(!targetId) return;

            if (targetId !== 'private-chat' && pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }

            // Pobierz tekst z przycisku, pomijając ikonę i badge
            const textNode = Array.from(btn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            const targetText = textNode ? textNode.textContent.trim() : "Evair";

            // Update UI
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            sections.forEach(sec => sec.classList.remove('active'));
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }

            pageTitle.textContent = targetText;

            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
            window.scrollTo(0, 0);
        });
    });

    // ============================================
    // MOBILE MENU
    // ============================================

    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // ============================================
    // MESSENGER - SYSTEM CZATU
    // ============================================

    let currentConversation = null;
    let selectedUsersForNewConv = [];

    // Elementy DOM
    const conversationsList = document.getElementById('conversations-list');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatEmptyState = document.getElementById('chat-empty-state');
    const chatActive = document.getElementById('chat-active');
    const mediaUploadBtn = document.getElementById('media-upload-btn');
    const mediaUploadInput = document.getElementById('media-upload-input');
    const newConversationBtn = document.getElementById('new-conversation-btn');

    // Załaduj konwersacje przy starcie (jeśli użytkownik zalogowany)
    async function loadConversations() {
        const userData = await getCurrentUser();
        if (!userData) return;

        try {
            const conversations = await getUserConversations(userData.user.id);
            renderConversationsList(conversations);
        } catch (error) {
            console.error('Błąd ładowania konwersacji:', error);
        }
    }

    // Renderowanie listy konwersacji
    function renderConversationsList(conversations) {
        if (!conversations || conversations.length === 0) {
            conversationsList.innerHTML = `
                <div class="empty-state">
                    <p>Brak rozmów</p>
                    <button class="btn btn-outline btn-small" onclick="document.getElementById('new-conversation-btn').click()">Rozpocznij rozmowę</button>
                </div>
            `;
            return;
        }

        conversationsList.innerHTML = conversations.map(conv => `
            <div class="conversation-item" data-conv-id="${conv.id}" onclick="openConversation('${conv.id}')">
                <div class="conv-avatar">
                    ${conv.displayAvatar ? `<img src="${conv.displayAvatar}" alt="Avatar" class="avatar-img">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#666;">${getInitials(conv.displayName || 'Rozmowa')}</div>`}
                </div>
                <div class="conv-info">
                    <div class="conv-name">${escapeHtml(conv.displayName || 'Rozmowa')}</div>
                    <div class="conv-members">${conv.is_group ? `${conv.members.length} członków` : ''}</div>
                </div>
            </div>
        `).join('');
    }

    let pollingInterval = null;
    let lastMessageId = null;

    // Otwórz konwersację
    window.openConversation = async function(conversationId) {
        try {
            const userData = await getCurrentUser();
            if (!userData) return;

            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }

            currentConversation = conversationId;

            const messages = await getMessages(conversationId);
            const members = await getConversationMembers(conversationId);
            const conversations = await getUserConversations(userData.user.id);
            const conv = conversations.find(c => c.id === conversationId);

            chatEmptyState.style.display = 'none';
            chatActive.style.display = 'flex';

            document.getElementById('chat-header-name').textContent = conv?.displayName || 'Rozmowa';
            document.getElementById('chat-header-members').textContent = conv?.is_group ? `${members.length} członków` : '';

            const headerAvatar = document.getElementById('chat-header-avatar');
            if (conv?.displayAvatar) {
                headerAvatar.innerHTML = `<img src="${conv.displayAvatar}" alt="Avatar" class="avatar-img">`;
            } else {
                headerAvatar.textContent = getInitials(conv?.displayName || 'R');
            }

            renderMessages(messages, userData.user.id);
            lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

            subscribeToMessages(conversationId, (newMessage) => {
                appendMessage(newMessage, userData.user.id);
                lastMessageId = newMessage.id;
            });

            pollingInterval = setInterval(async () => {
                try {
                    const allMessages = await getMessages(conversationId);
                    const newMessages = lastMessageId
                        ? allMessages.filter(m => m.id > lastMessageId)
                        : allMessages;

                    newMessages.forEach(msg => {
                        appendMessage(msg, userData.user.id);
                        lastMessageId = msg.id;
                    });
                } catch (error) {
                    console.error('Polling error:', error);
                }
            }, 2000);

        } catch (error) {
            console.error('Błąd otwierania konwersacji:', error);
            alert('Nie udało się otworzyć rozmowy');
        }
    };

    // Wspólna funkcja renderowania contentu wiadomości (media + tekst)
    function renderMessageContent(msg) {
        let html = '';
        if (msg.media_url) {
            const isImage = !msg.media_type || msg.media_type === 'image' || msg.media_type === 'gif';
            html += `
                <div class="msg-media">
                    ${isImage ?
                        `<img src="${msg.media_url}" alt="Załącznik" class="msg-image">` :
                        `<video src="${msg.media_url}" controls class="msg-video"></video>`
                    }
                </div>
            `;
        }
        if (msg.content) {
            html += `<div class="msg-bubble">${escapeHtml(msg.content)}</div>`;
        }
        return html;
    }

    // Renderowanie wiadomości
    function renderMessages(messages, currentUserId) {
        chatMessages.innerHTML = messages.map(msg => {
            const isSent = msg.sender_id === currentUserId;
            const senderName = msg.sender?.full_name || msg.sender?.email || 'Użytkownik';
            const avatar = msg.sender?.avatar_url;

            return `
                <div class="message ${isSent ? 'sent' : 'received'}" data-msg-id="${msg.id}">
                    ${!isSent ? `
                        <div class="msg-avatar">
                            ${avatar ? `<img src="${avatar}" alt="${senderName}">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;color:#666;">${getInitials(senderName)}</div>`}
                        </div>
                    ` : ''}
                    <div class="msg-content">
                        ${!isSent ? `<div class="msg-author">${escapeHtml(senderName)}</div>` : ''}
                        ${renderMessageContent(msg)}
                    </div>
                </div>
            `;
        }).join('');

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Dodaj nową wiadomość do UI (deduplikacja po id)
    function appendMessage(msg, currentUserId) {
        if (msg.id && chatMessages.querySelector(`[data-msg-id="${msg.id}"]`)) {
            return;
        }

        const isSent = msg.sender_id === currentUserId;
        const senderName = msg.sender?.full_name || msg.sender?.email || 'Użytkownik';
        const avatar = msg.sender?.avatar_url;

        const msgHtml = `
            <div class="message ${isSent ? 'sent' : 'received'}" data-msg-id="${msg.id}">
                ${!isSent ? `
                    <div class="msg-avatar">
                        ${avatar ? `<img src="${avatar}" alt="${senderName}">` : `<div class="avatar-initials">${getInitials(senderName)}</div>`}
                    </div>
                ` : ''}
                <div class="msg-content">
                    ${!isSent ? `<div class="msg-author">${escapeHtml(senderName)}</div>` : ''}
                    ${renderMessageContent(msg)}
                </div>
            </div>
        `;

        chatMessages.insertAdjacentHTML('beforeend', msgHtml);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Wysłanie wiadomości
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentConversation) return;

            const text = chatInput.value.trim();
            if (!text) return;

            const userData = await getCurrentUser();
            if (!userData) return;

            chatInput.value = '';

            try {
                const message = await sendMessage(currentConversation, userData.user.id, text);
                const fullMessage = {
                    ...message,
                    sender: {
                        id: userData.user.id,
                        full_name: userData.profile?.full_name,
                        email: userData.profile?.email,
                        avatar_url: userData.profile?.avatar_url
                    }
                };
                appendMessage(fullMessage, userData.user.id);
                lastMessageId = message.id;
            } catch (error) {
                console.error('Błąd wysyłania wiadomości:', error);
                alert('Nie udało się wysłać wiadomości');
            }
        });
    }

    // Upload mediów
    mediaUploadBtn.addEventListener('click', () => {
        mediaUploadInput.click();
    });

    mediaUploadInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0 || !currentConversation) return;

        const userData = await getCurrentUser();
        if (!userData) return;

        for (const file of files) {
            try {
                const message = await sendMediaMessage(currentConversation, userData.user.id, file);
                const fullMessage = {
                    ...message,
                    sender: {
                        id: userData.user.id,
                        full_name: userData.profile?.full_name,
                        email: userData.profile?.email,
                        avatar_url: userData.profile?.avatar_url
                    }
                };
                appendMessage(fullMessage, userData.user.id);
                lastMessageId = message.id;
            } catch (error) {
                console.error('Błąd wysyłania media:', error);
                alert(`Nie udało się wysłać pliku: ${file.name}`);
            }
        }

        mediaUploadInput.value = '';
    });

    // Nowa rozmowa - modal
    newConversationBtn.addEventListener('click', () => {
        document.getElementById('new-conversation-modal').classList.remove('hidden');
        selectedUsersForNewConv = [];
        document.getElementById('user-search-input').value = '';
        document.getElementById('user-search-results').innerHTML = '';
        document.getElementById('selected-users-section').style.display = 'none';
    });

    window.closeNewConversationModal = function() {
        document.getElementById('new-conversation-modal').classList.add('hidden');
    };

    // Wyszukiwanie użytkowników
    let searchTimeout;
    const userSearchInput = document.getElementById('user-search-input');
    userSearchInput.addEventListener('input', async (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            document.getElementById('user-search-results').innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(async () => {
            const userData = await getCurrentUser();
            if (!userData) return;

            try {
                const users = await searchUsers(query, userData.user.id);
                renderUserSearchResults(users);
            } catch (error) {
                console.error('Błąd wyszukiwania:', error);
            }
        }, 300);
    });

    function renderUserSearchResults(users) {
        const resultsDiv = document.getElementById('user-search-results');

        if (users.length === 0) {
            resultsDiv.innerHTML = '<p style="padding: 10px; color: #999;">Nie znaleziono użytkowników</p>';
            return;
        }

        resultsDiv.innerHTML = users.map(user => `
            <div class="user-search-item" onclick="selectUser('${user.id}', '${escapeHtml(user.full_name || user.email)}', '${user.avatar_url || ''}')">
                <div class="user-avatar">
                    ${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.full_name}">` : `<div class="avatar-initials">${getInitials(user.full_name || user.email)}</div>`}
                </div>
                <div class="user-info">
                    <div class="user-name">${escapeHtml(user.full_name || user.email)}</div>
                    <div class="user-email">${escapeHtml(user.email)}</div>
                </div>
            </div>
        `).join('');
    }

    window.selectUser = function(userId, userName, avatarUrl) {
        if (selectedUsersForNewConv.find(u => u.id === userId)) return;

        selectedUsersForNewConv.push({ id: userId, name: userName, avatar: avatarUrl });
        renderSelectedUsers();
    };

    function renderSelectedUsers() {
        const selectedSection = document.getElementById('selected-users-section');
        const selectedList = document.getElementById('selected-users-list');
        const groupNameSection = document.getElementById('group-name-section');

        selectedSection.style.display = 'block';

        selectedList.innerHTML = selectedUsersForNewConv.map((user, index) => `
            <div class="selected-user-chip">
                <span>${escapeHtml(user.name)}</span>
                <button onclick="removeSelectedUser(${index})" class="remove-chip">×</button>
            </div>
        `).join('');

        // Pokaż pole nazwy grupy jeśli więcej niż 1 osoba
        groupNameSection.style.display = selectedUsersForNewConv.length > 1 ? 'block' : 'none';
    }

    window.removeSelectedUser = function(index) {
        selectedUsersForNewConv.splice(index, 1);
        if (selectedUsersForNewConv.length === 0) {
            document.getElementById('selected-users-section').style.display = 'none';
        } else {
            renderSelectedUsers();
        }
    };

    // Rozpocznij rozmowę
    document.getElementById('start-conversation-btn').addEventListener('click', async () => {
        if (selectedUsersForNewConv.length === 0) return;

        const userData = await getCurrentUser();
        if (!userData) return;

        try {
            const isGroup = selectedUsersForNewConv.length > 1;
            const groupName = isGroup ? document.getElementById('group-name-input').value.trim() || null : null;
            const memberIds = selectedUsersForNewConv.map(u => u.id);

            const conversation = await createConversation(userData.user.id, memberIds, isGroup, groupName);

            closeNewConversationModal();
            await loadConversations();
            openConversation(conversation.id);

        } catch (error) {
            console.error('Błąd tworzenia rozmowy:', error);
            alert('Nie udało się utworzyć rozmowy');
        }
    });

    // NEW: DM Popover - elements and state
    const dmPopover = document.getElementById('dm-popover');
    const dmPopoverUsername = document.getElementById('dm-popover-username');
    const dmPopoverConfirm = document.getElementById('dm-popover-confirm');
    const dmPopoverCancel = document.getElementById('dm-popover-cancel');
    let dmPopoverTargetProfileId = null;
    let dmPopoverTargetUsername = null;

    // NEW: show DM popover near clicked element
    function showDMPopover(event, profileId, username, isSelf = false) {
        console.log('🟢 showDMPopover CALLED', { profileId, username, isSelf });

        // FIX: show brief "To Ty" message if clicking on yourself
        if (isSelf) {
            console.log('🟢 Showing "To Ty" message');
            const rect = event.target.getBoundingClientRect();
            dmPopoverUsername.textContent = 'To Ty';
            dmPopover.style.left = `${rect.left}px`;
            dmPopover.style.top = `${rect.bottom + 5}px`;
            dmPopover.classList.remove('hidden');
            dmPopoverConfirm.style.display = 'none';
            dmPopoverCancel.textContent = 'OK';
            setTimeout(() => {
                dmPopover.classList.add('hidden');
                dmPopoverConfirm.style.display = 'inline-block';
                dmPopoverCancel.textContent = 'Anuluj';
            }, 1500);
            return;
        }

        console.log('🟢 Showing DM popover for:', username);
        dmPopoverTargetProfileId = profileId;
        dmPopoverTargetUsername = username;
        dmPopoverUsername.textContent = username;

        // Position popover near clicked element
        const rect = event.target.getBoundingClientRect();
        console.log('🟢 Popover position:', { left: rect.left, top: rect.bottom + 5 });
        dmPopover.style.left = `${rect.left}px`;
        dmPopover.style.top = `${rect.bottom + 5}px`;
        dmPopover.classList.remove('hidden');
        console.log('🟢 Popover hidden class removed, should be visible now');
    }

    // NEW: hide DM popover
    function hideDMPopover() {
        dmPopover.classList.add('hidden');
        dmPopoverTargetProfileId = null;
        dmPopoverTargetUsername = null;
    }

    // NEW: DM popover confirm button
    dmPopoverConfirm.addEventListener('click', async () => {
        console.log('🟢 DM Popover CONFIRM clicked');

        // CRITICAL: Capture profileId BEFORE hiding popover (which resets it to null)
        const targetProfileId = dmPopoverTargetProfileId;
        const targetUsername = dmPopoverTargetUsername;

        if (!targetProfileId) {
            console.log('🔴 BLOCKED: No target profile ID');
            alert('Nie udało się odczytać użytkownika. Spróbuj ponownie.');
            hideDMPopover();
            return;
        }

        console.log('🔥 Starting chat with:', targetProfileId, targetUsername);
        hideDMPopover();

        const userData = await getCurrentUser();
        console.log('🔥 Current user:', userData);

        if (!userData) {
            console.log('🔴 BLOCKED: User not logged in');
            alert('Musisz być zalogowany, aby rozpocząć rozmowę.');
            return;
        }

        try {
            console.log('🔥 Calling getOrCreateDirectConversation with:', {
                currentUserId: userData.user.id,
                otherUserId: targetProfileId
            });

            // FIX: open DM from BlaBlaAir via popover
            const conversation = await getOrCreateDirectConversation(userData.user.id, targetProfileId);
            console.log('🟢 Conversation created/found:', conversation);

            // Reload conversations list
            console.log('🔥 Loading conversations...');
            await loadConversations();

            // FIX: navigate to Evair -> Rozmowy
            const privateChatNavBtn = document.querySelector('.nav-btn[data-target="private-chat"]');
            console.log('🔥 Private chat nav button:', privateChatNavBtn);

            if (privateChatNavBtn) {
                privateChatNavBtn.click();
            }

            // Open the conversation
            setTimeout(() => {
                console.log('🔥 Opening conversation:', conversation.id);
                openConversation(conversation.id);
            }, 100);

        } catch (error) {
            console.error('🔴 DM POPOVER Error starting conversation:', error);
            console.error('🔴 Error details:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            alert('Nie udało się rozpocząć rozmowy');
        }
    });

    // NEW: DM popover cancel button
    dmPopoverCancel.addEventListener('click', () => {
        hideDMPopover();
    });

    // NEW: close popover when clicking outside
    document.addEventListener('click', (e) => {
        if (!dmPopover.classList.contains('hidden') &&
            !dmPopover.contains(e.target) &&
            !e.target.classList.contains('post-author-name') &&
            !e.target.classList.contains('comment-author')) {
            hideDMPopover();
        }
    });

    // NEW: start direct chat from BlaBlaAir - kliknięcie w użytkownika
    window.startDirectChatWithUser = async function(profileId, event) {
        console.log('🔥 startDirectChatWithUser CALLED', { profileId, event });

        const userData = await getCurrentUser();
        console.log('🔥 userData:', userData);

        if (!userData) {
            console.log('🔴 BLOCKED: User not logged in');
            return;
        }

        // FIX: check if clicking on yourself
        const isSelf = profileId === userData.user.id;
        console.log('🔥 isSelf:', isSelf, 'currentUserId:', userData.user.id, 'clickedProfileId:', profileId);

        // FIX: fetch user profile to get username for popover
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', profileId)
                .maybeSingle();

            console.log('🔥 profile fetch result:', { profile, error });

            if (error) throw error;

            const username = profile?.full_name || profile?.email || 'Użytkownik';
            console.log('🔥 Showing popover for:', username);

            // Show popover (with isSelf flag)
            showDMPopover(event, profileId, username, isSelf);

        } catch (error) {
            console.error('🔴 DM Error fetching profile:', error);
        }
    };

    // Załaduj konwersacje po zalogowaniu
    if (userData) {
        loadConversations();
    }

    // ============================================
    // FORMULARZ KONTAKTOWY
    // ============================================

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // TODO: backend - wysłać e-mail przez API
            alert('Wiadomość wysłana! (Symulacja)');
            contactForm.reset();
        });
    }

    // ============================================
    // REGULAMIN MODAL
    // ============================================

    const regLink = document.getElementById('open-regulations');
    const regModal = document.getElementById('regulations-modal');
    if(regLink && regModal) {
        regLink.addEventListener('click', (e) => {
            e.preventDefault();
            regModal.classList.remove('hidden');
        });
    }
    window.closeRegulations = function() {
        if(regModal) regModal.classList.add('hidden');
    };

    // ============================================
    // MATERIAŁY SZKOLENIOWE
    // ============================================

    const modulesData = {
        1: {
            title: "Moduł 1: Podstawy",
            desc: "Wprowadzenie wideo do kursu.",
            contentHtml: `
                <div class="embedded-media">
                    <p>▶ Tu byłby odtwarzacz wideo (MP4)</p>
                </div>
                <h4>Dokumentacja:</h4>
                <div class="embedded-doc">
                    <iframe src="about:blank" style="width:100%; height:100%; border:none;"></iframe>
                    <div style="position:absolute; top:50%; width:100%; text-align:center; pointer-events:none;">Podgląd dokumentu PDF</div>
                </div>
            `
        },
        2: {
            title: "Moduł 2: Bezpieczeństwo",
            desc: "Nagranie o bezpieczeństwie.",
            contentHtml: `
                <div class="embedded-media" style="background: #222;">
                    <p>▶ Wideo: Bezpieczeństwo (20 min)</p>
                </div>
                <h4>Checklista:</h4>
                <div class="embedded-doc">
                     <div style="padding:20px; text-align:center; color:#777;">PDF z checklistą.</div>
                </div>
            `
        },
        3: {
            title: "Moduł 3: Rezerwacje",
            desc: "Instruktaż kalendarza.",
            contentHtml: `
                <div class="embedded-media" style="background: #333;">
                    <p>▶ Wideo: System rezerwacji</p>
                </div>
            `
        }
    };

    window.showModule = function(moduleId) {
        const buttons = document.querySelectorAll('.training-btn');
        buttons.forEach((btn, index) => {
            if (index + 1 === moduleId) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        const data = modulesData[moduleId];
        const contentDiv = document.getElementById('module-content');
        if (data) {
            contentDiv.innerHTML = `<h2>${data.title}</h2><p>${data.desc}</p><hr style="margin: 20px 0;">${data.contentHtml}`;
        }
    };
    showModule(1);

    // ============================================
    // LIGHTBOX GALERII
    // ============================================

    window.openLightbox = function(captionText, color) {
        const lightbox = document.getElementById('lightbox');
        const placeholder = document.getElementById('lightbox-img-placeholder');
        document.getElementById('lightbox-caption').textContent = captionText;
        placeholder.style.backgroundColor = color;
        placeholder.textContent = "Obrazek";
        lightbox.classList.remove('hidden');
    };

    window.closeLightbox = function() {
        document.getElementById('lightbox').classList.add('hidden');
    };

    // ============================================
    // FUNKCJE POMOCNICZE
    // ============================================

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    function getPolishErrorMessage(errorMsg) {
        const errorMap = {
            'Invalid login credentials': 'Nieprawidłowy e-mail lub hasło',
            'Email not confirmed': 'E-mail nie został potwierdzony',
            'User already registered': 'Użytkownik o tym adresie e-mail już istnieje',
            'Password should be at least 6 characters': 'Hasło musi mieć minimum 6 znaków',
            'Unable to validate email address': 'Nieprawidłowy adres e-mail',
            'Signup requires a valid password': 'Wymagane jest prawidłowe hasło'
        };

        for (const [eng, pl] of Object.entries(errorMap)) {
            if (errorMsg.includes(eng)) return pl;
        }

        return 'Wystąpił błąd. Spróbuj ponownie.';
    }

    // Formatowanie czasu wiadomości
    function formatMessageTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Teraz';
        if (diffMins < 60) return `${diffMins} min temu`;
        if (diffHours < 24) return `${diffHours}godz temu`;
        if (diffDays === 1) return 'Wczoraj';
        if (diffDays < 7) return `${diffDays} dni temu`;

        return date.toLocaleDateString('pl-PL', {
            day: 'numeric',
            month: 'short',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }

    // ============================================
    // BLA_BLA_AIR POST FEED - SYSTEM POSTÓW
    // ============================================

    let selectedAttachments = []; // Tymczasowa lista załączników
    let currentPostForLikes = null; // ID posta, dla którego wyświetlamy likes
    let currentCommentForLikes = null; // ID komentarza
    let openCommentsPostId = null; // ID posta z otwartymi komentarzami

    // Elementy DOM
    const createPostForm = document.getElementById('create-post-form');
    const postContentInput = document.getElementById('post-content-input');
    const feedList = document.getElementById('feed-list');
    const attachmentsPreview = document.getElementById('attachments-preview');

    // Przyciski załączników
    const addImageBtn = document.getElementById('add-image-btn');
    const addGifBtn = document.getElementById('add-gif-btn');
    const addVideoBtn = document.getElementById('add-video-btn');
    const attachmentImageInput = document.getElementById('attachment-image-input');
    const attachmentGifInput = document.getElementById('attachment-gif-input');
    const attachmentVideoInput = document.getElementById('attachment-video-input');

    // ============================================
    // TWORZENIE POSTA
    // ============================================

    // Przyciski załączników - otwórz file input
    if (addImageBtn) {
        addImageBtn.addEventListener('click', () => attachmentImageInput.click());
        addGifBtn.addEventListener('click', () => attachmentGifInput.click());
        addVideoBtn.addEventListener('click', () => attachmentVideoInput.click());
    }

    // Obsługa wyboru plików
    function handleFileSelection(files, type) {
        Array.from(files).forEach(file => {
            selectedAttachments.push({ file, type });
        });
        renderAttachmentsPreview();
    }

    if (attachmentImageInput) {
        attachmentImageInput.addEventListener('change', (e) => {
            handleFileSelection(e.target.files, 'image');
            e.target.value = '';
        });

        attachmentGifInput.addEventListener('change', (e) => {
            handleFileSelection(e.target.files, 'gif');
            e.target.value = '';
        });

        attachmentVideoInput.addEventListener('change', (e) => {
            handleFileSelection(e.target.files, 'video');
            e.target.value = '';
        });
    }

    // Renderowanie podglądu załączników
    function renderAttachmentsPreview() {
        if (selectedAttachments.length === 0) {
            attachmentsPreview.innerHTML = '';
            attachmentsPreview.style.display = 'none';
            return;
        }

        attachmentsPreview.style.display = 'grid';
        attachmentsPreview.innerHTML = selectedAttachments.map((att, index) => {
            const file = att.file;
            const previewUrl = URL.createObjectURL(file);

            if (att.type === 'video') {
                return `
                    <div class="attachment-preview-item">
                        <video src="${previewUrl}" class="attachment-preview-video"></video>
                        <button type="button" class="remove-attachment-btn" onclick="removeAttachment(${index})">✕</button>
                        <div class="attachment-name">${escapeHtml(file.name)}</div>
                    </div>
                `;
            } else {
                return `
                    <div class="attachment-preview-item">
                        <img src="${previewUrl}" alt="${file.name}" class="attachment-preview-img">
                        <button type="button" class="remove-attachment-btn" onclick="removeAttachment(${index})">✕</button>
                    </div>
                `;
            }
        }).join('');
    }

    // Usunięcie załącznika
    window.removeAttachment = function(index) {
        selectedAttachments.splice(index, 1);
        renderAttachmentsPreview();
    };

    // Wysłanie posta
    if (createPostForm) {
        createPostForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const content = postContentInput.value.trim();
            if (!content) {
                alert('Treść posta nie może być pusta');
                return;
            }

            const userData = await getCurrentUser();
            if (!userData) return;

            try {
                const submitBtn = createPostForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Publikowanie...';

                // Upload załączników jeśli są
                let uploadedAttachments = [];
                if (selectedAttachments.length > 0) {
                    // Najpierw utwórz post aby mieć ID
                    const tempPost = await createPost(userData.user.id, content, []);

                    // Następnie uploaduj pliki
                    uploadedAttachments = await Promise.all(
                        selectedAttachments.map(async (att) => {
                            return await uploadAttachment(tempPost.id, att.file);
                        })
                    );

                    // Dodaj załączniki do bazy
                    if (uploadedAttachments.length > 0) {
                        const attachmentsData = uploadedAttachments.map(att => ({
                            post_id: tempPost.id,
                            type: att.type,
                            url: att.url,
                            filename: att.filename
                        }));

                        const { error: attachError } = await supabase
                            .from('blabla_post_attachments')
                            .insert(attachmentsData);

                        if (attachError) throw new Error(attachError.message);
                    }

                    // Wyczyść formularz
                    postContentInput.value = '';
                    selectedAttachments = [];
                    renderAttachmentsPreview();

                    // Odśwież listę postów
                    await loadPosts();

                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Opublikuj';
                    return;
                }

                // Utwórz post
                await createPost(userData.user.id, content, uploadedAttachments);

                // Wyczyść formularz
                postContentInput.value = '';
                selectedAttachments = [];
                renderAttachmentsPreview();

                // Odśwież listę postów
                await loadPosts();

                submitBtn.disabled = false;
                submitBtn.textContent = 'Opublikuj';

            } catch (error) {
                console.error('Błąd tworzenia posta:', error);
                alert('Nie udało się opublikować posta: ' + error.message);

                const submitBtn = createPostForm.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Opublikuj';
            }
        });
    }

    // ============================================
    // WYŚWIETLANIE POSTÓW
    // ============================================

    // Załaduj posty
    async function loadPosts() {
        const userData = await getCurrentUser();
        if (!userData) return;

        try {
            const posts = await getPosts(50);
            await renderPosts(posts, userData.user.id);
        } catch (error) {
            console.error('Błąd ładowania postów:', error);
        }
    }

    // Renderowanie postów
    async function renderPosts(posts, currentUserId) {
        if (posts.length === 0) {
            feedList.innerHTML = '<div class="empty-state-feed"><p>Brak postów. Bądź pierwszą osobą, która coś napisze!</p></div>';
            return;
        }

        const postsHtml = await Promise.all(posts.map(async (post) => {
            const isAuthor = post.author_id === currentUserId;
            const authorName = post.author?.full_name || post.author?.email || 'Użytkownik';
            const avatar = post.author?.avatar_url;
            const timeStr = formatMessageTime(post.created_at);
            const hasLiked = await hasUserLikedPost(post.id, currentUserId);

            return `
                <div class="card post-card" data-post-id="${post.id}">
                    <div class="post-header">
                        <div class="post-author-info">
                            <div class="post-avatar">
                                ${avatar ? `<img src="${avatar}" alt="${authorName}">` : `<div class="avatar-initials">${getInitials(authorName)}</div>`}
                            </div>
                            <div>
                                <div class="post-author-name" style="cursor: pointer;" onclick="startDirectChatWithUser('${post.author_id}', event)" title="Kliknij, aby rozpocząć rozmowę">${escapeHtml(authorName)}</div>
                                <div class="post-date">${timeStr}</div>
                            </div>
                        </div>
                        ${isAuthor ? `
                            <button class="btn-text btn-delete-post" onclick="deletePostById('${post.id}')">Usuń</button>
                        ` : ''}
                    </div>

                    <div class="post-content">${escapeHtml(post.content)}</div>

                    ${post.attachments && post.attachments.length > 0 ? `
                        <div class="post-attachments">
                            ${post.attachments.map(att => {
                                if (att.type === 'video') {
                                    return `<video src="${att.url}" controls class="post-attachment-video"></video>`;
                                } else {
                                    return `<img src="${att.url}" alt="${att.filename}" class="post-attachment-img" onclick="openImageModal('${att.url}')">`;
                                }
                            }).join('')}
                        </div>
                    ` : ''}

                    <div class="post-actions">
                        <button class="btn-like ${hasLiked ? 'liked' : ''}" onclick="toggleLikePost('${post.id}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="${hasLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            <span class="likes-count" onclick="showPostLikes('${post.id}', event)">${post.likes_count > 0 ? post.likes_count : ''}</span>
                        </button>
                        <button class="btn-comment" onclick="toggleComments('${post.id}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            Komentarze (${post.comments_count})
                        </button>
                    </div>

                    <!-- Sekcja komentarzy (domyślnie ukryta) -->
                    <div class="post-comments-section" id="comments-${post.id}" style="display: none;">
                        <div class="comments-list" id="comments-list-${post.id}">
                            <!-- Komentarze będą tutaj -->
                        </div>
                        <div class="add-comment-form">
                            <textarea class="comment-input" id="comment-input-${post.id}" placeholder="Dodaj komentarz..." rows="1"></textarea>
                            <button class="btn btn-primary btn-small" onclick="addComment('${post.id}')">Dodaj</button>
                        </div>
                    </div>
                </div>
            `;
        }));

        feedList.innerHTML = postsHtml.join('');
    }

    // ============================================
    // AKCJE POSTÓW
    // ============================================

    // Toggle like posta
    window.toggleLikePost = async function(postId) {
        const userData = await getCurrentUser();
        if (!userData) return;

        try {
            const result = await togglePostLike(postId, userData.user.id);

            // Zaktualizuj UI
            const postCard = document.querySelector(`[data-post-id="${postId}"]`);
            const likeBtn = postCard.querySelector('.btn-like');
            const likesCountSpan = likeBtn.querySelector('.likes-count');
            const svg = likeBtn.querySelector('svg path');

            if (result.liked) {
                likeBtn.classList.add('liked');
                svg.setAttribute('fill', 'currentColor');
            } else {
                likeBtn.classList.remove('liked');
                svg.setAttribute('fill', 'none');
            }

            // Odśwież count
            const posts = await getPosts(50);
            const post = posts.find(p => p.id === postId);
            if (post) {
                likesCountSpan.textContent = post.likes_count > 0 ? post.likes_count : '';
            }

        } catch (error) {
            console.error('Błąd toggle like:', error);
        }
    };

    // Pokaż listę osób, które polubiły post
    window.showPostLikes = async function(postId, event) {
        event.stopPropagation();

        try {
            const likes = await getPostLikes(postId);

            if (likes.length === 0) {
                return;
            }

            const likesList = document.getElementById('likes-list');
            likesList.innerHTML = likes.map(like => {
                const userName = like.user?.full_name || like.user?.email || 'Użytkownik';
                const avatar = like.user?.avatar_url;

                return `
                    <div class="like-item">
                        <div class="like-avatar">
                            ${avatar ? `<img src="${avatar}" alt="${userName}">` : `<div class="avatar-initials">${getInitials(userName)}</div>`}
                        </div>
                        <div class="like-name">${escapeHtml(userName)}</div>
                    </div>
                `;
            }).join('');

            document.getElementById('likes-modal').classList.remove('hidden');
        } catch (error) {
            console.error('Błąd pobierania likes:', error);
        }
    };

    // NEW: Pokaż listę osób, które polubiły komentarz
    window.showCommentLikes = async function(commentId, event) {
        event.stopPropagation();

        try {
            const likes = await getCommentLikes(commentId);

            if (likes.length === 0) {
                return;
            }

            const likesList = document.getElementById('likes-list');
            likesList.innerHTML = likes.map(like => {
                const userName = like.user?.full_name || like.user?.email || 'Użytkownik';
                const avatar = like.user?.avatar_url;

                return `
                    <div class="like-item">
                        <div class="like-avatar">
                            ${avatar ? `<img src="${avatar}" alt="${userName}">` : `<div class="avatar-initials">${getInitials(userName)}</div>`}
                        </div>
                        <div class="like-name">${escapeHtml(userName)}</div>
                    </div>
                `;
            }).join('');

            document.getElementById('likes-modal').classList.remove('hidden');
        } catch (error) {
            console.error('Błąd pobierania likes komentarza:', error);
        }
    };

    // Zamknij modal likes
    window.closeLikesModal = function() {
        document.getElementById('likes-modal').classList.add('hidden');
    };

    // Usuń post
    window.deletePostById = async function(postId) {
        if (!confirm('Czy na pewno chcesz usunąć ten post?')) return;

        try {
            await deletePost(postId);
            await loadPosts();
        } catch (error) {
            console.error('Błąd usuwania posta:', error);
            alert('Nie udało się usunąć posta');
        }
    };

    // ============================================
    // KOMENTARZE
    // ============================================

    // Toggle wyświetlania komentarzy
    window.toggleComments = async function(postId) {
        const commentsSection = document.getElementById(`comments-${postId}`);

        if (commentsSection.style.display === 'none') {
            // Pokaż komentarze
            commentsSection.style.display = 'block';
            openCommentsPostId = postId;
            await loadComments(postId);
        } else {
            // Ukryj komentarze
            commentsSection.style.display = 'none';
            openCommentsPostId = null;
        }
    };

    // Załaduj komentarze
    async function loadComments(postId) {
        const userData = await getCurrentUser();
        if (!userData) return;

        try {
            const comments = await getComments(postId);
            await renderComments(postId, comments, userData.user.id);
        } catch (error) {
            console.error('Błąd ładowania komentarzy:', error);
        }
    }

    // Renderowanie komentarzy
    async function renderComments(postId, comments, currentUserId) {
        const commentsList = document.getElementById(`comments-list-${postId}`);

        if (comments.length === 0) {
            commentsList.innerHTML = '<p class="no-comments">Brak komentarzy. Bądź pierwszą osobą, która skomentuje!</p>';
            return;
        }

        const commentsHtml = await Promise.all(comments.map(async (comment) => {
            const isAuthor = comment.author_id === currentUserId;
            const authorName = comment.author?.full_name || comment.author?.email || 'Użytkownik';
            const avatar = comment.author?.avatar_url;
            const timeStr = formatMessageTime(comment.created_at);
            const hasLiked = await hasUserLikedComment(comment.id, currentUserId);

            return `
                <div class="comment-item" data-comment-id="${comment.id}">
                    <div class="comment-avatar">
                        ${avatar ? `<img src="${avatar}" alt="${authorName}">` : `<div class="avatar-initials">${getInitials(authorName)}</div>`}
                    </div>
                    <div class="comment-content-wrapper">
                        <div class="comment-bubble">
                            <div class="comment-author" style="cursor: pointer;" onclick="startDirectChatWithUser('${comment.author_id}', event)" title="Kliknij, aby rozpocząć rozmowę">${escapeHtml(authorName)}</div>
                            <div class="comment-text">${escapeHtml(comment.content)}</div>
                        </div>
                        <div class="comment-meta">
                            <span class="comment-time">${timeStr}</span>
                            <button class="btn-comment-like ${hasLiked ? 'liked' : ''}" onclick="toggleLikeComment('${comment.id}', '${postId}')">
                                Lubię to ${comment.likes_count > 0 ? `<span style="cursor: pointer;" onclick="event.stopPropagation(); showCommentLikes('${comment.id}', event);" title="Zobacz kto polubił">(${comment.likes_count})</span>` : ''}
                            </button>
                            ${isAuthor ? `<button class="btn-delete-comment" onclick="deleteCommentById('${comment.id}', '${postId}')">Usuń</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }));

        commentsList.innerHTML = commentsHtml.join('');
    }

    // Dodaj komentarz
    window.addComment = async function(postId) {
        const userData = await getCurrentUser();
        if (!userData) return;

        const input = document.getElementById(`comment-input-${postId}`);
        const content = input.value.trim();

        if (!content) {
            alert('Treść komentarza nie może być pusta');
            return;
        }

        try {
            await createComment(postId, userData.user.id, content);
            input.value = '';
            await loadComments(postId);

            // Odśwież licznik komentarzy w poście
            await loadPosts();

            // Otwórz ponownie komentarze
            const commentsSection = document.getElementById(`comments-${postId}`);
            commentsSection.style.display = 'block';
            await loadComments(postId);

        } catch (error) {
            console.error('Błąd dodawania komentarza:', error);
            alert('Nie udało się dodać komentarza');
        }
    };

    // Toggle like komentarza
    window.toggleLikeComment = async function(commentId, postId) {
        const userData = await getCurrentUser();
        if (!userData) return;

        try {
            await toggleCommentLike(commentId, userData.user.id);
            await loadComments(postId);
        } catch (error) {
            console.error('Błąd toggle like komentarza:', error);
        }
    };

    // Usuń komentarz
    window.deleteCommentById = async function(commentId, postId) {
        if (!confirm('Czy na pewno chcesz usunąć ten komentarz?')) return;

        try {
            await deleteComment(commentId);
            await loadComments(postId);
            await loadPosts(); // Odśwież licznik

            // Otwórz ponownie komentarze
            const commentsSection = document.getElementById(`comments-${postId}`);
            commentsSection.style.display = 'block';
            await loadComments(postId);

        } catch (error) {
            console.error('Błąd usuwania komentarza:', error);
            alert('Nie udało się usunąć komentarza');
        }
    };

    // ============================================
    // MODAL POWIĘKSZENIA ZDJĘCIA
    // ============================================

    window.openImageModal = function(imageUrl) {
        const lightbox = document.getElementById('lightbox');
        const placeholder = document.getElementById('lightbox-img-placeholder');
        placeholder.innerHTML = `<img src="${imageUrl}" style="max-width: 100%; max-height: 80vh; object-fit: contain;">`;
        lightbox.classList.remove('hidden');
    };

    // ============================================
    // INICJALIZACJA BLABLAAIR
    // ============================================

    // Załaduj posty gdy użytkownik wchodzi do sekcji BlaBlaAir
    const feedNavButtons = document.querySelectorAll('.nav-btn');
    feedNavButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const target = btn.getAttribute('data-target');
            if (target === 'feed') {
                const userData = await getCurrentUser();
                if (userData) {
                    await loadPosts();
                }
            }
        });
    });

    // Załaduj posty przy starcie jeśli użytkownik zalogowany
    (async () => {
        const userData = await getCurrentUser();
        if (userData) {
            await loadPosts();
        }
    })();

});
