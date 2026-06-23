-- 20260621040232_letter_templates_language
-- Multi-language letter templates: a format can be authored in a regional language
-- (Tamil, Kannada, Hindi, …). The body holds the regional text; PDF renders as-is.

alter table letter_templates add column if not exists language text not null default 'English';
