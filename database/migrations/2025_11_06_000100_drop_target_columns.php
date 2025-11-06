<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ensure any DB-side functions don't reference columns being dropped
        if (DB::getDriverName() === 'pgsql') {
            // Replace evaluate_pass_fail() to stop assigning evaluated_at
            DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.evaluate_pass_fail() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    t_min numeric;
    t_max numeric;
BEGIN
    -- Try lookup by threshold_id if present
    IF NEW.threshold_id IS NOT NULL THEN
        SELECT min_value, max_value
          INTO t_min, t_max
          FROM parameter_thresholds
         WHERE id = NEW.threshold_id;
    ELSE
        -- Fallback by param + class (unit removed)
        SELECT min_value, max_value
          INTO t_min, t_max
          FROM parameter_thresholds
         WHERE parameter_id = NEW.parameter_id
           AND class_code   = NEW.evaluated_class_code
         LIMIT 1;
    END IF;

    -- If nothing found, leave pass_fail NULL
    IF NOT FOUND THEN
        NEW.pass_fail := NULL;
        RETURN NEW;
    END IF;

    -- Evaluate: pass if within [t_min, t_max] (NULLs treated as open bounds)
    IF (t_min IS NULL OR NEW.value >= t_min)
       AND (t_max IS NULL OR NEW.value <= t_max) THEN
        NEW.pass_fail := 'pass';
    ELSE
        NEW.pass_fail := 'fail';
    END IF;

    RETURN NEW;
END;
$$;
SQL);
        }

        // Drop columns guarded by existence checks to be idempotent/safe
        if (Schema::hasTable('water_quality_classes') && Schema::hasColumn('water_quality_classes', 'notes')) {
            Schema::table('water_quality_classes', function (Blueprint $table) {
                $table->dropColumn('notes');
            });
        }

        if (Schema::hasTable('stations') && Schema::hasColumn('stations', 'is_active')) {
            Schema::table('stations', function (Blueprint $table) {
                $table->dropColumn('is_active');
            });
        }

        if (Schema::hasTable('wq_standards')) {
            Schema::table('wq_standards', function (Blueprint $table) {
                $drops = [];
                if (Schema::hasColumn('wq_standards', 'priority')) $drops[] = 'priority';
                if (Schema::hasColumn('wq_standards', 'notes')) $drops[] = 'notes';
                if (!empty($drops)) $table->dropColumn($drops);
            });
        }

        if (Schema::hasTable('lake_flows')) {
            Schema::table('lake_flows', function (Blueprint $table) {
                $drops = [];
                if (Schema::hasColumn('lake_flows', 'latitude')) $drops[] = 'latitude';
                if (Schema::hasColumn('lake_flows', 'longitude')) $drops[] = 'longitude';
                if (!empty($drops)) $table->dropColumn($drops);
            });
        }

        if (Schema::hasTable('layers') && Schema::hasColumn('layers', 'area_km2')) {
            Schema::table('layers', function (Blueprint $table) {
                $table->dropColumn('area_km2');
            });
        }

        if (Schema::hasTable('sample_results') && Schema::hasColumn('sample_results', 'evaluated_at')) {
            Schema::table('sample_results', function (Blueprint $table) {
                $table->dropColumn('evaluated_at');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('water_quality_classes') && !Schema::hasColumn('water_quality_classes', 'notes')) {
            Schema::table('water_quality_classes', function (Blueprint $table) {
                $table->text('notes')->nullable();
            });
        }

        if (Schema::hasTable('stations') && !Schema::hasColumn('stations', 'is_active')) {
            Schema::table('stations', function (Blueprint $table) {
                $table->boolean('is_active')->default(true);
            });
        }

        if (Schema::hasTable('wq_standards')) {
            Schema::table('wq_standards', function (Blueprint $table) {
                if (!Schema::hasColumn('wq_standards', 'priority')) {
                    $table->integer('priority')->nullable();
                }
                if (!Schema::hasColumn('wq_standards', 'notes')) {
                    $table->text('notes')->nullable();
                }
            });
        }

        if (Schema::hasTable('lake_flows')) {
            Schema::table('lake_flows', function (Blueprint $table) {
                if (!Schema::hasColumn('lake_flows', 'latitude')) {
                    $table->decimal('latitude', 10, 6)->nullable();
                }
                if (!Schema::hasColumn('lake_flows', 'longitude')) {
                    $table->decimal('longitude', 10, 6)->nullable();
                }
            });
        }

        if (Schema::hasTable('layers') && !Schema::hasColumn('layers', 'area_km2')) {
            Schema::table('layers', function (Blueprint $table) {
                $table->double('area_km2')->nullable();
            });
        }

        if (Schema::hasTable('sample_results') && !Schema::hasColumn('sample_results', 'evaluated_at')) {
            Schema::table('sample_results', function (Blueprint $table) {
                $table->timestampTz('evaluated_at')->nullable();
            });
        }

        if (DB::getDriverName() === 'pgsql') {
            // Restore function variant that assigns evaluated_at
            DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.evaluate_pass_fail() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    t_min numeric;
    t_max numeric;
BEGIN
    IF NEW.threshold_id IS NOT NULL THEN
        SELECT min_value, max_value
          INTO t_min, t_max
          FROM parameter_thresholds
         WHERE id = NEW.threshold_id;
    ELSE
        SELECT min_value, max_value
          INTO t_min, t_max
          FROM parameter_thresholds
         WHERE parameter_id = NEW.parameter_id
           AND class_code   = NEW.evaluated_class_code
         LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        NEW.pass_fail := NULL;
        RETURN NEW;
    END IF;

    IF (t_min IS NULL OR NEW.value >= t_min)
       AND (t_max IS NULL OR NEW.value <= t_max) THEN
        NEW.pass_fail := 'pass';
    ELSE
        NEW.pass_fail := 'fail';
    END IF;

    NEW.evaluated_at := now();
    RETURN NEW;
END;
$$;
SQL);
        }
    }
};
