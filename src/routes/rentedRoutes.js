import express from "express";
import {
  createRentedProduct,
  getRentedProducts,
  getRentedProductById,
  updateRentedProduct,
  deleteRentedProduct,
} from "../controllers/rentedController.js";

// Optionally add auth middleware
// import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

// List + Create
router
  .route("/")
  // .get(protect, getRentedProducts)
  // .post(protect, createRentedProduct);
  .get(getRentedProducts)
  .post(createRentedProduct);

// Read + Update + Delete
router
  .route("/:id")
  // .get(protect, getRentedProductById)
  // .put(protect, updateRentedProduct)
  // .delete(protect, admin, deleteRentedProduct);
  .get(getRentedProductById)
  .put(updateRentedProduct)
  .delete(deleteRentedProduct);

export default router;
