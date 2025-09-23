<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * Org admins can manage users inside their org; never superadmins.
     * Superadmin can manage anyone site-wide.
     */
    public function manageTenantUser(User $actor, User $subject, int $tenantId): bool
    {
        if ($actor->isSuperAdmin()) return true;

        // must be org_admin of that tenant
        if (! $actor->hasOrgRole($tenantId, 'org_admin')) return false;

        // subject must be in same tenant and not be a superadmin
        $sameTenant = $subject->inOrg($tenantId);
        $notSuper   = ! $subject->isSuperAdmin();

        return $sameTenant && $notSuper;
    }
}
