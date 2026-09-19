# Dark task tracking and live statistics

## Goal
Turn Slate into a dark-first daily tracker with direct progress entry and persistent statistics, while preserving the existing two-tab flow, long-press planning, local storage, and 4 AM reset.

## Changes

### Dark interface and copy cleanup
- Replace the light palette with a Discord-inspired charcoal palette: `#36393f`-equivalent main surface, contrasting raised surfaces for the composer and bottom sheet, and accessible light text/borders.
- Make dark styling the default without requiring a theme switch.
- Remove “Hold a task to plan it for today,” the per-row “Once” label, and “resets at 4 AM.” Keep the current date visible on My Day.

### Progress logging
- Replace time presets with compact hours and minutes fields plus a **Log time** button.
- Replace the count stepper with a numeric field plus a **Log count** button.
- Treat submitted values as additions to the task’s current daily progress, capped visually at the daily target while retaining every submitted amount in history.
- Keep Simple tasks as checkboxes; marking one done records that day, and undoing it removes that day’s Simple completion entry.

### Persistent history
- Add `history` to every global task, with entries containing a local date and `amountLogged`.
- Add one store action that logs progress to both the daily task and its matching global task in the same update, so the UI and statistics stay synchronized.
- Version the persisted store and migrate existing saved tasks by adding an empty history array, preserving users’ current tasks and daily progress.
- Keep history when My Day resets at 4 AM or a daily task is removed.

### Task statistics
- A normal click on a Repetitive task opens a focused statistics modal; long press continues to open “Add to My Day.” Prevent the long-press release from also opening statistics.
- Show Total, Yearly, Monthly, and Weekly summaries calculated from local dates.
- For Simple tasks, show Days Done. For Time and Count tasks, show Days Done plus accumulated time or count.
- On Once task rows, show accumulated logged time when present.

## Validation
- Check existing persisted state migrates without data loss.
- Verify time, count, and Simple logs update both My Day and statistics immediately.
- Verify weekly, monthly, yearly, and total periods, including repeated logs on the same day.
- Verify click versus long press behavior, the 4 AM reset, modal readability, and mobile/desktop layouts.
