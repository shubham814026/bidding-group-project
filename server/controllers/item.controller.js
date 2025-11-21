/**
 * @file item.controller.js
 * @description Collection of Express controllers handling all auction item operations including
 * creation, retrieval, updates, and deletion.
 */

import Item from '../models/Item.js';
import Bid from '../models/Bid.js';
import cloudinary from '../utils/cloudinary.js';

/**
 * @function createItem
 * @description Creates a new auction item associated with the authenticated seller.
 * @param {import('express').Request} req - Express request object containing item payload.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const createItem = async (req, res) => {
  try {
    // All authenticated users can create auction listings

    const now = new Date();
    const defaultEndTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const placeholderImage = 'https://via.placeholder.com/800x600?text=Auction+Item';

    const generatedTitle = (req.body.title && String(req.body.title).trim().length >= 2)
      ? String(req.body.title).trim()
      : `Untitled Item ${Date.now()}`;

    // Prepare images: prefer uploaded files, else body URLs, else placeholder
    let uploadedUrls = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      const uploads = await Promise.all(
        req.files.slice(0, 5).map((file) =>
          cloudinary.uploader.upload_stream
            ? new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                  { folder: 'bidding-web/items', resource_type: 'image' },
                  (error, result) => (error ? reject(error) : resolve(result))
                );
                stream.end(file.buffer);
              })
            : cloudinary.uploader
                .upload(file.path, { folder: 'bidding-web/items', resource_type: 'image' })
        )
      );
      uploadedUrls = uploads.map((u) => u.secure_url).filter(Boolean);
    }

    const bodyImages = Array.isArray(req.body.images)
      ? req.body.images
      : (typeof req.body.images === 'string' && req.body.images.trim())
        ? [req.body.images.trim()]
        : [];

    const images = uploadedUrls.length > 0
      ? uploadedUrls
      : bodyImages.length > 0
        ? bodyImages.slice(0, 5)
        : [placeholderImage];

    // Parse dimensions if provided as JSON string (from FormData)
    let parsedDimensions;
    if (req.body.dimensions) {
      try {
        parsedDimensions = typeof req.body.dimensions === 'string' 
          ? JSON.parse(req.body.dimensions) 
          : req.body.dimensions;
      } catch (parseError) {
        console.error('Failed to parse dimensions:', parseError);
        parsedDimensions = undefined;
      }
    }

    const itemPayload = {
      title: generatedTitle,
      description: req.body.description || 'No description provided.',
      category: req.body.category || 'Other',
      images,
      sellerId: req.user._id,
      startingPrice: Number(req.body.startingPrice) || 1,
      currentPrice: Number(req.body.startingPrice) || 1,
      bidIncrement: req.body.bidIncrement ? Number(req.body.bidIncrement) : undefined,
      startTime: req.body.startTime ? new Date(req.body.startTime) : now,
      endTime: req.body.endTime ? new Date(req.body.endTime) : defaultEndTime,
      condition: req.body.condition || 'Good',
      era: req.body.era,
      authenticity: req.body.authenticity,
      dimensions: parsedDimensions
    };

    const createdItem = await Item.create(itemPayload);

    res.status(201).json({
      message: 'Auction item created successfully.',
      item: createdItem
    });
  } catch (creationError) {
    console.error('Error creating auction item:', creationError);
    if (creationError.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation failed. Please review the submitted fields.',
        errors: Object.values(creationError.errors).map((e) => ({ field: e.path, message: e.message }))
      });
    }
    res.status(500).json({ message: 'Server error while creating auction item.' });
  }
};

/**
 * @function getItems
 * @description Retrieves auction items with optional filters such as category, status, search, price range, condition, and sorting.
 * @param {import('express').Request} req - Express request object with query parameters.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const getItems = async (req, res) => {
  try {
    const { category, status, search, condition, minPrice, maxPrice, sortBy } = req.query;
    const filters = {};

    if (category) {
      filters.category = category;
    }

    if (status) {
      filters.status = status;
    }

    if (search) {
      filters.title = { $regex: search, $options: 'i' };
    }

    if (condition) {
      filters.condition = condition;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filters.currentPrice = {};
      if (minPrice) {
        filters.currentPrice.$gte = Number(minPrice);
      }
      if (maxPrice) {
        filters.currentPrice.$lte = Number(maxPrice);
      }
    }

    // Determine sort order
    let sortOption;
    
    switch (sortBy) {
      case 'endingSoon':
        sortOption = { endTime: 1 }; // Ascending order (ending soonest first)
        break;
      case 'newest':
        sortOption = { createdAt: -1 }; // Descending order
        break;
      case 'priceLowToHigh':
        sortOption = { currentPrice: 1 }; // Ascending price
        break;
      case 'priceHighToLow':
        sortOption = { currentPrice: -1 }; // Descending price
        break;
      case 'mostBids':
        sortOption = { totalBids: -1 }; // Most bids first
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const items = await Item.find(filters)
      .populate('sellerId', 'username role')
      .sort(sortOption);

    res.status(200).json({ items });
  } catch (listError) {
    console.error('Error fetching auction items:', listError);
    res.status(500).json({ message: 'Server error while retrieving auction items.' });
  }
};

/**
 * @function getItemById
 * @description Returns a single auction item along with recent bid history.
 * @param {import('express').Request} req - Express request object containing item ID param.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const getItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .populate('sellerId', 'username role')
      .populate('highestBidder', 'username');

    if (!item) {
      return res.status(404).json({ message: 'Auction item not found.' });
    }

    const recentBids = await Bid.find({ itemId: id })
      .populate('bidderId', 'username')
      .sort({ timestamp: -1 })
      .limit(20);

    res.status(200).json({ item, recentBids });
  } catch (detailError) {
    console.error('Error retrieving auction item:', detailError);
    res.status(500).json({ message: 'Server error while retrieving auction item.' });
  }
};

/**
 * @function updateItem
 * @description Allows the original seller to update an auction item. Certain fields cannot be
 * modified once the auction has started.
 * @param {import('express').Request} req - Express request object containing update data.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updatePayload = req.body;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Auction item not found.' });
    }

    if (item.sellerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to update this listing.' });
    }

    if (item.status !== 'upcoming' && item.status !== 'active') {
      return res.status(400).json({ message: 'Only active or upcoming auctions can be updated.' });
    }

    const protectedFields = ['sellerId', 'currentPrice', 'totalBids', 'highestBidder'];
    protectedFields.forEach((field) => delete updatePayload[field]);

    Object.assign(item, updatePayload);
    await item.save();

    res.status(200).json({ message: 'Auction item updated successfully.', item });
  } catch (updateError) {
    console.error('Error updating auction item:', updateError);
    res.status(500).json({ message: 'Server error while updating auction item.' });
  }
};

/**
 * @function deleteItem
 * @description Removes an auction item if no bids have been placed and the requester is the seller.
 * @param {import('express').Request} req - Express request object containing item ID param.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Auction item not found.' });
    }

    if (item.sellerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to delete this listing.' });
    }

    if (item.totalBids > 0) {
      return res.status(400).json({ message: 'Cannot delete an auction that already has bids.' });
    }

    await item.deleteOne();

    res.status(200).json({ message: 'Auction item deleted successfully.' });
  } catch (deleteError) {
    console.error('Error deleting auction item:', deleteError);
    res.status(500).json({ message: 'Server error while deleting auction item.' });
  }
};

/**
 * @function getItemPrices
 * @description Lightweight endpoint to get only current prices and bid counts for multiple items.
 * Used for real-time updates without fetching full item data.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const getItemPrices = async (req, res) => {
  try {
    const { itemIds } = req.query;
    
    if (!itemIds) {
      return res.status(400).json({ message: 'itemIds query parameter is required.' });
    }

    const ids = Array.isArray(itemIds) ? itemIds : itemIds.split(',');
    
    const items = await Item.find(
      { _id: { $in: ids } },
      { _id: 1, currentPrice: 1, totalBids: 1, highestBidder: 1, status: 1, isAuctionOver: 1 }
    ).lean();

    res.status(200).json({ prices: items });
  } catch (error) {
    console.error('Error fetching item prices:', error);
    res.status(500).json({ message: 'Server error while fetching prices.' });
  }
};
