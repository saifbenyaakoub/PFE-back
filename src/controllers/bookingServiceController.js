const Booking = require("../models/bookingService");

const createBooking = async (req, res) => {
  try {
    const { service_id, client_id, date, time, details, total_price } = req.body;

    if (!service_id || !client_id || !date || !time || !total_price) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const booking = await Booking.create({
      service_id,
      client_id,
      date,
      time,
      details,
      total_price,
    });

    res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Booking failed" });
  }
};

module.exports = { createBooking };