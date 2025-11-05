<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop indexes first (if they exist), then drop columns
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS idx_parameters_category');
            DB::statement('DROP INDEX IF EXISTS idx_parameters_group');
        }

        Schema::table('parameters', function (Blueprint $table) {
            if (Schema::hasColumn('parameters', 'category')) {
                $table->dropColumn('category');
            }
            if (Schema::hasColumn('parameters', 'group')) {
                $table->dropColumn('group');
            }
        });
    }

    public function down(): void
    {
        Schema::table('parameters', function (Blueprint $table) {
            if (!Schema::hasColumn('parameters', 'category')) {
                $table->string('category')->nullable();
            }
            if (!Schema::hasColumn('parameters', 'group')) {
                $table->string('group')->nullable();
            }
        });

        if (DB::getDriverName() === 'pgsql') {
            // Recreate indexes
            DB::statement('CREATE INDEX IF NOT EXISTS idx_parameters_group ON public.parameters ("group")');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_parameters_category ON public.parameters (category)');
        }
    }
};
