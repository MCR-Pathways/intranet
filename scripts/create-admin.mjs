import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  const email = "localadmin@mcrpathways.org";
  const password = "password123";

  console.log(`Checking for existing admin user: ${email}...`);

  const { data: profileData } = await supabase.from('profiles').select('id').eq('email', email).single();
  
  if (profileData) {
    console.log("Found existing user, deleting them first...");
    await supabase.auth.admin.deleteUser(profileData.id);
    console.log("Deleted.");
  }

  console.log("Creating auth user...");
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr) {
    console.error("Error creating auth user:", authErr.message);
    return;
  }

  const userId = authData.user.id;
  console.log("Auth user created:", userId);

  // 2. Wait for profile trigger
  console.log("Waiting for profile trigger...");
  await new Promise(r => setTimeout(r, 2000));

  // 3. Update profile
  // Note: department has been decoupled/removed, so we don't try to set it. We only set basic fields.
  console.log("Updating profile permissions...");
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ 
      is_hr_admin: true, 
      user_type: "staff",
      is_external: false,
      status: "active",
      full_name: "Local Admin",
      job_title: "Administrator"
    })
    .eq("id", userId);
    
  if (profErr) {
    console.error("Error updating profile:", profErr.message);
  } else {
    console.log("Admin user setup successfully!");
    console.log("----------------------------------------");
    console.log("Email: admin@mcrpathways.org");
    console.log("Password: password123");
    console.log("----------------------------------------");
  }
}

createAdmin();
