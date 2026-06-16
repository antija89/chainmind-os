-- Add execution_state and planId columns to agent_messages
ALTER TABLE `agent_messages` ADD COLUMN `execution_state` varchar(32);
ALTER TABLE `agent_messages` ADD COLUMN `plan_id` varchar(64);

-- Create execution_plans table for Phase B
CREATE TABLE `execution_plans` (
	`plan_id` varchar(64) PRIMARY KEY NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`agent_id` varchar(64) NOT NULL,
	`user_id` int,
	`goal` text NOT NULL,
	`required_information` json,
	`execution_steps` json NOT NULL,
	`dependencies` json,
	`success_criteria` json,
	`plan_status` enum('draft','reviewed','approved','executing','completed','failed') DEFAULT 'draft',
	`plan_review_score` int,
	`plan_review_feedback` text,
	`replans_attempted` int DEFAULT 0,
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create plan_executions table for Phase D (execution memory)
CREATE TABLE `plan_executions` (
	`execution_id` varchar(64) PRIMARY KEY NOT NULL,
	`plan_id` varchar(64) NOT NULL,
	`step_number` int NOT NULL,
	`tool_id` varchar(64) NOT NULL,
	`tool_name` varchar(256),
	`tool_input` json NOT NULL,
	`tool_output` json,
	`execution_status` enum('pending','running','success','error','timeout') DEFAULT 'pending',
	`execution_time_ms` int,
	`error_message` text,
	`context_before` json,
	`context_after` json,
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`plan_id`) REFERENCES `execution_plans`(`plan_id`)
);

-- Add capabilities column to agent_tools for Phase E (capability registry)
ALTER TABLE `agent_tools` ADD COLUMN `capabilities` json;

-- Create indexes for performance
CREATE INDEX `idx_execution_plans_session` ON `execution_plans`(`session_id`);
CREATE INDEX `idx_execution_plans_agent` ON `execution_plans`(`agent_id`);
CREATE INDEX `idx_execution_plans_status` ON `execution_plans`(`plan_status`);
CREATE INDEX `idx_plan_executions_plan` ON `plan_executions`(`plan_id`);
CREATE INDEX `idx_plan_executions_status` ON `plan_executions`(`execution_status`);
