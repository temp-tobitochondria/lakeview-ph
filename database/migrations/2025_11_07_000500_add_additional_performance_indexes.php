<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $driver = DB::getDriverName();
        if ($driver !== 'pgsql') {
            // Indexes below are PostgreSQL-specific (GIN/partial/functional).
            return;
        }

        // Ensure pg_trgm is available for trigram indexes
        DB::statement("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

        // USERS: search and filtering performance
        if (Schema::hasTable('users')) {
            if (Schema::hasColumn('users', 'name')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING GIN (lower(name) gin_trgm_ops);");
            }
            if (Schema::hasColumn('users', 'email')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING GIN (lower(email) gin_trgm_ops);");
                // Note: consider adding a UNIQUE index on lower(email) after validating no case-only duplicates exist
                // DB::statement("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users ((lower(email)));");
            }
            if (Schema::hasColumn('users', 'tenant_id') && Schema::hasColumn('users', 'role_id') && Schema::hasColumn('users', 'is_active')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_users_tenant_role_active ON users (tenant_id, role_id, is_active);");
            }
            if (Schema::hasColumn('users', 'created_at')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);");
            }
            if (Schema::hasColumn('users', 'updated_at')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users (updated_at);");
            }
        }

        // TENANTS: quick filter/search
        if (Schema::hasTable('tenants')) {
            if (Schema::hasColumn('tenants', 'active')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants (active);");
            }
            if (Schema::hasColumn('tenants', 'name')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_tenants_name_trgm ON tenants USING GIN (lower(name) gin_trgm_ops);");
            }
            if (Schema::hasColumn('tenants', 'contact_email')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_tenants_contact_email_trgm ON tenants USING GIN (lower(contact_email) gin_trgm_ops);");
            }
        }

        // PARAMETERS: used in options search (ILIKE by name/code)
        if (Schema::hasTable('parameters')) {
            if (Schema::hasColumn('parameters', 'name')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_parameters_name_trgm ON parameters USING GIN (lower(name) gin_trgm_ops);");
            }
            if (Schema::hasColumn('parameters', 'code')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_parameters_code_trgm ON parameters USING GIN (lower(code) gin_trgm_ops);");
            }
        }

        // ORG APPLICATIONS: speed active lists (archived_at IS NULL)
        if (Schema::hasTable('org_applications')) {
            if (Schema::hasColumn('org_applications', 'tenant_id') && Schema::hasColumn('org_applications', 'status') && Schema::hasColumn('org_applications', 'archived_at')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_org_apps_tenant_status_active ON org_applications (tenant_id, status) WHERE archived_at IS NULL;");
            }
            if (Schema::hasColumn('org_applications', 'user_id') && Schema::hasColumn('org_applications', 'archived_at')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_org_apps_user_active ON org_applications (user_id) WHERE archived_at IS NULL;");
            }
        }

        // LAKE FLOWS: match default sort and filters
        if (Schema::hasTable('lake_flows')) {
            if (Schema::hasColumn('lake_flows', 'lake_id') && Schema::hasColumn('lake_flows', 'is_primary') && Schema::hasColumn('lake_flows', 'flow_type') && Schema::hasColumn('lake_flows', 'id')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_lake_flows_list ON lake_flows (lake_id, is_primary DESC, flow_type, id);");
            }
        }

        // EMAIL OTPs: validate active codes quickly
        if (Schema::hasTable('email_otps')) {
            $has = fn($c) => Schema::hasColumn('email_otps', $c);
            if ($has('email') && $has('purpose') && $has('expires_at') && $has('consumed_at')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_email_otps_active ON email_otps (email, purpose, expires_at) WHERE consumed_at IS NULL;");
            }
        }

        // KYC PROFILES: queues and review
        if (Schema::hasTable('kyc_profiles')) {
            if (Schema::hasColumn('kyc_profiles', 'status')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_kyc_profiles_status ON kyc_profiles (status);");
                DB::statement("CREATE INDEX IF NOT EXISTS idx_kyc_profiles_pending ON kyc_profiles (status) WHERE status = 'pending_review';");
            }
            if (Schema::hasColumn('kyc_profiles', 'reviewer_id') && Schema::hasColumn('kyc_profiles', 'reviewed_at')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_kyc_profiles_reviewer_reviewed_at ON kyc_profiles (reviewer_id, reviewed_at);");
            }
        }

        // FEEDBACK: composite for dashboards
        if (Schema::hasTable('feedback')) {
            if (Schema::hasColumn('feedback', 'tenant_id') && Schema::hasColumn('feedback', 'status') && Schema::hasColumn('feedback', 'created_at')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_feedback_tenant_status_date ON feedback (tenant_id, status, created_at);");
            }
        }

        // LAKES: JSONB containment (prefer @> queries); keep existing trigram as fallback for LIKE
        if (Schema::hasTable('lakes')) {
            foreach (['region', 'province', 'municipality'] as $col) {
                if (Schema::hasColumn('lakes', $col)) {
                    DB::statement("CREATE INDEX IF NOT EXISTS idx_lakes_{$col}_gin ON lakes USING GIN (({$col}) jsonb_path_ops);");
                }
            }
        }

        // LAYERS: common filters
        if (Schema::hasTable('layers')) {
            if (Schema::hasColumn('layers', 'body_type') && Schema::hasColumn('layers', 'body_id') && Schema::hasColumn('layers', 'is_downloadable')) {
                DB::statement("CREATE INDEX IF NOT EXISTS idx_layers_body_downloadable ON layers (body_type, body_id, is_downloadable);");
            }
        }

        // WQ STANDARDS: quick current standard lookup
        if (Schema::hasTable('wq_standards') && Schema::hasColumn('wq_standards', 'is_current')) {
            DB::statement("CREATE INDEX IF NOT EXISTS idx_wq_standards_is_current ON wq_standards (is_current) WHERE is_current IS TRUE;");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();
        if ($driver !== 'pgsql') return;

        DB::statement("DROP INDEX IF EXISTS idx_users_name_trgm;");
        DB::statement("DROP INDEX IF EXISTS idx_users_email_trgm;");
        DB::statement("DROP INDEX IF EXISTS idx_users_tenant_role_active;");
        DB::statement("DROP INDEX IF EXISTS idx_users_created_at;");
        DB::statement("DROP INDEX IF EXISTS idx_users_updated_at;");

        DB::statement("DROP INDEX IF EXISTS idx_tenants_active;");
        DB::statement("DROP INDEX IF EXISTS idx_tenants_name_trgm;");
        DB::statement("DROP INDEX IF EXISTS idx_tenants_contact_email_trgm;");

        DB::statement("DROP INDEX IF EXISTS idx_parameters_name_trgm;");
        DB::statement("DROP INDEX IF EXISTS idx_parameters_code_trgm;");

        DB::statement("DROP INDEX IF EXISTS idx_org_apps_tenant_status_active;");
        DB::statement("DROP INDEX IF EXISTS idx_org_apps_user_active;");

        DB::statement("DROP INDEX IF EXISTS idx_lake_flows_list;");

        DB::statement("DROP INDEX IF EXISTS idx_email_otps_active;");

        DB::statement("DROP INDEX IF EXISTS idx_kyc_profiles_status;");
        DB::statement("DROP INDEX IF EXISTS idx_kyc_profiles_pending;");
        DB::statement("DROP INDEX IF EXISTS idx_kyc_profiles_reviewer_reviewed_at;");

        DB::statement("DROP INDEX IF EXISTS idx_feedback_tenant_status_date;");

        DB::statement("DROP INDEX IF EXISTS idx_lakes_region_gin;");
        DB::statement("DROP INDEX IF EXISTS idx_lakes_province_gin;");
        DB::statement("DROP INDEX IF EXISTS idx_lakes_municipality_gin;");

        DB::statement("DROP INDEX IF EXISTS idx_layers_body_downloadable;");

        DB::statement("DROP INDEX IF EXISTS idx_wq_standards_is_current;");
    }
};
