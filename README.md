# Lawn Pal

Lawn Pal is a local-first mobile MVP with a mobile-first stitched UI that turns lawn sensor readings, weather, schedule data and lawn context into clear actions for homeowners.

This repo is a monorepo with:

- `apps/mobile`: Expo React Native app with Expo Router, Zustand, TanStack Query, SQLite persistence, photo notes, notifications, mock sensor mode and native BLE sensor support.
- `apps/api`: Next.js API app that proxies OpenWeather requests and OpenAI Responses API calls.
- `packages/core`: Shared domain types, rule engine, schedule engine, mock sensor provider, weather normalisation, product engine and tests.

## Product focus

The app is designed to answer four questions quickly:

- What is happening with my lawn now?
- What should I do this week?
- What should I not do?
- When should I check again?

The MVP intentionally avoids auth, cloud sync and payments. It stays fully usable with mock sensor data, and native BLE hardware reads are now available in development or production builds.

## Architecture

### Shared core

`packages/core` contains the stable domain layer:

- `SensorProvider`, `MockSensorProvider`, BLE protocol decoding/parsing helpers
- `WeatherProvider` interface and OpenWeather normalisation helpers
- `generateRecommendations` deterministic rule engine
- `generateSchedule` rolling task planner
- `generateProductRecommendations`
- case-threaded Ask diagnosis core with deterministic hypothesis scoring
- next-best-question selection and recovery-plan generation
- OpenAI request builders and structured response schemas

### Mobile app

`apps/mobile` contains:

- Expo Router flows for onboarding, dashboard, scan, result, trends, products, AI Ask, the merged Schedule hub and settings
- `localRepository` on top of `expo-sqlite`
- Zustand app bootstrap and lightweight onboarding draft state
- weather service, notification sync and AI Ask service
- photo notes on readings

Current primary tabs in the mobile shell:

- Lawn
- Schedule
- Scan
- Ask
- Settings

The Schedule tab combines the weekly task planner and the saved scan archive into one management surface.

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
- Expo CLI plus a simulator/device for the mobile app
- For live BLE reads, a native iOS or Android development build (Expo Go will not work)

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
EXPO_PUBLIC_API_BASE_URL=http://localhost:3011
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

In local development the API app runs on `http://localhost:3011`.

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

The mock provider returns the same reading shape that the native BLE provider uses:

- moisture
- soil temperature
- EC
- pH
- light
- humidity

## BLE sensor mode

Live BLE reads are enabled when:

```bash
EXPO_PUBLIC_USE_MOCK_SENSOR=false
```

Important constraints:

- Expo Go will not work for BLE because `react-native-ble-plx` requires custom native code.
- Use a native development build or production build instead.
- The mobile app selects the native BLE provider in `apps/mobile/src/services/sensorService.ts`.
- The shared packet decode and parsing logic lives in `packages/core/src/sensors/bleProtocol.ts`.

Recommended run flow for live hardware:

```bash
npm install
npm --workspace @lawnpal/mobile run android
npm --workspace @lawnpal/mobile run ios
```

The first native run will trigger Expo prebuild/native project sync with the BLE config plugin from `apps/mobile/app.json`.

BLE debug output is logged in development builds with the prefix:

```text
[LawnPal BLE]
```

Expected logs include:

- matched scan devices and RSSI
- connect/disconnect events
- raw encoded packet bytes
- decoded packet bytes
- parsed raw fields
- parsed flags
- checksum status
- final LawnPal metrics

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

## BLE implementation notes

- `apps/mobile/src/services/bleSensorProvider.native.ts` owns scanning, permissions, connection management, characteristic reads and development logging.
- `apps/mobile/src/services/bleSensorProvider.ts` is a non-native fallback that throws a clear error on unsupported platforms such as web.
- `packages/core/src/sensors/bleProtocol.ts` owns the vendor decode algorithm, XOR checksum helpers, flag parsing and packet-to-`SensorMetrics` translation.
- Moisture, humidity and soil temperature scaling are intentionally isolated in named parser helpers so real-device calibration can adjust them without touching the BLE transport.

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
- Ask now lives as a dedicated bottom-nav tab.
- The app renders a chat-first experience with one active follow-up question at a time, a top-level working diagnosis summary, and fuller recovery advice only once the case is narrow enough.
- Recovery plans and product suggestions are only surfaced once the case is resolved with high confidence and a real product match exists.

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

For local MVP testing, Expo Go is still fine in mock mode. For live BLE testing, use a native development build or your preferred EAS/native distribution flow.

## Testing

The shared core package includes unit tests for:

- BLE protocol decoding and packet parsing
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
- Open Schedule and confirm weekly tasks render above the scan archive.
- Open a saved reading detail from Schedule.
- Attach a photo note to a reading.
- Open trends and confirm charts render for multiple readings.
- Open product recommendations after a scan with rule outputs or after a settled Ask diagnosis.
- Use AI Ask with text only.
- Use AI Ask with text plus photo.
- Toggle reminders on and off in settings.
- Export local data from settings.
- Reset demo data and confirm lawn setup remains.
- Clear all local data and confirm the app returns to onboarding.

## File map

Key files:

- `apps/mobile/app/_layout.tsx`
- `apps/mobile/src/components/appChrome.tsx`
- `apps/mobile/src/data/localRepository.ts`
- `apps/mobile/app/scan.tsx`
- `apps/mobile/app/(tabs)/history.tsx`
- `apps/mobile/app/(tabs)/ask.tsx`
- `apps/api/src/app/api/weather/route.ts`
- `apps/api/src/app/api/ai/route.ts`
- `packages/core/src/engines/recommendationEngine.ts`
- `packages/core/src/engines/scheduleEngine.ts`
