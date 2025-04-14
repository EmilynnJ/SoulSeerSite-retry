import express from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { authGuard } from '../middleware/auth';
import { insertReaderAvailabilitySchema } from '../../shared/schema';

const router = express.Router();

// Format to transform DB availability to frontend format
const formatAvailabilityForClient = (availabilityList: any[]) => {
  // Group by day
  const availabilityByDay = availabilityList.reduce((acc: any, slot: any) => {
    const day = slot.day;
    if (!acc[day]) {
      acc[day] = [];
    }
    
    acc[day].push({
      start: slot.startTime,
      end: slot.endTime
    });
    
    return acc;
  }, {});
  
  // Convert to array of day objects
  return Object.keys(availabilityByDay).map(day => ({
    day,
    slots: availabilityByDay[day]
  }));
};

// Get availability for a reader
router.get('/:readerId', async (req, res) => {
  try {
    const readerId = parseInt(req.params.readerId);
    
    if (isNaN(readerId)) {
      return res.status(400).json({ message: 'Invalid reader ID' });
    }
    
    const availabilityList = await storage.getReaderAvailability(readerId);
    const formattedAvailability = formatAvailabilityForClient(availabilityList);
    
    res.status(200).json(formattedAvailability);
  } catch (error) {
    console.error('Error fetching reader availability:', error);
    res.status(500).json({ message: 'Failed to fetch availability' });
  }
});

// Update reader's availability
router.post('/update', authGuard, async (req, res) => {
  try {
    const { readerId, availability } = req.body;
    
    // Validate user is updating their own availability or is an admin
    if (req.user?.id !== readerId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this reader\'s availability' });
    }
    
    // Delete existing availability
    const existingAvailability = await storage.getReaderAvailability(readerId);
    for (const slot of existingAvailability) {
      await storage.deleteReaderAvailability(slot.id);
    }
    
    // Create new availability slots
    const newAvailabilitySlots = [];
    
    for (const dayAvailability of availability) {
      const { day, slots } = dayAvailability;
      
      for (const slot of slots) {
        const newSlot = await storage.createReaderAvailability({
          readerId,
          day,
          startTime: slot.start,
          endTime: slot.end
        });
        
        newAvailabilitySlots.push(newSlot);
      }
    }
    
    const formattedAvailability = formatAvailabilityForClient(newAvailabilitySlots);
    res.status(200).json({ message: 'Availability updated successfully', availability: formattedAvailability });
  } catch (error) {
    console.error('Error updating reader availability:', error);
    res.status(500).json({ message: 'Failed to update availability' });
  }
});

// Check if a time slot is available
router.post('/check', async (req, res) => {
  try {
    const { readerId, date, startTime, endTime } = req.body;
    
    if (!readerId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Get day of week from date
    const dateObj = new Date(date);
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
    
    // Get reader's availability for that day
    const availabilityList = await storage.getReaderAvailability(readerId);
    const dayAvailability = availabilityList.filter(slot => slot.day === dayOfWeek);
    
    // Check if requested time is within any available slot
    const isAvailable = dayAvailability.some(slot => {
      return startTime >= slot.startTime && endTime <= slot.endTime;
    });
    
    // Check existing appointments for conflicts
    const appointments = await storage.getAppointmentsByReader(readerId);
    const hasConflict = appointments.some(appointment => {
      if (appointment.date !== date || appointment.status === 'canceled') {
        return false;
      }
      
      const apptStart = appointment.time;
      const apptDuration = appointment.duration;
      const apptEnd = getEndTime(apptStart, apptDuration);
      
      return (startTime < apptEnd && endTime > apptStart);
    });
    
    res.status(200).json({ 
      available: isAvailable && !hasConflict 
    });
  } catch (error) {
    console.error('Error checking time slot availability:', error);
    res.status(500).json({ message: 'Failed to check availability' });
  }
});

// Helper function to calculate end time
function getEndTime(startTime: string, durationMins: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMins;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

export default router;