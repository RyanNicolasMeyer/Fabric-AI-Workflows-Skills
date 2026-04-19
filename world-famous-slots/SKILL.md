---
name: world-famous-slots
description: >
  Reference skill for the World Famous Slots (WFS) casino simulation dataset. Use this skill
  whenever the user mentions WFS, World Famous Slots, the WFS datamart, or references any of
  its tables (FactPlays, DimPlayers, DimMachines, Reviews). Also trigger when the user mentions casino
  analytics, slot machine data, coin-in, player segmentation, theme performance, denomination
  analysis, payout percentages, or casino customer reviews in the context of a sample or training dataset.
---

# World Famous Slots (WFS)

## What WFS Is

World Famous Slots is a simulated casino used as the shared sample dataset for the
Fabric AI Workflows community. It generates realistic slot machine play data that grows
daily, giving community members a living dataset to learn Microsoft Fabric concepts against.

The casino opened on November 1, 2025. Each simulated day of activity is processed and
loaded into the datamart, typically with a 1-day lag. By around 8:00 AM ET, the prior
day's data is usually available. This means on any given day, the most recent complete
data is from 1-2 days ago.

## Business Domain

### The Four Levers

Every slot machine cabinet on the WFS floor is physically identical. Casino managers
control performance through four configurable parameters.

**Floor Position** (PositionId, BankId, DesirabilityTier)
Machines are grouped into banks. Each position has a DesirabilityTier from 1-4 (4 = most
desirable) reflecting management's belief about how attractive that spot is based on
foot traffic and visibility. Important nuance: DesirabilityTier is management's estimate,
not a measured outcome. Actual performance may differ from the tier assignment, and
analyzing that gap is one of the interesting questions in the data.

**Theme** (ThemeId, ThemeName)
The visual and emotional experience on the cabinet. Themes at opening:
- California Dreaming
- Caribbean Gold
- Hampi Bazaar
- Mardi Gras Madness
- Mojave Miner
- Tea Time

Themes can be changed on machines over time, and new themes may be introduced. Players
often develop favorites based on mood, culture, or superstition.

**Denomination** (Denomination)
The value of one credit in USD. Denominations at opening:
- $0.05 (Nickel)
- $0.25 (Quarter)
- $1.00 (Dollar)

Lower denominations attract casual players seeking longer sessions. Higher denominations
attract players comfortable with bigger swings. Additional denominations may be added
over time.

**Payout Percentage** (PayoutPercent)
Return-to-player (RTP) stored as a decimal fraction (e.g., 0.92 = 92%). A machine at
0.92 returns $92 per $100 wagered over the long run. The remaining 8% is the casino's
hold. Small RTP differences compound significantly over high volume.

### Players

Every spin is tied to a player via their Players Card. The datamart stores no PII. Each
player has a natural key (PlayerIdNK, the card number) and two demographic attributes:
Gender and Age (at enrollment). Additional demographics may be added in the future.

Player behavior can be reconstructed from play history: session patterns (grouping plays
close together in time), visit frequency, preferred themes, typical bet sizes, and how
behavior changes over time.

### Evolving Configurations

Both DimPlayers and DimMachines are SCD Type 2. When a machine's theme, denomination,
payout, or position changes, a new row is added with updated EffectiveStartDatetime and
EffectiveEndDatetime values. This lets you compare performance before and after changes.
The same pattern applies to player demographic updates.

## Datamart Schema

The WFS datamart is a star schema at the grain of a single spin. Three tables, stored
as Parquet files in Azure Data Lake Storage (ADLS).

For the full field-level schema with datatypes, read `references/schema.json`.

A separate Reviews table also exists in the WFS data warehouse but is not part of the
star schema. For its field-level schema, read `references/reviews_schema.json`.

### FactPlays
One row per spin. Partitioned by PlayCalendarDate (one Parquet file per date).

Key fields:
- playIdNK: unique spin identifier
- PlayerKey, MachineKey: surrogate key FKs to dimensions
- PlayCalendarDate, PlayTimeOfDay: when the spin happened
- BetCredits: credits wagered (multiply by Denomination for dollar amount)
- BetAmount: dollar value wagered (BetCredits x Denomination), also called "coin-in"
- WinAmount: dollars returned to the player
- NetAmount: WinAmount minus BetAmount. Negative = casino profit, positive = casino loss

### DimPlayers
SCD Type 2. Single Parquet file.

Key fields:
- PlayerKey: surrogate key (FK target for FactPlays)
- PlayerIdNK: natural key (Players Card number), stable across demographic changes
- Gender, Age: demographic attributes at enrollment
- IsCurrent: 1 = active version, 0 = historical
- EffectiveStartDatetime / EffectiveEndDatetime: version validity window

### DimMachines
SCD Type 2. Single Parquet file.

Key fields:
- MachineKey: surrogate key (FK target for FactPlays)
- SerialNumberNK: natural key for the physical cabinet (e.g., WFS-1234)
- Denomination, PayoutPercent, ThemeId, ThemeName: machine configuration
- PositionId, BankId, DesirabilityTier: floor location and desirability score
- IsActive: 1 = currently on the floor, 0 = removed
- IsCurrent: 1 = active configuration version, 0 = historical
- EffectiveStartDatetime / EffectiveEndDatetime: version validity window

### Reviews (Standalone, Not Part of the Star Schema)
Single Parquet file. Contains free-text customer reviews of the WFS casino collected
from online review platforms. This table has no foreign keys to FactPlays, DimPlayers,
or DimMachines and cannot be joined to the datamart.

Key fields:
- review_id: unique identifier for each review
- review_text: free-text review body. May reference slot themes, staff names, casino
  amenities, shifts (graveyard, swing), and promotions (comps, free play bounce-back,
  branded mug giveaway, gift card drawing, mailers). Reviews appear in multiple languages.
- review_date: date the review was posted

Reviews are useful for text analytics, sentiment analysis, and NLP use cases. Because
they reference themes and amenities by name (not by key), any correlation with datamart
metrics requires fuzzy matching on text content, not direct joins.

## T-SQL Query Patterns for Fabric SQL Endpoints

When writing queries against the WFS datamart, default to T-SQL syntax compatible with
Microsoft Fabric SQL endpoints.

### Joining to Current Dimension State

For most analytical queries, join to the current version of each dimension:

```sql
SELECT
    p.PlayerIdNK,
    p.Gender,
    p.Age,
    m.ThemeName,
    m.Denomination,
    m.DesirabilityTier,
    f.PlayCalendarDate,
    f.BetAmount,
    f.WinAmount,
    f.NetAmount
FROM FactPlays f
JOIN DimPlayers p
    ON f.PlayerKey = p.PlayerKey
    AND p.IsCurrent = 1
JOIN DimMachines m
    ON f.MachineKey = m.MachineKey
    AND m.IsCurrent = 1
```

### Point-in-Time Join (When Configuration History Matters)

When you need the machine or player attributes as they were at the time of play, use
the effective date range instead of IsCurrent:

```sql
SELECT
    f.PlayCalendarDate,
    m.ThemeName,
    m.Denomination,
    f.BetAmount
FROM FactPlays f
JOIN DimMachines m
    ON f.MachineKey = m.MachineKey
    AND f.PlayCalendarDate >= CAST(m.EffectiveStartDatetime AS DATE)
    AND f.PlayCalendarDate < CAST(m.EffectiveEndDatetime AS DATE)
```

Use point-in-time joins when analyzing before/after impacts of configuration changes.
Use IsCurrent joins for general current-state reporting.

### Common Metrics

- **Coin-in (handle pull)**: SUM(BetAmount) - total dollars wagered
- **Win**: SUM(WinAmount) - total dollars returned to players
- **Net**: SUM(NetAmount) - net result (negative = casino profit)
- **Hold**: SUM(-NetAmount) or SUM(BetAmount - WinAmount) - casino revenue
- **Hold %**: SUM(BetAmount - WinAmount) / SUM(BetAmount) - actual hold rate
- **Theo hold %**: 1 - PayoutPercent - theoretical hold rate from configuration
- **Spins**: COUNT(*) on FactPlays - volume of play
- **Average bet**: AVG(BetAmount) or SUM(BetAmount) / COUNT(*)

### Common Segmentation Patterns

- By theme: GROUP BY m.ThemeName
- By denomination: GROUP BY m.Denomination
- By desirability tier: GROUP BY m.DesirabilityTier
- By player demographics: GROUP BY p.Gender or age bands (e.g., CASE WHEN p.Age < 30 ...)
- By time: GROUP BY f.PlayCalendarDate, or DATEPART(HOUR, f.PlayTimeOfDay), or DATEPART(WEEKDAY, f.PlayCalendarDate)
- By bank: GROUP BY m.BankId

### Detecting Configuration Changes

To find machines that had their theme changed:

```sql
SELECT
    curr.SerialNumberNK,
    prev.ThemeName AS PreviousTheme,
    curr.ThemeName AS CurrentTheme,
    curr.EffectiveStartDatetime AS ChangedOn
FROM DimMachines curr
JOIN DimMachines prev
    ON curr.SerialNumberNK = prev.SerialNumberNK
    AND prev.EffectiveEndDatetime = curr.EffectiveStartDatetime
WHERE curr.ThemeName <> prev.ThemeName
```

The same pattern works for denomination, payout, or position changes by swapping the
field in the WHERE clause.

### Session Reconstruction

WFS does not have an explicit session identifier. To approximate sessions, group a
player's plays by gaps in time (e.g., a new session starts after 30+ minutes of
inactivity):

```sql
WITH ordered_plays AS (
    SELECT
        PlayerKey,
        PlayCalendarDate,
        PlayTimeOfDay,
        BetAmount,
        WinAmount,
        LAG(PlayTimeOfDay) OVER (
            PARTITION BY PlayerKey, PlayCalendarDate
            ORDER BY PlayTimeOfDay
        ) AS PrevPlayTime
    FROM FactPlays
),
session_flags AS (
    SELECT *,
        CASE
            WHEN PrevPlayTime IS NULL THEN 1
            WHEN DATEDIFF(MINUTE, PrevPlayTime, PlayTimeOfDay) > 30 THEN 1
            ELSE 0
        END AS NewSessionFlag
    FROM ordered_plays
)
SELECT *,
    SUM(NewSessionFlag) OVER (
        PARTITION BY PlayerKey, PlayCalendarDate
        ORDER BY PlayTimeOfDay
        ROWS UNBOUNDED PRECEDING
    ) AS SessionNumber
FROM session_flags
```

## Important Reminders

- NetAmount sign convention: negative = casino wins, positive = player wins. This is
  easy to get backwards. When calculating casino profit or hold, negate NetAmount.
- DesirabilityTier is subjective (management's estimate), not a measured outcome.
  Always frame it that way in content.
- BetAmount already equals BetCredits x Denomination. You do not need to multiply
  them again unless you are working with BetCredits directly.
- PlayCalendarDate is the partition key for FactPlays. Filtering on it improves
  query performance significantly.
- The datamart is a living dataset. Row counts, available themes, denominations,
  and machine configurations change over time as the simulation runs.
