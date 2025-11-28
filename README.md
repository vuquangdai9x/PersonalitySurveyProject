# Floating Words — Rating Demo

Simple static demo: a responsive canvas renders 100 floating English words (same frequency & amplitude). Clicking/tapping a word opens a modal with a 1–5 rating (radio choices), Submit and Cancel buttons.

How to run

- Open `index.html` in your browser (double-click or use VS Code Live Server).
- Or serve with Python from the project folder:

```powershell
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

Notes

- Ratings are stored in-memory (console.log). Extend `script.js` to persist to a server or localStorage.
- The words use the same amplitude and frequency; their position and phase vary so movement differs visually.
