<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 0) Clean duplicate layers by (body_type, body_id) keeping the newest
        //    so we can add a unique index safely.
        try {
            $dupes = DB::table('layers as l1')
                ->join('layers as l2', function ($j) {
                    $j->on('l1.body_type', '=', 'l2.body_type')
                      ->on('l1.body_id', '=', 'l2.body_id')
                      ->whereColumn('l1.id', '<', 'l2.id');
                })
                ->select('l1.body_type', 'l1.body_id')
                ->groupBy('l1.body_type', 'l1.body_id')
                ->get();

            foreach ($dupes as $d) {
                // Keep the latest by id (assumes monotonic id) and delete others
                $keep = DB::table('layers')
                    ->where('body_type', $d->body_type)
                    ->where('body_id', $d->body_id)
                    ->orderByDesc('id')
                    ->first();
                if ($keep) {
                    DB::table('layers')
                        ->where('body_type', $d->body_type)
                        ->where('body_id', $d->body_id)
                        ->where('id', '<>', $keep->id)
                        ->delete();
                }
            }
        } catch (\Throwable $e) {
            // best-effort cleanup; continue
        }

        // 1) Drop any triggers or functions that relied on is_active toggling
        try {
            // Known trigger name from legacy errors
            DB::unprepared('DROP TRIGGER IF EXISTS trg_layers_on_activate ON layers;');
            // Possible alternate naming (defensive)
            DB::unprepared('DROP TRIGGER IF EXISTS tg_layers_on_activate ON layers;');
            DB::unprepared('DROP TRIGGER IF EXISTS layers_on_activate_trg ON layers;');

            // Function that implements the toggle behavior
            DB::unprepared('DROP FUNCTION IF EXISTS public.layers_on_activate();');

            // In case any old insert/update hooks existed with different names
            DB::unprepared('DROP TRIGGER IF EXISTS tg_layers_on_insert ON layers;');
            DB::unprepared('DROP FUNCTION IF EXISTS fn_layers_on_insert();');
        } catch (\Throwable $e) {}

        // 2) Remove is_active column if present
        if (Schema::hasColumn('layers', 'is_active')) {
            // Drop related indexes defensively using raw SQL with IF EXISTS (Blueprint dropIndex will error if not present)
            try { DB::unprepared('DROP INDEX IF EXISTS uq_layers_active_per_body;'); } catch (\Throwable $e) {}
            try { DB::unprepared('DROP INDEX IF EXISTS "layers_is_active_idx";'); } catch (\Throwable $e) {}
            try { DB::unprepared('DROP INDEX IF EXISTS "layers_body_is_active_idx";'); } catch (\Throwable $e) {}
            Schema::table('layers', function (Blueprint $table) {
                $table->dropColumn('is_active');
            });
        }

        // 3) Enforce one layer per body
        Schema::table('layers', function (Blueprint $table) {
            $name = 'uq_layers_one_per_body';
            // Guard against duplicate creation in case of partial runs
            try { $table->unique(['body_type', 'body_id'], $name); } catch (\Throwable $e) {}
        });
    }

    public function down(): void
    {
        // Re-add is_active (default true) for rollback compatibility
        if (!Schema::hasColumn('layers', 'is_active')) {
            Schema::table('layers', function (Blueprint $table) {
                $table->boolean('is_active')->default(true)->after('visibility');
            });
        }
        // Drop unique constraint
        Schema::table('layers', function (Blueprint $table) {
            try { $table->dropUnique('uq_layers_one_per_body'); } catch (\Throwable $e) {}
        });
        // Note: triggers are not recreated on down.
    }
};
