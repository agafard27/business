-- Nar Cicegi: sadece okuma / inceleme sorgulari.
-- Bu dosya tablo veya veri olusturmaz, degistirmez, silmez.
USE nar_cicegi;

-- Kurulu surumler.
SELECT version AS sema_surumu, applied_at_utc AS uygulanma_zamani_utc
FROM schema_migrations
ORDER BY version;

-- Tum tablolar.
SELECT TABLE_NAME AS tablo, ENGINE AS motor
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'nar_cicegi' AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Tablolarin birbirine baglandigi yabanci anahtarlar.
SELECT TABLE_NAME AS kaynak_tablo, COLUMN_NAME AS kaynak_alan,
       REFERENCED_TABLE_NAME AS hedef_tablo, REFERENCED_COLUMN_NAME AS hedef_alan
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'nar_cicegi' AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION;
