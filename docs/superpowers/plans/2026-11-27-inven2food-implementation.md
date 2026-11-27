# Inven2Food Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างเว็บแอปจัดการวัตถุดิบภายในร้านสำหรับผู้ใช้คนเดียว: ซื้อเข้า → คลังแบบรอบที่ซื้อ → บันทึกการทำอาหารที่ตัดของตามสูตร → แจ้งเตือน

**Architecture:** Next.js (TypeScript) เรียก Supabase (Postgres + Auth) ตรงด้วย `supabase-js` ไม่มีเซิร์ฟเวอร์ API กฎที่แก้ยอดของคงเหลือทั้งหมดอยู่ในฟังก์ชัน SQL (transaction เดียว, `FOR UPDATE`) หน้าเว็บอ่านข้อมูลผ่านตาราง/view และเขียนยอดผ่าน RPC เท่านั้น

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form + Zod, Supabase (Postgres, Auth, migrations), pgTAP (`supabase test db`), Vitest, Playwright, Vercel. ใช้ `npm` (ไม่มี pnpm ในเครื่อง)

**Spec:** `docs/superpowers/specs/2026-11-27-inven2food-design.md` (ทำอะไร, คำศัพท์ภาคผนวก ก.) และ `docs/superpowers/specs/2026-11-27-inven2food-system-design.md` (สร้างอย่างไร) ผู้ปฏิบัติต้องอ่านทั้งสองฉบับ

**เงื่อนไขเริ่มต้น:** เครื่องมีอยู่แล้ว: node 24, npm, docker, supabase CLI 1.148, git, psql ต้องเปิด Docker daemon ก่อนรัน `supabase start` โฟลเดอร์ยังไม่ใช่ git repo (Task 1 ทำ `git init`) ใช้ Supabase แบบ local ตลอดการพัฒนา โปรเจกต์ Supabase บนคลาวด์สร้างตอน Task 13

## Global Constraints

- ข้อความที่ผู้ใช้เห็นต้องเป็นภาษาไทยล้วน ห้ามมีอังกฤษและห้ามคำทับศัพท์ ข้อยกเว้นมีเพียง `Inven2Food`, `Email`, `Password` และข้อมูลที่ผู้ใช้พิมพ์เอง ใช้คำตามภาคผนวก ก. (รอบที่ซื้อ, รายการอาหาร, คลังวัตถุดิบ, นำเข้าคลัง, ประวัติทำอาหาร, บันทึกการทำ, ของใกล้หมด ฯลฯ)
- ข้อความหน้าจอทั้งหมดอยู่ใน `src/lib/th.ts` ไฟล์เดียว ห้ามเขียนข้อความไทยในคอมโพเนนต์โดยตรง ข้อผิดพลาดจาก DB แสดงผ่าน `errorMessage(code)` เท่านั้น
- ชื่อในโค้ด (ตาราง ฟังก์ชัน SQL ตัวแปร ไฟล์ เส้นทาง URL) เป็นภาษาอังกฤษ
- ปริมาณ `numeric(14,4)`; ราคา/ต้นทุนต่อหน่วยฐาน `numeric(18,8)` ไม่ปัดเศษ; หน่วยฐานเก็บเป็นรหัส `g` | `ml` | `piece` ช่องเก็บ `freezer` | `fridge` | `dry` แสดงเป็นไทยผ่าน `th.ts`
- วันที่เก็บในฐานข้อมูลเป็น ISO แต่ **แสดงและกรอกเป็น `dd/mm/yy` ปี พ.ศ. สองหลัก** เช่น `27/11/69`, `01/12/69` (ผู้ใช้กำหนด) ช่องกรอกวันที่ทุกช่องใช้คอมโพเนนต์ `ThaiDateInput` ห้ามใช้ `<input type="date">` ของเบราว์เซอร์ เพราะรูปแบบที่แสดงขึ้นกับภาษาของเครื่อง; "หมดอายุหรือยัง" ตัดสินด้วยเวลา Asia/Bangkok; ตัวเลขอารบิก สกุลเงินบาท
- เปิด RLS ทุกตาราง (`owner_id = auth.uid()`); `stock_movements` ห้าม update/delete; ปิดการสมัครสมาชิกใหม่; ไม่นำ service-role key ไว้ในโค้ดหน้าเว็บ
- ไม่มีรายการสั่ง ลูกค้า การขาย ราคาขาย กำไร และไม่มีการแจ้งเตือนแบบ push ในเวอร์ชันนี้
- ทุกการแก้ยอดทำผ่านฟังก์ชัน SQL เท่านั้น ฟังก์ชันที่แก้ยอดเป็น `SECURITY DEFINER` + `set search_path = public` และตรวจเจ้าของด้วย `auth.uid()` เอง (เพราะต้องถอดสิทธิ์เขียนตรงบน `lots`/`stock_movements` จากผู้ใช้)
- รหัสข้อผิดพลาดจากฟังก์ชัน SQL: `raise exception '<CODE>'` โดยข้อความเท่ากับรหัส รหัสที่ใช้: `INSUFFICIENT_STOCK`, `INVALID_QTY`, `RECIPE_EMPTY`, `ALREADY_CANCELLED`, `UNIT_MISMATCH`, `EXPIRY_IN_PAST`, `NOT_FOUND`
- **การแจ้งผลเมื่อเพิ่ม/ลบ (ผู้ใช้เลือกแบบ ข):** การลบหรือย้อนยอด (เก็บถาวรวัตถุดิบหรือรายการอาหาร, ตัดทิ้งรอบที่ซื้อ, ยกเลิกการทำ, ลบรายการซื้อของ) ต้องมี modal ถามยืนยันก่อน แล้วมี modal แจ้งผลหลังสำเร็จ (ปุ่ม "ตกลง"); การเพิ่มหรือบันทึก (สร้างวัตถุดิบ, รายการอาหาร, ยอดคงเหลือเริ่มต้น, ปรับยอด, บันทึกการทำ, นำเข้าคลัง, เพิ่มรายการซื้อ) ไม่มี modal แต่แสดงข้อความเล็กที่หายเองภายใน 2 วินาที (toast); ความล้มเหลวทุกกรณีแสดงข้อความไทยผ่าน `errorMessage`; ใช้คอมโพเนนต์กลาง `ConfirmDialog`, `ResultDialog` และฟังก์ชัน `notify` ที่สร้างใน Task 7 ข้อความทั้งหมดอยู่ใน `th.ts`; การลบแถววัตถุดิบในฟอร์มสูตรที่ยังไม่บันทึกไม่นับเป็นการลบข้อมูล ไม่ต้องมี modal; e2e ของทุก task ที่มีการเพิ่ม/ลบต้องตรวจ toast หรือยืนยันและปิด modal

## Review Focus

เรื่องที่สเปกไม่ได้พูดถึงตรง ๆ แต่ผู้ใช้น่าจะเจอ (แต่ละข้อมีการทดสอบกำกับใน task ที่รับผิดชอบ)

1. **กดบันทึกการทำซ้ำหรือสองหน้าจอพร้อมกันตอนของเหลือพอแค่ครั้งเดียว:** ต้องสำเร็จเพียงครั้งเดียว ที่เหลือได้ `INSUFFICIENT_STOCK` และไม่มีรอบที่ซื้อติดลบ (Task 4)
2. **ยกเลิกการทำที่ตัดข้ามหลายรอบ แม้บางรอบหมดอายุไปแล้ว:** ยอดต้องกลับเท่าเดิมทุกรอบพอดี (Task 4)
3. **วัตถุดิบไม่มีรอบที่ซื้อเลยหรือหมดอายุหมด:** จำนวนที่ทำได้ = 0 ไม่ error ไม่หารด้วยศูนย์ และสูตรที่มีวัตถุดิบ `archived` ใช้บันทึกการทำไม่ได้ (Task 4)
4. **นำเข้าคลังด้วยข้อมูลผิด:** ปริมาณ ≤ 0, หน่วยซื้อของวัตถุดิบอื่น, วันหมดอายุย้อนหลัง ต้องถูกปฏิเสธด้วยข้อความไทยและไม่สร้างรอบที่ซื้อครึ่งเดียว (Task 5)
5. **ข้อผิดพลาดที่ไม่รู้จัก (เช่น เน็ตหลุด, ข้อความดิบจาก Postgres):** ต้องขึ้นข้อความไทยกลาง ๆ ไม่โชว์ข้อความอังกฤษดิบ (Task 1, 13)

---

## File Structure

```
inven2food-app/
├─ supabase/
│  ├─ config.toml                      enable_signup = false
│  ├─ migrations/
│  │  ├─ 0001_schema.sql               ตาราง ข้อจำกัด RLS สิทธิ์
│  │  ├─ 0002_stock_functions.sql      consume_fefo, add_opening_stock, adjust_stock, discard_lot, ingredient_stock
│  │  ├─ 0003_cooking.sql              record_cooking, cancel_cooking, menu_availability, menu_shortage
│  │  ├─ 0004_check_in.sql             check_in
│  │  └─ 0005_alerts.sql               alert_expiring, alert_low_stock
│  └─ tests/                           pgTAP ต่อไฟล์ migration
├─ src/
│  ├─ middleware.ts                    บังคับล็อกอิน
│  ├─ lib/
│  │  ├─ th.ts                         ข้อความไทยทั้งหมด + errorMessage(code)
│  │  ├─ format.ts                     formatThaiDate, formatBaht, formatQty
│  │  ├─ supabase/{client,server}.ts
│  │  └─ db.ts                         ตัวห่อ RPC + DbError
│  ├─ components/                      nav และคอมโพเนนต์ร่วม
│  └─ app/
│     ├─ login/page.tsx
│     └─ (app)/{page.tsx,pantry,ingredients,menus,cooking-history,shopping}/page.tsx
├─ e2e/                                Playwright
└─ package.json, playwright.config.ts, vitest.config.ts
```

---

### Task 1: โครงโปรเจกต์ ล็อกอิน และไฟล์ศัพท์ไทย

**Files:**
- Create: ทั้งโครง Next.js ตามด้านบน, `src/lib/th.ts`, `src/lib/format.ts`, `src/components/thai-date-input.tsx`, `src/lib/supabase/*.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx` (หน้าหลักว่าง), `supabase/config.toml`
- Test: `src/lib/format.test.ts`, `src/lib/th.test.ts`

**Interfaces:**
- Produces: `th` (object ข้อความไทย แยกกลุ่ม `nav`, `common`, `errors`, ฯลฯ); `errorMessage(code: string): string` (รหัสไม่รู้จัก → ข้อความกลาง "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"); `formatThaiDate(iso: string): string` (`2026-11-27` → `27/11/69`, `2026-12-01` → `01/12/69`; ปี = (ค.ศ. + 543) mod 100 เติมศูนย์หน้าให้ครบสองหลักทั้งวัน เดือน ปี); `parseThaiDate(input: string): string | null` (รับ `dd/mm/yy` → ISO โดยปีสองหลัก `yy` ตีความเป็น พ.ศ. `25yy` เสมอ เช่น `69` → 2569 → ค.ศ. 2026 รับ `dd/mm/yyyy` พ.ศ. สี่หลักด้วย วันที่ที่ไม่มีจริง เช่น `31/02/69` หรือรูปแบบผิด คืน `null`); `ThaiDateInput` (props `{ value: string | null; onChange(iso: string | null): void; invalid?: boolean }` ช่องข้อความ placeholder จาก `th.ts` แสดงค่าเป็น `dd/mm/yy` ใส่ `/` ให้เองขณะพิมพ์ ตัวเลขเท่านั้น); `formatBaht(n: number): string` (`1234.5` → `1,234.50 บาท`); `formatQty(n: number, unit: 'g'|'ml'|'piece'): string`; `createClient()` ใน `supabase/client.ts` และ `supabase/server.ts`

- [ ] **Step 1:** `git init`, สร้างโปรเจกต์ Next.js (TypeScript, App Router, Tailwind, src dir), ติดตั้ง shadcn/ui, `@supabase/supabase-js`, `@supabase/ssr`, `react-hook-form`, `zod`, `vitest`, `@playwright/test`; `supabase init` แล้วตั้ง `enable_signup = false` ใน `supabase/config.toml`; เพิ่มสคริปต์ `npm test` (vitest), `npm run test:db` (`supabase test db`), `npm run test:e2e`
- [ ] **Step 2: เขียนเทสต์ที่ล้ม** ใน `format.test.ts`: `formatThaiDate('2026-11-27') === '27/11/69'`, `formatThaiDate('2026-12-01') === '01/12/69'`, `parseThaiDate('27/11/69') === '2026-11-27'`, `parseThaiDate('01/12/69') === '2026-12-01'`, `parseThaiDate('27/11/2569') === '2026-11-27'`, `parseThaiDate('31/02/69') === null`, `parseThaiDate('abc') === null`, และ `parseThaiDate(formatThaiDate(x)) === x` สำหรับวันที่ปีอธิกสุรทิน `2028-02-29`; `formatBaht(1234.5) === '1,234.50 บาท'`; `formatQty(1500,'g')` มีหน่วย `กรัม`; ใน `th.test.ts`: `errorMessage('INSUFFICIENT_STOCK')` ไม่ว่างและไม่มีตัวอักษรละติน, `errorMessage('weird raw postgres text')` เท่ากับข้อความกลางและไม่มีตัวอักษรละติน (Review Focus ข้อ 5), และทุกค่าใน `th` ที่เป็นสตริงไม่มีตัวอักษรละติน ยกเว้นค่าที่เป็น `Inven2Food`, `Email`, `Password`
- [ ] **Step 3:** รัน `npm test` ต้องล้ม
- [ ] **Step 4:** เขียน `th.ts` (กลุ่ม `nav` ใช้ชื่อหน้าตามภาคผนวก ก.), `format.ts` ตามลายเซ็น (ปี พ.ศ. = ค.ศ. + 543, ใช้ `Intl` หรือเขียนเอง)
- [ ] **Step 5:** `npm test` ต้องผ่าน
- [ ] **Step 5b:** เขียน `ThaiDateInput` (ใช้ `formatThaiDate`/`parseThaiDate`) ช่องว่างหรือรูปแบบผิดส่ง `null` และแสดงสถานะไม่ถูกต้อง
- [ ] **Step 6:** `middleware.ts` ส่งผู้ยังไม่ล็อกอินไป `/login`; หน้า `/login` มีฟอร์ม Email/Password เรียก `supabase.auth.signInWithPassword` แล้วไป `/`; `(app)/layout.tsx` มีแถบนำทาง 6 หน้าตามชื่อใน `th.nav`; ตั้ง `<html lang="th">`, `<title>Inven2Food</title>`; ปุ่มออกจากระบบ; สร้างผู้ใช้ทดสอบด้วยสคริปต์ `scripts/create-user.mjs` (ใช้ service-role key จาก env เท่านั้น ไม่ import จากโค้ดหน้าเว็บ)
- [ ] **Step 7: ตรวจด้วยมือ:** `supabase start`, `npm run dev` เข้า `/` ต้องเด้งไป `/login` ล็อกอินด้วยผู้ใช้ทดสอบแล้วเห็นหน้าหลักและแถบนำทางภาษาไทย
- [ ] **Step 8: Commit** `feat: scaffold app, auth, thai strings`

---

### Task 2: สคีมา RLS และสิทธิ์

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `supabase/tests/0001_schema.test.sql`

**Interfaces:**
- Produces: ตารางตามเอกสาร System Design หัวข้อ 3: `ingredients`, `purchase_units`, `lots`, `stock_movements`, `menus`, `recipe_items`, `cooking_logs`, `shopping_items` (ทุกตารางมี `id uuid pk default gen_random_uuid()`, `owner_id uuid not null default auth.uid()`, `created_at`, `updated_at`) และฟังก์ชัน `today_bkk() returns date` (`(now() at time zone 'Asia/Bangkok')::date`)
- ค่าที่ตรึง: `ingredients.base_unit` check in (`g`,`ml`,`piece`); `zone` check in (`freezer`,`fridge`,`dry`); `expiry_warn_days` default 3; `recipe_items.yield_pct` default 100 check `> 0 and <= 100`; `cooking_logs.status` check in (`done`,`cancelled`); `stock_movements.reason` check in (`opening`,`purchase`,`cook`,`cook_reversal`,`count_adjust`,`waste`); `shopping_items.source` check in (`manual`,`low_stock`,`planned_menu`), `status` in (`planned`,`checked_in`); FK ใช้ `on delete restrict`; `ingredients` และ `menus` มี `archived boolean default false`

- [ ] **Step 1: เขียน pgTAP ที่ล้ม:** สร้างผู้ใช้ A และ B (`auth.users`), ผู้ใช้ A สร้างวัตถุดิบ → ผู้ใช้ B `select` ไม่เห็น (`is(count, 0)`); `authenticated` ทำ `insert into lots` ตรงไม่ได้ (`throws_ok`); `update`/`delete` บน `stock_movements` ไม่ได้; `base_unit='kg'` ถูกปฏิเสธ; `yield_pct=0` ถูกปฏิเสธ; ลบ `ingredients` ที่มี `lots` อ้างถึงไม่ได้
- [ ] **Step 2:** `npm run test:db` ต้องล้ม
- [ ] **Step 3:** เขียน migration: ตาราง ข้อจำกัด `enable row level security` + นโยบาย `owner_id = auth.uid()` ทุกตาราง; `revoke insert, update, delete on lots, stock_movements from authenticated` (นโยบาย select ยังอยู่); trigger อัปเดต `updated_at`
- [ ] **Step 4:** `npm run test:db` ต้องผ่าน
- [ ] **Step 5: Commit** `feat(db): schema, RLS, grants`

---

### Task 3: ฟังก์ชันคลัง (ตัดตามลำดับ FEFO, ยอดเริ่มต้น, ปรับยอด, ตัดทิ้ง)

**Files:**
- Create: `supabase/migrations/0002_stock_functions.sql`, `supabase/tests/0002_stock_functions.test.sql`

**Interfaces:**
- Consumes: ตารางจาก Task 2, `today_bkk()`
- Produces (ทั้งหมด `SECURITY DEFINER`, ตรวจ `owner_id = auth.uid()` ของแถวที่เกี่ยวข้อง ไม่ตรง → `NOT_FOUND`):
  - `consume_fefo(p_ingredient_id uuid, p_qty numeric, p_reason text, p_cooking_log_id uuid default null) returns numeric` — ตัด `p_qty` จากรอบที่ซื้อที่ไม่หมดอายุ (`expires_on is null or expires_on >= today_bkk()`) เรียง `expires_on asc nulls last, purchased_on asc` ล็อกด้วย `for update` เขียน movement ติดลบต่อรอบ คืนต้นทุนรวม (Σ ปริมาณ × `unit_cost`); ของไม่พอ → `INSUFFICIENT_STOCK` โดยไม่ตัดอะไรเลย; `p_qty <= 0` → `INVALID_QTY`
  - `add_opening_stock(p_ingredient_id uuid, p_qty numeric, p_unit_cost numeric, p_expires_on date, p_zone text) returns uuid` (คืน `lot_id`, movement `opening`; `p_expires_on` ย้อนหลัง → `EXPIRY_IN_PAST`)
  - `adjust_stock(p_ingredient_id uuid, p_delta numeric, p_unit_cost numeric default null, p_expires_on date default null) returns void` — `p_delta > 0` สร้างรอบใหม่ ต้นทุนเริ่มต้น = `p_unit_cost` ถ้าให้มา มิฉะนั้นเท่าต้นทุนเฉลี่ยถ่วงน้ำหนักของรอบที่ยังไม่หมดอายุ (ไม่มีเลย = 0) movement `count_adjust`; `p_delta < 0` เรียก `consume_fefo(..., 'count_adjust')` ด้วย `-p_delta`
  - `discard_lot(p_lot_id uuid) returns void` — ตัดยอดคงเหลือของรอบนั้นเป็น 0 ด้วย movement `waste` (รอบเหลือ 0 อยู่แล้ว → `INVALID_QTY`)
  - view `ingredient_stock(ingredient_id uuid, qty_available numeric)` (`security_invoker = true`, นับเฉพาะรอบที่ไม่หมดอายุ; วัตถุดิบที่ไม่มีรอบเลยต้องขึ้น 0 ไม่ใช่หายไป)

- [ ] **Step 1: เขียน pgTAP ที่ล้ม** (ตั้งวันที่แบบสัมพัทธ์กับ `today_bkk()`): ไข่ รอบ A 10 ชิ้น หมดอายุ +3 วัน ทุน 2; รอบ B 10 ชิ้น +7 วัน ทุน 3; รอบ C 10 ชิ้น ไม่มีวันหมดอายุ ทุน 1; รอบ D 5 ชิ้น หมดอายุ −1 วัน
  - `consume_fefo(egg, 14, 'cook')` คืน 32 (A 10×2 + B 4×3), A=0, B=6, C=10, D=5 (ข้าม D และ C ไว้ท้ายสุด)
  - `consume_fefo(egg, 26, ...)` (ของใช้ได้มี 30 แต่ 26 พอ) ตัดถึง C ได้ ส่วน `consume_fefo(egg, 31, ...)` โยน `INSUFFICIENT_STOCK` และยอดทุกรอบไม่เปลี่ยน
  - ไม่มี movement ที่ผลรวมไม่เท่า `qty_remaining` ของรอบนั้น (ความคงที่) หลังทุกกรณี
  - `adjust_stock(egg, +4)` สร้างรอบใหม่ ทุน = (ต้นทุนเฉลี่ยถ่วงน้ำหนักของ A,B,C ที่เหลือ); `adjust_stock(egg, -3)` ตัดตามลำดับ
  - `discard_lot(D)` ทำให้ D=0 และมี movement `waste` −5; รอบ D ยังไม่ถูกลบ
  - `ingredient_stock` ของวัตถุดิบที่ไม่มีรอบเลย = 0
- [ ] **Step 2:** `npm run test:db` ต้องล้ม
- [ ] **Step 3:** เขียน migration ตามลายเซ็น (ใช้ `select ... for update` ในลำดับเดียวกับที่ตัด เพื่อกัน deadlock)
- [ ] **Step 4:** `npm run test:db` ต้องผ่าน
- [ ] **Step 5: Commit** `feat(db): stock functions with FEFO`

---

### Task 4: บันทึกการทำและยกเลิก

**Files:**
- Create: `supabase/migrations/0003_cooking.sql`, `supabase/tests/0003_cooking.test.sql`

**Interfaces:**
- Consumes: `consume_fefo`, `ingredient_stock`, ตาราง `menus`, `recipe_items`, `cooking_logs`
- Produces:
  - `record_cooking(p_menu_id uuid, p_qty numeric, p_note text default null) returns uuid` — ตรวจ `p_qty > 0` (`INVALID_QTY`), สูตรมีวัตถุดิบ ≥ 1 (`RECIPE_EMPTY`), รายการอาหารและวัตถุดิบในสูตรไม่ `archived` (`NOT_FOUND`); ปริมาณตัดต่อวัตถุดิบ = `round(recipe.qty * p_qty / (yield_pct/100), 4)`; สร้างแถว `cooking_logs` (`status='done'`) แล้วเรียก `consume_fefo(..., 'cook', log_id)` ต่อวัตถุดิบ รวม `total_cost`; ทั้งหมดใน transaction เดียว ถ้าวัตถุดิบใดไม่พอ ไม่ตัดอะไรเลยและ `INSUFFICIENT_STOCK` พร้อม `detail` เป็น JSON รายการที่ขาด `[{"ingredient_id":..., "short_qty":...}]` คืน `cooking_log_id`
  - `cancel_cooking(p_cooking_log_id uuid) returns void` — สถานะ `cancelled` อยู่แล้ว → `ALREADY_CANCELLED`; มิฉะนั้นเขียน movement `cook_reversal` บวกกลับเข้ารอบเดิมตามจำนวนของ movement `cook` ของบันทึกนั้น (รวมรอบที่หมดอายุแล้ว) แล้วตั้ง `status='cancelled'`
  - view `menu_availability(menu_id uuid, plates_possible integer)` = `floor(min(qty_available / (recipe.qty / (yield_pct/100))))` ของทุกวัตถุดิบในสูตร ไม่มีของ = 0 (ห้ามหารด้วยศูนย์; รายการอาหารไม่มีสูตรไม่ต้องอยู่ใน view)
  - `menu_shortage(p_menu_id uuid, p_qty numeric) returns table(ingredient_id uuid, short_qty numeric)` — เฉพาะวัตถุดิบที่ขาด

- [ ] **Step 1: เขียน pgTAP ที่ล้ม:** ใช้ไข่ของ Task 3 กับสูตร "ไข่เจียว" = ไข่ 2 ชิ้นต่อจาน yield 100
  - ทำ 7 จาน (ต้อง 14 ชิ้น): `cooking_logs.total_cost = 32`, `status='done'`, A=0, B=6
  - ทำ 100 จาน → `INSUFFICIENT_STOCK` ไม่มีแถว `cooking_logs` เพิ่ม ยอดไม่เปลี่ยน
  - สูตรหมู 100 กรัมต่อจาน yield 85: ทำ 1 จาน ตัด `117.6471` กรัม (`round(100/0.85, 4)`) ต้นทุน = ปริมาณนั้น × `unit_cost`
  - **Review Focus 2:** ทำให้ตัดข้าม 3 รอบ แล้วตั้งให้รอบกลางหมดอายุ (`update` ผ่านสิทธิ์ superuser ในเทสต์) แล้ว `cancel_cooking` → ยอดทุกรอบเท่าเดิมก่อนตัดพอดี ผลรวม movement ต่อรอบ = `qty_remaining`; ยกเลิกซ้ำ → `ALREADY_CANCELLED`
  - **Review Focus 1:** รอบเดียวเหลือ 2 ชิ้น (พอ 1 จาน) เปิดสองเซสชันด้วย `dblink` หรือเรียกต่อเนื่อง 2 ครั้งในเทสต์: ครั้งแรกสำเร็จ ครั้งที่สอง `INSUFFICIENT_STOCK` ไม่มียอดติดลบ (ถ้า `dblink` ไม่สะดวก ให้เขียนเทสต์ลำดับสองครั้ง และตรวจ `check (qty_remaining >= 0)` บน `lots` เป็นเครื่องกั้นชั้นสุดท้าย)
  - **Review Focus 3:** วัตถุดิบที่ไม่มีรอบเลย → `plates_possible = 0`; ทุกรอบหมดอายุ → 0; วัตถุดิบ `archived` ในสูตร → `record_cooking` ได้ `NOT_FOUND`; สูตรว่าง → `RECIPE_EMPTY`; `p_qty = 0` → `INVALID_QTY`
  - `menu_shortage(ไข่เจียว, 100)` ในสถานะเริ่มต้นก่อนทำ (ไข่ใช้ได้ 30 ชิ้น จาก A+B+C ส่วน D หมดอายุไม่นับ) คืนแถวไข่เพียงแถวเดียว `short_qty = 170` (ต้องใช้ 200); `menu_shortage(ไข่เจียว, 15)` คืนว่าง
- [ ] **Step 2:** `npm run test:db` ต้องล้ม
- [ ] **Step 3:** เขียน migration ตามลายเซ็น เพิ่ม `check (qty_remaining >= 0)` บน `lots` หากยังไม่มีใน Task 2
- [ ] **Step 4:** `npm run test:db` ต้องผ่าน
- [ ] **Step 5: Commit** `feat(db): cooking records, cancel, availability`

---

### Task 5: นำเข้าคลัง

**Files:**
- Create: `supabase/migrations/0004_check_in.sql`, `supabase/tests/0004_check_in.test.sql`

**Interfaces:**
- Consumes: `lots`, `stock_movements`, `purchase_units`, `shopping_items`
- Produces: `check_in(p_items jsonb) returns integer` (คืนจำนวนรอบที่ซื้อที่สร้าง) โดยแต่ละสมาชิก `{"shopping_item_id": uuid|null, "ingredient_id": uuid, "purchase_unit_id": uuid, "qty": number, "total_price": number, "expires_on": "YYYY-MM-DD"|null, "zone": "freezer"|"fridge"|"dry"}`; ปริมาณฐาน = `qty × factor`; `unit_cost = total_price / ปริมาณฐาน` (ไม่ปัดเศษ); สร้างรอบ + movement `purchase` และตั้ง `shopping_items.status='checked_in'` ถ้ามี `shopping_item_id`; ทั้งชุดอยู่ใน transaction เดียว

- [ ] **Step 1: เขียน pgTAP ที่ล้ม:** ไข่ซื้อ 2 ถาด (`factor` 30) ราคารวม 150 → รอบใหม่ `qty_remaining = 60`, `unit_cost = 2.5`, movement `purchase` +60, รายการ shopping เป็น `checked_in`; แถวที่สอง วันหมดอายุต่างกัน ได้รอบแยก
  - **Review Focus 4:** `qty = 0`/ลบ → `INVALID_QTY`; `purchase_unit_id` ของวัตถุดิบอื่น → `UNIT_MISMATCH`; `expires_on` ย้อนหลัง → `EXPIRY_IN_PAST`; ชุดที่แถวแรกถูกต้องแต่แถวสองผิด → ไม่มีรอบใดถูกสร้าง (ทั้งชุดย้อนกลับ)
- [ ] **Step 2:** `npm run test:db` ต้องล้ม
- [ ] **Step 3:** เขียน migration ตามลายเซ็น
- [ ] **Step 4:** `npm run test:db` ต้องผ่าน
- [ ] **Step 5: Commit** `feat(db): check_in`

---

### Task 6: วิวการแจ้งเตือน

**Files:**
- Create: `supabase/migrations/0005_alerts.sql`, `supabase/tests/0005_alerts.test.sql`

**Interfaces:**
- Produces (`security_invoker = true`): `alert_expiring(lot_id uuid, ingredient_id uuid, expires_on date, qty_remaining numeric, days_left integer)` — รอบที่ `qty_remaining > 0`, ไม่หมดอายุ และ `expires_on <= today_bkk() + ingredients.expiry_warn_days` เรียงตาม `expires_on`; `alert_low_stock(ingredient_id uuid, qty_available numeric, reorder_point numeric)` — วัตถุดิบ `archived = false` ที่ `reorder_point is not null` และ `qty_available < reorder_point` (ใช้ `ingredient_stock` ซึ่งไม่นับรอบหมดอายุ)

- [ ] **Step 1: เขียน pgTAP ที่ล้ม:** ไข่ `expiry_warn_days = 3`: รอบหมดอายุ +2 วันอยู่ในวิว, +5 วันไม่อยู่, รอบหมดอายุแล้ว (−1) ไม่อยู่, รอบไม่มีวันหมดอายุไม่อยู่; ไข่ `reorder_point = 20` คงเหลือ 15 อยู่ใน `alert_low_stock`, คงเหลือ 20 ไม่อยู่; วัตถุดิบไม่ตั้ง `reorder_point` ไม่อยู่; วัตถุดิบ `archived` ไม่อยู่
- [ ] **Step 2:** `npm run test:db` ต้องล้ม
- [ ] **Step 3:** เขียน migration
- [ ] **Step 4:** `npm run test:db` ต้องผ่าน
- [ ] **Step 5: Commit** `feat(db): alert views`

---

### Task 7: หน้าวัตถุดิบ

**Files:**
- Create: `src/app/(app)/ingredients/page.tsx`, `src/components/ingredient-form.tsx`, `e2e/ingredients.spec.ts`
- Modify: `src/lib/th.ts`, `src/lib/db.ts` (เพิ่ม `DbError` และตัวห่อ `rpc<T>(name: string, args: object): Promise<T>` ที่แปลง error เป็น `DbError(code)`)

**Interfaces:**
- Consumes: `th`, `errorMessage`, `createClient`
- Produces: `class DbError extends Error { code: string }`; `rpc<T>(name, args)` ใช้ซ้ำใน Task 8–11; หน้าที่เพิ่ม/แก้/เก็บถาวร (`archived`) วัตถุดิบ พร้อมชื่อ หน่วยฐาน ช่องเก็บเริ่มต้น จุดสั่งซื้อซ้ำ จำนวนวันเตือนหมดอายุ และจัดการหน่วยซื้อต่อวัตถุดิบ (ชื่อหน่วย + `factor` > 0)

- Also produces (ข้อกำหนดแจ้งผลเมื่อเพิ่ม/ลบ): `src/components/confirm-dialog.tsx` (`ConfirmDialog` props `{ open: boolean; title: string; message: string; confirmLabel: string; cancelLabel: string; destructive?: boolean; onConfirm(): void | Promise<void>; onCancel(): void }`), `src/components/result-dialog.tsx` (`ResultDialog` props `{ open: boolean; title: string; message: string; okLabel: string; onClose(): void }`) และ `notify(message: string): void` ใน `src/components/notify.tsx` (toast เล็กที่หายเองใน 2 วินาที, มี `<Notifier />` วางใน `(app)/layout.tsx`); ใช้เป็นต้นแบบให้ Task 8–11 ทุกครั้งที่เพิ่มหรือลบ; เก็บวัตถุดิบถาวรในหน้านี้ต้องผ่านขั้นตอน ConfirmDialog → ResultDialog
- [ ] **Step 1: เขียน e2e ที่ล้ม:** ล็อกอิน → หน้าวัตถุดิบ → เพิ่ม "ไข่" หน่วยฐาน ชิ้น, หน่วยซื้อ "ถาด" = 30 → เห็นแถว "ไข่" และหน่วยซื้อ "ถาด (30 ชิ้น)"; `factor = 0` ถูกปฏิเสธด้วยข้อความไทย; เก็บถาวรแล้วแถวหายจากรายการหลัก
- [ ] **Step 2:** `npm run test:e2e -- ingredients` ต้องล้ม
- [ ] **Step 3:** เขียนหน้าและฟอร์ม (Zod ตรวจ `factor > 0`, ชื่อไม่ว่าง) ข้อความทั้งหมดเพิ่มใน `th.ts`
- [ ] **Step 4:** `npm run test:e2e -- ingredients` ต้องผ่าน
- [ ] **Step 5: Commit** `feat(ui): ingredients page`

---

### Task 8: หน้าคลังวัตถุดิบ

**Files:**
- Create: `src/app/(app)/pantry/page.tsx`, `src/components/lot-actions.tsx`, `e2e/pantry.spec.ts`

**Interfaces:**
- Consumes: `rpc`, ตาราง/วิว `ingredients`, `lots`, `ingredient_stock`; RPC `add_opening_stock`, `adjust_stock`, `discard_lot`
- Produces: หน้าแสดงวัตถุดิบแยกตามช่องเก็บ (ช่องแช่แข็ง, ตู้เย็น, ตู้แห้ง) ยอดใช้ได้รวม ขยายดูรอบที่ซื้อ (ปริมาณคงเหลือ ต้นทุนต่อหน่วย วันซื้อ วันหมดอายุ (dd/mm/yy) ป้าย "หมดอายุแล้ว" สำหรับรอบหมดอายุ) และปุ่ม: เพิ่มยอดคงเหลือเริ่มต้น, ปรับยอดตามการนับ, ตัดทิ้ง (ใช้กับรอบหมดอายุ)

- [ ] **Step 1: เขียน e2e ที่ล้ม:** เตรียมวัตถุดิบ "ไข่" (ผ่านสคริปต์เตรียมข้อมูลด้วย service-role ใน `e2e/setup`) → เพิ่มยอดคงเหลือเริ่มต้น 10 ชิ้น ทุน 2 บาท พิมพ์วันหมดอายุอนาคตในช่อง `ThaiDateInput` เป็น dd/mm/yy ปี พ.ศ. สองหลัก → เห็นยอดรวม 10 และรอบที่ซื้อ 1 รอบ; ปรับยอด −3 → ยอดเหลือ 7; พิมพ์วันหมดอายุย้อนหลังในฟอร์มเริ่มต้น → เห็นข้อความไทยของ `EXPIRY_IN_PAST`; รอบหมดอายุแสดงป้าย "หมดอายุแล้ว" และไม่รวมในยอดใช้ได้; ตัดทิ้งแล้วรอบเหลือ 0
- [ ] **Step 2:** `npm run test:e2e -- pantry` ต้องล้ม
- [ ] **Step 3:** เขียนหน้าตามที่ระบุ ฟอร์มใช้ Zod; ทุกปุ่มเรียก `rpc` แล้วรีเฟรชข้อมูล แสดงข้อผิดพลาดผ่าน `errorMessage`
- [ ] **Step 4:** `npm run test:e2e -- pantry` ต้องผ่าน
- [ ] **Step 5: Commit** `feat(ui): pantry page`

---

### Task 9: หน้ารายการอาหารและสูตร

**Files:**
- Create: `src/app/(app)/menus/page.tsx`, `src/components/menu-form.tsx`, `src/components/cook-dialog.tsx`, `e2e/menus.spec.ts`

**Interfaces:**
- Consumes: `rpc`, ตาราง `menus`, `recipe_items`, `shopping_items`, วิว `menu_availability`, `menu_shortage`, RPC `record_cooking`
- Produces: ฟอร์มหน้าเดียวขั้นเดียว (ชื่อ + รายการวัตถุดิบ: วัตถุดิบ, ปริมาณต่อ 1 จานเป็นหน่วยฐาน, อัตราที่ใช้ได้จริง % ค่าเริ่มต้น 100) บันทึกเมนูและ `recipe_items` พร้อมกัน **ปุ่มบันทึกปิดใช้งานและขึ้นข้อความไทยถ้าไม่มีวัตถุดิบเลย**; รายการแสดง "ทำได้ N จาน" และต้นทุนประมาณต่อจาน (ราคาทุนเฉลี่ยถ่วงน้ำหนักของรอบที่ไม่หมดอายุ); ปุ่ม **บันทึกการทำ** (เปิดกล่องใส่จำนวนจานและหมายเหตุ) เรียก `record_cooking`; ปุ่ม **เพิ่มของที่ขาดเข้ารายการซื้อของ** (ใส่จำนวนจานที่อยากทำ → เรียก `menu_shortage` → สร้าง `shopping_items` `source='planned_menu'` ต่อวัตถุดิบที่ขาด)

- [ ] **Step 1: เขียน e2e ที่ล้ม:** ข้อมูลเตรียม: ไข่ 10 ชิ้นในคลัง → สร้างรายการอาหาร "ไข่เจียว" ไข่ 2 ชิ้นต่อจาน → เห็น "ทำได้ 5 จาน"; ลองบันทึกโดยไม่เพิ่มวัตถุดิบ → บันทึกไม่ได้; บันทึกการทำ 2 จาน → ที่หน้าคลังไข่เหลือ 6; บันทึกการทำ 10 จาน → เห็นข้อความไทยของ `INSUFFICIENT_STOCK` พร้อมรายการที่ขาด และคลังไม่เปลี่ยน; "เพิ่มของที่ขาด" สำหรับ 10 จาน → ที่หน้ารายการซื้อของมีไข่ในรายการวางแผน
- [ ] **Step 2:** `npm run test:e2e -- menus` ต้องล้ม
- [ ] **Step 3:** เขียนหน้าและคอมโพเนนต์ตามที่ระบุ (บันทึกเมนู+สูตรให้ทำใน RPC หรือสองคำสั่งต่อเนื่องที่ลบเมนูกลับถ้าสูตรล้มเหลว ผู้ปฏิบัติเลือกอย่างใดอย่างหนึ่งแต่ห้ามทิ้งเมนูที่ไม่มีสูตร)
- [ ] **Step 4:** `npm run test:e2e -- menus` ต้องผ่าน
- [ ] **Step 5: Commit** `feat(ui): menus, recipes, record cooking`

---

### Task 10: หน้าประวัติทำอาหาร

**Files:**
- Create: `src/app/(app)/cooking-history/page.tsx`, `e2e/cooking-history.spec.ts`

**Interfaces:**
- Consumes: `cooking_logs` join `menus`, RPC `cancel_cooking`, `record_cooking`
- Produces: รายการเรียงใหม่ไปเก่า (ทำอะไร กี่จาน วันที่ dd/mm/yy ต้นทุน หมายเหตุ สถานะ ทำแล้ว/ยกเลิก) ปุ่มยกเลิกเฉพาะแถว "ทำแล้ว" และปุ่ม **บันทึกการทำ** ที่เปิดกล่องเดียวกับ Task 9 (ใช้ `cook-dialog.tsx` ซ้ำ)

- [ ] **Step 1: เขียน e2e ที่ล้ม:** บันทึกการทำไข่เจียว 2 จาน → ปรากฏในประวัติสถานะ "ทำแล้ว" ต้นทุนถูกต้อง; ยกเลิก → สถานะ "ยกเลิก" ปุ่มยกเลิกหาย และยอดไข่ในคลังกลับเป็นเดิม; หน้าหลักและหน้านี้ไม่มีตัวอักษรละติน
- [ ] **Step 2:** `npm run test:e2e -- cooking-history` ต้องล้ม
- [ ] **Step 3:** เขียนหน้า
- [ ] **Step 4:** `npm run test:e2e -- cooking-history` ต้องผ่าน
- [ ] **Step 5: Commit** `feat(ui): cooking history`

---

### Task 11: หน้ารายการซื้อของ

**Files:**
- Create: `src/app/(app)/shopping/page.tsx`, `src/components/shopping-draft.ts`, `src/components/shopping-planner.tsx`, `src/components/shopping-market.tsx`, `src/components/shopping-draft.test.ts`, `e2e/shopping.spec.ts`

**Interfaces:**
- Consumes: `shopping_items`, `alert_low_stock`, `ingredient_stock`, `purchase_units`, RPC `check_in`
- Produces: `shopping-draft.ts` ส่งออก `type DraftRow = { shoppingItemId: string | null; ingredientId: string; purchaseUnitId: string; qty: string; totalPrice: string; expiresOn: string; zone: 'freezer'|'fridge'|'dry'; ticked: boolean }`, `loadDraft(): DraftRow[]`, `saveDraft(rows: DraftRow[]): void`, `clearDraft(): void` (เก็บใน `localStorage` ครอบ try/catch คีย์เดียว); โหมด **วางแผนซื้อ**: รายการมาจาก `alert_low_stock` (ปุ่มเพิ่มเข้ารายการ), `planned_menu` ที่มาจากหน้ารายการอาหาร, และเพิ่มเอง; ถ้าวัตถุดิบในรายการยังมีใน `ingredient_stock > 0` แสดง "ยังมีอยู่ X (หมดอายุ วันที่ Y)"; โหมด **จ่ายตลาด**: ติ๊กของที่ซื้อ กรอกปริมาณ หน่วยซื้อ ราคารวม วันหมดอายุ ช่องเก็บ แล้วกด **นำเข้าคลัง** เรียก `check_in` ด้วยแถวที่ติ๊ก

- [ ] **Step 1: เขียน Vitest ที่ล้ม** (`shopping-draft.test.ts`): `saveDraft` แล้ว `loadDraft` ได้ข้อมูลเดิม; `clearDraft` แล้ว `loadDraft()` คือ `[]`; `localStorage` โยน error → `loadDraft()` คืน `[]` ไม่ throw
- [ ] **Step 2: เขียน e2e ที่ล้ม:** ไข่ต่ำกว่าจุดสั่งซื้อซ้ำ → ปรากฏในข้อเสนอ "ของใกล้หมด" เพิ่มเข้ารายการแล้วเห็นข้อความ "ยังมีอยู่ ..." ถ้ามีของ; โหมดจ่ายตลาด ติ๊กไข่ 2 ถาด ราคา 150 พิมพ์วันหมดอายุอนาคตเป็น dd/mm/yy กรอกแล้วรีเฟรชหน้า (ฉบับร่างยังอยู่) → นำเข้าคลัง → ที่หน้าคลังมีรอบใหม่ 60 ชิ้น ทุน 2.50 บาท และฉบับร่างถูกล้าง; กรอกวันหมดอายุย้อนหลัง → ข้อความไทยของ `EXPIRY_IN_PAST` และไม่มีรอบเพิ่ม
- [ ] **Step 3:** รัน `npm test` และ `npm run test:e2e -- shopping` ต้องล้ม
- [ ] **Step 4:** เขียนไฟล์ฉบับร่าง หน้า และคอมโพเนนต์ตามที่ระบุ บันทึกฉบับร่างทุกครั้งที่แก้แถว
- [ ] **Step 5:** รัน `npm test` และ `npm run test:e2e -- shopping` ต้องผ่าน
- [ ] **Step 6: Commit** `feat(ui): shopping list with market mode and draft`

---

### Task 12: หน้าหลัก

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Create: `e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `alert_expiring`, `alert_low_stock`, `cooking_logs`
- Produces: การ์ดการแจ้งเตือน 2 กลุ่ม **ใกล้หมดอายุ** (วัตถุดิบ ปริมาณ วันหมดอายุ เหลืออีกกี่วัน) และ **ของใกล้หมด** (คงเหลือเทียบจุดสั่งซื้อซ้ำ พร้อมปุ่มเพิ่มเข้ารายการซื้อของ) และรายการ ประวัติทำอาหารล่าสุด 5 รายการ ถ้ากลุ่มว่างแสดงข้อความไทยว่าไม่มีรายการ

- [ ] **Step 1: เขียน e2e ที่ล้ม:** เตรียมรอบไข่หมดอายุใน 2 วัน และไข่คงเหลือต่ำกว่าจุดสั่งซื้อซ้ำ → หน้าหลักเห็นทั้งสองกลุ่ม; ปุ่มเพิ่มเข้ารายการซื้อของ → ไปปรากฏที่หน้ารายการซื้อของ; ไม่มีข้อมูล → เห็นข้อความว่าง ไม่ error
- [ ] **Step 2:** `npm run test:e2e -- dashboard` ต้องล้ม
- [ ] **Step 3:** เขียนหน้า
- [ ] **Step 4:** `npm run test:e2e -- dashboard` ต้องผ่าน
- [ ] **Step 5: Commit** `feat(ui): dashboard alerts`

---

### Task 13: ตรวจภาษาทั้งแอป ข้อผิดพลาดกลาง และนำขึ้นใช้งานจริง

**Files:**
- Create: `e2e/language-scan.spec.ts`, `e2e/error-fallback.spec.ts`, `docs/deploy.md`
- Modify: `playwright.config.ts` (ถ้าจำเป็น)

**Interfaces:**
- Consumes: ทุกหน้าจาก Task 1–12
- Produces: เทสต์สแกนภาษาที่เข้าทุกเส้นทาง (`/login`, `/`, `/pantry`, `/ingredients`, `/menus`, `/cooking-history`, `/shopping`) รวบรวมข้อความที่มองเห็น (`innerText`) บวกค่า `placeholder`, `title`, `aria-label`, `alt` ตัดคำที่อนุญาต (`Inven2Food`, `Email`, `Password`) และข้อมูลที่ผู้ใช้พิมพ์เอง (ข้อมูลเตรียมในเทสต์ใช้ชื่อไทยล้วน) แล้ว assert ไม่มีตัวอักษรละติน; เทสต์ข้อผิดพลาดกลาง (Review Focus ข้อ 5) บล็อกการเรียก Supabase ด้วย `page.route` ให้ล้มแล้วตรวจว่าขึ้นข้อความไทยกลาง ๆ และไม่มีข้อความอังกฤษดิบ; `docs/deploy.md` ขั้นตอนสร้างโปรเจกต์ Supabase คลาวด์ รัน `supabase link` + `supabase db push` สร้างบัญชีเจ้าของร้าน (ปิดสมัครสมาชิกใหม่ใน Auth settings ของคลาวด์) ตั้ง environment variables บน Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` เท่านั้น) และ deploy

- [ ] **Step 1: เขียนเทสต์ทั้งสองไฟล์ที่ล้ม** ตามที่ระบุ (ถ้ามีหน้าไหนยังมีอังกฤษหลุด เทสต์ต้องชี้ว่าหน้าไหนและข้อความอะไร)
- [ ] **Step 2:** `npm run test:e2e -- language-scan error-fallback` รันแล้วดูผล แก้ข้อความที่หลุดใน `th.ts` หรือคอมโพเนนต์จนผ่านทั้งหมด
- [ ] **Step 3:** รันชุดเทสต์เต็ม: `npm test && npm run test:db && npm run test:e2e` ต้องผ่านทั้งหมด
- [ ] **Step 4:** เขียน `docs/deploy.md` ตามที่ระบุ แล้วทำตามกับโปรเจกต์ Supabase คลาวด์ (ผู้ใช้ต้องสร้างบัญชี Supabase/Vercel เอง ผู้ปฏิบัติหยุดถามถ้ายังไม่มี) ตรวจบนเว็บจริงด้วยมือ: ล็อกอิน เพิ่มวัตถุดิบ นำเข้าคลัง บันทึกการทำ ยกเลิก และลองสมัครสมาชิกใหม่ต้องทำไม่ได้
- [ ] **Step 5: Commit** `test: language scan, error fallback; docs: deploy`

---

## Self-Review

**ครอบคลุมสเปก:** 5.1 รายการซื้อของ (วางแผน 3 แหล่ง, เตือนซื้อซ้ำ, จ่ายตลาด, นำเข้าคลัง, แปลงหน่วย, ฉบับร่าง) → Task 5, 9, 11 · 5.2 คลัง (รอบที่ซื้อ, ช่องเก็บ, ledger, ยอดเริ่มต้น, ปรับยอด, ตัดทิ้ง) → Task 2, 3, 8 · 5.3 รายการอาหารและบันทึกการทำ (ฟอร์มขั้นเดียว ≥ 1 วัตถุดิบ, yield, ตรวจความพร้อม, ตัดตามลำดับ FEFO, ของไม่พอไม่ตัด, ยกเลิก, ประวัติ) → Task 4, 9, 10 · 5.4 การแจ้งเตือน 2 กลุ่ม → Task 6, 12 · หัวข้อ 6 ต้นทุน → Task 3, 4, 9 · กฎภาษาไทย → Task 1, 13 · ความปลอดภัย (RLS, ปิดสมัคร, ไม่ใช้ service-role ในหน้าเว็บ) → Task 1, 2, 13 · โซนเวลา → Task 2, 3

**ความสอดคล้องของชื่อ:** `consume_fefo`, `record_cooking`, `cancel_cooking`, `check_in`, `add_opening_stock`, `adjust_stock`, `discard_lot`, `menu_shortage`, `today_bkk`, `rpc`, `DbError`, `errorMessage` ใช้ตรงกันทุก task

**ที่ตัดสินใจเองในแผนนี้ (ไม่ได้อยู่ในสเปก ให้ตรวจ):** ฟังก์ชันแก้ยอดเป็น `SECURITY DEFINER` เพราะต้องถอดสิทธิ์เขียนตรง; วันหมดอายุย้อนหลังตอนนำเข้าคลังและยอดคงเหลือเริ่มต้นถูกปฏิเสธ (`EXPIRY_IN_PAST`); การปรับยอดเพิ่มตอนไม่มีรอบเหลือใช้ต้นทุน 0; เส้นทาง URL เป็นภาษาอังกฤษ; ใช้ Supabase แบบ local ระหว่างพัฒนา
