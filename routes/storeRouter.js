const express = require('express');
const storeRouter = express.Router();
const storeController = require('../controllers/storeController');
const bookingController = require('../controllers/bookingController');
const profileController = require('../controllers/profileController');
const { uploadProfile } = require('../utils/multer');
const notificationController = require('../controllers/notificationController');
storeRouter.get('/',storeController.getIndex);
storeRouter.get('/homes',storeController.getHomes);
storeRouter.get('/bookings',bookingController.getGuestBookings);
storeRouter.get('/favourite-list',storeController.getFavouriteList);
storeRouter.post('/favourite-list',storeController.postAddToFavourite);

storeRouter.get('/homes/:homeId',storeController.getHomeDetails);
storeRouter.get("/rules/:homeId", storeController.getHouseRules);
storeRouter.post('/favourite-list/delete/:homeId',storeController.postRemoveFromFavourite);
storeRouter.post('/bookings/create', bookingController.postCreateBooking);
storeRouter.post('/bookings/cancel/:bookingId', bookingController.postCancelBooking);
storeRouter.get('/profile', profileController.getProfile);
storeRouter.post('/profile', uploadProfile.single('profileImage'), profileController.postUpdateProfile);
storeRouter.get('/notifications',  notificationController.getNotifications);
storeRouter.post('/bookings/guest-feedback', storeController.postGuestFeedback);
storeRouter.post('/homes/reviews/reply', storeController.postHostReplyToFeedback);
storeRouter.get('/my-report', storeController.getGuestReport);

module.exports = storeRouter;