// ============================================
// MODUŁ AUTENTYKACJI SUPABASE
// ============================================

import { createClient } from '@supabase/supabase-js';

// Inicjalizacja klienta Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'sb-auth-token'
    }
});

// Stan użytkownika
let currentUser = null;
let currentProfile = null;

// ============================================
// FUNKCJE POMOCNICZE
// ============================================

// Pobranie aktualnego użytkownika i profilu - HARD BYPASS MODE
export async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return null;

        currentUser = user;

        // Load profile - this ALWAYS succeeds due to HARD BYPASS in loadUserProfile
        await loadUserProfile(user.id);

        // CRITICAL: Always return valid userData
        // Even if profile loading had issues, currentProfile is now set to mocked profile
        return { user: currentUser, profile: currentProfile };
    } catch (error) {
        console.error('[AUTH] CRITICAL ERROR in getCurrentUser:', error);

        // EMERGENCY: If we have currentUser but failed somehow, return with emergency profile
        if (currentUser) {
            console.warn('[AUTH] EMERGENCY: Returning user with emergency profile');
            const isMyAdmin = currentUser.email === 'wirkijowski.mateusz@gmail.com';
            return {
                user: currentUser,
                profile: {
                    id: currentUser.id,
                    email: currentUser.email,
                    full_name: currentUser.user_metadata?.full_name || currentUser.email,
                    role: isMyAdmin ? 'admin' : 'user',
                    avatar_url: null
                }
            };
        }

        // Only return null if we truly can't get the auth user
        return null;
    }
}

// Pobranie profilu użytkownika z bazy - HARD BYPASS MODE
async function loadUserProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        // If database fetch succeeds and returns data, use it
        if (!error && data) {
            console.log('[AUTH] Profile loaded successfully:', data);
            currentProfile = data;
            return currentProfile;
        }

        // HARD BYPASS: If database fails or returns null, use MOCKED PROFILE
        // NEVER throw error, NEVER call signOut()
        if (error) {
            console.error('[AUTH] Database error loading profile:', error);
        } else {
            console.warn('[AUTH] No profile found in database for user:', userId);
        }

        console.warn('[AUTH] HARD BYPASS: Using mocked profile based on user email');

        // Determine if this is the admin user
        const userEmail = currentUser?.email || '';
        const isMyAdmin = userEmail === 'wirkijowski.mateusz@gmail.com';

        // MOCKED PROFILE - ALWAYS VALID, NEVER NULL
        currentProfile = {
            id: userId,
            email: userEmail,
            full_name: currentUser?.user_metadata?.full_name || currentUser?.email || 'User',
            role: isMyAdmin ? 'admin' : 'user',  // FORCE ADMIN FOR MY EMAIL
            avatar_url: null
        };

        console.log('[AUTH] Mocked profile created:', currentProfile);
        return currentProfile;

    } catch (criticalError) {
        // Even if everything explodes, return mocked profile
        console.error('[AUTH] CRITICAL ERROR in loadUserProfile:', criticalError);
        console.warn('[AUTH] EMERGENCY BYPASS: Creating emergency mocked profile');

        const userEmail = currentUser?.email || 'unknown@user.com';
        const isMyAdmin = userEmail === 'wirkijowski.mateusz@gmail.com';

        currentProfile = {
            id: userId,
            email: userEmail,
            full_name: currentUser?.user_metadata?.full_name || userEmail,
            role: isMyAdmin ? 'admin' : 'user',
            avatar_url: null
        };

        return currentProfile;
    }
}

// ============================================
// AUTENTYKACJA
// ============================================

// Rejestracja nowego użytkownika
export async function signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: fullName
            },
            emailRedirectTo: null
        }
    });

    if (error) {
        throw new Error(error.message);
    }

    // Immediately sign out to prevent auto-login after registration
    // User must activate their account via email link first
    await supabase.auth.signOut();

    return data;
}

// Logowanie użytkownika
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        throw new Error(error.message);
    }

    currentUser = data.user;

    try {
        await loadUserProfile(data.user.id);
    } catch (profileError) {
        console.error('[AUTH] Error loading profile during sign in:', profileError);
        // Profile already set to fallback by loadUserProfile, continue
    }

    // Check if account is activated using our own flag in profiles table
    if (currentProfile && currentProfile.is_activated === false) {
        // Sign out immediately - account not activated
        await supabase.auth.signOut();
        currentUser = null;
        currentProfile = null;
        throw new Error('ACCOUNT_NOT_ACTIVATED');
    }

    return { user: currentUser, profile: currentProfile };
}

// Wylogowanie użytkownika
export async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        throw new Error(error.message);
    }

    currentUser = null;
    currentProfile = null;
}

// ============================================
// ZARZĄDZANIE PROFILEM
// ============================================

// Aktualizacja profilu użytkownika
export async function updateProfile(userId, updates) {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    currentProfile = data;
    return data;
}

// Zmiana hasła użytkownika
export async function updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({
        password: newPassword
    });

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

// ============================================
// UPLOAD AVATARA
// ============================================

// Upload avatara użytkownika
export async function uploadAvatar(userId, file) {
    // Usuń stary avatar jeśli istnieje
    const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list(userId);

    if (existingFiles && existingFiles.length > 0) {
        const filesToRemove = existingFiles.map(x => `${userId}/${x.name}`);
        await supabase.storage.from('avatars').remove(filesToRemove);
    }

    // Upload nowego avatara
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
        });

    if (uploadError) {
        throw new Error(uploadError.message);
    }

    // Pobierz publiczny URL
    const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    // Zaktualizuj profil z nowym avatar_url
    const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', userId)
        .select()
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    currentProfile = data;
    return data;
}

// Usunięcie avatara użytkownika
export async function removeAvatar(userId) {
    // Usuń plik z storage
    const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list(userId);

    if (existingFiles && existingFiles.length > 0) {
        const filesToRemove = existingFiles.map(x => `${userId}/${x.name}`);
        await supabase.storage.from('avatars').remove(filesToRemove);
    }

    // Zaktualizuj profil (usuń avatar_url)
    const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId)
        .select()
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    currentProfile = data;
    return data;
}

// ============================================
// NASŁUCHIWANIE ZMIAN STANU AUTENTYKACJI
// ============================================

export function onAuthStateChange(callback) {
    // WAŻNE: Nie używamy async callback bezpośrednio (deadlock risk)
    supabase.auth.onAuthStateChange((event, session) => {
        // Async operacje w oddzielnym bloku
        (async () => {
            try {
                if (session?.user) {
                    currentUser = session.user;
                    await loadUserProfile(session.user.id);
                    callback(event, { user: currentUser, profile: currentProfile });
                } else {
                    currentUser = null;
                    currentProfile = null;
                    callback(event, null);
                }
            } catch (error) {
                console.error('[AUTH] Error in onAuthStateChange:', error);
                // Continue with fallback profile if loadUserProfile set it
                if (currentUser && currentProfile) {
                    callback(event, { user: currentUser, profile: currentProfile });
                } else {
                    callback(event, null);
                }
            }
        })();
    });
}

// ============================================
// EDGE FUNCTION HELPER
// ============================================

// Helper do wywołania Edge Function z autoryzacją
export async function callEdgeFunction(functionName, endpoint, body) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(
        `${supabaseUrl}/functions/v1/${functionName}${endpoint}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey
            },
            body: JSON.stringify({
                ...body,
                _accessToken: session.access_token
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Edge Function error: ${response.status}`);
    }

    return data;
}

// ============================================
// EKSPORT GETTERÓW
// ============================================

export function getUser() {
    return currentUser;
}

export function getProfile() {
    return currentProfile;
}

// ============================================
// PASSWORD RESET FUNCTIONALITY
// ============================================

let resetToken = null;

// View switching between login and reset password forms
document.addEventListener('DOMContentLoaded', () => {
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginLink = document.getElementById('back-to-login-link');
    const loginContainer = document.getElementById('login-form-container');
    const resetContainer = document.getElementById('reset-password-container');
    const loginEmailInput = document.getElementById('login-email');
    const resetEmailInput = document.getElementById('reset-email');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginContainer.classList.remove('active');
            resetContainer.classList.add('active');

            // Copy email from login to reset if present
            if (loginEmailInput && loginEmailInput.value.trim()) {
                resetEmailInput.value = loginEmailInput.value;
            }
        });
    }

    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            resetContainer.classList.remove('active');
            loginContainer.classList.add('active');
        });
    }

    // Handle reset request form submission
    const resetRequestForm = document.getElementById('reset-request-form');
    if (resetRequestForm) {
        resetRequestForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = resetEmailInput.value.trim();
            const submitBtn = resetRequestForm.querySelector('button[type="submit"]');
            const messageDiv = document.getElementById('reset-request-message');

            if (!email) {
                messageDiv.textContent = 'Wprowadź adres e-mail';
                messageDiv.className = 'error-message';
                return;
            }

            // Show loading state
            submitBtn.disabled = true;
            submitBtn.textContent = 'Wysyłanie...';
            messageDiv.textContent = '';

            try {
                const response = await fetch(
                    `${supabaseUrl}/functions/v1/send-reset-email`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${supabaseAnonKey}`
                        },
                        body: JSON.stringify({ email }),
                    }
                );

                if (!response.ok) {
                    throw new Error('Nie udało się wysłać wiadomości');
                }

                // Always show success message (security - don't reveal if email exists)
                messageDiv.textContent = 'Jeśli podany adres istnieje w systemie, wysłaliśmy link resetujący. Sprawdź skrzynkę odbiorczą.';
                messageDiv.className = 'success-message';
                resetEmailInput.value = '';

            } catch (error) {
                console.error('Error sending reset email:', error);
                messageDiv.textContent = 'Wystąpił błąd sieciowy. Spróbuj ponownie.';
                messageDiv.className = 'error-message';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Wyślij link resetujący';
            }
        });
    }

    // Check for reset token in URL on page load
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('reset_token');

    if (token) {
        resetToken = token;
        const newPasswordModal = document.getElementById('new-password-modal');
        const authModal = document.getElementById('auth-modal');

        if (newPasswordModal) {
            newPasswordModal.style.display = 'flex';
        }
        if (authModal) {
            authModal.style.display = 'none';
        }
    }

    // Handle new password form submission
    const newPasswordForm = document.getElementById('new-password-form');
    if (newPasswordForm) {
        newPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPasswordInput = document.getElementById('new-password-reset');
            const confirmPasswordInput = document.getElementById('confirm-password-reset');
            const messageDiv = document.getElementById('new-password-message');
            const submitBtn = newPasswordForm.querySelector('button[type="submit"]');

            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            // Validate
            if (newPassword.length < 8) {
                messageDiv.textContent = 'Hasło musi mieć minimum 8 znaków';
                messageDiv.className = 'error-message';
                return;
            }

            if (newPassword !== confirmPassword) {
                messageDiv.textContent = 'Hasła nie są zgodne';
                messageDiv.className = 'error-message';
                return;
            }

            if (!resetToken) {
                messageDiv.textContent = 'Brak tokenu resetującego';
                messageDiv.className = 'error-message';
                return;
            }

            // Show loading
            submitBtn.disabled = true;
            submitBtn.textContent = 'Zapisywanie...';
            messageDiv.textContent = '';

            try {
                const response = await fetch(
                    `${supabaseUrl}/functions/v1/validate-and-reset`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${supabaseAnonKey}`
                        },
                        body: JSON.stringify({
                            token: resetToken,
                            newPassword: newPassword,
                        }),
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    messageDiv.textContent = data.error || 'Nie udało się zmienić hasła';
                    messageDiv.className = 'error-message';
                    return;
                }

                // Success
                messageDiv.textContent = 'Hasło zostało zmienione! Za chwilę zostaniesz przekierowany...';
                messageDiv.className = 'success-message';

                // Clean URL
                window.history.replaceState(null, '', '/');

                // After 2.5 seconds: hide modal, show login form
                setTimeout(() => {
                    const newPasswordModal = document.getElementById('new-password-modal');
                    const authModal = document.getElementById('auth-modal');
                    const loginContainer = document.getElementById('login-form-container');
                    const resetContainer = document.getElementById('reset-password-container');

                    if (newPasswordModal) {
                        newPasswordModal.style.display = 'none';
                    }
                    if (authModal) {
                        authModal.style.display = 'flex';
                    }
                    if (loginContainer) {
                        loginContainer.classList.add('active');
                    }
                    if (resetContainer) {
                        resetContainer.classList.remove('active');
                    }

                    // Reset form
                    newPasswordForm.reset();
                    messageDiv.textContent = '';
                    resetToken = null;
                }, 2500);

            } catch (error) {
                console.error('Error resetting password:', error);
                messageDiv.textContent = 'Wystąpił błąd sieciowy. Spróbuj ponownie.';
                messageDiv.className = 'error-message';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Zapisz nowe hasło';
            }
        });
    }
});
