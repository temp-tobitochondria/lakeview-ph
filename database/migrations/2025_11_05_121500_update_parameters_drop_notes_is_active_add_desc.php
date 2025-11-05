<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parameters', function (Blueprint $table) {
            if (Schema::hasColumn('parameters', 'is_active')) {
                $table->dropColumn('is_active');
            }
            if (Schema::hasColumn('parameters', 'notes')) {
                $table->dropColumn('notes');
            }
            if (!Schema::hasColumn('parameters', 'desc')) {
                $table->text('desc')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('parameters', function (Blueprint $table) {
            if (!Schema::hasColumn('parameters', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }
            if (!Schema::hasColumn('parameters', 'notes')) {
                $table->text('notes')->nullable();
            }
            if (Schema::hasColumn('parameters', 'desc')) {
                $table->dropColumn('desc');
            }
        });
    }
};
