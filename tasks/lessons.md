# tasks/lessons.md — corrections & preventions

## 2026-11-07 — browser-automation session lessons

1. **pgrep self-match**: `pgrep -f cleanup-survey` matched the checking `bash -c` wrapper, not the node process. Use `pgrep -x node` + `ps -o args=` inspection, or check output files.
2. **Lost stdout**: backgrounded `exec` shells can lose their ID; scripts MUST write progress to a log file (`fs.writeFileSync` per step) so state survives.
3. **Field targeting by value is dangerous**: setting "the field containing ZZ-RESEARCH" hit the crew-name input instead of work-done — corrupted data then saved. Always target by **label/placeholder**, dump all fields first, and verify which field was hit before saving.
4. **Sidebar nav is fragile**: child rows only exist after group expansion; clicks need waits + dismiss of onboarding modals. Verify navigation by checking page body text, not just click return.
5. **Don't claim "no delete" from list view alone**: invoice/quote rows showed only PDF/action buttons, but detail panels may differ — probe detail before concluding.
6. **Headless scripts die silently**: wrap in try/catch writing errors to the log file; always `await b.close()` in finally.
7. **Coverage honesty**: report OBSERVED/INFERRED/NOT REACHED explicitly; a checked todo is not evidence.
