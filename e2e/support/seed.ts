import { createClient } from '@supabase/supabase-js'

// Test-only helpers using the service-role key from env. Never import from src/.
export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

export async function testUserId(): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 })
  if (error) throw error
  const user = data.users.find((u) => u.email === process.env.TEST_USER_EMAIL)
  if (!user) throw new Error('test user not found')
  return user.id
}

// Child tables first (FK-safe order). Later tasks append their tables here.
// Tables do not exist yet (Task 2 creates them), so a missing table is tolerated.
const TABLES_CHILD_FIRST: string[] = []

export async function resetData(): Promise<void> {
  const ownerId = await testUserId()
  for (const table of TABLES_CHILD_FIRST) {
    const { error } = await admin.from(table).delete().eq('owner_id', ownerId)
    // 42P01 = undefined_table; PGRST205 = table not in schema cache
    if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw error
  }
}

// Later tasks add typed seed helpers here, e.g.:
//   export async function seedIngredient(input: SeedIngredient): Promise<{ id: string }> { ... }
//   export async function seedLot(input: SeedLot): Promise<{ id: string }> { ... }
