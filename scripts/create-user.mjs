// Creates (or confirms) the single login user. Uses the service-role key from env only.
// Usage: node --env-file=.env.local scripts/create-user.mjs [email] [password]
// Never import this file from src/.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.argv[2] ?? process.env.TEST_USER_EMAIL
const password = process.argv[3] ?? process.env.TEST_USER_PASSWORD

if (!url || !serviceKey || !email || !password) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, email or password')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })

if (error && !/already|registered|exists/i.test(error.message)) {
  console.error(error.message)
  process.exit(1)
}
console.log(error ? `User already exists: ${email}` : `Created user: ${email}`)
