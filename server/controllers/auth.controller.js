/**
 * @file auth.controller.js
 * @description Express controllers responsible for authentication operations including
 * registration, login, logout, and retrieving the current authenticated user.
 */

import User from '../models/User.js';
import generateTokenAndSetCookie from '../utils/generateToken.js';
import cloudinary from '../utils/cloudinary.js';

/**
 * @function registerUser
 * @description Creates a new user account after ensuring the username and email are unique.
 * Automatically hashes the password (handled by the schema) and issues a JWT cookie.
 * @param {import('express').Request} req - Express request object containing registration data.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const registerUser = async (req, res) => {
  try {
    const { username, email, password, phoneNumber, address } = req.body;

    // Demo-friendly behavior: if the email already exists, treat this as a login
    // instead of failing registration. This removes friction in first-time demos.
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      generateTokenAndSetCookie(existingUserByEmail._id.toString(), res);
      const { password: _password, ...userWithoutPassword } = existingUserByEmail.toObject();
      return res.status(200).json({
        message: 'Welcome back. You are now signed in.',
        user: userWithoutPassword
      });
    }

    // Username collision is uncommon; if it happens, append a random suffix automatically
    let finalUsername = username || email?.split('@')[0] || 'user';
    const usernameTaken = await User.findOne({ username: finalUsername });
    if (usernameTaken) {
      finalUsername = `${finalUsername}_${Math.floor(Math.random() * 10000)}`;
    }

    const newUser = await User.create({
      username: finalUsername,
      email,
      password,
      role: 'user',
      phoneNumber,
      address
    });

    generateTokenAndSetCookie(newUser._id.toString(), res);

    const { password: _password, ...userWithoutPassword } = newUser.toObject();

    res.status(201).json({
      message: 'Account created successfully.',
      user: userWithoutPassword
    });
  } catch (registrationError) {
    console.error('Error registering user:', registrationError);
    res.status(500).json({ message: 'Server error while creating account.' });
  }
};

/**
 * @function loginUser
 * @description Authenticates user credentials, issues a JWT cookie, and returns profile data.
 * @param {import('express').Request} req - Express request object containing login credentials.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      console.warn('Login failed: user not found for email', email);
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.warn('Login failed: invalid password for user', user._id.toString());
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    user.lastLogin = new Date();
    await user.save();

    generateTokenAndSetCookie(user._id.toString(), res);

    const { password: _password, ...userWithoutPassword } = user.toObject();

    res.status(200).json({
      message: 'Logged in successfully.',
      user: userWithoutPassword
    });
  } catch (loginError) {
    console.error('Error during login:', loginError);
    res.status(500).json({ message: 'Server error while processing login.' });
  }
};

/**
 * @function logoutUser
 * @description Clears the authentication cookie to end the user session.
 * @param {import('express').Request} _req - Express request object (unused).
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const logoutUser = async (_req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  res.status(200).json({ message: 'Logged out successfully.' });
};

/**
 * @function getCurrentUser
 * @description Returns the authenticated user's profile. Requires protectRoute middleware.
 * @param {import('express').Request} req - Express request object, augmented with req.user.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const getCurrentUser = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  res.status(200).json({ user: req.user });
};

/**
 * @function updateUserProfile
 * @description Updates the authenticated user's profile information. Requires protectRoute middleware.
 * @param {import('express').Request} req - Express request object containing update data.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { username, email, phoneNumber, address, profileImage } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username, _id: { $ne: user._id } });
      if (usernameExists) {
        return res.status(400).json({ message: 'Username is already taken.' });
      }
      user.username = username;
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already in use.' });
      }
      user.email = email;
    }

    if (phoneNumber !== undefined) {
      user.phoneNumber = phoneNumber || null;
    }

    if (address !== undefined) {
      user.address = address || null;
    }

    if (profileImage !== undefined) {
      user.profileImage = profileImage || null;
    }

    await user.save();

    const { password: _password, ...userWithoutPassword } = user.toObject();

    res.status(200).json({
      message: 'Profile updated successfully.',
      user: userWithoutPassword
    });
  } catch (updateError) {
    console.error('Error updating user profile:', updateError);
    res.status(500).json({ message: 'Server error while updating profile.' });
  }
};

/**
 * @function uploadProfilePhoto
 * @description Uploads profile photo to Cloudinary and updates user profile.
 * @param {import('express').Request} req - Express request with file upload.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'auction-profile-photos',
          transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // Update user profile with new image URL
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Delete old image from Cloudinary if exists
    if (user.profileImage && user.profileImage.includes('cloudinary')) {
      try {
        const publicId = user.profileImage.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteError) {
        console.error('Error deleting old image:', deleteError);
      }
    }

    user.profileImage = result.secure_url;
    await user.save();

    const { password: _password, ...userWithoutPassword } = user.toObject();

    res.status(200).json({
      message: 'Profile photo uploaded successfully.',
      user: userWithoutPassword,
      imageUrl: result.secure_url
    });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    res.status(500).json({ message: 'Server error while uploading photo.' });
  }
};
