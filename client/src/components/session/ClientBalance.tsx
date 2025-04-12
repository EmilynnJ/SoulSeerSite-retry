import React, { useState, useEffect } from 'react';
import { FiClock, FiDollarSign, FiAlertTriangle } from 'react-icons/fi';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import apiRequest from '@/lib/apiRequest';

interface ClientBalanceProps {
  userId: string;
  sessionId: string;
  perMinuteRate: number;
  onWarning?: (timeLeft: number) => void;
  onBalanceDepleted?: () => void;
  className?: string;
}

export const ClientBalance: React.FC<ClientBalanceProps> = ({
  userId,
  sessionId,
  perMinuteRate,
  onWarning,
  onBalanceDepleted,
  className
}) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warningIssued, setWarningIssued] = useState(false);
  const [depletionWarningIssued, setDepletionWarningIssued] = useState(false);
  
  // Fetch client balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await apiRequest(`/api/client-balance/${userId}`, {
          method: 'GET'
        });
        
        if (response && response.balance !== undefined) {
          setBalance(response.balance);
        } else {
          throw new Error('Invalid balance data');
        }
      } catch (err) {
        console.error('Error fetching balance:', err);
        setError('Failed to fetch balance');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBalance();
    
    // Poll for balance updates every 30 seconds
    const intervalId = setInterval(fetchBalance, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [userId]);
  
  // Calculate estimated time left based on balance and rate
  const estimatedMinutesLeft = balance !== null && perMinuteRate > 0
    ? Math.floor(balance / perMinuteRate)
    : null;
  
  // Issue warnings when balance is low
  useEffect(() => {
    if (estimatedMinutesLeft !== null) {
      // Warning at 3 minutes left
      if (estimatedMinutesLeft <= 3 && !warningIssued) {
        setWarningIssued(true);
        if (onWarning) onWarning(estimatedMinutesLeft);
      }
      
      // Warning when almost depleted (less than 1 minute)
      if (estimatedMinutesLeft < 1 && !depletionWarningIssued) {
        setDepletionWarningIssued(true);
        if (onBalanceDepleted) onBalanceDepleted();
      }
    }
  }, [estimatedMinutesLeft, warningIssued, depletionWarningIssued, onWarning, onBalanceDepleted]);
  
  // Calculate progress for the progress bar
  const progressValue = () => {
    if (balance === null || isLoading) return 0;
    
    const maxDisplayBalance = 50 * perMinuteRate; // Show full bar at 50 minutes
    const percentage = Math.min((balance / maxDisplayBalance) * 100, 100);
    return percentage;
  };
  
  // Format balance to currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount / 100); // Convert cents to dollars
  };
  
  // Determine status based on estimated time left
  const getStatusInfo = () => {
    if (estimatedMinutesLeft === null) return { color: 'bg-gray-500', text: 'Unknown' };
    
    if (estimatedMinutesLeft < 1) {
      return { color: 'bg-red-500', text: 'Critical' };
    } else if (estimatedMinutesLeft <= 3) {
      return { color: 'bg-orange-500', text: 'Low' };
    } else if (estimatedMinutesLeft <= 10) {
      return { color: 'bg-yellow-500', text: 'Moderate' };
    } else {
      return { color: 'bg-green-500', text: 'Good' };
    }
  };
  
  const statusInfo = getStatusInfo();
  
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="p-4">
        {error ? (
          <div className="flex items-center space-x-2 text-red-500">
            <FiAlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FiDollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Balance:</span>
              </div>
              <div className="text-sm font-semibold">
                {isLoading ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : balance !== null ? (
                  formatCurrency(balance)
                ) : (
                  <span className="text-muted-foreground">Unknown</span>
                )}
              </div>
            </div>
            
            <Progress value={progressValue()} className="h-2" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FiClock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Estimated time:</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold">
                  {isLoading ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : estimatedMinutesLeft !== null ? (
                    `${estimatedMinutesLeft} minute${estimatedMinutesLeft !== 1 ? 's' : ''}`
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </span>
                
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs font-normal py-0 px-2",
                    `${statusInfo.color}/10 text-${statusInfo.color.replace('bg-', '')}`
                  )}
                >
                  {statusInfo.text}
                </Badge>
              </div>
            </div>
            
            {estimatedMinutesLeft !== null && estimatedMinutesLeft <= 3 && (
              <div className="text-xs bg-orange-500/10 text-orange-800 p-2 rounded-md">
                Low balance! The session will end when your balance is depleted.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};