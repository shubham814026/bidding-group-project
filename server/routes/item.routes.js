/**
 * @file item.routes.js
 * @description Express router defining auction item endpoints.
 */

import { Router } from 'express';
import multer from 'multer';
import {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
  getItemPrices
} from '../controllers/item.controller.js';
import protectRoute from '../middleware/protectRoute.js';
import { validateItemPayload, validateMongoIdParam } from '../middleware/validators.js';

const router = Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB per file

router.get('/', getItems);
router.get('/prices/batch', getItemPrices);
router.post('/', protectRoute, upload.array('images', 5), validateItemPayload, createItem);
router.get('/:id', validateMongoIdParam, getItemById);
router.put('/:id', protectRoute, validateMongoIdParam, validateItemPayload, updateItem);
router.delete('/:id', protectRoute, validateMongoIdParam, deleteItem);

export default router;
