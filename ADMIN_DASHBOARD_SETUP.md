# Admin Dashboard Setup Guide

## 🎯 Features

The SaMMy Admin Dashboard provides comprehensive user management with the following features:

- ✅ **Sequential User IDs**: Admin has ID 1, regular users start from ID 2
- ✅ **Default Admin User**: Automatically created on first setup
- ✅ **User Management**: View, add, edit, and delete users
- ✅ **Role Management**: Assign admin or user roles
- ✅ **Permission Control**: Manage user permissions
- ✅ **Protected Admin**: Primary admin (ID 1) cannot be deleted or demoted
- ✅ **User Status**: Activate or deactivate user accounts
- ✅ **Search & Filter**: Find users by ID, email, name, or role
- ✅ **Statistics Dashboard**: View user counts and activity metrics
- ✅ **Secure Access**: Only admin users can access the dashboard

---

## 📦 Installation

### Step 1: Initialize Admin User

Run the admin initialization script to create the default admin user (ID 1):

```bash
npm run init:admin
```

This will create an admin user with:
- **User ID**: 1
- **Email**: `admin@sammy.com` (configurable via `ADMIN_EMAIL` in `.env`)
- **Password**: `Admin@123456` (configurable via `ADMIN_PASSWORD` in `.env`)
- **Role**: admin
- **Permissions**: all

**⚠️ Important**: Change the default password after first login!

### Step 2: Configure Environment Variables

Add these variables to your `.env` file:

```properties
# Admin Credentials (for initialization)
ADMIN_EMAIL=admin@sammy.com
ADMIN_PASSWORD=Admin@123456
```

You can customize the admin email and password before running the initialization script.

### Step 3: Start the Application

```bash
# Start Next.js server
npm run dev

# Or start both server and worker
npm run dev:all
```

---

## 🔐 Accessing the Admin Dashboard

### Login as Admin

1. Go to `http://localhost:3000` (or your production URL)
2. Click "Login"
3. Enter admin credentials:
   - Email: `admin@sammy.com`
   - Password: `Admin@123456`
4. **NEW**: After login, you'll be redirected to the **Dashboard Selection Page** where you can choose:
   - **AI Chatbot** - Create and manage social media posts
   - **Admin Dashboard** - Manage users and system settings (admin only)

### Dashboard Selection Page

After a successful login, all users (including admins) will see a dashboard selection page with two options:

**For All Users:**
- ✅ Access to AI Chatbot for post creation and management

**For Admin Users Only:**
- ✅ Access to AI Chatbot
- ✅ Access to Admin Dashboard (highlighted with special styling and crown icon for super admin)

This makes it easier for admins to choose which part of the application they want to use without being forced directly into the chatbot.

### Admin Dashboard URL

- **Local**: `http://localhost:3000/admin`
- **Production**: `https://sammy.africacodefoundry.com/admin`

---

## 👤 User Management

### View All Users

The dashboard displays all users with:
- User ID
- Email
- Name
- Role (Admin/User)
- Status (Active/Inactive)
- Creation date
- Actions (Edit/Delete)

### Add New User

1. Click the **"Add User"** button
2. Fill in the form:
   - Email (required)
   - Password (required)
   - Name (optional)
   - Role (User or Admin)
3. Click **"Create User"**

The new user will be assigned the next sequential ID (2, 3, 4, etc.)

### Edit User

1. Click the **Edit** icon (pencil) next to any user
2. Modify the fields:
   - Email
   - Password (leave blank to keep current)
   - Name
   - Role
   - Active status
3. Click **"Update User"**

**Note**: The primary admin (ID 1) role cannot be changed, and they cannot be deactivated.

### Delete User

1. Click the **Delete** icon (trash) next to any user
2. Confirm the deletion

**Note**: The primary admin (ID 1) cannot be deleted.

When a user is deleted, all associated data is removed:
- User account
- Past posts
- Scheduled posts
- Chat messages

---

## 🔑 Roles & Permissions

### Admin Role

- User ID: 1 (primary admin) or assigned by another admin
- Permissions: ALL
- Can access: Admin dashboard
- Can perform: All user management operations
- Cannot be: Deleted (if ID 1) or demoted (if ID 1)

### User Role

- User ID: 2+ (sequential)
- Permissions: Standard user permissions
- Can access: Regular application features
- Cannot access: Admin dashboard
- Can perform: Create posts, manage own account

---

## 📊 Dashboard Features

### Statistics Cards

The dashboard displays:
- **Total Users**: All users in the system
- **Admin Users**: Count of admin role users
- **Regular Users**: Count of standard users
- **Active Users**: Currently active accounts
- **Inactive Users**: Deactivated accounts

### Search & Filter

- **Search Bar**: Find users by ID, email, or name
- **Role Filter**: Filter by All, Admin, or User roles

### User Information Display

For logged-in admin:
- Email address
- User ID
- Role
- Crown icon (👑) if primary admin (ID 1)

---

## 🛡️ Security Features

### Authentication & Authorization

- **JWT-based authentication**: Secure token-based access
- **Role-based access control**: Only admins can access dashboard
- **Protected routes**: Non-admin users redirected to main app
- **Session management**: 7-day token expiration

### Admin Protection

The primary admin (ID 1) has extra protections:
- ✅ Cannot be deleted
- ✅ Role cannot be changed
- ✅ Cannot be deactivated
- ✅ Always retains admin permissions

### Data Security

- **Password hashing**: Bcrypt encryption for all passwords
- **Sensitive data**: Passwords never returned in API responses
- **Cascade deletion**: Associated data removed when user is deleted
- **Audit trail**: Timestamps for user creation and updates

---

## 🔧 API Endpoints

### Get All Users
```
GET /api/admin/users
Authorization: Bearer {token}

Response:
{
  "success": true,
  "users": [...],
  "stats": {
    "totalUsers": 10,
    "adminUsers": 2,
    "regularUsers": 8,
    "activeUsers": 9,
    "inactiveUsers": 1
  }
}
```

### Create User
```
POST /api/admin/users/create
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "user",
  "permissions": []
}

Response:
{
  "success": true,
  "user": {...},
  "message": "User created successfully"
}
```

### Update User
```
PUT /api/admin/users/{userId}
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "email": "newemail@example.com",
  "name": "Jane Doe",
  "role": "admin",
  "isActive": true,
  "password": "newpassword" // optional
}

Response:
{
  "success": true,
  "user": {...},
  "message": "User updated successfully"
}
```

### Delete User
```
DELETE /api/admin/users/{userId}
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "User and all associated data deleted successfully"
}
```

---

## 📝 Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  userId: Number,              // Sequential ID (1 = admin, 2+ = users)
  email: String,
  passwordHash: String,
  password: String,            // Duplicate for compatibility
  role: String,                // 'admin' or 'user'
  permissions: Array,          // Array of permission strings
  name: String,
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean,
  lastLogin: Date
}
```

### Counters Collection
```javascript
{
  _id: 'userId',
  sequence: Number             // Next user ID to assign
}
```

---

## 🚀 Best Practices

### Security

1. **Change Default Password**: Immediately after first login
2. **Use Strong Passwords**: Require complex passwords for all users
3. **Limit Admin Access**: Only grant admin role when necessary
4. **Regular Audits**: Periodically review user accounts and roles
5. **Deactivate vs Delete**: Deactivate users instead of deleting when possible

### User Management

1. **Descriptive Names**: Use full names for easy identification
2. **Email Verification**: Ensure email addresses are valid
3. **Role Assignment**: Carefully consider before granting admin access
4. **Activity Monitoring**: Review user activity and last login times
5. **Cleanup**: Remove inactive or unused accounts regularly

### Maintenance

1. **Backup Database**: Regular backups before major changes
2. **Test Changes**: Test user modifications in development first
3. **Document Changes**: Keep track of admin actions
4. **Monitor Stats**: Watch for unusual patterns in user counts
5. **Update Passwords**: Encourage regular password changes

---

## 🐛 Troubleshooting

### Cannot Access Admin Dashboard

**Problem**: Redirected to login or home page

**Solutions**:
- Verify you're logged in with an admin account
- Check that your user has `role: 'admin'`
- Confirm JWT token is valid (not expired)
- Check browser console for errors

### Admin User Not Created

**Problem**: Script runs but admin doesn't exist

**Solutions**:
- Check database connection in `.env`
- Verify `MONGO_URI` and `DATABASE_NAME`
- Run `npm run init:admin` again
- Check MongoDB for existing admin user

### Cannot Delete User

**Problem**: Delete action fails or button is disabled

**Solutions**:
- Verify you're trying to delete a non-admin user
- Primary admin (ID 1) cannot be deleted
- Check if you have admin permissions
- Review browser console for error messages

### User IDs Not Sequential

**Problem**: New users have random or incorrect IDs

**Solutions**:
- Ensure counter collection exists in database
- Run initialization script to set up counter
- Check `getNextUserId()` function is working
- Manually reset counter in MongoDB if needed

---

## 📚 Additional Resources

### Related Files

- **Admin Dashboard Component**: `src/app/Components/AdminDashboard.tsx`
- **Admin API Routes**: `src/app/api/admin/users/`
- **User Model**: `models/User.ts`
- **Helper Functions**: `lib/userHelpers.ts`
- **Initialization Script**: `scripts/initializeAdmin.ts`

### Environment Variables

All admin-related configuration can be found in `.env`:
- `ADMIN_EMAIL`: Default admin email
- `ADMIN_PASSWORD`: Default admin password
- `JWT_SECRET`: Token signing secret
- `MONGO_URI`: Database connection
- `DATABASE_NAME`: Database name

---

## 🎉 Quick Start Commands

```bash
# 1. Initialize admin user
npm run init:admin

# 2. Start the application
npm run dev

# 3. Login and access admin dashboard
# Open browser → http://localhost:3000 → Login → Navigate to /admin
```

---

**Last Updated**: October 22, 2025  
**Version**: 1.0  
**App URL**: https://sammy.africacodefoundry.com/

For support, please contact the development team or refer to the main README.md file.
