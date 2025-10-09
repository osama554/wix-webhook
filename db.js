import fs from "fs";

const DB_FILE = "./tokens.json";

export function saveTokens(instanceId, data) {
  let db = {};
  if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  db[instanceId] = data;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function getTokensByInstanceId(instanceId) {
  if (!fs.existsSync(DB_FILE)) return null;
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return db[instanceId] || null;
}
