# Admin Role Setup

## Set Current User as Admin

Run this SQL query in the Supabase SQL Editor to set yourself as admin:

```sql
-- Set the current authenticated user as admin
UPDATE profiles
SET role = 'admin'
WHERE id = auth.uid();
```

## Set First User as Admin

If you want to set the first user in the database as admin:

```sql
-- Set the first user as admin
UPDATE profiles
SET role = 'admin'
WHERE id = (SELECT id FROM profiles ORDER BY created_at LIMIT 1);
```

## Set Specific User by Email as Admin

```sql
-- Replace 'user@example.com' with the actual email
UPDATE profiles
SET role = 'admin'
WHERE email = 'user@example.com';
```

## Check Current Admin Users

```sql
-- View all admin users
SELECT id, email, full_name, role, created_at
FROM profiles
WHERE role = 'admin';
```

## Remove Admin Role

```sql
-- Remove admin role from a user (replace email)
UPDATE profiles
SET role = 'user'
WHERE email = 'user@example.com';
```
