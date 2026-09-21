# My Day Planner

Role & Goal:

You are an expert frontend developer and UX designer. Build a complete, mobile-first, minimalist to-do web app using React, Tailwind CSS, shadcn/ui, and Framer Motion for smooth animations. Use Zustand combined with LocalStorage for state management and persistence. 

Design System:

The UI must be extremely clean, using ample whitespace, subtle borders, and a monochromatic theme (similar to the "Tweek" app). No visual clutter.

Core Data Models:

1. GlobalTask (The backlog items):

   - id, title

   - recurrence: "Once" or "Repetitive"

   - baseType: "Simple", "Time", or "Count"

   - expiresAt: Date (only for "Once" tasks)

   - isGloballyCompleted: Boolean

2. DailyTask (Instances added to today's plan):

   - id, globalTaskId

   - trackingType: "Simple", "Time", or "Count"

   - targetValue: Number (e.g., 180 for 3 hours, or 5 for reps)

   - currentValue: Number (Progress tracking)

   - status: "Doing" or "Done"

App Architecture & Navigation:

The app has exactly 2 tabs at the bottom of the screen: "All Tasks" and "My Day".

Tab 1: All Tasks (The Backlog)

- Displays a list of all active Global Tasks.

- Sorting: "Once" tasks must be sorted by their expiresAt date.

- Interaction: A user must LONG PRESS (hold) a task to trigger the "Add to My Day" flow. Use a visual indicator (like a subtle scale animation) during the long press.

- Visibility Rule: Adding a task to "My Day" does NOT delete it from Tab 1. "Once" tasks only disappear from this tab when explicitly marked as 'isGloballyCompleted'. "Repetitive" tasks never disappear from this tab.

The "Add to My Day" Flow (Bottom Sheet Modal):

- When a task is long-pressed, open a smooth, minimalist bottom sheet.

- If it's a "Repetitive" task of type "Time" or "Count", ask the user to select today's target amount.

- If it is a "Once" task, first ask the user to choose today's tracking mode: "Simple" (just a checkbox) or "Time" (e.g., allocating a specific amount of time today for a long task).

- UI component: Use a minimalist, iOS-style scrolling wheel picker for selecting time amounts (hours/minutes) or count numbers.

Tab 2: My Day (The Daily Plan)

- Displays the Daily Tasks divided into two distinct vertical sections: "Doing" and "Done" (like Microsoft To Do).

- Interactions by Type:

  - Simple: A clean, oversized minimalist checkbox.

  - Time: A sleek horizontal progress bar or circular tracker where the user can easily log time spent.

  - Count: A minimalist + / - stepper.

- When a task's target is reached (or checkbox checked), it automatically moves down to the "Done" section.

The 4 AM Reset Logic (Crucial):

- The "My Day" tab must completely reset at 4:00 AM local time every single day.

- Implement this client-side: Store a `lastResetDate` in LocalStorage. Run a check on initial app load and set up an event listener for when the window regains focus. 

- If the current time is past 4:00 AM and `lastResetDate` is before today's 4:00 AM, clear all DailyTasks so the user wakes up to a blank daily slate. Tab 1 remains untouched.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dotoapp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3f944ff2-2b51-4c8c-8cd5-1a943cc3eb91).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Android / Capacitor

The Vercel web deployment and the Android build use different Vite outputs.

For Android, run:

```bash
npm install
npm run build:android
```

`build:android` enables TanStack Start SPA mode, generates `.output/public/index.html`, and runs `npx cap sync android` so Capacitor packages the generated web assets into the Android project.

After that, open the `android` directory in Android Studio and run/build the app.
