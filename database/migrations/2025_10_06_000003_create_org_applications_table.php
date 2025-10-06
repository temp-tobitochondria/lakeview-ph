<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('org_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('desired_role'); // contributor|org_admin
            $table->string('status')->default('submitted'); // submitted|pending_kyc|pending_org_review|approved|needs_changes|rejected
            $table->text('reviewer_notes')->nullable();
            $table->timestamps();

            $table->unique(['user_id','tenant_id','status']); // prevents duplicate active submissions patterns
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('org_applications');
    }
};
