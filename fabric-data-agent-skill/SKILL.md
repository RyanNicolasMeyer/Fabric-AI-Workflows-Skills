---
name: fabric-data-agent-skill
description: Comprehensive guide for designing Microsoft Fabric Data Agent instructions, data source instructions, data source descriptions, and example queries. Use this skill when creating or optimizing Fabric Data Agents, including writing agent instructions, configuring data sources (lakehouses, warehouses, Power BI semantic models, KQL databases, ontologies), defining business terminology, generating example queries, or integrating with Copilot Studio and Azure AI Foundry. Apply when users request help with Fabric agent configuration, prompt optimization, Q&A system design, or multi-agent architectures.
---

# Microsoft Fabric Data Agent Skill

This skill provides a conversational framework for designing high-quality Microsoft Fabric Data Agent configurations.

## Overview

Microsoft Fabric Data Agents enable conversational Q&A over structured data using natural language. They translate user questions into SQL, DAX, KQL, or GQL queries.

**Supported Data Sources (up to 5 in any combination):**
- Lakehouses (SQL) - NL2SQL
- Warehouses (SQL) - NL2SQL
- Power BI Semantic Models (DAX) - NL2DAX
- KQL Databases (KQL) - NL2KQL
- Ontologies (GQL) - NL2GQL *(new)*
- Mirrored Databases (SQL) *(new)*

**Example Query Support Matrix:**
| Data Source | Example Queries |
|-------------|-----------------|
| Lakehouse | ✅ Yes |
| Warehouse | ✅ Yes |
| KQL Database | ✅ Yes |
| Semantic Model | ❌ No |
| Ontology | ❌ No |

## Workflow

### 1. Discovery Phase

Gather essential information through conversation:

**About the Agent:**
- Primary purpose and domain (HR assistant, sales analytics, customer insights)?
- Intended users and common question types?
- Data sources to connect (max 5)?

**About the Data:**
- Available data sources and their contents?
- Key tables, relationships, and columns?
- Business-specific terms, abbreviations, or concepts?
- Fiscal calendars, regional codes, or domain-specific logic?

**About the Use Cases:**
- 3-5 common questions users will ask?
- Complex query patterns needing special handling?
- Fallback behavior for missing or unclear data?

### 2. Design Phase

Based on discovery, create four core components:

#### A. Agent Instructions

**Recommended Template:**
```markdown
## Objective
[One clear sentence describing the agent's purpose]

## Data sources
[Specify data sources and priority order]

## Key terminology
[Define terms/acronyms the agent may encounter]

## Response guidelines
[How the agent should format answers]

## Handling common topics
[Special handling rules for frequent topics]
```

**Best Practices:**
- Be concise and purposeful - avoid unnecessary detail
- Define scope clearly (don't try to answer all questions)
- Specify which data source for which question types
- Define business terms, abbreviations, and acronyms
- Use imperative language ("Use X", "Filter by Y")
- Provide clear fallback guidance
- Include syntax hints (LIKE '%bike%') to nudge query generation

#### B. Data Source Descriptions *(new)*

High-level context for intelligent question routing:

```markdown
[Summarize what the data source contains, the types of questions it answers, and business-specific nuances that distinguish it from other sources]
```

The agent uses descriptions alongside metadata, schema, and example queries to route questions.

#### C. Data Source Instructions

**Recommended Template:**
```markdown
## General knowledge
[Background information for querying this source]

## Table descriptions
[Key tables and important columns]

## When asked about
[Query-specific logic or table preferences for topics]
```

**Best Practices:**
- Describe purpose and which questions it answers
- Specify required columns in responses
- Define join logic between tables explicitly
- Include example values and formats (e.g., "State uses 'CA', 'NY'")
- Use leading words/syntax hints for complex patterns
- Include comments in examples to guide substitution

**Tip:** The agent cannot see row values before query execution. Include typical value formats.

#### D. Example Queries (per data source)

**Purpose:** The agent performs vector similarity search to retrieve the **top 4 most relevant** example queries for each user question.

**Best Practices:**
1. Ensure questions clearly map to the query
2. Include comments in queries (e.g., `-- substitute customer_id here`)
3. Highlight join logic or complex patterns
4. Avoid overlap or contradictions
5. Use run steps to debug which examples are passed
6. Reflect real user behavior

**Validation:** All example queries are validated against schema. Invalid queries aren't sent to the agent. Use the **Example Query Validator** (SDK) to check quality.

**Validator Scores:**
- **Clarity**: Is the question clear and unambiguous?
- **Relatedness**: Does the SQL match the question's intent?
- **Mapping**: Do all literals in the question appear in the SQL?

High-quality examples must pass all three scores.

### 3. Output Phase

Generate components in clear, well-structured markdown:

1. **Agent Instructions** - Complete markdown-formatted instructions
2. **Data Source Descriptions** - High-level context per source
3. **Data Source Instructions** - Query guidelines per source
4. **Example Queries** - Question/Query pairs with comments

### 4. Iteration Phase

After delivering initial configuration:
- Offer to refine based on feedback
- Suggest additional examples for edge cases
- Help tune business terminology
- Use run steps to debug query generation
- Validate examples with SDK validator

## Key Principles

### Data Preparation
- Use descriptive table/column names (avoid `Table1`, `col1`, `flag`)
- Limit to **25 or fewer tables** per data source
- Select only essential tables and columns

### Specialization
- Create domain-focused agents (not general-purpose)
- Tailor to specific user personas and use cases
- Keep scope narrow for better accuracy

### Clarity Over Verbosity
- Be specific about what to do, not just what to avoid
- Use clear, imperative language
- Include only essential information

### Business Context
- Define ambiguous terms, abbreviations, and acronyms
- Clarify similar concepts (calendar year vs. fiscal year)
- Specify typical value formats and examples

## Integration Options *(new)*

### Copilot Studio Integration
Fabric data agents can be added as connected agents to custom AI agents in Microsoft Copilot Studio, enabling agent-to-agent collaboration.

### Azure AI Foundry Integration
Data agents integrate with Azure AI Agent Service for enterprise AI scenarios.

### Python SDK
Use the `fabric-data-agent-sdk` for:
- Programmatic agent management
- Example query validation
- External app integration via Python client

### CI/CD and Git Integration
- Connect workspace to Git repository (Azure DevOps or GitHub)
- Version control agent configurations
- Deploy via deployment pipelines (dev → test → prod)

## Permission Requirements

| Data Source | Minimum Permission |
|-------------|-------------------|
| Semantic Model | Build (Read insufficient) |
| Lakehouse | Read on item |
| Warehouse | Read (SELECT) |
| KQL Database | Reader role |
| Ontology | Read on ontology + underlying source |

## Validation Checklist

**Agent Instructions:**
- [ ] Clear objective statement
- [ ] Defined tone and communication style
- [ ] Data source mappings for question types
- [ ] Business terminology definitions
- [ ] Fallback behavior specified

**Data Source Descriptions:**
- [ ] High-level context provided
- [ ] Question types it answers specified
- [ ] Business nuances documented

**Data Source Instructions:**
- [ ] Purpose and scope defined
- [ ] Required columns specified
- [ ] Join logic documented
- [ ] Example values with formats
- [ ] "When asked about" sections included

**Example Queries:**
- [ ] 5-15 examples per data source
- [ ] Proper syntax (SQL/DAX/KQL)
- [ ] Comments included for guidance
- [ ] Validated against schema
- [ ] Pass Clarity/Relatedness/Mapping checks

## Reference Resources

For comprehensive best practices and detailed examples, see:
- **references/best-practices.md** - Detailed configuration guidelines
- **references/examples.md** - Complete agent configuration examples
- **references/integration-guide.md** - SDK and integration patterns

Load these files when deeper guidance is needed.
