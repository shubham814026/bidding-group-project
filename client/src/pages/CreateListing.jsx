/**
 * @file CreateListing.jsx
 * @description Form for sellers to create new auction listings with a two-step wizard interface.
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Row, Col, Button, ProgressBar, Badge } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { FaInfoCircle, FaDollarSign, FaImage, FaCheckCircle, FaArrowRight, FaArrowLeft } from 'react-icons/fa';
import api from '../services/api.js';
import { buttonHoverVariants } from '../utils/animationVariants.js';

/**
 * @component CreateListing
 * @returns {JSX.Element}
 */
const CreateListing = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isSubmitting }
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      title: '',
      description: '',
      category: 'Art',
      images: '',
      startingPrice: 100,
      bidIncrement: 10,
      startTime: '',
      endTime: '',
      condition: 'Excellent',
      reservePrice: '',
      dimensionsHeight: '',
      dimensionsWidth: '',
      dimensionsDepth: '',
      dimensionsWeight: '',
      dimensionsUnit: 'inches',
      weightUnit: 'kg'
    }
  });

  /**
   * @function onSubmit
   * @description Handles listing creation form submission.
   * @param {Record<string, string>} formData - Raw form values captured by react-hook-form.
   * @returns {Promise<void>}
   */
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);

  const selectedCategory = watch('category');

  /**
   * @function handleNext
   * @description Validates current step fields and moves to next step.
   */
  const handleNext = async () => {
    const step1Fields = ['title', 'description', 'category'];
    if (selectedCategory === 'Other') step1Fields.push('customCategory');
    
    const isValid = await trigger(step1Fields);
    if (isValid) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /**
   * @function handlePrevious
   * @description Returns to previous step.
   */
  const handlePrevious = () => {
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * @function handleFileChange
   * @description Handles image file selection and preview generation.
   */
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setSelectedFiles(files);
    
    // Generate previews
    const previews = files.map(file => URL.createObjectURL(file));
    setPreviewImages(previews);
  };

  const onSubmit = async (formData) => {
    const form = new FormData();
    form.append('title', formData.title);
    form.append('description', formData.description);
    const categoryValue = formData.category === 'Other' && formData.customCategory
      ? String(formData.customCategory).trim()
      : formData.category;
    form.append('category', categoryValue);
    if (formData.startTime) form.append('startTime', formData.startTime);
    const urlList = formData.images
      ? formData.images.split(',').map((u) => u.trim()).filter(Boolean)
      : [];
    urlList.forEach((u) => form.append('images', u));
    form.append('startingPrice', String(Number(formData.startingPrice)));
    form.append('bidIncrement', String(Number(formData.bidIncrement)));
    
    // EndTime is required - always append it
    if (formData.endTime) {
      form.append('endTime', formData.endTime);
    } else {
      // This should never happen due to validation, but provide a helpful error
      toast.error('End time is required. Please select an auction end time.');
      return;
    }
    
    form.append('condition', formData.condition);
    if (formData.reservePrice) form.append('reservePrice', String(Number(formData.reservePrice)));
    
    // Build dimensions object if any dimension values are provided
    const hasDimensions = formData.dimensionsHeight || formData.dimensionsWidth || 
                          formData.dimensionsDepth || formData.dimensionsWeight;
    
    if (hasDimensions) {
      const dimensions = {
        unit: formData.dimensionsUnit || 'inches',
        weightUnit: formData.weightUnit || 'kg'
      };
      
      if (formData.dimensionsHeight) dimensions.height = Number(formData.dimensionsHeight);
      if (formData.dimensionsWidth) dimensions.width = Number(formData.dimensionsWidth);
      if (formData.dimensionsDepth) dimensions.depth = Number(formData.dimensionsDepth);
      if (formData.dimensionsWeight) dimensions.weight = Number(formData.dimensionsWeight);
      
      form.append('dimensions', JSON.stringify(dimensions));
    }

    selectedFiles.forEach((file) => form.append('images', file));

    try {
      const response = await api.post('/items', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Auction listing created successfully.');
      navigate(`/items/${response.data.item._id}`);
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to create listing.';
      
      // Log detailed validation errors if available
      if (error.response?.data?.errors) {
        console.error('Validation errors:', error.response.data.errors);
        const errorDetails = error.response.data.errors
          .map(err => `${err.path || err.field}: ${err.msg || err.message}`)
          .join(', ');
        toast.error(`${message} Details: ${errorDetails}`);
      } else {
        toast.error(message);
      }
      
      console.error('Form submission error:', error.response?.data);
    }
  };

  return (
    <div className="container py-4">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-4"
      >
        <h2 className="fw-bold mb-2">Create Your Auction Listing</h2>
        <p className="text-muted">List your antique item in just two simple steps</p>
      </motion.div>

      {/* Progress Bar */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body className="py-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center">
              <div className={`rounded-circle d-flex align-items-center justify-content-center ${currentStep >= 1 ? 'bg-primary' : 'text-muted'}`} 
                   style={{ width: '40px', height: '40px', backgroundColor: currentStep >= 1 ? '' : 'var(--background-secondary)', color: currentStep >= 1 ? 'var(--text-inverse)' : '' }}>
                {currentStep > 1 ? <FaCheckCircle /> : <FaInfoCircle />}
              </div>
              <div className="ms-3">
                <div className="fw-bold">Basic Details</div>
                <small className="text-muted">Item information</small>
              </div>
            </div>
            <div className="flex-grow-1 mx-3">
              <ProgressBar 
                now={currentStep === 1 ? 50 : 100} 
                variant={currentStep === 2 ? "success" : "primary"}
                style={{ height: '4px' }}
              />
            </div>
            <div className="d-flex align-items-center">
              <div className={`rounded-circle d-flex align-items-center justify-content-center ${currentStep === 2 ? 'bg-primary' : 'text-muted'}`} 
                   style={{ width: '40px', height: '40px', backgroundColor: currentStep === 2 ? '' : 'var(--background-secondary)', color: currentStep === 2 ? 'var(--text-inverse)' : '' }}>
                <FaDollarSign />
              </div>
              <div className="ms-3">
                <div className="fw-bold">Pricing & Details</div>
                <small className="text-muted">Set your terms</small>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Form Card */}
      <Card className="border-0 shadow">
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit(onSubmit)}>
            <AnimatePresence mode="wait">
              {/* STEP 1: Basic Details */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="d-flex align-items-center mb-4">
                    <FaInfoCircle className="text-primary me-2" size={24} />
                    <h4 className="mb-0 fw-bold">Step 1: Basic Information</h4>
                  </div>
                  
                  <Row className="g-4">
                    <Col md={12}>
                      <Form.Group controlId="listingTitle">
                        <Form.Label className="fw-semibold">
                          Item Title <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="e.g., Victorian Oak Rocking Chair"
                          className="py-2"
                          {...register('title', { required: 'Title is required.' })}
                          isInvalid={Boolean(errors.title)}
                        />
                        <Form.Control.Feedback type="invalid">{errors.title?.message}</Form.Control.Feedback>
                        <Form.Text className="text-muted">
                          Make it descriptive and eye-catching
                        </Form.Text>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="listingCategory">
                        <Form.Label className="fw-semibold">
                          Category <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Select className="py-2" {...register('category')}>
                          <option value="Furniture">Furniture</option>
                          <option value="Jewelry">Jewelry</option>
                          <option value="Art">Art</option>
                          <option value="Collectibles">Collectibles</option>
                          <option value="Vintage Electronics">Vintage Electronics</option>
                          <option value="Antique Books">Antique Books</option>
                          <option value="Pottery">Pottery</option>
                          <option value="Watches">Watches</option>
                          <option value="Sculptures">Sculptures</option>
                          <option value="Textiles">Textiles</option>
                          <option value="Musical Instruments">Musical Instruments</option>
                          <option value="Other">Other</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {selectedCategory === 'Other' && (
                      <Col md={6}>
                        <Form.Group controlId="listingCustomCategory">
                          <Form.Label className="fw-semibold">
                            Specify Category <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Enter category name"
                            className="py-2"
                            {...register('customCategory', { required: 'Please enter a category name.' })}
                            isInvalid={Boolean(errors.customCategory)}
                          />
                          <Form.Control.Feedback type="invalid">{errors.customCategory?.message}</Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                    )}

                    <Col md={selectedCategory === 'Other' ? 12 : 6}>
                      <Form.Group controlId="listingCondition">
                        <Form.Label className="fw-semibold">Condition</Form.Label>
                        <Form.Select className="py-2" {...register('condition')}>
                          <option value="Excellent">Excellent - Like new</option>
                          <option value="Very Good">Very Good - Minor wear</option>
                          <option value="Good">Good - Some wear</option>
                          <option value="Fair">Fair - Noticeable wear</option>
                          <option value="Poor">Poor - Significant wear</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col xs={12}>
                      <Form.Group controlId="listingDescription">
                        <Form.Label className="fw-semibold">
                          Description <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={5}
                          placeholder="Provide a detailed description including history, provenance, condition, and unique features..."
                          className="py-2"
                          {...register('description', { required: 'Description is required.' })}
                          isInvalid={Boolean(errors.description)}
                        />
                        <Form.Control.Feedback type="invalid">{errors.description?.message}</Form.Control.Feedback>
                        <Form.Text className="text-muted">
                          Include all relevant details that would interest potential buyers
                        </Form.Text>
                      </Form.Group>
                    </Col>

                    <Col xs={12}>
                      <div className="d-flex align-items-center mb-3">
                        <FaImage className="text-primary me-2" />
                        <Form.Label className="fw-semibold mb-0">Item Images</Form.Label>
                      </div>
                      
                      <Form.Group controlId="listingImageFiles" className="mb-3">
                        <div className="border-2 border-dashed rounded p-4 text-center" style={{ backgroundColor: 'var(--background-secondary)' }}>
                          <FaImage size={40} className="text-muted mb-2" />
                          <Form.Control
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleFileChange}
                            className="mb-2"
                            required={previewImages.length === 0}
                          />
                          <small className="text-muted d-block">
                            <span className="text-danger">*</span> Upload up to 5 high-quality images (JPG, PNG) - Required
                          </small>
                        </div>
                      </Form.Group>

                      {previewImages.length > 0 && (
                        <div className="d-flex gap-2 flex-wrap mb-3">
                          {previewImages.map((preview, idx) => (
                            <div key={idx} className="position-relative">
                              <img 
                                src={preview} 
                                alt={`Preview ${idx + 1}`}
                                className="rounded border"
                                style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                              />
                              <Badge 
                                bg="success" 
                                className="position-absolute top-0 end-0 m-1"
                              >
                                {idx + 1}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      <Form.Group controlId="listingImages">
                        <Form.Label className="fw-semibold">Or enter image URLs</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg"
                          className="py-2"
                          {...register('images')}
                          isInvalid={Boolean(errors.images)}
                        />
                        <Form.Text className="text-muted">
                          Separate multiple URLs with commas
                        </Form.Text>
                      </Form.Group>
                    </Col>

                    <Col xs={12} className="text-end mt-4">
                      <motion.div 
                        variants={buttonHoverVariants} 
                        whileHover="hover" 
                        whileTap="tap"
                        className="d-inline-block"
                      >
                        <Button 
                          variant="primary" 
                          size="lg"
                          onClick={handleNext}
                          className="px-5"
                        >
                          Continue to Pricing <FaArrowRight className="ms-2" />
                        </Button>
                      </motion.div>
                    </Col>
                  </Row>
                </motion.div>
              )}

              {/* STEP 2: Pricing & Advanced Details */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="d-flex align-items-center mb-4">
                    <FaDollarSign className="text-success me-2" size={24} />
                    <h4 className="mb-0 fw-bold">Step 2: Pricing & Auction Details</h4>
                  </div>

                  <Row className="g-4">
                    {/* Pricing Section */}
                    <Col xs={12}>
                      <div className="p-3 rounded mb-3" style={{ backgroundColor: 'var(--background-secondary)' }}>
                        <h5 className="fw-bold mb-3">💰 Pricing</h5>
                        <Row className="g-3">
                          <Col md={4}>
                            <Form.Group controlId="listingStartingPrice">
                              <Form.Label className="fw-semibold">
                                Starting Price ($) <span className="text-danger">*</span>
                              </Form.Label>
                              <Form.Control
                                type="number"
                                min={1}
                                step={1}
                                className="py-2"
                                {...register('startingPrice', { required: 'Starting price is required.' })}
                                isInvalid={Boolean(errors.startingPrice)}
                              />
                              <Form.Control.Feedback type="invalid">{errors.startingPrice?.message}</Form.Control.Feedback>
                            </Form.Group>
                          </Col>

                          <Col md={4}>
                            <Form.Group controlId="listingBidIncrement">
                              <Form.Label className="fw-semibold">
                                Bid Increment ($) <span className="text-danger">*</span>
                              </Form.Label>
                              <Form.Control
                                type="number"
                                min={1}
                                step={1}
                                className="py-2"
                                {...register('bidIncrement', { required: 'Bid increment is required.' })}
                                isInvalid={Boolean(errors.bidIncrement)}
                              />
                              <Form.Control.Feedback type="invalid">{errors.bidIncrement?.message}</Form.Control.Feedback>
                            </Form.Group>
                          </Col>

                          <Col md={4}>
                            <Form.Group controlId="listingReservePrice">
                              <Form.Label className="fw-semibold">Reserve Price ($)</Form.Label>
                              <Form.Control 
                                type="number" 
                                min={0} 
                                step={1} 
                                className="py-2"
                                placeholder="Optional"
                                {...register('reservePrice')} 
                              />
                              <Form.Text className="text-muted">Minimum acceptable price</Form.Text>
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    {/* Auction Timing */}
                    <Col xs={12}>
                      <div className="p-3 rounded mb-3" style={{ backgroundColor: 'var(--background-secondary)' }}>
                        <h5 className="fw-bold mb-3">⏰ Auction Schedule</h5>
                        <Row className="g-3">
                          <Col md={6}>
                            <Form.Group controlId="listingStartTime">
                              <Form.Label className="fw-semibold">Start Time</Form.Label>
                              <Form.Control
                                type="datetime-local"
                                className="py-2"
                                {...register('startTime')}
                                isInvalid={Boolean(errors.startTime)}
                              />
                              <Form.Text className="text-muted">Leave empty to start immediately</Form.Text>
                            </Form.Group>
                          </Col>

                          <Col md={6}>
                            <Form.Group controlId="listingEndTime">
                              <Form.Label className="fw-semibold">
                                End Time <span className="text-danger">*</span>
                              </Form.Label>
                              <Form.Control
                                type="datetime-local"
                                className="py-2"
                                {...register('endTime', {
                                  required: 'Auction end time is required.',
                                  validate: (value) => {
                                    if (!value) {
                                      return 'Please select an end time for the auction.';
                                    }
                                    const start = watch('startTime');
                                    const now = new Date();
                                    const endDate = new Date(value);
                                    
                                    if (endDate <= now) {
                                      return 'End time must be in the future.';
                                    }
                                    
                                    if (start && endDate <= new Date(start)) {
                                      return 'End time must be after the start time.';
                                    }
                                    return true;
                                  }
                                })}
                                isInvalid={Boolean(errors.endTime)}
                              />
                              <Form.Control.Feedback type="invalid">{errors.endTime?.message}</Form.Control.Feedback>
                              <Form.Text className="text-muted">When should the auction end?</Form.Text>
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    {/* Dimensions */}
                    <Col xs={12}>
                      <div className="p-3 rounded" style={{ backgroundColor: 'var(--background-secondary)' }}>
                        <h5 className="fw-bold mb-3">📏 Dimensions (Optional)</h5>
                        <Row className="g-3">
                          <Col md={3}>
                            <Form.Group controlId="listingDimensionsUnit">
                              <Form.Label className="fw-semibold">Length Unit</Form.Label>
                              <Form.Select className="py-2" {...register('dimensionsUnit')}>
                                <option value="inches">Inches</option>
                                <option value="cm">Centimeters</option>
                                <option value="feet">Feet</option>
                                <option value="meters">Meters</option>
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group controlId="listingHeight">
                              <Form.Label className="fw-semibold">Height</Form.Label>
                              <Form.Control 
                                type="number" 
                                min={0} 
                                step="0.01" 
                                className="py-2"
                                placeholder="0"
                                {...register('dimensionsHeight')} 
                              />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group controlId="listingWidth">
                              <Form.Label className="fw-semibold">Width</Form.Label>
                              <Form.Control 
                                type="number" 
                                min={0} 
                                step="0.01" 
                                className="py-2"
                                placeholder="0"
                                {...register('dimensionsWidth')} 
                              />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group controlId="listingDepth">
                              <Form.Label className="fw-semibold">Depth</Form.Label>
                              <Form.Control 
                                type="number" 
                                min={0} 
                                step="0.01" 
                                className="py-2"
                                placeholder="0"
                                {...register('dimensionsDepth')} 
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                        
                        <hr className="my-3" />
                        
                        <Row className="g-3">
                          <Col md={6}>
                            <Form.Group controlId="listingWeightUnit">
                              <Form.Label className="fw-semibold">Weight Unit</Form.Label>
                              <Form.Select className="py-2" {...register('weightUnit')}>
                                <option value="kg">Kilograms (kg)</option>
                                <option value="lbs">Pounds (lbs)</option>
                                <option value="g">Grams (g)</option>
                                <option value="oz">Ounces (oz)</option>
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group controlId="listingWeight">
                              <Form.Label className="fw-semibold">Weight</Form.Label>
                              <Form.Control 
                                type="number" 
                                min={0} 
                                step="0.01" 
                                className="py-2"
                                placeholder="0"
                                {...register('dimensionsWeight')} 
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    {/* Action Buttons */}
                    <Col xs={12} className="d-flex justify-content-between mt-4">
                      <motion.div 
                        variants={buttonHoverVariants} 
                        whileHover="hover" 
                        whileTap="tap"
                      >
                        <Button 
                          variant="outline-secondary" 
                          size="lg"
                          onClick={handlePrevious}
                          className="px-4"
                        >
                          <FaArrowLeft className="me-2" /> Back
                        </Button>
                      </motion.div>

                      <motion.div 
                        variants={buttonHoverVariants} 
                        whileHover="hover" 
                        whileTap="tap"
                      >
                        <Button 
                          type="submit" 
                          variant="success" 
                          size="lg"
                          disabled={isSubmitting}
                          className="px-5"
                        >
                          {isSubmitting ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <FaCheckCircle className="me-2" /> Create Listing
                            </>
                          )}
                        </Button>
                      </motion.div>
                    </Col>
                  </Row>
                </motion.div>
              )}
            </AnimatePresence>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default CreateListing;
