CREATE TABLE `agent_messages` (
	`message_id` varchar(64) NOT NULL,
	`agent_id` varchar(64),
	`user_id` int,
	`role` varchar(32),
	`content` text,
	`metadata` json,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `agent_messages_message_id` PRIMARY KEY(`message_id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`agent_id` varchar(64) NOT NULL,
	`role_title` varchar(128),
	`short_code` varchar(16),
	`domain` text,
	`seniority` varchar(64),
	`tone` varchar(256),
	`icon` varchar(32),
	`color` varchar(32),
	`instruction_stack` json,
	`kpi_targets` json,
	`status` varchar(32) DEFAULT 'active',
	`reports_to` varchar(64),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_agent_id` PRIMARY KEY(`agent_id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`log_id` varchar(64) NOT NULL,
	`timestamp` timestamp DEFAULT (now()),
	`actor_id` varchar(64),
	`actor_type` varchar(32),
	`action` varchar(128),
	`resource_type` varchar(64),
	`resource_id` varchar(64),
	`reason` text,
	`impact` json,
	`metadata` json,
	CONSTRAINT `audit_log_log_id` PRIMARY KEY(`log_id`)
);
--> statement-breakpoint
CREATE TABLE `bom` (
	`bom_id` varchar(64) NOT NULL,
	`fg_code` varchar(64),
	`fg_description` text,
	`component_type` varchar(64),
	`component_code` varchar(64),
	`component_description` text,
	`qty_per_fg` float,
	`uom` varchar(32),
	`scrap_percent` float,
	`std_cost_aed` decimal(12,2),
	`extended_cost_aed` decimal(12,2),
	`supplier` varchar(256),
	`lead_time_days` int,
	`material_class` varchar(64),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `bom_bom_id` PRIMARY KEY(`bom_id`)
);
--> statement-breakpoint
CREATE TABLE `fg_master` (
	`sku_id` varchar(64) NOT NULL,
	`description` text,
	`division` varchar(128),
	`category` varchar(128),
	`subcategory` varchar(128),
	`pack_format` varchar(128),
	`pack_size` float,
	`brand` varchar(128),
	`primary_plant` varchar(128),
	`primary_line` varchar(128),
	`primary_channel` varchar(128),
	`launch_date` date,
	`active` boolean DEFAULT true,
	`pack_price_aed` decimal(12,2),
	`base_monthly_demand` float,
	`uom` varchar(32),
	`shelf_life_days` int,
	`target_service_level` float,
	`net_weight_kg` float,
	`case_pack` int,
	`sku_status` varchar(64),
	`lifecycle_stage` varchar(64),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fg_master_sku_id` PRIMARY KEY(`sku_id`)
);
--> statement-breakpoint
CREATE TABLE `forecast` (
	`forecast_id` varchar(64) NOT NULL,
	`month` varchar(32),
	`fg_code` varchar(64),
	`fg_description` text,
	`division` varchar(128),
	`country` varchar(64),
	`channel` varchar(128),
	`forecast_units` float,
	`forecast_asp_aed` decimal(12,2),
	`forecast_revenue_aed` decimal(12,2),
	`seasonality_index` float,
	`promo_uplift_percent` float,
	`forecast_method` varchar(64),
	`confidence_percent` float,
	`base_trend_units` float,
	`planned_promo` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `forecast_forecast_id` PRIMARY KEY(`forecast_id`)
);
--> statement-breakpoint
CREATE TABLE `hil_gates` (
	`gate_id` varchar(64) NOT NULL,
	`trigger_type` varchar(128),
	`agent_id` varchar(64),
	`payload` json,
	`status` varchar(32) DEFAULT 'pending',
	`priority` varchar(32) DEFAULT 'normal',
	`resolved_by` varchar(64),
	`resolution` varchar(32),
	`reason` text,
	`createdAt` timestamp DEFAULT (now()),
	`resolved_at` timestamp,
	CONSTRAINT `hil_gates_gate_id` PRIMARY KEY(`gate_id`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`inventory_id` varchar(64) NOT NULL,
	`item_id` varchar(64),
	`item_type` varchar(32),
	`location` varchar(128),
	`batch_no` varchar(128),
	`mfg_date` date,
	`expiry_date` date,
	`age_days` int,
	`qty_on_hand` float,
	`allocated` float,
	`available` float,
	`hold_qty` float,
	`unit_cost_aed` decimal(12,2),
	`inventory_value_aed` decimal(12,2),
	`stock_status` varchar(64),
	`qc_status` varchar(64),
	`shelf_life_days` int,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_inventory_id` PRIMARY KEY(`inventory_id`)
);
--> statement-breakpoint
CREATE TABLE `plan_store` (
	`plan_id` varchar(64) NOT NULL,
	`version` int DEFAULT 1,
	`type` varchar(64),
	`agent_id` varchar(64),
	`data_payload` json,
	`status` varchar(32) DEFAULT 'draft',
	`approved_by` varchar(64),
	`approved_at` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plan_store_plan_id` PRIMARY KEY(`plan_id`)
);
--> statement-breakpoint
CREATE TABLE `po_data` (
	`po_no` varchar(64) NOT NULL,
	`item_code` varchar(64),
	`item_type` varchar(32),
	`description` text,
	`supplier_code` varchar(64),
	`supplier_name` varchar(256),
	`supplier_country` varchar(64),
	`plant` varchar(128),
	`po_date` date,
	`requested_date` date,
	`confirmed_eta` date,
	`qty_ordered` float,
	`qty_received` float,
	`open_qty` float,
	`unit_cost_aed` decimal(12,2),
	`po_value_aed` decimal(12,2),
	`currency` varchar(32),
	`incoterms` varchar(32),
	`status` varchar(64),
	`priority` varchar(64),
	`batch_no` varchar(128),
	`payment_terms` varchar(128),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `po_data_po_no` PRIMARY KEY(`po_no`)
);
--> statement-breakpoint
CREATE TABLE `rm_master` (
	`material_id` varchar(64) NOT NULL,
	`description` text,
	`category` varchar(128),
	`rm_type` varchar(128),
	`function` varchar(128),
	`uom` varchar(32),
	`std_cost_aed` decimal(12,2),
	`lead_time_days` int,
	`supplier_id` varchar(64),
	`supplier_name` varchar(256),
	`country` varchar(64),
	`moq` float,
	`shelf_life_days` int,
	`specification` text,
	`quality_status` varchar(64),
	`sustainability_flag` boolean,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rm_master_material_id` PRIMARY KEY(`material_id`)
);
--> statement-breakpoint
CREATE TABLE `sales_history` (
	`history_id` varchar(64) NOT NULL,
	`month` varchar(32),
	`fg_code` varchar(64),
	`fg_description` text,
	`division` varchar(128),
	`country` varchar(64),
	`channel` varchar(128),
	`units_sold` float,
	`gross_sales_aed` decimal(12,2),
	`promo_discount_percent` float,
	`net_asp_aed` decimal(12,2),
	`net_sales_aed` decimal(12,2),
	`returns_units` float,
	`fill_rate_percent` float,
	`trade_spend_aed` decimal(12,2),
	`sell_through_percent` float,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `sales_history_history_id` PRIMARY KEY(`history_id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`supplier_code` varchar(64) NOT NULL,
	`supplier_name` varchar(256),
	`category` varchar(128),
	`country` varchar(64),
	`payment_terms` varchar(128),
	`lead_time_days` int,
	`approved` boolean,
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_supplier_code` PRIMARY KEY(`supplier_code`)
);
--> statement-breakpoint
CREATE TABLE `tools` (
	`tool_id` varchar(64) NOT NULL,
	`name` varchar(256),
	`description` text,
	`category` varchar(128),
	`owner_agent` varchar(64),
	`callable_by` json,
	`parameters` json,
	`returns` json,
	`implementation` text,
	`status` varchar(32) DEFAULT 'active',
	`usage_count` int DEFAULT 0,
	`avg_accuracy` float,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tools_tool_id` PRIMARY KEY(`tool_id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','ops_head','planner') NOT NULL DEFAULT 'user';