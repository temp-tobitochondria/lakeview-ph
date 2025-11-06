<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Prefer raw SQL on Postgres to avoid requiring doctrine/dbal
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE public.sampling_events DROP COLUMN IF EXISTS "year"');
            DB::statement('ALTER TABLE public.sampling_events DROP COLUMN IF EXISTS "quarter"');
            DB::statement('ALTER TABLE public.sampling_events DROP COLUMN IF EXISTS "month"');
            DB::statement('ALTER TABLE public.sampling_events DROP COLUMN IF EXISTS "day"');
            return;
        }

        // Generic fallback for other drivers
        Schema::table('sampling_events', function (Blueprint $table) {
            foreach (['year', 'quarter', 'month', 'day'] as $col) {
                if (Schema::hasColumn('sampling_events', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }

    public function down(): void
    {
        // Recreate as nullable integers if a rollback is needed
        Schema::table('sampling_events', function (Blueprint $table) {
            foreach (['year', 'quarter', 'month', 'day'] as $col) {
                if (!Schema::hasColumn('sampling_events', $col)) {
                    $table->integer($col)->nullable();
                }
            }
        });
    }
};
