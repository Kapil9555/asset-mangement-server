import express from 'express';
import { generateAzureUploadUrl } from '../controllers/uploadController.js';

const router = express.Router();

router.post('/azure-presign', generateAzureUploadUrl);

export default router;
