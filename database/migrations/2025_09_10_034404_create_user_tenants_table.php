<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('user_tenants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained()->cascadeOnDelete(); // nullable = global roles
            $table->foreignId('role_id')->constrained('roles');
            $table->timestampTz('joined_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->unique(['user_id','tenant_id','role_id']);
            $table->index(['user_id','is_active']);
            $table->index(['tenant_id','is_active']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('user_tenants');
    }
};
