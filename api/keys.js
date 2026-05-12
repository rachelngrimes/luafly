import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  // GET - fetch all keys
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("keys")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // POST - generate keys
  if (req.method === "POST") {
    const { duration, amount } = req.body;
    if (!duration) return res.status(400).json({ error: "No duration provided" });

    const count = Math.min(amount || 1, 50);
    const keys = [];

    for (let i = 0; i < count; i++) {
      keys.push({
        key: "LUAFLY-" + uuidv4().toUpperCase().slice(0, 16),
        duration,
        redeemed: false,
        redeemed_by: null,
        created_at: new Date().toISOString()
      });
    }

    const { error } = await supabase.from("keys").insert(keys);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, keys: keys.map(k => k.key) });
  }

  // DELETE - delete a key
  if (req.method === "DELETE") {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: "No key provided" });

    const { error } = await supabase
      .from("keys")
      .delete()
      .eq("key", key);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
}
