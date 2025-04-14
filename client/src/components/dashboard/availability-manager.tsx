import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Loader2, Plus, X, Save, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TimeSlot {
  start: string;
  end: string;
}

interface DayAvailability {
  day: string;
  slots: TimeSlot[];
}

interface AvailabilityManagerProps {
  readerId: number;
}

// Helper function to generate time options
const generateTimeOptions = () => {
  const times: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const formattedHour = hour.toString().padStart(2, '0');
      const formattedMinute = minute.toString().padStart(2, '0');
      times.push(`${formattedHour}:${formattedMinute}`);
    }
  }
  return times;
};

export function AvailabilityManager({ readerId }: AvailabilityManagerProps) {
  const { toast } = useToast();
  const [daysOfWeek] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const timeOptions = generateTimeOptions();

  // Fetch current availability
  const { data, isLoading } = useQuery({
    queryKey: ['/api/readers/availability', readerId],
    queryFn: () => apiRequest<DayAvailability[]>(`/api/readers/availability/${readerId}`),
    enabled: !!readerId,
  });

  // Initialize availability from fetched data
  useEffect(() => {
    if (data) {
      setAvailability(data);
    } else {
      // Initialize with empty slots for each day
      const initialAvailability = daysOfWeek.map(day => ({
        day,
        slots: []
      }));
      setAvailability(initialAvailability);
    }
  }, [data, daysOfWeek]);

  // Save availability mutation
  const saveMutation = useMutation({
    mutationFn: (availabilityData: DayAvailability[]) => {
      return apiRequest('/api/readers/availability/update', {
        method: 'POST',
        body: JSON.stringify({
          readerId,
          availability: availabilityData
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Availability saved",
        description: "Your availability has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/readers/availability', readerId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save availability. Please try again.",
        variant: "destructive",
      });
      console.error("Error saving availability:", error);
    },
  });

  // Handle adding a new time slot to a day
  const addTimeSlot = (dayIndex: number) => {
    const updatedAvailability = [...availability];
    updatedAvailability[dayIndex].slots.push({
      start: "09:00",
      end: "17:00"
    });
    setAvailability(updatedAvailability);
  };

  // Handle removing a time slot
  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    const updatedAvailability = [...availability];
    updatedAvailability[dayIndex].slots.splice(slotIndex, 1);
    setAvailability(updatedAvailability);
  };

  // Handle time slot change
  const updateTimeSlot = (dayIndex: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    const updatedAvailability = [...availability];
    updatedAvailability[dayIndex].slots[slotIndex][field] = value;
    setAvailability(updatedAvailability);
  };

  // Save all availability
  const saveAvailability = () => {
    saveMutation.mutate(availability);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Clock className="h-5 w-5 mr-2" /> 
          Manage Your Availability
        </CardTitle>
        <CardDescription>
          Set the days and times when you're available for readings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {availability.map((day, dayIndex) => (
            <div key={day.day} className="border rounded-md p-4">
              <h3 className="text-lg font-medium mb-3">{day.day}</h3>
              
              {day.slots.length === 0 ? (
                <p className="text-sm text-muted-foreground mb-3">No availability set for this day</p>
              ) : (
                <div className="space-y-3 mb-3">
                  {day.slots.map((slot, slotIndex) => (
                    <div key={slotIndex} className="flex items-center space-x-2">
                      <div className="grid grid-cols-2 gap-2 flex-1">
                        <Select
                          value={slot.start}
                          onValueChange={(value) => updateTimeSlot(dayIndex, slotIndex, 'start', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Start time" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map((time) => (
                              <SelectItem key={`start-${time}`} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Select
                          value={slot.end}
                          onValueChange={(value) => updateTimeSlot(dayIndex, slotIndex, 'end', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="End time" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map((time) => (
                              <SelectItem 
                                key={`end-${time}`} 
                                value={time}
                                disabled={time <= slot.start}
                              >
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTimeSlot(dayIndex, slotIndex)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => addTimeSlot(dayIndex)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Time Slot
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={saveAvailability}
          disabled={saveMutation.isPending}
          className="w-full"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Availability
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}