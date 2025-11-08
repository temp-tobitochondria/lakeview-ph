<?php

namespace App\Observers;

use App\Models\Tenant;
use Illuminate\Support\Facades\Cache;

class TenantObserver
{
    public function created(Tenant $tenant): void
    {
        // New org affects admin orgs KPI
        $this->forgetAdminOrgs();
    }

    public function deleted(Tenant $tenant): void
    {
        $this->forgetAdminOrgs();
    }

    protected function forgetAdminOrgs(): void
    {
        try { Cache::forget('kpi:admin:orgs'); } catch (\Throwable $e) {}
    }
}
