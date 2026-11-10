// Debug script to test mobile app data fetching
// Run this with: node debug_mobile_app.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uzdzduydleytpebpkcte.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZHpkdXlkbGV5dHBlYnBrY3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MjE2NzQsImV4cCI6MjA0NjI5NzY3NH0.Ej8Ej-Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

const testCallerId = '7f06bf31-d323-4fc5-8f66-fb4b710d4354';

async function testDashboardStats() {
  console.log('=== Testing Dashboard Stats ===');
  try {
    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_caller_id: testCallerId,
    });
    
    if (error) {
      console.error('Dashboard stats error:', error);
    } else {
      console.log('Dashboard stats success:', JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error('Dashboard stats exception:', e);
  }
}

async function testCallTrends() {
  console.log('\n=== Testing Call Trends ===');
  try {
    const { data, error } = await supabase.rpc('get_call_trends', {
      p_caller_id: testCallerId,
      p_days: 7,
    });
    
    if (error) {
      console.error('Call trends error:', error);
    } else {
      console.log('Call trends success:', JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error('Call trends exception:', e);
  }
}

async function testCallLogsQuery() {
  console.log('\n=== Testing Call Logs Query ===');
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .select('id, caller_id, contact_number, contact_name, call_type, duration_sec, called_at, sim_id')
      .eq('caller_id', testCallerId)
      .order('called_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Call logs error:', error);
    } else {
      console.log('Call logs success:', data.length, 'records');
      console.log('Sample records:', JSON.stringify(data.slice(0, 3), null, 2));
    }
  } catch (e) {
    console.error('Call logs exception:', e);
  }
}

async function testContactInteractions() {
  console.log('\n=== Testing Contact Interactions ===');
  try {
    const { data, error } = await supabase.rpc('get_contact_interactions', {
      p_caller_id: testCallerId,
      p_limit: 10,
    });
    
    if (error) {
      console.error('Contact interactions error:', error);
    } else {
      console.log('Contact interactions success:', JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error('Contact interactions exception:', e);
  }
}

async function testFilterLogic() {
  console.log('\n=== Testing Filter Logic ===');
  
  // Test today's filter
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  console.log('Today filter range:', {
    from: today.toISOString(),
    to: now.toISOString()
  });
  
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .select('id, called_at, call_type')
      .eq('caller_id', testCallerId)
      .gte('called_at', today.toISOString())
      .lte('called_at', now.toISOString())
      .order('called_at', { ascending: false });
    
    if (error) {
      console.error('Filter test error:', error);
    } else {
      console.log('Today\'s calls:', data.length, 'records');
      if (data.length > 0) {
        console.log('Sample:', data.slice(0, 3));
      }
    }
  } catch (e) {
    console.error('Filter test exception:', e);
  }
}

async function runAllTests() {
  await testDashboardStats();
  await testCallTrends();
  await testCallLogsQuery();
  await testContactInteractions();
  await testFilterLogic();
}

runAllTests().catch(console.error);