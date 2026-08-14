/**
 * @file seed.js
 * @description Seeds the database with demo users, auction items, and bids.
 * Run with: node seed.js
 * Pass --fresh to drop existing data before seeding.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDatabase from './config/db.js';
import User from './models/User.js';
import Item from './models/Item.js';
import Bid from './models/Bid.js';
import AutoBid from './models/AutoBid.js';

// ─── Configuration ───────────────────────────────────────────────────────────
const FRESH = process.argv.includes('--fresh');

// ─── Placeholder image URLs (royalty-free from Unsplash) ─────────────────────
const IMAGES = {
  furniture: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
    'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800',
  ],
  jewelry: [
    'https://images.unsplash.com/photo-1515562141589-67f0d569b6c2?w=800',
    'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=800',
  ],
  art: [
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800',
    'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800',
  ],
  collectibles: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800',
    'https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=800',
  ],
  watches: [
    'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800',
    'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=800',
  ],
  pottery: [
    'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800',
    'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=800',
  ],
  books: [
    'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=800',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
  ],
  sculptures: [
    'https://images.unsplash.com/photo-1544413660-299165566b1d?w=800',
    'https://images.unsplash.com/photo-1561839561-b13bcfe95249?w=800',
  ],
  electronics: [
    'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800',
  ],
  instruments: [
    'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800',
    'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800',
  ],
};

// ─── Helper: generate future dates ──────────────────────────────────────────
const hoursFromNow = (h) => new Date(Date.now() + h * 60 * 60 * 1000);
const daysFromNow = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);

// ─── Seed Users ──────────────────────────────────────────────────────────────
// Passwords are hashed automatically by the User model pre-save hook
const seedUsers = [
  {
    username: 'john_collector',
    email: 'john@example.com',
    password: 'Password123!',
    role: 'user',
    phoneNumber: '+1-555-0101',
    address: {
      street: '123 Maple Street',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
    isVerified: true,
  },
  {
    username: 'sarah_antiques',
    email: 'sarah@example.com',
    password: 'Password123!',
    role: 'user',
    phoneNumber: '+1-555-0102',
    address: {
      street: '456 Oak Avenue',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      country: 'USA',
    },
    isVerified: true,
  },
  {
    username: 'mike_bidder',
    email: 'mike@example.com',
    password: 'Password123!',
    role: 'user',
    phoneNumber: '+1-555-0103',
    address: {
      street: '789 Pine Road',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'USA',
    },
    isVerified: true,
  },
  {
    username: 'emma_vintage',
    email: 'emma@example.com',
    password: 'Password123!',
    role: 'user',
    phoneNumber: '+1-555-0104',
    address: {
      street: '321 Elm Boulevard',
      city: 'Houston',
      state: 'TX',
      zipCode: '77001',
      country: 'USA',
    },
    isVerified: true,
  },
  {
    username: 'admin_user',
    email: 'admin@bidforge.com',
    password: 'AdminPass123!',
    role: 'admin',
    phoneNumber: '+1-555-0100',
    address: {
      street: '100 Admin Plaza',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      country: 'USA',
    },
    isVerified: true,
  },
];

// ─── Seed Items (will assign sellerId after users are created) ───────────────
const seedItemTemplates = [
  // ── Furniture ──
  {
    title: 'Victorian Mahogany Writing Desk',
    description:
      'A stunning 19th-century Victorian mahogany writing desk with intricate hand-carved details, brass hardware, and a leather inlay top. Features three drawers with original brass pulls. This piece has been professionally restored while maintaining its original character and patina.',
    category: 'Furniture',
    images: IMAGES.furniture,
    startingPrice: 1200,
    bidIncrement: 50,
    endTime: daysFromNow(3),
    condition: 'Very Good',
    era: '1860s Victorian',
    authenticity: 'Authenticated',
    dimensions: { height: 30, width: 48, depth: 24, weight: 45, unit: 'inches', weightUnit: 'kg' },
  },
  {
    title: 'Art Deco Chaise Lounge',
    description:
      'Elegant Art Deco chaise lounge from the 1930s with original velvet upholstery in deep emerald green. Chrome-plated steel frame with sweeping geometric lines. A perfect statement piece for any living space or collector\'s showroom.',
    category: 'Furniture',
    images: IMAGES.furniture,
    startingPrice: 800,
    bidIncrement: 25,
    endTime: daysFromNow(5),
    condition: 'Good',
    era: '1930s Art Deco',
    authenticity: 'Attributed',
    dimensions: { height: 32, width: 60, depth: 28, weight: 35, unit: 'inches', weightUnit: 'kg' },
  },

  // ── Jewelry ──
  {
    title: 'Edwardian Diamond & Sapphire Brooch',
    description:
      'Exquisite Edwardian-era brooch featuring a 1.2ct central Ceylon sapphire surrounded by old European-cut diamonds totaling 0.8ct, set in platinum. Accompanied by a gemological certificate confirming the sapphire as natural and unheated.',
    category: 'Jewelry',
    images: IMAGES.jewelry,
    startingPrice: 3500,
    bidIncrement: 100,
    endTime: daysFromNow(2),
    condition: 'Excellent',
    era: '1905 Edwardian',
    authenticity: 'Authenticated',
    dimensions: { height: 2, width: 3, depth: 0.5, weight: 12, unit: 'cm', weightUnit: 'g' },
  },
  {
    title: 'Art Nouveau Gold Pendant Necklace',
    description:
      'Beautiful Art Nouveau pendant necklace in 18k yellow gold featuring a flowing floral motif with enamel work and a freshwater pearl drop. Chain is 18 inches. Hallmarked and attributed to a French atelier circa 1900.',
    category: 'Jewelry',
    images: IMAGES.jewelry,
    startingPrice: 2200,
    bidIncrement: 75,
    endTime: daysFromNow(4),
    condition: 'Very Good',
    era: '1900 Art Nouveau',
    authenticity: 'Authenticated',
  },

  // ── Art ──
  {
    title: 'Impressionist Oil Landscape - "Golden Fields"',
    description:
      'Original oil on canvas impressionist landscape painting depicting golden wheat fields under a luminous sky. Signed by the artist in the lower right corner. Professionally framed in a gilded period-appropriate frame. Canvas measures 24x36 inches.',
    category: 'Art',
    images: IMAGES.art,
    startingPrice: 4500,
    bidIncrement: 150,
    endTime: daysFromNow(7),
    condition: 'Excellent',
    era: 'Early 20th Century',
    authenticity: 'Authenticated',
    dimensions: { height: 24, width: 36, depth: 2, weight: 5, unit: 'inches', weightUnit: 'kg' },
  },
  {
    title: 'Japanese Woodblock Print - Utagawa School',
    description:
      'Rare Japanese woodblock print from the Utagawa school, circa 1850. Depicts a serene mountain landscape with a temple. Vibrant original colors with minimal fading. Mounted and matted, ready for framing.',
    category: 'Art',
    images: IMAGES.art,
    startingPrice: 1800,
    bidIncrement: 50,
    endTime: daysFromNow(6),
    condition: 'Good',
    era: '1850s Edo Period',
    authenticity: 'Attributed',
    dimensions: { height: 15, width: 10, depth: 0.1, weight: 100, unit: 'inches', weightUnit: 'g' },
  },

  // ── Collectibles ──
  {
    title: 'First Edition "The Great Gatsby" - 1925',
    description:
      'First edition, first printing of F. Scott Fitzgerald\'s "The Great Gatsby" published by Charles Scribner\'s Sons in 1925. Housed in a custom clamshell case. Minor foxing on interior pages, dust jacket shows light wear at edges.',
    category: 'Collectibles',
    images: IMAGES.collectibles,
    startingPrice: 8000,
    bidIncrement: 250,
    endTime: daysFromNow(10),
    condition: 'Good',
    era: '1925',
    authenticity: 'Authenticated',
  },
  {
    title: 'Vintage Star Wars Action Figures Set (1977)',
    description:
      'Complete set of 12 original Kenner Star Wars action figures from 1977-1978. Includes Luke Skywalker, Darth Vader, Princess Leia, Han Solo, Chewbacca, and more. All figures are in excellent condition with original accessories. No packaging.',
    category: 'Collectibles',
    images: IMAGES.collectibles,
    startingPrice: 2500,
    bidIncrement: 100,
    endTime: daysFromNow(4),
    condition: 'Very Good',
    era: '1977-1978',
    authenticity: 'Authenticated',
  },

  // ── Watches ──
  {
    title: 'Omega Seamaster 300 - Vintage 1960s',
    description:
      'Iconic Omega Seamaster 300 from the 1960s with original black dial, sword hands, and rotating bezel. Ref. 165.024. Automatic caliber 552 movement, recently serviced. Comes with a period-correct stainless steel bracelet.',
    category: 'Watches',
    images: IMAGES.watches,
    startingPrice: 5500,
    bidIncrement: 200,
    endTime: daysFromNow(3),
    condition: 'Very Good',
    era: '1960s',
    authenticity: 'Authenticated',
    dimensions: { height: 4, width: 4, depth: 1.4, weight: 95, unit: 'cm', weightUnit: 'g' },
  },
  {
    title: 'Cartier Tank Louis - 18k Gold',
    description:
      'Classic Cartier Tank Louis in 18k yellow gold with a silver guilloché dial and Roman numeral markers. Manual-wind movement. Includes original Cartier burgundy leather strap and deployment buckle. Complete with box and papers.',
    category: 'Watches',
    images: IMAGES.watches,
    startingPrice: 7000,
    bidIncrement: 250,
    endTime: daysFromNow(5),
    condition: 'Excellent',
    era: '1990s',
    authenticity: 'Authenticated',
    dimensions: { height: 3.4, width: 2.5, depth: 0.7, weight: 42, unit: 'cm', weightUnit: 'g' },
  },

  // ── Pottery ──
  {
    title: 'Rookwood Pottery Vase - Iris Glaze',
    description:
      'Beautiful Rookwood Pottery vase with the coveted Iris glaze finish, circa 1905. Features hand-painted cherry blossom decoration by a notable Rookwood artist. Stands 12 inches tall with no chips, cracks, or repairs.',
    category: 'Pottery',
    images: IMAGES.pottery,
    startingPrice: 1500,
    bidIncrement: 50,
    endTime: daysFromNow(6),
    condition: 'Excellent',
    era: '1905',
    authenticity: 'Authenticated',
    dimensions: { height: 12, width: 6, depth: 6, weight: 1.2, unit: 'inches', weightUnit: 'kg' },
  },

  // ── Antique Books ──
  {
    title: 'Illustrated "Alice in Wonderland" - 1907 Edition',
    description:
      'A beautiful 1907 edition of Lewis Carroll\'s "Alice\'s Adventures in Wonderland" illustrated by Arthur Rackham. Gilt-decorated cloth binding with 13 tipped-in color plates. Light wear to spine ends, internally clean and bright.',
    category: 'Antique Books',
    images: IMAGES.books,
    startingPrice: 900,
    bidIncrement: 25,
    endTime: daysFromNow(8),
    condition: 'Good',
    era: '1907',
    authenticity: 'Authenticated',
  },

  // ── Vintage Electronics ──
  {
    title: 'Sony Walkman TPS-L2 - Original 1979 Model',
    description:
      'The original Sony Walkman TPS-L2, the very first portable cassette player that changed how the world listens to music. In working condition with original headphones (MDR-3L2). Includes the original blue carrying case. A piece of tech history.',
    category: 'Vintage Electronics',
    images: IMAGES.electronics,
    startingPrice: 600,
    bidIncrement: 25,
    endTime: daysFromNow(3),
    condition: 'Good',
    era: '1979',
    authenticity: 'Authenticated',
  },

  // ── Sculptures ──
  {
    title: 'Bronze Art Deco Dancer Sculpture',
    description:
      'Striking Art Deco bronze sculpture of a dancer in a dramatic pose, mounted on a black marble base. After the style of Demetre Chiparus. Cold-painted and gilded details. Overall height 18 inches. A magnificent decorative piece.',
    category: 'Sculptures',
    images: IMAGES.sculptures,
    startingPrice: 2000,
    bidIncrement: 75,
    endTime: daysFromNow(5),
    condition: 'Very Good',
    era: '1920s Art Deco',
    authenticity: 'Attributed',
    dimensions: { height: 18, width: 8, depth: 6, weight: 4.5, unit: 'inches', weightUnit: 'kg' },
  },

  // ── Musical Instruments ──
  {
    title: 'Gibson Les Paul Standard - 1959 Sunburst',
    description:
      'A legendary 1959 Gibson Les Paul Standard in Cherry Sunburst finish. One of the most sought-after electric guitars ever made. Features PAF humbucking pickups, Brazilian rosewood fingerboard, and flame maple top. Includes original hardshell case.',
    category: 'Musical Instruments',
    images: IMAGES.instruments,
    startingPrice: 15000,
    bidIncrement: 500,
    endTime: daysFromNow(14),
    condition: 'Very Good',
    era: '1959',
    authenticity: 'Authenticated',
  },
  {
    title: 'Stradivarius Model Violin - 19th Century Copy',
    description:
      'Fine 19th-century German copy of a Stradivarius violin with a rich, warm tone. Two-piece flame maple back, spruce top, and ebony fittings. Includes a French Pernambuco bow and a fitted case. Recently set up by a professional luthier.',
    category: 'Musical Instruments',
    images: IMAGES.instruments,
    startingPrice: 3000,
    bidIncrement: 100,
    endTime: daysFromNow(7),
    condition: 'Good',
    era: '1880s',
    authenticity: 'Attributed',
  },
];

// ─── Main Seed Function ─────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱 ─────────────────────────────────────────');
  console.log('   BidForge Database Seeder');
  console.log('─────────────────────────────────────────────\n');

  await connectDatabase();

  // Optionally wipe existing data
  if (FRESH) {
    console.log('🗑️  --fresh flag detected. Dropping existing data...');
    await Promise.all([
      User.deleteMany({}),
      Item.deleteMany({}),
      Bid.deleteMany({}),
      AutoBid.deleteMany({}),
    ]);
    console.log('   ✓ All collections cleared.\n');
  }

  // ── 1. Create Users ──────────────────────────────────────────────────────
  console.log('👤 Creating users...');
  const existingCount = await User.countDocuments({
    email: { $in: seedUsers.map((u) => u.email) },
  });

  if (existingCount > 0 && !FRESH) {
    console.log('   ⚠ Seed users already exist. Skipping user creation.');
    console.log('   (Run with --fresh to drop and recreate all data)\n');
  }

  const createdUsers = [];
  for (const userData of seedUsers) {
    let user = await User.findOne({ email: userData.email });
    if (!user) {
      user = await User.create(userData);
      console.log(`   ✓ Created user: ${user.username} (${user.email})`);
    } else {
      console.log(`   → Exists: ${user.username} (${user.email})`);
    }
    createdUsers.push(user);
  }
  console.log(`   Total: ${createdUsers.length} users ready.\n`);

  // Assign sellers (non-admin users)
  const sellers = createdUsers.filter((u) => u.role !== 'admin');

  // ── 2. Create Auction Items ──────────────────────────────────────────────
  console.log('🏺 Creating auction items...');
  const existingItemCount = await Item.countDocuments();
  if (existingItemCount > 0 && !FRESH) {
    console.log(`   ⚠ ${existingItemCount} items already exist. Skipping item creation.`);
    console.log('   (Run with --fresh to drop and recreate all data)\n');
  } else {
    const createdItems = [];
    for (let i = 0; i < seedItemTemplates.length; i++) {
      const template = seedItemTemplates[i];
      const seller = sellers[i % sellers.length];
      const item = await Item.create({
        ...template,
        sellerId: seller._id,
        currentPrice: template.startingPrice,
        status: 'active',
        startTime: new Date(),
      });
      createdItems.push(item);
      console.log(`   ✓ [${item.category}] ${item.title} — $${item.startingPrice} (by ${seller.username})`);
    }
    console.log(`   Total: ${createdItems.length} items created.\n`);

    // ── 3. Create Sample Bids ────────────────────────────────────────────
    console.log('💰 Placing sample bids...');
    let bidCount = 0;

    for (const item of createdItems) {
      // Each item gets 2-4 bids from random non-seller users
      const bidders = sellers.filter((s) => !s._id.equals(item.sellerId));
      const numBids = 2 + Math.floor(Math.random() * 3); // 2 to 4 bids

      let currentPrice = item.startingPrice;

      for (let b = 0; b < Math.min(numBids, bidders.length); b++) {
        const bidder = bidders[b % bidders.length];
        const bidAmount = currentPrice + item.bidIncrement;

        await Bid.create({
          itemId: item._id,
          bidderId: bidder._id,
          bidAmount,
          previousPrice: currentPrice,
          bidStatus: 'active',
          timestamp: new Date(Date.now() - (numBids - b) * 3600000), // stagger timestamps
        });

        currentPrice = bidAmount;
        bidCount++;
      }

      // Update item with latest bid info
      const lastBidder = bidders[(Math.min(numBids, bidders.length) - 1) % bidders.length];
      await Item.findByIdAndUpdate(item._id, {
        currentPrice,
        highestBidder: lastBidder._id,
        totalBids: Math.min(numBids, bidders.length),
        viewCount: Math.floor(Math.random() * 200) + 20,
      });
    }
    console.log(`   ✓ ${bidCount} bids placed across ${createdItems.length} items.\n`);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  const totalUsers = await User.countDocuments();
  const totalItems = await Item.countDocuments();
  const totalBids = await Bid.countDocuments();

  console.log('✅ ─────────────────────────────────────────');
  console.log('   Seeding Complete!');
  console.log('─────────────────────────────────────────────');
  console.log(`   👤 Users:  ${totalUsers}`);
  console.log(`   🏺 Items:  ${totalItems}`);
  console.log(`   💰 Bids:   ${totalBids}`);
  console.log('─────────────────────────────────────────────');
  console.log('\n   Demo Login Credentials:');
  console.log('   ┌────────────────────────────────────────┐');
  console.log('   │  Email: john@example.com               │');
  console.log('   │  Password: Password123!                │');
  console.log('   ├────────────────────────────────────────┤');
  console.log('   │  Email: sarah@example.com              │');
  console.log('   │  Password: Password123!                │');
  console.log('   ├────────────────────────────────────────┤');
  console.log('   │  Email: admin@bidforge.com (admin)     │');
  console.log('   │  Password: AdminPass123!               │');
  console.log('   └────────────────────────────────────────┘\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
