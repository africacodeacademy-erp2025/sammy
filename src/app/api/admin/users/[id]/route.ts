import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../../lib/mongo';
import { verifyJwt, hashPassword } from '../../../../../../lib/auth';
import { isAdmin } from '../../../../../../lib/userHelpers';
import { ObjectId } from 'mongodb';

// GET - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    let userId: string;
    
    try {
      const decoded = verifyJwt(token);
      userId = decoded.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const isUserAdmin = await isAdmin(userId);
    if (!isUserAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const db = await connectDB();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { passwordHash: 0, password: 0 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PUT - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    let userId: string;
    
    try {
      const decoded = verifyJwt(token);
      userId = decoded.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const isUserAdmin = await isAdmin(userId);
    if (!isUserAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { email, name, role, permissions, isActive, password } = body;

    const db = await connectDB();
    
    // Check if trying to modify an admin user
    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(id) });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if target user is an admin by looking up their role
    const targetRole = await db.collection('roles').findOne({ _id: targetUser.roleId });
    if (targetRole?.name === 'admin') {
      return NextResponse.json({ 
        error: 'Cannot modify admin users' 
      }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (email) updateData.email = email.toLowerCase();
    if (name !== undefined) updateData.name = name;
    if (role) updateData.role = role;
    if (permissions) updateData.permissions = permissions;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) {
      updateData.passwordHash = await hashPassword(password);
      updateData.password = await hashPassword(password);
    }

    const result = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after', projection: { passwordHash: 0, password: 0 } }
    );

    return NextResponse.json({ 
      success: true, 
      user: result,
      message: 'User updated successfully' 
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    let userId: string;
    
    try {
      const decoded = verifyJwt(token);
      userId = decoded.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const isUserAdmin = await isAdmin(userId);
    if (!isUserAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const db = await connectDB();
    
    // Check if trying to delete an admin user
    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(id) });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if target user is an admin by looking up their role
    const targetRole = await db.collection('roles').findOne({ _id: targetUser.roleId });
    if (targetRole?.name === 'admin') {
      return NextResponse.json({ 
        error: 'Cannot delete admin users' 
      }, { status: 403 });
    }

    // Delete user and all associated data
    await Promise.all([
      db.collection('users').deleteOne({ _id: new ObjectId(id) }),
      db.collection('past_posts').deleteMany({ userId: id }),
      db.collection('scheduledPosts').deleteMany({ userId: id }),
      db.collection('chatMessages').deleteMany({ userId: id }),
    ]);

    return NextResponse.json({ 
      success: true,
      message: 'User and all associated data deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
