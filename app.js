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
    updatePost,
    togglePostLike,
    getPostLikes,
    hasUserLikedPost,
    getComments,
    createComment,
    deleteComment,
    updateComment,
    toggleCommentLike,
    hasUserLikedComment,
    getCommentLikes,
    uploadAttachment,
    subscribeToPosts,
    unsubscribeFromPosts
} from './blabla.js';

// ============================================
// ADMIN FUNCTIONS
// ============================================

let isAdminUser = false;
let uiTextsCache = {};
let currentUserId = null;

// Check if current user is admin - ROBUST WITH FALLBACK
function checkIfAdmin(userData) {
    // Handle null/undefined userData
    if (!userData) {
        return false;
    }

    // Primary check: role field
    if (userData?.profile?.role === 'admin') {
        return true;
    }

    // Fallback: Check email if role is missing or not admin
    const userEmail = userData?.user?.email || userData?.profile?.email || '';
    if (userEmail === 'wirkijowski.mateusz@gmail.com') {
        console.log('[AUTH] Admin access granted via email fallback');
        return true;
    }

    return false;
}

// Get UI texts from database
async function getUiTexts() {
    const { data, error } = await supabase
        .from('ui_texts')
        .select('*');

    if (error) {
        console.error('Error fetching UI texts:', error);
        return {};
    }

    const texts = {};
    data.forEach(item => {
        texts[item.element_id] = item.content;
    });
    return texts;
}

// Update UI text in database
async function updateUiText(elementId, newText) {
    const { error } = await supabase
        .from('ui_texts')
        .upsert({
            element_id: elementId,
            content: newText
        }, {
            onConflict: 'element_id'
        });

    if (error) {
        console.error('Error updating UI text:', error);
        return false;
    }

    uiTextsCache[elementId] = newText;
    return true;
}

// Show admin mode indicator (disabled - no longer showing badge)
function showAdminIndicator() {
    // Badge disabled per user request
}

// Hide admin mode indicator
function hideAdminIndicator() {
    const badge = document.querySelector('.admin-badge');
    if (badge) badge.remove();
}

// Apply UI texts to navigation buttons
function applyUiTexts() {
    const navButtons = {
        'feed': 'channel_feed',
        'gallery': 'channel_gallery',
        'blabla': 'channel_blabla',
        'events': 'channel_events',
        'training': 'channel_training'
    };

    Object.keys(navButtons).forEach(target => {
        const button = document.querySelector(`.nav-btn[data-target="${target}"]`);
        const elementId = navButtons[target];

        if (button && uiTextsCache[elementId]) {
            const textElement = button.querySelector('.nav-text');
            if (textElement) {
                textElement.textContent = uiTextsCache[elementId];
            }
        }
    });
}

// Enable channel name editing for admins
function enableChannelEditing() {
    const navButtons = {
        'feed': 'channel_feed',
        'gallery': 'channel_gallery',
        'blabla': 'channel_blabla',
        'events': 'channel_events',
        'training': 'channel_training'
    };

    Object.keys(navButtons).forEach(target => {
        const button = document.querySelector(`.nav-btn[data-target="${target}"]`);
        const elementId = navButtons[target];

        if (button) {
            const textElement = button.querySelector('.nav-text');
            if (textElement) {
                textElement.contentEditable = 'true';
                textElement.style.cursor = 'text';
                textElement.title = 'Kliknij aby edytować (tylko dla admina)';

                textElement.addEventListener('blur', async () => {
                    const newText = textElement.textContent.trim();
                    if (newText && newText !== uiTextsCache[elementId]) {
                        const success = await updateUiText(elementId, newText);
                        if (success) {
                            console.log(`[ADMIN] Updated ${elementId} to: ${newText}`);
                        }
                    }
                });

                textElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        textElement.blur();
                    }
                });
            }
        }
    });
}

// ============================================
// USER MANAGEMENT FUNCTIONS (ADMIN)
// ============================================

// Fetch all users from database
async function fetchUsers() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }

    return data;
}

// Update user role
async function updateUserRole(userId, newRole) {
    const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

    if (error) {
        console.error('Error updating user role:', error);
        return false;
    }

    console.log(`[ADMIN] Updated user ${userId} role to: ${newRole}`);
    return true;
}

// Send password reset email
async function handlePasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
    });

    if (error) {
        console.error('Error sending password reset:', error);
        alert('Błąd: Nie udało się wysłać linku do resetowania hasła');
        return false;
    }

    alert('Link do resetu hasła wysłany na adres: ' + email);
    return true;
}

// Open user management modal
async function openUserManagementModal() {
    const modal = document.getElementById('user-management-modal');
    const tbody = document.getElementById('users-table-body');

    modal.classList.remove('hidden');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Ładowanie...</td></tr>';

    const users = await fetchUsers();

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Brak użytkowników</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const isCurrentUser = user.id === currentUserId;
        const avatarUrl = user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.full_name || user.email)}`;

        return `
            <tr>
                <td>
                    <div class="user-info-cell">
                        <img src="${avatarUrl}" alt="${user.full_name || user.email}" class="user-avatar-tiny">
                        <div class="user-details">
                            <div class="user-full-name">${user.full_name || 'Bez nazwy'}</div>
                            <div class="user-email">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <select
                        class="role-select"
                        data-user-id="${user.id}"
                        ${isCurrentUser ? 'disabled' : ''}
                        onchange="handleRoleChange('${user.id}', this.value)">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Użytkownik</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator</option>
                    </select>
                    ${isCurrentUser ? '<span class="current-user-badge">(Ty)</span>' : ''}
                </td>
                <td>
                    <button
                        class="btn-reset-password"
                        ${isCurrentUser ? 'disabled' : ''}
                        onclick="handlePasswordReset('${user.email}')">
                        Resetuj hasło
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Close user management modal
window.closeUserManagementModal = function() {
    const modal = document.getElementById('user-management-modal');
    modal.classList.add('hidden');
};

// Handle role change
window.handleRoleChange = async function(userId, newRole) {
    const success = await updateUserRole(userId, newRole);
    if (success) {
        console.log(`[ADMIN] Role changed for user ${userId} to ${newRole}`);
    } else {
        await openUserManagementModal();
    }
};

// Show admin user management button
function showAdminUserManagementButton() {
    const btn = document.getElementById('btn-admin-users');
    if (btn) {
        btn.style.display = 'flex';
        btn.addEventListener('click', openUserManagementModal);
    }
}

// Hide admin user management button
function hideAdminUserManagementButton() {
    const btn = document.getElementById('btn-admin-users');
    if (btn) {
        btn.style.display = 'none';
    }
}

// ============================================
// EVENTS SYSTEM
// ============================================

// Fetch all events with user participation status
async function fetchEvents() {
    try {
        const { data: events, error } = await supabase
            .from('events')
            .select('*')
            .order('event_date', { ascending: true });

        if (error) throw error;

        // For each event, check if current user is registered
        if (currentUserId) {
            const eventsWithStatus = await Promise.all(
                events.map(async (event) => {
                    const { data: participation } = await supabase
                        .from('event_participants')
                        .select('id')
                        .eq('event_id', event.id)
                        .eq('user_id', currentUserId)
                        .maybeSingle();

                    return {
                        ...event,
                        isUserRegistered: !!participation
                    };
                })
            );
            return eventsWithStatus;
        }

        return events.map(event => ({ ...event, isUserRegistered: false }));
    } catch (error) {
        console.error('Error fetching events:', error);
        return [];
    }
}

// Format event date to readable format
function formatEventDate(dateString) {
    const date = new Date(dateString);
    const months = ['STY', 'LUT', 'MAR', 'KWI', 'MAJ', 'CZE', 'LIP', 'SIE', 'WRZ', 'PAŹ', 'LIS', 'GRU'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return { day, month, time: `${hours}:${minutes}` };
}

// Render events list
async function renderEvents() {
    const eventsList = document.getElementById('events-list');
    const events = await fetchEvents();

    // STRICT: Ensure admin form visibility is controlled every time we render
    const adminEventCreator = document.getElementById('admin-event-creator');
    if (adminEventCreator) {
        if (isAdminUser === true) {
            adminEventCreator.style.display = 'block';
        } else {
            adminEventCreator.style.display = 'none';
        }
    }

    if (events.length === 0) {
        eventsList.innerHTML = '<p class="empty-state">Brak nadchodzących wydarzeń.</p>';
        return;
    }

    eventsList.innerHTML = events.map(event => {
        const { day, month, time } = formatEventDate(event.event_date);

        let actionButton = '';
        let adminButtons = '';

        // REGISTRATION BUTTON LOGIC - Works for both regular users and admins
        if (currentUserId) {
            if (event.isUserRegistered) {
                // User is registered - show cancel button
                actionButton = `<button class="btn btn-outline" onclick="cancelEventRegistration('${event.id}')">Odwołaj zapis</button>`;
            } else if (event.is_open || isAdminUser === true) {
                // Event is open OR user is admin (admins can sign up even when closed)
                actionButton = `<button class="btn btn-primary" onclick="signUpForEvent('${event.id}')">Zapisz się</button>`;
            } else if (!event.is_open) {
                // Event is closed and user is not admin
                actionButton = '<span class="event-badge closed">Zapisy zamknięte</span>';
            }
        }

        // STRICT ADMIN CHECK: Only show admin buttons if isAdminUser is explicitly true
        // This check prevents any HTML injection or display of admin controls for non-admin users
        if (isAdminUser === true) {
            const toggleText = event.is_open ? 'Zamknij zapisy' : 'Otwórz zapisy';
            adminButtons = `
                <div class="event-admin-actions">
                    <button class="btn-small btn-outline" onclick="editEvent('${event.id}')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edytuj
                    </button>
                    <button class="btn-small btn-outline" onclick="toggleEventStatus('${event.id}', ${!event.is_open})">${toggleText}</button>
                    <button class="btn-small btn-primary" onclick="openEventParticipantsModal('${event.id}')">Lista osób</button>
                    <button class="btn-small btn-danger" onclick="deleteEvent('${event.id}')">Usuń</button>
                </div>
            `;
        }

        return `
            <div class="card event-card">
                <div class="event-date-box">
                    <span class="day">${day}</span>
                    <span class="month">${month}</span>
                </div>
                <div class="event-details">
                    <h3>${event.title}</h3>
                    <p class="event-time">Godzina: ${time}</p>
                    ${event.description ? `<p>${event.description}</p>` : ''}
                </div>
                <div class="event-actions">
                    ${actionButton}
                    ${adminButtons}
                </div>
            </div>
        `;
    }).join('');
}

// Global variable to track if we're editing an event
let editingEventId = null;

// Create new event (Admin only)
async function createEvent(title, eventDate, description) {
    try {
        const { error } = await supabase
            .from('events')
            .insert({
                title,
                event_date: eventDate,
                description,
                created_by: currentUserId,
                is_open: true
            });

        if (error) throw error;

        await renderEvents();
        return true;
    } catch (error) {
        console.error('Error creating event:', error);
        alert('Błąd podczas tworzenia wydarzenia.');
        return false;
    }
}

// Update existing event (Admin only)
async function updateEvent(eventId, title, eventDate, description) {
    try {
        const { error } = await supabase
            .from('events')
            .update({
                title,
                event_date: eventDate,
                description
            })
            .eq('id', eventId);

        if (error) throw error;

        await renderEvents();
        return true;
    } catch (error) {
        console.error('Error updating event:', error);
        alert('Błąd podczas aktualizacji wydarzenia.');
        return false;
    }
}

// Edit event - populate form with event data (Admin only)
window.editEvent = async function(eventId) {
    try {
        const { data: event, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (error) throw error;

        // Populate form fields
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-description').value = event.description || '';

        // Format date for datetime-local input
        const eventDate = new Date(event.event_date);
        const formattedDate = eventDate.toISOString().slice(0, 16);
        document.getElementById('event-date').value = formattedDate;

        // Change form to edit mode
        editingEventId = eventId;
        const submitBtn = document.querySelector('#create-event-form button[type="submit"]');
        const cancelBtn = document.getElementById('cancel-edit-event');
        const formCard = document.getElementById('admin-event-creator');

        submitBtn.textContent = 'Zapisz zmiany';
        submitBtn.classList.add('editing');
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
        if (formCard) formCard.classList.add('editing-mode');

        // Scroll to form
        document.getElementById('admin-event-creator').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error('Error loading event for editing:', error);
        alert('Błąd podczas ładowania wydarzenia.');
    }
};

// Cancel edit mode
window.cancelEditEvent = function() {
    editingEventId = null;
    const submitBtn = document.querySelector('#create-event-form button[type="submit"]');
    const cancelBtn = document.getElementById('cancel-edit-event');
    const formCard = document.getElementById('admin-event-creator');

    submitBtn.textContent = 'Opublikuj wydarzenie';
    submitBtn.classList.remove('editing');
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (formCard) formCard.classList.remove('editing-mode');
    document.getElementById('create-event-form').reset();
}

// Sign up user for event
window.signUpForEvent = async function(eventId) {
    try {
        const { error } = await supabase
            .from('event_participants')
            .insert({
                event_id: eventId,
                user_id: currentUserId
            });

        if (error) throw error;

        await renderEvents();
        alert('Zapisano na wydarzenie!');
    } catch (error) {
        console.error('Error signing up for event:', error);
        alert('Błąd podczas zapisu. Możliwe, że jesteś już zapisany/a.');
    }
};

// Cancel user registration for event
window.cancelEventRegistration = async function(eventId) {
    try {
        const { error } = await supabase
            .from('event_participants')
            .delete()
            .eq('event_id', eventId)
            .eq('user_id', currentUserId);

        if (error) throw error;

        await renderEvents();
        alert('Rejestracja anulowana!');
    } catch (error) {
        console.error('Error canceling registration:', error);
        alert('Błąd podczas anulowania zapisu.');
    }
};

// Toggle event registration status (Admin only)
window.toggleEventStatus = async function(eventId, newStatus) {
    try {
        const { error } = await supabase
            .from('events')
            .update({ is_open: newStatus })
            .eq('id', eventId);

        if (error) throw error;

        await renderEvents();
    } catch (error) {
        console.error('Error toggling event status:', error);
        alert('Błąd podczas zmiany statusu.');
    }
};

// Delete event (Admin only)
window.deleteEvent = async function(eventId) {
    if (!confirm('Czy na pewno chcesz usunąć to wydarzenie?')) return;

    try {
        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', eventId);

        if (error) throw error;

        await renderEvents();
    } catch (error) {
        console.error('Error deleting event:', error);
        alert('Błąd podczas usuwania wydarzenia.');
    }
};

// Fetch event participants (Admin only)
async function fetchEventParticipants(eventId) {
    try {
        const { data, error } = await supabase
            .from('event_participants')
            .select(`
                id,
                registered_at,
                user_id,
                profiles:user_id (
                    full_name,
                    avatar_url,
                    email
                )
            `)
            .eq('event_id', eventId)
            .order('registered_at', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching participants:', error);
        return [];
    }
}

// Open event participants modal
window.openEventParticipantsModal = async function(eventId) {
    const modal = document.getElementById('event-participants-modal');
    const listContainer = document.getElementById('event-participants-list');

    modal.classList.remove('hidden');
    listContainer.innerHTML = '<p class="loading-text">Ładowanie...</p>';

    const participants = await fetchEventParticipants(eventId);

    if (participants.length === 0) {
        listContainer.innerHTML = '<p class="empty-state">Brak zapisanych uczestników.</p>';
        return;
    }

    listContainer.innerHTML = `
        <ul class="participants-list">
            ${participants.map(p => {
                const avatarUrl = p.profiles.avatar_url || 'https://via.placeholder.com/50';
                const fullName = p.profiles.full_name || 'Brak nazwy';
                const registeredDateTime = new Date(p.registered_at).toLocaleString('pl-PL', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                return `
                    <li class="participant-item">
                        <img src="${avatarUrl}" alt="${fullName}" class="participant-avatar">
                        <div class="participant-info">
                            <strong class="participant-name">${fullName}</strong>
                            <span class="participant-date">Zapisany: ${registeredDateTime}</span>
                        </div>
                    </li>
                `;
            }).join('')}
        </ul>
    `;
};

// Close event participants modal
window.closeEventParticipantsModal = function() {
    const modal = document.getElementById('event-participants-modal');
    modal.classList.add('hidden');
};

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

    // Set current user ID
    if (userData?.user?.id) {
        currentUserId = userData.user.id;
    }

    // Check if user is admin (STRICT: Use explicit true check)
    isAdminUser = checkIfAdmin(userData);
    if (isAdminUser === true) {
        showAdminIndicator();
        showAdminUserManagementButton();
        console.log('[ADMIN] Admin mode enabled');

        // Load and apply UI texts
        await loadUiTexts();

        // Enable inline editing for all editable elements
        enableAdminEditing();

        // STRICT: Show admin event creator
        const adminEventCreator = document.getElementById('admin-event-creator');
        if (adminEventCreator) {
            adminEventCreator.style.display = 'block';
        }

        // STRICT: Show admin announcement creator
        const adminAnnouncementCreator = document.getElementById('admin-announcement-creator');
        if (adminAnnouncementCreator) {
            adminAnnouncementCreator.style.display = 'block';
        }
    } else {
        // Ensure admin features are hidden for non-admin users
        hideAdminIndicator();
        hideAdminUserManagementButton();

        // Load UI texts for non-admin users (read-only)
        await loadUiTexts();

        // STRICT: Hide admin creators for non-admins
        const adminEventCreator = document.getElementById('admin-event-creator');
        if (adminEventCreator) {
            adminEventCreator.style.display = 'none';
        }

        const adminAnnouncementCreator = document.getElementById('admin-announcement-creator');
        if (adminAnnouncementCreator) {
            adminAnnouncementCreator.style.display = 'none';
        }
    }

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

            // Set current user ID
            if (userData?.user?.id) {
                currentUserId = userData.user.id;
            }

            // Check admin status
            isAdminUser = checkIfAdmin(userData);
            if (isAdminUser === true) {
                showAdminIndicator();
                showAdminUserManagementButton();
                console.log('[ADMIN] Admin mode enabled');

                // Load and apply UI texts
                await loadUiTexts();

                // Enable inline editing for all editable elements
                enableAdminEditing();

                // STRICT: Show admin event creator
                const adminEventCreator = document.getElementById('admin-event-creator');
                if (adminEventCreator) {
                    adminEventCreator.style.display = 'block';
                }

                // STRICT: Show admin announcement creator
                const adminAnnouncementCreator = document.getElementById('admin-announcement-creator');
                if (adminAnnouncementCreator) {
                    adminAnnouncementCreator.style.display = 'block';
                }
            } else {
                hideAdminIndicator();
                hideAdminUserManagementButton();

                // Load UI texts for non-admin users (read-only)
                await loadUiTexts();

                // STRICT: Hide admin creators for non-admins
                const adminEventCreator = document.getElementById('admin-event-creator');
                if (adminEventCreator) {
                    adminEventCreator.style.display = 'none';
                }

                const adminAnnouncementCreator = document.getElementById('admin-announcement-creator');
                if (adminAnnouncementCreator) {
                    adminAnnouncementCreator.style.display = 'none';
                }
            }

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

            // Reset admin state
            isAdminUser = false;
            currentUserId = null;
            hideAdminIndicator();
            hideAdminUserManagementButton();

            // STRICT: Hide admin event creator on logout
            const adminEventCreator = document.getElementById('admin-event-creator');
            if (adminEventCreator) {
                adminEventCreator.style.display = 'none';
            }

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

        console.log('[LOGIN] Attempting login for:', email);

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logowanie...';

        try {
            const result = await signIn(email, password);
            console.log('[LOGIN] Login successful:', result);

            loginForm.reset();

            // Get fresh user data after login
            const userData = await getCurrentUser();
            console.log('[LOGIN] User data after login:', userData);

            if (userData) {
                // Update current user ID
                currentUserId = userData.user.id;

                // Check admin status
                isAdminUser = checkIfAdmin(userData);
                console.log('[LOGIN] Is admin:', isAdminUser);

                if (isAdminUser === true) {
                    showAdminIndicator();
                    showAdminUserManagementButton();
                    await loadUiTexts();
                    enableAdminEditing();

                    const adminEventCreator = document.getElementById('admin-event-creator');
                    if (adminEventCreator) {
                        adminEventCreator.style.display = 'block';
                    }

                    const adminAnnouncementCreator = document.getElementById('admin-announcement-creator');
                    if (adminAnnouncementCreator) {
                        adminAnnouncementCreator.style.display = 'block';
                    }
                } else {
                    hideAdminIndicator();
                    hideAdminUserManagementButton();
                    await loadUiTexts();

                    const adminEventCreator = document.getElementById('admin-event-creator');
                    if (adminEventCreator) {
                        adminEventCreator.style.display = 'none';
                    }

                    const adminAnnouncementCreator = document.getElementById('admin-announcement-creator');
                    if (adminAnnouncementCreator) {
                        adminAnnouncementCreator.style.display = 'none';
                    }
                }

                // Show main app and hide modal
                hideAuthModal();
                showMainApp();
                updateUserDisplay(userData);

                // Load data
                await loadConversations();
                await loadPosts();

                console.log('[LOGIN] Login complete and app loaded');
            } else {
                throw new Error('Failed to get user data after login');
            }

        } catch (error) {
            console.error('[LOGIN] Login error:', error);
            loginError.textContent = getPolishErrorMessage(error.message);
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

        console.log('[REGISTER] Attempting registration for:', email);

        if (password !== confirmPassword) {
            registerError.textContent = 'Hasła nie są identyczne';
            console.log('[REGISTER] Password mismatch');
            return;
        }

        if (password.length < 6) {
            registerError.textContent = 'Hasło musi mieć minimum 6 znaków';
            console.log('[REGISTER] Password too short');
            return;
        }

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Rejestracja...';

        try {
            const result = await signUp(email, password, fullName);
            console.log('[REGISTER] Registration successful:', result);

            registerForm.reset();

            // Switch to login tab automatically
            authTabs[0].click();
            loginError.textContent = '';

            // Show success message
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.style.cssText = 'padding: 12px; margin-bottom: 16px; background-color: #10b981; color: white; border-radius: 8px; text-align: center;';
            successMsg.textContent = 'Konto utworzone! Możesz się teraz zalogować.';
            loginContainer.insertBefore(successMsg, loginForm);
            setTimeout(() => successMsg.remove(), 5000);

            console.log('[REGISTER] Registration complete, switched to login');

        } catch (error) {
            console.error('[REGISTER] Registration error:', error);
            registerError.textContent = getPolishErrorMessage(error.message);
        } finally {
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

            // Load events when switching to events section
            if (targetId === 'events') {
                renderEvents();
            }
        });
    });

    // ============================================
    // EVENTS - INITIALIZATION
    // ============================================

    // STRICT: Show admin event creator ONLY if user is explicitly admin
    if (isAdminUser === true) {
        const adminEventCreator = document.getElementById('admin-event-creator');
        if (adminEventCreator) {
            adminEventCreator.style.display = 'block';
        }
    } else {
        // Explicitly hide for non-admins
        const adminEventCreator = document.getElementById('admin-event-creator');
        if (adminEventCreator) {
            adminEventCreator.style.display = 'none';
        }
    }

    // Handle event creation/update form submission
    const createEventForm = document.getElementById('create-event-form');
    if (createEventForm) {
        createEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('event-title').value;
            const eventDate = document.getElementById('event-date').value;
            const description = document.getElementById('event-description').value;

            if (!title || !eventDate) {
                alert('Proszę wypełnić wymagane pola.');
                return;
            }

            let success = false;
            if (editingEventId) {
                // Update existing event
                success = await updateEvent(editingEventId, title, eventDate, description);
                if (success) {
                    cancelEditEvent();
                    alert('Wydarzenie zostało zaktualizowane!');
                }
            } else {
                // Create new event
                success = await createEvent(title, eventDate, description);
                if (success) {
                    createEventForm.reset();
                    alert('Wydarzenie zostało utworzone!');
                }
            }
        });
    }

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
                        ${(isAuthor || isAdminUser) ? `
                            <div class="post-actions-menu">
                                <button class="btn-text btn-edit-post" onclick="editPost('${post.id}')">Edytuj</button>
                                <button class="btn-text btn-delete-post" onclick="deletePostById('${post.id}')">Usuń</button>
                            </div>
                        ` : ''}
                    </div>

                    <div class="post-content" id="post-content-${post.id}">${escapeHtml(post.content)}</div>
                    <div class="post-content-edit" id="post-content-edit-${post.id}" style="display: none;">
                        <textarea class="edit-post-textarea" id="edit-post-textarea-${post.id}">${escapeHtml(post.content)}</textarea>
                        <div class="edit-actions">
                            <button class="btn btn-primary btn-small" onclick="savePostEdit('${post.id}')">Zapisz</button>
                            <button class="btn btn-outline btn-small" onclick="cancelPostEdit('${post.id}')">Anuluj</button>
                        </div>
                    </div>

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

    // Edit post - show edit form
    window.editPost = function(postId) {
        const contentDiv = document.getElementById(`post-content-${postId}`);
        const editDiv = document.getElementById(`post-content-edit-${postId}`);
        const postCard = document.querySelector(`[data-post-id="${postId}"]`);

        if (contentDiv && editDiv && postCard) {
            contentDiv.style.display = 'none';
            editDiv.style.display = 'block';
            postCard.classList.add('editing');

            // Focus on textarea
            const textarea = document.getElementById(`edit-post-textarea-${postId}`);
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
        }
    };

    // Save post edit
    window.savePostEdit = async function(postId) {
        const textarea = document.getElementById(`edit-post-textarea-${postId}`);
        const newContent = textarea?.value.trim();

        if (!newContent) {
            alert('Post nie może być pusty');
            return;
        }

        try {
            await updatePost(postId, newContent);
            await loadPosts();
        } catch (error) {
            console.error('Błąd aktualizacji posta:', error);
            alert('Nie udało się zaktualizować posta');
        }
    };

    // Cancel post edit
    window.cancelPostEdit = function(postId) {
        const contentDiv = document.getElementById(`post-content-${postId}`);
        const editDiv = document.getElementById(`post-content-edit-${postId}`);
        const postCard = document.querySelector(`[data-post-id="${postId}"]`);

        if (contentDiv && editDiv && postCard) {
            contentDiv.style.display = 'block';
            editDiv.style.display = 'none';
            postCard.classList.remove('editing');

            // Reset textarea to original content
            const textarea = document.getElementById(`edit-post-textarea-${postId}`);
            const originalContent = contentDiv.textContent;
            if (textarea && originalContent) {
                textarea.value = originalContent;
            }
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
                        <div class="comment-bubble" id="comment-bubble-${comment.id}">
                            <div class="comment-author" style="cursor: pointer;" onclick="startDirectChatWithUser('${comment.author_id}', event)" title="Kliknij, aby rozpocząć rozmowę">${escapeHtml(authorName)}</div>
                            <div class="comment-text" id="comment-text-${comment.id}">${escapeHtml(comment.content)}</div>
                        </div>
                        <div class="comment-edit-form" id="comment-edit-${comment.id}" style="display: none;">
                            <input type="text" class="comment-edit-input" id="comment-edit-input-${comment.id}" value="${escapeHtml(comment.content)}">
                            <div class="comment-edit-actions">
                                <button class="btn-icon-save" onclick="saveCommentEdit('${comment.id}', '${postId}')" title="Zapisz">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </button>
                                <button class="btn-icon-cancel" onclick="cancelCommentEdit('${comment.id}')" title="Anuluj">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="comment-meta">
                            <span class="comment-time">${timeStr}</span>
                            <button class="btn-comment-like ${hasLiked ? 'liked' : ''}" onclick="toggleLikeComment('${comment.id}', '${postId}')">
                                Lubię to ${comment.likes_count > 0 ? `<span style="cursor: pointer;" onclick="event.stopPropagation(); showCommentLikes('${comment.id}', event);" title="Zobacz kto polubił">(${comment.likes_count})</span>` : ''}
                            </button>
                            ${(isAuthor || isAdminUser) ? `
                                <button class="btn-edit-comment" onclick="editComment('${comment.id}')">Edytuj</button>
                                <button class="btn-delete-comment" onclick="deleteCommentById('${comment.id}', '${postId}')">Usuń</button>
                            ` : ''}
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

    // Edit comment - show edit form
    window.editComment = function(commentId) {
        const bubbleDiv = document.getElementById(`comment-bubble-${commentId}`);
        const editDiv = document.getElementById(`comment-edit-${commentId}`);
        const commentItem = document.querySelector(`[data-comment-id="${commentId}"]`);

        if (bubbleDiv && editDiv && commentItem) {
            bubbleDiv.style.display = 'none';
            editDiv.style.display = 'flex';
            commentItem.classList.add('editing');

            // Focus on input
            const input = document.getElementById(`comment-edit-input-${commentId}`);
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        }
    };

    // Save comment edit
    window.saveCommentEdit = async function(commentId, postId) {
        const input = document.getElementById(`comment-edit-input-${commentId}`);
        const newContent = input?.value.trim();

        if (!newContent) {
            alert('Komentarz nie może być pusty');
            return;
        }

        try {
            await updateComment(commentId, newContent);
            await loadComments(postId);

            // Otwórz ponownie komentarze
            const commentsSection = document.getElementById(`comments-${postId}`);
            commentsSection.style.display = 'block';
            await loadComments(postId);

        } catch (error) {
            console.error('Błąd aktualizacji komentarza:', error);
            alert('Nie udało się zaktualizować komentarza');
        }
    };

    // Cancel comment edit
    window.cancelCommentEdit = function(commentId) {
        const bubbleDiv = document.getElementById(`comment-bubble-${commentId}`);
        const editDiv = document.getElementById(`comment-edit-${commentId}`);
        const commentItem = document.querySelector(`[data-comment-id="${commentId}"]`);

        if (bubbleDiv && editDiv && commentItem) {
            bubbleDiv.style.display = 'block';
            editDiv.style.display = 'none';
            commentItem.classList.remove('editing');

            // Reset input to original content
            const input = document.getElementById(`comment-edit-input-${commentId}`);
            const originalContent = document.getElementById(`comment-text-${commentId}`)?.textContent;
            if (input && originalContent) {
                input.value = originalContent;
            }
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

    // ============================================
    // GALERIA ZDJĘĆ - DYNAMICZNE ŁADOWANIE
    // ============================================

    let galleryImages = [];
    let currentLightboxIndex = 0;

    async function renderGallery() {
        const userData = await getCurrentUser();
        if (!userData) return;

        try {
            const posts = await getPosts(1000);

            const imagePostsMap = new Map();

            posts.forEach(post => {
                if (post.attachments && post.attachments.length > 0) {
                    const imageAttachments = post.attachments.filter(
                        att => att.type === 'image' || att.type === 'gif'
                    );

                    if (imageAttachments.length > 0) {
                        const authorId = post.author_id;

                        if (!imagePostsMap.has(authorId)) {
                            imagePostsMap.set(authorId, {
                                author: post.author,
                                images: [],
                                mostRecentDate: post.created_at
                            });
                        }

                        const authorData = imagePostsMap.get(authorId);

                        imageAttachments.forEach(att => {
                            authorData.images.push({
                                url: att.url,
                                date: post.created_at,
                                filename: att.filename
                            });
                        });

                        if (new Date(post.created_at) > new Date(authorData.mostRecentDate)) {
                            authorData.mostRecentDate = post.created_at;
                        }
                    }
                }
            });

            const sortedAuthors = Array.from(imagePostsMap.entries())
                .sort((a, b) => new Date(b[1].mostRecentDate) - new Date(a[1].mostRecentDate));

            const galleryContainer = document.getElementById('gallery');
            galleryContainer.innerHTML = '';

            if (sortedAuthors.length === 0) {
                galleryContainer.innerHTML = '<div class="empty-state-feed"><p>Brak zdjęć w galerii. Bądź pierwszą osobą, która doda zdjęcie!</p></div>';
                galleryImages = [];
                return;
            }

            galleryImages = [];

            sortedAuthors.forEach(([authorId, authorData]) => {
                const userName = authorData.author?.full_name || authorData.author?.email || 'Użytkownik';

                authorData.images.sort((a, b) => new Date(b.date) - new Date(a.date));

                const userSection = document.createElement('div');
                userSection.className = 'gallery-user-section';

                const userHeader = document.createElement('div');
                userHeader.className = 'gallery-user-header';
                userHeader.innerHTML = `
                    <h3>${escapeHtml(userName)}</h3>
                    <div class="header-line"></div>
                `;

                const photoGrid = document.createElement('div');
                photoGrid.className = 'gallery-photo-grid';

                authorData.images.forEach(image => {
                    const imageIndex = galleryImages.length;
                    galleryImages.push({
                        src: image.url,
                        caption: userName,
                        date: image.date,
                        author: userName
                    });

                    const photoItem = document.createElement('div');
                    photoItem.className = 'gallery-photo-item';

                    const formattedDate = new Date(image.date).toLocaleString('pl-PL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    photoItem.innerHTML = `
                        <img src="${image.url}" alt="${escapeHtml(image.filename)}" title="${formattedDate}">
                    `;

                    photoItem.addEventListener('click', () => {
                        openLightboxAtIndex(imageIndex);
                    });

                    photoGrid.appendChild(photoItem);
                });

                userSection.appendChild(userHeader);
                userSection.appendChild(photoGrid);
                galleryContainer.appendChild(userSection);
            });

        } catch (error) {
            console.error('Błąd ładowania galerii:', error);
            const galleryContainer = document.getElementById('gallery');
            galleryContainer.innerHTML = '<div class="empty-state-feed"><p>Wystąpił błąd podczas ładowania galerii.</p></div>';
        }
    }

    feedNavButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const target = btn.getAttribute('data-target');
            if (target === 'gallery') {
                const userData = await getCurrentUser();
                if (userData) {
                    await renderGallery();
                }
            }
        });
    });

    const galleryNavBtn = document.querySelector('.nav-btn[data-target="gallery"]');
    if (galleryNavBtn && galleryNavBtn.classList.contains('active')) {
        renderGallery();
    }

    // ============================================
    // LIGHTBOX Z NAWIGACJĄ
    // ============================================

    function openLightboxAtIndex(index) {
        if (galleryImages.length === 0) return;

        currentLightboxIndex = index;
        updateLightboxDisplay();

        const lightbox = document.getElementById('lightbox');
        lightbox.classList.remove('hidden');
    }

    function updateLightboxDisplay() {
        const image = galleryImages[currentLightboxIndex];
        if (!image) return;

        const placeholder = document.getElementById('lightbox-img-placeholder');
        const caption = document.getElementById('lightbox-caption');
        const dateElement = document.getElementById('lightbox-date');
        const prevBtn = document.getElementById('lightbox-prev');
        const nextBtn = document.getElementById('lightbox-next');

        placeholder.innerHTML = `<img src="${image.src}" style="max-width: 100%; max-height: 80vh; object-fit: contain;">`;
        caption.textContent = image.caption;

        const formattedDate = new Date(image.date).toLocaleString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        dateElement.textContent = formattedDate;

        if (currentLightboxIndex === 0) {
            prevBtn.style.opacity = '0.3';
            prevBtn.style.cursor = 'default';
            prevBtn.disabled = true;
        } else {
            prevBtn.style.opacity = '1';
            prevBtn.style.cursor = 'pointer';
            prevBtn.disabled = false;
        }

        if (currentLightboxIndex === galleryImages.length - 1) {
            nextBtn.style.opacity = '0.3';
            nextBtn.style.cursor = 'default';
            nextBtn.disabled = true;
        } else {
            nextBtn.style.opacity = '1';
            nextBtn.style.cursor = 'pointer';
            nextBtn.disabled = false;
        }
    }

    window.changeLightboxImage = function(direction) {
        const newIndex = currentLightboxIndex + direction;

        if (newIndex < 0 || newIndex >= galleryImages.length) {
            return;
        }

        currentLightboxIndex = newIndex;
        updateLightboxDisplay();
    };

    document.addEventListener('keydown', (e) => {
        const lightbox = document.getElementById('lightbox');
        if (!lightbox.classList.contains('hidden')) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (currentLightboxIndex > 0) {
                    changeLightboxImage(-1);
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (currentLightboxIndex < galleryImages.length - 1) {
                    changeLightboxImage(1);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeLightbox();
            }
        }
    });

});
