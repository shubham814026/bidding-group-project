/**
 * @file HomePage.jsx
 * @description Displays a grid of active auction items with filter controls.
 */

import React, { useEffect, useState } from 'react';
import { Row, Col, Form, Button, Badge, Card } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { useSocket } from '../context/SocketContext.jsx';
import api, { fetchItemPrices } from '../services/api.js';
import ItemCard from '../components/ItemCard.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

/**
 * @component HomePage
 * @returns {JSX.Element}
 */
const HomePage = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ 
    category: '', 
    status: 'active', 
    search: '',
    condition: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'endingSoon'
  });
  const { socket, isConnected } = useSocket();

  useEffect(() => {
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

  // Real-time bid updates across all items and auctions
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('HomePage: Socket not ready', { socket: !!socket, isConnected });
      return;
    }

    console.log('HomePage: Setting up socket listeners');

    const handleBidUpdate = (payload) => {
      console.log('HomePage: Received bid update', payload);
      // Update the specific item's price and bid count in the list
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
      console.log('HomePage: Auction ended', payload);
      // Update auction status when it ends
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

    // Listen to all auction rooms for updates
    socket.on('new-bid-placed', handleBidUpdate);
    socket.on('auction-ended', handleAuctionEnded);

    console.log('HomePage: Socket listeners attached');

    return () => {
      console.log('HomePage: Cleaning up socket listeners');
      socket.off('new-bid-placed', handleBidUpdate);
      socket.off('auction-ended', handleAuctionEnded);
    };
  }, [socket, isConnected]);

  /**
   * @function fetchItems
   * @description Fetches auction items using current filter state.
   * @param {Record<string, any>} overrides - Optional filter overrides applied to the request.
   * @returns {Promise<void>}
   */
  const fetchItems = async (overrides = {}) => {
    try {
      setIsLoading(true);
      const params = { ...filters, ...overrides };
      const response = await api.get('/items', { params });
      setItems(response.data.items);
    } catch (error) {
      toast.error('Failed to load auction items.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * @function handleFilterSubmit
   * @description Handles filter form submission and triggers a fetch.
   * @param {React.FormEvent<HTMLFormElement>} event - Form submit event.
   * @returns {void}
   */
  const handleFilterSubmit = (event) => {
    event.preventDefault();
    fetchItems();
  };

  /**
   * @function handleFilterChange
   * @description Applies modifications to the filter state when the user changes controls.
   * @param {React.ChangeEvent<HTMLInputElement|HTMLSelectElement>} event - Change event from filter control.
   * @returns {void}
   */
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((previous) => ({ ...previous, [name]: value }));
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h1 className="display-5 fw-bold mb-2">Live Antique Auctions</h1>
          <p className="lead text-secondary mb-0">Bid in real time on rare antiques and collectibles</p>
        </div>
        <Badge bg="primary" className="fs-6 px-3 py-2">
          Real-Time Updates
        </Badge>
      </div>

      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body>
          <Form onSubmit={handleFilterSubmit}>
            <Row className="g-3">
              <Col md={4}>
                <Form.Control
                  type="search"
                  name="search"
                  placeholder="Search by title..."
                  value={filters.search}
                  onChange={handleFilterChange}
                  className="form-control-lg"
                />
              </Col>
              <Col md={3}>
                <Form.Select name="category" value={filters.category} onChange={handleFilterChange} className="form-control-lg">
                  <option value="">All Categories</option>
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
              </Col>
              <Col md={3}>
                <Form.Select name="status" value={filters.status} onChange={handleFilterChange} className="form-control-lg">
                  <option value="active">Active</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="ended">Ended</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Select name="condition" value={filters.condition} onChange={handleFilterChange} className="form-control-lg">
                  <option value="">Any Condition</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Very Good">Very Good</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </Form.Select>
              </Col>
            </Row>
            <Row className="g-3 mt-2">
              <Col md={3}>
                <Form.Control
                  type="number"
                  name="minPrice"
                  placeholder="Min Price ($)"
                  value={filters.minPrice}
                  onChange={handleFilterChange}
                  min="0"
                />
              </Col>
              <Col md={3}>
                <Form.Control
                  type="number"
                  name="maxPrice"
                  placeholder="Max Price ($)"
                  value={filters.maxPrice}
                  onChange={handleFilterChange}
                  min="0"
                />
              </Col>
              <Col md={4}>
                <Form.Select name="sortBy" value={filters.sortBy} onChange={handleFilterChange}>
                  <option value="endingSoon">Ending Soon</option>
                  <option value="newest">Newest First</option>
                  <option value="priceLowToHigh">Price: Low to High</option>
                  <option value="priceHighToLow">Price: High to Low</option>
                  <option value="mostBids">Most Bids</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Button type="submit" className="w-100">
                  Apply Filters
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {isLoading ? (
        <div className="d-flex justify-content-center py-5">
          <LoadingSpinner />
        </div>
      ) : (
        <Row className="g-4">
          {items.map((item) => (
            <Col key={item._id} xs={12} md={6} lg={4}>
              <ItemCard item={item} />
            </Col>
          ))}
          {!items.length && (
            <Col xs={12}>
              <div className="empty-state">
                <div className="empty-state-icon" />
                <h3 className="fw-bold mb-2">No items found</h3>
                <p className="text-muted">No items match the selected filters. Try adjusting your search criteria.</p>
              </div>
            </Col>
          )}
        </Row>
      )}
    </div>
  );
};

export default HomePage;
