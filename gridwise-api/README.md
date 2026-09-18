# GridWise LLM — BUP CSE Fest 2026 Preliminary Challenge

A NestJS + TypeScript API for the **GridWise LLM** preliminary challenge.

The system receives a 24-hour energy scenario plus natural-language operator notes, interprets each note with an LLM, validates the interpretation with deterministic guardrails, builds hourly constraints, solves a minimum-cost energy plan with HiGHS, and verifies the final plan before returning it.

---

## 1. Architecture

```text
POST /optimize-energy
        |
        v
Request Validation
        |
        v
LLM Directive Interpretation
        |
        v
Deterministic Guardrails
        |
        v
Constraint Builder
        |
        v
HiGHS Linear Optimizer
        |
        v
Plan Validator
        |
        v
Summary + API Response
```

### Design principle

The LLM is used only for **natural-language interpretation**.

All numerical decisions are deterministic:

- request validation
- directive validation
- constraint construction
- optimization
- final-plan verification
- totals and summary

This keeps the LLM away from the safety-critical numerical schedule.

---

## 2. Technology Stack

- Node.js
- TypeScript
- NestJS
- Groq SDK
- Groq model: `openai/gpt-oss-120b`
- HiGHS linear-programming solver
- `class-validator`
- `class-transformer`
- Vitest
- Supertest

---

## 3. Supported Directives

Each operator note maps to exactly one directive or `no_op`.

| Directive | Purpose | Structured values |
|---|---|---|
| `solar_reduction` | Reduce usable solar for selected hours | `hours`, `factor` |
| `minimum_battery_reserve` | Enforce a minimum battery level | `hours`, `minimum_energy_kwh` |
| `no_charge_window` | Prevent battery charging | `hours` |
| `no_discharge_window` | Prevent battery discharging | `hours` |
| `max_grid_window` | Limit grid import | `hours`, `max_grid_kwh` |
| `no_op` | Note does not affect the schedule | `null` adjustment |

### Time windows

Time ranges are **start-inclusive and end-exclusive**.

```text
2 AM to 5 AM   -> [2, 3, 4]
1 PM to 3 PM   -> [13, 14]
19:00 to 22:00 -> [19, 20, 21]
```

### Solar-reduction factor

`factor` means the fraction of solar that remains usable.

```text
80% reduction -> 0.20
50% reduction -> 0.50
25% remains   -> 0.25
```

---

# 4. How the Problem Is Solved

## 4.1 LLM Interpretation

`DirectiveInterpreterService` sends only the information needed for language interpretation:

- operator notes
- battery capacity

The model returns strict structured JSON with:

- `note_index`
- `applies`
- `directive_type`
- `structured_adjustment`
- `explanation`

Example:

```json
{
  "note_index": 0,
  "applies": true,
  "directive_type": "solar_reduction",
  "structured_adjustment": {
    "hours": [12, 13],
    "factor": 0.5,
    "minimum_energy_kwh": null,
    "max_grid_kwh": null
  },
  "explanation": "Solar availability is reduced during these hours."
}
```

The prompt is intentionally compact to reduce latency.

The model is **not** asked to optimize the energy schedule.

---

## 4.2 Deterministic LLM Guardrails

The model output is never trusted directly.

`DirectiveGuardrailService` validates:

- directive count equals operator-note count
- `note_index` matches original note order
- directive type is supported
- `no_op` uses `applies=false`
- `no_op` uses `structured_adjustment=null`
- active directives use `applies=true`
- hours are integers from 0 to 23
- hours contain no duplicates
- hours are sorted ascending
- solar factor is finite and within `[0, 1]`
- battery reserve is finite and within battery capacity
- grid cap is finite and non-negative

Invalid model output is rejected rather than silently repaired.

One fresh model attempt may be used when the model output fails deterministic validation.

---

## 4.3 Request Validation

Incoming requests are validated before the LLM or optimizer runs.

Important checks include:

- `scenario_id` is a non-empty string
- 1 to 3 operator notes are supplied
- every note is a non-empty string
- exactly 24 hourly records are supplied
- hours are exactly the unique values 0 through 23
- demand, solar, tariff, and battery values are finite and non-negative
- battery object exists
- initial battery energy does not exceed capacity
- minimum battery energy does not exceed capacity
- initial battery energy is not below the minimum

Malformed or invalid requests return a controlled client error.

---

## 4.4 Constraint Building

`ConstraintBuilderService` converts validated directives into deterministic hourly constraints.

When directives overlap, the stricter rule is applied.

Examples:

```text
multiple solar reductions -> smallest factor
multiple reserve rules    -> highest reserve
multiple grid caps        -> smallest cap
no-charge active          -> charging disabled
no-discharge active       -> discharging disabled
```

This produces one deterministic constraint set for every hour.

---

## 4.5 Energy Optimization

The schedule is solved using the **HiGHS linear-programming solver**.

### Objective

Minimize total grid cost:

```text
minimize Σ(grid_kwh[h] × tariff[h])
```

### Energy balance

For every hour:

```text
grid
+ solar_used
+ battery_discharge
=
demand
+ battery_charge
```

Internally a signed battery variable is used:

```text
b > 0 -> charge
b < 0 -> discharge
```

So the LP equation is:

```text
grid + solar - b = demand
```

### Battery state

For hour 0:

```text
energy_after[0] = initial_energy + battery_move[0]
```

For later hours:

```text
energy_after[h]
=
energy_after[h-1] + battery_move[h]
```

Battery energy must stay within:

```text
minimum_required_energy <= energy_after <= capacity
```

Charge and discharge are limited by:

```text
max_charge_kwh_per_hour
max_discharge_kwh_per_hour
```

### Solar

Usable solar is:

```text
effective_solar = input_solar × solar_factor
```

and:

```text
0 <= solar_used <= effective_solar
```

Unused solar may be curtailed.

### Grid

Grid import is always non-negative:

```text
grid_kwh >= 0
```

When a grid cap is active:

```text
grid_kwh <= max_grid_kwh
```

### End-of-day battery neutrality

The final battery level must equal the initial battery level:

```text
energy_after[23] = initial_energy
```

This prevents the optimizer from reducing cost by simply draining the starting battery.

---

## 4.6 Final-Plan Validation

`PlanValidatorService` independently replays and validates the optimizer output.

It checks:

- exactly 24 plan rows
- correct hour ordering
- finite numeric values
- non-negative grid usage
- solar usage does not exceed effective solar
- grid caps are respected
- no-charge/no-discharge windows are respected
- charge/discharge rate limits are respected
- battery transitions are correct
- reserve limits are respected
- battery capacity is respected
- hourly energy balance holds
- final battery equals initial battery
- `total_grid_kwh` matches the plan
- `total_cost_bdt` matches tariffs and the plan
- `peak_grid_kwh` matches the plan

The API returns a plan only after this deterministic verification succeeds.

---

## 4.7 Reliability and Error Handling

### Health endpoint

```text
GET /health
```

returns HTTP `200`:

```json
{
  "status": "ok"
}
```

### Optimization endpoint

```text
POST /optimize-energy
```

Successful requests return HTTP `200`.

Invalid requests return controlled client errors.

Provider or optimizer failures return a sanitized server error without exposing:

- API keys
- raw provider responses
- solver details
- LP model text
- stack traces in the response

The Groq client uses a finite timeout and limited SDK retry behavior.

---

## 4.8 Performance Approach

The LLM has only one task: convert notes into directives.

It does **not**:

- calculate the 24-hour plan
- solve the optimization problem
- calculate totals
- validate energy balance
- generate long narrative output

Everything after interpretation runs locally and deterministically.

This keeps normal request latency low while preserving correct optimization behavior.

---

## 4.9 Security Approach

Secrets are loaded from `.env`.

A real API key must never be committed.

Before submission:

```powershell
git ls-files .env
git grep -n "gsk_"
```

A clean repository should not show a tracked `.env` or a committed Groq key.

If a key has ever been exposed, rotate it before submission.

---

# 5. Project Setup

## 5.1 Prerequisites

Install:

- Node.js
- npm
- Git

You also need a valid Groq API key.

---

## 5.2 Clone

```bash
git clone <YOUR_REPOSITORY_URL>
cd BUP/gridwise-api
```

If your repository root is already `gridwise-api`:

```bash
cd gridwise-api
```

---

## 5.3 Install Dependencies

```bash
npm install
```

---

## 5.4 Environment Variables

Copy the example file.

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### Linux/macOS

```bash
cp .env.example .env
```

`.env.example`:

```env
GROQ_MODEL=openai/gpt-oss-120b
GROQ_API_KEY=
GROQ_TIMEOUT_MS=10000
PORT=3000
```

Add your private key only to `.env`:

```env
GROQ_MODEL=openai/gpt-oss-120b
GROQ_API_KEY=YOUR_PRIVATE_GROQ_API_KEY
GROQ_TIMEOUT_MS=10000
PORT=3000
```

Never commit `.env`.

---

# 6. Run the Project

## Development

```bash
npm run start:dev
```

Default address:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

## Production

```bash
npm run start:prod
```

---

# 7. API Usage

## Health

```bash
curl http://localhost:3000/health
```

Expected:

```json
{
  "status": "ok"
}
```

---

## Optimize Energy

```text
POST http://localhost:3000/optimize-energy
Content-Type: application/json
```

If a complete request is stored in a JSON file:

### Windows PowerShell

```powershell
curl.exe -X POST http://localhost:3000/optimize-energy `
  -H "Content-Type: application/json" `
  --data-binary "@path\to\request.json"
```

### Linux/macOS

```bash
curl -X POST http://localhost:3000/optimize-energy \
  -H "Content-Type: application/json" \
  --data-binary @path/to/request.json
```

A request contains:

```json
{
  "scenario_id": "EXAMPLE-01",
  "operator_notes": [
    "Keep at least 30% battery reserve from 6 PM to 9 PM."
  ],
  "hours": [
    "... exactly 24 hour objects from 0 to 23 ..."
  ],
  "battery": {
    "capacity_kwh": 100,
    "initial_energy_kwh": 50,
    "minimum_energy_kwh": 10,
    "max_charge_kwh_per_hour": 20,
    "max_discharge_kwh_per_hour": 20
  }
}
```

Each hourly object contains:

```json
{
  "hour": 0,
  "demand_kwh": 0,
  "solar_kwh": 0,
  "tariff_bdt_per_kwh": 0
}
```

---

# 8. Response Structure

A successful response contains:

```json
{
  "scenario_id": "EXAMPLE-01",
  "directive_interpretation": [],
  "hourly_plan": [],
  "total_grid_kwh": 0,
  "total_cost_bdt": 0,
  "peak_grid_kwh": 0,
  "plan_summary": ""
}
```

Each plan row contains:

```json
{
  "hour": 0,
  "grid_kwh": 0,
  "solar_used_kwh": 0,
  "battery_action": "idle",
  "battery_kwh": 0,
  "battery_energy_after_kwh": 0
}
```

`battery_action` is one of:

```text
charge
discharge
idle
```

---

# 9. Testing

## Unit tests

```bash
npm run test
```

The unit suite includes dedicated deterministic directive-guardrail tests.

## E2E tests

```bash
npm run test:e2e
```

The E2E suite covers:

- health endpoint
- public sample scenarios
- malformed request validation
- provider-failure handling
- successful HTTP status behavior

## Full verification before submission

```bash
npm run build
npm run test
npm run test:e2e
```

---

# 10. Main Components

```text
src/
├── health/
│   └── health endpoint
│
└── optimize-energy/
    ├── dto/
    │   └── request and response definitions
    │
    ├── interpreter/
    │   ├── Groq client
    │   └── LLM directive interpreter
    │
    ├── guardrails/
    │   └── deterministic LLM-output validation
    │
    ├── optimizer/
    │   ├── constraint builder
    │   └── HiGHS optimizer
    │
    ├── validation/
    │   ├── request validator
    │   └── final-plan validator
    │
    ├── summary/
    │   └── deterministic plan summary
    │
    ├── optimize-energy.controller.ts
    ├── optimize-energy.service.ts
    └── optimize-energy.module.ts
```

---

# 11. Why This Architecture

## Why use the LLM only for interpretation?

Natural-language understanding is probabilistic. Mathematical constraints should not be.

Therefore:

```text
LLM        -> understand operator language
TypeScript -> validate and apply rules
HiGHS      -> optimize the schedule
TypeScript -> verify the final result
```

## Why validate LLM output after strict JSON?

Valid JSON does not guarantee a valid directive.

For example, a solar factor of `1.5` could still be syntactically valid JSON but is invalid for the problem.

The guardrail rejects such output.

## Why validate the optimizer output?

The plan validator protects against:

- incorrect variable conversion
- accidental constraint regressions
- incorrect totals
- unexpected solver output
- implementation mistakes

This gives the API an additional deterministic safety layer.

---

# 12. External Dependency / Limitation

Directive interpretation requires the configured Groq model and internet access.

Availability and latency can therefore be affected by:

- network conditions
- provider availability
- rate limits
- account quota

The actual optimization runs locally once the directives have been interpreted.

---

# 13. Submission Checklist

Before submission:

```bash
npm run build
npm run test
npm run test:e2e
```

Verify:

- `/health` returns HTTP `200`
- `/optimize-energy` returns HTTP `200` for valid input
- all public samples pass
- `.env` is ignored
- `.env.example` contains no secret
- no API key is committed
- exposed API keys have been rotated
- README instructions work from a fresh clone

Secret check:

```powershell
git ls-files .env
git grep -n "gsk_"
```

---

# 14. Deployment Note

This README documents the application architecture, local setup, API behavior, validation, LLM integration, guardrails, optimization, testing, reliability, and security.

Docker/container deployment can be documented separately once the deployment configuration is finalized.