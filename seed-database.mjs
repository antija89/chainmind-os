import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.js';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function seedDatabase() {
  try {
    console.log('Connecting to database...');
    
    // Create connection pool
    const connection = await mysql.createConnection(DATABASE_URL);
    const db = drizzle(connection);
    
    // Read SQL file
    const sqlContent = fs.readFileSync('/home/ubuntu/seed_all_data.sql', 'utf-8');
    const statements = sqlContent.split(';').filter(s => s.trim());
    
    console.log(`Total statements to execute: ${statements.length}`);
    
    let executed = 0;
    let failed = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;
      
      try {
        await connection.execute(stmt);
        executed++;
        
        if ((i + 1) % 100 === 0) {
          console.log(`Executed ${i + 1}/${statements.length} statements...`);
        }
      } catch (error) {
        failed++;
        if (failed <= 5) {
          console.error(`Error on statement ${i + 1}:`, error.message.substring(0, 100));
        }
        if (failed > 20) {
          console.error('Too many errors, stopping...');
          break;
        }
      }
    }
    
    console.log(`\nCompleted: ${executed} executed, ${failed} failed`);
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedDatabase();
