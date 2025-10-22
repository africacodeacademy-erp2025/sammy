import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sammy.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';

interface CounterDoc {
  _id: string;
  sequence: number;
}

async function initializeAdmin() {
  const client = new MongoClient(process.env.MONGO_URI!);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(process.env.DATABASE_NAME || 'sammydb');
    const usersCollection = db.collection('users');

    // Check if admin user already exists
    const existingAdmin = await usersCollection.findOne({ userId: 1 });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      console.log('Email:', existingAdmin.email);
      console.log('User ID:', existingAdmin.userId);
      return;
    }

    // Create admin user with ID 1
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const adminUser = {
      userId: 1,
      email: ADMIN_EMAIL,
      password: hashedPassword,      // For backward compatibility
      passwordHash: hashedPassword,  // Primary field used by signin
      role: 'admin',
      permissions: ['all'],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      lastLogin: null,
    };

    await usersCollection.insertOne(adminUser);
    console.log('✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', ADMIN_EMAIL);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    console.log('🆔 User ID: 1');
    console.log('👑 Role: admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Please change the default password after first login!');

    // Get next available ID for regular users
    const highestUser = await usersCollection
      .find({ userId: { $gt: 1 } })
      .sort({ userId: -1 })
      .limit(1)
      .toArray();

    const nextUserId = highestUser.length > 0 ? highestUser[0].userId + 1 : 2;

    // Create a counter collection for user IDs
    const counterCollection = db.collection<CounterDoc>('counters');
    await counterCollection.updateOne(
      { _id: 'userId' },
      { $set: { sequence: nextUserId } },
      { upsert: true }
    );

    console.log('✅ User ID counter initialized to:', nextUserId);

  } catch (error) {
    console.error('❌ Error initializing admin:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Database connection closed');
  }
}

// Run the script
initializeAdmin()
  .then(() => {
    console.log('\n✅ Admin initialization completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Admin initialization failed:', error);
    process.exit(1);
  });
