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

// Pobranie aktualnego użytkownika i profilu
export async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return null;

        currentUser = user;
        await loadUserProfile(user.id);

        // CRITICAL: Always return valid userData even if profile is fallback
        return { user: currentUser, profile: currentProfile };
    } catch (error) {
        console.error('[AUTH] CRITICAL ERROR in getCurrentUser:', error);
        // Return null if we can't get the user at all
        return null;
    }
}

// Pobranie profilu użytkownika z bazy
async function loadUserProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error('[AUTH] Error loading user profile:', error);
        console.error('[AUTH] User ID:', userId);
        console.warn('[AUTH] Using fallback profile due to error');

        // CRITICAL: Return fallback profile instead of null
        currentProfile = {
            id: userId,
            username: currentUser?.email || 'user',
            full_name: 'Użytkownik',
            role: 'user',
            avatar_url: null
        };
        return currentProfile;
    }

    if (!data) {
        console.warn('[AUTH] No profile found for user:', userId);
        console.warn('[AUTH] Using fallback profile');

        // CRITICAL: Return fallback profile instead of null
        currentProfile = {
            id: userId,
            username: currentUser?.email || 'user',
            full_name: 'Użytkownik',
            role: 'user',
            avatar_url: null
        };
        return currentProfile;
    }

    console.log('[AUTH] Profile loaded successfully:', data);
    currentProfile = data;
    return currentProfile;
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
            }
        }
    });

    if (error) {
        throw new Error(error.message);
    }

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
