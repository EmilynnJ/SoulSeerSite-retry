import express, { Request, Response } from 'express';
import { IStorage } from '../storage';
import { AppointmentCreateInput } from '../../shared/schema';
import { authGuard, readerGuard } from '../middleware/auth';

export function createAppointmentsRouter(storage: IStorage) {
  const router = express.Router();

  // Get all appointments
  router.get('/', authGuard, async (req: Request, res: Response) => {
    try {
      // Check if filtering by reader or client
      const readerId = req.query.readerId ? parseInt(req.query.readerId as string) : undefined;
      const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
      
      // Get appointments based on filters
      let appointments;
      if (readerId) {
        appointments = await storage.getReaderAppointments(readerId);
      } else if (clientId) {
        appointments = await storage.getClientAppointments(clientId);
      } else {
        // Only admins can view all appointments
        if (req.user?.role !== 'admin') {
          return res.status(403).json({ message: 'Unauthorized' });
        }
        appointments = await storage.getAllAppointments();
      }
      
      res.json(appointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ message: 'Failed to fetch appointments' });
    }
  });

  // Get specific appointment by ID
  router.get('/:id', authGuard, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid appointment ID' });
      }

      const appointment = await storage.getAppointment(id);
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      // Verify that the user has permission to view this appointment
      if (req.user?.role !== 'admin' && 
          req.user?.id !== appointment.readerId && 
          req.user?.id !== appointment.clientId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      res.json(appointment);
    } catch (error) {
      console.error('Error fetching appointment:', error);
      res.status(500).json({ message: 'Failed to fetch appointment' });
    }
  });

  // Create a new appointment
  router.post('/', authGuard, async (req: Request, res: Response) => {
    try {
      const appointmentData: AppointmentCreateInput = req.body;
      const clientId = req.user!.id;

      // Validate appointment data
      if (!appointmentData.readerId || !appointmentData.date || !appointmentData.startTime || !appointmentData.serviceType) {
        return res.status(400).json({ message: 'Missing required fields for appointment booking' });
      }

      // Check if the reader exists
      const reader = await storage.getUser(appointmentData.readerId);
      if (!reader || reader.role !== 'reader') {
        return res.status(404).json({ message: 'Reader not found' });
      }

      // Check if the reader is available at the requested time
      const isAvailable = await storage.checkReaderAvailability(
        appointmentData.readerId,
        appointmentData.date,
        appointmentData.startTime,
        appointmentData.duration || 30 // Default to 30 minutes if duration not specified
      );

      if (!isAvailable) {
        return res.status(400).json({ message: 'Reader is not available at the requested time' });
      }

      // Create the appointment
      const appointment = await storage.createAppointment({
        ...appointmentData,
        clientId,
        status: 'pending'
      });

      res.status(201).json(appointment);
    } catch (error) {
      console.error('Error creating appointment:', error);
      res.status(500).json({ message: 'Failed to create appointment' });
    }
  });

  // Update appointment status (confirm, cancel, reschedule)
  router.patch('/:id/status', authGuard, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid appointment ID' });
      }

      const { status, notes } = req.body;
      if (!status || !['confirmed', 'cancelled', 'completed', 'no-show'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }

      // Get the existing appointment
      const appointment = await storage.getAppointment(id);
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      // Check if the user has permission to update this appointment
      // Readers can update appointments they are scheduled for
      // Clients can only cancel their own appointments
      if (req.user?.role === 'reader' && req.user.id === appointment.readerId) {
        // Readers can update to any status
      } else if (req.user?.id === appointment.clientId) {
        // Clients can only cancel their own appointments
        if (status !== 'cancelled') {
          return res.status(403).json({ message: 'Clients can only cancel appointments' });
        }
      } else if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      // Update the appointment
      const updatedAppointment = await storage.updateAppointment(id, { 
        status,
        notes: notes || undefined
      });

      res.json(updatedAppointment);
    } catch (error) {
      console.error('Error updating appointment status:', error);
      res.status(500).json({ message: 'Failed to update appointment status' });
    }
  });

  // Reschedule an appointment
  router.patch('/:id/reschedule', authGuard, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid appointment ID' });
      }

      const { date, startTime, duration } = req.body;
      if (!date || !startTime) {
        return res.status(400).json({ message: 'New date and start time are required' });
      }

      // Get the existing appointment
      const appointment = await storage.getAppointment(id);
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      // Check if the user has permission to reschedule this appointment
      if (req.user?.role !== 'admin' && 
          req.user?.id !== appointment.readerId && 
          req.user?.id !== appointment.clientId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      // Check if the new time is available
      const isAvailable = await storage.checkReaderAvailability(
        appointment.readerId,
        date,
        startTime,
        duration || appointment.duration || 30
      );

      if (!isAvailable) {
        return res.status(400).json({ message: 'Reader is not available at the requested time' });
      }

      // Update the appointment
      const updatedAppointment = await storage.updateAppointment(id, { 
        date,
        startTime,
        duration: duration || appointment.duration,
        status: 'confirmed' // Reset status to confirmed when rescheduled
      });

      res.json(updatedAppointment);
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      res.status(500).json({ message: 'Failed to reschedule appointment' });
    }
  });

  return router;
}

export default createAppointmentsRouter;