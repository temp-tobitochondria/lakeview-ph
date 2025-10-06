<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('population_rasters')) {
            Schema::create('population_rasters', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->smallInteger('year');
                $table->string('filename');
                $table->string('disk')->default('local');
                $table->string('path'); // relative path within disk
                $table->integer('srid')->nullable();
                $table->decimal('pixel_size_x',12,6)->nullable();
                $table->decimal('pixel_size_y',12,6)->nullable();
                $table->unsignedBigInteger('uploaded_by')->nullable();
                $table->string('status')->default('uploaded'); // uploaded|ingesting|ready|error
                $table->text('notes')->nullable();
                $table->text('error_message')->nullable();
                $table->timestamps();
                $table->index(['year']);
                $table->foreign('uploaded_by')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('population_rasters')) {
            Schema::drop('population_rasters');
        }
    }
};
