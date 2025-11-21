/**
 * @file DashboardPage.jsx
 * @description Personalized dashboard showing user profile details and relevant auctions.
 */

import React, { useEffect, useState } from 'react';
import { Card, Row, Col, ListGroup, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuthContext } from '../hooks/useAuth.js';
import { useSocket } from '../context/SocketContext.jsx';
import api, { fetchItemPrices } from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

/**
 * @component DashboardPage
 * @returns {JSX.Element}
 */
const DashboardPage = () => {
  const { authUser } = useAuthContext();
  const { socket, isConnected } = useSocket();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    /**
     * @function fetchItems
     * @description Retrieves auction items to drive dashboard summaries.
     * @returns {Promise<void>}
     */
    const fetchItems = async () => {
      try {
        const response = await api.get('/items');
        setItems(response.data.items);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();

    // Auto-refresh only prices every 3 seconds (lightweight)
    const intervalId = setInterval(async () => {
      if (items.length > 0) {
        try {
          const itemIds = items.map((item) => item._id);
          const { prices } = await fetchItemPrices(itemIds);
          
          // Merge price data into existing items
          setItems((prevItems) =>
            prevItems.map((item) => {
              const priceData = prices.find((p) => p._id === item._id);
              return priceData
                ? {
                    ...item,
                    currentPrice: priceData.currentPrice,
                    totalBids: priceData.totalBids,
                    highestBidder: priceData.highestBidder,
                    status: priceData.status,
                    isAuctionOver: priceData.isAuctionOver
                  }
                : item;
            })
          );
        } catch (error) {
          console.error('Failed to fetch price updates:', error);
        }
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [items.length]);

  // Real-time bid updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleBidUpdate = (payload) => {
      setItems((prevItems) =>
        prevItems.map((item) =>
          item._id === payload.itemId
            ? {
                ...item,
                currentPrice: payload.newPrice,
                totalBids: payload.totalBids,
                highestBidder: payload.bidderId
              }
            : item
        )
      );
    };

    const handleAuctionEnded = (payload) => {
      setItems((prevItems) =>
        prevItems.map((item) =>
          item._id === payload.itemId
            ? {
                ...item,
                status: 'ended',
                isAuctionOver: true
              }
            : item
        )
      );
    };

    socket.on('new-bid-placed', handleBidUpdate);
    socket.on('auction-ended', handleAuctionEnded);

    return () => {
      socket.off('new-bid-placed', handleBidUpdate);
      socket.off('auction-ended', handleAuctionEnded);
    };
  }, [socket, isConnected]);

  const myListings = items.filter((item) => item.sellerId?._id === authUser._id);
  const activeAuctions = items.filter((item) => item.status === 'active');

  return (
    <div>
      <div className="mb-5">
        <h1 className="display-6 fw-bold mb-2">Welcome back, {authUser.username}!</h1>
        <p className="lead" style={{ color: 'var(--text-secondary)' }}>Here's your auction dashboard</p>
      </div>
      <Row className="g-4">
        <Col lg={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="fw-bold">Account Overview</Card.Header>
            <Card.Body>
              <ListGroup variant="flush">
                <ListGroup.Item className="d-flex justify-content-between align-items-center">
                  <span className="fw-semibold">Email:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{authUser.email}</span>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between align-items-center">
                  <span className="fw-semibold">Last Login:</span>
                  <span className="small" style={{ color: 'var(--text-secondary)' }}>{authUser.lastLogin ? formatDateTime(authUser.lastLogin) : 'Not recorded'}</span>
                </ListGroup.Item>
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={8}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="fw-bold">Live Auctions</Card.Header>
            <Card.Body>
              {isLoading ? (
                <div className="d-flex justify-content-center py-3">
                  <LoadingSpinner />
                </div>
              ) : activeAuctions.length ? (
                <ListGroup>
                  {activeAuctions.map((item) => (
                    <ListGroup.Item as={Link} to={`/items/${item._id}`} action key={item._id} className="d-flex justify-content-between align-items-center">
                      <div>
                        {item.title}
                        <div className="small" style={{ color: 'var(--text-muted)' }}>Ends {formatDateTime(item.endTime)}</div>
                      </div>
                      <div className="text-end">
                        <div>{formatCurrency(item.currentPrice)}</div>
                        <div className="small" style={{ color: 'var(--text-muted)' }}>{item.totalBids} bids</div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon" />
                  <p className="mb-0" style={{ color: 'var(--text-muted)' }}>No active auctions at the moment.</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mt-4 border-0 shadow-sm">
        <Card.Header className="fw-bold">My Listings</Card.Header>
        <Card.Body>
          {isLoading ? (
            <div className="d-flex justify-content-center py-3">
              <LoadingSpinner />
            </div>
          ) : myListings.length ? (
            <ListGroup>
                {myListings.map((item) => (
                  <ListGroup.Item as={Link} to={`/items/${item._id}`} action key={item._id} className="d-flex justify-content-between align-items-center">
                    <div>
                      {item.title}
                      <div className="small" style={{ color: 'var(--text-muted)' }}>Status: {item.status}</div>
                    </div>
                    <div className="text-end">
                      <div>{formatCurrency(item.currentPrice)}</div>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>{item.totalBids} bids</div>
                    </div>
                  </ListGroup.Item>
                ))}
            </ListGroup>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon" />
              <p className="mb-0" style={{ color: 'var(--text-muted)' }}>You have not created any listings yet.</p>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default DashboardPage;
