<?php

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\Role;
use App\Models\User;
use App\Models\Tenant;

/*
|--------------------------------------------------------------------------
| Pest Bootstrap
|--------------------------------------------------------------------------
| Global test configuration & lightweight helpers.
*/

uses(TestCase::class)->in('Feature');
uses(RefreshDatabase::class)->in('Feature');

function ensureRoles(): void {
    if (Role::count() === 0) {
        Role::query()->insert([
            ['name' => Role::SUPERADMIN, 'scope' => 'system'],
            ['name' => Role::ORG_ADMIN, 'scope' => 'tenant'],
            ['name' => Role::CONTRIBUTOR, 'scope' => 'tenant'],
            ['name' => Role::PUBLIC, 'scope' => 'system'],
        ]);
    }
}

function userWithRole(string $roleName): User {
    ensureRoles();
    $roleId = Role::where('name', $roleName)->value('id');
    // Tenant-scoped roles require a tenant_id; create one automatically when absent.
    $attributes = ['role_id' => $roleId];
    if (in_array($roleName, [Role::CONTRIBUTOR, Role::ORG_ADMIN], true)) {
        $tenant = class_exists(Tenant::class) ? Tenant::factory()->create() : null;
        $attributes['tenant_id'] = $tenant?->id;
    }
    return User::factory()->create($attributes);
}

function superAdmin(): User { return userWithRole(Role::SUPERADMIN); }
function publicUser(): User { return userWithRole(Role::PUBLIC); }
function orgAdmin(?Tenant $tenant = null): User {
    $tenant = $tenant ?: (class_exists(Tenant::class) ? Tenant::factory()->create() : null);
    ensureRoles();
    $roleId = Role::where('name', Role::ORG_ADMIN)->value('id');
    return User::factory()->create(['role_id' => $roleId, 'tenant_id' => $tenant?->id]);
}
