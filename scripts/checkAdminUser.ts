import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkAdminUser() {
  const client = new MongoClient(process.env.MONGO_URI!);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(process.env.DATABASE_NAME || 'sammydb');
    const usersCollection = db.collection('users');
    const rolesCollection = db.collection('roles');

    // Find admin user
    const adminUser = await usersCollection.findOne({ 
      email: 'admin@sammy.com' 
    });

    if (!adminUser) {
      console.log('❌ Admin user not found!');
      return;
    }

    console.log('📧 Admin user found:', adminUser.email);
    console.log('🆔 User _id:', adminUser._id);
    console.log('🔑 RoleId:', adminUser.roleId);
    console.log('🔍 RoleId Type:', typeof adminUser.roleId);
    console.log('🔍 RoleId Constructor:', adminUser.roleId?.constructor?.name);

    // List all roles
    console.log('\n=== All Roles ===');
    const allRoles = await rolesCollection.find({}).toArray();
    allRoles.forEach(r => {
      console.log(`  - ${r.name} (ID: ${r._id}, Type: ${r._id?.constructor?.name})`);
    });

    // Find the role
    const role = await rolesCollection.findOne({ 
      _id: adminUser.roleId 
    });

    console.log('\n=== Role Lookup Result ===');
    if (role) {
      console.log('✅ Role found:', role.name);
      console.log('📝 Permissions:', role.permissions);
    } else {
      console.log('❌ Role not found!');
      console.log('Trying to match manually...');
      const manualMatch = allRoles.find(r => r._id.toString() === adminUser.roleId.toString());
      if (manualMatch) {
        console.log('✅ Manual match found:', manualMatch.name);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkAdminUser();
