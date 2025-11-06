<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

return new class extends Migration {
    public function up(): void
    {
        // Drop the bbox column from layers. Prefer raw SQL on Postgres to avoid DBAL requirement.
        try {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement('ALTER TABLE layers DROP COLUMN IF EXISTS bbox');
            } else {
                if (Schema::hasColumn('layers', 'bbox')) {
                    Schema::table('layers', function (Blueprint $table) {
                        $table->dropColumn('bbox');
                    });
                }
            }
        } catch (\Throwable $e) {
            // Fallback: attempt via Schema builder if available
            try {
                if (Schema::hasColumn('layers', 'bbox')) {
                    Schema::table('layers', function (Blueprint $table) {
                        $table->dropColumn('bbox');
                    });
                }
            } catch (\Throwable $ignored) {}
        }
    }

    public function down(): void
    {
        // Best-effort: re-add a geometry column named bbox and backfill with ST_Envelope(geom)
        try {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement('ALTER TABLE layers ADD COLUMN IF NOT EXISTS bbox geometry');
                DB::statement('UPDATE layers SET bbox = ST_Envelope(geom) WHERE bbox IS NULL AND geom IS NOT NULL');
            } else {
                if (!Schema::hasColumn('layers', 'bbox')) {
                    Schema::table('layers', function (Blueprint $table) {
                        // Non-Postgres fallback (type may not be spatial-capable): use binary to avoid platform-specifics
                        $table->binary('bbox')->nullable();
                    });
                }
            }
        } catch (\Throwable $e) {
            // No-op on failure; down() is best-effort for non-Postgres platforms
        }
    }
};
