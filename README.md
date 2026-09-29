# RunWar - Real-Time GPS Running & Fitness Tracker

RunWar is a full-featured, offline-first Progressive Web Application (PWA) designed for runners, joggers, and walkers. Built with React 19, TypeScript, Vite, Tailwind CSS, and powered by an InsForge PostgreSQL backend, RunWar delivers high-accuracy real-time GPS tracking, rolling pace analysis, voice coaching, peer-to-peer race challenges, GPX course navigation, ghost rival pacing, and comprehensive health data synchronization across Google Fit, Strava, and device pedometers.

---

## 🎥 Application Demo

<div align="center">
  <video src="./assets/app-demo.mp4" controls="controls" width="100%" style="max-height: 520px; border-radius: 12px;">
    Your browser does not support the video tag.
  </video>
  <p align="center">
    <strong><a href="./assets/app-demo.mp4">▶️ Watch Application Demo</a></strong>
  </p>
</div>

---

## Table of Contents

- [Application Demo](#-application-demo)
- [Overview](#overview)
- [Architecture & Design Philosophy](#architecture--design-philosophy)
- [Feature Breakdown](#feature-breakdown)
  - [1. Real-Time Outdoor Workout Engine](#1-real-time-outdoor-workout-engine)
  - [2. Voice Coaching, Sound Effects & Haptics](#2-voice-coaching-sound-effects--haptics)
  - [3. Ghost Rival & Course Navigation](#3-ghost-rival--course-navigation)
  - [4. Peer-to-Peer Live Race Challenges](#4-peer-to-peer-live-race-challenges)
  - [5. Community Feed & Social Interactions](#5-community-feed--social-interactions)
  - [6. Daily Activity, Step Counting & Health Sync](#6-daily-activity-step-counting--health-sync)
  - [7. Goals, Personal Records & Gamified Achievements](#7-goals-personal-records--gamified-achievements)
  - [8. Calendar Heatmap & Deep Insights](#8-calendar-heatmap--deep-insights)
  - [9. Scheduled Alarms & Web Push Notifications](#9-scheduled-alarms--web-push-notifications)
  - [10. In-App Bug Reporting & Diagnostics](#10-in-app-bug-reporting--diagnostics)
  - [11. Authentication, Security & Profile Customization](#11-authentication-security--profile-customization)
- [Technology Stack](#technology-stack)
- [Application Architecture & Modular Domains](#application-architecture--modular-domains)
- [Database Schema & Backend Architecture](#database-schema--backend-architecture)
- [Serverless Edge Functions](#serverless-edge-functions)
- [Environment Configuration](#environment-configuration)
- [Local Development Setup](#local-development-setup)
- [Database Migration & Backend Initialization](#database-migration--backend-initialization)
- [PWA & Web APIs Requirements](#pwa--web-apis-requirements)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

RunWar provides athletes with a desktop- and mobile-optimized tracking platform that bridges the gap between native mobile fitness apps and open web technology. It operates directly in modern web browsers as an installable standalone Progressive Web App, eliminating app store gatekeeping while maintaining low-latency GPS acquisition, screen wake locks, background audio synthesis, and offline-first data resilience.

The application incorporates a complete relational model built on PostgreSQL, utilizing Row Level Security (RLS) to safeguard athlete data while exposing real-time WebSocket feeds for head-to-head racing and community interactions.

---

## Architecture & Design Philosophy

RunWar is architected around five fundamental principles:

1. **Offline-First Synchronization:** Workouts, route coordinates, split times, and profile updates are written immediately to local state and indexed persistent caches. An asynchronous sync queue batches records and flushes them to the InsForge database as network conditions permit, retrying seamlessly on reconnections.
2. **Precision GPS & Kalman-Style Filtering:** Raw browser geolocation points are filtered against accuracy thresholds, unrealistic speed spikes, and stationary jitter before distance integration via the Haversine formula.
3. **Background Durability:** Standard browser tabs throttle intervals when backgrounded. RunWar incorporates a dedicated Web Worker timer fallback to maintain second-accurate workout duration and split tracking even when the screen is dimmed or another app is focused.
4. **Hardware & System API Exploitation:** The engine coordinates the HTML5 Geolocation API, Screen Wake Lock API (to prevent display sleep mid-run), MediaSession API (for lock-screen stats and playback controls), Web Speech Synthesis API (for audio cues), and the Web Push API.
5. **Decoupled Backend as a Service (BaaS):** InsForge provides Postgres-level Row Level Security, Edge Functions for OAuth exchanges with Google and Strava, transactional email notifications, and cloud file storage for profile avatars, route photos, and bug report screenshots.

---

## Feature Breakdown

### 1. Real-Time Outdoor Workout Engine

The workout engine manages live tracking across three exercise modalities: **Run**, **Jog**, and **Walk**.

- **Live Metrics Dashboard:** Monitors instantaneous rolling pace (seconds/km or min/mi), overall average pace, total elapsed time, active moving time, distance (meters/km/miles), cadence, step count, and dynamic calorie burn computed from user weight and activity METs.
- **Auto-Pause Detection:** Automatically pauses timer and distance accrual when stationary for a user-configured threshold (default 10 seconds), resuming automatically once movement is detected.
- **Split Tracking:** Automatically logs per-kilometer or per-mile split times with elevation delta calculations and visual toast notifications comparing the current split to the prior split.
- **Pocket Mode Lock:** Prevents accidental touchscreen inputs while carrying the phone. Users can select between Long Press to Unlock, Swipe to Unlock, or Dual Verification.
- **Live Route Rendering:** Built on interactive mapping technology, displaying live breadcrumb traces with colored polyline segments reflecting speed variations, current location markers, and start/finish pins.
- **Simulation Mode:** Built-in route simulator allowing developers and users to test tracking logic, pace counters, audio cues, and map rendering without physical movement.
- **Crash Recovery:** Workout state is continuously written to persistent backup storage. If the browser tab crashes or is accidentally refreshed, the app detects the unfinished session on launch and offers immediate recovery.

### 2. Voice Coaching, Sound Effects & Haptics

- **Text-to-Speech Voice Coach:** Uses the Web Speech API to provide verbal announcements at customizable intervals (every 0.5 km, 1 km, 5 minutes, or off). Cues announce split time, current pace, total distance, and target pace adherence.
- **Sound Design:** Synthesized audio alerts provide auditory feedback for 3-2-1 countdowns, auto-pause events, resume actions, milestone completions, and split completions.
- **Haptic Feedback:** Uses device vibration patterns to deliver distinct physical feedback for starts, splits, pauses, and navigational off-course warnings.
- **Media Session Integration:** Publishes current workout statistics (distance, duration, pace) to the mobile operating system lock screen and notification shade via the MediaSession API, complete with play/pause controls.

### 3. Ghost Rival & Course Navigation

- **Ghost Rival Pacing:** Compete against a simulated competitor. Users can configure either:
  - *Target Pace Mode:* A virtual pacer maintaining a constant set pace (e.g., 5:00 min/km).
  - *Previous Workout Mode:* Replays a previously completed workout from history coordinate-by-coordinate.
  - The live interface displays real-time delta meters (+/- ahead or behind) and calculated time gaps, along with a distinct ghost marker on the route map.
- **GPX Course Navigation:**
  - Import any standard GPX route file from Strava, Garmin, or handheld GPS units.
  - Displays the planned route elevation profile and course line on the map.
  - Computes cross-track error to alert runners when they stray off-course.
  - Export any recorded RunWar workout to a clean GPX file containing timestamps, coordinates, and elevation data.

### 4. Peer-to-Peer Live Race Challenges

The challenge system enables synchronous or asynchronous head-to-head racing between users.

- **Username Search & Addressing:** Issue challenges directly to any runner using their unique `@username`.
- **Race Types:** Distance races (e.g., 5 km, 10 km sprints), target duration challenges, or open-ended distance goals.
- **Real-Time Position Tracking:** Participants broadcast active distance and pace updates via InsForge Realtime. The live challenge HUD indicates the leading runner, relative distance lead/lag, and split differentials.
- **Lifecycle Management:** Complete state workflow covering invitation, acceptance, rejection, live race status, completion detection, and automated winner designation.

### 5. Community Feed & Social Interactions

A dedicated community platform allows athletes to share and celebrate workouts.

- **Feed Publishing:** Publish completed runs with workout metrics, route maps, custom captions, and optional media attachments.
- **Photo Overlays:** Attach photos to workouts with optional automated stats watermarks (displaying distance, pace, time, and RunWar branding).
- **Multi-Emotion Reactions:** Runners can react using Fire, Respect, Beast, or Salute badges.
- **Interactive Comments:** Full threaded discussion under every post with timestamping and author profile links.
- **Territory Claiming:** Tag runs with specific geographic sector identifiers or route claims.
- **Visibility Tiers:** Posts can be scoped to Public, Followers/Friends, or Private.

### 6. Daily Activity, Step Counting & Health Sync

RunWar acts as a centralized fitness aggregator:

- **Device Pedometer:** Integrates hardware motion sensor events to count steps throughout the day without requiring an active workout.
- **Hourly Activity Ring:** Tracks 250+ steps per active hour across an 8–10 hour daily window.
- **Google Health / Google Fit Sync:** OAuth 2.0 integration allowing historical import and automatic two-way sync of steps, distance, active minutes, and calories from Google Fit.
- **Strava Integration:** Direct OAuth 2.0 authorization exchanging tokens to import Strava activities and decode polyline routes into native RunWar workouts.
- **Google Takeout Importer:** Upload raw Google Fit or Fitbit Takeout export archives to backfill historical workouts and daily steps without third-party API rate limits.

### 7. Goals, Personal Records & Gamified Achievements

- **Goal Tracking:** Set and track targets across Weekly Distance, Monthly Distance, Workout Frequency, and Single Run benchmarks with dynamic progress bars and completion celebrations.
- **Personal Records Engine:** Automatically scans completed workouts and updates PR tables for:
  - Fastest 1K, 1 Mile, 3K, 5K, 10K, and Half Marathon.
  - Longest Distance, Longest Duration, Max Speed, and Highest Elevation Gain.
  - Deep links directly from any record to the original workout details.
- **Achievements System:** Unlocks badges across Distance Milestones, Streak Consistency, Speed Benchmarks, and Exploration. Badges feature Common, Rare, Epic, and Legendary tiers with earned XP. Users can pin favorite badges directly to their public profile header.

### 8. Calendar Heatmap & Deep Insights

- **Activity Calendar:** Monthly grid view displaying workout density heatmaps, individual daily activity cards, mileage tallies, and rest day breakdowns.
- **Performance Insights:** Visualizes training volume progression, average pace trends over time, calorie expenditure curves, workout type distributions, and active running streak streaks.

### 9. Scheduled Alarms & Web Push Notifications

- **Workout Alarms:** Create single or recurring workout reminders (e.g., Morning Run at 06:00 on Monday, Wednesday, Friday) with designated IANA timezone support.
- **Web Push API:** Push notifications powered by standard VAPID key pairs. Notifications fire even when the browser is closed.
- **Interactive Notification Actions:** Actionable push prompts allow users to tap "Start Run" to open the tracker immediately or "Snooze" to delay the alarm by 10 minutes.
- **Quiet Hours:** Configurable do-not-disturb windows to suppress non-critical notifications while preserving emergency workout alarms.

### 10. In-App Bug Reporting & Diagnostics

RunWar includes an integrated diagnostics and bug dispatch engine:

- **Automatic Telemetry:** Captures application version, user agent, browser engine, operating system, platform, screen dimensions, network status, and current screen route.
- **Screenshot Attachments:** Direct image upload to InsForge secure storage bucket with thumbnail generation.
- **Ticket Codes:** Generates human-readable reference numbers (format: `BR-YYYYMMDD-XXXX`) managed by database sequences.
- **Admin Dashboard:** Authorized administrators can triage incoming reports, inspect device metadata, filter by severity/category, update ticket statuses (open, in progress, resolved, closed), and trigger resolution emails.

### 11. Authentication, Security & Profile Customization

- **Flexible Authentication:**
  - Standard Email and Password authentication via InsForge Auth.
  - One-tap Google OAuth login.
  - Phone Number OTP verification via Firebase Authentication with reCAPTCHA Enterprise fallback.
  - Password Management: Add or update passwords for phone-only or OAuth accounts to enable multi-method login.
- **Unique `@username` Protocol:** Enforces database-level unique username constraints with real-time availability checking and case-insensitive indexes.
- **Customizable Profiles:** Configurable avatars, height, weight, metric vs. imperial units (km vs. mi, kg vs. lb), and default workout preferences.
- **Data Privacy & Export:** Download complete personal workout and profile archives in JSON format, or initiate permanent account deletion adhering to GDPR and data privacy standards.

---

## Technology Stack

### Frontend

| Technology | Purpose |
| :--- | :--- |
| **React 19** | Component framework and UI rendering |
| **TypeScript** | Strict type-safety across models and services |
| **Vite** | Build tooling, Hot Module Replacement (HMR), and asset bundling |
| **Tailwind CSS** | Utility-first responsive styling and theme management |
| **Leaflet & React-Leaflet** | Interactive map tile rendering and route polylines |
| **Lucide React** | Application iconography |
| **Canvas Confetti** | Visual celebration triggers for achievements and goals |
| **date-fns** | Date formatting, calendar math, and timezone manipulations |

### Backend & Cloud Infrastructure

| Technology | Purpose |
| :--- | :--- |
| **InsForge BaaS** | PostgreSQL database, Auth, Realtime WebSockets, and Edge Functions |
| **@insforge/sdk** | Client library for database CRUD, auth sessions, and storage |
| **Firebase Auth** | Phone SMS OTP verification service |
| **InsForge Storage** | Asset and image storage (avatars, workout photos, bug screenshots) |
| **Vercel** | Edge hosting, client routing rewrites, and asset cache headers |

---

## Application Architecture & Modular Domains

The application is structured into clearly separated functional layers:

- **Presentation Layer (Screens & Views):** Top-level screens handling specific user journeys: active workout HUD, post-run summaries, calendar exploration, social feed, head-to-head racing, personal records, performance insights, and administration consoles.
- **Component Modules:** Reusable interface elements organized by functional domain (achievements, daily activity rings, authentication modals, challenge race HUDs, analytical charts, layout shells, interactive maps, notification drawers, and workout control dials).
- **Core Engine & Services:** Business logic modules managing the workout lifecycle, GPS coordinates smoothing, speech synthesis coaching, ghost rival calculation, course navigation, challenge state syncing, social post interactions, and offline queue retries.
- **Health Integration Layer:** External provider bridges responsible for OAuth authentication and telemetry ingestion across Google Health, Google Fit, Strava, and raw Takeout archive parsers.
- **Backend & Database Migrations:** Relational PostgreSQL schemas, trigger functions, sequence generators, index definitions, and Row Level Security policies.
- **Serverless Edge Functions:** Isolated server-side cloud functions handling third-party OAuth callbacks, scheduled cron alarm evaluation, push notification dispatching, and email delivery.
- **Progressive Web App Shell:** Client manifest and service worker managing cache storage strategies, push payload event listeners, and interactive snooze handlers.

---

## Database Schema & Backend Architecture

RunWar runs on PostgreSQL via InsForge with strict Row Level Security (RLS) policies. Every table containing user data checks `auth.uid() = user_id`.

### Data Entities & Schema Models

- **User Profiles:** User profile metadata, including name, unique `@username`, height, weight, distance units (km / mi), fitness goal, daily step goal, avatar URL, and configuration flags.
- **User Settings:** Fine-grained application preferences, including auto-pause threshold, audio coaching frequency, theme mode, GPS accuracy mode, pocket unlock style, push notification permissions, and quiet hours.
- **Workouts:** Completed workout records containing duration, moving time, distance, average pace, max speed, calories burned, elevation gain/loss, route coordinates, split arrays, weather snapshots, and external provider references.
- **Workout Coordinates:** High-frequency, high-precision GPS coordinate stream (latitude, longitude, altitude, accuracy, speed, timestamp, sequence number) linked to workouts for granular post-run path inspection.
- **Workout Splits:** Normalized splits recording time, pace, and elevation change for every elapsed kilometer or mile.
- **Training Goals:** User targets scoped to weekly, monthly, or all-time intervals with target and current accumulator values.
- **Achievements & User Badges:** Global catalog of unlockable achievement badges and user unlock records with timestamps.
- **Personal Records:** Stores all-time best performances for standardized distances and metrics, referencing the specific workout where the record was achieved.
- **Community Posts:** Social feed entries containing workout snapshots, user badges, captions, fire-up counts, and territory tags.
- **Post Comments & Reactions:** Threaded comments and normalized reactions (Fire, Respect, Beast, Salute).
- **Challenges & Race Participants:** Peer-to-peer race records, target parameters, participant roles, live distance/pace telemetry, and completion positions.
- **Workout Alarms:** Workout reminders with recurrence schedules (once, daily, weekly, custom days), target time, and next UTC trigger calculation.
- **Notifications Center:** Central notification log tracking sent, read, and pending notifications.
- **Push Subscriptions:** Browser Web Push endpoint records with encryption credentials and device tokens per user client.
- **Diagnostic Bug Reports:** Issue reports with system telemetry, error descriptions, screenshot attachments, severity ratings, and resolution workflows.

---

## Serverless Edge Functions

Serverless cloud functions execute secure server-side logic:

1. **Google Fit Authorization Handler:** Generates Google OAuth 2.0 authorization URLs requesting Google Fit activity and location scopes.
2. **Google Fit Callback Handler:** Handles the Google OAuth redirect, exchanges authorization codes for refresh and access tokens, and persists credentials securely.
3. **Google Fit Ingestion Service:** Scheduled or on-demand fetcher querying Google Fit REST endpoints for step counts, active minutes, and session datasets.
4. **Strava Authorization Handler:** Exchanges Strava authorization codes for athlete access tokens and handles token refreshes.
5. **Alarm Processing Worker:** Periodic cron worker querying the alarms table for due reminders, dispatching notifications, and recalculating the next occurrence.
6. **Web Push Dispatcher:** Web Push payload builder utilizing VAPID authentication to send push payloads to registered browser endpoints.
7. **Bug Report Email Dispatcher:** Dispatches transactional email summaries to support administrators when new bug reports are submitted.

---

## Environment Configuration

Configure environment variables in your local environment configuration file:

```bash
# InsForge Backend
VITE_INSFORGE_URL=https://your-project.us-east.insforge.app
VITE_INSFORGE_ANON_KEY=ik_your_anon_key_here
VITE_PROJECT_ID=your-insforge-project-uuid

# Firebase Phone OTP Authentication
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:...

# Google Fit / Health OAuth
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com

# Strava OAuth 2.0
VITE_STRAVA_CLIENT_ID=123456
VITE_STRAVA_CLIENT_SECRET=your_strava_client_secret

# Production App URL (Used for OAuth redirects and share permalinks)
VITE_APP_URL=https://your-domain.vercel.app

# Web Push VAPID Configuration
VITE_VAPID_PUBLIC_KEY=BNZbq9ce...
```

---

## Local Development Setup

### Prerequisites

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- Modern web browser with Geolocation and Web Speech support (Chrome, Edge, Firefox, or Safari)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/codergangganesh/RunWar.git
   cd RunWar
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ensure your local environment configuration is populated with valid credentials.

4. Start the local development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`.

### Build & Verification

To run TypeScript type checks and compile the production bundle:

```bash
npm run build
```

To preview the compiled production distribution locally:

```bash
npm run preview
```

---

## Database Migration & Backend Initialization

To initialize or update the InsForge PostgreSQL database:

1. Log into your InsForge Dashboard.
2. Navigate to the SQL Editor.
3. Execute the migration suites in order:
   - **Base Schema:** Base tables, functions, indexes, and Row Level Security policies.
   - **Community Posts & Reactions:** Social feed, comments, and reaction counters.
   - **Unique Usernames & Challenges:** Unique username constraints, case-insensitive indexes, and head-to-head racing structures.
   - **Alarms & Web Push:** Workout alarms, push subscription tracking, and notification queue.
   - **Bug Reporting:** Diagnostics schema, sequence generator, and admin triage functions.
   - **Password Management:** Multi-provider account password management and credential linking.
4. Verify that Row Level Security is enabled across all tables.

---

## PWA & Web APIs Requirements

RunWar utilizes advanced browser APIs to match native app capabilities. For optimal performance:

- **HTTPS Required:** Geolocation, Service Workers, Screen Wake Lock, and Web Push require a secure origin (`https://` or `localhost`).
- **Permissions:**
  - *Location:* Set to "Allow Always" or "While Using App" with high-accuracy mode enabled.
  - *Notifications:* Allow browser notifications when prompted to enable alarms and challenge updates.
- **Installation:**
  - *Desktop (Chrome / Edge):* Click the install icon in the address bar.
  - *iOS (Safari):* Tap Share -> "Add to Home Screen".
  - *Android (Chrome):* Tap the in-app "Install RunWar App" banner or browser menu -> "Install App".

---

## Deployment

The application is optimized for deployment on Vercel:

1. Connect your repository to Vercel.
2. The project will automatically detect the build and framework settings.
3. Add all environment variables in the Vercel Project Settings.
4. Deploy. The deployment configuration ensures:
   - Client-side Single Page Application (SPA) routing fallback.
   - Dedicated cache control headers for immutable static assets.
   - Immediate revalidation for service worker and HTML documents.
