const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync(".env.local", "utf-8");
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=([^\n]+)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=([^\n]+)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function purgeZombies() {
  console.log("Purging zombie tasks stuck in processing/rendering...");
  
  const { data, error } = await supabase
    .from('task_data')
    .update({ status: 'failed', error: 'Purged by admin' })
    .in('status', ['processing', 'rendering'])
    .select();
    
  if (error) {
    console.error("Failed to purge:", error.message);
  } else {
    console.log(`✅ Successfully purged ${data.length} zombie tasks!`);
  }
}

purgeZombies();
