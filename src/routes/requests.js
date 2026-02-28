const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { classifyRequest } = require("../lib/classify");

// Valid status transitions — prevents illegal state jumps
const VALID_TRANSITIONS = {
  submitted:          ["department_queue", "in_review", "approved", "rejected", "escalated"],
  department_queue:   ["in_review", "approved", "rejected", "escalated"],
  in_review:          ["approved", "rejected", "escalated"],
  approved:           [],
  rejected:           ["submitted"],
  escalated:          ["authority_review", "final_approved", "authority_rejected"],
  authority_review:   ["final_approved", "authority_rejected"],
  final_approved:     [],
  authority_rejected: ["submitted"],
};

function isValidTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── GET /api/requests ─────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    let query = supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (req.query.studentId)  query = query.eq("student_id", req.query.studentId);
    if (req.query.status)     query = query.eq("status", req.query.status);
    if (req.query.department) query = query.eq("department", req.query.department);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /requests:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/requests/stats/summary ──────────────────────────────────────────
// Must come BEFORE /:id route to avoid "stats" being treated as an id
router.get("/stats/summary", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("requests")
      .select("status, created_at, updated_at");
    if (error) throw error;

    const total = data.length;
    const pending   = data.filter((r) => ["submitted","department_queue","in_review"].includes(r.status)).length;
    const escalated = data.filter((r) => ["escalated","authority_review"].includes(r.status)).length;
    const approved  = data.filter((r) => ["approved","final_approved"].includes(r.status)).length;
    const rejected  = data.filter((r) => ["rejected","authority_rejected"].includes(r.status)).length;

    const resolved = data.filter((r) =>
      ["approved","final_approved","rejected","authority_rejected"].includes(r.status)
    );
    let avgResolutionHours = null;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce(
        (sum, r) => sum + (new Date(r.updated_at) - new Date(r.created_at)), 0
      );
      avgResolutionHours = (totalMs / resolved.length / 3_600_000).toFixed(1);
    }

    res.json({ success: true, data: { total, pending, escalated, approved, rejected, avgResolutionHours } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/requests/:id ─────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: "Request not found" });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/requests ────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { requestText, studentName, studentId } = req.body;

    if (!requestText?.trim())  return res.status(400).json({ success: false, error: "requestText is required" });
    if (!studentName?.trim())  return res.status(400).json({ success: false, error: "studentName is required" });
    if (!studentId?.trim())    return res.status(400).json({ success: false, error: "studentId is required" });

    // AI classification
    const classification = await classifyRequest(requestText);

    // Build a readable sequential ID
    const { count } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true });

    const reqNumber = String((count || 0) + 1).padStart(3, "0");
    const id = `REQ-${reqNumber}`;

    const newRequest = {
      id,
      student_name:      studentName,
      student_id:        studentId,
      request_text:      requestText,
      summary:           classification.summary || requestText.slice(0, 60),
      department:        classification.department,
      status:            "submitted",
      remarks:           "",
      admin_remarks:     "",
      authority_remarks: "",
      ai_confidence:     classification.confidence,
    };

    const { data, error } = await supabase
      .from("requests")
      .insert([newRequest])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("POST /requests:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/requests/:id/status ───────────────────────────────────────────
router.patch("/:id/status", async (req, res) => {
  try {
    const { status, adminRemarks, authorityRemarks, remarks } = req.body;

    const { data: current, error: fetchError } = await supabase
      .from("requests")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (fetchError || !current)
      return res.status(404).json({ success: false, error: "Request not found" });

    if (status && !isValidTransition(current.status, status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid transition: ${current.status} → ${status}`,
      });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (status !== undefined)            updates.status            = status;
    if (adminRemarks !== undefined)      updates.admin_remarks     = adminRemarks;
    if (authorityRemarks !== undefined)  updates.authority_remarks = authorityRemarks;
    if (remarks !== undefined)           updates.remarks           = remarks;

    const { data, error } = await supabase
      .from("requests")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("PATCH /requests/:id/status:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/requests/:id/resubmit ─────────────────────────────────────────
router.patch("/:id/resubmit", async (req, res) => {
  try {
    const { requestText, studentId } = req.body;

    if (!requestText?.trim())
      return res.status(400).json({ success: false, error: "requestText is required" });

    const { data: current, error: fetchError } = await supabase
      .from("requests")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (fetchError || !current)
      return res.status(404).json({ success: false, error: "Request not found" });

    if (current.student_id !== studentId)
      return res.status(403).json({ success: false, error: "Not authorized" });

    if (current.status !== "rejected" && current.status !== "authority_rejected")
      return res.status(400).json({ success: false, error: "Only rejected requests can be resubmitted" });

    const classification = await classifyRequest(requestText);

    const { data, error } = await supabase
      .from("requests")
      .update({
        request_text:      requestText,
        summary:           classification.summary || requestText.slice(0, 60),
        department:        classification.department,
        status:            "submitted",
        remarks:           "",
        admin_remarks:     "",
        authority_remarks: "",
        ai_confidence:     classification.confidence,
        updated_at:        new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("PATCH /requests/:id/resubmit:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
