/**
 * @file auctionScheduler.js
 * @description Simple interval-based scheduler that finalizes auctions which reached their end time.
 * Emits Socket.io events so clients can react to auction completion in real time.
 */

import Item from '../models/Item.js';
import Bid from '../models/Bid.js';
import User from '../models/User.js';
import { sendEmail } from './mailer.js';

const DEFAULT_INTERVAL_MS = 30 * 1000; // 30 seconds for responsive demos

/**
 * @function finalizeExpiredAuctions
 * @description Finds auctions that should be marked as ended and updates their status.
 * @param {import('socket.io').Server} io - Socket.io server instance used to broadcast updates.
 * @returns {Promise<void>}
 */
const finalizeExpiredAuctions = async (io) => {
  const now = new Date();

  const expiredAuctions = await Item.find({
    status: 'active',
    isAuctionOver: false,
    endTime: { $lte: now }
  });

  if (!expiredAuctions.length) {
    return;
  }

  for (const auctionItem of expiredAuctions) {
    auctionItem.isAuctionOver = true;
    auctionItem.status = 'ended';

    if (auctionItem.highestBidder) {
      auctionItem.winnerId = auctionItem.highestBidder;
      const itemBids = await Bid.find({ itemId: auctionItem._id });
      await Promise.all(
        itemBids.map((bid) => {
          bid.bidStatus = bid.bidderId.toString() === auctionItem.highestBidder.toString() ? 'won' : 'lost';
          return bid.save();
        })
      );

      // notify winner and seller by email (best-effort)
      try {
        const [winnerUser, sellerUser] = await Promise.all([
          User.findById(auctionItem.winnerId).lean(),
          User.findById(auctionItem.sellerId).lean()
        ]);

        if (winnerUser?.email) {
          sendEmail({
            to: winnerUser.email,
            subject: `You won the auction: ${auctionItem.title}`,
            text: `Congratulations! You won the auction for ${auctionItem.title} with a final price of $${auctionItem.currentPrice}.`,
            html: `<p>Congratulations!</p><p>You won the auction for <strong>${auctionItem.title}</strong> with a final price of <strong>$${auctionItem.currentPrice}</strong>.</p>`
          }).catch((e) => console.error('Winner email error:', e));
        }

        if (sellerUser?.email) {
          sendEmail({
            to: sellerUser.email,
            subject: `Your auction ended: ${auctionItem.title}`,
            text: `Your auction for ${auctionItem.title} has ended. Final price: $${auctionItem.currentPrice}.`,
            html: `<p>Your auction for <strong>${auctionItem.title}</strong> has ended. Final price: <strong>$${auctionItem.currentPrice}</strong>.</p>`
          }).catch((e) => console.error('Seller email error:', e));
        }
      } catch (notifyErr) {
        console.error('Error sending auction end notifications:', notifyErr);
      }
    }

    await auctionItem.save();

    const endedData = {
      itemId: auctionItem._id,
      winnerId: auctionItem.winnerId,
      finalPrice: auctionItem.currentPrice,
      totalBids: auctionItem.totalBids,
      endedAt: now
    };

    // Emit to specific auction room
    io.to(`auction_${auctionItem._id}`).emit('auction-ended', endedData);
    
    // Emit globally for all pages
    io.emit('auction-ended', endedData);
  }
};

/**
 * @function initializeAuctionScheduler
 * @description Starts an interval timer responsible for calling finalizeExpiredAuctions.
 * @param {{ io: import('socket.io').Server }} params - Configuration object containing the Socket.io instance.
 * @returns {void}
 */
export const initializeAuctionScheduler = ({ io }) => {
  if (!io) {
    console.warn('Auction scheduler not initialized because Socket.io instance was not provided.');
    return;
  }

  setInterval(() => {
    finalizeExpiredAuctions(io).catch((error) => {
      console.error('Auction scheduler error:', error);
    });
  }, DEFAULT_INTERVAL_MS);
};
