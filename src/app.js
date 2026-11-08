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
