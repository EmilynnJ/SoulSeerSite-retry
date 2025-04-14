import express, { Request, Response } from 'express';
import { IStorage } from '../storage';
import { DayAvailability } from '../../shared/schema';
import { authGuard, readerGuard } from '../middleware/auth';

// Helper function to get end time based on start time and duration
function getEndTime(startTime: string, durationMins: number): string {
  // Parse start time (HH:MM format)
  const [hours, minutes] = startTime.split(':').map(Number);
  
  // Calculate end time
  let endHours = hours + Math.floor((minutes + durationMins) / 60);
  const endMinutes = (minutes + durationMins) % 60;
  
  // Format end time
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

export function createAvailabilityRouter(storage: IStorage) {
  const router = express.Router();

  // Get reader availability
  router.get('/:readerId', async (req: Request, res: Response) => {
    try {
      const readerId = parseInt(req.params.readerId);
      if (isNaN(readerId)) {
        return res.status(400).json({ message: 'Invalid reader ID' });
      }

      const availability = await storage.getReaderAvailability(readerId);
      res.json(availability);
    } catch (error) {
      console.error('Error fetching reader availability:', error);
      res.status(500).json({ message: 'Failed to fetch reader availability' });
    }
  });

  // Set/update reader availability (protected - reader only)
  router.post('/', authGuard, readerGuard, async (req: Request, res: Response) => {
    try {
      const readerId = req.user!.id;
      const availability: DayAvailability[] = req.body.availability;

      if (!Array.isArray(availability)) {
        return res.status(400).json({ message: 'Invalid availability data format' });
      }

      // Validate the availability data
      for (const dayData of availability) {
        if (!dayData.day || !Array.isArray(dayData.slots)) {
          return res.status(400).json({ message: 'Invalid day availability format' });
        }

        // Validate each time slot
        for (const slot of dayData.slots) {
          if (!slot.startTime || !slot.endTime) {
            return res.status(400).json({ message: 'Invalid time slot format' });
          }
        }
      }

      // Save the availability
      const updatedAvailability = await storage.setReaderAvailability(readerId, availability);
      res.json(updatedAvailability);
    } catch (error) {
      console.error('Error updating reader availability:', error);
      res.status(500).json({ message: 'Failed to update reader availability' });
    }
  });

  // Delete a specific day's availability (protected - reader only)
  router.delete('/:day', authGuard, readerGuard, async (req: Request, res: Response) => {
    try {
      const readerId = req.user!.id;
      const day = req.params.day;

      if (!day || !['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(day.toLowerCase())) {
        return res.status(400).json({ message: 'Invalid day specified' });
      }

      await storage.deleteReaderDayAvailability(readerId, day.toLowerCase());
      res.json({ message: `Availability for ${day} deleted successfully` });
    } catch (error) {
      console.error('Error deleting reader day availability:', error);
      res.status(500).json({ message: 'Failed to delete reader day availability' });
    }
  });

  return router;
}

export default createAvailabilityRouter;