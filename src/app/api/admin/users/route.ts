import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/mongo';
import { verifyJwt } from '../../../../../lib/auth';
import { isAdmin } from '../../../../../lib/userHelpers';

interface UserDoc {
  _id?: unknown;
  userId: number;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
  name?: string;
  createdAt?: Date;
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
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

    // Check if user is admin
    const isUserAdmin = await isAdmin(userId);
    if (!isUserAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const db = await connectDB();
    const users = await db.collection('users')
      .find({})
      .project({ passwordHash: 0, password: 0 }) // Don't send passwords
      .sort({ userId: 1 })
      .toArray() as UserDoc[];

    // Calculate statistics
    const stats = {
      totalUsers: users.length,
      adminUsers: users.filter((u: UserDoc) => u.role === 'admin').length,
      regularUsers: users.filter((u: UserDoc) => u.role === 'user').length,
      activeUsers: users.filter((u: UserDoc) => u.isActive).length,
      inactiveUsers: users.filter((u: UserDoc) => !u.isActive).length,
    };

    return NextResponse.json({ 
      success: true, 
      users,
      stats 
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
