<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Use raw SQL for Postgres/PostGIS safety
        DB::statement('ALTER TABLE sampling_events DROP COLUMN IF EXISTS geom_point');
    }

    public function down(): void
    {
        // Restore geometry(Point,4326); adjust if your platform differs
        DB::statement('ALTER TABLE sampling_events ADD COLUMN geom_point geometry(Point,4326)');
    }
};
