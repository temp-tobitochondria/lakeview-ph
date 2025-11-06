<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Convert timestamptz -> date while preserving the Asia/Manila calendar date
        DB::statement(<<<SQL
            ALTER TABLE sampling_events
            ALTER COLUMN sampled_at TYPE date
            USING ((sampled_at AT TIME ZONE 'Asia/Manila')::date)
        SQL);
    }

    public function down(): void
    {
        // Best-effort rollback: date -> timestamptz, assume midnight Asia/Manila
        DB::statement(<<<SQL
            ALTER TABLE sampling_events
            ALTER COLUMN sampled_at TYPE timestamptz
            USING ((sampled_at::timestamp AT TIME ZONE 'Asia/Manila'))
        SQL);
    }
};
