import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function fixAdminRole() {
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
      console.error('❌ Admin role not found!');
      process.exit(1);
    }

    console.log('Found admin role:', adminRole._id);

    // Update admin user to have roleId
    const result = await usersCollection.updateOne(
      { email: 'admin@sammy.com' },
      { 
        $set: { 
          roleId: adminRole._id,
          updatedAt: new Date()
        } 
      }
    );

    console.log('✅ Update result:', result.modifiedCount, 'user(s) updated');

    // Verify the update
    const updatedAdmin = await usersCollection.findOne({ email: 'admin@sammy.com' });
    console.log('\n=== Updated Admin User ===');
    console.log('Email:', updatedAdmin?.email);
    console.log('RoleId:', updatedAdmin?.roleId);
    console.log('RoleId Type:', typeof updatedAdmin?.roleId);

    // Verify we can find the role
    const verifyRole = await rolesCollection.findOne({ _id: updatedAdmin?.roleId });
    console.log('Role lookup:', verifyRole?.name);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixAdminRole();
