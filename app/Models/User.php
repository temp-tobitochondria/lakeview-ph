<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * System/base role is kept here (Option A): 'user' | 'superadmin'.
     * Org-scoped roles (org_admin, contributor) live in user_tenants.
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',                 // <= keep baseline here (usually 'user' or 'superadmin')
        'occupation',
        'occupation_other',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
    ];

    /* ----------------------------------------
     | Relationships
     |-----------------------------------------*/

    // Org-scoped roles via pivot (user_tenants)
    public function roles()
    {
        // Pivot columns: user_id, tenant_id (nullable), role_id, is_active
        return $this->belongsToMany(Role::class, 'user_tenants', 'user_id', 'role_id')
            ->withPivot(['tenant_id', 'is_active'])
            ->withTimestamps();
    }

    // Raw pivot rows if needed elsewhere
    public function userTenants()
    {
        return $this->hasMany(UserTenant::class, 'user_id');
    }

    /**
     * (Optional) Tenants relation, kept for convenience.
     * Not strictly required by Option A, but safe to have.
     */
    public function tenants()
    {
        return $this->belongsToMany(Tenant::class, 'user_tenants', 'user_id', 'tenant_id')
            ->withPivot(['role_id', 'is_active'])
            ->whereNotNull('user_tenants.tenant_id')
            ->withTimestamps();
    }

    /* ----------------------------------------
     | Role helpers
     |-----------------------------------------*/

    // Compute the effective "highest" role for UI/guards
    public function highestRoleName(): string
    {
        // system baseline first
        if ($this->role === 'superadmin') {
            return 'superadmin';
        }

        // then org-scoped memberships
        $rank = ['superadmin' => 4, 'org_admin' => 3, 'contributor' => 2, 'user' => 1];
        $best = 'user';

        foreach ($this->roles as $r) {
            $name = $r->name ?? 'user';
            if (($rank[$name] ?? 0) > ($rank[$best] ?? 0)) {
                $best = $name;
            }
        }

        // baseline when no memberships
        if ($best === 'user' && $this->role && $this->role !== 'superadmin') {
            // keep explicit baseline if you ever use 'public'
            return $this->role;
        }

        return $best;
    }

    public function hasRole(string $roleName, ?int $tenantId = null): bool
    {
        if ($roleName === 'superadmin') {
            return $this->role === 'superadmin';
        }

        // org-scoped check (optionally on a tenant)
        return $this->roles->contains(function ($r) use ($roleName, $tenantId) {
            $ok = ($r->name === $roleName);
            if ($tenantId !== null) {
                $ok = $ok && ((int)($r->pivot->tenant_id) === (int)$tenantId);
            }
            return $ok;
        });
    }

    // In App\Models\User (keep your existing code; just add this method)

    public function hasAnyRole(array $roleNames, ?int $tenantId = null): bool
    {
        foreach ($roleNames as $r) {
            if ($this->hasRole($r, $tenantId)) {
                return true;
            }
        }
        return false;
    }

}
