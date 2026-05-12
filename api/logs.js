import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const { filter } = req.query;

  let query = supabase
    .from("logs")
    .select("*")
    .order("timestamp", { ascending: false });

  if (filter === "today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    query = query.gte("timestamp", today.toISOString());
  } else if (filter === "week") {
    const week = new Date();
    week.setDate(week.getDate() - 7);
    query = query.gte("timestamp", week.toISOString());
  }

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}
