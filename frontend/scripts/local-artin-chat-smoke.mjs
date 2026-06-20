const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://127.0.0.1:8000";

function includesAny(text, terms) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

async function postJson(path, body) {
  const response = await fetch(`${backendBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  const message = process.env.CHAT_SMOKE_MESSAGE ||
    "برای ASTM D86 در آزمایشگاه پالایشگاهی، هدف آزمون چیست و چه نکات عملی مهمی باید رعایت شود؟ پاسخ را کوتاه ولی فنی بده.";

  const data = await postJson("/chat", {
    message,
    domain: "auto",
    response_mode: "auto",
    user_id: `local_chat_smoke_${Date.now()}`,
    history: [],
  });

  const answer = String(data.answer || "").trim();
  const sourceCount = Number(data.source_count || 0);
  const questionId = Number(data.question_id || 0);

  if (!questionId) {
    throw new Error(`Chat response did not include a question_id: ${JSON.stringify(data)}`);
  }
  if (data.answer_mode !== "ai") {
    throw new Error(`Expected AI answer_mode, got ${data.answer_mode}: ${answer.slice(0, 300)}`);
  }
  if (answer.length < 250) {
    throw new Error(`Chat answer was too short (${answer.length} chars): ${answer}`);
  }
  if (!data.search_mode || typeof data.search_mode !== "string") {
    throw new Error(`Chat response did not include search_mode: ${JSON.stringify(data)}`);
  }
  if (!includesAny(answer, ["ASTM", "D86", "تقطیر", "نقطه جوش", "distillation"])) {
    throw new Error(`Chat answer did not appear relevant to ASTM D86: ${answer.slice(0, 500)}`);
  }

  console.log(JSON.stringify({
    success: true,
    question_id: questionId,
    answer_mode: data.answer_mode,
    answer_chars: answer.length,
    detected_domain: data.detected_domain,
    question_intent: data.question_intent,
    search_mode: data.search_mode,
    web_search_used: data.web_search_used,
    source_count: sourceCount,
    resource_link_count: Array.isArray(data.resource_links) ? data.resource_links.length : 0,
    answer_preview: answer.slice(0, 220),
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
