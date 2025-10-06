<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('population_rasters')) {
            Schema::table('population_rasters', function (Blueprint $table) {
                if (!Schema::hasColumn('population_rasters','dataset_id')) {
                    $table->unsignedBigInteger('dataset_id')->nullable()->after('uploaded_by');
                }
                if (!Schema::hasColumn('population_rasters','file_size_bytes')) {
                    $table->unsignedBigInteger('file_size_bytes')->nullable()->after('dataset_id');
                }
                if (!Schema::hasColumn('population_rasters','file_sha256')) {
                    $table->string('file_sha256', 128)->nullable()->after('file_size_bytes');
                }
                if (!Schema::hasColumn('population_rasters','ingestion_started_at')) {
                    $table->timestamp('ingestion_started_at')->nullable()->after('error_message');
                }
                if (!Schema::hasColumn('population_rasters','ingestion_finished_at')) {
                    $table->timestamp('ingestion_finished_at')->nullable()->after('ingestion_started_at');
                }
                // The base creation migration already added an index on year.
                // Avoid duplicating it (causes: relation "population_rasters_year_index" already exists).
                $table->index(['status']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('population_rasters')) {
            Schema::table('population_rasters', function (Blueprint $table) {
                foreach (['dataset_id','file_size_bytes','file_sha256','ingestion_started_at','ingestion_finished_at'] as $col) {
                    if (Schema::hasColumn('population_rasters', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
