import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  // GET - fetch all users
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // POST - add user manually
  if (req.method === "POST") {
    const { hwid, username, status, notes, hwid_resets_left, max_devices } = req.body;
    if (!hwid) return res.status(400).json({ error: "No HWID provided" });

    const { error } = await supabase.from("users").insert([{
      hwid,
      username: username || "Unknown",
      status: status || "whitelisted",
      notes: notes || "",
      hwid_resets_left: hwid_resets_left || 3,
      max_devices: max_devices || 1,
      created_at: new Date().toISOString()
    }]);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // PATCH - update user
  if (req.method === "PATCH") {
    const { hwid, ...updates } = req.body;
    if (!hwid) return res.status(400).json({ error: "No HWID provided" });

    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("hwid", hwid);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // DELETE - remove user
  if (req.method === "DELETE") {
    const { hwid } = req.body;
    if (!hwid) return res.status(400).json({ error: "No HWID provided" });

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("hwid", hwid);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
}
