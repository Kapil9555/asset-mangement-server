import express from 'express';
import { listCustomers, createCustomer, updateCustomer } from '../controllers/customerController.js';

const router = express.Router();


router.get('/', listCustomers);   
router.post('/', createCustomer);
router.put("/:id", updateCustomer);

export default router;
