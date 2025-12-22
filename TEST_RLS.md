# TEST RLS - Skopiuj do konsoli przeglądarki

## 1. Sprawdź czy user jest zalogowany

```javascript
const { data: { user }, error } = await supabase.auth.getUser();
console.log('✅ Current user:', user?.id);
console.log('✅ User email:', user?.email);
```

## 2. Sprawdź auth.uid() w bazie danych

```javascript
const { data, error } = await supabase.rpc('debug_current_user');
console.log('✅ auth.uid() in DB:', data);
```

## 3. Ręczny test INSERT

```javascript
const { data: { user } } = await supabase.auth.getUser();

const { data: conv, error } = await supabase
    .from('conversations')
    .insert({
        name: 'TEST',
        is_group: false,
        created_by: user.id
    })
    .select()
    .single();

console.log('✅ Manual insert result:', { conv, error });

// Jeśli się udało, usuń test:
if (conv) {
    await supabase.from('conversations').delete().eq('id', conv.id);
    console.log('✅ Test conversation deleted');
}
```

## 4. Jeśli 403 - sprawdź session

```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('Session valid:', !!session);
console.log('Session expires at:', new Date(session?.expires_at * 1000));

// Odśwież session
const { data, error } = await supabase.auth.refreshSession();
console.log('Session refreshed:', !!data.session, error);
```

## 5. Jeśli auth.uid() jest NULL - zaloguj się ponownie

Może session wygasła. Wyloguj się i zaloguj ponownie.
