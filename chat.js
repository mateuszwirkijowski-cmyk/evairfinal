// ============================================
// MODUŁ SYSTEMU CZATU
// ============================================

import { supabase, callEdgeFunction } from './auth.js';

let currentConversationId = null;
let messageSubscription = null;

// ============================================
// KONWERSACJE
// ============================================

// Pobranie listy konwersacji użytkownika
export async function getUserConversations(userId) {
    const { data, error } = await supabase
        .from('conversation_members')
        .select(`
            conversation_id,
            conversations (
                id,
                name,
                is_group,
                created_by,
                created_at,
                updated_at
            )
        `)
        .eq('user_id', userId)
        .order('conversations(updated_at)', { ascending: false });

    if (error) throw new Error(error.message);

    // Dla każdej konwersacji pobierz członków
    const conversationsWithMembers = await Promise.all(
        data.map(async (item) => {
            const conv = item.conversations;
            const members = await getConversationMembers(conv.id);

            // Jeśli to konwersacja prywatna, znajdź drugą osobę
            let displayName = conv.name;
            let displayAvatar = null;

            if (!conv.is_group) {
                const otherMember = members.find(m => m.id !== userId);
                if (otherMember) {
                    displayName = otherMember.full_name || otherMember.email;
                    displayAvatar = otherMember.avatar_url;
                }
            }

            return {
                ...conv,
                members,
                displayName,
                displayAvatar
            };
        })
    );

    return conversationsWithMembers;
}

// Pobranie członków konwersacji
export async function getConversationMembers(conversationId) {
    const { data, error } = await supabase
        .from('conversation_members')
        .select(`
            user_id,
            profiles (
                id,
                email,
                full_name,
                avatar_url
            )
        `)
        .eq('conversation_id', conversationId);

    if (error) throw new Error(error.message);

    return data.map(item => ({
        id: item.profiles.id,
        email: item.profiles.email,
        full_name: item.profiles.full_name,
        avatar_url: item.profiles.avatar_url
    }));
}

// Utworzenie nowej konwersacji (prywatnej lub grupowej)
export async function createConversation(creatorId, memberIds, isGroup = false, groupName = null) {
    console.log('[CHAT] createConversation called', { creatorId, memberIds, isGroup, groupName });

    if (!creatorId) {
        throw new Error('creatorId jest wymagane');
    }

    if (!memberIds || memberIds.length === 0) {
        throw new Error('Musisz wybrać co najmniej jednego użytkownika');
    }

    // Sprawdź czy to konwersacja prywatna z kimś, z kim już mamy rozmowę
    if (!isGroup && memberIds.length === 1) {
        const existingConv = await findPrivateConversation(creatorId, memberIds[0]);
        if (existingConv) {
            console.log('[CHAT] Found existing conversation:', existingConv.id);
            return existingConv;
        }
    }

    // Utwórz konwersację przez Edge Function (omija preview proxy problem)
    console.log('[CHAT] Creating conversation via Edge Function...');

    try {
        const result = await callEdgeFunction('chat-operations', '/create-conversation', {
            memberIds,
            isGroup,
            groupName
        });

        console.log('[CHAT] Conversation created successfully:', result.conversation.id);
        return result.conversation;
    } catch (error) {
        console.error('[CHAT] Error creating conversation:', error);
        throw new Error(`Błąd tworzenia rozmowy: ${error.message}`);
    }
}

// Znajdź istniejącą prywatną konwersację między dwoma użytkownikami
async function findPrivateConversation(userId1, userId2) {
    // Pobierz wszystkie konwersacje użytkownika 1
    const { data: userConvs, error } = await supabase
        .from('conversation_members')
        .select('conversation_id, conversations!inner(is_group)')
        .eq('user_id', userId1)
        .eq('conversations.is_group', false);

    if (error || !userConvs) {
        return null;
    }

    // Dla każdej konwersacji sprawdź czy użytkownik 2 jest członkiem
    for (const conv of userConvs) {
        const { data: members, error: membersError } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id);

        if (members && members.length === 2) {
            const memberIds = members.map(m => m.user_id);

            if (memberIds.includes(userId2)) {
                const { data: conversation, error: fetchError } = await supabase
                    .from('conversations')
                    .select('*')
                    .eq('id', conv.conversation_id)
                    .single();

                return conversation;
            }
        }
    }

    return null;
}

// NEW: getOrCreateDirectConversation - Znajdź lub utwórz prywatną rozmowę z użytkownikiem
export async function getOrCreateDirectConversation(currentUserId, otherUserId) {
    if (!currentUserId) {
        throw new Error('currentUserId jest wymagane');
    }

    if (!otherUserId) {
        throw new Error('Nie udało się odczytać użytkownika. Spróbuj ponownie.');
    }

    if (currentUserId === otherUserId) {
        throw new Error('Nie możesz utworzyć rozmowy sam ze sobą');
    }

    // Sprawdź czy istnieje prywatna rozmowa
    const existing = await findPrivateConversation(currentUserId, otherUserId);

    if (existing) {
        console.log('[CHAT] Found existing conversation');
        return existing;
    }

    // Utwórz nową prywatną rozmowę
    console.log('[CHAT] Creating new conversation');
    const conversation = await createConversation(currentUserId, [otherUserId], false, null);
    return conversation;
}

// Dodanie członków do grupy
export async function addMembersToConversation(conversationId, userIds) {
    const members = userIds.map(userId => ({
        conversation_id: conversationId,
        user_id: userId
    }));

    const { error } = await supabase
        .from('conversation_members')
        .insert(members);

    if (error) throw new Error(error.message);
}

// ============================================
// WIADOMOŚCI
// ============================================

// Pobranie wiadomości z konwersacji
export async function getMessages(conversationId, limit = 50) {
    const { data, error } = await supabase
        .from('messages')
        .select(`
            id,
            conversation_id,
            sender_id,
            content,
            media_url,
            media_type,
            created_at,
            profiles (
                id,
                full_name,
                email,
                avatar_url
            )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) throw new Error(error.message);

    return data.map(msg => ({
        ...msg,
        sender: msg.profiles
    }));
}

// Wysłanie wiadomości tekstowej
export async function sendMessage(conversationId, senderId, content) {
    console.log('[CHAT] Sending message via Edge Function...');

    try {
        const result = await callEdgeFunction('chat-operations', '/send-message', {
            conversationId,
            content
        });

        return result.message;
    } catch (error) {
        console.error('[CHAT] Error sending message:', error);
        throw new Error(`Błąd wysyłania wiadomości: ${error.message}`);
    }
}

// Wysłanie wiadomości z mediami
export async function sendMediaMessage(conversationId, senderId, file, content = '') {
    console.log('[CHAT] Uploading media and sending via Edge Function...');

    // Upload pliku do storage (działa normalnie - nie potrzebuje auth w header)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${conversationId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

    if (uploadError) throw new Error(uploadError.message);

    // Pobierz publiczny URL
    const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

    // Określ typ media
    let mediaType = 'image';
    if (file.type.startsWith('video/')) {
        mediaType = 'video';
    } else if (file.type === 'image/gif') {
        mediaType = 'gif';
    }

    // Wyślij wiadomość przez Edge Function
    try {
        const result = await callEdgeFunction('chat-operations', '/send-message', {
            conversationId,
            content,
            mediaUrl: urlData.publicUrl,
            mediaType
        });

        return result.message;
    } catch (error) {
        console.error('[CHAT] Error sending media message:', error);
        throw new Error(`Błąd wysyłania wiadomości z media: ${error.message}`);
    }
}

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

// Subskrybuj nowe wiadomości w konwersacji
export function subscribeToMessages(conversationId, callback) {
    // REALTIME FIX: Usuń poprzednią subskrypcję
    if (messageSubscription) {
        console.log('[CHAT.JS] Usuwam poprzednią subskrypcję');
        messageSubscription.unsubscribe();
    }

    currentConversationId = conversationId;

    console.log('[CHAT.JS] Tworzę subskrypcję dla konwersacji:', conversationId);

    messageSubscription = supabase
        .channel(`messages:${conversationId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            },
            async (payload) => {
                console.log('[CHAT.JS] Real-time event otrzymany:', payload);

                // Pobierz pełne dane wiadomości z profilem nadawcy
                const { data, error } = await supabase
                    .from('messages')
                    .select(`
                        id,
                        conversation_id,
                        sender_id,
                        content,
                        media_url,
                        media_type,
                        created_at,
                        profiles (
                            id,
                            full_name,
                            email,
                            avatar_url
                        )
                    `)
                    .eq('id', payload.new.id)
                    .single();

                if (error) {
                    console.error('[CHAT.JS] Błąd pobierania danych wiadomości:', error);
                    return;
                }

                if (data) {
                    console.log('[CHAT.JS] Wywołuję callback z danymi:', data);
                    // FIX: profile mapping consistency - mapuj profiles → sender jak w getMessages()
                    const mappedData = {
                        ...data,
                        sender: data.profiles
                    };
                    callback(mappedData);
                } else {
                    console.warn('[CHAT.JS] Brak danych dla wiadomości:', payload.new.id);
                }
            }
        )
        .subscribe((status, err) => {
            console.log('[CHAT.JS] Status subskrypcji:', status, err);
        });

    return messageSubscription;
}

// Anuluj subskrypcję
export function unsubscribeFromMessages() {
    if (messageSubscription) {
        messageSubscription.unsubscribe();
        messageSubscription = null;
    }
    currentConversationId = null;
}

// ============================================
// WYSZUKIWANIE UŻYTKOWNIKÓW
// ============================================

// Wyszukaj użytkowników po imieniu/emailu (do rozpoczęcia prywatnej rozmowy)
export async function searchUsers(query, currentUserId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .neq('id', currentUserId)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

    if (error) throw new Error(error.message);

    return data;
}

// ============================================
// GETTERY
// ============================================

export function getCurrentConversationId() {
    return currentConversationId;
}
