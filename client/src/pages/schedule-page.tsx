import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar as CalendarIcon, Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays, addMinutes, setHours, setMinutes, isBefore, isAfter, differenceInMinutes } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";

// Define types for reader availability
interface Availability {
  day: string;
  slots: {
    start: string;
    end: string;
  }[];
}

interface Reader {
  id: number;
  username: string;
  fullName: string;
  profileImage: string;
  bio: string;
  specialties: string[];
  rating: number;
  reviewCount: number;
  pricingVideo: number;
  pricingVoice: number;
  pricingChat: number;
  minimumSessionLength: number;
  availability?: Availability[];
  isOnline: boolean;
}

// Form schema
const scheduleSchema = z.object({
  date: z.date({
    required_error: "Please select a date",
  }),
  time: z.string({
    required_error: "Please select a time",
  }),
  type: z.enum(["chat", "voice", "video"], {
    required_error: "Please select a reading type",
  }),
  duration: z.number({
    required_error: "Please select a duration",
  }).min(5),
  notes: z.string().optional(),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

export default function SchedulePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Fetch reader data
  const { data: reader, isLoading, error } = useQuery({
    queryKey: ['/api/readers', id],
    queryFn: () => apiRequest<Reader>(`/api/readers/${id}`),
    enabled: !!id,
  });

  // Fetch reader's availability
  const { data: availability, isLoading: loadingAvailability } = useQuery({
    queryKey: ['/api/readers/availability', id],
    queryFn: () => apiRequest<Availability[]>(`/api/readers/availability/${id}`),
    enabled: !!id,
  });

  // Form setup
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      type: "chat",
      duration: reader?.minimumSessionLength || 15,
      notes: "",
    },
  });

  // Calculate available time slots when date changes
  useEffect(() => {
    if (!selectedDate || !availability) return;

    const day = format(selectedDate, 'EEEE').toLowerCase();
    const dayAvailability = availability.find(a => a.day.toLowerCase() === day);
    
    if (!dayAvailability) {
      setAvailableSlots([]);
      return;
    }

    // Generate time slots from availability
    const slots: string[] = [];
    dayAvailability.slots.forEach(slot => {
      const [startHour, startMinute] = slot.start.split(':').map(Number);
      const [endHour, endMinute] = slot.end.split(':').map(Number);
      
      let currentTime = setMinutes(setHours(selectedDate, startHour), startMinute);
      const endTime = setMinutes(setHours(selectedDate, endHour), endMinute);
      
      // Generate 30-minute slots
      while (isBefore(currentTime, endTime) && differenceInMinutes(endTime, currentTime) >= 30) {
        slots.push(format(currentTime, 'HH:mm'));
        currentTime = addMinutes(currentTime, 30);
      }
    });
    
    setAvailableSlots(slots);
  }, [selectedDate, availability]);

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      form.setValue('date', date);
    }
  };

  // Schedule reading mutation
  const scheduleMutation = useMutation({
    mutationFn: (values: ScheduleFormValues) => {
      return apiRequest('/api/readings/schedule', {
        method: 'POST',
        body: JSON.stringify({
          readerId: Number(id),
          clientId: user?.id,
          date: format(values.date, 'yyyy-MM-dd'),
          time: values.time,
          type: values.type,
          duration: values.duration,
          notes: values.notes || "",
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Reading scheduled",
        description: "Your reading has been scheduled successfully.",
      });
      // Reset form
      form.reset();
      setSelectedDate(undefined);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to schedule reading. Please try again.",
        variant: "destructive",
      });
      console.error("Error scheduling reading:", error);
    },
  });

  // Handle form submission
  const onSubmit = (values: ScheduleFormValues) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to schedule a reading.",
        variant: "destructive",
      });
      return;
    }
    
    scheduleMutation.mutate(values);
  };

  // Calculate price based on selected reading type and duration
  const calculatePrice = () => {
    if (!reader) return 0;
    
    const type = form.watch('type');
    const duration = form.watch('duration') || reader.minimumSessionLength;
    
    let pricePerMinute = 0;
    switch(type) {
      case 'chat':
        pricePerMinute = (reader.pricingChat || 0) / 100;
        break;
      case 'voice':
        pricePerMinute = (reader.pricingVoice || 0) / 100;
        break;
      case 'video':
        pricePerMinute = (reader.pricingVideo || 0) / 100;
        break;
    }
    
    return pricePerMinute * duration;
  };

  if (isLoading || loadingAvailability) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !reader) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-alex mb-4">Error</h1>
        <p>Failed to load reader information. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-4xl font-alex mb-6 text-center">Schedule a Reading</h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Reader Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="font-playfair">{reader.fullName}</CardTitle>
            <CardDescription>{reader.specialties?.join(", ")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 mb-4">
              <img 
                src={reader.profileImage || "/assets/default-avatar.png"} 
                alt={reader.fullName}
                className="h-16 w-16 rounded-full object-cover"
              />
              <div>
                <div className="font-medium">{reader.username}</div>
                <div className="text-sm text-muted-foreground">
                  {reader.reviewCount} reviews • {reader.rating} stars
                </div>
              </div>
            </div>
            <p className="text-sm mb-4">{reader.bio}</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="border rounded p-2 text-center">
                <div className="font-medium">Chat</div>
                <div>${reader.pricingChat / 100}/min</div>
              </div>
              <div className="border rounded p-2 text-center">
                <div className="font-medium">Voice</div>
                <div>${reader.pricingVoice / 100}/min</div>
              </div>
              <div className="border rounded p-2 text-center">
                <div className="font-medium">Video</div>
                <div>${reader.pricingVideo / 100}/min</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scheduling Form */}
        <Card>
          <CardHeader>
            <CardTitle className="font-playfair">Select Date & Time</CardTitle>
            <CardDescription>Choose when you'd like to have your reading</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex flex-col space-y-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Date</FormLabel>
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={handleDateSelect}
                          disabled={(date) => 
                            isBefore(date, new Date()) || 
                            isAfter(date, addDays(new Date(), 30))
                          }
                          className="rounded-md border"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Time</FormLabel>
                        <Select
                          disabled={!selectedDate || availableSlots.length === 0}
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableSlots.length > 0 ? (
                              availableSlots.map((slot) => (
                                <SelectItem key={slot} value={slot}>
                                  {slot}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>
                                No available slots
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reading Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="chat">Chat</SelectItem>
                            <SelectItem value="voice">Voice</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes)</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          defaultValue={String(reader.minimumSessionLength)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="45">45 minutes</SelectItem>
                            <SelectItem value="60">60 minutes</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Minimum session length is {reader.minimumSessionLength} minutes
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes for Reader (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Share any specific topics or questions you'd like to discuss"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="py-2 px-4 bg-muted rounded-md">
                  <div className="flex justify-between items-center">
                    <span>Estimated Total:</span>
                    <span className="font-bold">${calculatePrice().toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    You will only be charged for the actual duration of the reading
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={scheduleMutation.isPending || !selectedDate || !form.watch('time')}
                >
                  {scheduleMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      Schedule Reading
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}