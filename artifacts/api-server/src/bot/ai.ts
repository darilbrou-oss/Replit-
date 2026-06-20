const API_URL = "https://text.pollinations.ai/";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

const userHistories = new Map<string, Message[]>();

const SYSTEM_PROMPT = `Tu es un assistant Discord intelligent, sympathique et utile. 
Tu réponds toujours en français de manière naturelle et conversationnelle.
Tu es concis (maximum 1900 caractères) et pertinent.
Tu n'indiques jamais que tu es une IA ou un bot sauf si on te le demande directement.
Tu aides avec toutes les questions : aide, conseils, informations, créativité, etc.`;

export async function askAI(
  userId: string,
  userMessage: string,
): Promise<string> {
  if (!userHistories.has(userId)) {
    userHistories.set(userId, []);
  }

  const history = userHistories.get(userId)!;

  history.push({ role: "user", content: userMessage });

  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
  ];

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      model: "openai",
      seed: Math.floor(Math.random() * 10000),
      private: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Pollinations API error: ${response.status}`);
  }

  const reply = await response.text();
  const trimmed = reply.trim().slice(0, 1900);

  history.push({ role: "assistant", content: trimmed });

  return trimmed;
}

export function clearHistory(userId: string): void {
  userHistories.delete(userId);
}
