// ============================================
// BLA_BLA_AIR POST FEED - MODUŁ API
// ============================================

import { supabase } from './auth.js';

// ============================================
// POSTY
// ============================================

// Pobranie listy postów (najnowsze pierwsze) z autorem, licznikami i załącznikami
export async function getPosts(limit = 50) {
    const { data, error } = await supabase
        .from('blabla_posts')
        .select(`
            id,
            author_id,
            content,
            created_at,
            updated_at,
            profiles (
                id,
                full_name,
                email,
                avatar_url
            )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(error.message);

    // Dla każdego posta pobierz załączniki, liczbę lajków i komentarzy
    const postsWithDetails = await Promise.all(
        data.map(async (post) => {
            // Pobierz załączniki
            const { data: attachments } = await supabase
                .from('blabla_post_attachments')
                .select('*')
                .eq('post_id', post.id)
                .order('created_at', { ascending: true });

            // Policz lajki
            const { count: likesCount } = await supabase
                .from('blabla_post_likes')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id);

            // Policz komentarze
            const { count: commentsCount } = await supabase
                .from('blabla_comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id);

            return {
                ...post,
                author: post.profiles,
                attachments: attachments || [],
                likes_count: likesCount || 0,
                comments_count: commentsCount || 0
            };
        })
    );

    return postsWithDetails;
}

// Utworzenie nowego posta
export async function createPost(authorId, content, attachments = []) {
    // Walidacja
    if (!content || content.trim().length === 0) {
        throw new Error('Treść posta nie może być pusta');
    }

    // Utwórz post
    const { data: post, error: postError } = await supabase
        .from('blabla_posts')
        .insert({
            author_id: authorId,
            content: content.trim()
        })
        .select()
        .single();

    if (postError) throw new Error(postError.message);

    // Dodaj załączniki jeśli są
    if (attachments.length > 0) {
        const attachmentsData = attachments.map(att => ({
            post_id: post.id,
            type: att.type,
            url: att.url,
            filename: att.filename
        }));

        const { error: attachError } = await supabase
            .from('blabla_post_attachments')
            .insert(attachmentsData);

        if (attachError) throw new Error(attachError.message);
    }

    return post;
}

// Usunięcie posta (tylko autor)
export async function deletePost(postId) {
    const { error } = await supabase
        .from('blabla_posts')
        .delete()
        .eq('id', postId);

    if (error) throw new Error(error.message);
}

// Aktualizacja posta
export async function updatePost(postId, content) {
    const { error } = await supabase
        .from('blabla_posts')
        .update({
            content,
            updated_at: new Date().toISOString()
        })
        .eq('id', postId);

    if (error) throw new Error(error.message);
}

// ============================================
// POLUBIENIA POSTÓW (LIKES)
// ============================================

// Sprawdzenie czy użytkownik polubił post
export async function hasUserLikedPost(postId, userId) {
    const { data, error } = await supabase
        .from('blabla_post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return !!data;
}

// Toggle polubienia posta
export async function togglePostLike(postId, userId) {
    // Sprawdź czy już polubiony
    const hasLiked = await hasUserLikedPost(postId, userId);

    if (hasLiked) {
        // Usuń lajka
        const { error } = await supabase
            .from('blabla_post_likes')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return { liked: false };
    } else {
        // Dodaj lajka
        const { error } = await supabase
            .from('blabla_post_likes')
            .insert({
                post_id: postId,
                user_id: userId
            });

        if (error) throw new Error(error.message);
        return { liked: true };
    }
}

// Pobranie listy użytkowników, którzy polubili post
export async function getPostLikes(postId) {
    const { data, error } = await supabase
        .from('blabla_post_likes')
        .select(`
            user_id,
            created_at,
            profiles (
                id,
                full_name,
                email,
                avatar_url
            )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(like => ({
        user: like.profiles,
        created_at: like.created_at
    }));
}

// ============================================
// KOMENTARZE
// ============================================

// Pobranie komentarzy do posta
export async function getComments(postId) {
    const { data, error } = await supabase
        .from('blabla_comments')
        .select(`
            id,
            post_id,
            author_id,
            content,
            created_at,
            updated_at,
            profiles (
                id,
                full_name,
                email,
                avatar_url
            )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    // Dla każdego komentarza policz lajki
    const commentsWithLikes = await Promise.all(
        data.map(async (comment) => {
            const { count: likesCount } = await supabase
                .from('blabla_comment_likes')
                .select('*', { count: 'exact', head: true })
                .eq('comment_id', comment.id);

            return {
                ...comment,
                author: comment.profiles,
                likes_count: likesCount || 0
            };
        })
    );

    return commentsWithLikes;
}

// Dodanie komentarza
export async function createComment(postId, authorId, content) {
    if (!content || content.trim().length === 0) {
        throw new Error('Treść komentarza nie może być pusta');
    }

    const { data, error } = await supabase
        .from('blabla_comments')
        .insert({
            post_id: postId,
            author_id: authorId,
            content: content.trim()
        })
        .select(`
            id,
            post_id,
            author_id,
            content,
            created_at,
            updated_at,
            profiles (
                id,
                full_name,
                email,
                avatar_url
            )
        `)
        .single();

    if (error) throw new Error(error.message);

    return {
        ...data,
        author: data.profiles,
        likes_count: 0
    };
}

// Usunięcie komentarza (tylko autor)
export async function deleteComment(commentId) {
    const { error } = await supabase
        .from('blabla_comments')
        .delete()
        .eq('id', commentId);

    if (error) throw new Error(error.message);
}

// Aktualizacja komentarza
export async function updateComment(commentId, content) {
    const { error } = await supabase
        .from('blabla_comments')
        .update({
            content,
            updated_at: new Date().toISOString()
        })
        .eq('id', commentId);

    if (error) throw new Error(error.message);
}

// ============================================
// POLUBIENIA KOMENTARZY
// ============================================

// Sprawdzenie czy użytkownik polubił komentarz
export async function hasUserLikedComment(commentId, userId) {
    const { data, error } = await supabase
        .from('blabla_comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return !!data;
}

// Toggle polubienia komentarza
export async function toggleCommentLike(commentId, userId) {
    const hasLiked = await hasUserLikedComment(commentId, userId);

    if (hasLiked) {
        // Usuń lajka
        const { error } = await supabase
            .from('blabla_comment_likes')
            .delete()
            .eq('comment_id', commentId)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return { liked: false };
    } else {
        // Dodaj lajka
        const { error } = await supabase
            .from('blabla_comment_likes')
            .insert({
                comment_id: commentId,
                user_id: userId
            });

        if (error) throw new Error(error.message);
        return { liked: true };
    }
}

// Pobranie listy użytkowników, którzy polubili komentarz
export async function getCommentLikes(commentId) {
    const { data, error } = await supabase
        .from('blabla_comment_likes')
        .select(`
            user_id,
            created_at,
            profiles (
                id,
                full_name,
                email,
                avatar_url
            )
        `)
        .eq('comment_id', commentId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(like => ({
        user: like.profiles,
        created_at: like.created_at
    }));
}

// ============================================
// ZAŁĄCZNIKI (FILE UPLOAD)
// ============================================

// Upload załącznika do storage
export async function uploadAttachment(postId, file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `blabla/${postId}/${fileName}`;

    // Upload do storage
    const { error: uploadError } = await supabase.storage
        .from('blabla-attachments')
        .upload(filePath, file);

    if (uploadError) throw new Error(uploadError.message);

    // Pobierz publiczny URL
    const { data: urlData } = supabase.storage
        .from('blabla-attachments')
        .getPublicUrl(filePath);

    // Określ typ
    let type = 'file';
    if (file.type.startsWith('image/')) {
        type = file.type === 'image/gif' ? 'gif' : 'image';
    } else if (file.type.startsWith('video/')) {
        type = 'video';
    }

    return {
        type,
        url: urlData.publicUrl,
        filename: file.name
    };
}

// ============================================
// REAL-TIME SUBSCRIPTIONS (TODO)
// ============================================

// Subskrybuj nowe posty
export function subscribeToPosts(callback) {
    const subscription = supabase
        .channel('blabla-posts')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'blabla_posts'
            },
            async (payload) => {
                // Pobierz pełne dane posta z profilem
                const { data } = await supabase
                    .from('blabla_posts')
                    .select(`
                        id,
                        author_id,
                        content,
                        created_at,
                        updated_at,
                        profiles (
                            id,
                            full_name,
                            email,
                            avatar_url
                        )
                    `)
                    .eq('id', payload.new.id)
                    .single();

                if (data) {
                    callback({
                        ...data,
                        author: data.profiles,
                        attachments: [],
                        likes_count: 0,
                        comments_count: 0
                    });
                }
            }
        )
        .subscribe();

    return subscription;
}

// Anuluj subskrypcję postów
export function unsubscribeFromPosts(subscription) {
    if (subscription) {
        subscription.unsubscribe();
    }
}
