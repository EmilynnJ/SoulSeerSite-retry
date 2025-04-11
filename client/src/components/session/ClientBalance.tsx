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

// Predefined top-up amounts
const TOPUP_AMOUNTS = [1000, 2500, 5000, 10000]; // in cents ($10, $25, $50, $100)

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

  const { balance = 0, lockedAmount = 0 } = balanceData || {};
  const availableBalance = balance;
  const reservedBalance = lockedAmount;
  const totalBalance = balance + lockedAmount;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Your Reading Balance</CardTitle>
        <CardDescription>
          Add funds to your account to book readings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Current Balance:</span>
            <span className="text-lg font-bold text-primary">
              {formatCurrency(availableBalance / 100)}
            </span>
          </div>
          
          {reservedBalance > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Reserved for Sessions:</span>
              <span className="text-base">
                {formatCurrency(reservedBalance / 100)}
              </span>
            </div>
          )}
          
          <div className="flex justify-between items-center border-t pt-2">
            <span className="text-sm font-medium">Total Balance:</span>
            <span className="text-base font-semibold">
              {formatCurrency(totalBalance / 100)}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium mb-3">Add Funds:</h3>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {TOPUP_AMOUNTS.map((amount) => (
              <Button 
                key={amount}
                onClick={() => handleAddFunds(amount)}
                variant="outline"
                disabled={isAddingFunds}
                className={processingAmount === amount ? 'border-primary' : ''}
              >
                {processingAmount === amount ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="mr-2 h-4 w-4" />
                )}
                {formatCurrency(amount / 100)}
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
      <CardFooter className="text-xs text-muted-foreground">
        Funds added to your balance can be used for pay-per-minute readings.
      </CardFooter>
    </Card>
  );
};

export default ClientBalance;