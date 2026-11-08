<img src="https://capsule-render.vercel.app/api?type=waving&height=180&color=0:00ff9c,100:0d1117&text=Grade%20Calculator&fontColor=0d1117&fontSize=44&fontAlign=50&fontAlignY=38&desc=Track%20courses.%20Know%20exactly%20what%20you%20need%20on%20the%20exam.&descSize=16&descAlignY=60" width="100%" alt="Grade Calculator" />

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-0d1117?style=for-the-badge&logo=html5&logoColor=00ff9c)
![CSS3](https://img.shields.io/badge/CSS3-0d1117?style=for-the-badge&logo=css3&logoColor=00ff9c)
![JavaScript](https://img.shields.io/badge/JavaScript_ES6+-0d1117?style=for-the-badge&logo=javascript&logoColor=00ff9c)
![No build](https://img.shields.io/badge/dependencies-0-00ff9c?style=for-the-badge&labelColor=0d1117)

</div>

A responsive grade tracker in **pure vanilla HTML, CSS and JavaScript**. No frameworks, no build step, no install. Add your courses, enter your marks, and the What-If solver tells you what score you need to hit the grade you want.

<!-- Add a screenshot or GIF here:
<p align="center"><img src="docs/screenshot.png" width="800" alt="Grade Calculator screenshot" /></p>
-->

## Quick start

```console
$ git clone https://github.com/Herbertbuilds/grade-calculator.git
$ cd grade-calculator
$ python3 -m http.server 8000
# → http://localhost:8000
```

No server needed either: opening `index.html` in any modern browser works too.

## What it does

- **Multiple courses.** Add, edit and delete as many as you need.
- **Inline assignments.** Name, weight (%) and grade (%) are edited right in the table. Leave a grade empty and it's treated as "not graded yet" and stays out of the math.
- **Two course types.** Coursework only, or exam-based (40% coursework, 60% final exam).
- **Live dashboard.** A semester summary with your running average, a row per course and trend arrows.
- **What-If calculator.** Work out the score you need, or try a score and see the projected final.
- **Saves automatically.** Everything lives in `localStorage` and survives a refresh. Older v1 data migrates on its own.
- **Dark and light mode.** Follows your system by default, with a toggle in the header.
- **Mobile friendly.** The ledger reflows on tablets and rows stack into cards on phones, with no sideways scrolling.

### Course types

| | Coursework only | Exam-based |
|---|---|---|
| **Default?** | Yes | No |
| **Weights should total** | 100% | 40% coursework + 60% exam |
| **Final exam row** | None | Always present, weight locked at 60 |
| **Warning** | Shown until weights hit 100% | Shown until coursework hits 40% |

### What-If

| Mode | Question it answers |
|---|---|
| **Score needed** | What do I need on a new assessment of weight *w* to finish on grade *G*? |
| **Try a score** | If I get *X* on it, where does my final land? |

In exam-based courses the calculator always works on the final exam itself ("what do I need on the exam for a B?"). If the exam is already graded, it shows what a re-sit would produce.

## Grade math

```text
Running grade   Σ(weight × grade) ÷ Σ(weight of graded work) × 100
Complete grade  same formula once every assessment is graded (weights should total 100%)
What-If         p = ((G ÷ 100 × S) − Σ graded contributions) ÷ (w ÷ 100)
                where S = graded weight + w
                (in exam courses, w is always the exam's 60)
```

**Edge cases handled**

- If you delete the final exam, it comes back as an ungraded placeholder so the 40/60 structure survives.
- Converting a course to exam-based promotes the largest *ungraded* assessment to the final exam at weight 60. Graded work is left untouched.

## Grading system

Every grade (a course, the semester average, even a single assignment) gets a rubber-stamp letter and a colour, decided by `letterFor()` in `app.js`.

| Stamp | Final grade | Meaning |
|---|---|---|
| **D** | 75% and above | Distinction (green) |
| **M** | 70 – 74.9% | Merit (olive) |
| **C** | 60 – 69.9% | Credit (ochre) |
| **P** | 50 – 59.9% | Pass (orange) |
| **F** | below 50% | Fail (red) |

## Project structure

```text
grade-calculator/
├── index.html    page structure + modals
├── style.css     design tokens (light/dark), layout, components, breakpoints
├── app.js        state, grade math, rendering, CRUD, What-If solver
└── DESIGN.md     design rationale and notes
```

## Design

**"The Gradebook Ledger"**: exam paper, blue-black ink and a red marking pen. Fraunces handles the display type and the rubber-stamp letter grades, Archivo handles the interface, and dotted ledger leaders with a red margin rule carry the gradebook look.

<div align="center">
<sub>Built by <a href="https://github.com/Herbertbuilds">Herbert Jantjies</a></sub>
</div>
