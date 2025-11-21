/**
 * @file ProfilePhotoUpload.jsx
 * @description Drag-and-drop profile photo upload component with Cloudinary integration
 */

import React, { useState, useRef } from 'react';
import { Card, Button, Spinner, Alert } from 'react-bootstrap';
import { FaCloudUploadAlt, FaTrash, FaUser } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../services/api.js';

/**
 * @component ProfilePhotoUpload
 * @param {Object} props
 * @param {string} props.currentImage - Current profile image URL
 * @param {Function} props.onUploadSuccess - Callback after successful upload
 * @returns {JSX.Element}
 */
const ProfilePhotoUpload = ({ currentImage, onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState(currentImage);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  /**
   * @function handleDragOver
   * @description Handles drag over event
   */
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  /**
   * @function handleDragLeave
   * @description Handles drag leave event
   */
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * @function validateFile
   * @description Validates the selected file
   * @param {File} file - The file to validate
   * @returns {boolean} - Whether the file is valid
   */
  const validateFile = (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
      return false;
    }

    if (file.size > maxSize) {
      setError('Image size should not exceed 5MB');
      return false;
    }

    setError('');
    return true;
  };

  /**
   * @function handleDrop
   * @description Handles file drop event
   */
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        await uploadPhoto(file);
      }
    }
  };

  /**
   * @function handleFileSelect
   * @description Handles file selection from input
   */
  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        await uploadPhoto(file);
      }
    }
  };

  /**
   * @function uploadPhoto
   * @description Uploads photo to Cloudinary via backend
   * @param {File} file - The file to upload
   */
  const uploadPhoto = async (file) => {
    try {
      setIsUploading(true);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);

      // Upload to backend (which uploads to Cloudinary)
      const formData = new FormData();
      formData.append('photo', file);

      const response = await api.post('/auth/profile/photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Profile photo uploaded successfully!');
      setPreviewImage(response.data.imageUrl);
      
      if (onUploadSuccess) {
        onUploadSuccess(response.data.user);
      }
    } catch (error) {
      console.error('Upload error:', error);
      const message = error.response?.data?.message || 'Failed to upload photo. Please try again.';
      setError(message);
      toast.error(message);
      setPreviewImage(currentImage); // Revert to original on error
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * @function handleRemovePhoto
   * @description Removes the profile photo
   */
  const handleRemovePhoto = async () => {
    try {
      setIsUploading(true);
      await api.put('/auth/profile', { profileImage: null });
      setPreviewImage(null);
      toast.success('Profile photo removed successfully!');
      
      if (onUploadSuccess) {
        const response = await api.get('/auth/me');
        onUploadSuccess(response.data);
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to remove photo.';
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm mb-4">
      <Card.Body>
        <h5 className="fw-bold mb-3">Profile Photo</h5>
        
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <div className="d-flex flex-column align-items-center">
          {/* Preview Image */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-3 position-relative"
          >
            {previewImage ? (
              <img
                src={previewImage}
                alt="Profile"
                className="rounded-circle"
                style={{ 
                  width: '200px', 
                  height: '200px', 
                  objectFit: 'cover',
                  border: '4px solid var(--bs-primary)'
                }}
              />
            ) : (
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{
                  width: '200px',
                  height: '200px',
                  background: 'linear-gradient(135deg, var(--bs-primary), var(--bs-info))',
                  fontSize: '5rem',
                  color: 'white',
                  border: '4px solid var(--bs-primary)'
                }}
              >
                <FaUser />
              </div>
            )}
            
            {isUploading && (
              <div
                className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center rounded-circle"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <Spinner animation="border" variant="light" />
              </div>
            )}
          </motion.div>

          {/* Drag and Drop Area */}
          <motion.div
            className={`w-100 p-4 rounded text-center ${
              isDragging ? 'bg-primary bg-opacity-10 border-primary' : 'bg-light border-secondary'
            } border border-2 border-dashed mb-3`}
            style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FaCloudUploadAlt 
              size={50} 
              className={`mb-3 ${isDragging ? 'text-primary' : 'text-secondary'}`} 
            />
            <h6 className="fw-bold mb-2">
              {isDragging ? 'Drop image here' : 'Drag & Drop your photo here'}
            </h6>
            <p className="text-muted small mb-0">
              or click to browse (Max 5MB, JPEG/PNG/GIF/WebP)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={isUploading}
            />
          </motion.div>

          {/* Action Buttons */}
          <div className="d-flex gap-2">
            <Button
              variant="outline-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="d-flex align-items-center gap-2"
            >
              <FaCloudUploadAlt />
              Choose Photo
            </Button>
            
            {previewImage && (
              <Button
                variant="outline-danger"
                onClick={handleRemovePhoto}
                disabled={isUploading}
                className="d-flex align-items-center gap-2"
              >
                <FaTrash />
                Remove
              </Button>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default ProfilePhotoUpload;
