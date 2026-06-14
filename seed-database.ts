import { getDb } from './server/db';
import fs from 'fs';

async function seedDatabase() {
  try {
    console.log('Connecting to database...');
    const db = await getDb();
    
    if (!db) {
      console.error('Failed to connect to database');
      process.exit(1);
    }
    
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
        // Execute raw SQL
        await db.execute(stmt);
        executed++;
        
        if ((i + 1) % 100 === 0) {
          console.log(`Executed ${i + 1}/${statements.length} statements...`);
        }
      } catch (error: any) {
        failed++;
        if (failed <= 5) {
          console.error(`Error on statement ${i + 1}:`, error.message?.substring(0, 100));
        }
        if (failed > 20) {
          console.error('Too many errors, stopping...');
          break;
        }
      }
    }
    
    console.log(`\nCompleted: ${executed} executed, ${failed} failed`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedDatabase();
