# Lawn Pal

Lawn Pal is a local-first mobile MVP that turns lawn sensor readings, weather, history and simple lawn context into clear weekly actions for homeowners.

This repo is a monorepo with:

- `apps/mobile`: Expo React Native app with Expo Router, Zustand, TanStack Query, SQLite persistence, photo notes, notifications and demo sensor mode.
- `apps/api`: Next.js API app that proxies OpenWeather requests and OpenAI Responses API calls.
- `packages/core`: Shared domain types, rule engine, schedule engine, mock sensor provider, weather normalisation, product engine and tests.

## Product focus

The app is designed to answer four questions quickly:

- What is happening with my lawn now?
- What should I do this week?
- What should I not do?
- When should I check again?

The MVP intentionally avoids auth, cloud sync, payments and live BLE. It is software-first and fully usable with mock sensor data.

## Architecture

### Shared core

`packages/core` contains the stable domain layer:

- `SensorProvider`, `MockSensorProvider`, `BleSensorProvider`
- `WeatherProvider` interface and OpenWeather normalisation helpers
- `generateRecommendations` deterministic rule engine
- `generateSchedule` rolling task planner
- `generateProductRecommendations`
- case-threaded Ask diagnosis core with deterministic hypothesis scoring
- next-best-question selection and recovery-plan generation
- OpenAI request builders and structured response schemas

### Mobile app

`apps/mobile` contains:

- Expo Router flows for onboarding, dashboard, scan, result, history, trends, products, AI Ask, schedule and settings
- `localRepository` on top of `expo-sqlite`
- Zustand app bootstrap and lightweight onboarding draft state
- weather service, notification sync and AI Ask service
- photo notes on readings

Local tables stored on device:

- lawns
- zones
- readings
- weather snapshots
- recommendations
- tasks
- diagnostic cases
- diagnostic messages
- diagnostic snapshots
- care events
- case reminders
- product taps
- settings

### API app

`apps/api` contains:

- `GET /api/weather`
- `GET /api/geocode`
- `POST /api/ai`

The API app keeps weather and OpenAI keys off the device and returns normalised JSON to the mobile app.

## Setup

### Prerequisites

- Node.js 24+
- npm 11+
- Expo Go or a simulator/device for the mobile app

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the API app

Copy `apps/api/.env.example` to `apps/api/.env.local` and set:

```bash
OPENWEATHER_API_KEY=your_openweather_key
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5.4-mini
```

### 3. Configure the mobile app

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and set:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_USE_MOCK_SENSOR=true
EXPO_PUBLIC_USE_MOCK_AI=false
EXPO_PUBLIC_USE_MOCK_WEATHER=false
```

If you are running the mobile app on a physical device, replace `localhost` with your machine's LAN IP.

## Run commands

Start both apps:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:api
npm run dev:mobile
```

Additional commands:

```bash
npm run test
npm run typecheck
npm --workspace @lawnpal/api run build
```

## Demo mode

Demo mode is the default because `EXPO_PUBLIC_USE_MOCK_SENSOR=true`.

Available mock scenarios:

- healthy lawn
- too wet
- too dry
- moss risk
- seed ready
- feed caution
- random realistic

The mock provider returns the same reading shape that the future BLE provider will use:

- moisture
- soil temperature
- EC
- pH
- light
- humidity

## Mock weather and AI toggles

### Mock weather

Set:

```bash
EXPO_PUBLIC_USE_MOCK_WEATHER=true
```

The mobile app will bypass the weather API and generate a normalised local forecast object.

### Mock AI

Set:

```bash
EXPO_PUBLIC_USE_MOCK_AI=true
```

The mobile app will bypass the API AI route and return a deterministic mock answer.

### Missing API key fallback

If `OPENAI_API_KEY` is missing, `apps/api/src/app/api/ai/route.ts` returns a safe mocked answer instead of failing hard.

## BLE integration later

BLE is intentionally stubbed today in `packages/core/src/sensors/bleSensorProvider.ts`.

To integrate the real supplier protocol later:

1. Replace the internals of `BleSensorProvider.scanDevices`, `connect`, `disconnect` and `takeReading`.
2. Keep the returned `SensorReading` shape unchanged.
3. Flip `EXPO_PUBLIC_USE_MOCK_SENSOR=false`.
4. Leave the dashboard, scan flow, rules, schedule generation and persistence untouched.

Because the sensor provider is abstracted already, the rest of the app should not need a structural refactor.

## Weather implementation notes

- The mobile app asks for foreground device location first.
- If denied, onboarding falls back to manual postcode entry.
- The postcode is geocoded through the API app.
- Recommendation logic always uses the normalised weather shape from `packages/core`, not raw OpenWeather payloads.

## AI Ask implementation notes

- The mobile app attaches the latest reading, zone, recent weather and current recommendations.
- The API route uses the OpenAI Responses API with `gpt-5.4-mini` by default.
- The model output is constrained into structured JSON via `zodTextFormat`.
- Ask routes direct coaching questions such as mowing, feeding, seeding, watering and weekend-planning away from the diagnosis funnel.
- Ask keeps a persistent case thread locally, so each issue can narrow over multiple turns instead of acting like one-shot Q&A.
- The diagnosis authority is deterministic: the LLM is used for image observation, wording and question phrasing, not to invent the leading diagnosis.
- The app renders a chat-first experience with one active follow-up question at a time, current likelihoods in the case summary, and fuller recovery advice only once the case is narrow enough.

## Ask diagnostic copilot

The current Ask experience is designed as a conversational diagnostic copilot, not a generic chatbot.

- Case stages: `intake`, `narrowing`, `provisional`, `confident`, `monitoring`
- Stable hypothesis tracking with per-case history and score inertia to prevent drift between turns
- Deterministic playbooks covering patch diagnosis, fungal issues, pests, moss, shade, compaction, watering, soil-health, new-lawn issues, and coaching flows
- One pending follow-up question at a time so the user is not answering multiple branches at once
- Product recommendations and recovery plans are gated until the diagnosis is sufficiently narrow

On web, Ask history is stored in browser local storage through `apps/mobile/src/data/localRepository.web.ts`. Clearing local activity data or rotating the storage key starts a fresh Ask session.

## Deployment

### API app

The API app is Vercel-friendly.

Recommended deployment steps:

1. Import `apps/api` into Vercel as a Next.js project.
2. Set `OPENWEATHER_API_KEY`, `OPENAI_API_KEY` and `OPENAI_MODEL` in Vercel project settings.
3. Deploy.
4. Point `EXPO_PUBLIC_API_BASE_URL` in the mobile app at the deployed API origin.

### Mobile app

For local MVP testing, run with Expo Go or a simulator. For later distribution, add your preferred EAS build profile on top of the current app.

## Testing

The shared core package includes unit tests for:

- recommendation engine
- schedule engine
- mock sensor scenarios
- weather parsing
- AI Ask payload construction
- deterministic diagnosis scoring
- next-best-question selection
- recovery-plan thresholds
- broad synthetic conversation and parser evals across lawn problem families

Run:

```bash
npm --workspace @lawnpal/core run test
```

## Manual QA checklist

- Complete onboarding with device location granted.
- Complete onboarding with location denied and postcode fallback.
- Finish onboarding with `Try demo mode`.
- Finish onboarding with `Connect sensor later`.
- Run scans for each mock scenario.
- Confirm dashboard status, weekly summary, next check date and tasks update after a scan.
- Open history and view a saved reading detail.
- Attach a photo note to a reading.
- Open trends and confirm charts render for multiple readings.
- Open product recommendations after a scan with rule outputs.
- Use AI Ask with text only.
- Use AI Ask with text plus photo.
- Toggle reminders on and off in settings.
- Export local data from settings.
- Reset demo data and confirm lawn setup remains.
- Clear all local data and confirm the app returns to onboarding.

## File map

Key files:

- `apps/mobile/app/_layout.tsx`
- `apps/mobile/src/data/localRepository.ts`
- `apps/mobile/app/scan.tsx`
- `apps/api/src/app/api/weather/route.ts`
- `apps/api/src/app/api/ai/route.ts`
- `packages/core/src/engines/recommendationEngine.ts`
- `packages/core/src/engines/scheduleEngine.ts`
