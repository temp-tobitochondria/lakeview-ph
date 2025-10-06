<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('pop_dataset_catalog')) {
            Schema::create('pop_dataset_catalog', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->smallInteger('year');
                $table->text('table_name')->unique();
                $table->boolean('is_enabled')->default(true);
                $table->boolean('is_default')->default(false);
                $table->timestamps();
            });
        }

        $fn = <<<'SQL'
CREATE OR REPLACE FUNCTION pop_enable_dataset(p_id BIGINT, p_make_default BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE pop_dataset_catalog SET is_enabled = TRUE, updated_at = now() WHERE id = p_id;
  IF p_make_default THEN
    UPDATE pop_dataset_catalog SET is_default = FALSE WHERE year = (SELECT year FROM pop_dataset_catalog WHERE id = p_id) AND id <> p_id;
    UPDATE pop_dataset_catalog SET is_default = TRUE, updated_at = now() WHERE id = p_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
SQL;

        try {
            DB::unprepared($fn);
                } catch (\Throwable $e) {}
    }

    public function down(): void
    {
        try { DB::unprepared('DROP FUNCTION IF EXISTS pop_enable_dataset(BIGINT, BOOLEAN)'); } catch (\Throwable $e) {}

        if (Schema::hasTable('pop_dataset_catalog')) {
            Schema::drop('pop_dataset_catalog');
        }
    }
};
