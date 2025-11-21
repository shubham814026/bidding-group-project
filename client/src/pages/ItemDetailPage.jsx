/**
 * @file ItemDetailPage.jsx
 * @description Displays a detailed view of a single auction item with real-time bidding.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Badge,
  Table,
  ListGroup,
  Alert
} from 'react-bootstrap';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { FaHeart, FaRegHeart } from 'react-icons/fa';

import { useAuthContext } from '../hooks/useAuth.js';
import { useSocket } from '../context/SocketContext.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import BidModal from '../components/BidModal.jsx';
import AutoBidModal from '../components/AutoBidModal.jsx';
import ImageGallery from '../components/ImageGallery.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import BidHistoryList from '../components/BidHistoryList.jsx';
import LiveAuctionRoom from '../components/LiveAuctionRoom.jsx';
import api from '../services/api.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';
import { priceUpdateVariants, buttonHoverVariants } from '../utils/animationVariants.js';

/**
 * @component ItemDetailPage
 * @returns {JSX.Element}
 */
const ItemDetailPage = () => {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuthContext();
  const { socket, isConnected } = useSocket();

  const [auctionItem, setAuctionItem] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBidModal, setShowBidModal] = useState(false);
  const [showAutoBidModal, setShowAutoBidModal] = useState(false);
  const [bidAmountInput, setBidAmountInput] = useState('');
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [hasShownEndNotification, setHasShownEndNotification] = useState(false);

  useEffect(() => {
    if (!itemId) {
      toast.error('Invalid item identifier.');
      navigate('/');
      return;
    }

    const fetchItemDetails = async () => {
      try {
        const response = await api.get(`/items/${itemId}`);
        setAuctionItem(response.data.item);
        setBidHistory(response.data.recentBids);
        setBidAmountInput(
          String(response.data.item.currentPrice + response.data.item.bidIncrement)
        );
      } catch (error) {
        const message = error.response?.data?.message || 'Unable to load auction details.';
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItemDetails();
  }, [itemId, navigate]);

  useEffect(() => {
    if (!socket || !isConnected || !itemId) {
      console.log('Socket not ready:', { socket: !!socket, isConnected, itemId });
      return;
    }

    console.log('Joining auction room:', itemId);
    socket.emit('join-auction-room', {
      itemId,
      userId: authUser?._id || null
    });

    const handleNewBidPlaced = (payload) => {
      console.log('🎯 Received new-bid-placed event:', payload);
      setAuctionItem((previous) =>
        previous
          ? {
              ...previous,
              currentPrice: payload.newPrice,
              totalBids: payload.totalBids,
              bidIncrement: payload.bidIncrement,
              highestBidder: {
                _id: payload.bidderId,
                username: payload.bidderUsername
              },
              updatedAt: payload.timestamp
            }
          : previous
      );

      setBidHistory((previousHistory) => [
        {
          _id: payload.bidId,
          bidderId: { username: payload.bidderUsername },
          bidAmount: payload.newPrice,
          timestamp: payload.timestamp
        },
        ...previousHistory
      ]);

      if (authUser?.username !== payload.bidderUsername) {
        toast.info(`New bid placed by ${payload.bidderUsername}: ${formatCurrency(payload.newPrice)}`);
      }

      setBidAmountInput(String(payload.newPrice + payload.bidIncrement));
    };

    const handleAuctionEnded = (payload) => {
      console.log('🏁 Received auction-ended event:', payload);
      setAuctionItem((previous) =>
        previous
          ? {
              ...previous,
              status: 'ended',
              isAuctionOver: true,
              winnerId: payload.winnerId,
              currentPrice: payload.finalPrice
            }
          : previous
      );
      if (!hasShownEndNotification) {
        setHasShownEndNotification(true);
        toast.success('This auction has ended.');
      }
    };

    console.log('Attaching socket event listeners');
    socket.on('new-bid-placed', handleNewBidPlaced);
    socket.on('auction-ended', handleAuctionEnded);

    return () => {
      console.log('Cleaning up socket listeners and leaving room');
      socket.off('new-bid-placed', handleNewBidPlaced);
      socket.off('auction-ended', handleAuctionEnded);
      socket.emit('leave-auction-room', itemId);
    };
  }, [socket, isConnected, itemId, authUser, hasShownEndNotification]);

  const minimumBid = useMemo(() => {
    if (!auctionItem) {
      return 0;
    }
    return auctionItem.currentPrice + auctionItem.bidIncrement;
  }, [auctionItem]);

  /**
   * @function toggleWatchlist
   * @description Adds or removes item from user's watchlist
   * @returns {Promise<void>}
   */
  const toggleWatchlist = async () => {
    if (!authUser) {
      toast.error('Please log in to add items to watchlist.');
      navigate('/login');
      return;
    }

    try {
      const response = await api.post('/watchlist/toggle', { itemId });
      setIsInWatchlist(response.data.isInWatchlist);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update watchlist.');
    }
  };

  /**
   * @function handlePlaceBidClick
   * @description Opens the bid modal or redirects the user to login if unauthenticated.
   * @returns {void}
   */
  const handlePlaceBidClick = () => {
    if (!authUser) {
      toast.error('Please log in to place a bid.');
      navigate('/login');
      return;
    }

    setShowBidModal(true);
  };

  /**
   * @function handleBidSubmission
   * @description Submits the bid to the backend API and handles optimistic UI updates.
   * @param {React.FormEvent<HTMLFormElement>} event - Form submit event.
   * @returns {Promise<void>}
   */
  const handleBidSubmission = async (event) => {
    event.preventDefault();
    if (!auctionItem) {
      toast.error('Auction item not loaded yet.');
      return;
    }

    const parsedBidAmount = Number(bidAmountInput);

    if (Number.isNaN(parsedBidAmount) || parsedBidAmount < minimumBid) {
      toast.error(`Minimum bid is ${formatCurrency(minimumBid)}.`);
      return;
    }

    try {
      setIsSubmittingBid(true);
      await api.post('/bids', {
        itemId,
        bidAmount: parsedBidAmount
      });
      toast.success('Bid submitted successfully.');
      setShowBidModal(false);
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to place bid.';
      toast.error(message);
      if (error.response?.status === 400) {
        setBidAmountInput(String(minimumBid));
      }
    } finally {
      setIsSubmittingBid(false);
    }
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (errorMessage || !auctionItem) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{errorMessage || 'Auction item not found.'}</Alert>
      </Container>
    );
  }

  const isSeller = authUser && auctionItem.sellerId?._id === authUser._id;
  const hasAuctionEnded = auctionItem.isAuctionOver || auctionItem.status === 'ended';

  return (
    <Container>
      <Row className="g-4">
        <Col lg={7}>
          <ImageGallery images={auctionItem.images} title={auctionItem.title} />
        </Col>
        <Col lg={5}>
          <Card className="h-100 border-0 shadow-lg">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div className="flex-grow-1">
                  <Card.Title className="fw-bold mb-3" style={{ fontSize: '1.75rem' }}>{auctionItem.title}</Card.Title>
                  <div className="d-flex gap-2 flex-wrap mb-3">
                    <Badge bg="secondary" className="px-3 py-2 fs-6">
                      {auctionItem.category}
                    </Badge>
                    <Badge bg="info" className="px-3 py-2 fs-6">
                      {auctionItem.condition}
                    </Badge>
                    {hasAuctionEnded && (
                      <Badge bg="dark" className="px-3 py-2 fs-6">
                        Auction Ended
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Card.Text className="mb-4" style={{ fontSize: '1rem', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
                {auctionItem.description}
              </Card.Text>

              <motion.div variants={priceUpdateVariants} initial="initial" animate="animate" className="mb-4 p-4 rounded" style={{ background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)' }}>
                <div className="text-muted small mb-1 fw-semibold">Current Price</div>
                <h2 className="price-display mb-0">{formatCurrency(auctionItem.currentPrice)}</h2>
              </motion.div>

                <div className="mb-3 p-3 rounded d-flex justify-content-between align-items-center" style={{ background: 'var(--background-gradient)' }}>
                <span className="fw-semibold">Total Bids:</span>
                <Badge bg="primary" className="fs-6 px-3 py-2">
                  {auctionItem.totalBids} {auctionItem.totalBids === 1 ? 'bid' : 'bids'}
                </Badge>
              </div>

              <div className="mb-3 p-3 rounded d-flex justify-content-between align-items-center" style={{ background: 'var(--background-gradient)' }}>
                <span className="fw-semibold">Bid Increment:</span>
                <span className="fw-bold" style={{ color: 'var(--success-color)' }}>{formatCurrency(auctionItem.bidIncrement)}</span>
              </div>

              <div className="mb-4 p-3 rounded d-flex justify-content-between align-items-center" style={{ background: 'var(--background-gradient)' }}>
                <span className="fw-semibold">Time Remaining:</span>
                <CountdownTimer endTime={auctionItem.endTime} />
              </div>

              {!hasAuctionEnded && !isSeller && (
                <>
                  <motion.div variants={buttonHoverVariants} whileHover="hover" whileTap="tap" className="mb-3">
                    <Button className="w-100 fw-bold" style={{ fontSize: '1.1rem', padding: '0.85rem' }} onClick={handlePlaceBidClick}>
                      Place a Bid
                    </Button>
                  </motion.div>
                  <motion.div variants={buttonHoverVariants} whileHover="hover" whileTap="tap" className="mb-3">
                    <Button 
                      variant="outline-primary" 
                      className="w-100 fw-bold d-flex align-items-center justify-content-center gap-2" 
                      style={{ fontSize: '1rem', padding: '0.75rem' }}
                      onClick={() => setShowAutoBidModal(true)}
                    >
                      🤖 Enable Auto-Bid
                    </Button>
                  </motion.div>
                  <motion.div variants={buttonHoverVariants} whileHover="hover" whileTap="tap">
                    <Button 
                      variant={isInWatchlist ? 'danger' : 'outline-danger'} 
                      className="w-100 fw-bold d-flex align-items-center justify-content-center gap-2" 
                      style={{ fontSize: '1rem', padding: '0.75rem' }}
                      onClick={toggleWatchlist}
                    >
                      {isInWatchlist ? <FaHeart /> : <FaRegHeart />}
                      {isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                    </Button>
                  </motion.div>
                </>
              )}

              {isSeller && (
                <Alert variant="info" className="mt-3 mb-0">
                  <strong>Note:</strong> Sellers cannot place bids on their own items.
                </Alert>
              )}

              {hasAuctionEnded && auctionItem.winnerId && (
                <Alert variant="success" className="mt-3 mb-0">
                  <strong>Winner!</strong> Auction won by bidder ID {auctionItem.winnerId} at {formatCurrency(auctionItem.currentPrice)}
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Real-time Auction Room */}
      {!hasAuctionEnded && (
        <Row className="mt-4">
          <Col>
            <LiveAuctionRoom itemId={itemId} itemTitle={auctionItem.title} />
          </Col>
        </Row>
      )}

      <Row className="g-4 mt-1">
        <Col lg={7}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="fw-bold fs-5">Bid History</Card.Header>
            <Card.Body>
              <BidHistoryList bids={bidHistory} />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={5}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="fw-bold fs-5">Item Details</Card.Header>
            <Card.Body>
              <Table borderless size="sm" className="mb-0">
                <tbody>
                  <tr>
                    <th scope="row" className="fw-semibold">Seller</th>
                    <td>
                      <Badge bg="secondary">{auctionItem.sellerId?.username || 'Unknown'}</Badge>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="fw-semibold">Starting Price</th>
                    <td className="fw-bold" style={{ color: 'var(--success-color)' }}>{formatCurrency(auctionItem.startingPrice)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="fw-semibold">Reserve Price</th>
                    <td>{auctionItem.reservePrice ? <span className="fw-bold" style={{ color: 'var(--warning-color)' }}>{formatCurrency(auctionItem.reservePrice)}</span> : <span className="text-muted">Not Set</span>}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="fw-semibold">Start Time</th>
                    <td>{formatDateTime(auctionItem.startTime)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="fw-semibold">End Time</th>
                    <td>{formatDateTime(auctionItem.endTime)}</td>
                  </tr>
                </tbody>
              </Table>

              {auctionItem.dimensions && (
                <ListGroup className="mt-3">
                  <ListGroup.Item className="fw-semibold">Dimensions</ListGroup.Item>
                  <ListGroup.Item>
                    Height: {auctionItem.dimensions.height ?? '—'} {auctionItem.dimensions.unit}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    Width: {auctionItem.dimensions.width ?? '—'} {auctionItem.dimensions.unit}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    Depth: {auctionItem.dimensions.depth ?? '—'} {auctionItem.dimensions.unit}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    Weight: {auctionItem.dimensions.weight ?? '—'} {auctionItem.dimensions.weightUnit}
                  </ListGroup.Item>
                </ListGroup>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <BidModal
        show={showBidModal}
        onHide={() => setShowBidModal(false)}
        bidAmount={bidAmountInput}
        onBidAmountChange={setBidAmountInput}
        onSubmit={handleBidSubmission}
        minimumBidDisplay={minimumBid}
        isSubmitting={isSubmittingBid}
      />

      <AutoBidModal
        show={showAutoBidModal}
        onHide={() => setShowAutoBidModal(false)}
        item={auctionItem}
      />
    </Container>
  );
};

export default ItemDetailPage;
