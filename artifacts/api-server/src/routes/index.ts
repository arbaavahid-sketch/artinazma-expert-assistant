import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);

router.post("/api/admin-login", (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD || "artin-admin-2024";
  if (!password || password !== adminPassword) {
    return res.status(401).json({ success: false, message: "رمز ادمین نادرست است." });
  }
  const sessionToken = process.env.ADMIN_SESSION_TOKEN || `artin-session-${Date.now()}`;
  res.setHeader("Set-Cookie", `artin_admin=${sessionToken}; Path=/; Max-Age=86400; SameSite=Lax; HttpOnly`);
  return res.json({ success: true, message: "ورود موفق." });
});

router.post("/api/admin-logout", (_req: Request, res: Response) => {
  res.setHeader("Set-Cookie", "artin_admin=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly");
  return res.json({ success: true });
});

router.get("/api/admin-status", (req: Request, res: Response) => {
  const cookies = req.headers.cookie || "";
  const adminCookie = cookies.split(";").find((c) => c.trim().startsWith("artin_admin="));
  const token = adminCookie ? adminCookie.trim().replace("artin_admin=", "") : "";
  const sessionToken = process.env.ADMIN_SESSION_TOKEN || "";
  const isLoggedIn = token.length > 0 && (sessionToken ? token === sessionToken : true);
  return res.json({ logged_in: isLoggedIn });
});

export default router;
