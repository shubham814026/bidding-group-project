/**
 * @file ImageGallery.jsx
 * @description Bootstrap carousel with modal lightbox for full-size image viewing.
 */

import React, { useState } from 'react';
import { Carousel, Image, Modal } from 'react-bootstrap';

/**
 * @component ImageGallery
 * @param {{ images: string[], title: string }} props - Component props.
 * @returns {JSX.Element}
 */
const ImageGallery = ({ images = [], title }) => {
  const [showModal, setShowModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images.length) {
    return <p className="text-muted">No images available for this item.</p>;
  }

  const handleImageClick = (index) => {
    setCurrentIndex(index);
    setShowModal(true);
  };

  const handleClose = () => setShowModal(false);

  return (
    <>
      <Carousel variant="dark" activeIndex={currentIndex} onSelect={(selectedIndex) => setCurrentIndex(selectedIndex)}>
        {images.map((imageUrl, index) => (
          <Carousel.Item key={imageUrl}>
            <Image
              src={imageUrl}
              alt={`${title} preview ${index + 1}`}
              className="w-100"
              style={{ 
                maxHeight: '420px', 
                objectFit: 'cover',
                cursor: 'pointer'
              }}
              rounded
              onClick={() => handleImageClick(index)}
            />
          </Carousel.Item>
        ))}
      </Carousel>

      <Modal show={showModal} onHide={handleClose} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 bg-dark">
          <Carousel activeIndex={currentIndex} onSelect={(selectedIndex) => setCurrentIndex(selectedIndex)} variant="dark">
            {images.map((imageUrl, index) => (
              <Carousel.Item key={imageUrl}>
                <Image
                  src={imageUrl}
                  alt={`${title} full size ${index + 1}`}
                  className="w-100"
                  style={{ 
                    maxHeight: '80vh', 
                    objectFit: 'contain'
                  }}
                />
              </Carousel.Item>
            ))}
          </Carousel>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default ImageGallery;
