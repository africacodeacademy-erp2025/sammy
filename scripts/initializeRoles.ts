import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function initializeRoles() {
  const client = new MongoClient(process.env.MONGO_URI!);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(process.env.DATABASE_NAME || 'sammydb');
    const rolesCollection = db.collection('roles');

    // Check if roles already exist
    const existingRoles = await rolesCollection.countDocuments();

    if (existingRoles > 0) {
      console.log('⚠️  Roles already exist');
      const roles = await rolesCollection.find({}).toArray();
      console.log('Existing roles:', roles.map(r => r.name).join(', '));
      return;
    }

    // Create default roles
    const defaultRoles = [
      {
        name: 'admin',
        permissions: ['all'],
        description: 'Administrator with full access',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'user',
        permissions: ['read', 'create', 'update_own'],
        description: 'Regular user with limited access',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    await rolesCollection.insertMany(defaultRoles);
    
    console.log('✅ Roles created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 Admin role - Full permissions');
    console.log('👤 User role - Limited permissions');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error initializing roles:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Database connection closed');
  }
}

// Run the script
initializeRoles()
  .then(() => {
    console.log('\n✅ Roles initialization completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Roles initialization failed:', error);
    process.exit(1);
  });
