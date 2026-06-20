import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Config {
  guildId: string;
  ticketCategoryId: string;
  ticketLogChannelId: string;
  staffRoleId: string;
  modRoleId: string;
  adminRoleId: string;
  welcomeChannelId: string;
  suggestionsChannelId: string;
  reviewsChannelId: string;
  applicationsChannelId: string;
}

const configPath = path.resolve(__dirname, "../config.json");

let config: Config = {
  guildId: "",
  ticketCategoryId: "",
  ticketLogChannelId: "",
  staffRoleId: "",
  modRoleId: "",
  adminRoleId: "",
  welcomeChannelId: "",
  suggestionsChannelId: "",
  reviewsChannelId: "",
  applicationsChannelId: "",
};

try {
  const raw = fs.readFileSync(configPath, "utf-8");
  config = { ...config, ...JSON.parse(raw) };
} catch {
  console.warn(
    "[Config] config.json non trouvé ou invalide, utilisation des valeurs par défaut",
  );
}

export default config;
