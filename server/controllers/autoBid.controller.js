/**
 * @file autoBid.controller.js
 * @description Controllers for auto-bidding/proxy bidding functionality.
 * Allows users to set maximum bid amounts and automatically bid on their behalf.
 */

import mongoose from 'mongoose';
import AutoBid from '../models/AutoBid.js';
import Item from '../models/Item.js';
import Bid from '../models/Bid.js';

/**
 * @function setAutoBid
 * @description Creates or updates an auto-bid for a user on a specific item.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const setAutoBid = async (req, res) => {
  try {
    const { itemId, maxBidAmount } = req.body;
    const userId = req.user._id;

    // Validate item exists and is active
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Auction item not found.' });
    }

    if (item.status !== 'active' || item.isAuctionOver) {
      return res.status(400).json({ message: 'This auction is no longer active.' });
    }

    // Prevent seller from auto-bidding on their own item
    if (item.sellerId.toString() === userId.toString()) {
      return res.status(400).json({ message: 'You cannot auto-bid on your own items.' });
    }

    // Validate max bid amount
    const numericMaxBid = Number(maxBidAmount);
    const minimumBid = item.currentPrice + item.bidIncrement;

    if (!Number.isFinite(numericMaxBid) || numericMaxBid < minimumBid) {
      return res.status(400).json({
        message: `Maximum bid must be at least $${minimumBid}.`
      });
    }

    // Create or update auto-bid
    const autoBid = await AutoBid.findOneAndUpdate(
      { itemId, userId },
      {
        maxBidAmount: numericMaxBid,
        isActive: true
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({
      message: 'Auto-bid set successfully.',
      autoBid
    });
  } catch (error) {
    console.error('Error setting auto-bid:', error);
    res.status(500).json({ message: 'Server error while setting auto-bid.' });
  }
};

/**
 * @function getAutoBid
 * @description Retrieves the user's auto-bid for a specific item.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const getAutoBid = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user._id;

    const autoBid = await AutoBid.findOne({ itemId, userId });

    res.status(200).json({
      autoBid: autoBid || null
    });
  } catch (error) {
    console.error('Error retrieving auto-bid:', error);
    res.status(500).json({ message: 'Server error while retrieving auto-bid.' });
  }
};

/**
 * @function cancelAutoBid
 * @description Cancels/deactivates a user's auto-bid for a specific item.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const cancelAutoBid = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user._id;

    const autoBid = await AutoBid.findOneAndUpdate(
      { itemId, userId },
      { isActive: false },
      { new: true }
    );

    if (!autoBid) {
      return res.status(404).json({ message: 'Auto-bid not found.' });
    }

    res.status(200).json({
      message: 'Auto-bid cancelled successfully.',
      autoBid
    });
  } catch (error) {
    console.error('Error cancelling auto-bid:', error);
    res.status(500).json({ message: 'Server error while cancelling auto-bid.' });
  }
};

/**
 * @function getUserAutoBids
 * @description Gets all active auto-bids for the authenticated user.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const getUserAutoBids = async (req, res) => {
  try {
    const userId = req.user._id;

    const autoBids = await AutoBid.find({ userId, isActive: true })
      .populate('itemId', 'title currentPrice endTime status isAuctionOver')
      .sort({ createdAt: -1 });

    res.status(200).json({
      autoBids,
      totalAutoBids: autoBids.length
    });
  } catch (error) {
    console.error('Error retrieving user auto-bids:', error);
    res.status(500).json({ message: 'Server error while retrieving auto-bids.' });
  }
};

/**
 * @function processAutoBidding
 * @description Internal function called after each bid to trigger auto-bidding logic.
 * Finds active auto-bids for the item and places automatic counter-bids.
 * @param {string} itemId - The auction item ID.
 * @param {string} latestBidderId - User ID of the latest bidder.
 * @param {number} currentPrice - Current price of the item.
 * @param {object} socketIo - Socket.io instance for real-time updates.
 * @returns {Promise<void>}
 */
export const processAutoBidding = async (itemId, latestBidderId, currentPrice, socketIo) => {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    // Get item details
    const item = await Item.findById(itemId).session(session);
    if (!item || item.status !== 'active' || item.isAuctionOver) {
      await session.abortTransaction();
      session.endSession();
      return;
    }

    // Find all active auto-bids for this item, excluding the latest bidder
    const autoBids = await AutoBid.find({
      itemId,
      userId: { $ne: latestBidderId },
      isActive: true,
      maxBidAmount: { $gt: currentPrice }
    })
      .sort({ maxBidAmount: -1 })
      .session(session);

    if (autoBids.length === 0) {
      await session.commitTransaction();
      session.endSession();
      return;
    }

    // Find the highest auto-bid
    const highestAutoBid = autoBids[0];
    const nextBidAmount = currentPrice + item.bidIncrement;

    // Check if auto-bid can afford the next bid
    if (highestAutoBid.maxBidAmount >= nextBidAmount) {
      // Place automatic bid
      const autoBidDocument = await Bid.create([{
        itemId,
        bidderId: highestAutoBid.userId,
        bidAmount: nextBidAmount,
        previousPrice: currentPrice,
        isAutoBid: true
      }], { session });

      // Update item
      item.currentPrice = nextBidAmount;
      item.highestBidder = highestAutoBid.userId;
      item.totalBids += 1;
      item.updatedAt = new Date();
      await item.save({ session });

      // Update auto-bid current amount
      highestAutoBid.currentAutoBidAmount = nextBidAmount;
      await highestAutoBid.save({ session });

      await session.commitTransaction();

      // Emit socket event for auto-bid
      const populatedBid = await Bid.findById(autoBidDocument[0]._id)
        .populate('bidderId', 'username');

      const autoBidData = {
        itemId,
        newPrice: nextBidAmount,
        previousPrice: currentPrice,
        bidderId: highestAutoBid.userId,
        bidderUsername: populatedBid.bidderId.username,
        totalBids: item.totalBids,
        bidIncrement: item.bidIncrement,
        timestamp: autoBidDocument[0].timestamp,
        bidId: autoBidDocument[0]._id,
        isAutoBid: true
      };

      // Emit to specific auction room
      socketIo.to(`auction_${itemId}`).emit('new-bid-placed', autoBidData);
      
      // Emit globally for all pages
      socketIo.emit('new-bid-placed', autoBidData);

      socketIo.to(`auction_${itemId}`).emit('auction-alert', {
        itemId,
        message: `Auto-bid placed by ${populatedBid.bidderId.username}: $${nextBidAmount}`,
        type: 'auto-bid',
        timestamp: new Date()
      });
    } else {
      // Auto-bid max exceeded, deactivate it
      highestAutoBid.isActive = false;
      await highestAutoBid.save({ session });
      await session.commitTransaction();

      socketIo.to(`auction_${itemId}`).emit('auction-alert', {
        itemId,
        message: 'Auto-bid maximum reached.',
        type: 'info',
        timestamp: new Date()
      });
    }

    session.endSession();
  } catch (error) {
    console.error('Error processing auto-bidding:', error);
  }
};
