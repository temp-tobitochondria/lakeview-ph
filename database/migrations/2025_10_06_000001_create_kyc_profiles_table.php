<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('kyc_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            // Minimal for now: keep only status; detailed fields will be added later
            $table->string('status')->default('draft'); // draft|pending_review|verified|needs_changes|rejected
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kyc_profiles');
    }
};
