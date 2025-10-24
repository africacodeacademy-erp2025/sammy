# Role-Based Authentication Setup Guide

## 📋 Overview

This application now uses a **role-based authentication system** with a separate `roles` table. Users are identified by their `roleId` which references the `roles` collection.

## 🗄️ Database Structure

### Collections:

1. **roles** - Stores role definitions
```javascript
{
  _id: ObjectId,
  name: "admin" | "user",
  permissions: ["all"] | ["read", "create", "update_own"],
  description: string,
  createdAt: Date,
  updatedAt: Date
}
```

2. **users** - Stores user accounts with role reference
```javascript
{
  _id: ObjectId,
  email: string,
  passwordHash: string,
  roleId: ObjectId,  // References roles._id
  name: string,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date,
  lastLogin: Date
}
```

## 🚀 Setup Instructions

### Step 1: Initialize Roles

First, create the default roles (admin and user):

```bash
npm run init:roles
```

This will create two roles:
- **admin** - Full permissions (all)
- **user** - Limited permissions (read, create, update_own)

### Step 2: Create Admin User

After roles are initialized, create the admin user:

```bash
npm run init:admin
```

This will:
- Create an admin user with the email from `.env` (default: admin@sammy.com)
- Assign the admin roleId
- Use the password from `.env` (default: Admin@123456)

### Step 3: Start the Application

```bash
npm run dev
```

## 🔐 Authentication Flow

### 1. **User Registration** (`/api/auth/signup`)
- User signs up with email/password
- System automatically assigns "user" role
- Returns JWT token

### 2. **User Login** (`/api/auth/signin`)
- User logs in with email/password
- System fetches user and their role
- Returns JWT token + role information
- Role name determines access level

### 3. **Role-Based Access**
```typescript
// Check if user is admin
const isAdmin = await isAdmin(userId);

// Check specific permission
const canDelete = await hasPermission(userId, 'delete');
```

## 📊 Default Roles & Permissions

| Role  | Permissions | Description |
|-------|-------------|-------------|
| **admin** | `all` | Full access to all features |
| **user** | `read`, `create`, `update_own` | Limited access |

## 🛠️ Helper Functions

### `getRole(roleId: ObjectId)`
Get role details by roleId

### `getRoleByName(roleName: 'admin' | 'user')`
Get role details by name

### `isAdmin(userId: string): Promise<boolean>`
Check if user has admin role

### `hasPermission(userId: string, permission: string): Promise<boolean>`
Check if user has specific permission

## 🔄 Migration from Old System

If you have existing users with `role` field instead of `roleId`, run this migration:

```javascript
// Migration script (create as scripts/migrateToRoles.ts)
const db = await connectDB();
const adminRole = await db.collection('roles').findOne({ name: 'admin' });
const userRole = await db.collection('roles').findOne({ name: 'user' });

const users = await db.collection('users').find({}).toArray();

for (const user of users) {
  const roleId = user.role === 'admin' ? adminRole._id : userRole._id;
  
  await db.collection('users').updateOne(
    { _id: user._id },
    { 
      $set: { roleId },
      $unset: { role: '', permissions: '' }
    }
  );
}
```

## 🎯 Benefits of This Approach

✅ **Separation of Concerns** - Roles are managed independently  
✅ **Scalability** - Easy to add new roles (e.g., "moderator", "editor")  
✅ **Flexibility** - Change permissions without modifying users  
✅ **Performance** - Single lookup to get all role info  
✅ **Maintainability** - Cleaner database schema  

## 📝 Adding New Roles

To add a new role:

```typescript
await db.collection('roles').insertOne({
  name: 'moderator',
  permissions: ['read', 'create', 'update_own', 'moderate'],
  description: 'Moderator with content management access',
  createdAt: new Date(),
  updatedAt: new Date()
});
```

## 🔒 Security Notes

- Passwords are hashed with bcrypt
- JWT tokens used for authentication
- Role permissions checked on every protected route
- Admin role cannot be assigned during signup (only via init script)

## 🐛 Troubleshooting

### Error: "User role not found"
**Solution:** Run `npm run init:roles` first

### Error: "Admin role not found"
**Solution:** Run `npm run init:roles` before `npm run init:admin`

### Users can't log in after migration
**Solution:** Ensure all users have a valid `roleId` field

---

**Last Updated:** October 24, 2025  
**Version:** 2.0 (Role-Based System)
