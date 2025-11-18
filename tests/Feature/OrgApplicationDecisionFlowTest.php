<?php

use App\Models\Tenant;
use App\Models\Role;
use App\Models\OrgApplication;

it('allows public user to apply, org admin to approve, and user to accept membership', function () {
    // Create organization (tenant)
    $tenant = Tenant::factory()->create(['name' => 'Flow Org']);

    // Applicant (public role)
    $applicant = publicUser();
    $this->actingAs($applicant);

    // Submit application requesting contributor role
    $applyResp = $this->postJson('/api/org-applications', [
        'tenant_id' => $tenant->id,
        'desired_role' => 'contributor',
    ]);
    $applyResp->assertStatus(201)->assertJsonStructure(['data' => ['id','status','desired_role','tenant_id','user_id']]);
    $appId = $applyResp->json('data.id');
    expect($applyResp->json('data.status'))->toBe('pending_kyc'); // initial since KYC draft

    // Early acceptance should fail (not approved yet)
    $earlyAccept = $this->postJson("/api/org-applications/{$appId}/accept");
    $earlyAccept->assertStatus(422);

    // Organization admin for same tenant
    $orgAdmin = orgAdmin($tenant); // helper assigns role + tenant
    $this->actingAs($orgAdmin);

    // List applications for tenant (should include one)
    $listResp = $this->getJson("/api/org/{$tenant->id}/applications");
    $listResp->assertStatus(200)->assertJsonStructure(['data']);
    $rows = $listResp->json('data');
    expect($rows)->toBeArray()->and(count($rows))->toBeGreaterThan(0);
    expect($rows[0]['id'])->toBe($appId);

    // Decide approve
    $decisionResp = $this->postJson("/api/org/{$tenant->id}/applications/{$appId}/decision", [
        'action' => 'approve',
    ]);
    $decisionResp->assertStatus(200)->assertJsonPath('data.status', 'approved');

    // Switch back to applicant and accept offer
    $this->actingAs($applicant->fresh()); // refresh to clear cached relations
    $acceptResp = $this->postJson("/api/org-applications/{$appId}/accept");
    $acceptResp->assertStatus(200)->assertJsonPath('message', 'Membership confirmed.');

    // Verify applicant now member of tenant with contributor role
    $updatedApplicant = $applicant->fresh();
    expect($updatedApplicant->tenant_id)->toBe($tenant->id);
    expect($updatedApplicant->role?->name)->toBe(Role::CONTRIBUTOR);

    // Application archived & accepted timestamps set
    $application = OrgApplication::find($appId);
    expect($application->accepted_at)->not()->toBeNull();
    expect($application->archived_at)->not()->toBeNull();
    expect($application->status)->toBe('approved'); // status remains approved after archive

    // Org admin listing after acceptance excludes archived application
    $this->actingAs($orgAdmin->fresh());
    $postAcceptList = $this->getJson("/api/org/{$tenant->id}/applications");
    $postAcceptList->assertStatus(200);
    expect($postAcceptList->json('data'))->toBeArray()->and(count($postAcceptList->json('data')))->toBe(0);
})->group('org','applications','membership');
