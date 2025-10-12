<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.pop_table_for_year(p_year smallint) RETURNS text
    LANGUAGE sql STABLE
AS $$
  SELECT table_name
  FROM pop_dataset_catalog
  WHERE year = p_year AND is_enabled = TRUE AND is_default = TRUE
  ORDER BY id DESC
  LIMIT 1;
$$;
SQL);
    }

    public function down(): void
    {
        // Revert to previous definition if needed (note: this used a non-existent is_active column)
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.pop_table_for_year(p_year smallint) RETURNS text
    LANGUAGE sql STABLE
AS $$
  SELECT table_name
  FROM pop_dataset_catalog
  WHERE year = p_year AND is_active = TRUE AND is_default = TRUE
  ORDER BY id DESC
  LIMIT 1;
$$;
SQL);
    }
};
