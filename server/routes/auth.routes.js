/**
 * @file auth.routes.js
 * @description Express router mapping authentication-related endpoints to controller functions.
 */

import { Router } from 'express';
import multer from 'multer';
import { registerUser, loginUser, logoutUser, getCurrentUser, updateUserProfile, uploadProfilePhoto } from '../controllers/auth.controller.js';
import protectRoute from '../middleware/protectRoute.js';
import { validateUserRegistration, validateUserLogin } from '../middleware/validators.js';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

router.post('/register', validateUserRegistration, registerUser);
router.post('/login', validateUserLogin, loginUser);
router.post('/logout', protectRoute, logoutUser);
router.get('/me', protectRoute, getCurrentUser);
router.put('/profile', protectRoute, updateUserProfile);
router.post('/profile/photo', protectRoute, upload.single('photo'), uploadProfilePhoto);

export default router;
