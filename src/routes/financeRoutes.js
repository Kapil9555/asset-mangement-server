import express from 'express';
import { createContract, deleteContract, getContracts, updateContract } from '../controllers/financeController.js';

const router = express.Router();

/* Contracts */
router.get('/contracts', getContracts);
router.post('/contracts', createContract);
router.put('/contracts/:id', updateContract);
router.delete('/contracts/:id', deleteContract);

// /* Invoices */
// router.get('/invoices', getInvoices);
// router.put('/invoices/:id', updateInvoice);

// /* Depreciation */
// router.post('/depreciation/preview', previewDepreciation);
// router.post('/depreciation/run', runDepreciation);

// /* Recovery */
// router.get('/recovery/summary', getRecoverySummary);
// router.get('/recovery/:assetId', getRecoveryByAsset);

export default router;
