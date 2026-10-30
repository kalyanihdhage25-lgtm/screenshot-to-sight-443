<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- The dashboard has no backend of its own: live data comes over Socket.IO from the user-run Node/Express server (delivered separately as a ZIP); why: the user forbids cloud databases and requires direct ESP32 → own-server communication.
- All telemetry state lives in `src/lib/telemetry/useTelemetry.ts`; high-rate ECG/radar samples go into mutable ref buffers read by canvas renderers, not React state; why: 250 Hz data would thrash React renders.
- Safety limits live only in `src/lib/telemetry/thresholds.ts` (tested in `thresholds.test.ts`) and must mirror the firmware constants; why: dashboard and machine-stop output must agree.
- Demo mode is a separate, visibly labelled data source; live mode never synthesises ECG and nothing ever synthesises blood pressure.
