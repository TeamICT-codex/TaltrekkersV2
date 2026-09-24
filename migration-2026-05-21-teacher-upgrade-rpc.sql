-- =====================================================
-- VEROUDERD — NIET MEER UITVOEREN
-- =====================================================
--
-- Deze migratie bevatte de leerkrachtcode leesbaar in de broncode (en deze
-- repo is publiek) en zette een admin terug naar 'teacher' wanneer die de
-- code ingaf. Vervangen door:
--
--     migration-2026-09-24-beveiliging-rollen.sql
--
-- De leerkrachtcode wordt daar enkel nog als hash bewaard en ingesteld met:
--     SELECT private.set_teacher_code('kies-hier-een-nieuwe-lange-code');
--
-- Dit bestand opnieuw draaien zou het lek terugzetten; daarom stopt het meteen.
-- =====================================================

DO $$
BEGIN
    RAISE EXCEPTION 'Verouderde migratie: gebruik migration-2026-09-24-beveiliging-rollen.sql';
END $$;
