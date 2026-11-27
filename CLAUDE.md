# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Design stage only. There is no application code, no `package.json`, no Supabase project and no git repository yet. Do not invent build, lint or test commands; none exist. The design docs are the only content:

- `docs/superpowers/specs/2026-11-27-inven2food-design.md`: what the system does (product behavior, rules, non-goals, Thai glossary in appendix ก.).
- `docs/superpowers/specs/2026-11-27-inven2food-system-design.md`: how it is built (tech stack, data model, SQL functions, screens, build order, tests).

Both docs and the Thai glossary were approved by the owner on 2026-11-27. The next step is the `superpowers:writing-plans` skill. Docs are written in Thai, so keep new docs in Thai.

**Hard rule from the owner: everything the user sees must be 100% Thai, with no English mixed in.** That covers page names, menus, buttons, tool and feature names, labels, statuses, error messages and the browser tab title. Use the glossary in appendix ก. of the main design doc (for example Pantry = คลังวัตถุดิบ, Check-in = นำเข้าคลัง, FEFO = ใช้ของที่หมดอายุก่อน). English terms in the docs explain concepts to builders and must never reach the screen. Transliterated loanwords written in Thai script are also banned (use รอบที่ซื้อ not ล็อต, รายการอาหาร not เมนู). The only exceptions, all approved by the owner, are the app name **Inven2Food** and the words **Email** and **Password** on the login page. Code identifiers the user never sees (tables, SQL functions, variables, files) stay in English, confirmed by the owner. The glossary was confirmed by the owner. When talking to the owner, use the same Thai terms as the docs.

## What this is

Single-user system for managing the restaurant's ingredients internally: what was bought, when, at what price and quantity; how much was made and used; what is left; which dish uses which ingredients. **Scope decision from the owner: no customer orders, no sales, no selling prices, no order management.** Making food (eating it yourself, tasting, trial recipes, or real cooking) is one single concept: pick a dish and a number of plates, and the ingredients are deducted from the recipe. There are no order statuses and no purposes to choose.

Four connected parts: shopping list (plan and purchase, then "นำเข้าคลัง") → ingredient store (lots, FEFO) → dishes and cooking records (deduction, cost) → alerts (near expiry, near out of stock).

## Planned architecture (big picture)

Next.js (TypeScript) front end on Vercel, talking directly to Supabase (Postgres + Auth) with `supabase-js`. There is no separate API server.

The rule that spans the whole design: **every change to stock quantities goes through SQL functions in the database** (`check_in`, `add_opening_stock`, `record_cooking`, `cancel_cooking`, `adjust_stock`, `discard_lot`). The front end never edits `lots` or `stock_movements` directly. Reasons: `supabase-js` cannot run multi-statement transactions, FEFO deduction across several lots must be all-or-nothing, and `SELECT ... FOR UPDATE` guards against double clicks.

Data model invariants to preserve:
- `stock_movements` is an append-only ledger. `lots.qty_remaining` must always equal the sum of that lot's movements. A lot with movements is never deleted (set it to zero instead).
- One base unit per ingredient (g, ml, piece). Recipes are written in that base unit. Purchase units convert to it through a per-ingredient factor.
- Costs are stored per base unit with no rounding (`numeric(18,8)`).
- FEFO skips expired lots, puts lots with no expiry last, and deducts nothing if stock is insufficient.
- Yield: deducted quantity is recipe quantity ÷ yield, and cost includes the waste.
- A cooking record is `done` or `cancelled` only. Cancelling returns quantities to the original lots. A wrong record is cancelled and re-entered, never edited.
- Whether a lot is expired is judged in Asia/Bangkok time, not UTC.
- Alerts, per-ingredient stock and "how many plates can be made" are views, not stored data.

## Conventions from the design

- Dates are displayed and entered as dd/mm/yy with a two-digit Buddhist-era year (27/11/69, 01/12/69), set by the owner, and stored as ISO. Use the custom ThaiDateInput, never the browser date input. Currency is baht. All UI text lives in one central Thai strings file, and database functions return stable error codes that the front end maps to Thai messages.
- Add/delete feedback (owner chose option ข): deleting or reversing (archive, discard a lot, cancel a cooking record, delete a shopping item) shows a confirm modal first and a result modal after; adding or saving shows only a small auto-dismissing toast (about 2 seconds); failures show a Thai message. Shared components ConfirmDialog, ResultDialog and notify.
- Sign-ups are disabled after the owner's account is created. RLS is on for every table.
- Never put the Supabase service-role key in front-end code.
- Planned test stack: pgTAP (`supabase test db`) for FEFO, unit conversion, yield and cancellation logic, Vitest for helpers, Playwright for the main flows and a scan that fails on Latin text in visible UI. Once the project exists, replace this note with the real commands.
