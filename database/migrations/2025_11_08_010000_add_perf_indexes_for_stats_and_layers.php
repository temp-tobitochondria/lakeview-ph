<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $driver = DB::getDriverName();
        if ($driver !== 'pgsql') {
            // These indexes are Postgres-specific; skip for other drivers
            return;
        }

        // sampling_events: combined lake + organization + date for common filters
        DB::statement("CREATE INDEX IF NOT EXISTS idx_se_lake_org_date ON sampling_events (lake_id, organization_id, sampled_at DESC);");

        // sample_results: partial index to speed parameter filters with non-null values
        // Note: idx_sr_param_event exists (parameter_id, sampling_event_id). This complements it for value-present scans.
        DB::statement("CREATE INDEX IF NOT EXISTS idx_sr_param_value_present ON sample_results (parameter_id) WHERE value IS NOT NULL;");

        // parameters: case-insensitive unique code lookups
        DB::statement("CREATE UNIQUE INDEX IF NOT EXISTS uq_parameters_code_lower ON parameters ((lower(code)));\n");

        // layers: frequent filter combo visibility by body
        DB::statement("CREATE INDEX IF NOT EXISTS idx_layers_body_visibility ON layers (body_type, body_id, visibility);");
    }

    public function down(): void
    {
        $driver = DB::getDriverName();
        if ($driver !== 'pgsql') return;

        DB::statement("DROP INDEX IF EXISTS idx_layers_body_visibility;");
        DB::statement("DROP INDEX IF EXISTS uq_parameters_code_lower;");
        DB::statement("DROP INDEX IF EXISTS idx_sr_param_value_present;");
        DB::statement("DROP INDEX IF EXISTS idx_se_lake_org_date;");
    }
};
