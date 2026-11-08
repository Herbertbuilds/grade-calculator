/* ---------- 1. State & persistence ---------- */
const LS_KEY = "gradecalc.v2";

let state = { theme: null, courses: [] };
// Snapshot of each course's % at page load — used to show trend arrows.
let baseline = {};

function saveState() {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {
        /* private mode etc. */
    }
    // Show autosave indicator
    const indicator = $("#autosaveIndicator");
    indicator.hidden = false;
    clearTimeout(window._autosaveTimer);
    window._autosaveTimer = setTimeout(() => {
        indicator.hidden = true;
    }, 1800);
}

function migrateV1(old) {
    return old.map((c) => {
        const cats = Array.isArray(c.categories) ? c.categories : [];
        const weightFor = (a) => {
            const cat = cats.find((k) => k.id === a.catId);
            const n = cat
                ? c.assignments.filter((x) => x.catId === a.catId).length
                : 0;
            if (cat && n > 0) return cat.weight / n;
            if (c.assignments.length > 0) return 100 / c.assignments.length;
            return 0;
        };
        return {
            id: c.id || uid(),
            name: c.name || "Course",
            term: c.term || "",
            type: "standard",
            open: c.open !== false,
            assignments: (c.assignments || []).map((a) => ({
                id: a.id || uid(),
                name: a.name || "Assignment",
                pct: a.total > 0 ? (a.earned / a.total) * 100 : null,
                weight: weightFor(a),
                exam: false,
            })),
        };
    });
}

function loadState() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        const old = localStorage.getItem("gradecalc.v1");
        let parsed = null;
        if (raw) parsed = JSON.parse(raw);
        if ((!parsed || !Array.isArray(parsed.courses)) && old) {
            const legacy = JSON.parse(old);
            if (legacy && Array.isArray(legacy.courses))
                parsed = {
                    theme: legacy.theme,
                    courses: migrateV1(legacy.courses),
                };
        }
        if (parsed && Array.isArray(parsed.courses)) {
            // Normalise any malformed fields
            state = {
                theme: parsed.theme || null,
                courses: parsed.courses.map((c) => ({
                    id: c.id || uid(),
                    name: c.name || "Course",
                    term: c.term || "",
                    type: c.type === "exam" ? "exam" : "standard",
                    open: c.open !== false,
                    assignments: (Array.isArray(c.assignments)
                        ? c.assignments
                        : []
                    ).map((a) => ({
                        id: a.id || uid(),
                        name: a.name || "Assignment",
                        pct:
                            typeof a.pct === "number" && isFinite(a.pct)
                                ? a.pct
                                : null,
                        weight:
                            typeof a.weight === "number" && isFinite(a.weight)
                                ? Math.max(0, a.weight)
                                : 0,
                        exam: a.exam === true,
                    })),
                })),
            };
        }
    } catch (e) {
        /* corrupted storage — start fresh */
    }
    baseline = {};
    ensureExams();
    for (const c of state.courses) baseline[c.id] = courseCalc(c).pct;
}

const uid = () =>
    Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

/* ---------- Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(str) {
    return String(str).replace(
        /[&<>"']/g,
        (m) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[m],
    );
}

const fmt1 = (n) => Math.round(n * 10) / 10;
const fmtPct = (n) => (n == null ? "—" : `${fmt1(n)}%`);

const examOf = (course) => course.assignments.find((a) => a.exam);
const isExamCourse = (course) => course.type === "exam";
/** Coursework share of the final grade: 40% for exam courses, 100% otherwise. */
const cwShare = (course) => (isExamCourse(course) ? 40 : 100);

/**
 * Exam courses must always contain their 60%-weight final exam item.
 * Restores it if it was ever deleted, so the 40/60 structure stays intact.
 */
function ensureExams() {
    let changed = false;
    for (const c of state.courses) {
        if (isExamCourse(c) && !examOf(c)) {
            c.assignments.push({
                id: uid(),
                name: "Final exam",
                pct: null,
                weight: 60,
                exam: true,
            });
            changed = true;
        }
    }
    if (changed) saveState();
}

/* Inline SVG icons (drawn in-house; no emoji, no icon library) */
const ICONS = {
    plus: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3.5 6h13L17.6 20a2 2 0 0 1-2 1.8H8.4A2 2 0 0 1 6.4 20L5.5 9ZM10 11v6.5h1.5V11H10Zm2.5 0v6.5H14V11h-1.5Z"/></svg>`,
};

/* ---------- Grade math engine ---------- */
function letterFor(pct) {
    if (pct == null) return { letter: "—", color: "var(--ink-2)" };
    if (pct >= 75)
        return { letter: "D", color: "var(--grade-a)", label: "Distinction" };
    if (pct >= 70)
        return { letter: "M", color: "var(--grade-b)", label: "Merit" };
    if (pct >= 60)
        return { letter: "C", color: "var(--grade-c)", label: "Credit" };
    if (pct >= 50)
        return { letter: "P", color: "var(--grade-d)", label: "Pass" };
    return { letter: "F", color: "var(--grade-f)", label: "Fail" };
}

function courseCalc(course) {
    const isExam = isExamCourse(course);
    const exam = examOf(course);
    const cwItems = course.assignments.filter((a) => !a.exam);
    const cwGraded = cwItems.filter((a) => a.pct != null);
    const examGraded = exam && exam.pct != null;

    if (isExam) {
        // Coursework: weighted over its OWN weights, scaled to 40% of the course.
        let cwContribution = 0,
            cwWeight = 0,
            cwWeightsTotal = 0;
        for (const a of cwItems) {
            cwWeightsTotal += a.weight;
            if (a.pct != null) {
                cwContribution += (a.weight * a.pct) / 100;
                cwWeight += a.weight;
            }
        }
        const cwWeightedAvg =
            cwWeight > 0 ? (cwContribution / cwWeight) * 100 : null;
        const cwBanked = cwWeightedAvg !== null ? cwWeightedAvg * 0.4 : null; // 40% share

        // Exam: 60% of the course, counted only when graded.
        const examBanked = examGraded ? exam.pct * 0.6 : 0;

        const finalPct = cwBanked !== null ? cwBanked + examBanked : null;

        return {
            pct: finalPct,
            contribution: finalPct,
            gradedWeight: cwGraded.length + (examGraded ? 1 : 0),
            weightsTotal: cwWeightsTotal,
            gradedCount: cwGraded.length + (examGraded ? 1 : 0),
            cwWeightedAvg, // weighted coursework average (0-100)
            cwWeightsTotal, // total of all coursework weights
            examContrib: examBanked,
            examPending: exam && !examGraded,
        };
    }

    // Standard: scale to whole course (100%).
    let contribution = 0,
        grading = 0,
        weightsTotal = 0,
        gradedCount = 0;
    for (const a of course.assignments) {
        weightsTotal += a.weight;
        if (a.pct != null) {
            contribution += (a.weight * a.pct) / 100;
            grading += a.weight;
            gradedCount++;
        }
    }
    return {
        pct: contribution > 0 ? contribution : null,
        contribution,
        gradedWeight: grading,
        weightsTotal,
        gradedCount,
    };
}

/* ---------- Rendering ---------- */
function renderAll() {
    ensureExams();
    renderTranscript();
    renderCourses();
}

/**
 * The semester summary sheet: the running average as the headline number,
 * then one dotted-leader ledger row per course.
 */
function renderTranscript() {
    const sec = $("#transcriptSection");
    const courses = state.courses;
    if (!courses.length) {
        sec.hidden = true;
        sec.innerHTML = "";
        return;
    }

    const scored = courses
        .map((c) => ({ c, calc: courseCalc(c) }))
        .filter((g) => g.calc.pct != null);
    const avg = scored.length
        ? scored.reduce((s, g) => s + g.calc.pct, 0) / scored.length
        : null;
    const best = scored.length
        ? scored.reduce((a, b) => (b.calc.pct > a.calc.pct ? b : a))
        : null;
    const nItems = courses.reduce((s, c) => s + c.assignments.length, 0);
    const avgL = letterFor(avg);

    const summaryText =
        `${courses.length} course${courses.length === 1 ? "" : "s"}, ${nItems} item${nItems === 1 ? "" : "s"} logged` +
        (best
            ? `. Best so far: ${esc(best.c.name)} at ${fmtPct(best.calc.pct)}`
            : "") +
        (avg == null ? ". Add graded work to see the average" : "");

    const rows = courses
        .map((course, i) => {
            const calc = courseCalc(course);
            const L = letterFor(calc.pct);
            const base = baseline[course.id];
            let delta = "";
            if (calc.pct != null && base != null) {
                const d = fmt1(calc.pct - base);
                if (d > 0) delta = `<span class="delta up">▲ ${d}</span>`;
                else if (d < 0)
                    delta = `<span class="delta down">▼ ${Math.abs(d)}</span>`;
            }
            const sub =
                `${calc.gradedCount} of ${course.assignments.length} graded` +
                (isExamCourse(course) && examOf(course)?.pct == null
                    ? ", exam pending"
                    : "");
            const empty = calc.pct == null ? " stamp-empty" : "";
            return `
      <li>
        <button class="ledger-row" data-goto="${course.id}" aria-label="Open ${esc(course.name)}">
          <span class="ledger-name">${esc(course.name)}
            ${course.term ? `<span class="ledger-term">${esc(course.term)}</span>` : ""}
          </span>
          <span class="leader" aria-hidden="true"></span>
          <span class="ledger-sub">${sub}</span>
          <span class="ledger-pct" style="color:${calc.pct == null ? "var(--ink-2)" : L.color}">${fmtPct(calc.pct)}</span>
          <span class="stamp stamp-sm${empty}" style="--d:${i * 60}ms; color:${L.color}">${L.letter}</span>
          ${L.label ? `<span class="grade-label" style="color:${L.color}">${esc(L.label)}</span>` : ""}
          ${delta}
        </button>
      </li>`;
        })
        .join("");

    sec.hidden = false;
    sec.innerHTML = `
    <div class="sheet transcript">
      <div class="transcript-head">
        <div class="transcript-average">
          <span class="big-pct" style="color:${avgL.color}">${fmtPct(avg)}</span>
          <span class="stamp${avg == null ? " stamp-empty" : ""}" style="--d:120ms; color:${avgL.color}">${avgL.letter}</span>
        </div>
        <div class="transcript-info">
          <h2>Semester summary</h2>
          <p>${summaryText}</p>
        </div>
      </div>
      <ol class="ledger">${rows}</ol>
    </div>`;
}

function renderCourses() {
    const list = $("#courseList");
    const empty = $("#emptyState");
    const has = state.courses.length > 0;
    if (empty) empty.hidden = has;
    list.innerHTML = state.courses.map(buildCourseCard).join("");
}

/* Weight validation: exam courses need coursework weights to total 40% */
function weightsOk(course, calc) {
    if (isExamCourse(course)) {
        return Math.abs(calc.cwWeightsTotal - 40) < 0.5;
    }
    return Math.abs(calc.weightsTotal - 100) < 0.5;
}

function weightsWarnText(course, calc) {
    if (isExamCourse(course)) {
        return `Coursework weights total ${fmt1(calc.cwWeightsTotal)}%, but they should come to 40% (the exam holds the other 60%)`;
    }
    return `Weights total ${fmt1(calc.weightsTotal)}%, but they should come to 100%`;
}

function buildCourseCard(course) {
    const calc = courseCalc(course);
    const L = letterFor(calc.pct);
    const isOpen = course.open !== false;
    const exam = isExamCourse(course);
    const share = cwShare(course);

    const weightLine =
        course.assignments.length && !weightsOk(course, calc)
            ? `<div class="method-bar"><span class="weights-warn">${weightsWarnText(course, calc)}</span></div>`
            : exam && calc.examPending
              ? `<div class="method-bar"><span class="method-note">Coursework (weighted, ×0.4) + final exam (×0.6) = final grade</span></div>`
              : "";

    const rows = course.assignments.length
        ? course.assignments.map((a) => assignRow(a, exam)).join("")
        : `<div class="assign-empty">Nothing logged yet. Add the first assessment below.</div>`;

    const assignSection = `
    <div class="assignment-list">
      <div class="table-head">
        <span>Assessment</span><span>Weight</span><span>Grade</span><span></span><span></span>
      </div>
      ${rows}
    </div>`;

    return `
    <article class="course-card ${isOpen ? "open" : ""}" id="course-${course.id}" data-course="${course.id}">
      <div class="course-head" data-toggle>
        <div class="course-title">
          <h3>${esc(course.name)}</h3>
          ${course.term ? `<span class="term">${esc(course.term)}</span>` : ""}
        </div>
        <div class="course-grade">
          <span class="course-pct" style="color:${calc.pct == null ? "var(--ink-2)" : L.color}">${fmtPct(calc.pct)}</span>
          <span class="stamp stamp-sm${calc.pct == null ? " stamp-empty" : ""}" style="color:${L.color}">${L.letter}</span>
          ${L.label ? `<span class="grade-label" style="color:${L.color}">${esc(L.label)}</span>` : ""}
        </div>
        <div class="course-actions">
          <button type="button" class="row-btn" data-edit-course title="Edit course" aria-label="Edit course">${ICONS.edit || ""}</button>
          <button type="button" class="row-btn danger" data-del-course title="Delete course" aria-label="Delete course">${ICONS.trash}</button>
        </div>
        <svg class="chevron" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z"/>
        </svg>
      </div>
      <div class="course-body">
        ${weightLine}
        ${assignSection}
        <div class="course-foot">
          <button type="button" class="btn btn-primary" data-add-assign>
            ${ICONS.plus}
            <span>Add assessment</span>
          </button>
          <button type="button" class="btn btn-ghost" data-whatif>What-if calculator</button>
        </div>
      </div>
    </article>`;
}

function assignRow(a, isExamCourse) {
    const L = letterFor(a.pct);
    const stamp =
        a.pct == null
            ? `<span class="stamp stamp-xs stamp-empty">–</span>`
            : `<span class="stamp stamp-xs" style="color:${L.color}">${L.letter}</span>`;

    // Exam courses: no weight column for coursework — assessments are entered on a 100% scale
    // and internally count as 40% of the final. The exam is separate at 60%.
    const weightCell = a.exam
        ? `<span class="input-cell"><input type="number" value="${fmt1(a.weight)}"
        data-a-weight-exam disabled title="The exam always counts 60%" aria-label="Exam weight (fixed)" /><span class="unit">%</span></span>`
        : `<span class="input-cell a-weight"><input type="number" min="0" max="100" step="0.5" value="${fmt1(a.weight)}"
        data-a-weight aria-label="Weight %" /><span class="unit">%</span></span>`;
    return `
    <div class="assign-row" data-assign="${a.id}">
      <input class="a-name" type="text" value="${esc(a.name)}" maxlength="60" data-a-name aria-label="Assessment name" />
      ${weightCell}
      <span class="input-cell a-grade"><input type="number" min="0" max="200" step="0.5"
        value="${a.pct == null ? "" : fmt1(a.pct)}" placeholder="—"
        data-a-pct aria-label="Grade %" /><span class="unit">%</span></span>
      <span class="a-stamp">${stamp}</span>
      <span class="row-actions a-actions">
        <button type="button" class="row-btn danger" data-del-assign="${a.id}" title="Delete" aria-label="Delete ${esc(a.name)}">${ICONS.trash}</button>
      </span>
    </div>`;
}

/* ---------- 5. Course & assignment editing ---------- */
/* Generic modal helpers */
function openModal(el) {
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("show"));
    const first = el.querySelector("input, select");
    if (first) setTimeout(() => first.focus(), 80);
}
function closeModal(el) {
    el.classList.remove("show");
    setTimeout(() => {
        el.hidden = true;
    }, 220);
}
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") $$(".modal-overlay.show").forEach(closeModal);
});
$$(".modal-overlay").forEach((ov) => {
    ov.addEventListener("click", (e) => {
        if (e.target === ov || e.target.closest("[data-close]")) closeModal(ov);
    });
});

/* ---- Course modal ---- */
let editingCourseId = null;
let draftType = "standard";

$("#courseTypeSeg").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-type]");
    if (!btn) return;
    draftType = btn.dataset.type;
    setTypeDraft(draftType);
    $$("#courseTypeSeg .seg-btn").forEach((b) =>
        b.classList.toggle("active", b.dataset.type === draftType),
    );
    $("#typeHint").textContent =
        draftType === "exam"
            ? "Coursework counts 40%, and the final exam holds the other 60%."
            : "Assessments add up to the final grade.";
});

function setTypeDraft(type) {
    draftType = type;
}

function openCourseModal(courseId = null) {
    editingCourseId = courseId;
    $("#courseModalTitle").textContent = courseId
        ? "Edit course"
        : "Add course";
    $("#courseSave").textContent = courseId ? "Save changes" : "Add course";
    $("#courseId").value = courseId || "";
    const c = courseId ? state.courses.find((x) => x.id === courseId) : null;
    $("#courseName").value = c ? c.name : "";
    $("#courseSemester").value = c && c.term ? c.term : "";
    draftType = c ? (c.type === "exam" ? "exam" : "standard") : "standard";
    $$("#courseTypeSeg .seg-btn").forEach((b) =>
        b.classList.toggle("active", b.dataset.type === draftType),
    );
    $("#typeHint").textContent =
        draftType === "exam"
            ? "Coursework counts 40%, and the final exam holds the other 60%."
            : "Assessments add up to the final grade.";
    openModal($("#courseModal"));
}
