import { createClient } from '@supabase/supabase-js'

// Creates the test user (same service-role approach as scripts/create-user.mjs). Idempotent.
export default async function globalSetup() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { error } = await admin.auth.admin.createUser({
    email: process.env.TEST_USER_EMAIL!,
    password: process.env.TEST_USER_PASSWORD!,
    email_confirm: true,
  })
  if (error && !/already|registered|exists/i.test(error.message)) throw error
}
