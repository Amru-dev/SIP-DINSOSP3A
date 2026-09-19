export function activityRepository(db) {
  async function activityRows() {
    const rows = await db.all(
      "SELECT * FROM activities ORDER BY activity_date DESC,published DESC",
    );
    const media = await db.all(
      "SELECT * FROM activity_media ORDER BY position",
    );
    const videos = await db.all("SELECT * FROM activity_videos");
    return rows.map((row) => ({
      ...row,
      photo_ids: [
        ...new Set(
          [
            row.photo_id,
            ...media
              .filter((m) => m.activity_id === row.id)
              .map((m) => m.file_id),
          ].filter(Boolean),
        ),
      ],
      youtube_id:
        videos.find((v) => v.activity_id === row.id)?.youtube_id || "",
    }));
  }

  return { activityRows };
}
