<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('population_rasters') && !Schema::hasColumn('population_rasters','ingestion_step')) {
            Schema::table('population_rasters', function (Blueprint $table) {
                $table->string('ingestion_step', 64)->nullable()->after('status');
                $table->index(['status','ingestion_step']);
            });
        }
    }
    public function down(): void
    {
        if (Schema::hasTable('population_rasters') && Schema::hasColumn('population_rasters','ingestion_step')) {
            Schema::table('population_rasters', function (Blueprint $table) {
                $table->dropColumn('ingestion_step');
            });
        }
    }
};
