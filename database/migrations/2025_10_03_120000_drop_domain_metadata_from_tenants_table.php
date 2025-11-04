<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Archive existing domain/metadata values (if any) and drop the columns.
     * This migration is intentionally non-reversible for data content.
     */
    public function up(): void
    {
        if (!Schema::hasTable('tenants')) {
            return; // Nothing to do
        }
        $driver = Schema::getConnection()->getDriverName();

        // Archive rows only if at least one of the columns still exists.
        $archiveNeeded = Schema::hasColumn('tenants', 'domain') || Schema::hasColumn('tenants', 'metadata');
        if ($archiveNeeded) {
            // Only run archive DDL/DML on PostgreSQL; skip for SQLite and others used in tests.
            if ($driver === 'pgsql') {
                // Create archive table if not exists (idempotent) - minimal structure.
                DB::statement(<<<SQL
                    CREATE TABLE IF NOT EXISTS tenant_removed_columns_archive (
                        tenant_id BIGINT PRIMARY KEY,
                        domain TEXT NULL,
                        metadata JSONB NULL,
                        archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                SQL);

                // Insert existing values (one-time; ignore if already archived for a given tenant_id)
                if (Schema::hasColumn('tenants', 'domain') || Schema::hasColumn('tenants', 'metadata')) {
                    DB::statement(<<<SQL
                        INSERT INTO tenant_removed_columns_archive (tenant_id, domain, metadata)
                        SELECT id, domain, metadata FROM tenants
                        WHERE (domain IS NOT NULL OR (metadata IS NOT NULL AND metadata::text <> '{}'))
                        ON CONFLICT (tenant_id) DO NOTHING
                    SQL);
                }
            }
        }
        // SQLite in tests struggles with dropping columns tied to existing indexes; skip drops for sqlite.
        if ($driver !== 'sqlite') {
            Schema::table('tenants', function (Blueprint $table) {
                if (Schema::hasColumn('tenants', 'domain')) {
                    $table->dropColumn('domain');
                }
                if (Schema::hasColumn('tenants', 'metadata')) {
                    $table->dropColumn('metadata');
                }
            });
        }
    }

    /**
     * Down migration (non-restorative for data). Recreates empty columns so code relying on them could be reintroduced.
     * Archived data is NOT automatically restored.
     */
    public function down(): void
    {
        if (!Schema::hasTable('tenants')) {
            return;
        }

        Schema::table('tenants', function (Blueprint $table) {
            if (!Schema::hasColumn('tenants', 'domain')) {
                $table->string('domain')->nullable()->unique();
            }
            if (!Schema::hasColumn('tenants', 'metadata')) {
                // Use jsonb if PostgreSQL; for portability, jsonb assumed. Adjust if using MySQL.
                $table->jsonb('metadata')->nullable();
            }
        });
    }
};
