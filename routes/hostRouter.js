const express = require('express');
const { uploadHome } = require('../utils/multer');
const hostRouter = express.Router();
const hostController = require('../controllers/hostController');

hostRouter.get('/add-home', hostController.getAddHome);
hostRouter.post('/add-home', uploadHome.single('image'), hostController.postAddHome);
hostRouter.get('/host-homes', hostController.getHostHomes);
hostRouter.get("/edit-home/:homeId", hostController.getEditHome);
hostRouter.post('/edit-home', uploadHome.single('image'), hostController.postEditHome);
hostRouter.post("/delete-home/:homeId", hostController.postDeleteHome);
hostRouter.get('/bookings', hostController.getHostBookings);
hostRouter.post('/bookings/update-status', hostController.postUpdateBookingStatus);
hostRouter.post('/bookings/host-feedback',  hostController.postHostFeedback);
hostRouter.get('/dashboard', hostController.getHostDashboard);

module.exports = hostRouter;