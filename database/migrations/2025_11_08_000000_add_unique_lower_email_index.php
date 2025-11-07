<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Only applies to PostgreSQL; adjust logic if MySQL/MariaDB are used later.
        $driver = DB::getDriverName();
        if ($driver !== 'pgsql') {
            // For other drivers just add a normal index if missing (case-insensitive handled at app level)
            if (Schema::hasTable('users') && Schema::hasColumn('users', 'email')) {
                // Laravel's Schema builder can't express function index easily; rely on raw if needed.
                try { DB::statement('CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (email)'); } catch (\Throwable $e) {}
            }
            return;
        }

        if (!Schema::hasTable('users') || !Schema::hasColumn('users', 'email')) {
            return; // nothing to do
        }

        // Attempt to create a UNIQUE index on lower(email). If duplicates exist, fall back to non-unique.
        $block = <<<SQL
        DO $$
        DECLARE v_count int;
        BEGIN
            SELECT COUNT(*) INTO v_count FROM (
                SELECT lower(email) AS e_lower, COUNT(*) AS c FROM users GROUP BY lower(email) HAVING COUNT(*) > 1
            ) t;
            IF v_count = 0 THEN
                BEGIN
                    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users ((lower(email)))';
                EXCEPTION WHEN others THEN
                    -- if something unexpected fails, create non-unique for performance at least
                    BEGIN
                        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users ((lower(email)))';
                    EXCEPTION WHEN others THEN NULL; END;
                END;
            ELSE
                -- duplicates detected; create non-unique index so login equality still benefits.
                BEGIN
                    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users ((lower(email)))';
                EXCEPTION WHEN others THEN NULL; END;
            END IF;
        END $$;
        SQL;
        try { DB::statement($block); } catch (\Throwable $e) {}
    }

    public function down(): void
    {
        $driver = DB::getDriverName();
        if ($driver === 'pgsql') {
            try { DB::statement('DROP INDEX IF EXISTS uq_users_email_lower'); } catch (\Throwable $e) {}
            try { DB::statement('DROP INDEX IF EXISTS idx_users_email_lower'); } catch (\Throwable $e) {}
        } else {
            // Non-pg fallback
            try { DB::statement('DROP INDEX idx_users_email_lower'); } catch (\Throwable $e) {}
        }
    }
};
