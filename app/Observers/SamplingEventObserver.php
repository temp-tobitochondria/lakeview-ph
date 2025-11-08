<?php

namespace App\Observers;

use App\Models\SamplingEvent;
use Illuminate\Support\Facades\Cache;

class SamplingEventObserver
{
    public function created(SamplingEvent $event): void
    {
        $this->forgetAdminEvents();
        $this->forgetOrgEvents((int) $event->organization_id);
        $this->forgetContribMyTests((int) ($event->organization_id ?? 0), (int) ($event->created_by_user_id ?? 0));
    }

    public function updated(SamplingEvent $event): void
    {
        $origOrg = $event->getOriginal('organization_id');
        $origStatus = $event->getOriginal('status');
        $origUser = $event->getOriginal('created_by_user_id');

        $orgChanged = $origOrg !== $event->organization_id;
        $statusChanged = $origStatus !== $event->status;
        $creatorChanged = $origUser !== $event->created_by_user_id;

        if ($orgChanged || $statusChanged || $creatorChanged) {
            $this->forgetAdminEvents();
            if ($origOrg) $this->forgetOrgEvents((int) $origOrg);
            if ($event->organization_id) $this->forgetOrgEvents((int) $event->organization_id);
            // contributor keys
            if ($origOrg && $origUser) $this->forgetContribMyTests((int)$origOrg, (int)$origUser);
            if ($event->organization_id && $event->created_by_user_id) $this->forgetContribMyTests((int)$event->organization_id, (int)$event->created_by_user_id);
        }
    }

    public function deleted(SamplingEvent $event): void
    {
        $this->forgetAdminEvents();
        if ($event->organization_id) $this->forgetOrgEvents((int) $event->organization_id);
        if ($event->organization_id && $event->created_by_user_id) $this->forgetContribMyTests((int)$event->organization_id, (int)$event->created_by_user_id);
    }

    protected function forgetAdminEvents(): void
    {
        try { Cache::forget('kpi:admin:events'); } catch (\Throwable $e) {}
    }

    protected function forgetOrgEvents(int $tenantId): void
    {
        try {
            Cache::forget("kpi:org:$tenantId:tests");
            Cache::forget("kpi:org:$tenantId:tests_draft");
            Cache::forget("kpi:contrib:$tenantId:orgtests");
        } catch (\Throwable $e) {}
    }

    protected function forgetContribMyTests(int $tenantId, int $userId): void
    {
        if ($tenantId <= 0 || $userId <= 0) return;
        try { Cache::forget("kpi:contrib:$tenantId:user:$userId:mytests"); } catch (\Throwable $e) {}
    }
}
