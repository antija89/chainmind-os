# Tool Persistence Strategy for Production

## Current Architecture (Development)

```
User Input (Natural Language)
    ↓
Tool Creation Agent (Frontend)
    ↓
LLM generates suggestions
    ↓
User selects tool
    ↓
trpc.tools.create mutation
    ↓
Backend saves to agent_tools table
    ↓
Tool available for all agents immediately
```

---

## Production Data Persistence (Manus-Hosted)

When ChainMind OS is deployed to production on Manus, tools are persisted through:

### **1. Primary Storage: MySQL Database**
- **Table:** `agent_tools`
- **Location:** Manus-managed MySQL database (TiDB)
- **Persistence:** ✅ **PERMANENT** - Data survives app restarts, deployments, and updates
- **Backup:** Automatic daily backups by Manus infrastructure
- **Replication:** Multi-region replication for high availability

**Schema:**
```sql
CREATE TABLE agent_tools (
  tool_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  agent_ids JSON,
  input_schema JSON,
  output_schema JSON,
  implementation VARCHAR(255),
  data_sources JSON,
  complexity VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_agent_ids (agent_ids(100))
);
```

### **2. Execution Logging: tool_execution_log Table**
- **Purpose:** Audit trail of all tool executions
- **Retention:** Permanent (configurable retention policy)
- **Data Captured:**
  - Tool ID and name
  - Agent ID that executed it
  - User ID who triggered it
  - Input parameters
  - Output results
  - Execution time
  - Success/error status
  - Error messages

**Schema:**
```sql
CREATE TABLE tool_execution_log (
  execution_id VARCHAR(255) PRIMARY KEY,
  tool_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255),
  user_id INT,
  message_id VARCHAR(255),
  input_params JSON,
  output_result JSON,
  execution_time_ms INT,
  status ENUM('success', 'error', 'timeout'),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tool_id (tool_id),
  INDEX idx_agent_id (agent_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (tool_id) REFERENCES agent_tools(tool_id)
);
```

---

## Data Flow in Production

### **Creating a New Tool**

```
1. Agent/User fills Tool Creation form
   ↓
2. Frontend sends: trpc.tools.create({
     name: "...",
     description: "...",
     category: "...",
     agentIds: [...],
     inputSchema: {...},
     outputSchema: {...},
     implementation: "...",
     complexity: "..."
   })
   ↓
3. Backend procedure (server/routers.ts):
   - Validates input schema
   - Generates unique tool_id
   - Inserts into agent_tools table
   - Returns tool with ID
   ↓
4. MySQL persists the row permanently
   ↓
5. Tool immediately available for all agents
   ↓
6. On next LLM call, tool appears in function definitions
```

### **Using a Tool (Execution)**

```
1. Agent receives user query
   ↓
2. Backend calls executeLLMWithTools():
   - Fetches all tools for agent from agent_tools table
   - Converts to OpenAI function format
   - Sends to LLM with query
   ↓
3. LLM returns tool_calls
   ↓
4. Backend executes tool implementation
   ↓
5. Backend logs execution to tool_execution_log:
   - tool_id
   - agent_id
   - user_id
   - input_params
   - output_result
   - execution_time
   - status
   ↓
6. Log entry persisted to MySQL
   ↓
7. Tool result returned to agent/user
```

---

## Data Persistence Guarantees

### **✅ What IS Persisted in Production**

| Item | Storage | Persistence | Backup |
|------|---------|-------------|--------|
| Tool Definitions | MySQL agent_tools | ✅ Permanent | ✅ Daily |
| Tool Executions | MySQL tool_execution_log | ✅ Permanent | ✅ Daily |
| Tool Metadata | MySQL | ✅ Permanent | ✅ Daily |
| Agent Assignments | MySQL (agent_ids JSON) | ✅ Permanent | ✅ Daily |
| User-Created Tools | MySQL | ✅ Permanent | ✅ Daily |
| Execution Audit Trail | MySQL | ✅ Permanent | ✅ Daily |

### **❌ What is NOT Persisted**

| Item | Why | Alternative |
|------|-----|-------------|
| LLM API calls | Stateless | Logged via tool_execution_log |
| Conversation history | Optional | Stored in agent_messages table (separate) |
| Temporary cache | Ephemeral | Redis cache (optional) |
| LLM model weights | Managed by LLM provider | No local storage needed |

---

## Production Deployment Checklist

### **Before Going to Production:**

- [ ] **Database Migration**: Run `pnpm drizzle-kit generate` and apply migrations
- [ ] **Seed Initial Tools**: Run `node seed-tools.mjs` to populate 17 supply chain tools
- [ ] **Verify Constraints**: Ensure tool_id is unique, agent_ids is valid JSON
- [ ] **Backup Strategy**: Confirm Manus daily backups are enabled
- [ ] **Retention Policy**: Set tool_execution_log retention (e.g., 2 years)
- [ ] **Access Control**: Verify only authorized users can create/delete tools
- [ ] **Monitoring**: Set up alerts for tool execution failures
- [ ] **Documentation**: Document all custom tools and their implementations

### **After Deployment:**

- [ ] Test tool creation via UI
- [ ] Verify tools appear in agent function definitions
- [ ] Execute a tool and verify logging
- [ ] Check database for persisted records
- [ ] Verify backups are running
- [ ] Monitor tool execution performance

---

## Disaster Recovery

### **If Database is Lost**

1. **Manus Backup Restoration**: Contact Manus support to restore from daily backup
2. **Tool Definitions**: Recovered from backup (all tools restored)
3. **Execution Logs**: Recovered from backup (full audit trail)
4. **RTO**: Typically 1-4 hours
5. **RPO**: 24 hours (last daily backup)

### **If Specific Tool is Corrupted**

1. **Soft Delete**: Mark tool as `is_active = false`
2. **Restore from Backup**: Restore specific tool record
3. **Manual Fix**: Edit tool schema directly if needed
4. **Audit**: Check execution_log for impact

---

## Scaling Considerations

### **Tool Growth**

```
Current: 17 tools
Expected Growth: +5-10 tools per month
Year 1: ~77 tools
Year 2: ~137 tools
```

**Storage Impact:**
- 1 tool record: ~2 KB
- 1 execution log: ~1 KB
- 1000 executions/day: ~1 GB/year
- 10,000 executions/day: ~10 GB/year

**Optimization:**
- Index on `tool_id`, `agent_id`, `created_at`
- Archive old execution logs (>2 years) to cold storage
- Partition tool_execution_log by month

---

## API Contracts for Tool Management

### **Create Tool**
```typescript
POST /api/trpc/tools.create
{
  name: string,
  description: string,
  category: 'demand' | 'supply' | 'production' | 'procurement' | 'operations',
  agentIds: string[],
  inputSchema: JSONSchema,
  outputSchema: JSONSchema,
  implementation: string,
  complexity: 'simple' | 'medium' | 'complex'
}

Response:
{
  tool_id: string,
  name: string,
  created_at: timestamp,
  is_active: boolean
}
```

### **List Tools**
```typescript
GET /api/trpc/tools.list?category=demand&agentId=demand_planner

Response:
[
  {
    tool_id: string,
    name: string,
    description: string,
    category: string,
    complexity: string,
    is_active: boolean,
    created_at: timestamp
  }
]
```

### **Get Tool Execution History**
```typescript
GET /api/trpc/tools.getExecutionHistory?toolId=forecast_demand&limit=50

Response:
[
  {
    execution_id: string,
    tool_id: string,
    agent_id: string,
    user_id: number,
    input_params: object,
    output_result: object,
    execution_time_ms: number,
    status: 'success' | 'error' | 'timeout',
    created_at: timestamp
  }
]
```

---

## Summary

**In Production:**
- ✅ All tools are saved to MySQL database (permanent)
- ✅ All executions are logged to tool_execution_log (permanent)
- ✅ Automatic daily backups by Manus
- ✅ Data survives app restarts and deployments
- ✅ Full audit trail of all tool usage
- ✅ Scalable to thousands of tools and millions of executions

**No Data Loss Risk:**
- Tools are not stored in memory (ephemeral)
- Tools are not stored in local files (not persisted across deployments)
- Tools are stored in managed MySQL database (highly available)
