# SakthiHR — Database Structure for Microsoft Access

Generated 2026-06-17 from the live Supabase (Postgres) `public` schema.

## Files
- **SakthiHR_Access_Schema.sql** — `CREATE TABLE` statements for every table
  (Access/Jet data types, primary keys) followed by all `FOREIGN KEY`
  relationships. Structure only — no data, no RLS, no Postgres defaults/checks.
- **Import_To_Access.bas** — a VBA module that builds the whole structure in one run.

## Import into Access (recommended — one click)
1. Open Microsoft Access → **Blank database** → save it **in this folder**
   (e.g. `SakthiHR.accdb`).
2. Press **Alt+F11** (VBA editor) → **Insert ▸ Module** → paste the contents of
   `Import_To_Access.bas`.
3. Press **F5** (or run `BuildSchema`). All ~51 tables and their
   relationships are created. A message box reports how many statements ran;
   press **Ctrl+G** for any that were skipped.

## Import manually (no VBA)
Open `SakthiHR_Access_Schema.sql`, and in Access use **Create ▸ Query Design ▸
SQL View**, paste **one** statement at a time and **Run**. Do all the
`CREATE TABLE` statements first, then the `ALTER TABLE … FOREIGN KEY` ones.

## Notes / fidelity
- `uuid` → `TEXT(38)`, `text`/`json`/`jsonb`/array → `LONGTEXT` (Memo),
  `integer` → `INTEGER` (Long), `numeric`/`bigint`/float → `DOUBLE`,
  `boolean` → `YESNO`, `timestamp`/`date` → `DATETIME`.
- Foreign keys use `ON DELETE CASCADE` where the source uses it; `SET NULL`
  rules become plain references (Access DDL has no `SET NULL`).
- A true binary `.accdb` can only be authored by the Access engine (Windows),
  so this export is the portable DDL + importer rather than a prebuilt file.
