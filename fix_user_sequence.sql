-- Fix users table sequence after manual inserts
-- This resets the sequence to the max ID + 1

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
