# Fabric Data Agent Integration Guide

Guide for integrating Fabric Data Agents with external systems including Copilot Studio, Azure AI Foundry, Python SDK, and CI/CD pipelines.

## Python SDK Integration

### Fabric Data Agent SDK (In-Notebook)

The `fabric-data-agent-sdk` provides programmatic access within Microsoft Fabric notebooks.

**Installation:**
```python
%pip install fabric-data-agent-sdk
```

**Features:**
- Programmatic agent management (create, update, delete)
- Data source integration
- Example query validation
- Workflow automation

**Quick Start:**
```python
from fabric_data_agent_sdk import DataAgentClient

# Initialize client
client = DataAgentClient()

# Create or get agent
agent = client.get_agent("my-data-agent")

# Query the agent
response = agent.ask("What were total sales last quarter?")
print(response.answer)
```

**Example Query Validation:**
```python
from fabric_data_agent_sdk import evaluate_few_shot_examples, cases_to_dataframe

# Load and validate examples
result = evaluate_few_shot_examples(
    examples,
    llm_client=llm_client,
    model_name='gpt-4o',
    batch_size=20,
    use_fabric_llm=True
)

print(f"Success rate: {result.success_rate:.2f}% ({result.success_count}/{result.total})")

# Analyze results
success_df = cases_to_dataframe(result.success_cases)
failure_df = cases_to_dataframe(result.failure_cases)
```

### Python Client SDK (External Apps)

Use the Python client SDK to add a Fabric data agent to web apps and other external clients.

**Repository:** [Fabric Data Agent External Client](https://github.com/microsoft/fabric_data_agent_client)

**Setup:**
```bash
# Clone repository
git clone https://github.com/microsoft/fabric_data_agent_client

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (MacOS/Linux)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Usage:**
```python
from fabric_data_agent_client import DataAgentClient

# Initialize with interactive browser authentication
client = DataAgentClient(
    workspace_id="your-workspace-id",
    agent_id="your-agent-id"
)

# Ask a question
response = client.ask("What were the total sales last quarter?")
print(f"Response: {response}")

# Get detailed run information
run_details = client.get_run_details("What were the total sales last quarter?")
messages = run_details.get('messages', {}).get('data', [])
assistant_messages = [msg for msg in messages if msg.get('role') == 'assistant']
print("Answer:", assistant_messages[-1])
```

## Microsoft Copilot Studio Integration

Fabric data agents can be added as connected agents to custom AI agents in Copilot Studio, enabling agent-to-agent collaboration.

### Prerequisites

1. Fabric data agent is published
2. Same tenant for Fabric and Copilot Studio
3. Same account signed in to both services
4. Necessary workspace permissions

### Adding Fabric Agent to Copilot Studio

1. Open your custom agent in Copilot Studio
2. Go to **Agents** page → **Add an agent**
3. Under **Connect to an external agent**, select **Microsoft Fabric**
4. Select or create a connection between Fabric and Copilot Studio
5. Choose the Fabric data agent from the list
6. Adjust the description for context
7. Select **Add agent**

### Best Practices for Copilot Studio Integration

**Description Optimization:**
- Update the agent description to be specific for the main agent's context
- Avoid description overlap with other tools or agents
- Clearly indicate when Copilot Studio should invoke the Fabric agent

**Multi-Agent Orchestration:**
- Use Fabric agents for data-specific queries
- Let Copilot Studio handle conversation flow
- Define clear handoff points between agents

### Troubleshooting

If the Fabric data agent doesn't appear in the list:
1. Verify the agent is published and running
2. Confirm you're signed in with the correct account
3. Check that agent and Copilot Studio are on the same tenant
4. Verify workspace permissions

## Azure AI Foundry Integration

Fabric data agents integrate with Azure AI Agent Service for enterprise AI scenarios.

**Use Cases:**
- Enterprise-scale deployments
- Custom agent orchestration
- Advanced AI workflows

**Getting Started:**
See [Azure AI Foundry documentation](https://learn.microsoft.com/azure/ai-services/) for integration patterns.

## CI/CD and Source Control

### Git Integration

Connect your Fabric workspace to a Git repository (Azure DevOps or GitHub) for version control.

**File Structure in Git:**
```
data-agent-name/
├── files/
│   └── config/
│       ├── data_agent.json
│       ├── publish_info.json
│       ├── draft/
│       │   ├── lakehouse-tables-{name}/
│       │   │   ├── data_source_config.json
│       │   │   └── example_queries.json
│       │   ├── warehouse-tables-{name}/
│       │   ├── semantic-model-{name}/
│       │   ├── kusto-{name}/
│       │   └── ontology-{name}/
│       └── published/
│           └── [same structure as draft]
```

**Key Files:**
- `data_agent.json`: Agent configuration
- `publish_info.json`: Publishing description
- `data_source_config.json`: Data source instructions
- `example_queries.json`: Example query pairs

### Setup Git Connection

1. Go to **Workspace settings**
2. Connect to Git repository (Azure DevOps or GitHub)
3. Workspace items appear in Source control panel
4. Status bar shows connected branch, last sync, commit ID

### Branching Strategy

1. **Feature branches**: Develop changes in isolation
2. **Pull requests**: Review changes before merging
3. **Main branch**: Production-ready configurations

### Deployment Pipelines

Promote content between environments using deployment pipelines:

1. **Development**: Create and test agent configurations
2. **Test**: Validate with broader user group
3. **Production**: Deploy to end users

**Setup:**
1. Create deployment pipeline in Fabric
2. Assign workspaces to stages (Dev → Test → Prod)
3. Deploy changes through stages with testing

### ALM Workflow

1. **Develop**: Make changes in development workspace
2. **Commit**: Save changes to Git repository
3. **Review**: Create pull request for code review
4. **Merge**: Merge approved changes to main branch
5. **Sync**: Sync test workspace with main branch
6. **Test**: Validate in test environment
7. **Deploy**: Promote to production via pipeline

## Permission Requirements

### Data Source Permissions

| Data Source | Minimum Permission | Notes |
|-------------|-------------------|-------|
| Power BI Semantic Model | Build (includes Read) | Read alone insufficient for agent queries |
| Lakehouse | Read on item | Write not required unless modifying data |
| Warehouse | Read (SELECT on tables) | Higher permissions for DDL/DML |
| KQL Database | Reader role | Higher roles for management commands |
| Ontology | Read on ontology + underlying source | Must have access to bound sources |

### Sharing Permissions

When sharing a Fabric data agent:
- Share access to underlying data sources
- Agent honors RLS and CLS
- Users need minimum effective permissions per source

## Cross-Region Considerations

**Limitation:** The data agent cannot execute queries when the data source's workspace capacity is in a different region than the agent's workspace capacity.

**Solution:** Ensure data sources and data agent are in the same region or enable cross-geo processing.

**Required Tenant Settings:**
- Fabric data agent tenant settings enabled
- Cross-geo processing for AI enabled
- Cross-geo storing for AI enabled

## Debugging and Monitoring

### Run Steps View

Use run steps to debug query generation:
- See which example queries were retrieved
- View the generated query
- Understand the agent's reasoning
- Diagnose incorrect results

### Common Debugging Scenarios

**Wrong examples retrieved:**
- Add more targeted example queries
- Refine question phrasing in examples
- Ensure examples pass validation

**Query generation errors:**
- Check data source instructions for clarity
- Verify join logic documentation
- Add syntax hints (leading words)

**Schema validation failures:**
- Ensure example queries match current schema
- Update examples after schema changes
- Run SDK validator after changes
