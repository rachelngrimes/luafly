import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  const key = req.method === "GET" ? req.query.key : req.body.key;
  const hwid = req.method === "GET" ? req.query.hwid : req.body.hwid;
  const username = req.method === "GET" ? req.query.username : req.body.username;

  if (!key || !hwid) return res.status(400).json({ error: "Missing key or HWID" });

  // Check if key exists
  const { data: keyData, error } = await supabase
    .from("keys")
    .select("*")
    .eq("key", key)
    .single();

  if (error || !keyData) return res.status(400).json({ error: "Invalid key" });
  if (keyData.redeemed) return res.status(400).json({ error: "Key already redeemed" });

  // Check if HWID already exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("hwid")
    .eq("hwid", hwid)
    .single();

  if (existingUser) return res.status(400).json({ error: "HWID already whitelisted" });

  // Calculate expiry
  let expires_at = null;
  if (keyData.duration === "7day") {
    expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (keyData.duration === "30day") {
    expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Add user
  await supabase.from("users").insert([{
    hwid,
    username: username || "Unknown",
    status: "whitelisted",
    hwid_resets_left: 3,
    max_devices: 1,
    expires_at,
    created_at: new Date().toISOString()
  }]);

  // Mark key as redeemed
  await supabase.from("keys").update({ redeemed: true, redeemed_by: hwid }).eq("key", key);

  // Log it
  await supabase.from("logs").insert([{
    hwid,
    username: username || "Unknown",
    action: "redeemed key",
    timestamp: new Date().toISOString()
  }]);

  // Send webhook
  if (process.env.WEBHOOK_URL) {
    await fetch(process.env.WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🔑 **${username || "Unknown"}** redeemed a key.\n**HWID:** ${hwid}\n**Key:** ${key}\n**Duration:** ${keyData.duration}`
      })
    });
  }

  return res.status(200).json({ success: true, expires_at });
}
