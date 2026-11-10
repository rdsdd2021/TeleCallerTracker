const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://uzdzduydleytpebpkcte.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZHpkdXlkbGV5dHBlYnBrY3RlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc4OTIwMywiZXhwIjoyMDkzMzY1MjAzfQ.lCoGACRrax09NHkCPApk_HG1q1w88hffhiYOFx2-aow'
)

async function resetPassword() {
  const { data, error } = await supabase.auth.admin.updateUserById(
    'd0ce8d37-e35e-400a-89c3-cec326f9eb7a',
    { password: 'password123' }
  )
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Password updated successfully:', data)
  }
}

resetPassword()