-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" TEXT,
    "verification_token_expires" TIMESTAMP(3),
    "verification_code" TEXT,
    "code_expires_at" TIMESTAMP(3),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "usage_limit" INTEGER NOT NULL DEFAULT 3,
    "report_retention_days" INTEGER NOT NULL DEFAULT 14,
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "underwriting_submissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "property_address" TEXT NOT NULL,
    "property_city" TEXT,
    "property_state" TEXT,
    "property_zip" TEXT,
    "property_county" TEXT,
    "property_latitude" DOUBLE PRECISION,
    "property_longitude" DOUBLE PRECISION,
    "property_type" TEXT,
    "property_condition" TEXT NOT NULL,
    "square_feet" INTEGER NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "year_built" INTEGER,
    "purchase_price" DOUBLE PRECISION NOT NULL,
    "rehab" DOUBLE PRECISION NOT NULL,
    "renovation_per_sf" TEXT NOT NULL,
    "user_estimated_arv" DOUBLE PRECISION,
    "user_estimated_as_is_value" DOUBLE PRECISION,
    "interest_rate" DOUBLE PRECISION NOT NULL,
    "months" INTEGER NOT NULL,
    "loan_at_purchase" DOUBLE PRECISION NOT NULL,
    "renovation_funds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closing_costs_percent" DOUBLE PRECISION NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "market_type" TEXT NOT NULL,
    "additional_details" TEXT,
    "comp_links" TEXT,
    "estimated_arv" DOUBLE PRECISION,
    "as_is_value" DOUBLE PRECISION,
    "monthly_rent" DOUBLE PRECISION,
    "final_score" INTEGER,
    "gary_opinion" TEXT,
    "ai_property_comps" TEXT,
    "comp_selection_state" TEXT,
    "report_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "recaptcha_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "underwriting_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" SERIAL NOT NULL,
    "ip_address" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "window_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batchdata_address_cache" (
    "id" SERIAL NOT NULL,
    "original_address" TEXT NOT NULL,
    "normalized_address" TEXT NOT NULL,
    "standardized_address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zip_code" TEXT,
    "county_fips" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "validated" BOOLEAN NOT NULL,
    "raw_response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batchdata_address_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batchdata_property_cache" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "property_type" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "square_feet" INTEGER,
    "lot_size" INTEGER,
    "year_built" INTEGER,
    "last_sale_date" TEXT,
    "last_sale_price" DOUBLE PRECISION,
    "tax_assessed_value" DOUBLE PRECISION,
    "owner_name" TEXT,
    "owner_type" TEXT,
    "avm_value" DOUBLE PRECISION,
    "avm_confidence" DOUBLE PRECISION,
    "avm_date" TEXT,
    "pre_foreclosure" BOOLEAN,
    "raw_response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batchdata_property_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batchdata_comps_cache" (
    "id" SERIAL NOT NULL,
    "subject_address" TEXT NOT NULL,
    "search_hash" TEXT NOT NULL,
    "comp_tier" INTEGER NOT NULL,
    "comp_count" INTEGER NOT NULL,
    "median_price_per_sqft" DOUBLE PRECISION,
    "comp_derived_value" DOUBLE PRECISION,
    "raw_response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batchdata_comps_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batchdata_api_usage" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "cached" BOOLEAN NOT NULL,
    "response_time_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batchdata_api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realie_comps_cache" (
    "id" SERIAL NOT NULL,
    "search_hash" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius" DOUBLE PRECISION NOT NULL,
    "search_tier" INTEGER NOT NULL,
    "comp_count" INTEGER NOT NULL,
    "median_price_per_sqft" DOUBLE PRECISION,
    "estimated_arv" DOUBLE PRECISION,
    "raw_response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "realie_comps_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realie_api_usage" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "cached" BOOLEAN NOT NULL,
    "response_time_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realie_api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_normalized_email_idx" ON "users"("normalized_email");

-- CreateIndex
CREATE INDEX "users_verification_token_idx" ON "users"("verification_token");

-- CreateIndex
CREATE UNIQUE INDEX "underwriting_submissions_report_id_key" ON "underwriting_submissions"("report_id");

-- CreateIndex
CREATE INDEX "underwriting_submissions_user_id_idx" ON "underwriting_submissions"("user_id");

-- CreateIndex
CREATE INDEX "underwriting_submissions_created_at_idx" ON "underwriting_submissions"("created_at");

-- CreateIndex
CREATE INDEX "underwriting_submissions_property_state_idx" ON "underwriting_submissions"("property_state");

-- CreateIndex
CREATE INDEX "underwriting_submissions_report_id_idx" ON "underwriting_submissions"("report_id");

-- CreateIndex
CREATE INDEX "underwriting_submissions_expires_at_idx" ON "underwriting_submissions"("expires_at");

-- CreateIndex
CREATE INDEX "rate_limits_ip_address_endpoint_idx" ON "rate_limits"("ip_address", "endpoint");

-- CreateIndex
CREATE INDEX "rate_limits_window_start_idx" ON "rate_limits"("window_start");

-- CreateIndex
CREATE UNIQUE INDEX "batchdata_address_cache_normalized_address_key" ON "batchdata_address_cache"("normalized_address");

-- CreateIndex
CREATE INDEX "batchdata_address_cache_normalized_address_idx" ON "batchdata_address_cache"("normalized_address");

-- CreateIndex
CREATE INDEX "batchdata_address_cache_expires_at_idx" ON "batchdata_address_cache"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "batchdata_property_cache_address_key" ON "batchdata_property_cache"("address");

-- CreateIndex
CREATE INDEX "batchdata_property_cache_address_idx" ON "batchdata_property_cache"("address");

-- CreateIndex
CREATE INDEX "batchdata_property_cache_expires_at_idx" ON "batchdata_property_cache"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "batchdata_comps_cache_search_hash_key" ON "batchdata_comps_cache"("search_hash");

-- CreateIndex
CREATE INDEX "batchdata_comps_cache_search_hash_idx" ON "batchdata_comps_cache"("search_hash");

-- CreateIndex
CREATE INDEX "batchdata_comps_cache_subject_address_idx" ON "batchdata_comps_cache"("subject_address");

-- CreateIndex
CREATE INDEX "batchdata_comps_cache_expires_at_idx" ON "batchdata_comps_cache"("expires_at");

-- CreateIndex
CREATE INDEX "batchdata_api_usage_created_at_idx" ON "batchdata_api_usage"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "realie_comps_cache_search_hash_key" ON "realie_comps_cache"("search_hash");

-- CreateIndex
CREATE INDEX "realie_comps_cache_search_hash_idx" ON "realie_comps_cache"("search_hash");

-- CreateIndex
CREATE INDEX "realie_comps_cache_latitude_longitude_idx" ON "realie_comps_cache"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "realie_comps_cache_expires_at_idx" ON "realie_comps_cache"("expires_at");

-- CreateIndex
CREATE INDEX "realie_api_usage_created_at_idx" ON "realie_api_usage"("created_at");

-- AddForeignKey
ALTER TABLE "underwriting_submissions" ADD CONSTRAINT "underwriting_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

