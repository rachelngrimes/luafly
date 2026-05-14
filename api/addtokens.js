import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { hwid, amount } = req.body;
  if (!hwid || !amount) return res.status(400).json({ error: "Missing hwid or amount" });

  const { data: user, error } = await supabase
    .from("users")
    .select("tokens")
    .eq("hwid", hwid)
    .single();

  if (error || !user) return res.status(400).json({ error: "User not found" });

  const { error: updateError } = await supabase
    .from("users")
    .update({ tokens: (user.tokens || 0) + parseInt(amount) })
    .eq("hwid", hwid);

  if (updateError) return res.status(500).json({ error: updateError.message });
  return res.status(200).json({ success: true, tokens: (user.tokens || 0) + parseInt(amount) });
}
