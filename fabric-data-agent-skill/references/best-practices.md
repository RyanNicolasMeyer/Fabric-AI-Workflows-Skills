# Microsoft Fabric Data Agent Best Practices

Comprehensive best practices from Microsoft Learn for configuring Fabric Data Agents (updated January 2025).

## 1. Get Your Data AI Ready

Ensure data sources, tables, and columns use clear and descriptive names.

**❌ Less effective:**
- Table Names: `Table1`, `Table2`
- Column Names: `col1`, `status`, `flag`

**✅ Better:**
- Table Names: `CustomerOrders`, `ProductCatalog`, `SalesTransactions`
- Column Names: `customer_email_address`, `order_submission_date`, `product_unit_price`

Descriptive naming helps the agent understand data structure and improves query quality.

## 2. Create Specialized Agents

Design agents focused on specific domains rather than broad question ranges.

**❌ Less effective:** A general-purpose agent answering various customer questions across different personas

**✅ Better:** An agent tailored to support leadership teams by combining insights from multiple data sources for meeting preparation

Narrowing focus improves precision and reduces ambiguity.

## 3. Minimize Data Source Scope

Include only necessary data sources, tables, and columns.

**❌ Less effective:** Connecting an entire Lakehouse with all tables and columns

**✅ Better:** Selecting only essential tables and columns for common queries

**Limits:**
- Maximum **5 data sources** per agent (any combination)
- Limit to **25 or fewer tables** per data source

## 4. Be Specific About What to Do

Provide clear guidance on correct approaches, not just what to avoid.

**❌ Less effective:**
```
Do not provide outdated pay information or make assumptions about missing data.
```

**✅ Better:**
```
Always provide the most recent pay information from the official payroll system. If data is missing or incomplete, inform the employee that you cannot locate current records and recommend they contact HR.
```

## 5. Define Business Terms and Synonyms

Define ambiguous, organization-specific, or domain-specific terms.

**Examples to define:**
- Similar concepts: "calendar year" vs. "fiscal year"
- Common terms: "quarter", "sales", "SKU"
- Abbreviations: "NPS" (Net Promoter Score), "MAU" (Monthly Active Users)

**Placement:**
- **Agent-level instructions**: Definitions applying across all data sources
- **Data source instructions**: Definitions specific to a particular dataset

## 6. Use Leading Words for Query Generation

Include SQL/DAX/KQL syntax hints to guide query format generation.

**❌ Less effective:**
```
Find all products with names containing "bike".
```

**✅ Better:**
```
Find all products with names containing "bike" LIKE '%bike%'
```

Including syntax fragments helps the model recognize expected patterns.

## 7. Write Clear, Focused Instructions

Instructions should be concise and purposeful. Avoid vague, outdated, or overly broad content.

**❌ Less effective:**
```
You are an HR data agent who should try to help employees with all kinds of questions about work. You have access to many systems, like the HRIS platform, old payroll databases from previous vendors, archived employee files, scanned PDF policy documents, and maybe even some spreadsheets that HR used in the past...
```

**Problems:**
- Scope too broad
- References unreliable sources
- Lacks prioritization
- Introduces unnecessary historical context
- Ambiguous phrases ("just do your best")

**✅ Better:**
```
You are an HR Assistant Agent responsible for answering employee questions about employment status, job details, pay history, and leave balances.

Use the official HR data warehouse to retrieve current and accurate records.

If data is missing or unclear, inform the user and recommend they contact HR.

Keep responses concise, professional, and easy for employees to understand.
```

## 8. Write Detailed Agent Instructions

Define how the agent interprets questions, selects data sources, and formats responses.

**Test:** Would someone unfamiliar with these data sources understand which sources to use and how based on the instructions?

**Recommended Structure:**
```markdown
## Objective
[Agent's primary purpose]

## Data sources
[Which sources to use and when, in priority order]

## Key terminology
[Define ambiguous terms]

## Response guidelines
[How to format answers]

## Handling common topics
[Special handling rules]
```

## 9. Use Data Source Descriptions

Provide high-level context about each data source so the agent can intelligently route questions.

**Include:**
- What the data source contains
- Types of questions it can answer
- Business-specific nuances distinguishing it from other sources

The agent uses descriptions alongside metadata, schema, and example queries for routing decisions.

## 10. Provide Detailed Data Source Instructions

Data source instructions should be specific, structured, and descriptive.

**Include:**
- Purpose of the data source
- Which types of questions it answers
- Required columns to include in responses
- Join logic between tables
- Typical value formats

**Tip:** The agent cannot see individual row values before query execution. Include examples of typical values and formats.

**Recommended Structure:**
```markdown
## General knowledge
[Background information for querying this source]

## Table descriptions
[Key tables and important columns]

## When asked about
[Query-specific logic or table preferences]
```

## 11. Use Example Queries for Complex Logic

Example queries help the agent construct accurate queries, especially for complex logic.

**Guidelines:**
- Include examples for common or representative question types
- Focus on filtering, joins, aggregations, date handling
- Use correct syntax (SQL, DAX, or KQL)
- Include comments to guide the agent (e.g., `-- substitute customer_id here`)
- Questions don't need exact matches—demonstrate intent and structure

**How They Work:**
For each user question, the agent performs **vector similarity search** to retrieve the **top 4 most relevant** example queries.

## 12. Validate Example Queries

Use the Example Query Validator (SDK) to evaluate query quality:

```python
from fabric_data_agent_sdk import evaluate_few_shot_examples

result = evaluate_few_shot_examples(
    examples,
    llm_client=llm_client,
    model_name='gpt-4o',
    batch_size=20,
    use_fabric_llm=True
)

print(f"Success rate: {result.success_rate:.2f}%")
```

**Validator Scores:**
1. **Clarity**: Is the question clear and unambiguous?
   - Good: "Total revenue by region for 2024"
   - Needs improvement: "Show performance"

2. **Relatedness**: Does the SQL match the question's intent?
   - Good: Question asks for count → SQL uses COUNT()
   - Needs improvement: Question asks for count → SQL uses SUM(revenue)

3. **Mapping**: Do all literals in the question appear in the SQL?
   - Good: "Orders over 100 in March 2025" → SQL includes `> 100` and `2025-03`
   - Needs improvement: Missing the month filter

**High quality requires passing all three scores.**

## 13. Debug with Run Steps

Use the **run steps** view to:
- See which example queries were retrieved
- Understand how the agent produced responses
- Diagnose why certain results are generated
- Identify if wrong examples are being used

If wrong examples appear, refine questions or add more targeted examples.

## Common Anti-Patterns to Avoid

1. **Overly Broad Scope** - Don't try to answer all possible questions
2. **Insufficient Context** - Don't assume the agent knows your terminology
3. **Vague Instructions** - Avoid "try your best" or "if possible"
4. **Missing Fallback Behavior** - Always specify handling for missing data
5. **Ignoring Data Quality** - Don't connect poorly named data sources
6. **Too Many Tables** - Don't overwhelm with 50+ tables
7. **No Example Queries** - Don't skip examples for complex patterns
8. **Unvalidated Examples** - Don't use examples that fail schema validation

## Configuration Priority Order

1. **Data preparation** (descriptive naming, proper structure)
2. **Specialization** (narrow domain focus)
3. **Agent instructions** (objective, tone, data source mappings)
4. **Data source descriptions** (high-level routing context)
5. **Data source instructions** (query guidelines, join logic, example values)
6. **Example queries** (complex patterns and common questions)
7. **Business terminology** (definitions and clarifications)
8. **Testing and iteration** (refine based on actual usage)

## Ontology-Specific Guidance

When using ontology as a data source:

1. Add instruction `Support group by in GQL` to enable better aggregation
2. Ensure entity and relationship names are meaningful
3. Document the ontology structure
4. No example queries supported for ontologies

## Quality Checklist

Before deploying an agent, verify:

- [ ] All tables and columns have descriptive names
- [ ] Agent scope is narrow and well-defined
- [ ] Maximum 5 data sources configured
- [ ] Maximum 25 tables per data source
- [ ] Agent instructions provide clear guidance
- [ ] Data source descriptions enable intelligent routing
- [ ] Business terms and abbreviations are defined
- [ ] "When asked about" sections map topics to sources
- [ ] Data source instructions include join logic and example values
- [ ] 5-15 example queries provided per supported data source
- [ ] Example queries use proper syntax and include comments
- [ ] Example queries validated and pass all three scores
- [ ] Fallback behavior specified for missing data
- [ ] Run steps tested for common question types
