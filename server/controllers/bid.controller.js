/**
 * @file bid.controller.js
 * @description Controllers handling bid placement and history retrieval. Integrates tightly
 * with Socket.io to broadcast real-time updates to connected clients.
 */

import mongoose from 'mongoose';
import Bid from '../models/Bid.js';
import Item from '../models/Item.js';
import User from '../models/User.js';
import { sendEmail } from '../utils/mailer.js';
import { processAutoBidding } from './autoBid.controller.js';

/**
 * @function placeBid
 * @description Validates bid input, ensures auction rules are respected, stores the bid,
 * updates the associated item, and emits Socket.io events for real-time updates.
 * @param {import('express').Request} req - Express request object containing bid data.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const placeBid = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
  const { itemId, bidAmount } = req.body;
    const bidderId = req.user._id;
  const numericBidAmount = Number(bidAmount);

  const auctionItem = await Item.findById(itemId).session(session);

    if (!auctionItem) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Auction item not found.' });
    }

    if (auctionItem.status !== 'active' || auctionItem.isAuctionOver) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'This auction is no longer active.' });
    }

    if (new Date() >= new Date(auctionItem.endTime)) {
      auctionItem.isAuctionOver = true;
      auctionItem.status = 'ended';
      await auctionItem.save({ session });
      await session.commitTransaction();
      return res.status(400).json({ message: 'Auction has already ended.' });
    }

    // Capture previous highest bidder for outbid notification
    const previousHighestBidder = auctionItem.highestBidder ? auctionItem.highestBidder.toString() : null;

    // Debug: log identities involved in self-bid check
    console.log('Bidder vs Seller check:', {
      bidderId: bidderId?.toString(),
      sellerId: auctionItem.sellerId?.toString(),
      disableAuth: process.env.DISABLE_AUTH
    });

    // In demo mode, skip self-bid restriction because the demo user ID is reused
    if (process.env.DISABLE_AUTH !== 'true' && auctionItem.sellerId.toString() === bidderId.toString()) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Sellers cannot bid on their own items.' });
    }

    const minimumBidAmount = auctionItem.currentPrice + auctionItem.bidIncrement;

    if (!Number.isFinite(numericBidAmount) || numericBidAmount < minimumBidAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Minimum bid is $${minimumBidAmount}.`
      });
    }

    // Prevent same user from bidding the exact same amount (likely double submission)
    if (auctionItem.highestBidder && 
        auctionItem.highestBidder.toString() === bidderId.toString() && 
        numericBidAmount === minimumBidAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'You are already the highest bidder. Please bid a higher amount.'
      });
    }

    const bidDocument = await Bid.create([
      {
        itemId,
        bidderId,
        bidAmount: numericBidAmount,
        previousPrice: auctionItem.currentPrice,
        ipAddress: req.ip
      }
    ], { session });

  auctionItem.currentPrice = numericBidAmount;
    auctionItem.highestBidder = bidderId;
    auctionItem.totalBids += 1;
    auctionItem.updatedAt = new Date();
    await auctionItem.save({ session });

    await session.commitTransaction();

    const populatedBid = await Bid.findById(bidDocument[0]._id)
      .populate('bidderId', 'username')
      .populate('itemId', 'title');

    const broadcastData = {
      itemId,
      newPrice: numericBidAmount,
      previousPrice: populatedBid.previousPrice,
      bidderId: bidderId,
      bidderUsername: populatedBid.bidderId.username,
      totalBids: auctionItem.totalBids,
      bidIncrement: auctionItem.bidIncrement,
      timestamp: populatedBid.timestamp,
      bidId: populatedBid._id
    };

    const socketIo = req.app.get('socketio');
    socketIo.to(`auction_${itemId}`).emit('new-bid-placed', broadcastData);
    
    // Emit globally (for users on listings pages who aren't in a specific room)
    socketIo.emit('new-bid-placed', broadcastData);
    
    console.log('✅ Bid update emitted to all clients');
    
    // Notify room about new bid for chat notifications (include itemId for filtering client-side)
    socketIo.to(`auction_${itemId}`).emit('auction-alert', {
      itemId,
      message: `${populatedBid.bidderId.username} placed a bid of $${numericBidAmount}`,
      type: 'bid',
      timestamp: new Date()
    });

    // Send outbid email to previous highest bidder (if configured and different from current bidder)
    try {
      console.log('📧 Checking outbid notification...');
      console.log(`   Previous highest bidder: ${previousHighestBidder}`);
      console.log(`   Current bidder: ${bidderId.toString()}`);
      
      if (previousHighestBidder && previousHighestBidder !== bidderId.toString()) {
        console.log('📧 Previous bidder exists and is different, fetching user...');
        const prevUser = await User.findById(previousHighestBidder).lean();
        console.log(`   Previous user email: ${prevUser?.email}`);
        
        if (prevUser?.email) {
          console.log(`📧 Sending outbid email to: ${prevUser.email}`);
          await sendEmail({
            to: prevUser.email,
            subject: `You've been outbid on ${populatedBid.itemId.title}`,
            text: `Hi ${prevUser.username || 'user'},\n\nYour previous bid on "${populatedBid.itemId.title}" was outbid. The new top bid is $${numericBidAmount}. Visit the auction to place a higher bid.`,
            html: `<p>Hi ${prevUser.username || 'user'},</p><p>Your previous bid on <strong>${populatedBid.itemId.title}</strong> was outbid. The new top bid is <strong>$${numericBidAmount}</strong>.</p><p><a href="${process.env.CLIENT_URL || ''}/items/${itemId}">View auction</a></p>`
          });
        } else {
          console.log('⚠ Previous user has no email address');
        }
      } else {
        console.log('⚠ No outbid notification needed (same bidder or no previous bidder)');
      }
    } catch (notifyErr) {
      console.error('✗ Error attempting to notify previous bidder:', notifyErr);
    }

    // Trigger auto-bidding logic after successful bid
    await processAutoBidding(itemId, bidderId.toString(), numericBidAmount, socketIo);

    res.status(201).json({
      message: 'Bid placed successfully.',
      bid: populatedBid,
      updatedItem: auctionItem.toObject()
    });
  } catch (bidError) {
    if (session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (_) {
        // swallow abort errors (e.g., abort after commit)
      }
    }
    console.error('Error placing bid:', bidError);
    res.status(500).json({ message: 'Server error while placing bid.' });
  } finally {
    try {
      session.endSession();
    } catch (_) {
      // no-op
    }
  }
};

/**
 * @function getBidHistory
 * @description Returns paginated bid history for a specific auction item, ordered by most recent.
 * @param {import('express').Request} req - Express request object containing params and query.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const getBidHistory = async (req, res) => {
  try {
    const { itemId } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip = (page - 1) * limit;

    const [bids, totalBids] = await Promise.all([
      Bid.find({ itemId })
        .populate('bidderId', 'username')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      Bid.countDocuments({ itemId })
    ]);

    res.status(200).json({
      bids,
      pagination: {
        page,
        limit,
        totalBids,
        totalPages: Math.ceil(totalBids / limit) || 1
      }
    });
  } catch (historyError) {
    console.error('Error retrieving bid history:', historyError);
    res.status(500).json({ message: 'Server error while retrieving bid history.' });
  }
};

/**
 * @function getUserBidHistory
 * @description Returns all bids placed by the authenticated user with their current status.
 * Determines bid status: 'won', 'lost', 'active', 'outbid', 'winning'.
 * @param {import('express').Request} req - Express request object containing user info.
 * @param {import('express').Response} res - Express response object used to send the response.
 * @returns {Promise<void>}
 */
export const getUserBidHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all bids by this user with item details
    const userBids = await Bid.find({ bidderId: userId })
      .populate({
        path: 'itemId',
        select: 'title category currentPrice highestBidder status endTime isAuctionOver'
      })
      .sort({ timestamp: -1 });

    // Determine status for each bid
    const bidsWithStatus = userBids.map(bid => {
      const bidObj = bid.toObject();
      let bidStatus;

      if (!bid.itemId) {
        // Item might be deleted
        bidStatus = 'lost';
      } else {
        const item = bid.itemId;
        const isHighestBidder = item.highestBidder && item.highestBidder.toString() === userId.toString();
        const auctionEnded = item.isAuctionOver || item.status === 'ended';

        if (auctionEnded) {
          // Auction ended
          bidStatus = isHighestBidder ? 'won' : 'lost';
        } else {
          // Auction still active
          if (isHighestBidder) {
            bidStatus = 'winning';
          } else {
            bidStatus = 'outbid';
          }
        }
      }

      return {
        ...bidObj,
        bidStatus
      };
    });

    res.status(200).json({
      bids: bidsWithStatus,
      totalBids: bidsWithStatus.length
    });
  } catch (error) {
    console.error('Error retrieving user bid history:', error);
    res.status(500).json({ message: 'Server error while retrieving bid history.' });
  }
};

/**
 * @function retractBid
 * @description Allows a user to retract their bid under certain conditions.
 * Rules: Can only retract if user is highest bidder, auction is still active, and within time limit.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const retractBid = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bidId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    // Find the bid
    const bid = await Bid.findById(bidId).session(session);
    if (!bid) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Bid not found.' });
    }

    // Verify the bid belongs to the user
    if (bid.bidderId.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'You can only retract your own bids.' });
    }

    // Check if already retracted
    if (bid.isRetracted) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Bid has already been retracted.' });
    }

    // Get the item
    const item = await Item.findById(bid.itemId).session(session);
    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Auction item not found.' });
    }

    // Check if auction is still active
    if (item.status !== 'active' || item.isAuctionOver) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Cannot retract bids from ended auctions.' });
    }

    // Check if user is the highest bidder
    if (!item.highestBidder || item.highestBidder.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Only the highest bidder can retract their bid.' });
    }

    // Time limit check: can retract within 1 hour of placing bid
    const hoursSinceBid = (new Date() - new Date(bid.timestamp)) / (1000 * 60 * 60);
    if (hoursSinceBid > 1) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Bid retraction is only allowed within 1 hour of placement.' });
    }

    // Mark bid as retracted
    bid.isRetracted = true;
    bid.retractionReason = reason || 'No reason provided';
    bid.retractionTime = new Date();
    bid.bidStatus = 'retracted';
    await bid.save({ session });

    // Find the previous highest bid
    const previousBids = await Bid.find({
      itemId: item._id,
      isRetracted: false,
      _id: { $ne: bidId }
    })
      .sort({ bidAmount: -1 })
      .limit(1)
      .session(session);

    if (previousBids.length > 0) {
      // Revert to previous bid
      item.currentPrice = previousBids[0].bidAmount;
      item.highestBidder = previousBids[0].bidderId;
      item.totalBids -= 1;
    } else {
      // No other bids, revert to starting price
      item.currentPrice = item.startingPrice;
      item.highestBidder = null;
      item.totalBids = 0;
    }

    await item.save({ session });
    await session.commitTransaction();

    // Emit socket event
    const socketIo = req.app.get('socketio');
    const retractionData = {
      itemId: item._id,
      newPrice: item.currentPrice,
      totalBids: item.totalBids,
      timestamp: new Date()
    };

    // Emit to specific auction room
    socketIo.to(`auction_${item._id}`).emit('bid-retracted', retractionData);
    
    // Emit globally for all pages (treat as new-bid-placed to update the item)
    socketIo.emit('new-bid-placed', {
      itemId: item._id,
      newPrice: item.currentPrice,
      totalBids: item.totalBids,
      timestamp: new Date(),
      isRetraction: true
    });

    socketIo.to(`auction_${item._id}`).emit('auction-alert', {
      message: `A bid has been retracted. New price: $${item.currentPrice}`,
      type: 'retraction',
      timestamp: new Date()
    });

    res.status(200).json({
      message: 'Bid retracted successfully.',
      updatedItem: item.toObject()
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('Error retracting bid:', error);
    res.status(500).json({ message: 'Server error while retracting bid.' });
  } finally {
    session.endSession();
  }
};

