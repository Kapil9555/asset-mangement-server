// routes/dashboardRoutes.js
import express from "express";
import { getDashboard } from "../controllers/dashboardController.js";
// import { protect, admin } from "../middleware/authMiddleware.js"; // if you gate it

const router = express.Router();

// GET /api/dashboard
router.get("/", /* protect, admin, */ getDashboard);

export default router;
