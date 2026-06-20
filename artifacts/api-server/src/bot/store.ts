import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, "../../data/database.json");

export type TicketPriority = "high" | "medium" | "low";

export interface TicketData {
  userId: string;
  guildId: string;
  channelId: string;
  claimedBy: string | null;
  priority: TicketPriority;
  createdAt: number;
  controlPanelMessageId: string | null;
  ticketNumber: number;
}

export interface CustomButtonData {
  customId: string;
  label: string;
  emoji?: string;
  type: "role" | "link";
  roleId?: string;
  url?: string;
}

export interface EmbedData {
  messageId: string;
  channelId: string;
  guildId: string;
  buttons: CustomButtonData[];
}

interface Database {
  tickets: Record<string, TicketData>;
  embeds: Record<string, EmbedData>;
  ticketCounter: number;
}

let db: Database = {
  tickets: {},
  embeds: {},
  ticketCounter: 0,
};

export async function loadDb(): Promise<void> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    db = JSON.parse(raw);
  } catch {
    db = { tickets: {}, embeds: {}, ticketCounter: 0 };
    await saveDb();
  }
}

async function saveDb(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save database:", err);
  }
}

export function getTicket(channelId: string): TicketData | undefined {
  return db.tickets[channelId];
}

export async function saveTicket(
  channelId: string,
  data: TicketData,
): Promise<void> {
  db.tickets[channelId] = data;
  await saveDb();
}

export async function deleteTicket(channelId: string): Promise<void> {
  delete db.tickets[channelId];
  await saveDb();
}

export function nextTicketNumber(): number {
  db.ticketCounter += 1;
  return db.ticketCounter;
}

export function getEmbed(messageId: string): EmbedData | undefined {
  return db.embeds[messageId];
}

export async function saveEmbed(
  messageId: string,
  data: EmbedData,
): Promise<void> {
  db.embeds[messageId] = data;
  await saveDb();
}
