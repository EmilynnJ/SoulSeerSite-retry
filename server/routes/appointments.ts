import express from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { authGuard } from '../middleware/auth';
import { insertAppointmentSchema } from '../../shared/schema';

const router = express.Router();

// Get appointments for a specific reader
router.get('/reader/:readerId', authGuard, async (req, res) => {
  try {
    const readerId = parseInt(req.params.readerId);
    
    if (isNaN(readerId)) {
      return res.status(400).json({ message: 'Invalid reader ID' });
    }
    
    // Only allow readers to see their own appointments or admin users
    if (req.user?.id !== readerId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view these appointments' });
    }
    
    const appointments = await storage.getAppointmentsByReader(readerId);
    
    // For each appointment, get the client name
    const appointmentsWithClientNames = await Promise.all(appointments.map(async (appointment) => {
      const client = await storage.getUser(appointment.clientId);
      return {
        ...appointment,
        clientName: client ? `${client.fullName || client.username}` : `Client #${appointment.clientId}`
      };
    }));
    
    res.status(200).json(appointmentsWithClientNames);
  } catch (error) {
    console.error('Error fetching reader appointments:', error);
    res.status(500).json({ message: 'Failed to fetch appointments' });
  }
});

// Get appointments for a specific client
router.get('/client/:clientId', authGuard, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }
    
    // Only allow clients to see their own appointments or admin users
    if (req.user?.id !== clientId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view these appointments' });
    }
    
    const appointments = await storage.getAppointmentsByClient(clientId);
    
    // For each appointment, get the reader name
    const appointmentsWithReaderNames = await Promise.all(appointments.map(async (appointment) => {
      const reader = await storage.getUser(appointment.readerId);
      return {
        ...appointment,
        readerName: reader ? `${reader.fullName || reader.username}` : `Reader #${appointment.readerId}`
      };
    }));
    
    res.status(200).json(appointmentsWithReaderNames);
  } catch (error) {
    console.error('Error fetching client appointments:', error);
    res.status(500).json({ message: 'Failed to fetch appointments' });
  }
});

// Create a new appointment
router.post('/', authGuard, async (req, res) => {
  try {
    const appointmentData = req.body;
    
    // Validate request body
    const appointmentSchema = insertAppointmentSchema.extend({
      readerId: z.number(),
      clientId: z.number(),
      date: z.string(),
      time: z.string(),
      type: z.string(),
      duration: z.number(),
      notes: z.string().optional()
    });
    
    try {
      appointmentSchema.parse(appointmentData);
    } catch (validationError) {
      return res.status(400).json({ 
        message: 'Invalid appointment data', 
        errors: validationError 
      });
    }
    
    // Verify the client is making the booking
    if (req.user?.id !== appointmentData.clientId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to book for this client' });
    }
    
    // Check reader availability for the requested slot
    const readerId = appointmentData.readerId;
    const date = appointmentData.date;
    const startTime = appointmentData.time;
    
    // Calculate end time based on duration
    const calculateEndTime = (start: string, durationMins: number): string => {
      const [hours, minutes] = start.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + durationMins;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    };
    
    const endTime = calculateEndTime(startTime, appointmentData.duration);
    
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
    
    if (!isAvailable) {
      return res.status(400).json({ message: 'The requested time slot is not available' });
    }
    
    // Check existing appointments for conflicts
    const appointments = await storage.getAppointmentsByReader(readerId);
    const hasConflict = appointments.some(appointment => {
      if (appointment.date !== date || appointment.status === 'canceled') {
        return false;
      }
      
      const apptStart = appointment.time;
      const apptDuration = appointment.duration;
      const apptEnd = calculateEndTime(apptStart, apptDuration);
      
      return (startTime < apptEnd && endTime > apptStart);
    });
    
    if (hasConflict) {
      return res.status(400).json({ message: 'The requested time slot conflicts with an existing appointment' });
    }
    
    // Create the appointment
    const appointment = await storage.createAppointment(appointmentData);
    
    // Return the created appointment
    res.status(201).json({ 
      message: 'Appointment booked successfully',
      appointment
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ message: 'Failed to create appointment' });
  }
});

// Update an appointment
router.patch('/:id', authGuard, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const updates = req.body;
    
    if (isNaN(appointmentId)) {
      return res.status(400).json({ message: 'Invalid appointment ID' });
    }
    
    // Get the appointment
    const appointment = await storage.getAppointment(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Verify user is authorized to update this appointment
    const isReader = req.user?.id === appointment.readerId;
    const isClient = req.user?.id === appointment.clientId;
    const isAdmin = req.user?.role === 'admin';
    
    if (!isReader && !isClient && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to update this appointment' });
    }
    
    // Update the appointment
    const updatedAppointment = await storage.updateAppointment(appointmentId, updates);
    
    res.status(200).json({ 
      message: 'Appointment updated successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Failed to update appointment' });
  }
});

// Cancel an appointment
router.post('/:id/cancel', authGuard, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    
    if (isNaN(appointmentId)) {
      return res.status(400).json({ message: 'Invalid appointment ID' });
    }
    
    // Get the appointment
    const appointment = await storage.getAppointment(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Verify user is authorized to cancel this appointment
    const isReader = req.user?.id === appointment.readerId;
    const isClient = req.user?.id === appointment.clientId;
    const isAdmin = req.user?.role === 'admin';
    
    if (!isReader && !isClient && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to cancel this appointment' });
    }
    
    // Cancel the appointment
    const canceledAppointment = await storage.cancelAppointment(appointmentId);
    
    res.status(200).json({ 
      message: 'Appointment canceled successfully',
      appointment: canceledAppointment
    });
  } catch (error) {
    console.error('Error canceling appointment:', error);
    res.status(500).json({ message: 'Failed to cancel appointment' });
  }
});

export default router;