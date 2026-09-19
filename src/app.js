import http from "node:http";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fail, text, upload } from "./shared/validation.js";
import { informationRequestHandler } from "./features/information-requests/routes.js";
import { applicationService } from "./features/applications/service.js";
import { activityRepository } from "./features/activities/repository.js";
import { setSecurityHeaders } from "./http/security-headers.js";
import { createRateLimiter } from "./http/rate-limit.js";
import { readJson } from "./http/read-json.js";
import { requestSession } from "./http/session.js";
import { servePublicFile } from "./http/public-files.js";
import { serveStatic } from "./http/static-files.js";
import { handleAuth } from "./features/auth/routes.js";
import { handleAccounts } from "./features/accounts/routes.js";
import { handleFieldContacts } from "./features/field-contacts/routes.js";
import { handlePrograms } from "./features/programs/routes.js";
import { handlePublicInformation } from "./features/public-information/routes.js";
import { handleAnnouncements } from "./features/announcements/routes.js";
import { handleActivities } from "./features/activities/routes.js";
import { handlePublicContent } from "./features/public-content/routes.js";
import { handleApplications } from "./features/applications/routes.js";
import { handleApplicationFiles } from "./features/application-files/routes.js";
export async function createApp({
  db,
  dir = process.env.DATA_DIR || "./data",
  origin = process.env.APP_ORIGIN || "http://localhost:3000",
}) {
  const fileDir = path.resolve(dir, "uploads"),
    publicFileDir = path.resolve(dir, "public-uploads");
  await mkdir(fileDir, { recursive: true, mode: 0o700 });
  await mkdir(publicFileDir, { recursive: true, mode: 0o700 });
  const handleInformationRequest = await informationRequestHandler({
    db,
    dir,
    fail,
    text,
    upload,
  });
  const { findApp, audit } = applicationService(db),
    { activityRows } = activityRepository(db);
  const enforceRateLimit = createRateLimiter();
  const production = process.env.NODE_ENV === "production";
  if (production && !origin.startsWith("https://"))
    throw Error("Production membutuhkan APP_ORIGIN HTTPS");
  const handlers = [
    handleInformationRequest,
    handleAuth,
    handleAccounts,
    handleFieldContacts,
    handlePrograms,
    handlePublicInformation,
    handleAnnouncements,
    handleActivities,
    handlePublicContent,
    handleApplications,
    handleApplicationFiles,
  ];
  return http.createServer(async (req, res) => {
    setSecurityHeaders(res, production);
    const send = (data, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(data));
      return true;
    };
    try {
      const url = new URL(req.url, "http://internal"),
        route = url.pathname,
        method = req.method;
      if (await servePublicFile({ db, route, method, res, url, publicFileDir }))
        return;
      if (!route.startsWith("/api/")) {
        await serveStatic({ route, method, res });
        return;
      }
      const now = enforceRateLimit(req, route);
      const body = await readJson(req, { method, origin, route });
      const { cookie, session, user, auth } = await requestSession(req, {
        db,
        now,
        method,
      });
      const context = {
        db,
        route,
        method,
        body,
        user,
        auth,
        send,
        res,
        url,
        now,
        cookie,
        session,
        production,
        fileDir,
        publicFileDir,
        findApp,
        audit,
        activityRows,
      };
      for (const handler of handlers) {
        if (await handler(context)) return;
      }
      fail(404, "Endpoint tidak ditemukan");
    } catch (error) {
      if (!res.headersSent)
        send(
          {
            error: error.status
              ? error.message
              : "Kesalahan server. Silakan coba kembali.",
          },
          error.status || 500,
        );
      else res.end();
      if (!error.status)
        console.error("Server error:", error.code || error.name);
    }
  });
}
