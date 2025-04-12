import Stripe from 'stripe';
import * as mongodb from '../mongodb';
import { log } from '../server-only';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export class ReaderBalanceService {
  /**
   * Get the balance for a reader
   */
  async getReaderBalance(readerId: string): Promise<any> {
    try {
      const balance = await mongodb.ReaderBalance.findOne({ readerId });
      
      if (!balance) {
        // Create a new balance record if it doesn't exist
        const newBalance = await mongodb.ReaderBalance.create({
          readerId,
          balance: 0,
          lifetimeEarnings: 0,
          lastPayout: null
        });
        
        return newBalance;
      }
      
      return balance;
    } catch (error: any) {
      log(`Error getting reader balance: ${error.message}`, 'reader-balance-error');
      throw error;
    }
  }
  
  /**
   * Get all reader balances (admin use)
   */
  async getAllReaderBalances(): Promise<any[]> {
    try {
      const balances = await mongodb.ReaderBalance.find().lean();
      
      // Populate reader information
      const balancesWithReaders = await Promise.all(
        balances.map(async (balance) => {
          const reader = await mongodb.User.findById(balance.readerId).lean();
          return {
            ...balance,
            reader
          };
        })
      );
      
      return balancesWithReaders;
    } catch (error: any) {
      log(`Error getting all reader balances: ${error.message}`, 'reader-balance-error');
      throw error;
    }
  }
  
  /**
   * Process a payout for a single reader
   */
  async processReaderPayout(readerId: string): Promise<any> {
    try {
      // Get reader balance
      const balance = await this.getReaderBalance(readerId);
      
      if (balance.balance <= 0) {
        return {
          success: false,
          message: 'Reader has no balance to pay out',
          balance
        };
      }
      
      // Get reader
      const reader = await mongodb.User.findById(readerId);
      
      if (!reader) {
        return {
          success: false,
          message: 'Reader not found',
          balance
        };
      }
      
      // Check if reader has a Stripe Connect account
      if (!reader.stripeConnectAccountId) {
        return {
          success: false,
          message: 'Reader does not have a Stripe Connect account',
          balance
        };
      }
      
      // Create a transfer to the reader's Stripe Connect account
      const transfer = await stripe.transfers.create({
        amount: balance.balance,
        currency: 'usd',
        destination: reader.stripeConnectAccountId,
        description: `Payout for reader ${reader.username || reader.fullName}`,
        metadata: {
          readerId,
          previousBalance: balance.balance,
          payoutDate: new Date().toISOString()
        }
      });
      
      // Create a payout record
      const payout = await mongodb.Payment.create({
        userId: readerId,
        readerId,
        amount: balance.balance,
        status: 'completed',
        type: 'payout',
        readerShare: balance.balance,
        platformFee: 0,
        metadata: {
          stripeTransferId: transfer.id,
          previousBalance: balance.balance,
          payoutMethod: 'stripe'
        }
      });
      
      // Reset the reader's balance
      balance.balance = 0;
      balance.lastPayout = new Date();
      await balance.save();
      
      return {
        success: true,
        message: 'Payout processed successfully',
        transfer,
        payout,
        balance
      };
    } catch (error: any) {
      log(`Error processing reader payout: ${error.message}`, 'reader-balance-error');
      throw error;
    }
  }
  
  /**
   * Schedule daily payouts for eligible readers
   * 
   * This will payout all readers with a balance > $15
   */
  async scheduleDailyPayouts(): Promise<any> {
    try {
      // Get all readers with a balance over $15 (1500 cents)
      const eligibleBalances = await mongodb.ReaderBalance.find({
        balance: { $gt: 1500 }
      }).lean();
      
      if (eligibleBalances.length === 0) {
        log('No eligible readers for payout', 'reader-balance');
        return {
          success: true,
          message: 'No eligible readers for payout',
          processed: 0
        };
      }
      
      let processedCount = 0;
      let failedCount = 0;
      const results = [];
      
      // Process payouts for each eligible reader
      for (const balance of eligibleBalances) {
        try {
          const result = await this.processReaderPayout(balance.readerId.toString());
          results.push(result);
          
          if (result.success) {
            processedCount++;
          } else {
            failedCount++;
          }
        } catch (error: any) {
          log(`Error processing payout for reader ${balance.readerId}: ${error.message}`, 'reader-balance-error');
          failedCount++;
          results.push({
            success: false,
            message: error.message,
            readerId: balance.readerId
          });
        }
      }
      
      log(`Processed ${processedCount} reader payouts, ${failedCount} failed`, 'reader-balance');
      
      return {
        success: true,
        message: `Processed ${processedCount} payouts, ${failedCount} failed`,
        processed: processedCount,
        failed: failedCount,
        results
      };
    } catch (error: any) {
      log(`Error scheduling daily payouts: ${error.message}`, 'reader-balance-error');
      throw error;
    }
  }
  
  /**
   * Get payout history for a reader
   */
  async getReaderPayoutHistory(readerId: string): Promise<any[]> {
    try {
      const payouts = await mongodb.Payment.find({
        readerId,
        type: 'payout'
      }).sort({ createdAt: -1 }).lean();
      
      return payouts;
    } catch (error: any) {
      log(`Error getting reader payout history: ${error.message}`, 'reader-balance-error');
      throw error;
    }
  }
}

// Create a singleton instance
export const readerBalanceService = new ReaderBalanceService();