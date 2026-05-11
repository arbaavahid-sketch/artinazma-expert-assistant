import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);

router.post("/admin-login", (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ success: false, message: "پیکربندی سرور ناقص است. ADMIN_PASSWORD تنظیم نشده است." });
  }
  if (!password || password !== adminPassword) {
    return res.status(401).json({ success: false, message: "رمز ادمین نادرست است." });
  }
  const sessionToken = process.env.ADMIN_SESSION_TOKEN;
  if (!sessionToken) {
    return res.status(503).json({ success: false, message: "پیکربندی سرور ناقص است. ADMIN_SESSION_TOKEN تنظیم نشده است." });
  }
  res.setHeader("Set-Cookie", `artin_admin=${sessionToken}; Path=/; Max-Age=86400; SameSite=Lax; HttpOnly`);
  return res.json({ success: true, message: "ورود موفق." });
});

router.post("/admin-logout", (_req: Request, res: Response) => {
  res.setHeader("Set-Cookie", "artin_admin=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly");
  return res.json({ success: true });
});

router.get("/admin-status", (req: Request, res: Response) => {
  const sessionToken = process.env.ADMIN_SESSION_TOKEN;
  if (!sessionToken) {
    return res.json({ logged_in: false });
  }
  const cookies = req.headers.cookie || "";
  const adminCookie = cookies.split(";").find((c) => c.trim().startsWith("artin_admin="));
  const token = adminCookie ? adminCookie.trim().replace("artin_admin=", "") : "";
  const isLoggedIn = token.length > 0 && token === sessionToken;
  return res.json({ logged_in: isLoggedIn });
});

export default router;
