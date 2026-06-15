-- Create supervision_logs table
CREATE TABLE IF NOT EXISTS `supervision_logs` (
  `supervision_id` varchar(64) NOT NULL PRIMARY KEY,
  `agent_id` varchar(64) NOT NULL,
  `agent_name` varchar(255),
  `question` text,
  `agent_response` text,
  `response_status` enum('success', 'blank', 'error', 'incomplete') DEFAULT 'success',
  `tools_used` json,
  `execution_details` json,
  `needs_review` boolean DEFAULT false,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_response_status` (`response_status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create agent_guidance table
CREATE TABLE IF NOT EXISTS `agent_guidance` (
  `guidance_id` varchar(64) NOT NULL PRIMARY KEY,
  `supervision_id` varchar(64) NOT NULL,
  `agent_id` varchar(64) NOT NULL,
  `guidance_type` enum('clarification', 'correction', 'suggestion', 'escalation') NOT NULL,
  `guidance_text` text NOT NULL,
  `guidance_action` enum('retry', 'create_tool', 'escalate', 'manual_input') NOT NULL,
  `resolved` boolean DEFAULT false,
  `agent_response_after_guidance` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL,
  KEY `idx_supervision_id` (`supervision_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_resolved` (`resolved`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create conversation_logs table
CREATE TABLE IF NOT EXISTS `conversation_logs` (
  `conversation_id` varchar(64) NOT NULL PRIMARY KEY,
  `agent_id` varchar(64) NOT NULL,
  `supervision_id` varchar(64),
  `user_message` text,
  `agent_message` text,
  `conversation_type` enum('user_to_agent', 'agent_to_reviewer', 'reviewer_to_agent', 'agent_to_agent') NOT NULL,
  `metadata` json,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_supervision_id` (`supervision_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
