-- ============================================================
-- CampusDesk — Supabase Schema
-- Paste this entire file into your Supabase SQL Editor and click Run
-- ============================================================

CREATE TABLE IF NOT EXISTS requests (
  id                TEXT PRIMARY KEY,
  student_name      TEXT NOT NULL,
  student_id        TEXT NOT NULL,
  request_text      TEXT NOT NULL,
  summary           TEXT NOT NULL DEFAULT '',
  department        TEXT NOT NULL CHECK (department IN ('Academic','Hostel','Finance','Examination','Library')),
  status            TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
                      'submitted','department_queue','in_review',
                      'approved','rejected','escalated',
                      'authority_review','final_approved','authority_rejected'
                    )),
  remarks           TEXT NOT NULL DEFAULT '',
  admin_remarks     TEXT NOT NULL DEFAULT '',
  authority_remarks TEXT NOT NULL DEFAULT '',
  ai_confidence     TEXT CHECK (ai_confidence IN ('high','medium','low')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_student_id ON requests(student_id);
CREATE INDEX IF NOT EXISTS idx_requests_status     ON requests(status);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON requests;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Disable RLS (backend uses service role key and handles access control)
ALTER TABLE requests DISABLE ROW LEVEL SECURITY;

-- ── Seed data ─────────────────────────────────────────────────────────────────
INSERT INTO requests (id, student_name, student_id, request_text, summary, department, status, admin_remarks, authority_remarks, created_at, updated_at) VALUES
  ('REQ-001','Aarav Sharma',  'CS2024001','I need a bonafide certificate for a bank loan application.',               'Bonafide certificate for bank loan',  'Academic',   'approved',         'Verified student enrollment. Certificate issued.','',                                             '2026-02-20T09:30:00Z','2026-02-22T14:00:00Z'),
  ('REQ-002','Priya Patel',   'EC2024015','My hostel room AC is not working since last week. Please get it repaired.','Hostel AC repair request',             'Hostel',     'department_queue', '','',                                                                                             '2026-02-24T11:00:00Z','2026-02-24T11:30:00Z'),
  ('REQ-003','Rohan Mehta',   'ME2024042','I want to apply for the tuition fee installment plan for this semester.',  'Fee installment plan application',     'Finance',    'in_review',        'Checking fee payment history.','',                                                              '2026-02-23T08:15:00Z','2026-02-25T10:00:00Z'),
  ('REQ-004','Sneha Reddy',   'CS2024078','I need my previous semester mark sheet re-issued. The original was damaged.','Mark sheet re-issue',                'Examination','submitted',        '','',                                                                                             '2026-02-26T14:45:00Z','2026-02-26T14:45:00Z'),
  ('REQ-005','Vikram Singh',  'EE2024033','Request to extend my library book return deadline by two weeks due to exams.','Library book deadline extension',   'Library',    'final_approved',   'Forwarded to dean for policy exception.','Extension approved as a one-time exception.',          '2026-02-19T16:00:00Z','2026-02-21T09:30:00Z'),
  ('REQ-006','Ananya Gupta',  'CS2024089','I need a no-dues certificate for my final semester clearance process.',    'No-dues certificate request',          'Finance',    'authority_review', 'Needs clearance from multiple departments. Escalated.','',                                      '2026-02-22T10:00:00Z','2026-02-25T16:30:00Z'),
  ('REQ-007','Karthik Nair',  'ME2024061','Request for hostel room change to ground floor due to leg injury.',        'Hostel room change request',           'Hostel',     'escalated',        'Medical certificate verified. Needs warden approval.','',                                      '2026-02-25T07:45:00Z','2026-02-26T11:00:00Z'),
  ('REQ-008','Divya Krishnan','EC2024029','Requesting permission to access the digital library resources remotely.',  'Remote library access request',        'Library',    'rejected',         'Remote access is restricted to faculty only.','',                                               '2026-02-18T13:20:00Z','2026-02-20T08:00:00Z'),
  ('REQ-009','Aarav Sharma',  'CS2024001','I need to apply for a semester leave due to a family medical emergency.',  'Semester leave application',           'Academic',   'authority_review', 'Documents verified. Forwarded to Dean for approval.','',                                       '2026-02-25T10:00:00Z','2026-02-27T09:00:00Z'),
  ('REQ-010','Aarav Sharma',  'CS2024001','Request to waive the late fee for hostel payment. I had a bank issue.',    'Late fee waiver request',              'Finance',    'rejected',         'Late fee waiver not applicable per policy.','',                                                 '2026-02-21T15:30:00Z','2026-02-23T11:00:00Z')
ON CONFLICT (id) DO NOTHING;
