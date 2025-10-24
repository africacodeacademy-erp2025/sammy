import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sammy.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';

async function initializeAdmin() {
  const client = new MongoClient(process.env.MONGO_URI!);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(process.env.DATABASE_NAME || 'sammydb');
    const usersCollection = db.collection('users');
    const rolesCollection = db.collection('roles');

    // Get admin role
    const adminRole = await rolesCollection.findOne({ name: 'admin' });
    
    if (!adminRole) {
      console.error('❌ Admin role not found! Please run: npm run init:roles first');
      process.exit(1);
    }

    // Check if admin user already exists
    const existingAdmin = await usersCollection.findOne({ 
      roleId: adminRole._id 
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      console.log('Email:', existingAdmin.email);
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const adminUser = {
      email: ADMIN_EMAIL,
      password: hashedPassword,      // For backward compatibility
      passwordHash: hashedPassword,  // Primary field used by signin
      roleId: new ObjectId(adminRole._id),
      name: 'Administrator',
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
    console.log('👑 Role: admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Please change the default password after first login!');

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
