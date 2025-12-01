<?php

use App\Models\User;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\AuditLog;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    ensureRoles();
    // Clean audit logs before each test
    DB::table('audit_logs')->truncate();
});

it('superadmin actions on users should not be visible to org_admin', function () {
    // Create a tenant and org_admin
    $tenant = Tenant::factory()->create(['name' => 'Test Org']);
    $orgAdminRoleId = Role::where('name', Role::ORG_ADMIN)->value('id');
    $orgAdmin = User::factory()->create([
        'name' => 'Org Admin User',
        'email' => 'orgadmin@test.com',
        'role_id' => $orgAdminRoleId,
        'tenant_id' => $tenant->id,
    ]);
    
    // Clear audit logs from factory creation
    DB::table('audit_logs')->truncate();
    
    // Create a superadmin
    $superAdmin = superAdmin();
    
    // Superadmin updates the org_admin user
    $this->actingAs($superAdmin)->putJson("/api/admin/users/{$orgAdmin->id}", [
        'name' => 'Updated Org Admin',
        'email' => $orgAdmin->email,
        'role_id' => $orgAdmin->role_id,
        'tenant_id' => $orgAdmin->tenant_id,
    ])->assertStatus(200);
    
    // Check that audit log was created with tenant_id = NULL (not the org's tenant_id)
    $auditLog = AuditLog::where('model_type', User::class)
        ->where('model_id', $orgAdmin->id)
        ->where('action', 'updated')
        ->latest('event_at')
        ->first();
    
    expect($auditLog)->not->toBeNull()
        ->and($auditLog->tenant_id)->toBeNull('Superadmin actions should have NULL tenant_id')
        ->and($auditLog->actor_id)->toBe($superAdmin->id);
    
    // Verify org_admin CANNOT see this audit log
    $response = $this->actingAs($orgAdmin)->getJson("/api/org/{$tenant->id}/audit-logs");
    $response->assertStatus(200);
    
    $logs = $response->json('data');
    $userUpdateLogs = collect($logs)->filter(function ($log) use ($orgAdmin) {
        return $log['model_type'] === User::class 
            && $log['model_id'] == $orgAdmin->id 
            && $log['action'] === 'updated';
    });
    
    expect($userUpdateLogs)->toHaveCount(0, 'Org admin should NOT see superadmin actions on users');
})->group('audit', 'security');

it('org_admin actions within their org should be visible to themselves', function () {
    // Create tenant and users
    $tenant = Tenant::factory()->create(['name' => 'Test Org']);
    $orgAdminRoleId = Role::where('name', Role::ORG_ADMIN)->value('id');
    $contributorRoleId = Role::where('name', Role::CONTRIBUTOR)->value('id');
    
    $orgAdmin = User::factory()->create([
        'role_id' => $orgAdminRoleId,
        'tenant_id' => $tenant->id,
    ]);
    
    $contributor = User::factory()->create([
        'role_id' => $contributorRoleId,
        'tenant_id' => $tenant->id,
    ]);
    
    // Clear audit logs
    DB::table('audit_logs')->truncate();
    
    // Org admin updates a contributor in their org
    $this->actingAs($orgAdmin)->putJson("/api/org/{$tenant->id}/users/{$contributor->id}", [
        'name' => 'Updated Contributor',
        'email' => $contributor->email,
        'role_id' => $contributor->role_id,
        'tenant_id' => $contributor->tenant_id,
    ])->assertStatus(200);
    
    // Check that audit log has the org's tenant_id
    $auditLog = AuditLog::where('model_type', User::class)
        ->where('model_id', $contributor->id)
        ->where('action', 'updated')
        ->latest('event_at')
        ->first();
    
    expect($auditLog)->not->toBeNull()
        ->and($auditLog->tenant_id)->toBe($tenant->id, 'Org admin actions should have their tenant_id')
        ->and($auditLog->actor_id)->toBe($orgAdmin->id);
    
    // Verify org_admin CAN see this audit log
    $response = $this->actingAs($orgAdmin)->getJson("/api/org/{$tenant->id}/audit-logs");
    $response->assertStatus(200);
    
    $logs = $response->json('data');
    $userUpdateLogs = collect($logs)->filter(function ($log) use ($contributor) {
        return $log['model_type'] === User::class 
            && $log['model_id'] == $contributor->id 
            && $log['action'] === 'updated';
    });
    
    expect($userUpdateLogs)->toHaveCount(1, 'Org admin should see their own actions');
})->group('audit', 'security');

it('org_admin cannot see actions from another organization', function () {
    // Create two separate organizations
    $tenant1 = Tenant::factory()->create(['name' => 'Org 1']);
    $tenant2 = Tenant::factory()->create(['name' => 'Org 2']);
    
    $orgAdminRoleId = Role::where('name', Role::ORG_ADMIN)->value('id');
    $contributorRoleId = Role::where('name', Role::CONTRIBUTOR)->value('id');
    
    $orgAdmin1 = User::factory()->create([
        'role_id' => $orgAdminRoleId,
        'tenant_id' => $tenant1->id,
    ]);
    
    $orgAdmin2 = User::factory()->create([
        'role_id' => $orgAdminRoleId,
        'tenant_id' => $tenant2->id,
    ]);
    
    $contributor2 = User::factory()->create([
        'role_id' => $contributorRoleId,
        'tenant_id' => $tenant2->id,
    ]);
    
    // Clear audit logs
    DB::table('audit_logs')->truncate();
    
    // Org admin 2 updates a user in their org
    $this->actingAs($orgAdmin2)->putJson("/api/org/{$tenant2->id}/users/{$contributor2->id}", [
        'name' => 'Updated in Org 2',
        'email' => $contributor2->email,
        'role_id' => $contributor2->role_id,
        'tenant_id' => $contributor2->tenant_id,
    ])->assertStatus(200);
    
    // Verify org_admin1 CANNOT see org2's audit logs
    $response = $this->actingAs($orgAdmin1)->getJson("/api/org/{$tenant1->id}/audit-logs");
    $response->assertStatus(200);
    
    $logs = $response->json('data');
    $org2Logs = collect($logs)->filter(function ($log) use ($tenant2) {
        return $log['tenant_id'] === $tenant2->id;
    });
    
    expect($org2Logs)->toHaveCount(0, 'Org admin should NOT see other org audit logs');
})->group('audit', 'security');

it('superadmin can see all audit logs including their own actions', function () {
    $tenant = Tenant::factory()->create(['name' => 'Test Org']);
    $orgAdminRoleId = Role::where('name', Role::ORG_ADMIN)->value('id');
    
    $orgAdmin = User::factory()->create([
        'role_id' => $orgAdminRoleId,
        'tenant_id' => $tenant->id,
    ]);
    
    // Clear audit logs
    DB::table('audit_logs')->truncate();
    
    $superAdmin = superAdmin();
    
    // Superadmin updates org_admin
    $this->actingAs($superAdmin)->putJson("/api/admin/users/{$orgAdmin->id}", [
        'name' => 'Updated by Super',
        'email' => $orgAdmin->email,
        'role_id' => $orgAdmin->role_id,
        'tenant_id' => $orgAdmin->tenant_id,
    ])->assertStatus(200);
    
    // Superadmin can see all logs
    $response = $this->actingAs($superAdmin)->getJson('/api/admin/audit-logs');
    $response->assertStatus(200);
    
    $logs = $response->json('data');
    expect($logs)->not->toBeEmpty('Superadmin should see audit logs');
    
    // Verify the log shows it was a superadmin action (tenant_id = null)
    $userUpdateLogs = collect($logs)->filter(function ($log) use ($orgAdmin) {
        return $log['model_type'] === User::class 
            && $log['model_id'] == $orgAdmin->id 
            && $log['action'] === 'updated';
    });
    
    expect($userUpdateLogs)->toHaveCount(1)
        ->and($userUpdateLogs->first()['tenant_id'])->toBeNull();
})->group('audit', 'security');

