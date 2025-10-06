<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('population_rasters')) return;

        Schema::table('population_rasters', function (Blueprint $table) {
            if (!Schema::hasColumn('population_rasters','ingestion_step')) {
                $table->string('ingestion_step', 64)->nullable()->after('status');
            }
        });

        $compositeIndex = 'population_rasters_status_ingestion_step_index';
        $exists = DB::selectOne("SELECT 1 FROM pg_indexes WHERE tablename = 'population_rasters' AND indexname = ?", [$compositeIndex]);
        if (!$exists) {
            try { DB::statement('CREATE INDEX '.$compositeIndex.' ON population_rasters (status, ingestion_step)'); } catch (\Throwable $e) {}
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('population_rasters')) return;
        if (Schema::hasColumn('population_rasters','ingestion_step')) {
            Schema::table('population_rasters', function (Blueprint $table) {
                $table->dropColumn('ingestion_step');
            });
        }
        try { DB::statement('DROP INDEX IF EXISTS population_rasters_status_ingestion_step_index'); } catch (\Throwable $e) {}
    }
};
