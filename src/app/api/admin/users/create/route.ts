import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../../lib/mongo';
import { verifyJwt, hashPassword } from '../../../../../../lib/auth';
import { isAdmin, getNextUserId } from '../../../../../../lib/userHelpers';

// POST - Create new user (admin only)
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { email, password, name, role, permissions } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const db = await connectDB();
    
    // Check if user already exists
    const existing = await db.collection('users').findOne({ 
      email: email.toLowerCase() 
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'User already exists with that email' },
        { status: 409 }
      );
    }

    // Get next user ID
    const newUserId = await getNextUserId();
    const passwordHash = await hashPassword(password);

    const newUser = {
      userId: newUserId,
      email: email.toLowerCase(),
      passwordHash,
      password: passwordHash,
      name: name || null,
      role: role || 'user',
      permissions: permissions || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      lastLogin: null,
    };

    const result = await db.collection('users').insertOne(newUser);

    return NextResponse.json({
      success: true,
      user: {
        _id: result.insertedId,
        userId: newUser.userId,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        permissions: newUser.permissions,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt,
      },
      message: 'User created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
