export async function handlePublicInformation({
  db,
  route,
  method,
  user,
  send,
  now,
  activityRows,
}) {
  if (route === "/api/public-information" && method === "GET") {
    const today = new Date(now).toISOString().slice(0, 10);
    const announcements =
      user?.role === "admin"
        ? await db.all(
            "SELECT * FROM announcements ORDER BY important DESC,publish_date DESC,published DESC",
          )
        : await db.all(
            "SELECT * FROM announcements WHERE publish_date<=? AND (expires_date IS NULL OR expires_date>=?) ORDER BY important DESC,publish_date DESC,published DESC",
            [today, today],
          );
    return send({
      employees: await db.all(
        "SELECT * FROM employees ORDER BY placement,name",
      ),
      activities: await activityRows(),
      documents: await db.all(
        "SELECT * FROM public_documents ORDER BY year DESC,publish_date DESC",
      ),
      announcements,
    });
  }

  return false;
}
