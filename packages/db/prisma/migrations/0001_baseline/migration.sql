-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RfiStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ANSWERED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RfiPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('PRE_POUR_CONCRETE', 'SUBSTRUCTURE_EXCAVATION', 'REBAR_VERIFICATION', 'SCAFFOLDING_SAFETY', 'WATERPROOFING_FLOOD_TEST', 'MEP_PRESSURE_TEST', 'PRE_PLASTER_WALLING', 'PRE_HANDOVER_INSPECTION');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PENDING_CONSULTANT_REVIEW', 'APPROVED_WITHOUT_COMMENTS', 'APPROVED_WITH_CONDITIONS', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConcreteClass" AS ENUM ('CLASS_15_20', 'CLASS_20_20', 'CLASS_25_20', 'CLASS_30_20', 'CLASS_35_20', 'CLASS_40_20');

-- CreateEnum
CREATE TYPE "SnagSeverity" AS ENUM ('COSMETIC', 'FUNCTIONAL', 'CRITICAL_SAFETY');

-- CreateEnum
CREATE TYPE "SnagStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'RECTIFIED_BY_CONTRACTOR', 'VERIFIED_CLOSED', 'CONTESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('PRACTICAL_COMPLETION', 'MAKING_GOOD_DEFECTS', 'FINAL_PAYMENT_CERTIFICATE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "kra_pin" VARCHAR(20),
    "nca_category" VARCHAR(50),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "phone_number" VARCHAR(30),
    "country" VARCHAR(60),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "co_approval_limit" DECIMAL(15,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "role" VARCHAR(50) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(255),
    "map_latitude" DECIMAL(9,6),
    "map_longitude" DECIMAL(9,6),
    "contract_currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
    "money_at_risk_kes" DECIMAL(15,2),
    "nca_project_no" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "original_contract_sum" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "current_approved_budget" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "closeout_stage" VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
    "practical_completion_date" DATE,
    "start_date" DATE,
    "target_end_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boqs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "source_filename" VARCHAR(255),
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boq_sections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "boq_id" UUID NOT NULL,
    "order_idx" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "boq_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boq_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "item_code" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_rate" DECIMAL(15,4) NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "is_provisional" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_diaries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "entry_date" DATE NOT NULL,
    "weather" VARCHAR(50) NOT NULL,
    "site_status" VARCHAR(50) NOT NULL,
    "general_notes" TEXT,
    "is_non_work_day" BOOLEAN NOT NULL DEFAULT false,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_diaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_photos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_diary_id" UUID NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "caption" VARCHAR(255),
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "taken_at" TIMESTAMPTZ NOT NULL,
    "gps_latitude" DECIMAL(9,6),
    "gps_longitude" DECIMAL(9,6),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_headcounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_diary_id" UUID NOT NULL,
    "trade_type" VARCHAR(100) NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "labor_headcounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_diary_id" UUID NOT NULL,
    "material_name" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "supplier_name" VARCHAR(255),
    "delivery_note" VARCHAR(100),

    CONSTRAINT "material_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "record_date" DATE NOT NULL,
    "overall_progress" DECIMAL(5,4) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "progress_record_id" UUID NOT NULL,
    "boq_item_id" UUID NOT NULL,
    "completed_quantity" DECIMAL(12,4) NOT NULL,
    "completion_pct" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "progress_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "boq_item_id" UUID,
    "cost_category" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "vendor_name" VARCHAR(255),
    "invoice_ref" VARCHAR(100),
    "description" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_receipts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cost_entry_id" UUID NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_approvals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cost_entry_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "comments" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variation_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "variation_no" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    "trigger_type" VARCHAR(50),
    "linked_rfi_id" UUID,
    "requested_by_id" UUID,
    "net_amount" DECIMAL(15,2) NOT NULL,
    "time_extension_days" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ,
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variation_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variation_assignees" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "variation_order_id" UUID NOT NULL,
    "project_member_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variation_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variation_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "variation_order_id" UUID NOT NULL,
    "actor_type" VARCHAR(20) NOT NULL,
    "actor_name" VARCHAR(255) NOT NULL,
    "event" VARCHAR(50) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variation_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "variation_order_id" UUID NOT NULL,
    "boq_item_id" UUID,
    "description" TEXT NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_rate" DECIMAL(15,4) NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "variation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "changes" JSONB,
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfis" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "rfi_number" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "question" TEXT NOT NULL,
    "suggested_solution" TEXT,
    "drawing_reference" VARCHAR(100),
    "specification_clause" VARCHAR(100),
    "issue_type" VARCHAR(30),
    "priority" "RfiPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "RfiStatus" NOT NULL DEFAULT 'SUBMITTED',
    "cost_impact" BOOLEAN NOT NULL DEFAULT false,
    "schedule_impact_days" INTEGER NOT NULL DEFAULT 0,
    "assigned_to_role" VARCHAR(50) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "due_date" DATE,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfi_responses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rfi_id" UUID NOT NULL,
    "responder_id" UUID NOT NULL,
    "official_answer" TEXT NOT NULL,
    "is_accepted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfi_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfi_attachments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rfi_id" UUID NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfi_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_checklists" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "checklist_type" "ChecklistType" NOT NULL,
    "inspection_type" VARCHAR(60),
    "assigned_consultant" VARCHAR(255),
    "title" VARCHAR(255) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_date" DATE NOT NULL,
    "inspected_at" TIMESTAMPTZ,
    "inspector_name" VARCHAR(255),
    "inspector_role" VARCHAR(100),
    "signed_off_by_id" UUID,
    "summary_notes" TEXT,
    "requires_consultant_review" BOOLEAN NOT NULL DEFAULT false,
    "consultant_review_status" VARCHAR(15) NOT NULL DEFAULT 'NOT_REQUIRED',
    "consultant_reviewed_by_id" UUID,
    "consultant_reviewed_by_name" VARCHAR(255),
    "consultant_reviewed_at" TIMESTAMPTZ,
    "consultant_review_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inspection_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "order_idx" INTEGER NOT NULL,
    "check_point" VARCHAR(255) NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "result" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "deficiency_notes" TEXT,
    "photo_storage_key" VARCHAR(500),

    CONSTRAINT "inspection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concrete_cube_tests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "batch_reference" VARCHAR(100) NOT NULL,
    "pour_location" VARCHAR(255) NOT NULL,
    "pour_date" DATE NOT NULL,
    "concrete_class" "ConcreteClass" NOT NULL DEFAULT 'CLASS_25_20',
    "target_strength_mpa" DECIMAL(5,2) NOT NULL,
    "slump_tested_mm" INTEGER,
    "supplier_name" VARCHAR(255),
    "delivery_docket_no" VARCHAR(100),
    "curing_tank_id" VARCHAR(50),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concrete_cube_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cube_break_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cube_test_id" UUID NOT NULL,
    "cube_number" INTEGER NOT NULL,
    "break_age_days" INTEGER NOT NULL,
    "scheduled_break_date" DATE NOT NULL,
    "actual_break_date" DATE,
    "crushing_load_kn" DECIMAL(8,2),
    "compressive_mpa" DECIMAL(6,2),
    "is_pass" BOOLEAN,
    "lab_name" VARCHAR(255),
    "certificate_key" VARCHAR(500),
    "tested_by" VARCHAR(255),

    CONSTRAINT "cube_break_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snag_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "snag_number" INTEGER NOT NULL,
    "location_block" VARCHAR(100),
    "location_floor" VARCHAR(100) NOT NULL,
    "location_room" VARCHAR(100) NOT NULL,
    "trade_category" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "SnagSeverity" NOT NULL DEFAULT 'COSMETIC',
    "status" "SnagStatus" NOT NULL DEFAULT 'OPEN',
    "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    "item_type" VARCHAR(30),
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "manager_name" VARCHAR(255),
    "final_approver_name" VARCHAR(255),
    "cost_impact_kes" DECIMAL(15,2),
    "schedule_impact_days" INTEGER,
    "cost_code" VARCHAR(50),
    "reference_doc" VARCHAR(255),
    "assigned_trade_firm" VARCHAR(255),
    "due_date" DATE,
    "identified_by_name" VARCHAR(255) NOT NULL,
    "identified_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rectified_at" TIMESTAMPTZ,
    "verified_at" TIMESTAMPTZ,
    "verified_by_name" VARCHAR(255),

    CONSTRAINT "snag_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snag_photos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "snag_item_id" UUID NOT NULL,
    "photo_type" VARCHAR(20) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "caption" VARCHAR(255),
    "gps_latitude" DECIMAL(9,6),
    "gps_longitude" DECIMAL(9,6),
    "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snag_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defects_liability_certificates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "certificate_type" "CertificateType" NOT NULL,
    "certificate_reference" VARCHAR(100) NOT NULL,
    "issue_date" DATE NOT NULL,
    "effective_date" DATE NOT NULL,
    "dlp_duration_months" INTEGER NOT NULL DEFAULT 6,
    "dlp_expiry_date" DATE,
    "retention_amount_released" DECIMAL(15,2) NOT NULL,
    "architect_name" VARCHAR(255) NOT NULL,
    "architect_boraqs_no" VARCHAR(50),
    "qs_name" VARCHAR(255) NOT NULL,
    "qs_boraqs_no" VARCHAR(50),
    "signed_certificate_key" VARCHAR(500),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defects_liability_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_access_links" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "portal_type" VARCHAR(50) NOT NULL,
    "stakeholder_name" VARCHAR(255) NOT NULL,
    "stakeholder_role" VARCHAR(100),
    "token_hash" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_access_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_schedule_tasks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "wbs_phase" VARCHAR(100) NOT NULL,
    "task_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "planned_start_date" DATE NOT NULL,
    "planned_end_date" DATE NOT NULL,
    "actual_start_date" DATE,
    "actual_end_date" DATE,
    "duration_days" INTEGER NOT NULL DEFAULT 1,
    "progress_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "assigned_trade" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT 'PLANNED',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_schedule_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_inventory_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "material_name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "opening_balance" DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    "current_stock" DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    "minimum_reorder_level" DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    "unit_cost_estimate" DECIMAL(15,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "site_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "inventory_item_id" UUID NOT NULL,
    "movement_type" VARCHAR(50) NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "movement_date" DATE NOT NULL,
    "reference_no" VARCHAR(100),
    "notes" TEXT,
    "recorded_by_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_incidents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "incident_date" DATE NOT NULL,
    "incident_time" VARCHAR(20),
    "incident_type" VARCHAR(50) NOT NULL,
    "severity" VARCHAR(50) NOT NULL,
    "exact_location" VARCHAR(255) NOT NULL,
    "affected_person_name" VARCHAR(255),
    "affected_trade" VARCHAR(100),
    "description" TEXT NOT NULL,
    "immediate_action" TEXT,
    "preventative_action" TEXT,
    "is_osha_reportable" BOOLEAN NOT NULL DEFAULT false,
    "investigated_by" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "drawing_reference" VARCHAR(100),
    "revision_code" VARCHAR(50) NOT NULL DEFAULT 'Rev 0',
    "storage_key" VARCHAR(500) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'APPROVED_FOR_CONSTRUCTION',
    "uploaded_by_name" VARCHAR(255) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing_annotations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "x_pct" DECIMAL(6,3) NOT NULL,
    "y_pct" DECIMAL(6,3) NOT NULL,
    "note" TEXT NOT NULL,
    "author_name" VARCHAR(255) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawing_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontractor_packages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "trade_category" VARCHAR(100) NOT NULL,
    "firm_name" VARCHAR(255) NOT NULL,
    "contact_person" VARCHAR(255),
    "phone_number" VARCHAR(50),
    "subcontract_sum" DECIMAL(15,2) NOT NULL,
    "retention_rate_pct" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "scope_description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subcontractor_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_delay_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "delay_type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days_claimed" INTEGER NOT NULL,
    "critical_path_impact" VARCHAR(50) NOT NULL DEFAULT 'CRITICAL',
    "daily_lad_rate_kes" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "site_diary_reference" VARCHAR(100),
    "meteorological_proof" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW',
    "approved_days" INTEGER,
    "lad_financial_relief_kes" DECIMAL(15,2),
    "certifying_authority" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_delay_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_tax_certificates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "certificate_no" VARCHAR(100) NOT NULL,
    "payee_type" VARCHAR(50) NOT NULL,
    "payee_name" VARCHAR(255) NOT NULL,
    "payee_kra_pin" VARCHAR(20) NOT NULL,
    "invoice_or_ipc_ref" VARCHAR(100) NOT NULL,
    "gross_amount" DECIMAL(15,2) NOT NULL,
    "wht_rate_pct" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "wht_deducted" DECIMAL(15,2) NOT NULL,
    "whvat_rate_pct" DECIMAL(5,2) NOT NULL DEFAULT 2.00,
    "whvat_deducted" DECIMAL(15,2) NOT NULL,
    "net_payable" DECIMAL(15,2) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'GENERATED',
    "itax_acknowledgement_receipt" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "statutory_tax_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requisitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "requisition_no" VARCHAR(100) NOT NULL,
    "inventory_item_id" UUID,
    "item_description" VARCHAR(255) NOT NULL,
    "unit_of_measure" VARCHAR(50) NOT NULL,
    "requested_quantity" DECIMAL(12,2) NOT NULL,
    "estimated_unit_cost_kes" DECIMAL(15,2) NOT NULL,
    "estimated_total_cost_kes" DECIMAL(15,2) NOT NULL,
    "urgency" VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
    "required_by_date" DATE,
    "supplier_name" VARCHAR(255),
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL',
    "rejection_reason" TEXT,
    "requested_by" VARCHAR(255) NOT NULL,
    "approved_by" VARCHAR(255),
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "material_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_wastage_reconciliations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "period_name" VARCHAR(100) NOT NULL,
    "inventory_item_id" UUID,
    "material_name" VARCHAR(255) NOT NULL,
    "unit_of_measure" VARCHAR(50) NOT NULL,
    "theoretical_quantity" DECIMAL(12,2) NOT NULL,
    "actual_consumed_quantity" DECIMAL(12,2) NOT NULL,
    "allowable_wastage_pct" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "actual_wastage_pct" DECIMAL(5,2) NOT NULL,
    "variance_quantity" DECIMAL(12,2) NOT NULL,
    "unit_cost_kes" DECIMAL(15,2) NOT NULL,
    "financial_loss_kes" DECIMAL(15,2) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'WITHIN_TOLERANCE',
    "investigation_notes" TEXT,
    "created_by" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "material_wastage_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_cash_flow_forecasts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "period_month" VARCHAR(20) NOT NULL,
    "planned_value_kes" DECIMAL(15,2) NOT NULL,
    "actual_cost_kes" DECIMAL(15,2) NOT NULL,
    "earned_value_kes" DECIMAL(15,2) NOT NULL,
    "cpi" DECIMAL(6,4) NOT NULL DEFAULT 1.0000,
    "spi" DECIMAL(6,4) NOT NULL DEFAULT 1.0000,
    "forecasted_final_cost_kes" DECIMAL(15,2) NOT NULL,
    "client_billed_kes" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "net_cash_flow_kes" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ON_TRACK',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_cash_flow_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontractor_valuations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "subcontractor_package_id" UUID NOT NULL,
    "certificate_no" VARCHAR(100) NOT NULL,
    "valuation_date" DATE NOT NULL,
    "gross_work_certified_kes" DECIMAL(15,2) NOT NULL,
    "retention_rate_pct" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "retention_deducted_kes" DECIMAL(15,2) NOT NULL,
    "previous_payments_deducted_kes" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "withholding_tax_pct" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "withholding_tax_deducted_kes" DECIMAL(15,2) NOT NULL,
    "net_payable_kes" DECIMAL(15,2) NOT NULL,
    "payment_status" VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    "payment_reference" VARCHAR(100),
    "paid_at" TIMESTAMPTZ,
    "approved_by" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subcontractor_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_equipment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "equipment_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "equipment_type" VARCHAR(50) NOT NULL,
    "ownership_type" VARCHAR(50) NOT NULL DEFAULT 'OWNED',
    "rate_per_unit_kes" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "rate_unit" VARCHAR(20) NOT NULL DEFAULT 'PER_DAY',
    "registration_no" VARCHAR(50),
    "supplier_name" VARCHAR(255),
    "current_hours_meter" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "status" VARCHAR(50) NOT NULL DEFAULT 'OPERATIONAL',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plant_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_equipment_daily_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "log_date" DATE NOT NULL,
    "operator_name" VARCHAR(255) NOT NULL,
    "opening_hours_meter" DECIMAL(10,2) NOT NULL,
    "closing_hours_meter" DECIMAL(10,2) NOT NULL,
    "operating_hours" DECIMAL(8,2) NOT NULL,
    "idle_or_breakdown_hours" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "fuel_liters_issued" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "fuel_cost_per_liter_kes" DECIMAL(8,2) NOT NULL DEFAULT 180.00,
    "total_fuel_cost_kes" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "fuel_burn_liters_per_hour" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "fuel_efficiency_status" VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
    "activities_performed" TEXT,
    "verified_by_supervisor" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plant_equipment_daily_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_laborers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "worker_code" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "national_id_no" VARCHAR(50) NOT NULL,
    "phone_number" VARCHAR(50) NOT NULL,
    "trade_category" VARCHAR(50) NOT NULL,
    "skill_level" VARCHAR(50) NOT NULL DEFAULT 'ARTISAN_FUNDI',
    "daily_rate_kes" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "site_laborers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_muster_rolls" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "payroll_no" VARCHAR(100) NOT NULL,
    "week_ending_date" DATE NOT NULL,
    "total_workers" INTEGER NOT NULL,
    "total_man_days" DECIMAL(8,2) NOT NULL,
    "gross_wages_kes" DECIMAL(14,2) NOT NULL,
    "statutory_deductions_kes" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "net_wages_payable_kes" DECIMAL(14,2) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "disbursement_reference" VARCHAR(100),
    "disbursed_at" TIMESTAMPTZ,
    "approved_by" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "labor_muster_rolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_daily_attendances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "muster_roll_id" UUID NOT NULL,
    "laborer_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "days_worked" DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    "overtime_hours" DECIMAL(4,2) NOT NULL DEFAULT 0.00,
    "daily_earnings_kes" DECIMAL(10,2) NOT NULL,
    "task_assigned" VARCHAR(255),
    "verified_by" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_daily_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_audit_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "audit_no" VARCHAR(100) NOT NULL,
    "audit_date" DATE NOT NULL,
    "auditor_name" VARCHAR(255) NOT NULL,
    "auditor_type" VARCHAR(50) NOT NULL,
    "ppe_compliance_score" DECIMAL(5,2) NOT NULL,
    "scaffolding_and_edge_protection_status" VARCHAR(50) NOT NULL,
    "excavation_and_shoring_status" VARCHAR(50) NOT NULL,
    "first_aid_and_fire_station_status" VARCHAR(50) NOT NULL,
    "electrical_safety_and_cables_status" VARCHAR(50) NOT NULL,
    "overall_compliance_score" DECIMAL(5,2) NOT NULL,
    "audit_outcome" VARCHAR(50) NOT NULL,
    "corrective_action_plan" TEXT,
    "reinspection_due_date" DATE,
    "status" VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "safety_audit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etims_invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "invoice_number" VARCHAR(100) NOT NULL,
    "cu_invoice_number" VARCHAR(100) NOT NULL,
    "invoice_type" VARCHAR(50) NOT NULL DEFAULT 'ORIGINAL',
    "buyer_pin" VARCHAR(50) NOT NULL,
    "buyer_name" VARCHAR(255) NOT NULL,
    "total_taxable_amount" DECIMAL(15,2) NOT NULL,
    "total_tax_amount" DECIMAL(15,2) NOT NULL,
    "total_invoice_amount" DECIMAL(15,2) NOT NULL,
    "tax_breakdown_16" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_breakdown_8" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_breakdown_0" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_breakdown_exempt" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "qr_code_url" VARCHAR(500) NOT NULL,
    "cryptographic_signature" VARCHAR(255) NOT NULL,
    "transmission_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "transmitted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "etims_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontractor_tax_compliances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subcontractor_package_id" UUID NOT NULL,
    "pin_number" VARCHAR(50) NOT NULL,
    "taxpayer_name" VARCHAR(255) NOT NULL,
    "tcc_number" VARCHAR(100) NOT NULL,
    "tcc_expiry_date" DATE NOT NULL,
    "compliance_status" VARCHAR(50) NOT NULL DEFAULT 'COMPLIANT',
    "withholding_tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "withholding_vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 2.00,
    "last_verified_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subcontractor_tax_compliances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_webhook_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID,
    "sender_phone" VARCHAR(50) NOT NULL,
    "sender_name" VARCHAR(255),
    "channel" VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
    "raw_message" TEXT NOT NULL,
    "detected_command" VARCHAR(50) NOT NULL,
    "processed_status" VARCHAR(50) NOT NULL DEFAULT 'PROCESSED',
    "extracted_data" JSONB,
    "reply_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_alert_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "recipient_phone" VARCHAR(50) NOT NULL,
    "recipient_name" VARCHAR(255) NOT NULL,
    "recipient_role" VARCHAR(50) NOT NULL,
    "alert_type" VARCHAR(50) NOT NULL,
    "message_body" TEXT NOT NULL,
    "delivery_channel" VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
    "delivery_status" VARCHAR(50) NOT NULL DEFAULT 'SENT',
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_alert_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontractor_retention_releases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "subcontractor_package_id" UUID NOT NULL,
    "release_no" VARCHAR(100) NOT NULL,
    "moiety_stage" VARCHAR(50) NOT NULL,
    "total_retention_held" DECIMAL(15,2) NOT NULL,
    "release_percentage" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "release_amount" DECIMAL(15,2) NOT NULL,
    "qs_recommendation_notes" TEXT,
    "defect_clearance_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING_QS_REVIEW',
    "disbursement_ref" VARCHAR(100),
    "disbursed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subcontractor_retention_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_bond_trackers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "bond_type" VARCHAR(50) NOT NULL,
    "issuing_institution" VARCHAR(255) NOT NULL,
    "bond_reference_no" VARCHAR(100) NOT NULL,
    "bond_amount" DECIMAL(15,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "expiry_date" DATE NOT NULL,
    "claim_status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "discharge_certificate_ref" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contractor_bond_trackers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "monthly_amount" DECIMAL(12,2) NOT NULL,
    "max_active_projects" INTEGER NOT NULL DEFAULT 1,
    "billing_cycle" VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mpesa_subscription_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "phone_number" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "merchant_request_id" VARCHAR(100) NOT NULL,
    "checkout_request_id" VARCHAR(100) NOT NULL,
    "mpesa_receipt_number" VARCHAR(100),
    "transaction_status" VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
    "result_code" INTEGER,
    "result_desc" TEXT,
    "plan_code" VARCHAR(50) NOT NULL,
    "subscription_period_start" TIMESTAMPTZ,
    "subscription_period_end" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mpesa_subscription_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_geofences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "geofence_name" VARCHAR(255) NOT NULL,
    "center_latitude" DECIMAL(9,6) NOT NULL,
    "center_longitude" DECIMAL(9,6) NOT NULL,
    "radius_meters" DECIMAL(8,2) NOT NULL DEFAULT 150.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_clock_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "laborer_id" UUID NOT NULL,
    "clock_type" VARCHAR(20) NOT NULL,
    "event_timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "captured_latitude" DECIMAL(9,6) NOT NULL,
    "captured_longitude" DECIMAL(9,6) NOT NULL,
    "calculated_distance_meters" DECIMAL(8,2) NOT NULL,
    "verification_status" VARCHAR(50) NOT NULL DEFAULT 'WITHIN_GEOFENCE',
    "photo_selfie_url" VARCHAR(500),
    "device_user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_clock_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_telematics_devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID,
    "equipment_id" UUID NOT NULL,
    "device_imei" VARCHAR(50) NOT NULL,
    "device_token" VARCHAR(100),
    "protocol" VARCHAR(50) NOT NULL DEFAULT 'CANBUS',
    "can_bus_baud_rate" INTEGER NOT NULL DEFAULT 250000,
    "max_engine_burn_rate_lph" DECIMAL(6,2) NOT NULL DEFAULT 35.00,
    "sim_phone_number" VARCHAR(50),
    "calibration_tank_capacity_liters" DECIMAL(8,2) NOT NULL DEFAULT 300.00,
    "tank_geometry" VARCHAR(50) NOT NULL DEFAULT 'RECTANGULAR',
    "status" VARCHAR(50) NOT NULL DEFAULT 'ONLINE',
    "last_heartbeat_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plant_telematics_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_telematics_pings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "ping_timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "engine_status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "engine_rpm" INTEGER,
    "coolant_temp_c" DECIMAL(5,1),
    "oil_temp_c" DECIMAL(5,1),
    "fuel_rate_l_per_h" DECIMAL(6,2),
    "engine_load_percent" DECIMAL(5,2),
    "speed_kmh" DECIMAL(5,1),
    "battery_voltage" DECIMAL(4,2),
    "dtc_fault_codes" VARCHAR(255),
    "cumulative_engine_seconds" BIGINT NOT NULL DEFAULT 0,
    "fuel_level_percent" DECIMAL(5,2) NOT NULL,
    "calculated_fuel_liters" DECIMAL(8,2) NOT NULL,
    "fuel_drop_liters" DECIMAL(8,2),
    "drop_rate_l_per_hour" DECIMAL(8,2),
    "is_siphoning_event" BOOLEAN NOT NULL DEFAULT false,
    "anomaly_severity" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_telematics_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_maintenance_alerts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "device_id" UUID,
    "alert_code" VARCHAR(50) NOT NULL,
    "alert_type" VARCHAR(50) NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'WARNING',
    "dtc_code" VARCHAR(20),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "recommended_action" TEXT,
    "hours_meter_at_alert" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "acknowledged_by" VARCHAR(255),
    "acknowledged_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plant_maintenance_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bar_bending_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "schedule_number" VARCHAR(50) NOT NULL,
    "element_name" VARCHAR(255) NOT NULL,
    "drawing_ref" VARCHAR(100),
    "steel_grade" VARCHAR(50) NOT NULL DEFAULT 'HIGH_YIELD_460',
    "total_tonnage" DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bar_bending_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bar_bending_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "member_tag" VARCHAR(100) NOT NULL,
    "bar_mark" VARCHAR(20) NOT NULL,
    "bar_type" VARCHAR(10) NOT NULL,
    "number_of_members" INTEGER NOT NULL DEFAULT 1,
    "bars_per_member" INTEGER NOT NULL DEFAULT 1,
    "total_bars" INTEGER NOT NULL DEFAULT 1,
    "shape_code" VARCHAR(10) NOT NULL DEFAULT '00',
    "dimension_a_mm" INTEGER NOT NULL DEFAULT 0,
    "dimension_b_mm" INTEGER,
    "dimension_c_mm" INTEGER,
    "dimension_d_mm" INTEGER,
    "cut_length_meters" DECIMAL(8,3) NOT NULL,
    "total_length_meters" DECIMAL(10,3) NOT NULL,
    "unit_weight_kg_per_m" DECIMAL(6,3) NOT NULL,
    "total_weight_kg" DECIMAL(10,2) NOT NULL,
    "standard_bars_needed_12m" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bar_bending_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mpesa_disbursement_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "disbursement_type" VARCHAR(50) NOT NULL,
    "reference_id" VARCHAR(100),
    "recipient_phone" VARCHAR(30) NOT NULL,
    "recipient_name" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "b2c_command_id" VARCHAR(50) NOT NULL DEFAULT 'SalaryPayment',
    "conversation_id" VARCHAR(100),
    "originator_conversation_id" VARCHAR(100),
    "mpesa_transaction_id" VARCHAR(50),
    "transaction_status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "result_code" INTEGER,
    "result_desc" VARCHAR(255),
    "transaction_completed_at" TIMESTAMPTZ,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "initiated_by" UUID,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mpesa_disbursement_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rmc_batch_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "delivery_ticket_no" VARCHAR(100) NOT NULL,
    "supplier_name" VARCHAR(255) NOT NULL,
    "truck_registration_no" VARCHAR(50) NOT NULL,
    "driver_name" VARCHAR(255),
    "driver_phone" VARCHAR(50),
    "concrete_class" VARCHAR(50) NOT NULL,
    "ordered_volume_m3" DECIMAL(8,2) NOT NULL,
    "dispatched_at" TIMESTAMPTZ NOT NULL,
    "arrived_at" TIMESTAMPTZ,
    "discharge_started_at" TIMESTAMPTZ,
    "discharge_completed_at" TIMESTAMPTZ,
    "transit_duration_minutes" INTEGER,
    "pour_location_element" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'IN_TRANSIT',
    "water_added_on_site_liters" DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rmc_batch_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rmc_slump_tests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "test_time" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "specified_slump_mm" INTEGER NOT NULL DEFAULT 100,
    "measured_slump_mm" INTEGER NOT NULL,
    "slump_type" VARCHAR(30) NOT NULL DEFAULT 'TRUE_SLUMP',
    "concrete_temperature_c" DECIMAL(4,1) NOT NULL,
    "ambient_temperature_c" DECIMAL(4,1),
    "is_within_tolerance" BOOLEAN NOT NULL DEFAULT true,
    "cubes_cast_batch_no" VARCHAR(100),
    "tested_by_inspector" VARCHAR(255) NOT NULL,
    "qa_verdict" VARCHAR(30) NOT NULL DEFAULT 'ACCEPTED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rmc_slump_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structural_steel_takeoffs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "takeoff_no" VARCHAR(100) NOT NULL,
    "structure_title" VARCHAR(255) NOT NULL,
    "drawing_reference" VARCHAR(100),
    "steel_grade" VARCHAR(50) NOT NULL DEFAULT 'S355JR',
    "total_tonnage" DECIMAL(12,3) NOT NULL,
    "total_paint_area_m2" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    "approved_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "structural_steel_takeoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structural_steel_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "takeoff_id" UUID NOT NULL,
    "member_mark" VARCHAR(50) NOT NULL,
    "section_type" VARCHAR(50) NOT NULL,
    "section_designation" VARCHAR(100) NOT NULL,
    "unit_weight_kg_per_m" DECIMAL(8,3) NOT NULL,
    "paint_area_m2_per_m" DECIMAL(6,3) NOT NULL,
    "length_meters" DECIMAL(8,3) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_length_meters" DECIMAL(10,3) NOT NULL,
    "total_weight_kg" DECIMAL(12,2) NOT NULL,
    "total_paint_area_m2" DECIMAL(10,2) NOT NULL,
    "connection_bolts_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "structural_steel_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geotechnical_soil_tests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "test_number" VARCHAR(100) NOT NULL,
    "test_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location_element" VARCHAR(255) NOT NULL,
    "layer_type" VARCHAR(50) NOT NULL DEFAULT 'SUBBASE',
    "test_method" VARCHAR(50) NOT NULL DEFAULT 'SAND_REPLACEMENT',
    "laboratory_mdd_g_cm3" DECIMAL(6,3) NOT NULL,
    "laboratory_omc_percent" DECIMAL(5,2) NOT NULL,
    "field_wet_density_g_cm3" DECIMAL(6,3) NOT NULL,
    "field_moisture_percent" DECIMAL(5,2) NOT NULL,
    "field_dry_density_g_cm3" DECIMAL(6,3) NOT NULL,
    "relative_compaction_percent" DECIMAL(5,2) NOT NULL,
    "required_compaction_percent" DECIMAL(5,2) NOT NULL DEFAULT 95.00,
    "dcp_blows_per_100mm" INTEGER,
    "estimated_cbr_percent" DECIMAL(5,2),
    "qa_verdict" VARCHAR(30) NOT NULL DEFAULT 'PASS',
    "inspected_by" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'VERIFIED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "geotechnical_soil_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asphalt_pavement_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "ticket_number" VARCHAR(100) NOT NULL,
    "supplier_name" VARCHAR(255) NOT NULL,
    "mix_type" VARCHAR(50) NOT NULL DEFAULT 'AC_14_WEARING',
    "truck_reg_no" VARCHAR(50) NOT NULL,
    "tonnage_tons" DECIMAL(8,2) NOT NULL,
    "chainage_start" VARCHAR(50) NOT NULL,
    "chainage_end" VARCHAR(50) NOT NULL,
    "lane_direction" VARCHAR(50) NOT NULL DEFAULT 'NORTHBOUND',
    "plant_temp_c" DECIMAL(5,1) NOT NULL,
    "delivery_temp_c" DECIMAL(5,1) NOT NULL,
    "breakdown_temp_c" DECIMAL(5,1) NOT NULL,
    "finish_temp_c" DECIMAL(5,1) NOT NULL,
    "thermal_verdict" VARCHAR(30) NOT NULL DEFAULT 'COMPLIANT',
    "core_thickness_mm" DECIMAL(6,2),
    "design_thickness_mm" DECIMAL(6,2) NOT NULL DEFAULT 50.00,
    "core_density_g_cm3" DECIMAL(6,3),
    "marshall_density_g_cm3" DECIMAL(6,3),
    "compaction_percent" DECIMAL(5,2),
    "qa_verdict" VARCHAR(50) NOT NULL DEFAULT 'PENDING_CORES',
    "inspected_by" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'LAID',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "asphalt_pavement_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topographic_surveys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "survey_code" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "survey_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "surveyor_name" VARCHAR(255) NOT NULL,
    "instrument_type" VARCHAR(50) NOT NULL DEFAULT 'TOTAL_STATION',
    "calculation_method" VARCHAR(50) NOT NULL DEFAULT 'PRISMOIDAL',
    "bulking_factor" DECIMAL(5,3) NOT NULL DEFAULT 1.200,
    "shrinkage_factor" DECIMAL(5,3) NOT NULL DEFAULT 0.900,
    "freehaul_distance_meters" DECIMAL(8,2) NOT NULL DEFAULT 500.00,
    "overhaul_unit_rate_kes" DECIMAL(10,2) NOT NULL DEFAULT 85.00,
    "borrow_unit_rate_kes" DECIMAL(10,2) NOT NULL DEFAULT 350.00,
    "total_cut_volume_m3" DECIMAL(14,3) NOT NULL DEFAULT 0.000,
    "total_fill_volume_m3" DECIMAL(14,3) NOT NULL DEFAULT 0.000,
    "net_balance_volume_m3" DECIMAL(14,3) NOT NULL DEFAULT 0.000,
    "total_overhaul_cost_kes" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "economic_haul_limit_meters" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "status" VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "topographic_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_section_stations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "station_index" INTEGER NOT NULL,
    "chainage_meters" DECIMAL(10,2) NOT NULL,
    "chainage_label" VARCHAR(50) NOT NULL,
    "existing_ground_level_m" DECIMAL(8,3) NOT NULL,
    "proposed_formation_level_m" DECIMAL(8,3) NOT NULL,
    "depth_cut_or_fill_m" DECIMAL(8,3) NOT NULL,
    "cut_area_m2" DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    "fill_area_m2" DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    "mid_cut_area_m2" DECIMAL(10,3),
    "mid_fill_area_m2" DECIMAL(10,3),
    "offsets_and_levels" JSONB,
    "interval_distance_m" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "interval_cut_volume_m3" DECIMAL(14,3) NOT NULL DEFAULT 0.000,
    "interval_fill_volume_m3" DECIMAL(14,3) NOT NULL DEFAULT 0.000,
    "interval_adjusted_fill_m3" DECIMAL(14,3) NOT NULL DEFAULT 0.000,
    "interval_net_volume_m3" DECIMAL(14,3) NOT NULL DEFAULT 0.000,
    "cumulative_mass_ordinate_m3" DECIMAL(14,3) NOT NULL DEFAULT 0.000,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_section_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "independent_site_inspections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "inspection_code" VARCHAR(50) NOT NULL,
    "requested_by" VARCHAR(255) NOT NULL,
    "inspector_name" VARCHAR(255),
    "inspector_license" VARCHAR(100),
    "scheduled_date" TIMESTAMPTZ NOT NULL,
    "conducted_date" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
    "scope_description" TEXT NOT NULL,
    "gps_latitude" DECIMAL(10,7),
    "gps_longitude" DECIMAL(10,7),
    "reported_progress_pct" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "verified_progress_pct" DECIMAL(5,2),
    "variance_pct" DECIMAL(5,2),
    "variance_status" VARCHAR(50),
    "materials_on_site_notes" TEXT,
    "workmanship_rating" INTEGER,
    "safety_compliance_rating" INTEGER,
    "structural_defects_found" BOOLEAN NOT NULL DEFAULT false,
    "findings_notes" TEXT,
    "recommendations" TEXT,
    "client_review_notes" TEXT,
    "client_discrepancy_flagged" BOOLEAN NOT NULL DEFAULT false,
    "client_satisfaction_rating" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "independent_site_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "independent_inspection_photos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "photo_url" TEXT NOT NULL,
    "caption" VARCHAR(255),
    "element_inspected" VARCHAR(100),
    "has_discrepancy" BOOLEAN NOT NULL DEFAULT false,
    "gps_latitude" DECIMAL(10,7),
    "gps_longitude" DECIMAL(10,7),
    "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "independent_inspection_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tenders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "tender_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "trade_category" VARCHAR(100) NOT NULL,
    "scope_of_work" TEXT NOT NULL,
    "budget_kes" DECIMAL(14,2) NOT NULL,
    "duration_weeks" INTEGER NOT NULL,
    "submission_deadline" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED',
    "awarded_bid_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_bids" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "contractor_name" VARCHAR(255) NOT NULL,
    "contractor_nca_category" VARCHAR(50) NOT NULL,
    "amount_kes" DECIMAL(14,2) NOT NULL,
    "duration_weeks" INTEGER NOT NULL,
    "technical_score" DECIMAL(5,2) NOT NULL DEFAULT 70.00,
    "financial_score" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "combined_score" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "rank" INTEGER,
    "bid_status" VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    "proposal_notes" TEXT,
    "easmm_trade_breakdown" JSONB,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tender_bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "quote_no" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "client_name" VARCHAR(255) NOT NULL,
    "client_email" VARCHAR(255),
    "client_phone" VARCHAR(50),
    "site_location" VARCHAR(255),
    "project_id" UUID,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deposit_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "deposit_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "terms" TEXT,
    "scope_notes" TEXT,
    "valid_until" DATE,
    "share_token_hash" VARCHAR(64),
    "responded_at" TIMESTAMPTZ,
    "responded_by" VARCHAR(255),
    "response_note" TEXT,
    "converted_project_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "section" VARCHAR(120),
    "description" TEXT NOT NULL,
    "unit" VARCHAR(20) NOT NULL DEFAULT 'item',
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "unit_rate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "actor_type" VARCHAR(20) NOT NULL,
    "actor_name" VARCHAR(255),
    "event" VARCHAR(40) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_no" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "project_id" UUID,
    "quote_id" UUID,
    "client_name" VARCHAR(255) NOT NULL,
    "client_email" VARCHAR(255),
    "client_phone" VARCHAR(50),
    "bill_to" TEXT,
    "po_number" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "terms" TEXT,
    "notes" TEXT,
    "paybill" VARCHAR(20),
    "sent_at" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,
    "voided_at" TIMESTAMPTZ,
    "void_reason" VARCHAR(255),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "section" VARCHAR(120),
    "description" TEXT NOT NULL,
    "unit" VARCHAR(20) NOT NULL DEFAULT 'item',
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "unit_rate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "method" VARCHAR(20) NOT NULL DEFAULT 'BANK',
    "reference" VARCHAR(100),
    "paid_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "recorded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_certificates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "certificate_no" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "this_period_amount" DECIMAL(15,2) NOT NULL,
    "previous_certified" DECIMAL(15,2) NOT NULL,
    "cumulative_certified" DECIMAL(15,2) NOT NULL,
    "retention_pct" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "retention_deduction" DECIMAL(15,2) NOT NULL,
    "retention_held" DECIMAL(15,2) NOT NULL,
    "retention_released" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "advance_recovery" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amount_due_previous" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "net_payable" DECIMAL(15,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ,
    "certified_at" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,
    "paid_reference" VARCHAR(100),
    "submitted_by_id" UUID,
    "certified_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "commitment_no" INTEGER NOT NULL,
    "vendor_name" VARCHAR(255) NOT NULL,
    "vendor_type" VARCHAR(30) NOT NULL DEFAULT 'SUBCONTRACTOR',
    "scope_description" TEXT,
    "contract_value" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
    "retention_pct" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "retention_cap_pct" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "advance_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "advance_paid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "advance_recover_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cost_code" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "subcontractor_package_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_applications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "commitment_id" UUID NOT NULL,
    "application_no" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "gross_claimed" DECIMAL(15,2) NOT NULL,
    "previous_certified" DECIMAL(15,2) NOT NULL,
    "cumulative_certified" DECIMAL(15,2) NOT NULL,
    "retention_withheld" DECIMAL(15,2) NOT NULL,
    "retention_held" DECIMAL(15,2) NOT NULL,
    "advance_recovered" DECIMAL(15,2) NOT NULL,
    "advance_outstanding" DECIMAL(15,2) NOT NULL,
    "wht_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "wht_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "previous_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "net_payable" DECIMAL(15,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ,
    "approved_at" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,
    "paid_reference" VARCHAR(100),
    "submitted_by_id" UUID,
    "approved_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snag_comments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "snag_item_id" UUID NOT NULL,
    "author_name" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snag_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snag_distributions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "snag_item_id" UUID NOT NULL,
    "recipient_name" VARCHAR(255) NOT NULL,
    "recipient_contact" VARCHAR(255),
    "channel" VARCHAR(30),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snag_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "priority" VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    "audience" VARCHAR(20) NOT NULL DEFAULT 'ALL',
    "target_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(15) NOT NULL DEFAULT 'PUBLISHED',
    "published_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_project_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "project_type" VARCHAR(60) NOT NULL,
    "location_text" VARCHAR(255) NOT NULL,
    "budget_range" VARCHAR(40),
    "start_timeframe" VARCHAR(40),
    "description" TEXT NOT NULL,
    "contact_phone" VARCHAR(30),
    "status" VARCHAR(20) NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "client_project_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID,
    "sender_id" UUID NOT NULL,
    "sender_name" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "audience" VARCHAR(20) NOT NULL DEFAULT 'PROJECT_TEAM',
    "target_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_message_reads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_message_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_observations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "obs_number" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'QUALITY',
    "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    "location" VARCHAR(255),
    "description" TEXT NOT NULL,
    "status" VARCHAR(15) NOT NULL DEFAULT 'OPEN',
    "raised_by_id" UUID,
    "raised_by_name" VARCHAR(255) NOT NULL,
    "closed_at" TIMESTAMPTZ,
    "closed_by_name" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "site_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_actions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "observation_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "owner_name" VARCHAR(255) NOT NULL,
    "due_date" DATE,
    "source_ref" VARCHAR(50),
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(15) NOT NULL DEFAULT 'ACTIVE',
    "completed_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crews" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "trade" VARCHAR(100) NOT NULL,
    "foreman_name" VARCHAR(255),
    "status" VARCHAR(15) NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "crews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "crew_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "trade" VARCHAR(100),
    "phone" VARCHAR(50),
    "daily_rate_kes" DECIMAL(12,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crew_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" VARCHAR(30),
    "reference_no" VARCHAR(100),
    "file_name" VARCHAR(255),
    "mime_type" VARCHAR(100),
    "file_size" INTEGER,
    "storage_key" VARCHAR(500),
    "expiry_date" DATE,
    "status" VARCHAR(15) NOT NULL DEFAULT 'ACTIVE',
    "uploaded_by_id" UUID,
    "uploaded_by_name" VARCHAR(255) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correspondence_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "corr_number" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "direction" VARCHAR(10) NOT NULL DEFAULT 'OUTGOING',
    "subject" VARCHAR(500) NOT NULL,
    "from_name" VARCHAR(255) NOT NULL,
    "to_name" VARCHAR(255) NOT NULL,
    "reference" VARCHAR(100),
    "letter_date" DATE,
    "status" VARCHAR(15) NOT NULL DEFAULT 'DRAFT',
    "body" TEXT,
    "attachment_name" VARCHAR(255),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "correspondence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "report_type" VARCHAR(20) NOT NULL,
    "frequency" VARCHAR(10) NOT NULL,
    "day_of_week" INTEGER,
    "day_of_month" INTEGER,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "format" VARCHAR(10) NOT NULL DEFAULT 'PDF',
    "status" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    "next_run_at" TIMESTAMPTZ,
    "last_run_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_report_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "ran_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(10) NOT NULL,
    "summary" JSONB,
    "error" TEXT,

    CONSTRAINT "scheduled_report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_attendances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "laborer_id" UUID NOT NULL,
    "crew_id" UUID,
    "work_date" DATE NOT NULL,
    "status" VARCHAR(15) NOT NULL DEFAULT 'PRESENT',
    "check_in_at" TIMESTAMPTZ,
    "check_out_at" TIMESTAMPTZ,
    "hours_worked" DECIMAL(4,2),
    "notes" TEXT,
    "recorded_by_id" UUID,
    "recorded_by_name" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "trade_category" VARCHAR(50) NOT NULL,
    "kind" VARCHAR(15) NOT NULL DEFAULT 'CUSTOM',
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "status" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID,
    "created_by_name" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "template_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "trade" VARCHAR(100) NOT NULL,
    "assigned_to_name" VARCHAR(255),
    "due_date" DATE,
    "status" VARCHAR(15) NOT NULL DEFAULT 'DRAFT',
    "responses" JSONB,
    "submitted_at" TIMESTAMPTZ,
    "reviewed_by_name" VARCHAR(255),
    "review_notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "checklist_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_status_idx" ON "invitations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "projects_tenant_id_status_idx" ON "projects"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_tenant_id_code_key" ON "projects"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "project_members_tenant_id_project_id_idx" ON "project_members"("tenant_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "boqs_tenant_id_project_id_idx" ON "boqs"("tenant_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "boqs_project_id_version_key" ON "boqs"("project_id", "version");

-- CreateIndex
CREATE INDEX "boq_sections_tenant_id_boq_id_idx" ON "boq_sections"("tenant_id", "boq_id");

-- CreateIndex
CREATE INDEX "boq_items_tenant_id_section_id_idx" ON "boq_items"("tenant_id", "section_id");

-- CreateIndex
CREATE INDEX "site_diaries_tenant_id_project_id_idx" ON "site_diaries"("tenant_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_diaries_project_id_entry_date_key" ON "site_diaries"("project_id", "entry_date");

-- CreateIndex
CREATE INDEX "site_photos_tenant_id_site_diary_id_idx" ON "site_photos"("tenant_id", "site_diary_id");

-- CreateIndex
CREATE INDEX "labor_headcounts_tenant_id_site_diary_id_idx" ON "labor_headcounts"("tenant_id", "site_diary_id");

-- CreateIndex
CREATE INDEX "material_deliveries_tenant_id_site_diary_id_idx" ON "material_deliveries"("tenant_id", "site_diary_id");

-- CreateIndex
CREATE INDEX "progress_records_tenant_id_project_id_record_date_idx" ON "progress_records"("tenant_id", "project_id", "record_date");

-- CreateIndex
CREATE INDEX "progress_items_tenant_id_progress_record_id_idx" ON "progress_items"("tenant_id", "progress_record_id");

-- CreateIndex
CREATE INDEX "cost_entries_tenant_id_project_id_status_idx" ON "cost_entries"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE INDEX "cost_receipts_tenant_id_cost_entry_id_idx" ON "cost_receipts"("tenant_id", "cost_entry_id");

-- CreateIndex
CREATE INDEX "cost_approvals_tenant_id_cost_entry_id_idx" ON "cost_approvals"("tenant_id", "cost_entry_id");

-- CreateIndex
CREATE INDEX "variation_orders_tenant_id_project_id_status_idx" ON "variation_orders"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "variation_orders_project_id_variation_no_key" ON "variation_orders"("project_id", "variation_no");

-- CreateIndex
CREATE INDEX "variation_assignees_tenant_id_variation_order_id_idx" ON "variation_assignees"("tenant_id", "variation_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "variation_assignees_variation_order_id_project_member_id_ro_key" ON "variation_assignees"("variation_order_id", "project_member_id", "role");

-- CreateIndex
CREATE INDEX "variation_events_tenant_id_variation_order_id_created_at_idx" ON "variation_events"("tenant_id", "variation_order_id", "created_at");

-- CreateIndex
CREATE INDEX "variation_items_tenant_id_variation_order_id_idx" ON "variation_items"("tenant_id", "variation_order_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_project_id_created_at_idx" ON "audit_logs"("tenant_id", "project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_tenant_id_idempotency_key_key" ON "idempotency_keys"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "rfis_tenant_id_project_id_status_idx" ON "rfis"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rfis_project_id_rfi_number_key" ON "rfis"("project_id", "rfi_number");

-- CreateIndex
CREATE INDEX "rfi_responses_tenant_id_rfi_id_idx" ON "rfi_responses"("tenant_id", "rfi_id");

-- CreateIndex
CREATE INDEX "rfi_attachments_tenant_id_rfi_id_idx" ON "rfi_attachments"("tenant_id", "rfi_id");

-- CreateIndex
CREATE INDEX "inspection_checklists_tenant_id_project_id_checklist_type_idx" ON "inspection_checklists"("tenant_id", "project_id", "checklist_type");

-- CreateIndex
CREATE INDEX "inspection_items_tenant_id_checklist_id_idx" ON "inspection_items"("tenant_id", "checklist_id");

-- CreateIndex
CREATE INDEX "concrete_cube_tests_tenant_id_project_id_pour_date_idx" ON "concrete_cube_tests"("tenant_id", "project_id", "pour_date");

-- CreateIndex
CREATE INDEX "cube_break_results_tenant_id_cube_test_id_scheduled_break_d_idx" ON "cube_break_results"("tenant_id", "cube_test_id", "scheduled_break_date");

-- CreateIndex
CREATE INDEX "snag_items_tenant_id_project_id_status_idx" ON "snag_items"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "snag_items_project_id_snag_number_key" ON "snag_items"("project_id", "snag_number");

-- CreateIndex
CREATE INDEX "snag_photos_tenant_id_snag_item_id_idx" ON "snag_photos"("tenant_id", "snag_item_id");

-- CreateIndex
CREATE INDEX "defects_liability_certificates_tenant_id_project_id_certifi_idx" ON "defects_liability_certificates"("tenant_id", "project_id", "certificate_type");

-- CreateIndex
CREATE UNIQUE INDEX "portal_access_links_token_hash_key" ON "portal_access_links"("token_hash");

-- CreateIndex
CREATE INDEX "portal_access_links_tenant_id_project_id_portal_type_idx" ON "portal_access_links"("tenant_id", "project_id", "portal_type");

-- CreateIndex
CREATE INDEX "project_schedule_tasks_tenant_id_project_id_wbs_phase_idx" ON "project_schedule_tasks"("tenant_id", "project_id", "wbs_phase");

-- CreateIndex
CREATE INDEX "site_inventory_items_tenant_id_project_id_idx" ON "site_inventory_items"("tenant_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_inventory_items_project_id_material_name_key" ON "site_inventory_items"("project_id", "material_name");

-- CreateIndex
CREATE INDEX "inventory_movements_tenant_id_project_id_inventory_item_id_idx" ON "inventory_movements"("tenant_id", "project_id", "inventory_item_id");

-- CreateIndex
CREATE INDEX "safety_incidents_tenant_id_project_id_incident_type_idx" ON "safety_incidents"("tenant_id", "project_id", "incident_type");

-- CreateIndex
CREATE INDEX "project_documents_tenant_id_project_id_category_idx" ON "project_documents"("tenant_id", "project_id", "category");

-- CreateIndex
CREATE INDEX "drawing_annotations_tenant_id_project_id_document_id_idx" ON "drawing_annotations"("tenant_id", "project_id", "document_id");

-- CreateIndex
CREATE INDEX "subcontractor_packages_tenant_id_project_id_trade_category_idx" ON "subcontractor_packages"("tenant_id", "project_id", "trade_category");

-- CreateIndex
CREATE INDEX "project_delay_events_tenant_id_project_id_status_idx" ON "project_delay_events"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_tax_certificates_certificate_no_key" ON "statutory_tax_certificates"("certificate_no");

-- CreateIndex
CREATE INDEX "statutory_tax_certificates_tenant_id_project_id_payee_kra_p_idx" ON "statutory_tax_certificates"("tenant_id", "project_id", "payee_kra_pin");

-- CreateIndex
CREATE INDEX "material_requisitions_tenant_id_project_id_status_idx" ON "material_requisitions"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE INDEX "material_wastage_reconciliations_tenant_id_project_id_statu_idx" ON "material_wastage_reconciliations"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE INDEX "project_cash_flow_forecasts_tenant_id_project_id_idx" ON "project_cash_flow_forecasts"("tenant_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_cash_flow_forecasts_tenant_id_project_id_period_mon_key" ON "project_cash_flow_forecasts"("tenant_id", "project_id", "period_month");

-- CreateIndex
CREATE INDEX "subcontractor_valuations_tenant_id_project_id_subcontractor_idx" ON "subcontractor_valuations"("tenant_id", "project_id", "subcontractor_package_id");

-- CreateIndex
CREATE UNIQUE INDEX "plant_equipment_tenant_id_project_id_equipment_code_key" ON "plant_equipment"("tenant_id", "project_id", "equipment_code");

-- CreateIndex
CREATE INDEX "plant_equipment_daily_logs_tenant_id_project_id_equipment_i_idx" ON "plant_equipment_daily_logs"("tenant_id", "project_id", "equipment_id");

-- CreateIndex
CREATE INDEX "site_laborers_tenant_id_project_id_trade_category_idx" ON "site_laborers"("tenant_id", "project_id", "trade_category");

-- CreateIndex
CREATE UNIQUE INDEX "site_laborers_tenant_id_national_id_no_key" ON "site_laborers"("tenant_id", "national_id_no");

-- CreateIndex
CREATE UNIQUE INDEX "labor_muster_rolls_tenant_id_project_id_payroll_no_key" ON "labor_muster_rolls"("tenant_id", "project_id", "payroll_no");

-- CreateIndex
CREATE UNIQUE INDEX "labor_daily_attendances_tenant_id_muster_roll_id_laborer_id_key" ON "labor_daily_attendances"("tenant_id", "muster_roll_id", "laborer_id", "attendance_date");

-- CreateIndex
CREATE INDEX "safety_audit_records_tenant_id_project_id_audit_outcome_idx" ON "safety_audit_records"("tenant_id", "project_id", "audit_outcome");

-- CreateIndex
CREATE INDEX "etims_invoices_tenant_id_project_id_transmission_status_idx" ON "etims_invoices"("tenant_id", "project_id", "transmission_status");

-- CreateIndex
CREATE UNIQUE INDEX "etims_invoices_tenant_id_invoice_number_key" ON "etims_invoices"("tenant_id", "invoice_number");

-- CreateIndex
CREATE INDEX "subcontractor_tax_compliances_tenant_id_compliance_status_idx" ON "subcontractor_tax_compliances"("tenant_id", "compliance_status");

-- CreateIndex
CREATE INDEX "site_webhook_logs_tenant_id_detected_command_processed_stat_idx" ON "site_webhook_logs"("tenant_id", "detected_command", "processed_status");

-- CreateIndex
CREATE INDEX "site_alert_notifications_tenant_id_project_id_alert_type_idx" ON "site_alert_notifications"("tenant_id", "project_id", "alert_type");

-- CreateIndex
CREATE INDEX "subcontractor_retention_releases_tenant_id_project_id_statu_idx" ON "subcontractor_retention_releases"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE INDEX "contractor_bond_trackers_tenant_id_project_id_bond_type_cla_idx" ON "contractor_bond_trackers"("tenant_id", "project_id", "bond_type", "claim_status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_tenant_id_plan_code_key" ON "subscription_plans"("tenant_id", "plan_code");

-- CreateIndex
CREATE UNIQUE INDEX "mpesa_subscription_transactions_checkout_request_id_key" ON "mpesa_subscription_transactions"("checkout_request_id");

-- CreateIndex
CREATE INDEX "mpesa_subscription_transactions_tenant_id_transaction_statu_idx" ON "mpesa_subscription_transactions"("tenant_id", "transaction_status");

-- CreateIndex
CREATE INDEX "project_geofences_tenant_id_project_id_is_active_idx" ON "project_geofences"("tenant_id", "project_id", "is_active");

-- CreateIndex
CREATE INDEX "worker_clock_events_tenant_id_project_id_verification_statu_idx" ON "worker_clock_events"("tenant_id", "project_id", "verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "plant_telematics_devices_equipment_id_key" ON "plant_telematics_devices"("equipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "plant_telematics_devices_device_imei_key" ON "plant_telematics_devices"("device_imei");

-- CreateIndex
CREATE UNIQUE INDEX "plant_telematics_devices_device_token_key" ON "plant_telematics_devices"("device_token");

-- CreateIndex
CREATE INDEX "plant_telematics_devices_tenant_id_status_idx" ON "plant_telematics_devices"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "plant_telematics_devices_tenant_id_project_id_idx" ON "plant_telematics_devices"("tenant_id", "project_id");

-- CreateIndex
CREATE INDEX "plant_telematics_pings_device_id_ping_timestamp_idx" ON "plant_telematics_pings"("device_id", "ping_timestamp" DESC);

-- CreateIndex
CREATE INDEX "plant_telematics_pings_equipment_id_ping_timestamp_idx" ON "plant_telematics_pings"("equipment_id", "ping_timestamp" DESC);

-- CreateIndex
CREATE INDEX "plant_telematics_pings_tenant_id_equipment_id_is_siphoning__idx" ON "plant_telematics_pings"("tenant_id", "equipment_id", "is_siphoning_event");

-- CreateIndex
CREATE INDEX "plant_maintenance_alerts_tenant_id_project_id_status_idx" ON "plant_maintenance_alerts"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE INDEX "plant_maintenance_alerts_tenant_id_equipment_id_status_idx" ON "plant_maintenance_alerts"("tenant_id", "equipment_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "plant_maintenance_alerts_tenant_id_alert_code_key" ON "plant_maintenance_alerts"("tenant_id", "alert_code");

-- CreateIndex
CREATE INDEX "bar_bending_schedules_tenant_id_project_id_status_idx" ON "bar_bending_schedules"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bar_bending_schedules_tenant_id_project_id_schedule_number_key" ON "bar_bending_schedules"("tenant_id", "project_id", "schedule_number");

-- CreateIndex
CREATE INDEX "bar_bending_items_tenant_id_schedule_id_bar_type_idx" ON "bar_bending_items"("tenant_id", "schedule_id", "bar_type");

-- CreateIndex
CREATE UNIQUE INDEX "mpesa_disbursement_transactions_idempotency_key_key" ON "mpesa_disbursement_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "mpesa_disbursement_transactions_tenant_id_project_id_transa_idx" ON "mpesa_disbursement_transactions"("tenant_id", "project_id", "transaction_status");

-- CreateIndex
CREATE INDEX "rmc_batch_deliveries_tenant_id_project_id_status_idx" ON "rmc_batch_deliveries"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rmc_batch_deliveries_tenant_id_project_id_delivery_ticket_n_key" ON "rmc_batch_deliveries"("tenant_id", "project_id", "delivery_ticket_no");

-- CreateIndex
CREATE INDEX "rmc_slump_tests_tenant_id_delivery_id_idx" ON "rmc_slump_tests"("tenant_id", "delivery_id");

-- CreateIndex
CREATE INDEX "structural_steel_takeoffs_tenant_id_project_id_status_idx" ON "structural_steel_takeoffs"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "structural_steel_takeoffs_tenant_id_project_id_takeoff_no_key" ON "structural_steel_takeoffs"("tenant_id", "project_id", "takeoff_no");

-- CreateIndex
CREATE INDEX "structural_steel_members_tenant_id_takeoff_id_section_type_idx" ON "structural_steel_members"("tenant_id", "takeoff_id", "section_type");

-- CreateIndex
CREATE INDEX "geotechnical_soil_tests_tenant_id_project_id_layer_type_idx" ON "geotechnical_soil_tests"("tenant_id", "project_id", "layer_type");

-- CreateIndex
CREATE UNIQUE INDEX "geotechnical_soil_tests_tenant_id_project_id_test_number_key" ON "geotechnical_soil_tests"("tenant_id", "project_id", "test_number");

-- CreateIndex
CREATE INDEX "asphalt_pavement_batches_tenant_id_project_id_mix_type_idx" ON "asphalt_pavement_batches"("tenant_id", "project_id", "mix_type");

-- CreateIndex
CREATE UNIQUE INDEX "asphalt_pavement_batches_tenant_id_project_id_ticket_number_key" ON "asphalt_pavement_batches"("tenant_id", "project_id", "ticket_number");

-- CreateIndex
CREATE INDEX "topographic_surveys_tenant_id_project_id_status_idx" ON "topographic_surveys"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "topographic_surveys_tenant_id_project_id_survey_code_key" ON "topographic_surveys"("tenant_id", "project_id", "survey_code");

-- CreateIndex
CREATE INDEX "cross_section_stations_tenant_id_survey_id_chainage_meters_idx" ON "cross_section_stations"("tenant_id", "survey_id", "chainage_meters");

-- CreateIndex
CREATE INDEX "cross_section_stations_tenant_id_project_id_idx" ON "cross_section_stations"("tenant_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "cross_section_stations_survey_id_station_index_key" ON "cross_section_stations"("survey_id", "station_index");

-- CreateIndex
CREATE UNIQUE INDEX "cross_section_stations_survey_id_chainage_meters_key" ON "cross_section_stations"("survey_id", "chainage_meters");

-- CreateIndex
CREATE INDEX "independent_site_inspections_tenant_id_project_id_status_idx" ON "independent_site_inspections"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "independent_site_inspections_tenant_id_project_id_inspectio_key" ON "independent_site_inspections"("tenant_id", "project_id", "inspection_code");

-- CreateIndex
CREATE INDEX "independent_inspection_photos_tenant_id_inspection_id_idx" ON "independent_inspection_photos"("tenant_id", "inspection_id");

-- CreateIndex
CREATE INDEX "independent_inspection_photos_tenant_id_project_id_idx" ON "independent_inspection_photos"("tenant_id", "project_id");

-- CreateIndex
CREATE INDEX "project_tenders_tenant_id_project_id_status_idx" ON "project_tenders"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_tenders_tenant_id_project_id_tender_code_key" ON "project_tenders"("tenant_id", "project_id", "tender_code");

-- CreateIndex
CREATE INDEX "tender_bids_tenant_id_tender_id_idx" ON "tender_bids"("tenant_id", "tender_id");

-- CreateIndex
CREATE INDEX "tender_bids_tenant_id_project_id_idx" ON "tender_bids"("tenant_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_share_token_hash_key" ON "quotes"("share_token_hash");

-- CreateIndex
CREATE INDEX "quotes_tenant_id_status_idx" ON "quotes"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "quotes_tenant_id_client_email_idx" ON "quotes"("tenant_id", "client_email");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_tenant_id_quote_no_key" ON "quotes"("tenant_id", "quote_no");

-- CreateIndex
CREATE INDEX "quote_line_items_tenant_id_quote_id_idx" ON "quote_line_items"("tenant_id", "quote_id");

-- CreateIndex
CREATE INDEX "quote_events_tenant_id_quote_id_idx" ON "quote_events"("tenant_id", "quote_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_status_idx" ON "invoices"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_project_id_idx" ON "invoices"("tenant_id", "project_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_due_date_idx" ON "invoices"("tenant_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_invoice_no_key" ON "invoices"("tenant_id", "invoice_no");

-- CreateIndex
CREATE INDEX "invoice_line_items_tenant_id_invoice_id_idx" ON "invoice_line_items"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "invoice_payments_tenant_id_invoice_id_idx" ON "invoice_payments"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "payment_certificates_tenant_id_project_id_status_idx" ON "payment_certificates"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_certificates_project_id_certificate_no_key" ON "payment_certificates"("project_id", "certificate_no");

-- CreateIndex
CREATE INDEX "commitments_tenant_id_project_id_status_idx" ON "commitments"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "commitments_project_id_commitment_no_key" ON "commitments"("project_id", "commitment_no");

-- CreateIndex
CREATE INDEX "payment_applications_tenant_id_project_id_status_idx" ON "payment_applications"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_applications_commitment_id_application_no_key" ON "payment_applications"("commitment_id", "application_no");

-- CreateIndex
CREATE INDEX "snag_comments_tenant_id_snag_item_id_idx" ON "snag_comments"("tenant_id", "snag_item_id");

-- CreateIndex
CREATE INDEX "snag_distributions_tenant_id_snag_item_id_idx" ON "snag_distributions"("tenant_id", "snag_item_id");

-- CreateIndex
CREATE INDEX "announcements_tenant_id_status_published_at_idx" ON "announcements"("tenant_id", "status", "published_at");

-- CreateIndex
CREATE INDEX "client_project_requests_tenant_id_status_created_at_idx" ON "client_project_requests"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "announcement_reads_tenant_id_announcement_id_idx" ON "announcement_reads"("tenant_id", "announcement_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_announcement_id_user_id_key" ON "announcement_reads"("announcement_id", "user_id");

-- CreateIndex
CREATE INDEX "inbox_messages_tenant_id_project_id_created_at_idx" ON "inbox_messages"("tenant_id", "project_id", "created_at");

-- CreateIndex
CREATE INDEX "inbox_message_reads_tenant_id_message_id_idx" ON "inbox_message_reads"("tenant_id", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_message_reads_message_id_user_id_key" ON "inbox_message_reads"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "site_observations_tenant_id_project_id_status_idx" ON "site_observations"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "site_observations_project_id_obs_number_key" ON "site_observations"("project_id", "obs_number");

-- CreateIndex
CREATE INDEX "corrective_actions_tenant_id_project_id_status_idx" ON "corrective_actions"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE INDEX "crews_tenant_id_project_id_status_idx" ON "crews"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE INDEX "crew_members_tenant_id_crew_id_idx" ON "crew_members"("tenant_id", "crew_id");

-- CreateIndex
CREATE INDEX "company_documents_tenant_id_category_status_idx" ON "company_documents"("tenant_id", "category", "status");

-- CreateIndex
CREATE INDEX "company_documents_tenant_id_expiry_date_idx" ON "company_documents"("tenant_id", "expiry_date");

-- CreateIndex
CREATE INDEX "correspondence_items_tenant_id_project_id_type_idx" ON "correspondence_items"("tenant_id", "project_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "correspondence_items_project_id_corr_number_key" ON "correspondence_items"("project_id", "corr_number");

-- CreateIndex
CREATE INDEX "scheduled_reports_tenant_id_status_next_run_at_idx" ON "scheduled_reports"("tenant_id", "status", "next_run_at");

-- CreateIndex
CREATE INDEX "scheduled_report_runs_tenant_id_report_id_ran_at_idx" ON "scheduled_report_runs"("tenant_id", "report_id", "ran_at");

-- CreateIndex
CREATE INDEX "daily_attendances_tenant_id_project_id_work_date_idx" ON "daily_attendances"("tenant_id", "project_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_attendances_tenant_id_project_id_laborer_id_work_date_key" ON "daily_attendances"("tenant_id", "project_id", "laborer_id", "work_date");

-- CreateIndex
CREATE INDEX "checklist_templates_tenant_id_trade_category_status_idx" ON "checklist_templates"("tenant_id", "trade_category", "status");

-- CreateIndex
CREATE INDEX "checklist_assignments_tenant_id_project_id_status_idx" ON "checklist_assignments"("tenant_id", "project_id", "status");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boqs" ADD CONSTRAINT "boqs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_sections" ADD CONSTRAINT "boq_sections_boq_id_fkey" FOREIGN KEY ("boq_id") REFERENCES "boqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "boq_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_diaries" ADD CONSTRAINT "site_diaries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_site_diary_id_fkey" FOREIGN KEY ("site_diary_id") REFERENCES "site_diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_headcounts" ADD CONSTRAINT "labor_headcounts_site_diary_id_fkey" FOREIGN KEY ("site_diary_id") REFERENCES "site_diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_deliveries" ADD CONSTRAINT "material_deliveries_site_diary_id_fkey" FOREIGN KEY ("site_diary_id") REFERENCES "site_diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_records" ADD CONSTRAINT "progress_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_items" ADD CONSTRAINT "progress_items_progress_record_id_fkey" FOREIGN KEY ("progress_record_id") REFERENCES "progress_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_items" ADD CONSTRAINT "progress_items_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "boq_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "boq_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_receipts" ADD CONSTRAINT "cost_receipts_cost_entry_id_fkey" FOREIGN KEY ("cost_entry_id") REFERENCES "cost_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_approvals" ADD CONSTRAINT "cost_approvals_cost_entry_id_fkey" FOREIGN KEY ("cost_entry_id") REFERENCES "cost_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_approvals" ADD CONSTRAINT "cost_approvals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variation_orders" ADD CONSTRAINT "variation_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variation_assignees" ADD CONSTRAINT "variation_assignees_variation_order_id_fkey" FOREIGN KEY ("variation_order_id") REFERENCES "variation_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variation_events" ADD CONSTRAINT "variation_events_variation_order_id_fkey" FOREIGN KEY ("variation_order_id") REFERENCES "variation_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variation_items" ADD CONSTRAINT "variation_items_variation_order_id_fkey" FOREIGN KEY ("variation_order_id") REFERENCES "variation_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variation_items" ADD CONSTRAINT "variation_items_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "boq_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfi_responses" ADD CONSTRAINT "rfi_responses_rfi_id_fkey" FOREIGN KEY ("rfi_id") REFERENCES "rfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfi_responses" ADD CONSTRAINT "rfi_responses_responder_id_fkey" FOREIGN KEY ("responder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfi_attachments" ADD CONSTRAINT "rfi_attachments_rfi_id_fkey" FOREIGN KEY ("rfi_id") REFERENCES "rfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_checklists" ADD CONSTRAINT "inspection_checklists_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "inspection_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concrete_cube_tests" ADD CONSTRAINT "concrete_cube_tests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cube_break_results" ADD CONSTRAINT "cube_break_results_cube_test_id_fkey" FOREIGN KEY ("cube_test_id") REFERENCES "concrete_cube_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snag_photos" ADD CONSTRAINT "snag_photos_snag_item_id_fkey" FOREIGN KEY ("snag_item_id") REFERENCES "snag_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects_liability_certificates" ADD CONSTRAINT "defects_liability_certificates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_access_links" ADD CONSTRAINT "portal_access_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_schedule_tasks" ADD CONSTRAINT "project_schedule_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_inventory_items" ADD CONSTRAINT "site_inventory_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "site_inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_annotations" ADD CONSTRAINT "drawing_annotations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "project_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_packages" ADD CONSTRAINT "subcontractor_packages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delay_events" ADD CONSTRAINT "project_delay_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_tax_certificates" ADD CONSTRAINT "statutory_tax_certificates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "site_inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_wastage_reconciliations" ADD CONSTRAINT "material_wastage_reconciliations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_wastage_reconciliations" ADD CONSTRAINT "material_wastage_reconciliations_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "site_inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_cash_flow_forecasts" ADD CONSTRAINT "project_cash_flow_forecasts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_valuations" ADD CONSTRAINT "subcontractor_valuations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_valuations" ADD CONSTRAINT "subcontractor_valuations_subcontractor_package_id_fkey" FOREIGN KEY ("subcontractor_package_id") REFERENCES "subcontractor_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_equipment" ADD CONSTRAINT "plant_equipment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_equipment_daily_logs" ADD CONSTRAINT "plant_equipment_daily_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_equipment_daily_logs" ADD CONSTRAINT "plant_equipment_daily_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "plant_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_laborers" ADD CONSTRAINT "site_laborers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_muster_rolls" ADD CONSTRAINT "labor_muster_rolls_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_daily_attendances" ADD CONSTRAINT "labor_daily_attendances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_daily_attendances" ADD CONSTRAINT "labor_daily_attendances_muster_roll_id_fkey" FOREIGN KEY ("muster_roll_id") REFERENCES "labor_muster_rolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_daily_attendances" ADD CONSTRAINT "labor_daily_attendances_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "site_laborers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_audit_records" ADD CONSTRAINT "safety_audit_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etims_invoices" ADD CONSTRAINT "etims_invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_tax_compliances" ADD CONSTRAINT "subcontractor_tax_compliances_subcontractor_package_id_fkey" FOREIGN KEY ("subcontractor_package_id") REFERENCES "subcontractor_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_webhook_logs" ADD CONSTRAINT "site_webhook_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_alert_notifications" ADD CONSTRAINT "site_alert_notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_retention_releases" ADD CONSTRAINT "subcontractor_retention_releases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_retention_releases" ADD CONSTRAINT "subcontractor_retention_releases_subcontractor_package_id_fkey" FOREIGN KEY ("subcontractor_package_id") REFERENCES "subcontractor_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_bond_trackers" ADD CONSTRAINT "contractor_bond_trackers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mpesa_subscription_transactions" ADD CONSTRAINT "mpesa_subscription_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_geofences" ADD CONSTRAINT "project_geofences_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_clock_events" ADD CONSTRAINT "worker_clock_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_clock_events" ADD CONSTRAINT "worker_clock_events_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "site_laborers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_telematics_devices" ADD CONSTRAINT "plant_telematics_devices_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "plant_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_telematics_devices" ADD CONSTRAINT "plant_telematics_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_telematics_devices" ADD CONSTRAINT "plant_telematics_devices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_telematics_pings" ADD CONSTRAINT "plant_telematics_pings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "plant_telematics_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_telematics_pings" ADD CONSTRAINT "plant_telematics_pings_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "plant_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_telematics_pings" ADD CONSTRAINT "plant_telematics_pings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_maintenance_alerts" ADD CONSTRAINT "plant_maintenance_alerts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_maintenance_alerts" ADD CONSTRAINT "plant_maintenance_alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_maintenance_alerts" ADD CONSTRAINT "plant_maintenance_alerts_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "plant_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_maintenance_alerts" ADD CONSTRAINT "plant_maintenance_alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "plant_telematics_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bar_bending_schedules" ADD CONSTRAINT "bar_bending_schedules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bar_bending_schedules" ADD CONSTRAINT "bar_bending_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bar_bending_items" ADD CONSTRAINT "bar_bending_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "bar_bending_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mpesa_disbursement_transactions" ADD CONSTRAINT "mpesa_disbursement_transactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mpesa_disbursement_transactions" ADD CONSTRAINT "mpesa_disbursement_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmc_batch_deliveries" ADD CONSTRAINT "rmc_batch_deliveries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmc_batch_deliveries" ADD CONSTRAINT "rmc_batch_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmc_slump_tests" ADD CONSTRAINT "rmc_slump_tests_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "rmc_batch_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmc_slump_tests" ADD CONSTRAINT "rmc_slump_tests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structural_steel_takeoffs" ADD CONSTRAINT "structural_steel_takeoffs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structural_steel_takeoffs" ADD CONSTRAINT "structural_steel_takeoffs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structural_steel_members" ADD CONSTRAINT "structural_steel_members_takeoff_id_fkey" FOREIGN KEY ("takeoff_id") REFERENCES "structural_steel_takeoffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structural_steel_members" ADD CONSTRAINT "structural_steel_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geotechnical_soil_tests" ADD CONSTRAINT "geotechnical_soil_tests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geotechnical_soil_tests" ADD CONSTRAINT "geotechnical_soil_tests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asphalt_pavement_batches" ADD CONSTRAINT "asphalt_pavement_batches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asphalt_pavement_batches" ADD CONSTRAINT "asphalt_pavement_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topographic_surveys" ADD CONSTRAINT "topographic_surveys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topographic_surveys" ADD CONSTRAINT "topographic_surveys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_section_stations" ADD CONSTRAINT "cross_section_stations_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "topographic_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_section_stations" ADD CONSTRAINT "cross_section_stations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_section_stations" ADD CONSTRAINT "cross_section_stations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "independent_site_inspections" ADD CONSTRAINT "independent_site_inspections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "independent_site_inspections" ADD CONSTRAINT "independent_site_inspections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "independent_inspection_photos" ADD CONSTRAINT "independent_inspection_photos_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "independent_site_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "independent_inspection_photos" ADD CONSTRAINT "independent_inspection_photos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "independent_inspection_photos" ADD CONSTRAINT "independent_inspection_photos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tenders" ADD CONSTRAINT "project_tenders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tenders" ADD CONSTRAINT "project_tenders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "project_tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_certificates" ADD CONSTRAINT "payment_certificates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snag_comments" ADD CONSTRAINT "snag_comments_snag_item_id_fkey" FOREIGN KEY ("snag_item_id") REFERENCES "snag_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snag_distributions" ADD CONSTRAINT "snag_distributions_snag_item_id_fkey" FOREIGN KEY ("snag_item_id") REFERENCES "snag_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_message_reads" ADD CONSTRAINT "inbox_message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "inbox_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_observations" ADD CONSTRAINT "site_observations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "site_observations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crews" ADD CONSTRAINT "crews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correspondence_items" ADD CONSTRAINT "correspondence_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_report_runs" ADD CONSTRAINT "scheduled_report_runs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "scheduled_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_attendances" ADD CONSTRAINT "daily_attendances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_attendances" ADD CONSTRAINT "daily_attendances_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "site_laborers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_attendances" ADD CONSTRAINT "daily_attendances_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_assignments" ADD CONSTRAINT "checklist_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

