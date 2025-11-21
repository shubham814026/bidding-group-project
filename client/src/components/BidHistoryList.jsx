/**
 * @file BidHistoryList.jsx
 * @description List component rendering bid history entries with animations.
 */

import React from 'react';
import { ListGroup, Badge } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { listVariants, listItemVariants } from '../utils/animationVariants.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

/**
 * @component BidHistoryList
 * @param {{ bids: Array<Record<string, any>> }} props - Component props.
 * @returns {JSX.Element}
 */
const BidHistoryList = ({ bids }) => {
  if (!bids.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" />
        <p className="text-muted mb-0">No bids have been placed yet. Be the first to bid!</p>
      </div>
    );
  }

  // Deduplicate bids by _id to prevent React key warnings
  const uniqueBids = Array.from(
    new Map(bids.map(bid => [bid._id, bid])).values()
  );

  // Find the actual highest bid amount (not just first in array)
  const highestBidAmount = Math.max(...uniqueBids.map(bid => bid.bidAmount));

  return (
    <motion.div variants={listVariants} initial="hidden" animate="visible">
      <ListGroup>
        {uniqueBids.map((bid, index) => {
          const isHighestBid = bid.bidAmount === highestBidAmount;
          
          return (
            <motion.div key={`${bid._id}-${index}`} variants={listItemVariants}>
              <ListGroup.Item className="d-flex justify-content-between align-items-center bid-history-item">
                <div className="d-flex align-items-center">
                  {isHighestBid && (
                    <span className="me-2" style={{ fontSize: '1.5rem' }} />
                  )}
                  <div>
                    <div className="fw-bold d-flex align-items-center">
                      {bid.bidderId?.username || 'Anonymous Bidder'}
                      {isHighestBid && (
                        <Badge bg="warning" className="ms-2">Highest</Badge>
                      )}
                    </div>
                    <div className="text-muted small">{formatDateTime(bid.timestamp)}</div>
                  </div>
                </div>
                <div className="text-end">
                  <div className="fw-bold fs-5" style={{ color: 'var(--success-color)' }}>
                    {formatCurrency(bid.bidAmount)}
                  </div>
                </div>
              </ListGroup.Item>
            </motion.div>
          );
        })}
      </ListGroup>
    </motion.div>
  );
};

export default BidHistoryList;
