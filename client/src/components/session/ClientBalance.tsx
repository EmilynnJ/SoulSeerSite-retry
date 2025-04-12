import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// Predefined top-up amounts with reading time value
const TOPUP_OPTIONS = [
  { amount: 1000, label: '$10', readingTime: '20-25 min' },
  { amount: 2500, label: '$25', readingTime: '50-60 min' },
  { amount: 5000, label: '$50', readingTime: '100-120 min' },
  { amount: 10000, label: '$100', readingTime: '200-240 min' }
];

export const ClientBalance = () => {
  const [customAmount, setCustomAmount] = useState<string>('');
  const [processingAmount, setProcessingAmount] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch client balance
  const { 
    data: balanceData, 
    isLoading: isLoadingBalance,
    error: balanceError,
    refetch: refetchBalance
  } = useQuery({
    queryKey: ['/api/sessions/balance'],
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Add funds mutation
  const { mutate: addFunds, isPending: isAddingFunds } = useMutation({
    mutationFn: async (amount: number) => {
      const response = await fetch('/api/sessions/add-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add funds');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Funds added successfully',
        description: 'Your balance has been updated.',
        variant: 'default'
      });
      setCustomAmount('');
      setProcessingAmount(null);
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/balance'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add funds',
        description: error.message,
        variant: 'destructive'
      });
      setProcessingAmount(null);
    }
  });

  const handleAddFunds = (amount: number) => {
    setProcessingAmount(amount);
    addFunds(amount);
  };

  const handleCustomAmountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(customAmount) * 100; // Convert to cents
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount.',
        variant: 'destructive'
      });
      return;
    }
    handleAddFunds(Math.round(amount));
  };

  if (isLoadingBalance) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 flex justify-center items-center min-h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (balanceError) {
    return (
      <Card className="w-full border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>There was a problem loading your balance information.</p>
          <Button 
            onClick={() => refetchBalance()} 
            variant="outline" 
            className="mt-4"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Define type for the balance data
  interface BalanceData {
    balance: number;
    lockedAmount: number;
    [key: string]: any;
  }

  // Using type assertion with default values
  const { balance = 0, lockedAmount = 0 } = (balanceData || {}) as BalanceData;
  const availableBalance = balance;
  const reservedBalance = lockedAmount;
  const totalBalance = balance + lockedAmount;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-full">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          Reading Balance
        </CardTitle>
        <CardDescription>
          Add funds to your account for pay-per-minute readings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/50 rounded-xl p-4 mb-4">
          <div className="flex flex-col items-center justify-center mb-3">
            <span className="text-sm text-muted-foreground mb-1">Available Balance</span>
            <span className="text-3xl font-bold text-primary">
              {formatCurrency(availableBalance / 100)}
            </span>
            
            {/* Visual indication of balance - empty if balance is low */}
            <div className="w-full mt-3 bg-muted rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (availableBalance / 10000) * 100)}%` }}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border/50">
            {reservedBalance > 0 && (
              <>
                <span className="text-muted-foreground">Reserved:</span>
                <span className="text-right font-medium">
                  {formatCurrency(reservedBalance / 100)}
                </span>
              </>
            )}
            
            <span className="text-muted-foreground">Total Balance:</span>
            <span className="text-right font-medium">
              {formatCurrency(totalBalance / 100)}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium mb-3">Add Funds:</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {TOPUP_OPTIONS.map((option) => (
              <Button 
                key={option.amount}
                onClick={() => handleAddFunds(option.amount)}
                variant="outline"
                disabled={isAddingFunds}
                className={`flex-col h-auto py-3 ${processingAmount === option.amount ? 'border-primary' : ''}`}
              >
                {processingAmount === option.amount ? (
                  <Loader2 className="h-5 w-5 animate-spin mb-1" />
                ) : (
                  <DollarSign className="h-5 w-5 mb-1" />
                )}
                <span className="text-base font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground mt-1">≈ {option.readingTime}</span>
              </Button>
            ))}
          </div>

          <form onSubmit={handleCustomAmountSubmit} className="flex items-center space-x-2">
            <div className="flex-1">
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="number"
                  placeholder="Custom amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="pl-8"
                  step="0.01"
                  min="1"
                  disabled={isAddingFunds}
                />
              </div>
            </div>
            <Button type="submit" disabled={isAddingFunds || !customAmount}>
              {isAddingFunds && !processingAmount ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Add
            </Button>
          </form>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground flex flex-col items-start gap-2 border-t pt-4">
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          Funds added to your balance can be used for pay-per-minute readings.
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          For development purposes only. In production, this would use Stripe for secure payments.
        </div>
      </CardFooter>
    </Card>
  );
};

export default ClientBalance;