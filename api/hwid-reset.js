import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { old_hwid, new_hwid } = req.body;
  if (!old_hwid || !new_hwid) return res.status(400).json({ error: "Missing HWIDs" });

  // Get user
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("hwid", old_hwid)
    .single();

  if (error || !user) return res.status(400).json({ error: "User not found" });
  if (user.hwid_resets_left <= 0) return res.status(400).json({ error: "No resets left" });

  // Update HWID
  const { error: updateError } = await supabase
    .from("users")
    .update({
      hwid: new_hwid,
      hwid_resets_left: user.hwid_resets_left - 1
    })
    .eq("hwid", old_hwid);

  if (updateError) return res.status(500).json({ error: updateError.message });

  // Log it
  await supabase.from("logs").insert([{
    hwid: new_hwid,
    username: user.username || "Unknown",
    action: "hwid reset",
    timestamp: new Date().toISOString()
  }]);

  // Send webhook
  if (process.env.WEBHOOK_URL) {
    await fetch(process.env.WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🔄 **${user.username || "Unknown"}** reset their HWID.\n**Old HWID:** ${old_hwid}\n**New HWID:** ${new_hwid}\n**Resets left:** ${user.hwid_resets_left - 1}`
      })
    });
  }

  return res.status(200).json({ success: true, resets_left: user.hwid_resets_left - 1 });
}
