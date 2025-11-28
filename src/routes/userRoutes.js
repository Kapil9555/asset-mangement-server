// routes/userRoutes.js
import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/userController.js';
// import { protect, admin } from '../middleware/authMiddleware.js'; // if you have auth

const router = express.Router();

router
  .route('/')
  .get(getUsers)      
  .post(createUser); 

router
  .route('/:id')
  .get(getUserById)  
  .put(updateUser)   
  .delete(deleteUser);
export default router;
