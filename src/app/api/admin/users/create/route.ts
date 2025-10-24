import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../../lib/mongo';
import { verifyJwt, hashPassword } from '../../../../../../lib/auth';
import { isAdmin, getRoleByName } from '../../../../../../lib/userHelpers';
import { ObjectId } from 'mongodb';

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
    const { email, password, name, role } = body;

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

    // Get the role based on the provided role name
    const targetRole = await getRoleByName(role || 'user');
    if (!targetRole) {
      return NextResponse.json(
        { error: `Role '${role || 'user'}' not found` },
        { status: 500 }
      );
    }

    const passwordHash = await hashPassword(password);

    const newUser = {
      email: email.toLowerCase(),
      passwordHash,
      password: passwordHash,
      name: name || null,
      roleId: new ObjectId(targetRole._id),
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
        email: newUser.email,
        name: newUser.name,
        roleId: newUser.roleId,
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
