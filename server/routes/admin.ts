import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User, ClientBalance, ReaderBalance } from '../mongodb';

const router = Router();

// Admin-only middleware 
const isAdmin = (req: Request, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  next();
};

// Hash password function
async function hashPassword(password: string) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Create/update test accounts
router.post('/create-test-accounts', async (req: Request, res: Response) => {
  try {
    console.log('Creating test accounts...');
    
    // Admin account
    const adminPassword = await hashPassword('JayJas1423!');
    const admin = await User.findOneAndUpdate(
      { email: 'emilynnj14@gmail.com' },
      {
        username: 'admin',
        email: 'emilynnj14@gmail.com',
        password: adminPassword,
        fullName: 'Admin User',
        role: 'admin',
        profileImage: '/images/users/admin.jpg',
        bio: 'System administrator',
        isVerified: true,
        isOnline: true
      },
      { upsert: true, new: true }
    );
    
    // Reader account
    const readerPassword = await hashPassword('JayJas1423!');
    const reader = await User.findOneAndUpdate(
      { email: 'emilynn992@gmail.com' },
      {
        username: 'psychicreader',
        email: 'emilynn992@gmail.com',
        password: readerPassword,
        fullName: 'Psychic Reader',
        role: 'reader',
        profileImage: '/images/users/reader.jpg',
        bio: 'Experienced psychic reader specializing in tarot and clairvoyance',
        specialties: ['Tarot', 'Clairvoyance', 'Past Lives'],
        yearsOfExperience: 10,
        rating: 4.8,
        reviewCount: 125,
        pricingVideo: 200, // $2.00/min
        pricingVoice: 150, // $1.50/min
        pricingChat: 100,  // $1.00/min
        minimumSessionLength: 5,
        isVerified: true,
        isOnline: true,
        isAvailable: true
      },
      { upsert: true, new: true }
    );
    
    // Create reader balance if it doesn't exist
    const existingReaderBalance = await ReaderBalance.findOne({ readerId: reader._id });
    if (!existingReaderBalance) {
      await ReaderBalance.create({
        readerId: reader._id,
        pendingBalance: 0,
        availableBalance: 0,
        lifetimeEarnings: 0
      });
    }
    
    // Client account
    const clientPassword = await hashPassword('Jade2014!');
    const client = await User.findOneAndUpdate(
      { email: 'emily81292@gmail.com' },
      {
        username: 'client',
        email: 'emily81292@gmail.com',
        password: clientPassword,
        fullName: 'Client User',
        role: 'client',
        profileImage: '/images/users/client.jpg',
        bio: 'Seeking spiritual guidance',
        isVerified: true,
        isOnline: false
      },
      { upsert: true, new: true }
    );
    
    // Create client balance if it doesn't exist
    const existingClientBalance = await ClientBalance.findOne({ userId: client._id });
    if (!existingClientBalance) {
      await ClientBalance.create({
        userId: client._id,
        balance: 5000 // $50.00 starting balance
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Test accounts created successfully',
      accounts: [
        { email: admin.email, role: admin.role },
        { email: reader.email, role: reader.role },
        { email: client.email, role: client.role }
      ]
    });
  } catch (error: any) {
    console.error('Error creating test accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public route to check if test accounts exist
router.get('/test-accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await User.find({
      email: { $in: ['emilynnj14@gmail.com', 'emilynn992@gmail.com', 'emily81292@gmail.com'] }
    }, { email: 1, role: 1, username: 1 });
    
    res.json({ 
      success: true,
      accounts: accounts.map(acc => ({ 
        email: acc.email, 
        role: acc.role, 
        username: acc.username 
      }))
    });
  } catch (error: any) {
    console.error('Error checking test accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;