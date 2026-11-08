# 🎓 Grade Calculator

A modern, responsive grade tracker built with **pure vanilla HTML5, CSS3, and JavaScript (ES6+)** — no frameworks, no build step.

## Run it

Just open `index.html` in any modern browser — or serve it:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Features

| Feature | How it works |
|---|---|
| **Multiple courses** | Add / edit / delete courses |
| **Assignments** | Name, **weight (%)** and **grade (%)** for every assessment — all edited inline in the table; an empty grade slot means "not graded yet" and stays out of the math |
| **Two course types** | **Coursework only** (default): assessments total the final grade. **Exam-based**: coursework counts **40%** of the final grade and the final exam holds the other **60%** — the exam is a fixed, un-deleteable-looking row whose weight is locked at 60; coursework weights should come to 40% (⚠ warning otherwise) |
| **Per-assignment weighting** | Course grade = Σ(weight × grade) ÷ Σ(weights of graded work); a ⚠ warning appears until weights hit their target (100% standard / 40% coursework in exam courses) |
| **Live dashboard** | Semester summary sheet with the running average, dotted-leader rows per course, and trend arrows |
| **What-If calculator** | *Score needed*: the grade required on a new assessment of a given weight to hit a target; *Try a score*: project the final for an expected score. In exam-based courses the calculator always works on the **final exam itself** (weight fixed at 60): it answers "what do I need on the exam for a B?" — or, if the exam is already graded, what a re-sit would produce |
| **Persistence** | Everything saves to `localStorage` automatically and survives refresh (old v1 data migrates automatically) |
| **Dark / light mode** | Toggle in the header, follows your system preference by default |
| **Responsive** | Ledger re-flows on tablet; assignment rows stack into cards on mobile with no horizontal scroll |

## Design

"The Gradebook Ledger" — exam paper, blue-black ink, red marking pen.
Fraunces for display type and the rubber-stamp letter grades, Archivo for the
interface; dotted ledger leaders and a red margin rule carry the gradebook
metaphor. See `DESIGN.md` for the token system.

## Files

- `index.html` — page structure + modals
- `style.css` — design tokens (light/dark), layout, components, breakpoints
- `app.js` — state, grade math, rendering, CRUD, What-If solver
- `DESIGN.md` — design rationale and notes for future passes

## Grade math

- **Course grade (running):** `Σ (weight × grade) ÷ Σ (weight of graded work) × 100` — assessments without a grade are skipped
- **Complete grade:** once every weight's grade is in, the same formula over all weights (which should total 100% — a warning shows otherwise)
- **Exam-based courses:** coursework weights should total **40%**; the final exam is a required row with a locked **60%** weight. Same formula — the exam is just graded work like anything else. If the exam is deleted it is automatically restored as an ungraded placeholder so the 40/60 structure survives
- **Converting a course to exam-based** (in the edit-course modal): the largest *ungraded* assessment is promoted to become the final exam at weight 60; graded work is left untouched
- **What-If target:** `p = ((G ÷ 100 × S) − Σ graded contributions) ÷ (w ÷ 100)`, where `S = graded weight + w` (in exam courses, `w` is always the exam's 60)
- **Letters:** A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · F < 60
