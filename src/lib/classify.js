const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DEPARTMENTS = ["Academic", "Hostel", "Finance", "Examination", "Library"];

async function classifyRequest(requestText) {
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are a campus administrative assistant. Classify this student request into exactly ONE department and generate a short summary.

Departments:
- Academic: transcripts, certificates, bonafide, enrollment, leave, grade issues, course-related
- Hostel: room allotment, room change, hostel facilities, maintenance, AC, mess
- Finance: fee payment, fee waiver, scholarships, refunds, installments, late fee
- Examination: marksheets, hall tickets, re-evaluation, exam schedule, results
- Library: books, library access, membership, book return, digital resources

Student Request: "${requestText}"

Respond with ONLY valid JSON, no markdown, no explanation:
{"department":"<one of the 5 departments>","summary":"<max 60 char summary>","confidence":"high|medium|low"}`,
        },
      ],
    });

    const raw = message.content[0].text.trim();
    const parsed = JSON.parse(raw);
    if (!DEPARTMENTS.includes(parsed.department)) {
      parsed.department = "Academic";
    }
    return parsed;
  } catch (err) {
    console.error("Classification error:", err.message);
    return fallbackClassify(requestText);
  }
}

function fallbackClassify(text) {
  const lower = text.toLowerCase();
  if (/hostel|room|ac|mess|warden|maintenance/.test(lower))
    return { department: "Hostel", summary: text.slice(0, 60), confidence: "low" };
  if (/fee|finance|payment|waiver|scholarship|refund|installment/.test(lower))
    return { department: "Finance", summary: text.slice(0, 60), confidence: "low" };
  if (/exam|mark|result|hall.ticket|re-?eval/.test(lower))
    return { department: "Examination", summary: text.slice(0, 60), confidence: "low" };
  if (/library|book|return|digital.resource/.test(lower))
    return { department: "Library", summary: text.slice(0, 60), confidence: "low" };
  return { department: "Academic", summary: text.slice(0, 60), confidence: "low" };
}

module.exports = { classifyRequest };
