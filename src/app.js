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
